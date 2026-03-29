#!/usr/bin/env python3
"""
Run focused indexing experiments: baseline + 3 optimized configs.
Saves detailed results to eval/experiment_results.json for plotting.
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

from scripts.reindex_test_videos import IndexingConfig, reindex_videos, load_test_video_ids
from scripts.eval_indexing import run_eval


CONFIGS = [
    ("Baseline", IndexingConfig()),
    ("A: +Frames +Budget +AlwaysAnnotate", IndexingConfig(
        max_informative_frames=4,
        max_annotated_frames_per_scene=3,
        max_annotated_frames_per_video=60,
        always_annotate=True,
    )),
    ("B: A + Relaxed Filters", IndexingConfig(
        max_informative_frames=4,
        max_annotated_frames_per_scene=3,
        max_annotated_frames_per_video=60,
        always_annotate=True,
        skin_ratio_threshold=0.35,
        text_region_min_count=4,
        short_video_annotate_bias_seconds=300.0,
    )),
    ("C: B + Finer Extraction", IndexingConfig(
        scene_threshold=0.25,
        frame_scene_threshold=0.15,
        max_informative_frames=4,
        max_annotated_frames_per_scene=3,
        max_annotated_frames_per_video=60,
        always_annotate=True,
        skin_ratio_threshold=0.35,
        edge_ratio_threshold=0.06,
        text_region_min_count=4,
        text_region_min_area_ratio=0.01,
        short_video_annotate_bias_seconds=300.0,
    )),
]

RESULTS_PATH = REPO_ROOT / "eval" / "experiment_results.json"


async def main() -> None:
    video_ids = load_test_video_ids()
    all_results: list[dict] = []

    for name, config in CONFIGS:
        print(f"\n{'=' * 70}")
        print(f"EXPERIMENT: {name}")
        print(f"Params: {config.label()}")
        print(f"{'=' * 70}")

        t0 = time.perf_counter()
        reindex_result = await reindex_videos(video_ids, config, verbose=False)
        reindex_time = time.perf_counter() - t0

        if reindex_result["error_count"] > 0:
            failed = [v for v, info in reindex_result["videos"].items() if info["status"] == "error"]
            print(f"WARNING: {len(failed)} failed: {failed}")
            if reindex_result["error_count"] > 3:
                print("Too many failures, skipping eval for this config")
                all_results.append({
                    "name": name,
                    "config_label": config.label(),
                    "status": "failed",
                    "error_count": reindex_result["error_count"],
                    "reindex_seconds": round(reindex_time, 1),
                })
                continue

        eval_result = await run_eval("embedding", top_k=5)

        entry = {
            "name": name,
            "config_label": config.label(),
            "status": "ok",
            "reindex_seconds": round(reindex_time, 1),
            "success_count": reindex_result["success_count"],
            "error_count": reindex_result["error_count"],
            "total_units": sum(
                info.get("unit_count", 0)
                for info in reindex_result["videos"].values()
                if info.get("status") == "ok"
            ),
            "videos": reindex_result["videos"],
            "recall_5": eval_result["recall_5"],
            "visual_recall": eval_result["visual_recall"],
            "ndcg": eval_result["ndcg"],
            "mrr": eval_result["mrr"],
            "per_query": eval_result["queries"],
        }
        all_results.append(entry)

        print(
            f"\nSUMMARY: recall@5={eval_result['recall_5']:.4f} "
            f"visual={eval_result['visual_recall']:.4f} "
            f"ndcg={eval_result['ndcg']:.4f} mrr={eval_result['mrr']:.4f} "
            f"({reindex_time:.0f}s)"
        )

    RESULTS_PATH.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))
    print(f"\nAll results saved to {RESULTS_PATH}")


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(main())
