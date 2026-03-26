#!/usr/bin/env python3
"""
Auto-optimize indexing parameters — Karpathy autoresearch-style sweep.

Systematically tests indexing pipeline parameters by reindexing test videos
and evaluating retrieval quality. Changes one dimension at a time, keeping
improvements and discarding regressions.

Usage:
    python scripts/sweep_indexing_params.py
    python scripts/sweep_indexing_params.py --phase 3
    python scripts/sweep_indexing_params.py --dry-run
"""

from __future__ import annotations

import asyncio
import csv
import json
import os
import sys
import time
from copy import deepcopy
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

from scripts.reindex_test_videos import (
    IndexingConfig,
    load_test_video_ids,
    reindex_videos,
)
from scripts.eval_indexing import run_eval

RESULTS_PATH = REPO_ROOT / "eval" / "indexing_sweep_results.tsv"
BEST_CONFIG_PATH = REPO_ROOT / "eval" / "optimal_indexing_config.json"

# Primary metric — we optimize for this.
PRIMARY_METRIC = "recall_5"
# Secondary metric — logged but not optimized directly.
SECONDARY_METRIC = "visual_recall"


# ---------------------------------------------------------------------------
# Experiment definitions — each phase sweeps one dimension
# ---------------------------------------------------------------------------

def build_experiments() -> list[dict[str, Any]]:
    """Build all experiment phases.

    Strategy: start with the highest-impact parameters (scene granularity,
    annotation budget), then refine secondary parameters. Each phase finds
    the best value for one parameter dimension, and subsequent phases build
    on those results.
    """
    phases: list[dict[str, Any]] = []

    # Phase 1: Scene threshold — controls scene granularity.
    # Lower = more scenes = finer retrieval units.
    phases.append({
        "phase": 1,
        "name": "scene_threshold",
        "description": "Scene detection sensitivity (lower = more/smaller scenes)",
        "param": "scene_threshold",
        "values": [0.20, 0.25, 0.30, 0.35, 0.40, 0.45],
    })

    # Phase 2: Always annotate — route ALL scenes with frames through Gemini
    # instead of only short videos + OCR detected.
    phases.append({
        "phase": 2,
        "name": "always_annotate",
        "description": "Route override: annotate every scene with informative frames",
        "param": "always_annotate",
        "values": [False, True],
    })

    # Phase 3: Annotation budget per scene — how many frames Gemini sees per scene.
    phases.append({
        "phase": 3,
        "name": "max_annotated_frames_per_scene",
        "description": "Frames sent to Gemini per scene",
        "param": "max_annotated_frames_per_scene",
        "values": [1, 2, 3, 4, 6],
    })

    # Phase 4: Informative frames per scene — how many frames survive filtering.
    phases.append({
        "phase": 4,
        "name": "max_informative_frames",
        "description": "Max frames kept per scene after informative filter",
        "param": "max_informative_frames",
        "values": [1, 2, 3, 4, 6, 8],
    })

    # Phase 5: Annotation budget per video — total Gemini call budget.
    phases.append({
        "phase": 5,
        "name": "max_annotated_frames_per_video",
        "description": "Total Gemini annotation budget per video",
        "param": "max_annotated_frames_per_video",
        "values": [10, 20, 40, 60, 100, 150],
    })

    # Phase 6: Frame scene threshold — ffmpeg scene detection sensitivity.
    phases.append({
        "phase": 6,
        "name": "frame_scene_threshold",
        "description": "FFmpeg scene change detection (lower = more candidate frames)",
        "param": "frame_scene_threshold",
        "values": [0.10, 0.15, 0.20, 0.25, 0.30, 0.40],
    })

    # Phase 7: Skin ratio threshold — talking head filter sensitivity.
    phases.append({
        "phase": 7,
        "name": "skin_ratio_threshold",
        "description": "Skin ratio filter (higher = less aggressive talking head filtering)",
        "param": "skin_ratio_threshold",
        "values": [0.30, 0.35, 0.40, 0.45, 0.55, 0.65],
    })

    # Phase 8: Edge ratio threshold — edge density for informative frame判定.
    phases.append({
        "phase": 8,
        "name": "edge_ratio_threshold",
        "description": "Edge ratio filter (higher = keeps less-complex frames)",
        "param": "edge_ratio_threshold",
        "values": [0.02, 0.03, 0.04, 0.06, 0.08],
    })

    # Phase 9: OCR text region sensitivity.
    phases.append({
        "phase": 9,
        "name": "text_region_min_count",
        "description": "Min text regions for OCR detection (lower = more sensitive)",
        "param": "text_region_min_count",
        "values": [3, 5, 8, 12],
    })

    # Phase 10: Short video bias threshold.
    phases.append({
        "phase": 10,
        "name": "short_video_annotate_bias_seconds",
        "description": "Duration threshold for always-annotate short videos",
        "param": "short_video_annotate_bias_seconds",
        "values": [60.0, 120.0, 180.0, 300.0, 600.0],
    })

    # Phase 11: Frame dedup hash distance.
    phases.append({
        "phase": 11,
        "name": "hash_distance_threshold",
        "description": "Frame dedup Hamming distance (higher = more aggressive dedup)",
        "param": "hash_distance_threshold",
        "values": [4, 6, 8, 10, 12],
    })

    return phases


# ---------------------------------------------------------------------------
# Results logging
# ---------------------------------------------------------------------------

def init_results_file() -> None:
    if RESULTS_PATH.exists():
        return
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w", newline="") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow([
            "timestamp", "phase", "param", "value",
            "recall_5", "visual_recall", "ndcg", "mrr",
            "reindex_seconds", "status", "description",
        ])


def log_result(
    *,
    phase: int,
    param: str,
    value: Any,
    metrics: dict[str, float],
    reindex_seconds: float,
    status: str,
    description: str,
) -> None:
    with open(RESULTS_PATH, "a", newline="") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow([
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            phase,
            param,
            value,
            f"{metrics.get('recall_5', 0):.4f}",
            f"{metrics.get('visual_recall', 0):.4f}",
            f"{metrics.get('ndcg', 0):.4f}",
            f"{metrics.get('mrr', 0):.4f}",
            f"{reindex_seconds:.0f}",
            status,
            description,
        ])


# ---------------------------------------------------------------------------
# Main sweep loop
# ---------------------------------------------------------------------------

async def run_single_experiment(
    config: IndexingConfig,
    video_ids: list[str],
    *,
    eval_mode: str = "embedding",
) -> tuple[dict[str, float], float]:
    """Run one experiment: reindex + eval. Returns (metrics, reindex_seconds)."""
    t0 = time.perf_counter()
    reindex_result = await reindex_videos(video_ids, config)
    reindex_seconds = time.perf_counter() - t0

    if reindex_result["error_count"] > 0:
        failed = [
            vid for vid, info in reindex_result["videos"].items()
            if info["status"] == "error"
        ]
        print(f"  WARNING: {len(failed)} videos failed: {failed}")

    eval_result = await run_eval(eval_mode, top_k=5)
    metrics = {
        "recall_5": eval_result["recall_5"],
        "visual_recall": eval_result["visual_recall"],
        "ndcg": eval_result["ndcg"],
        "mrr": eval_result["mrr"],
    }
    return metrics, reindex_seconds


async def run_sweep(
    *,
    start_phase: int = 1,
    end_phase: int = 99,
    eval_mode: str = "embedding",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Run the full parameter sweep."""
    init_results_file()
    video_ids = load_test_video_ids()
    experiments = build_experiments()

    # Start with current production defaults.
    best_config = IndexingConfig()
    best_metrics: dict[str, float] | None = None

    print("=" * 70)
    print("INDEXING PARAMETER SWEEP")
    print(f"Videos: {len(video_ids)}")
    print(f"Phases: {start_phase}-{min(end_phase, len(experiments))}")
    print(f"Eval mode: {eval_mode}")
    print("=" * 70)

    if dry_run:
        print("\n[DRY RUN] Would run these experiments:\n")
        for exp in experiments:
            if exp["phase"] < start_phase or exp["phase"] > end_phase:
                continue
            print(f"  Phase {exp['phase']}: {exp['name']}")
            print(f"    {exp['description']}")
            print(f"    Values: {exp['values']}")
        return {"status": "dry_run"}

    # Run baseline first.
    print("\n--- BASELINE ---")
    baseline_metrics, baseline_seconds = await run_single_experiment(
        best_config, video_ids, eval_mode=eval_mode,
    )
    best_metrics = baseline_metrics
    log_result(
        phase=0,
        param="baseline",
        value="default",
        metrics=baseline_metrics,
        reindex_seconds=baseline_seconds,
        status="baseline",
        description="Production defaults",
    )
    print(
        f"\nBaseline: recall@5={baseline_metrics['recall_5']:.4f} "
        f"visual={baseline_metrics['visual_recall']:.4f} "
        f"ndcg={baseline_metrics['ndcg']:.4f}"
    )

    # Run each phase.
    for exp in experiments:
        phase = exp["phase"]
        if phase < start_phase or phase > end_phase:
            continue

        param_name = exp["param"]
        print(f"\n{'=' * 70}")
        print(f"PHASE {phase}: {exp['name']}")
        print(f"  {exp['description']}")
        print(f"  Testing: {exp['values']}")
        print(f"  Current best: {getattr(best_config, param_name)}")
        print(f"{'=' * 70}")

        phase_best_value = getattr(best_config, param_name)
        phase_best_metrics = best_metrics
        phase_best_seconds = 0.0

        for value in exp["values"]:
            # Skip if this is the current value (already tested or is default).
            if value == getattr(best_config, param_name) and best_metrics is not None:
                print(f"\n  [{param_name}={value}] — already the current best, skipping")
                continue

            trial_config = replace(best_config, **{param_name: value})
            print(f"\n  [{param_name}={value}] Reindexing...")

            try:
                metrics, reindex_seconds = await run_single_experiment(
                    trial_config, video_ids, eval_mode=eval_mode,
                )
            except Exception as exc:
                print(f"  [{param_name}={value}] FAILED: {exc}")
                log_result(
                    phase=phase,
                    param=param_name,
                    value=value,
                    metrics={"recall_5": 0, "visual_recall": 0, "ndcg": 0, "mrr": 0},
                    reindex_seconds=0,
                    status="error",
                    description=str(exc)[:100],
                )
                continue

            primary = metrics[PRIMARY_METRIC]
            secondary = metrics[SECONDARY_METRIC]
            best_primary = phase_best_metrics[PRIMARY_METRIC] if phase_best_metrics else 0
            best_secondary = phase_best_metrics[SECONDARY_METRIC] if phase_best_metrics else 0

            improved = (
                primary > best_primary
                or (primary == best_primary and secondary > best_secondary)
            )
            status = "keep" if improved else "discard"

            log_result(
                phase=phase,
                param=param_name,
                value=value,
                metrics=metrics,
                reindex_seconds=reindex_seconds,
                status=status,
                description=trial_config.label(),
            )

            result_icon = ">>>" if improved else "   "
            print(
                f"  {result_icon} recall@5={primary:.4f} visual={secondary:.4f} "
                f"ndcg={metrics['ndcg']:.4f} ({reindex_seconds:.0f}s) [{status}]"
            )

            if improved:
                phase_best_value = value
                phase_best_metrics = metrics
                phase_best_seconds = reindex_seconds

        # Apply the best value from this phase.
        old_value = getattr(best_config, param_name)
        if phase_best_value != old_value:
            best_config = replace(best_config, **{param_name: phase_best_value})
            best_metrics = phase_best_metrics
            print(
                f"\n  Phase {phase} winner: {param_name} = {phase_best_value} "
                f"(was {old_value})"
            )
            # Reindex with the best config to leave DB in best state.
            print("  Reindexing with phase-best config...")
            await reindex_videos(video_ids, best_config)
        else:
            print(f"\n  Phase {phase}: no improvement, keeping {param_name} = {old_value}")

    # Save optimal config.
    optimal = asdict(best_config)
    optimal["_metrics"] = best_metrics
    optimal["_baseline_metrics"] = baseline_metrics
    BEST_CONFIG_PATH.write_text(json.dumps(optimal, indent=2))
    print(f"\n{'=' * 70}")
    print("SWEEP COMPLETE")
    print(f"{'=' * 70}")
    print(f"\nOptimal config saved to {BEST_CONFIG_PATH}")
    print(f"\nBaseline:  recall@5={baseline_metrics['recall_5']:.4f}  visual={baseline_metrics['visual_recall']:.4f}")
    if best_metrics:
        print(f"Optimal:   recall@5={best_metrics['recall_5']:.4f}  visual={best_metrics['visual_recall']:.4f}")
    print(f"\nConfig changes from baseline:")
    default_config = IndexingConfig()
    for field_name in asdict(default_config):
        default_val = getattr(default_config, field_name)
        best_val = getattr(best_config, field_name)
        if default_val != best_val:
            print(f"  {field_name}: {default_val} -> {best_val}")

    return {
        "status": "completed",
        "baseline": baseline_metrics,
        "optimal": best_metrics,
        "config": asdict(best_config),
    }


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Auto-optimize indexing parameters")
    parser.add_argument("--phase", type=int, default=1, help="Start from phase N")
    parser.add_argument("--end-phase", type=int, default=99, help="Stop after phase N")
    parser.add_argument("--mode", choices=["embedding", "rerank"], default="embedding")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without running")
    args = parser.parse_args()

    import logging
    logging.basicConfig(level=logging.WARNING)

    asyncio.run(run_sweep(
        start_phase=args.phase,
        end_phase=args.end_phase,
        eval_mode=args.mode,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
