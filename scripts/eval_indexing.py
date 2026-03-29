#!/usr/bin/env python3
"""
Evaluate indexing quality by running search queries against reindexed test videos.

Uses eval/indexing_benchmark.json queries, searches the retrieval_units table,
and computes Recall@5, Visual Recall, NDCG@5, MRR, and Hit@3.

Usage:
    python scripts/eval_indexing.py
    python scripts/eval_indexing.py --mode rerank
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

import asyncpg

from workers.common.config import get_settings
from workers.common.embedding import create_embedding_backend
from workers.common.search.base import (
    DEFAULT_KNOWLEDGE_VECTOR_DIMENSION,
    vector_to_literal,
)
from workers.common.search.rerank import LLMReranker

BENCHMARK_PATH = REPO_ROOT / "eval" / "indexing_benchmark.json"


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

async def get_connection() -> asyncpg.Connection:
    url = get_settings().database.url or os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return await asyncpg.connect(url)


async def vector_search(
    conn: asyncpg.Connection,
    query_embedding: list[float],
    *,
    limit: int = 40,
) -> list[dict[str, Any]]:
    dim = DEFAULT_KNOWLEDGE_VECTOR_DIMENSION
    vec_literal = vector_to_literal(query_embedding)
    distance_sql = (
        f"(ru.embedding::halfvec({dim}) <=> "
        f"($1::vector({dim}))::halfvec({dim}))"
    )
    sql = f"""
        SELECT
            ru.id::text AS id,
            v.source_video_id,
            v.title,
            ru.unit_type,
            ru.transcript AS transcript_text,
            ru.visual_desc AS visual_description,
            ru.timestamp_start,
            ru.timestamp_end,
            1 - {distance_sql} AS score
        FROM retrieval_units AS ru
        JOIN videos AS v ON v.id = ru.video_id
        WHERE ru.unit_type = ANY($2::text[])
        ORDER BY {distance_sql}
        LIMIT $3
    """
    rows = await conn.fetch(sql, vec_literal, ["speech", "visual"], limit)
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Dedup by video
# ---------------------------------------------------------------------------

def _row_rank_score(row: dict[str, Any]) -> float:
    rerank_score = row.get("rerank_score")
    if rerank_score is not None:
        return float(rerank_score)
    return float(row.get("score", 0.0) or 0.0)


def dedupe_by_video(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        vid = row["source_video_id"]
        if vid not in seen or _row_rank_score(row) > _row_rank_score(seen[vid]):
            seen[vid] = row
    return sorted(seen.values(), key=_row_rank_score, reverse=True)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def dcg(relevances: list[float], k: int) -> float:
    total = 0.0
    for i, rel in enumerate(relevances[:k]):
        total += rel / math.log2(i + 2)
    return total


def ndcg_at_k(ranked_video_ids: list[str], relevant_ids: set[str], k: int) -> float:
    relevances = [1.0 if vid in relevant_ids else 0.0 for vid in ranked_video_ids[:k]]
    ideal = [1.0] * min(k, len(relevant_ids))
    idcg = dcg(ideal, k)
    if idcg == 0:
        return 0.0
    return dcg(relevances, k) / idcg


def reciprocal_rank(ranked_video_ids: list[str], relevant_ids: set[str]) -> float:
    for i, vid in enumerate(ranked_video_ids):
        if vid in relevant_ids:
            return 1.0 / (i + 1)
    return 0.0


def hit_at_k(ranked_video_ids: list[str], relevant_ids: set[str], k: int) -> bool:
    return bool(relevant_ids & set(ranked_video_ids[:k]))


async def rank_candidate_rows(
    *,
    mode: str,
    query_text: str,
    candidate_rows: list[dict[str, Any]],
    reranker: LLMReranker | None = None,
) -> list[dict[str, Any]]:
    if mode == "rerank":
        active_reranker = reranker or LLMReranker()
        return await active_reranker.rerank(
            query_text,
            candidate_rows,
            top_n=len(candidate_rows),
        )
    return sorted(
        [dict(row) for row in candidate_rows],
        key=_row_rank_score,
        reverse=True,
    )


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

async def run_eval(mode: str, top_k: int) -> dict[str, Any]:
    benchmark = json.loads(BENCHMARK_PATH.read_text())
    queries = benchmark["queries"]
    test_video_ids = {v["source_video_id"] for v in benchmark["test_videos"]}

    print(f"Loaded {len(queries)} queries, {len(test_video_ids)} test videos")
    print(f"Mode: {mode} | Top-K: {top_k}")
    print("-" * 70)

    conn = await get_connection()
    embedder = create_embedding_backend(
        output_dimension=DEFAULT_KNOWLEDGE_VECTOR_DIMENSION
    )
    reranker = LLMReranker() if mode == "rerank" else None

    ndcg_scores: list[float] = []
    mrr_scores: list[float] = []
    hit5_scores: list[float] = []
    visual_hits: list[float] = []
    visual_total: int = 0
    per_query: list[dict[str, Any]] = []

    for q in queries:
        if "id" not in q:
            continue
        qid = q["id"]
        query_text = q["query"]
        relevant_ids = set(q["relevant_videos"])
        difficulty = q.get("difficulty", "?")
        is_visual = qid.startswith("v")

        if not relevant_ids:
            continue

        embedding = embedder.embed_query(query_text)
        candidate_rows = await vector_search(conn, embedding, limit=top_k * 8)
        ranked_rows = await rank_candidate_rows(
            mode=mode,
            query_text=query_text,
            candidate_rows=candidate_rows,
            reranker=reranker,
        )
        deduped = dedupe_by_video(ranked_rows)
        ranked_ids = [r["source_video_id"] for r in deduped[:top_k]]

        q_ndcg = ndcg_at_k(ranked_ids, relevant_ids, top_k)
        q_mrr = reciprocal_rank(ranked_ids, relevant_ids)
        q_hit5 = 1.0 if hit_at_k(ranked_ids, relevant_ids, top_k) else 0.0

        ndcg_scores.append(q_ndcg)
        mrr_scores.append(q_mrr)
        hit5_scores.append(q_hit5)

        if is_visual:
            visual_hits.append(q_hit5)
            visual_total += 1

        status = "HIT" if q_hit5 else "MISS"
        marker = " [V]" if is_visual else ""
        print(
            f"  [{qid:>4}] {status:4} ndcg={q_ndcg:.3f} mrr={q_mrr:.3f} "
            f"[{difficulty:>6}]{marker} {query_text[:50]}"
        )

        per_query.append({
            "id": qid,
            "query": query_text,
            "difficulty": difficulty,
            "is_visual": is_visual,
            "ndcg": q_ndcg,
            "mrr": q_mrr,
            "hit5": q_hit5,
            "top_results": [
                {"video_id": r["source_video_id"], "title": r.get("title", ""), "score": float(r.get("score", 0))}
                for r in deduped[:top_k]
            ],
            "expected": list(relevant_ids),
        })

    await conn.close()

    n = len(per_query)
    avg_ndcg = sum(ndcg_scores) / n if n else 0
    avg_mrr = sum(mrr_scores) / n if n else 0
    recall_5 = sum(hit5_scores) / n if n else 0
    visual_recall = sum(visual_hits) / visual_total if visual_total else 0

    # By difficulty.
    for diff in ["easy", "medium", "hard"]:
        subset = [pq for pq in per_query if pq["difficulty"] == diff]
        if not subset:
            continue
        d_ndcg = sum(pq["ndcg"] for pq in subset) / len(subset)
        d_recall = sum(pq["hit5"] for pq in subset) / len(subset)
        print(f"\n  [{diff:>6}] n={len(subset):2d}  ndcg@{top_k}={d_ndcg:.4f}  recall@{top_k}={d_recall:.4f}")

    print(f"\n{'=' * 70}")
    print(f"recall@{top_k}: {recall_5:.4f}")
    print(f"visual_recall: {visual_recall:.4f}")
    print(f"ndcg@{top_k}: {avg_ndcg:.4f}")
    print(f"mrr: {avg_mrr:.4f}")
    print(f"total_queries: {n}")
    print(f"visual_queries: {visual_total}")
    print(f"{'=' * 70}")

    results = {
        "mode": mode,
        "top_k": top_k,
        "recall_5": recall_5,
        "visual_recall": visual_recall,
        "ndcg": avg_ndcg,
        "mrr": avg_mrr,
        "total_queries": n,
        "visual_queries": visual_total,
        "queries": per_query,
    }

    details_path = REPO_ROOT / "eval" / "indexing_eval_details.json"
    details_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\nDetailed results written to {details_path}")

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate indexing quality")
    parser.add_argument(
        "--mode",
        choices=["embedding", "rerank"],
        default="embedding",
    )
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()
    asyncio.run(run_eval(args.mode, args.top_k))


if __name__ == "__main__":
    main()
