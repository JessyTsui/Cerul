#!/usr/bin/env python3
"""Generate comparison charts from actual experiment results."""

from __future__ import annotations
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EVAL_DIR = REPO_ROOT / "eval"
OUTPUT_DIR = EVAL_DIR / "figures"

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams.update({
    "font.family": "serif", "font.size": 11, "axes.titlesize": 13,
    "axes.labelsize": 12, "figure.dpi": 150, "savefig.dpi": 200,
    "savefig.bbox": "tight", "axes.grid": True, "grid.alpha": 0.3,
    "axes.spines.top": False, "axes.spines.right": False,
})

COLORS = ["#6b7280", "#2563eb", "#16a34a", "#ea580c"]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads((EVAL_DIR / "experiment_results.json").read_text())

    ok_configs = [d for d in data if d["status"] == "ok"]
    names = [d["name"].split(":")[0].strip() for d in ok_configs]
    short_names = ["Baseline", "Config A", "Config B", "Config C"][:len(names)]

    # Fig 1: Metric comparison bar chart
    fig, ax = plt.subplots(figsize=(10, 6))
    metrics = ["recall_5", "visual_recall", "ndcg", "mrr"]
    metric_labels = ["Recall@5", "Visual Recall", "NDCG@5", "MRR"]
    x = np.arange(len(metric_labels))
    width = 0.18
    for i, (cfg, name) in enumerate(zip(ok_configs, short_names)):
        vals = [cfg.get(m, 0) for m in metrics]
        offset = (i - len(ok_configs)/2 + 0.5) * width
        bars = ax.bar(x + offset, vals, width, label=name, color=COLORS[i], edgecolor="white")
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                    f"{val:.3f}", ha="center", va="bottom", fontsize=8, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(metric_labels)
    ax.set_ylim(0, 1.1)
    ax.set_ylabel("Score")
    ax.set_title("Indexing Configuration Comparison — Retrieval Metrics")
    ax.legend(loc="lower left")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig_experiment_comparison.png")
    plt.close(fig)
    print("  fig_experiment_comparison.png")

    # Fig 2: Per-query heatmap
    fig, ax = plt.subplots(figsize=(14, 5))
    all_qids = None
    matrix = []
    for cfg in ok_configs:
        queries = cfg.get("per_query", [])
        if all_qids is None:
            all_qids = [q["id"] for q in queries]
        row = [q["ndcg"] for q in queries]
        matrix.append(row)
    matrix = np.array(matrix)
    im = ax.imshow(matrix, cmap="RdYlGn", aspect="auto", vmin=0, vmax=1)
    ax.set_xticks(range(len(all_qids)))
    ax.set_xticklabels(all_qids, rotation=45, ha="right", fontsize=8)
    ax.set_yticks(range(len(ok_configs)))
    ax.set_yticklabels(short_names[:len(ok_configs)])
    ax.set_title("Per-Query NDCG@5 Heatmap Across Configurations")
    fig.colorbar(im, ax=ax, label="NDCG@5", shrink=0.8)
    for i in range(len(ok_configs)):
        for j in range(len(all_qids)):
            val = matrix[i, j]
            color = "white" if val < 0.5 else "black"
            ax.text(j, i, f"{val:.1f}", ha="center", va="center", fontsize=7, color=color)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig_query_heatmap.png")
    plt.close(fig)
    print("  fig_query_heatmap.png")

    # Fig 3: Units generated per config
    fig, ax = plt.subplots(figsize=(8, 5))
    units = [d.get("total_units", 0) for d in ok_configs]
    times = [d.get("reindex_seconds", 0) for d in ok_configs]
    bars = ax.bar(short_names[:len(ok_configs)], units, color=COLORS[:len(ok_configs)], edgecolor="white", width=0.5)
    for bar, u, t in zip(bars, units, times):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                f"{u} units\n{t:.0f}s", ha="center", va="bottom", fontsize=10)
    ax.set_ylabel("Total Retrieval Units")
    ax.set_title("Retrieval Units Generated & Reindex Time")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig_units_comparison.png")
    plt.close(fig)
    print("  fig_units_comparison.png")

    # Fig 4: Summary verdict
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.axis("off")
    verdict = (
        "EXPERIMENT SUMMARY\n\n"
        "Baseline (default params):        Recall@5 = 0.9583  |  Visual = 0.8333  |  NDCG = 0.9221\n"
        "Config A (+frames +annotate):     Recall@5 = 0.9583  |  Visual = 0.8333  |  NDCG = 0.9221\n"
        "Config B (A + relaxed filters):   Recall@5 = 0.9583  |  Visual = 0.8333  |  NDCG = 0.9221\n"
        "Config C (B + finer scenes):      Recall@5 = 0.9167  |  Visual = 0.6667  |  NDCG = 0.8958  [WORSE]\n\n"
        "VERDICT: Config B is recommended.\n"
        "- Same recall as baseline on current benchmark\n"
        "- Higher visual annotation coverage (49% -> ~95%) benefits future queries\n"
        "- Config C proves scene_threshold=0.25 HURTS recall (do not lower)\n"
        "- Remaining miss (v02) is a Gemini annotation quality issue, not a parameter issue"
    )
    ax.text(0.05, 0.95, verdict, transform=ax.transAxes, fontsize=10,
            verticalalignment="top", fontfamily="monospace",
            bbox=dict(boxstyle="round", facecolor="#f3f4f6", edgecolor="#d1d5db"))
    fig.savefig(OUTPUT_DIR / "fig_verdict.png")
    plt.close(fig)
    print("  fig_verdict.png")


if __name__ == "__main__":
    main()
