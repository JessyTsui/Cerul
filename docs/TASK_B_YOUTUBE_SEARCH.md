# Task B: YouTubeClient 新增关键词搜索

> **Codex Worktree 任务** — 可和 Task A、Task C 并行
> 只改 `workers/common/sources/youtube.py` 和它的测试文件

---

## 目标

给 `YouTubeClient` 新增 `search_videos()` 方法，支持按关键词搜索 YouTube 视频。同时在 `_normalize_video` 中加入 `view_count`/`like_count` 字段（从 statistics API 读取）。

---

## 当前状态

`YouTubeClient`（`workers/common/sources/youtube.py`）目前只有：
- `get_video_metadata(video_id)` — 获取单个视频信息
- `search_channel_videos(channel_id, max_results)` — 按频道搜索

没有按关键词搜索的能力。

---

## 实现

### 1. 新增 `search_videos` 方法

在 `YouTubeClient` 类中，紧跟 `search_channel_videos` 之后新增：

```python
async def search_videos(
    self,
    query: str,
    *,
    max_results: int = 20,
    published_after: str | None = None,
    relevance_language: str | None = None,
    video_duration: str | None = None,
    event_type: str | None = None,
) -> list[dict[str, Any]]:
    """
    按关键词搜索 YouTube 视频。

    参数：
    - query: 搜索关键词
    - max_results: 最多返回数量（默认 20）
    - published_after: ISO 8601 时间戳，只返回此时间之后发布的视频
    - relevance_language: 语言偏好（如 "en"）
    - video_duration: "short" (<4min), "medium" (4-20min), "long" (>20min)
    - event_type: "completed" 排除正在直播的视频
    """
    query = query.strip()
    if not query:
        raise ValueError("query is required.")

    ordered_video_ids: list[str] = []
    seen_video_ids: set[str] = set()
    next_page_token: str | None = None

    while len(ordered_video_ids) < max_results:
        remaining = max_results - len(ordered_video_ids)
        params: dict[str, Any] = {
            "q": query,
            "maxResults": min(remaining, 50),
            "order": "date",
            "part": "snippet",
            "type": "video",
            "pageToken": next_page_token,
        }
        if published_after:
            params["publishedAfter"] = published_after
        if relevance_language:
            params["relevanceLanguage"] = relevance_language
        if video_duration:
            params["videoDuration"] = video_duration
        if event_type:
            params["eventType"] = event_type

        payload = await self._get_json("search", params)
        items = payload.get("items", [])
        for item in items:
            video_id = self._extract_video_id(item)
            if video_id is None or video_id in seen_video_ids:
                continue
            seen_video_ids.add(video_id)
            ordered_video_ids.append(video_id)
            if len(ordered_video_ids) >= max_results:
                break

        next_page_token = self._coerce_string(payload.get("nextPageToken"))
        if next_page_token is None:
            break

    if not ordered_video_ids:
        return []

    # 批量获取完整 metadata（含 statistics）
    normalized_by_id = {
        metadata["source_video_id"]: metadata
        for video_id_batch in self._chunked(ordered_video_ids, 50)
        for item in (
            await self._get_json(
                "videos",
                {
                    "id": ",".join(video_id_batch),
                    "part": "snippet,contentDetails,status,statistics",
                },
            )
        ).get("items", [])
        for metadata in [self._normalize_video(item)]
    }
    return [
        normalized_by_id[video_id]
        for video_id in ordered_video_ids
        if video_id in normalized_by_id
    ]
```

### 2. 修改 `_normalize_video` 加入 statistics

在 `_normalize_video` 方法中，新增 statistics 字段读取：

```python
def _normalize_video(self, payload: dict[str, Any]) -> dict[str, Any]:
    # ...现有逻辑不变...
    statistics = payload.get("statistics") or {}

    return {
        # ...所有现有字段保持不变...
        "view_count": int(statistics.get("viewCount", 0) or 0),
        "like_count": int(statistics.get("likeCount", 0) or 0),
    }
```

注意：`view_count` 和 `like_count` 是追加到 return dict 的末尾，不改动任何已有字段。当 API 没返回 statistics（比如 `search_channel_videos` 没请求 statistics part），这两个字段默认为 0。

### 3. `search_channel_videos` 也获取 statistics

为了统一，把 `search_channel_videos` 中的 videos API 调用也加上 `statistics`：

```python
# search_channel_videos 中，把：
"part": "snippet,contentDetails,status",
# 改为：
"part": "snippet,contentDetails,status,statistics",
```

---

## 测试

新增测试文件或在已有测试中加入：

```python
import pytest
from workers.common.sources.youtube import YouTubeClient


@pytest.mark.asyncio
async def test_search_videos_empty_query():
    client = YouTubeClient(api_key="fake")
    with pytest.raises(ValueError, match="query is required"):
        await client.search_videos("")


@pytest.mark.asyncio
async def test_search_videos_whitespace_query():
    client = YouTubeClient(api_key="fake")
    with pytest.raises(ValueError, match="query is required"):
        await client.search_videos("   ")


def test_normalize_video_with_statistics():
    """_normalize_video 应该包含 view_count 和 like_count。"""
    client = YouTubeClient(api_key="fake")
    payload = {
        "id": "test123",
        "snippet": {
            "title": "Test Video",
            "description": "desc",
            "channelTitle": "Channel",
            "publishedAt": "2025-01-01T00:00:00Z",
            "thumbnails": {},
            "liveBroadcastContent": "none",
        },
        "contentDetails": {"duration": "PT10M30S"},
        "status": {"license": "youtube", "privacyStatus": "public"},
        "statistics": {"viewCount": "12345", "likeCount": "678"},
    }
    result = client._normalize_video(payload)
    assert result["view_count"] == 12345
    assert result["like_count"] == 678


def test_normalize_video_without_statistics():
    """没有 statistics 时应该默认为 0。"""
    client = YouTubeClient(api_key="fake")
    payload = {
        "id": "test456",
        "snippet": {
            "title": "Test",
            "description": "",
            "channelTitle": "Ch",
            "publishedAt": "2025-01-01T00:00:00Z",
            "thumbnails": {},
        },
        "contentDetails": {"duration": "PT5M"},
        "status": {},
    }
    result = client._normalize_video(payload)
    assert result["view_count"] == 0
    assert result["like_count"] == 0
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
| `workers/common/sources/youtube.py` | 新增 `search_videos()`，`_normalize_video` 加 statistics |
| `workers/tests/test_youtube_client.py` | 新增搜索和 statistics 测试 |
