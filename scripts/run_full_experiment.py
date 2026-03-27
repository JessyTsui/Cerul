#!/usr/bin/env python3
"""
Comprehensive indexing experiment: frames/segment sweep + annotation removal test.

Part 1: Dense visual embedding frames sweep (0, 1, 2, 3, 4, 5 frames/segment)
Part 2: Annotation removal verification (baseline vs no-annotation+dense vs annotation+dense)

All experiments use DB manipulation (no reindex needed for Part 1).
Part 2 uses the v2 approach: strip annotation text from existing visual units.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

import asyncpg
from app.config import get_settings
from scripts.eval_indexing import run_eval
from scripts.experiment_dense_visual_embed import (
    create_dense_visual_units,
    cleanup_dense_visual_units,
    _find_cached_video,
    load_test_video_ids,
)

RESULTS_PATH = REPO_ROOT / "eval" / "full_experiment_results.json"


async def get_connection() -> asyncpg.Connection:
    url = get_settings().database.url or os.getenv("DATABASE_URL", "")
    return await asyncpg.connect(url)


async def strip_visual_annotation_text(video_ids: list[str]) -> dict[str, int]:
    """Remove visual_desc/visual_type from existing visual units (simulates no annotation).
    Returns backup data for restoration."""
    conn = await get_connection()
    counts = {}
    for vid in video_ids:
        # Null out visual_desc and visual_type on annotation-based visual units
        result = await conn.execute(
            """
            UPDATE retrieval_units
            SET visual_desc = NULL, visual_type = NULL,
                content_text = (SELECT v.title FROM videos v WHERE v.id = retrieval_units.video_id)
            WHERE video_id = (SELECT id FROM videos WHERE source_video_id = $1)
              AND unit_type = 'visual'
              AND unit_index < 1000
            """,
            vid,
        )
        counts[vid] = int(result.split()[-1]) if result else 0

    # Also strip visual info from speech units' content_text
    for vid in video_ids:
        rows = await conn.fetch(
            """
            SELECT ru.id, ru.transcript, v.title
            FROM retrieval_units ru
            JOIN videos v ON v.id = ru.video_id
            WHERE v.source_video_id = $1 AND ru.unit_type = 'speech'
            """,
            vid,
        )
        for row in rows:
            title = row["title"] or ""
            transcript = row["transcript"] or ""
            new_content = f"{title}\n{transcript}".strip()
            await conn.execute(
                "UPDATE retrieval_units SET content_text = $1 WHERE id = $2",
                new_content,
                row["id"],
            )
    await conn.close()
    return counts


async def run_single_config(
    name: str,
    video_ids: list[str],
    frames_per_segment: int,
) -> dict[str, Any]:
    """Run a single dense visual config: cleanup → create N dense units → eval."""
    print(f"\n{'=' * 70}")
    print(f"CONFIG: {name}")
    print(f"{'=' * 70}")

    t0 = time.perf_counter()

    # Always start clean
    await cleanup_dense_visual_units(video_ids)

    dense_units = 0
    if frames_per_segment > 0:
        dense_stats = await create_dense_visual_units(
            video_ids=video_ids,
            frames_per_segment=frames_per_segment,
        )
        dense_units = dense_stats["total_units_created"]
        print(f"  Added {dense_units} dense visual units")

    eval_result = await run_eval("embedding", top_k=5)
    elapsed = time.perf_counter() - t0

    entry = {
        "name": name,
        "frames_per_segment": frames_per_segment,
        "dense_units": dense_units,
        "elapsed_seconds": round(elapsed, 1),
        "recall_5": eval_result["recall_5"],
        "visual_recall": eval_result["visual_recall"],
        "ndcg": eval_result["ndcg"],
        "mrr": eval_result["mrr"],
        "per_query": eval_result["queries"],
    }

    print(
        f"\n>>> recall@5={eval_result['recall_5']:.4f} "
        f"visual={eval_result['visual_recall']:.4f} "
        f"ndcg={eval_result['ndcg']:.4f} mrr={eval_result['mrr']:.4f} "
        f"({elapsed:.0f}s)"
    )
    return entry


async def main() -> None:
    video_ids = load_test_video_ids()
    all_results: dict[str, list[dict]] = {
        "frames_sweep": [],
        "annotation_test": [],
    }

    # Check cached videos
    cached_vids = [vid for vid in video_ids if _find_cached_video(vid) is not None]
    print(f"Videos with cached files: {len(cached_vids)}/{len(video_ids)}")
    missing = [vid for vid in video_ids if vid not in cached_vids]
    if missing:
        print(f"  Missing cache: {missing} (dense embed will skip these)")

    # =====================================================================
    # PART 1: Frames/segment sweep (0, 1, 2, 3, 4, 5)
    # =====================================================================
    print(f"\n{'#' * 70}")
    print("# PART 1: Frames per segment sweep")
    print(f"{'#' * 70}")

    for n_frames in [0, 1, 2, 3, 4, 5]:
        name = f"{n_frames} frames/segment" if n_frames > 0 else "Baseline (0 frames)"
        try:
            entry = await run_single_config(name, video_ids, n_frames)
            all_results["frames_sweep"].append(entry)
        except Exception as exc:
            print(f"\n  ERROR: {exc}")
            traceback.print_exc()
            all_results["frames_sweep"].append({
                "name": name,
                "frames_per_segment": n_frames,
                "status": "failed",
                "error": str(exc),
            })

        # Save after each config in case of interruption
        RESULTS_PATH.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))

    # =====================================================================
    # PART 2: Annotation removal test
    # =====================================================================
    print(f"\n{'#' * 70}")
    print("# PART 2: Annotation removal test")
    print(f"{'#' * 70}")

    # Config A: Baseline (annotation, no dense embed) — already done in Part 1 as "0 frames"
    # We just reference it.

    # Config B: Annotation + 3 dense embed (run BEFORE stripping)
    print(f"\n{'=' * 70}")
    print("ANNOTATION TEST: With annotation + 3 dense embed")
    print(f"{'=' * 70}")
    try:
        await cleanup_dense_visual_units(video_ids)
        dense_stats = await create_dense_visual_units(
            video_ids=video_ids, frames_per_segment=3,
        )
        print(f"  Added {dense_stats['total_units_created']} dense visual units")
        eval_b = await run_eval("embedding", top_k=5)
        all_results["annotation_test"].append({
            "name": "Annotation + 3 dense embed",
            "recall_5": eval_b["recall_5"],
            "visual_recall": eval_b["visual_recall"],
            "ndcg": eval_b["ndcg"],
            "mrr": eval_b["mrr"],
            "per_query": eval_b["queries"],
        })
        print(f">>> recall@5={eval_b['recall_5']:.4f} ndcg={eval_b['ndcg']:.4f}")
    except Exception as exc:
        print(f"  ERROR: {exc}")
        traceback.print_exc()
        all_results["annotation_test"].append({"name": "Annotation + 3 dense embed", "status": "failed"})

    RESULTS_PATH.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))

    # Config C: No annotation + 3 dense embed (strip annotation text)
    print(f"\n{'=' * 70}")
    print("ANNOTATION TEST: No annotation + 3 dense embed")
    print(f"{'=' * 70}")
    try:
        strip_counts = await strip_visual_annotation_text(video_ids)
        total_stripped = sum(strip_counts.values())
        print(f"  Stripped annotation from {total_stripped} visual units")
        # Dense embed units still exist from Config B
        eval_c = await run_eval("embedding", top_k=5)
        all_results["annotation_test"].append({
            "name": "No annotation + 3 dense embed",
            "stripped_visual_units": total_stripped,
            "recall_5": eval_c["recall_5"],
            "visual_recall": eval_c["visual_recall"],
            "ndcg": eval_c["ndcg"],
            "mrr": eval_c["mrr"],
            "per_query": eval_c["queries"],
        })
        print(f">>> recall@5={eval_c['recall_5']:.4f} ndcg={eval_c['ndcg']:.4f}")
    except Exception as exc:
        print(f"  ERROR: {exc}")
        traceback.print_exc()
        all_results["annotation_test"].append({"name": "No annotation + 3 dense embed", "status": "failed"})

    # Cleanup
    await cleanup_dense_visual_units(video_ids)

    # Save final
    RESULTS_PATH.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))

    # =====================================================================
    # SUMMARY
    # =====================================================================
    print(f"\n{'#' * 70}")
    print("# FINAL RESULTS")
    print(f"{'#' * 70}")

    print(f"\n--- Frames/Segment Sweep ---")
    print(f"{'Config':<30} {'Recall@5':>10} {'Visual':>10} {'NDCG@5':>10} {'MRR':>10} {'Units':>8}")
    print("-" * 85)
    for r in all_results["frames_sweep"]:
        if r.get("status") == "failed":
            print(f"{r['name']:<30} FAILED: {r.get('error','')[:40]}")
            continue
        print(
            f"{r['name']:<30} {r['recall_5']:>10.4f} {r['visual_recall']:>10.4f} "
            f"{r['ndcg']:>10.4f} {r['mrr']:>10.4f} {r.get('dense_units',0):>8}"
        )

    print(f"\n--- Annotation Removal Test ---")
    # Include baseline from frames sweep
    baseline = next((r for r in all_results["frames_sweep"] if r.get("frames_per_segment") == 0), None)
    if baseline and baseline.get("status") != "failed":
        print(f"{'Baseline (annotation only)':<35} R@5={baseline['recall_5']:.4f} NDCG={baseline['ndcg']:.4f}")
    for r in all_results["annotation_test"]:
        if r.get("status") == "failed":
            print(f"{r['name']:<35} FAILED")
            continue
        print(f"{r['name']:<35} R@5={r['recall_5']:.4f} NDCG={r['ndcg']:.4f}")

    print(f"\nResults saved to {RESULTS_PATH}")
    print("\nWARNING: DB annotation text was stripped for the no-annotation test.")
    print("Run a reindex to restore annotation data if needed.")


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(main())
