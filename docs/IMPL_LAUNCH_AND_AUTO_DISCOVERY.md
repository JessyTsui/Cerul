# 上线方案总览 + Codex 任务分配

---

## 服务架构

| 组件 | 平台 | 费用/月 | 说明 |
|------|------|---------|------|
| 前端 | Vercel | $0 | Next.js，已有 vercel.json |
| 后端 API | Railway | ~$5 | 长连接友好，自动 HTTPS，按用量计费 |
| Worker | Railway (Background) | ~$5-10 | 独立进程，可调并发 |
| Scheduler | Railway Cron 或 GitHub Actions | $0 | 每 4 小时 `--once` |
| 数据库 | Neon PostgreSQL | $0 → $19 | pgvector 原生，serverless |
| 对象存储 | Cloudflare R2 | ~$1 | 已配好，出口免费 |
| 错误监控 | Sentry | $0 | 免费 tier |
| ASR | Groq | $0.04/hr | 已配好 |
| Embedding | Gemini | ~$0 | 免费额度大 |

**月总成本：~$10-25**

---

## 冷启动批量索引

本地 Mac 跑即可，不需要租服务器：
- 4 并发处理，每个视频 3-5 分钟
- 1000 条视频 ≈ 12-15 小时（挂着跑一晚上）
- 如果嫌慢，租一台 Hetzner $5/月 VPS 跑完就停

---

## 自动内容发现架构

```
Railway Cron (每 4 小时)
  → python -m workers.scheduler --once
    → 扫 content_sources 表
      → youtube 类型：按频道抓最新视频
      → youtube_search 类型：按关键词搜索
        → 硬过滤（时长/播放量/频道/shorts/直播）
        → 可选 LLM 过滤（Gemini Flash 判断相关性）
      → 新视频 → INSERT processing_jobs
    → Worker 自动消费 jobs
```

不用 Claude Code Remote Trigger，直接用 **Railway Cron Job**：
- 定时跑 `python -m workers.scheduler --once`
- Scheduler 代码里内置了 LLM 相关性过滤（可选开启）
- 简单可靠，不依赖外部 agent 框架

---

## Codex 任务拆分

### 并行组 1（互不冲突，可同时开 3 个 worktree）

| 任务 | 文档 | 改动范围 | 耗时预估 |
|------|------|----------|----------|
| **Task A** | `docs/TASK_A_DB_MIGRATION.md` | `db/migrations/` | 5 分钟 |
| **Task B** | `docs/TASK_B_YOUTUBE_SEARCH.md` | `workers/common/sources/youtube.py` + tests | 15 分钟 |
| **Task C** | `docs/TASK_C_SOURCE_CRUD_API.md` | `backend/app/admin/` + `backend/app/routers/admin.py` | 20 分钟 |

### 串行（等 Task B 合并后）

| 任务 | 文档 | 改动范围 | 耗时预估 |
|------|------|----------|----------|
| **Task D** | `docs/TASK_D_SCHEDULER_YOUTUBE_SEARCH.md` | `workers/scheduler.py` + tests | 20 分钟 |

### 依赖关系

```
Task A (DB migration) ──────────────┐
Task B (YouTube search_videos) ─────┼──→ Task D (Scheduler youtube_search + LLM filter)
Task C (Source CRUD API) ───────────┘    (合并 A+B+C 后再做 D)
```

---

## 不做什么

- 不加 Redis / Kafka / 消息队列
- 不加第二个数据库
- 不做 Admin Source 管理 UI（先用 API）
- 不用 Claude Code Remote Trigger（用 Railway Cron）
- 不用 opencli / 浏览器自动化（用 YouTube API）

---

## 部署步骤（代码完成后）

1. Neon: 创建项目 → 跑 migrations → 导入本地数据
2. Railway: 部署 backend + worker + scheduler cron
3. Vercel: 部署 frontend
4. Cloudflare: R2 已配好，确认 cdn.cerul.ai 域名
5. Sentry: 创建项目，配 DSN 到环境变量
