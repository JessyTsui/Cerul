# Task D: Scheduler 支持 youtube_search + LLM 相关性过滤

> **Codex Worktree 任务** — 依赖 Task B 完成后合并（需要 YouTubeClient.search_videos）
> 只改 `workers/scheduler.py` 和它的测试

---

## 目标

1. Scheduler 支持 `youtube_search` 源类型，用关键词搜索 YouTube 新视频
2. 搜索结果经过硬过滤（时长/播放量/频道/直播/shorts）
3. 可选的 LLM 相关性过滤（用 Gemini Flash 判断标题+描述是否相关）

---

## 前置条件

Task B 已合并（`YouTubeClient.search_videos()` 方法已存在）。

---

## 实现

### 1. `_discover_items` 新增路由

**文件：`workers/scheduler.py`**

在 `_discover_items` 方法中，现有路由之后、`raise ValueError` 之前，新增：

```python
# 在所有已有的 if 判断之后，raise 之前加入：
if source.source_type == "youtube_search":
    return await self._discover_youtube_search_items(source)
```

同时修改 `_resolve_item_url` 和 `_get_source_item_id`，让 `youtube_search` 复用 `youtube` 逻辑：

```python
# _resolve_item_url: 把
if source.source_type == "youtube":
# 改为
if source.source_type in ("youtube", "youtube_search"):

# _get_source_item_id: 把
if source.source_type == "youtube":
# 改为
if source.source_type in ("youtube", "youtube_search"):

# _get_latest_cursor: 把
if source.source_type == "youtube":
# 改为
if source.source_type in ("youtube", "youtube_search"):
```

### 2. 新增 `_discover_youtube_search_items`

```python
async def _discover_youtube_search_items(
    self,
    source: ContentSource,
) -> list[dict[str, Any]]:
    """按关键词搜索 YouTube 视频，带硬过滤 + 可选 LLM 过滤。"""
    query = self._require_config_value(source, "query")
    max_results = self._coerce_int(source.config.get("max_results"), default=20)

    # sync_cursor 作为 published_after（增量发现）
    published_after = source.sync_cursor if source.sync_cursor else None

    # 可选参数
    relevance_language = self._coerce_string(source.config.get("relevance_language"))
    event_type = "completed"  # 排除正在直播

    videos = await self._youtube_client.search_videos(
        query,
        max_results=max_results,
        published_after=published_after,
        relevance_language=relevance_language,
        event_type=event_type,
    )

    self._logger.info(
        "YouTube search '%s' returned %d videos.",
        query, len(videos),
    )

    # 硬过滤
    filtered = self._apply_youtube_search_filters(source, videos)
    self._logger.info(
        "After hard filter: %d/%d videos remain.",
        len(filtered), len(videos),
    )

    # LLM 相关性过滤（可选）
    if source.config.get("llm_filter") and filtered:
        filtered = await self._apply_llm_relevance_filter(source, filtered)
        self._logger.info(
            "After LLM filter: %d videos remain.",
            len(filtered),
        )

    return filtered
```

### 3. 新增 `_apply_youtube_search_filters`（硬过滤）

```python
def _apply_youtube_search_filters(
    self,
    source: ContentSource,
    videos: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """对搜索结果做硬过滤：时长、播放量、频道、直播状态。"""
    config = source.config
    max_duration = self._coerce_int(config.get("max_duration_seconds"), default=14400)
    min_duration = self._coerce_int(config.get("min_duration_seconds"), default=60)
    min_views = self._coerce_int(config.get("min_view_count"), default=0)
    channel_allowlist = set(config.get("channel_allowlist") or [])
    channel_blocklist = set(config.get("channel_blocklist") or [])

    filtered: list[dict[str, Any]] = []
    for video in videos:
        duration = video.get("duration_seconds") or 0
        if duration < min_duration or duration > max_duration:
            continue

        live_status = self._coerce_string(video.get("live_broadcast_content"))
        if live_status and live_status != "none":
            continue

        view_count = video.get("view_count") or 0
        if view_count < min_views:
            continue

        channel_id = self._coerce_string(video.get("channel_id")) or ""
        if channel_blocklist and channel_id in channel_blocklist:
            continue
        if channel_allowlist and channel_id not in channel_allowlist:
            continue

        filtered.append(video)
    return filtered
```

### 4. 新增 `_apply_llm_relevance_filter`（LLM 过滤，可选）

```python
async def _apply_llm_relevance_filter(
    self,
    source: ContentSource,
    videos: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    用 Gemini Flash 判断视频是否和 source 描述相关。
    config 中需要 llm_filter=true 才会启用。
    """
    import os
    try:
        import google.genai as genai
    except ImportError:
        self._logger.warning("google-genai not installed, skipping LLM filter.")
        return videos

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        self._logger.warning("GEMINI_API_KEY not set, skipping LLM filter.")
        return videos

    # 构建批量判断 prompt
    description = self._coerce_string(source.config.get("llm_filter_description")) or source.display_name
    video_list_text = ""
    for i, v in enumerate(videos):
        title = v.get("title", "")
        desc = (v.get("description") or "")[:150]
        video_list_text += f"{i+1}. Title: {title}\n   Description: {desc}\n\n"

    prompt = (
        f"You are filtering YouTube search results for a video index about: {description}\n\n"
        f"For each video below, reply with ONLY the numbers of videos that are relevant.\n"
        f"Reply as comma-separated numbers (e.g., '1,3,5'). If none are relevant, reply 'NONE'.\n\n"
        f"{video_list_text}"
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        answer = response.text.strip()

        if answer.upper() == "NONE":
            return []

        # 解析数字
        relevant_indices: set[int] = set()
        for part in answer.replace(" ", "").split(","):
            try:
                idx = int(part) - 1  # 1-indexed → 0-indexed
                if 0 <= idx < len(videos):
                    relevant_indices.add(idx)
            except ValueError:
                continue

        return [videos[i] for i in sorted(relevant_indices)]

    except Exception:
        self._logger.exception("LLM relevance filter failed, returning all videos.")
        return videos
```

### 5. content_source 配置示例

```json
{
  "source_type": "youtube_search",
  "query": "AI agents workflow tutorial",
  "max_results": 20,
  "relevance_language": "en",
  "min_duration_seconds": 120,
  "max_duration_seconds": 7200,
  "min_view_count": 1000,
  "channel_blocklist": [],
  "llm_filter": true,
  "llm_filter_description": "Videos about AI agents, LLM applications, and developer tools"
}
```

`llm_filter` 默认不启用。只有显式设为 `true` 才会调用 Gemini Flash，费用极低（每次约 $0.0001）。

---

## 测试

```python
import pytest
from workers.scheduler import ContentScheduler, ContentSource


def _make_source(**kwargs):
    defaults = {
        "id": "test-id",
        "slug": "test-search",
        "track": "unified",
        "source_type": "youtube_search",
        "config": {"query": "AI agents", "min_duration_seconds": 60, "max_duration_seconds": 7200},
        "sync_cursor": None,
        "is_active": True,
        "cursor_storage": "column",
    }
    defaults.update(kwargs)
    return ContentSource(**defaults)


def test_apply_youtube_search_filters_duration():
    scheduler = ContentScheduler()
    source = _make_source(config={
        "query": "test",
        "min_duration_seconds": 120,
        "max_duration_seconds": 3600,
    })
    videos = [
        {"source_video_id": "a", "duration_seconds": 30},   # too short
        {"source_video_id": "b", "duration_seconds": 300},   # ok
        {"source_video_id": "c", "duration_seconds": 5000},  # too long
        {"source_video_id": "d", "duration_seconds": 600},   # ok
    ]
    result = scheduler._apply_youtube_search_filters(source, videos)
    assert len(result) == 2
    assert result[0]["source_video_id"] == "b"
    assert result[1]["source_video_id"] == "d"


def test_apply_youtube_search_filters_live():
    scheduler = ContentScheduler()
    source = _make_source()
    videos = [
        {"source_video_id": "a", "duration_seconds": 300, "live_broadcast_content": "live"},
        {"source_video_id": "b", "duration_seconds": 300, "live_broadcast_content": "none"},
        {"source_video_id": "c", "duration_seconds": 300},
    ]
    result = scheduler._apply_youtube_search_filters(source, videos)
    assert len(result) == 2  # a is filtered out


def test_apply_youtube_search_filters_views():
    scheduler = ContentScheduler()
    source = _make_source(config={"query": "test", "min_view_count": 1000})
    videos = [
        {"source_video_id": "a", "duration_seconds": 300, "view_count": 500},
        {"source_video_id": "b", "duration_seconds": 300, "view_count": 2000},
    ]
    result = scheduler._apply_youtube_search_filters(source, videos)
    assert len(result) == 1
    assert result[0]["source_video_id"] == "b"


def test_apply_youtube_search_filters_channel_blocklist():
    scheduler = ContentScheduler()
    source = _make_source(config={"query": "test", "channel_blocklist": ["bad_channel"]})
    videos = [
        {"source_video_id": "a", "duration_seconds": 300, "channel_id": "bad_channel"},
        {"source_video_id": "b", "duration_seconds": 300, "channel_id": "good_channel"},
    ]
    result = scheduler._apply_youtube_search_filters(source, videos)
    assert len(result) == 1
    assert result[0]["source_video_id"] == "b"
```

---

## 验证

```bash
pytest workers/tests -q
```

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `workers/scheduler.py` | 新增 youtube_search 路由 + 硬过滤 + LLM 过滤；修改 cursor/URL/itemID 支持 youtube_search |
| `workers/tests/test_scheduler.py` | 新增过滤逻辑测试 |
