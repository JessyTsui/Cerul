#!/usr/bin/env python3
"""
Generate publication-quality charts from indexing optimization experiments.

Uses data from:
- eval/indexing_eval_details.json (baseline eval)
- eval/indexing_sweep_results.tsv (phase 1 sweep)
- DB analysis data (hardcoded from our analysis run)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EVAL_DIR = REPO_ROOT / "eval"
OUTPUT_DIR = EVAL_DIR / "figures"

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import numpy as np
except ImportError:
    print("pip install matplotlib numpy")
    sys.exit(1)

# Academic-style settings
plt.rcParams.update({
    "font.family": "serif",
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.labelsize": 12,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "figure.dpi": 150,
    "savefig.dpi": 200,
    "savefig.bbox": "tight",
    "axes.grid": True,
    "grid.alpha": 0.3,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

COLORS = {
    "blue": "#2563eb",
    "green": "#16a34a",
    "orange": "#ea580c",
    "purple": "#9333ea",
    "red": "#dc2626",
    "gray": "#6b7280",
    "teal": "#0d9488",
}


def fig1_baseline_per_query(eval_details: dict) -> None:
    """Per-query NDCG@5 bar chart showing hits vs misses."""
    queries = eval_details["queries"]
    qids = [q["id"] for q in queries]
    ndcgs = [q["ndcg"] for q in queries]
    is_visual = [q.get("is_visual", False) for q in queries]
    difficulties = [q.get("difficulty", "?") for q in queries]

    fig, ax = plt.subplots(figsize=(14, 5))

    bar_colors = []
    for i, (ndcg, vis, diff) in enumerate(zip(ndcgs, is_visual, difficulties)):
        if ndcg == 0:
            bar_colors.append(COLORS["red"])
        elif vis:
            bar_colors.append(COLORS["purple"])
        elif diff == "hard":
            bar_colors.append(COLORS["orange"])
        elif diff == "medium":
            bar_colors.append(COLORS["blue"])
        else:
            bar_colors.append(COLORS["green"])

    bars = ax.bar(range(len(qids)), ndcgs, color=bar_colors, width=0.7, edgecolor="white", linewidth=0.5)

    ax.set_xlabel("Query ID")
    ax.set_ylabel("NDCG@5")
    ax.set_title("Baseline Retrieval Quality — Per-Query NDCG@5")
    ax.set_xticks(range(len(qids)))
    ax.set_xticklabels(qids, rotation=45, ha="right", fontsize=8)
    ax.set_ylim(0, 1.1)
    ax.axhline(y=eval_details["ndcg"], color=COLORS["gray"], linestyle="--", linewidth=1, label=f'Mean NDCG@5 = {eval_details["ndcg"]:.3f}')

    legend_patches = [
        mpatches.Patch(color=COLORS["green"], label="Easy (speech)"),
        mpatches.Patch(color=COLORS["blue"], label="Medium"),
        mpatches.Patch(color=COLORS["orange"], label="Hard"),
        mpatches.Patch(color=COLORS["purple"], label="Visual query"),
        mpatches.Patch(color=COLORS["red"], label="MISS"),
    ]
    ax.legend(handles=legend_patches, loc="lower left", ncol=3)

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig1_baseline_per_query.png")
    plt.close(fig)
    print("  fig1_baseline_per_query.png")


def fig2_visual_coverage() -> None:
    """Visual annotation coverage per video — bar chart."""
    # Data from our DB analysis run
    videos = [
        ("bxBzsSsqQAM\n(Keynote\n2706s)", 18, 44),
        ("uqc_vt95GJg\n(Interview\n2428s)", 18, 39),
        ("lvMMZLYoDr4\n(Explainer\n3117s)", 15, 52),
        ("2hgjgycOU_0\n(Mixed\n944s)", 14, 15),
        ("JZLZQVmfGn8\n(Education\n559s)", 8, 9),
        ("NGOAUJtdk-4\n(Short\n460s)", 7, 7),
        ("iLP0YyNwpTc\n(Demo\n93s)", 1, 2),
        ("qF4QRh2u7FE\n(Demo\n39s)", 1, 1),
    ]

    fig, ax = plt.subplots(figsize=(12, 5))

    labels = [v[0] for v in videos]
    with_visual = [v[1] for v in videos]
    total = [v[2] for v in videos]
    without_visual = [t - w for w, t in zip(with_visual, total)]
    coverage_pct = [w / t * 100 for w, t in zip(with_visual, total)]

    x = np.arange(len(labels))
    width = 0.6

    bars_visual = ax.bar(x, with_visual, width, label="With visual annotation", color=COLORS["blue"], edgecolor="white")
    bars_none = ax.bar(x, without_visual, width, bottom=with_visual, label="No visual annotation", color=COLORS["gray"], alpha=0.4, edgecolor="white")

    for i, (pct, tot) in enumerate(zip(coverage_pct, total)):
        ax.text(i, tot + 0.5, f"{pct:.0f}%", ha="center", va="bottom", fontsize=9, fontweight="bold",
                color=COLORS["green"] if pct > 80 else (COLORS["orange"] if pct > 50 else COLORS["red"]))

    ax.set_xlabel("Test Video")
    ax.set_ylabel("Number of Speech Segments")
    ax.set_title("Visual Annotation Coverage — Current Pipeline\n(Only 49% of segments have visual descriptions)")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=8)
    ax.legend(loc="upper right")

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig2_visual_coverage.png")
    plt.close(fig)
    print("  fig2_visual_coverage.png")


def fig3_parameter_comparison() -> None:
    """Radar chart comparing baseline vs proposed optimal config."""
    categories = [
        "Frames/Scene",
        "Annotated/Scene",
        "Budget/Video",
        "Frame Sensitivity",
        "OCR Sensitivity",
        "Skin Filter\nRelaxation",
        "Short Video\nThreshold",
    ]

    # Normalized to 0-1 range for radar chart
    baseline_raw = [2, 1, 20, 0.25, 8, 0.45, 180]
    optimal_raw = [4, 3, 60, 0.15, 4, 0.35, 300]

    # Normalize: higher = better for our purposes
    # For frame_scene_threshold and skin_ratio: lower is better (more sensitive)
    # For text_region_min_count: lower is better (more sensitive)
    baseline_norm = [
        2/8, 1/6, 20/150, (0.5-0.25)/0.4, (20-8)/17, (0.65-0.45)/0.35, 180/600,
    ]
    optimal_norm = [
        4/8, 3/6, 60/150, (0.5-0.15)/0.4, (20-4)/17, (0.65-0.35)/0.35, 300/600,
    ]

    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]
    baseline_norm += baseline_norm[:1]
    optimal_norm += optimal_norm[:1]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))

    ax.plot(angles, baseline_norm, "o-", linewidth=2, color=COLORS["gray"], label="Baseline", markersize=6)
    ax.fill(angles, baseline_norm, alpha=0.1, color=COLORS["gray"])

    ax.plot(angles, optimal_norm, "o-", linewidth=2, color=COLORS["blue"], label="Proposed Optimal", markersize=6)
    ax.fill(angles, optimal_norm, alpha=0.15, color=COLORS["blue"])

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=10)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.25, 0.5, 0.75, 1.0])
    ax.set_yticklabels(["25%", "50%", "75%", "100%"], fontsize=8)
    ax.set_title("Parameter Configuration Comparison\n(Normalized: higher = more aggressive)", pad=20)
    ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1))

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig3_parameter_radar.png")
    plt.close(fig)
    print("  fig3_parameter_radar.png")


def fig4_difficulty_breakdown(eval_details: dict) -> None:
    """Grouped bar chart showing metrics by difficulty level."""
    queries = eval_details["queries"]

    difficulties = ["easy", "medium", "hard"]
    metrics_by_diff = {}
    for diff in difficulties:
        subset = [q for q in queries if q.get("difficulty") == diff]
        if subset:
            metrics_by_diff[diff] = {
                "ndcg": sum(q["ndcg"] for q in subset) / len(subset),
                "mrr": sum(q["mrr"] for q in subset) / len(subset),
                "recall": sum(q["hit5"] for q in subset) / len(subset),
                "count": len(subset),
            }

    fig, ax = plt.subplots(figsize=(8, 5))

    x = np.arange(len(difficulties))
    width = 0.25

    ndcgs = [metrics_by_diff[d]["ndcg"] for d in difficulties]
    mrrs = [metrics_by_diff[d]["mrr"] for d in difficulties]
    recalls = [metrics_by_diff[d]["recall"] for d in difficulties]

    bars1 = ax.bar(x - width, ndcgs, width, label="NDCG@5", color=COLORS["blue"])
    bars2 = ax.bar(x, mrrs, width, label="MRR", color=COLORS["teal"])
    bars3 = ax.bar(x + width, recalls, width, label="Recall@5", color=COLORS["green"])

    ax.set_xlabel("Query Difficulty")
    ax.set_ylabel("Score")
    ax.set_title("Retrieval Metrics by Query Difficulty")
    ax.set_xticks(x)
    ax.set_xticklabels([f"{d}\n(n={metrics_by_diff[d]['count']})" for d in difficulties])
    ax.set_ylim(0, 1.15)
    ax.legend()

    for bars in [bars1, bars2, bars3]:
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f"{height:.2f}",
                       xy=(bar.get_x() + bar.get_width() / 2, height),
                       xytext=(0, 3), textcoords="offset points",
                       ha="center", va="bottom", fontsize=8)

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig4_difficulty_breakdown.png")
    plt.close(fig)
    print("  fig4_difficulty_breakdown.png")


def fig5_proposed_improvements() -> None:
    """Before/after comparison of expected improvements."""
    changes = [
        ("Route Policy\n(always annotate)", 49, 95, "Visual Coverage %"),
        ("Frames/Scene\n(1→3)", 1, 3, "Annotated Frames"),
        ("Budget/Video\n(20→60)", 20, 60, "Max Annotations"),
        ("OCR Sensitivity\n(8→4 regions)", 8, 4, "Min Text Regions"),
        ("Skin Filter\n(0.45→0.35)", 55, 65, "Frames Kept %"),
    ]

    fig, axes = plt.subplots(1, 5, figsize=(16, 4))

    for i, (label, before, after, unit) in enumerate(changes):
        ax = axes[i]
        bars = ax.bar(["Before", "After"], [before, after],
                      color=[COLORS["gray"], COLORS["blue"]],
                      edgecolor="white", width=0.6)

        for bar, val in zip(bars, [before, after]):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                    str(val), ha="center", va="bottom", fontweight="bold", fontsize=11)

        ax.set_title(label, fontsize=10)
        ax.set_ylabel(unit, fontsize=9)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

        if after > before:
            improvement = (after - before) / before * 100
            ax.annotate(f"+{improvement:.0f}%", xy=(1, after),
                       xytext=(0, 10), textcoords="offset points",
                       ha="center", fontsize=10, color=COLORS["green"], fontweight="bold")

    fig.suptitle("Proposed Parameter Changes — Expected Impact", fontsize=14, y=1.02)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig5_proposed_improvements.png")
    plt.close(fig)
    print("  fig5_proposed_improvements.png")


def fig6_segment_duration() -> None:
    """Segment duration distribution across test videos."""
    # From DB analysis
    videos_data = {
        "bxBzsSsqQAM": {"avg": 62.0, "min": 52.4, "max": 83.1, "count": 44},
        "uqc_vt95GJg": {"avg": 61.9, "min": 54.6, "max": 70.6, "count": 39},
        "lvMMZLYoDr4": {"avg": 59.7, "min": 48.4, "max": 70.0, "count": 52},
        "2hgjgycOU_0": {"avg": 64.0, "min": 58.6, "max": 83.1, "count": 15},
        "JZLZQVmfGn8": {"avg": 61.6, "min": 57.3, "max": 64.3, "count": 9},
        "NGOAUJtdk-4": {"avg": 65.3, "min": 60.4, "max": 75.4, "count": 7},
        "iLP0YyNwpTc": {"avg": 45.9, "min": 29.9, "max": 62.0, "count": 2},
        "qF4QRh2u7FE": {"avg": 36.0, "min": 36.0, "max": 36.0, "count": 1},
    }

    fig, ax = plt.subplots(figsize=(10, 5))

    labels = list(videos_data.keys())
    avgs = [videos_data[v]["avg"] for v in labels]
    mins = [videos_data[v]["min"] for v in labels]
    maxs = [videos_data[v]["max"] for v in labels]
    counts = [videos_data[v]["count"] for v in labels]

    x = np.arange(len(labels))
    ax.bar(x, avgs, width=0.6, color=COLORS["blue"], alpha=0.8, label="Avg duration")
    ax.errorbar(x, avgs,
                yerr=[np.array(avgs) - np.array(mins), np.array(maxs) - np.array(avgs)],
                fmt="none", ecolor=COLORS["gray"], capsize=4, linewidth=1.5)

    for i, (avg, count) in enumerate(zip(avgs, counts)):
        ax.text(i, avg + 3, f"n={count}", ha="center", va="bottom", fontsize=8, color=COLORS["gray"])

    ax.axhline(y=60, color=COLORS["orange"], linestyle="--", alpha=0.5, label="60s target")
    ax.set_xlabel("Video ID")
    ax.set_ylabel("Segment Duration (seconds)")
    ax.set_title("Speech Segment Duration Distribution\n(scene_threshold=0.35)")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=9)
    ax.legend()

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig6_segment_duration.png")
    plt.close(fig)
    print("  fig6_segment_duration.png")


def fig7_visual_type_distribution() -> None:
    """Pie chart of visual types detected."""
    types = {"product_demo": 22, "photo": 16, "slide": 12, "diagram": 2}

    fig, ax = plt.subplots(figsize=(7, 7))

    colors = [COLORS["blue"], COLORS["teal"], COLORS["orange"], COLORS["purple"]]
    wedges, texts, autotexts = ax.pie(
        types.values(),
        labels=types.keys(),
        autopct="%1.0f%%",
        colors=colors,
        startangle=90,
        pctdistance=0.85,
        textprops={"fontsize": 12},
    )
    for autotext in autotexts:
        autotext.set_fontsize(11)
        autotext.set_fontweight("bold")

    centre_circle = plt.Circle((0, 0), 0.55, fc="white")
    ax.add_artist(centre_circle)
    ax.text(0, 0, f"52\ntotal", ha="center", va="center", fontsize=16, fontweight="bold")

    ax.set_title("Visual Type Distribution\nAcross 8 Test Videos", fontsize=13)

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig7_visual_types.png")
    plt.close(fig)
    print("  fig7_visual_types.png")


def fig8_summary_dashboard(eval_details: dict) -> None:
    """Summary dashboard with key metrics."""
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))

    # Top-left: Overall metrics
    ax = axes[0, 0]
    metrics = ["Recall@5", "Visual\nRecall", "NDCG@5", "MRR"]
    values = [eval_details["recall_5"], eval_details["visual_recall"],
              eval_details["ndcg"], eval_details["mrr"]]
    colors_list = [COLORS["green"] if v > 0.9 else (COLORS["orange"] if v > 0.7 else COLORS["red"]) for v in values]
    bars = ax.bar(metrics, values, color=colors_list, width=0.6, edgecolor="white")
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                f"{val:.3f}", ha="center", va="bottom", fontweight="bold", fontsize=12)
    ax.set_ylim(0, 1.15)
    ax.set_title("Baseline Retrieval Metrics", fontweight="bold")
    ax.set_ylabel("Score")

    # Top-right: Hit/Miss by type
    ax = axes[0, 1]
    queries = eval_details["queries"]
    speech_hit = sum(1 for q in queries if not q.get("is_visual") and q["hit5"] > 0)
    speech_miss = sum(1 for q in queries if not q.get("is_visual") and q["hit5"] == 0)
    visual_hit = sum(1 for q in queries if q.get("is_visual") and q["hit5"] > 0)
    visual_miss = sum(1 for q in queries if q.get("is_visual") and q["hit5"] == 0)

    categories = ["Speech\nQueries", "Visual\nQueries"]
    hits = [speech_hit, visual_hit]
    misses = [speech_miss, visual_miss]
    x = np.arange(len(categories))
    width = 0.35
    ax.bar(x - width/2, hits, width, label="Hit", color=COLORS["green"])
    ax.bar(x + width/2, misses, width, label="Miss", color=COLORS["red"])
    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    ax.set_ylabel("Query Count")
    ax.set_title("Hit/Miss by Query Type", fontweight="bold")
    ax.legend()
    for i, (h, m) in enumerate(zip(hits, misses)):
        ax.text(i - width/2, h + 0.1, str(h), ha="center", fontsize=11, fontweight="bold")
        ax.text(i + width/2, m + 0.1, str(m), ha="center", fontsize=11, fontweight="bold")

    # Bottom-left: Coverage problem
    ax = axes[1, 0]
    coverage = [49, 51]
    ax.pie(coverage, labels=["With Visual\nAnnotation", "Without Visual\nAnnotation"],
           colors=[COLORS["blue"], COLORS["gray"]],
           autopct="%1.0f%%", startangle=90,
           textprops={"fontsize": 11},
           pctdistance=0.75)
    ax.set_title("Visual Coverage Gap\n(Current Pipeline)", fontweight="bold")

    # Bottom-right: Proposed impact
    ax = axes[1, 1]
    before_after = {
        "Recall@5": (0.9583, "≥0.96"),
        "Visual Recall": (0.8333, "≥0.95"),
        "Visual Coverage": (0.49, "~0.95"),
        "Cost/Video": (0.03, "~0.10"),
    }
    labels_ba = list(before_after.keys())
    current_vals = [v[0] for v in before_after.values()]
    ax.barh(labels_ba, current_vals, color=COLORS["blue"], alpha=0.7, height=0.5)
    for i, (label, (cur, target)) in enumerate(before_after.items()):
        ax.text(cur + 0.01, i, f"{cur:.2f} → {target}", va="center", fontsize=10)
    ax.set_xlim(0, 1.2)
    ax.set_title("Current → Expected with Optimization", fontweight="bold")
    ax.set_xlabel("Score / Value")

    fig.suptitle("Indexing Quality Optimization — Summary Dashboard", fontsize=15, fontweight="bold", y=1.02)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "fig8_summary_dashboard.png")
    plt.close(fig)
    print("  fig8_summary_dashboard.png")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load eval details
    eval_path = EVAL_DIR / "indexing_eval_details.json"
    if not eval_path.exists():
        print(f"ERROR: {eval_path} not found")
        sys.exit(1)
    eval_details = json.loads(eval_path.read_text())

    print("Generating figures...")
    fig1_baseline_per_query(eval_details)
    fig2_visual_coverage()
    fig3_parameter_comparison()
    fig4_difficulty_breakdown(eval_details)
    fig5_proposed_improvements()
    fig6_segment_duration()
    fig7_visual_type_distribution()
    fig8_summary_dashboard(eval_details)
    print(f"\nAll figures saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
