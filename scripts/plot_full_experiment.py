#!/usr/bin/env python3
"""
Generate publication-quality charts from the full experiment results.

Charts:
1. Frames/segment sweep: NDCG@5 vs frames count (with cost overlay)
2. Annotation removal: grouped bar chart comparing 3 configs
3. Per-query NDCG heatmap across all frame counts
4. Cost-efficiency analysis: NDCG vs embedding cost
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[1]
RESULTS_PATH = REPO_ROOT / "eval" / "full_experiment_results.json"
FIGURES_DIR = REPO_ROOT / "eval" / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# Load data
data = json.load(open(RESULTS_PATH))
frames_sweep = [r for r in data["frames_sweep"] if r.get("status") != "failed"]
annotation_test = [r for r in data["annotation_test"] if r.get("status") != "failed"]

# Style
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.labelsize": 12,
    "figure.facecolor": "white",
    "axes.facecolor": "#fafafa",
    "axes.grid": True,
    "grid.alpha": 0.3,
})

COLORS = {
    "primary": "#2563EB",
    "secondary": "#10B981",
    "accent": "#F59E0B",
    "danger": "#EF4444",
    "gray": "#6B7280",
    "light_blue": "#93C5FD",
    "light_green": "#6EE7B7",
}


# =========================================================================
# Chart 1: Frames/segment sweep — NDCG@5 line chart
# =========================================================================
def fig1_frames_sweep():
    fig, ax1 = plt.subplots(figsize=(10, 6))

    n_frames = [r["frames_per_segment"] for r in frames_sweep]
    ndcg = [r["ndcg"] for r in frames_sweep]
    mrr = [r["mrr"] for r in frames_sweep]
    units = [r["dense_units"] for r in frames_sweep]

    # NDCG line
    ax1.plot(n_frames, ndcg, "o-", color=COLORS["primary"], linewidth=2.5,
             markersize=10, label="NDCG@5", zorder=5)
    ax1.plot(n_frames, mrr, "s--", color=COLORS["secondary"], linewidth=2,
             markersize=8, label="MRR", zorder=4)

    # Annotate the jump
    ax1.annotate(
        "+2.6%\n(fr01 fixed)",
        xy=(1, ndcg[1]), xytext=(1.8, 0.925),
        arrowprops=dict(arrowstyle="->", color=COLORS["danger"], lw=1.5),
        fontsize=10, color=COLORS["danger"], fontweight="bold",
    )

    # Highlight the plateau
    ax1.axhspan(0.935, 0.94, alpha=0.15, color=COLORS["primary"], zorder=0)
    ax1.text(3, 0.9405, "plateau at 0.9375", ha="center", fontsize=9,
             color=COLORS["primary"], style="italic")

    ax1.set_xlabel("Dense Visual Frames per Segment")
    ax1.set_ylabel("Score")
    ax1.set_ylim(0.88, 0.96)
    ax1.set_xticks(n_frames)
    ax1.legend(loc="lower right")
    ax1.set_title("Dense Visual Embedding: Frames/Segment Sweep\n(8 test videos, 24 queries)")

    # Secondary axis: DB units
    ax2 = ax1.twinx()
    ax2.bar(n_frames, units, alpha=0.15, color=COLORS["gray"], width=0.6, label="DB vectors")
    ax2.set_ylabel("Total Dense Visual Units", color=COLORS["gray"])
    ax2.tick_params(axis="y", labelcolor=COLORS["gray"])

    fig.tight_layout()
    path = FIGURES_DIR / "frames_sweep_ndcg.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    print(f"Saved: {path}")
    plt.close(fig)


# =========================================================================
# Chart 2: Annotation removal — grouped bar chart
# =========================================================================
def fig2_annotation_removal():
    fig, ax = plt.subplots(figsize=(10, 6))

    # 3 configs: baseline (from frames_sweep[0]), annotation+dense, no-annotation+dense
    baseline = frames_sweep[0]
    configs = [
        ("Baseline\n(Gemini Flash annotation,\nno dense embed)", baseline),
        ("Annotation +\n3 dense embed", annotation_test[0]),
        ("No annotation +\n3 dense embed", annotation_test[1]),
    ]

    metrics = ["ndcg", "mrr", "recall_5", "visual_recall"]
    metric_labels = ["NDCG@5", "MRR", "Recall@5", "Visual Recall"]
    colors = [COLORS["primary"], COLORS["secondary"], COLORS["accent"], COLORS["danger"]]

    x = np.arange(len(configs))
    width = 0.18

    for i, (metric, label, color) in enumerate(zip(metrics, metric_labels, colors)):
        values = [cfg[1][metric] for cfg in configs]
        bars = ax.bar(x + i * width - 1.5 * width, values, width,
                      label=label, color=color, alpha=0.85, edgecolor="white")
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.005,
                    f"{val:.3f}", ha="center", va="bottom", fontsize=8, fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels([c[0] for c in configs], fontsize=10)
    ax.set_ylim(0.75, 1.02)
    ax.set_ylabel("Score")
    ax.legend(loc="lower right", ncol=2)
    ax.set_title("Annotation Removal Test: Gemini Flash is Unnecessary\n(with dense visual embedding, annotation adds zero retrieval value)")

    # Cost annotations
    costs = ["~$0.03/video", "~$0.033/video", "~$0.003/video"]
    for i, cost in enumerate(costs):
        ax.text(i, 0.77, cost, ha="center", fontsize=10, fontweight="bold",
                color=COLORS["danger"] if i < 2 else COLORS["secondary"],
                bbox=dict(boxstyle="round,pad=0.3", facecolor="white", edgecolor="#ddd"))

    fig.tight_layout()
    path = FIGURES_DIR / "annotation_removal_comparison.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    print(f"Saved: {path}")
    plt.close(fig)


# =========================================================================
# Chart 3: Per-query NDCG heatmap across frame counts
# =========================================================================
def fig3_per_query_heatmap():
    fig, ax = plt.subplots(figsize=(12, 8))

    # Build matrix: rows=queries, cols=frame counts
    frame_counts = [r["frames_per_segment"] for r in frames_sweep]
    query_ids = [q["id"] for q in frames_sweep[0]["per_query"]]

    matrix = []
    for r in frames_sweep:
        q_map = {q["id"]: q["ndcg"] for q in r["per_query"]}
        matrix.append([q_map.get(qid, 0) for qid in query_ids])

    matrix = np.array(matrix).T  # queries x frame_counts

    # Sort by baseline ndcg (ascending, so problem queries are at top)
    baseline_ndcg = matrix[:, 0]
    sort_idx = np.argsort(baseline_ndcg)
    matrix = matrix[sort_idx]
    query_ids_sorted = [query_ids[i] for i in sort_idx]

    # Custom colormap: red for 0, yellow for 0.5, green for 1.0
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list(
        "ndcg", [(0, "#EF4444"), (0.5, "#FBBF24"), (1.0, "#10B981")]
    )

    im = ax.imshow(matrix, cmap=cmap, aspect="auto", vmin=0, vmax=1)

    ax.set_xticks(range(len(frame_counts)))
    ax.set_xticklabels([f"{n} frames" for n in frame_counts])
    ax.set_yticks(range(len(query_ids_sorted)))
    ax.set_yticklabels(query_ids_sorted, fontsize=9)

    # Add text annotations
    for i in range(len(query_ids_sorted)):
        for j in range(len(frame_counts)):
            val = matrix[i, j]
            color = "white" if val < 0.3 else "black"
            ax.text(j, i, f"{val:.2f}", ha="center", va="center",
                    fontsize=8, color=color)

    ax.set_xlabel("Dense Visual Frames per Segment")
    ax.set_title("Per-Query NDCG@5 Across Frame Counts\n(sorted by baseline difficulty)")

    # Colorbar
    cbar = fig.colorbar(im, ax=ax, shrink=0.8)
    cbar.set_label("NDCG@5")

    fig.tight_layout()
    path = FIGURES_DIR / "per_query_ndcg_heatmap.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    print(f"Saved: {path}")
    plt.close(fig)


# =========================================================================
# Chart 4: Cost-efficiency analysis
# =========================================================================
def fig4_cost_efficiency():
    fig, ax = plt.subplots(figsize=(10, 6))

    # Cost model: embedding cost per video ≈ units * $0.000003 (Gemini Embedding 2)
    # Flash annotation cost: ~$0.03/video
    configs = [
        ("No embed\n(Flash only)", 0.03, 0.9138, COLORS["danger"]),
        ("1 frame/seg", 0.0002, 0.9375, COLORS["light_blue"]),
        ("2 frames/seg", 0.0004, 0.9375, COLORS["light_blue"]),
        ("3 frames/seg", 0.0006, 0.9375, COLORS["primary"]),
        ("4 frames/seg", 0.0008, 0.9375, COLORS["light_blue"]),
        ("5 frames/seg", 0.001, 0.9375, COLORS["light_blue"]),
        ("Flash + 3 dense", 0.0306, 0.9375, COLORS["accent"]),
    ]

    for name, cost, ndcg, color in configs:
        ax.scatter(cost * 1000, ndcg, s=200, color=color, zorder=5, edgecolor="white", linewidth=2)
        offset_y = 0.003 if "Flash" not in name else -0.005
        offset_x = 0.5 if "Flash" not in name else -2
        ax.annotate(name, (cost * 1000, ndcg),
                    xytext=(cost * 1000 + offset_x, ndcg + offset_y),
                    fontsize=9, ha="center")

    # Highlight optimal region
    ax.axhspan(0.935, 0.94, xmin=0, xmax=0.1, alpha=0.15, color=COLORS["secondary"])
    ax.annotate("Optimal:\n1 frame/seg\n$0.0002/video",
                xy=(0.2, 0.9375), xytext=(5, 0.92),
                arrowprops=dict(arrowstyle="->", color=COLORS["secondary"], lw=2),
                fontsize=11, fontweight="bold", color=COLORS["secondary"],
                bbox=dict(boxstyle="round,pad=0.4", facecolor="#ecfdf5", edgecolor=COLORS["secondary"]))

    ax.set_xlabel("Embedding Cost per Video ($ × 1000, i.e. mils)")
    ax.set_ylabel("NDCG@5")
    ax.set_ylim(0.90, 0.95)
    ax.set_title("Cost-Efficiency: Dense Visual Embedding vs Gemini Flash Annotation\n(90% cost reduction with +2.6% NDCG improvement)")

    fig.tight_layout()
    path = FIGURES_DIR / "cost_efficiency.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    print(f"Saved: {path}")
    plt.close(fig)


# =========================================================================
# Chart 5: Summary comparison table as figure
# =========================================================================
def fig5_summary_table():
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.axis("off")

    # Build table data
    col_labels = ["Config", "Frames/Seg", "DB Vectors", "Recall@5", "NDCG@5", "MRR", "Cost/Video"]
    costs = ["$0.030", "$0.0002", "$0.0004", "$0.0006", "$0.0008", "$0.001"]
    table_data = []
    for i, r in enumerate(frames_sweep):
        table_data.append([
            r["name"],
            str(r["frames_per_segment"]),
            str(r["dense_units"]),
            f"{r['recall_5']:.4f}",
            f"{r['ndcg']:.4f}",
            f"{r['mrr']:.4f}",
            costs[i],
        ])

    table = ax.table(
        cellText=table_data,
        colLabels=col_labels,
        cellLoc="center",
        loc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.5)

    # Style header
    for j in range(len(col_labels)):
        table[0, j].set_facecolor(COLORS["primary"])
        table[0, j].set_text_props(color="white", fontweight="bold")

    # Highlight best rows (1-5 frames, all same NDCG)
    for i in range(1, len(table_data)):
        for j in range(len(col_labels)):
            table[i + 1, j].set_facecolor("#f0f9ff")

    # Highlight baseline differently
    for j in range(len(col_labels)):
        table[1, j].set_facecolor("#fef3c7")

    # Highlight optimal row (1 frame — cheapest with max NDCG)
    for j in range(len(col_labels)):
        table[2, j].set_facecolor("#d1fae5")
        table[2, j].set_text_props(fontweight="bold")

    ax.set_title("Dense Visual Embedding: Full Results\n(green = recommended, yellow = baseline)",
                 fontsize=13, fontweight="bold", pad=20)

    fig.tight_layout()
    path = FIGURES_DIR / "summary_table.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    print(f"Saved: {path}")
    plt.close(fig)


if __name__ == "__main__":
    fig1_frames_sweep()
    fig2_annotation_removal()
    fig3_per_query_heatmap()
    fig4_cost_efficiency()
    fig5_summary_table()
    print("\nAll charts generated!")
