-- Cerul Source Stats
-- 查看每个频道的索引进度
--
-- 用法：
--   psql "$DATABASE_URL" -f scripts/source-stats.sql

SELECT
    cs.display_name                                             AS source,
    cs.is_active                                                AS active,
    cs.sync_cursor IS NOT NULL                                  AS has_cursor,
    count(pj.id)                                                AS total_jobs,
    count(pj.id) FILTER (WHERE pj.status = 'completed')        AS completed,
    count(pj.id) FILTER (WHERE pj.status = 'running')          AS running,
    count(pj.id) FILTER (WHERE pj.status = 'pending')          AS pending,
    count(pj.id) FILTER (WHERE pj.status = 'failed')           AS failed,
    to_char(max(pj.completed_at), 'MM-DD HH24:MI')             AS last_done,
    LEFT(cs.sync_cursor, 10)                                    AS cursor_date
FROM content_sources cs
LEFT JOIN processing_jobs pj ON pj.source_id = cs.id
GROUP BY cs.id, cs.display_name, cs.is_active, cs.sync_cursor
ORDER BY
    count(pj.id) FILTER (WHERE pj.status = 'completed') DESC,
    cs.display_name;
