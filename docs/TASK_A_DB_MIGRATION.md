# Task A: DB Migration — content_sources 升级

> **Codex Worktree 任务** — 可和 Task B、Task C 并行

---

## 目标

给 `content_sources` 表加 `source_type`/`config`/`sync_cursor` 列，放宽 track CHECK 约束以支持 `unified`。

---

## 当前状态

`content_sources` 表只有 `id, slug, track, display_name, base_url, is_active, metadata, created_at, updated_at`。

- 没有 `source_type` 列（目前靠 metadata JSON 推断）
- 没有 `config` 列（目前靠 metadata JSON）
- 没有 `sync_cursor` 列（目前靠 metadata JSON）
- `track` CHECK 约束只允许 `broll, knowledge, shared`，不含 `unified`
- `processing_jobs` 的 `track` CHECK 同样缺 `unified`

---

## 实现

**新文件：`db/migrations/009_content_sources_upgrade.sql`**

```sql
BEGIN;

-- 1. content_sources: 放宽 track CHECK，加入 'unified'
ALTER TABLE content_sources DROP CONSTRAINT IF EXISTS content_sources_track_check;
ALTER TABLE content_sources ADD CONSTRAINT content_sources_track_check
    CHECK (track = ANY (ARRAY['broll', 'knowledge', 'shared', 'unified']));

-- 2. 新增列
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS sync_cursor TEXT;

-- 3. 从 metadata 迁移已有数据（幂等）
UPDATE content_sources
SET
    source_type = COALESCE(source_type, metadata->>'source_type'),
    config = CASE
        WHEN config = '{}'::jsonb AND metadata != '{}'::jsonb
        THEN metadata - 'source_type' - 'sync_cursor'
        ELSE config
    END,
    sync_cursor = COALESCE(sync_cursor, metadata->>'sync_cursor')
WHERE source_type IS NULL
   OR (config = '{}'::jsonb AND metadata != '{}'::jsonb);

-- 4. processing_jobs: 放宽 track CHECK，加入 'unified'
ALTER TABLE processing_jobs DROP CONSTRAINT IF EXISTS processing_jobs_track_check;
ALTER TABLE processing_jobs ADD CONSTRAINT processing_jobs_track_check
    CHECK (track = ANY (ARRAY['broll', 'knowledge', 'unified']));

COMMIT;
```

---

## 验证

```bash
# 跑 migration
./scripts/migrate-db.sh

# 验证 schema
psql "$DATABASE_URL" -c "\d content_sources"
# 应该看到 source_type, config, sync_cursor 三个新列

# 验证 CHECK 约束
psql "$DATABASE_URL" -c "
INSERT INTO content_sources (slug, track, display_name, source_type, config)
VALUES ('_test_unified', 'unified', 'Test', 'youtube', '{}'::jsonb);
DELETE FROM content_sources WHERE slug = '_test_unified';
"
```

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `db/migrations/009_content_sources_upgrade.sql` | **新建** |

不改其他文件。
