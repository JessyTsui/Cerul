import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminAnalytics } from "./admin-analytics";

describe("adminAnalytics client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  it("requests overview with explicit surface filters and normalizes metric payloads", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          generated_at: "2026-04-02T12:00:00Z",
          window: {
            range_key: "7d",
            current_start: "2026-03-27T00:00:00.000Z",
            current_end: "2026-04-02T12:00:00.000Z",
            previous_start: "2026-03-20T12:00:00.000Z",
            previous_end: "2026-03-27T00:00:00.000Z",
          },
          search_surface: "api",
          summary: {
            searches: 10,
            searches_with_results: 8,
            searches_with_answer: 3,
            impressions: 24,
            unique_outbound_clicks: 6,
            unique_detail_page_views: 2,
            overall_ctr: 0.25,
            detail_assist_rate: 0.08,
            detail_to_outbound_rate: 3,
          },
          metrics: {
            searches: { current: 10, previous: 8, delta: 2, delta_ratio: 0.25, target: null, target_gap: null, attainment_ratio: null, comparison_mode: null },
            impressions: { current: 24, previous: 20, delta: 4, delta_ratio: 0.2, target: null, target_gap: null, attainment_ratio: null, comparison_mode: null },
            unique_outbound_clicks: { current: 6, previous: 5, delta: 1, delta_ratio: 0.2, target: null, target_gap: null, attainment_ratio: null, comparison_mode: null },
            overall_ctr: { current: 0.25, previous: 0.24, delta: 0.01, delta_ratio: 0.04, target: null, target_gap: null, attainment_ratio: null, comparison_mode: null },
            detail_assist_rate: { current: 0.08, previous: 0.05, delta: 0.03, delta_ratio: 0.6, target: null, target_gap: null, attainment_ratio: null, comparison_mode: null },
            answer_ctr_gap: { current: 0.03, previous: 0, delta: 0.03, delta_ratio: null, target: null, target_gap: null, attainment_ratio: null, comparison_mode: null },
          },
          trend_series: [],
          answer_modes: [],
          surface_breakdown: [],
          notices: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(adminAnalytics.getOverview("7d", "api")).resolves.toEqual(
      expect.objectContaining({
        searchSurface: "api",
        summary: expect.objectContaining({
          impressions: 24,
          overallCtr: 0.25,
        }),
        metrics: expect.objectContaining({
          searches: expect.objectContaining({ current: 10, previous: 8 }),
        }),
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/console/admin/analytics/overview?range=7d&surface=api",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("omits surface when requesting all surfaces", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          generated_at: "2026-04-02T12:00:00Z",
          window: {
            range_key: "30d",
            current_start: "2026-03-04T00:00:00.000Z",
            current_end: "2026-04-02T12:00:00.000Z",
            previous_start: "2026-02-03T12:00:00.000Z",
            previous_end: "2026-03-04T00:00:00.000Z",
          },
          search_surface: null,
          min_impressions: 30,
          min_result_impressions: 20,
          top_videos_by_clicks: [],
          top_videos_by_ctr: [],
          top_results_by_ctr: [],
          high_impression_low_click_videos: [],
          cross_query_winners: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(adminAnalytics.getContent("30d", "all")).resolves.toEqual(
      expect.objectContaining({
        searchSurface: null,
        minImpressions: 30,
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/console/admin/analytics/content?range=30d",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });
});
