# Codex 指挥手册

## 并行开 3 个 worktree，复制粘贴即可

---

### Worktree 1 — Task A (DB Migration)

```
看 docs/TASK_A_DB_MIGRATION.md，按文档创建 db/migrations/009_content_sources_upgrade.sql。给 content_sources 加 source_type/config/sync_cursor 列，放宽 content_sources 和 processing_jobs 的 track CHECK 约束以支持 unified。包含从 metadata 迁移已有数据的 UPDATE 语句。
```

---

### Worktree 2 — Task B (YouTube Search)

```
看 docs/TASK_B_YOUTUBE_SEARCH.md，在 workers/common/sources/youtube.py 的 YouTubeClient 中新增 search_videos() 方法（按关键词搜索 YouTube，支持 published_after/relevance_language/video_duration/event_type 参数）。同时修改 _normalize_video 加入 view_count 和 like_count（从 statistics 读取），search_channel_videos 的 videos API 调用也加上 statistics part。写测试。跑 pytest workers/tests -q。
```

---

### Worktree 3 — Task C (Source CRUD API)

```
看 docs/TASK_C_SOURCE_CRUD_API.md，在 backend 新增 content source 管理 API。在 admin/models.py 加 CreateSourceRequest/UpdateSourceRequest 模型，在 admin service 层加 fetch_sources/create_source/update_source/delete_source 函数，在 routers/admin.py 加 GET/POST/PATCH/DELETE /admin/sources 端点。参考已有的 admin 端点风格（require_admin_access, get_db 依赖注入等）。跑 pytest backend/tests -q。
```

---

### 合并 A+B+C 后 — Task D (Scheduler)

```
看 docs/TASK_D_SCHEDULER_YOUTUBE_SEARCH.md，在 workers/scheduler.py 新增 youtube_search 源类型支持。包括：1) _discover_items 新增路由 2) _discover_youtube_search_items 方法（调用 YouTubeClient.search_videos） 3) _apply_youtube_search_filters 硬过滤（时长/播放量/频道/直播） 4) _apply_llm_relevance_filter 可选 LLM 过滤（用 Gemini Flash） 5) _resolve_item_url/_get_source_item_id/_get_latest_cursor 中 youtube_search 复用 youtube 逻辑。写测试。跑 pytest workers/tests -q。
```
