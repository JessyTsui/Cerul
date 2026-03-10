# Cerul 剩余开发任务清单

> 生成时间：2026-03-11
> 基于 ARCHITECTURE.md、docs/codex-workstreams.md 和已合并 PR 分析得出

---

## 已完成的工作

以下工作已通过 PR 合并到 main：

| PR | 标题 | 对应 Workstream |
|----|------|----------------|
| #12 | Database + API key auth foundation | Task 1 ✅ |
| #13 | Dashboard billing API | Task 4 ✅ |
| #14 | Frontend dashboard (real API integration) | Task 5 ✅ |
| #15 | Public search and usage API | Task 2 ✅ |
| #16 | Switch embedding model to Gemini Embedding 2 | 文档更新 ✅ |
| #17 | Fix dashboard session auth regression | 修复 ✅ |
| #11 | B-roll indexing pipeline | Task 3 ✅ |
| #8-#10 | Brand assets, README, workstream docs | 基础设施 ✅ |

**5 个 Codex workstream tasks 全部完成。** 但这些只是第一轮 sprint，架构文档中规划的后续工作还有很多。

---

## 剩余任务

### TASK-01: 接入 Gemini Embedding 2 替换 CLIP 实现

**背景**: PR #16 更新了文档，将 embedding 模型从 CLIP 切换到 Gemini Embedding 2，但代码层面 `backend/app/embedding/clip.py` 仍然是 CLIP 实现，需要实际替换为 Gemini API 调用。

**目的**: 让 B-roll pipeline 和未来的 knowledge pipeline 使用统一的 Gemini Embedding 2 模型生成 768 维向量。

**涉及文件**:
- `backend/app/embedding/clip.py` → 重写为 `gemini.py`
- `backend/app/embedding/__init__.py`
- `workers/broll/steps/generate_clip_embedding.py` → 重命名并更新
- `workers/requirements.txt` — 添加 `google-genai`
- `.env.example` — 添加 `GEMINI_API_KEY`

**测试方式**:
- 单元测试: mock Gemini API，验证返回 768 维向量
- 集成测试: 使用真实 GEMINI_API_KEY 对一张测试图片生成 embedding
- `python -m pytest workers/tests/ backend/tests/`

**达成效果**: 所有 embedding 生成统一走 Gemini Embedding 2 API，不再需要本地 CLIP 模型或 GPU。

---

### TASK-02: Better Auth 集成（真实用户认证）

**背景**: 当前 dashboard 使用 stub session auth (`backend/app/auth/session.py`)，login/signup 页面是静态 mock。ARCHITECTURE.md 第 7 节明确要求使用 Better Auth 做用户认证。

**目的**: 实现完整的用户注册、登录、会话管理流程，替换所有 session auth stub。

**涉及文件**:
- `backend/app/auth/session.py` — 替换 stub 为 Better Auth 集成
- `frontend/app/login/page.tsx` — 接入真实登录逻辑
- `frontend/app/signup/page.tsx` — 接入真实注册逻辑
- `frontend/lib/auth.ts` — 新建，封装前端 auth 状态管理
- `.env.example` — 添加 `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` 等

**测试方式**:
- 注册新用户 → 自动创建 `user_profiles` 记录
- 登录 → 获取 session → 访问 dashboard 页面
- 未登录时访问 dashboard → 重定向到 login
- `pytest backend/tests/test_auth.py`

**达成效果**: 用户可以真实注册、登录、使用 dashboard，session 认证不再是 stub。

---

### TASK-03: 速率限制实现

**背景**: ARCHITECTURE.md 第 7.3 节定义了速率限制规则（free: 1 req/s, pro: 10 req/s），AuthContext 中已有 `rate_limit_per_sec` 字段，但实际的限速中间件尚未实现。

**目的**: 在 API 请求链路中加入真实的速率限制检查。

**涉及文件**:
- `backend/app/auth/api_key.py` — 添加速率检查逻辑
- `backend/app/auth/rate_limiter.py` — 新建，基于滑动窗口的限速器
- `backend/tests/test_rate_limit.py` — 新建

**测试方式**:
- 连续快速发送请求，验证超过限制后返回 429
- 验证不同 tier 的限速阈值正确
- `pytest backend/tests/test_rate_limit.py`

**达成效果**: API 请求受到 per-user 速率限制保护，free 用户 1 req/s，pro 用户 10 req/s。

---

### TASK-04: Knowledge 视频入库 Pipeline

**背景**: ARCHITECTURE.md 第 10.3 节定义了知识视频 pipeline 的完整流程。当前只实现了 B-roll pipeline，knowledge pipeline 是项目的商业核心能力。

**目的**: 实现 YouTube 知识视频的下载、转录、帧分析、分段和 embedding 入库全流程。

**涉及文件**:
- `workers/knowledge/` — 新建整个目录
- `workers/knowledge/pipeline.py`
- `workers/knowledge/steps/download_video.py` — yt-dlp 下载
- `workers/knowledge/steps/asr_transcript.py` — Whisper API 转录
- `workers/knowledge/steps/scene_detection.py` — 场景切换检测 + 关键帧
- `workers/knowledge/steps/frame_analysis.py` — GPT-4o 多模态帧理解
- `workers/knowledge/steps/segment_generation.py` — 合并生成 segment
- `workers/knowledge/steps/embed_segments.py` — Gemini Embedding 2 生成 768 维向量
- `workers/knowledge/steps/persist_segments.py` — 写入 knowledge_segments 表
- `workers/knowledge/repository.py`
- `scripts/seed_knowledge.py` — CLI 脚本
- `workers/tests/test_knowledge_steps.py`

**测试方式**:
- 对一个短 YouTube 视频运行完整 pipeline
- 验证 knowledge_segments 表中写入了正确格式的数据
- 验证每个 segment 有 768 维 embedding
- `pytest workers/tests/test_knowledge_steps.py`

**达成效果**: 可以通过 `python scripts/seed_knowledge.py <youtube_url>` 将知识视频索引入库。

---

### TASK-05: Knowledge 搜索后端完善

**背景**: `backend/app/search/knowledge.py` 目前有基础的 pgvector 查询结构，但缺少 LLM rerank、answer 生成和 timestamp URL 返回功能。

**目的**: 完善 knowledge 搜索的召回 → rerank → answer 生成全链路。

**涉及文件**:
- `backend/app/search/knowledge.py` — 添加 rerank 和 answer 生成
- `backend/app/search/reranker.py` — 新建，LLM rerank 逻辑
- `backend/app/search/answer.py` — 新建，answer 生成逻辑
- `backend/tests/test_knowledge_search.py` — 新建

**测试方式**:
- `POST /v1/search` with `search_type=knowledge` 返回带 timestamp 的结果
- `include_answer=true` 时返回 LLM 生成的回答
- rerank 后的排序优于纯向量召回
- `pytest backend/tests/test_knowledge_search.py`

**达成效果**: knowledge 搜索支持 rerank + answer 生成，返回带时间戳 URL 的结果。

---

### TASK-06: Embedding 查询向量实时生成

**背景**: 搜索 API 中 `BrollSearchService` 和 `KnowledgeSearchService` 当前使用 placeholder 768 维向量，没有真正调用 embedding API 将用户 query 转为向量。

**目的**: 在搜索请求链路中实时调用 Gemini Embedding 2 将用户 query 文本转为 768 维查询向量。

**涉及文件**:
- `backend/app/search/broll.py` — 接入 embed_text
- `backend/app/search/knowledge.py` — 接入 embed_text
- `backend/app/search/base.py` — 添加 embedding client 初始化
- `backend/tests/test_search_services.py` — 完善测试

**测试方式**:
- mock embedding API，验证搜索请求正确调用 embed_text
- 集成测试: 对有数据的库执行真实搜索
- `pytest backend/tests/test_search_services.py`

**达成效果**: 用户搜索请求的 query 文本被实时转为 768 维向量，用于 pgvector 余弦相似度检索。

---

### TASK-07: Scheduler + processing_jobs 自动化

**背景**: ARCHITECTURE.md Week 5-6 规划了调度器和自动重试机制。当前 pipeline 只能手动通过 seed 脚本触发，没有自动调度能力。

**目的**: 实现基于 `processing_jobs` 表的任务调度器，支持定时拉取新内容、失败自动重试。

**涉及文件**:
- `workers/scheduler/` — 新建
- `workers/scheduler/runner.py` — 主调度循环
- `workers/scheduler/job_manager.py` — 任务状态管理
- `workers/common/pipeline/executor.py` — 添加 job 状态回写
- `workers/tests/test_scheduler.py` — 新建
- `scripts/run_scheduler.py` — CLI 入口

**测试方式**:
- 向 processing_jobs 插入一条 pending 任务，验证 scheduler 自动拾取并执行
- 模拟 step 失败，验证 job 状态变为 failed 并记录失败步骤
- 验证自动重试逻辑（最多 3 次）
- `pytest workers/tests/test_scheduler.py`

**达成效果**: 后台 scheduler 自动处理 processing_jobs 队列，支持失败重试和状态追踪。

---

### TASK-08: 扩大 B-roll 种子数据到 10 万条

**背景**: ARCHITECTURE.md Week 2 规划了将 B-roll 素材扩展到 10 万条。当前通过 seed 脚本可以小批量导入。

**目的**: 设计批量导入策略，从 Pexels + Pixabay 拉取 10 万条高质量 B-roll 素材。

**涉及文件**:
- `scripts/seed_broll_batch.py` — 新建，批量种子脚本
- `scripts/broll_categories.json` — 新建，预定义的搜索类别列表
- `workers/broll/steps/discover_asset.py` — 可能需要分页支持优化

**测试方式**:
- 使用 `--dry-run` 模式验证预估数量
- 小批量测试 1000 条，验证去重和幂等性
- 验证数据库中素材数量达标
- `python scripts/seed_broll_batch.py --dry-run`

**达成效果**: 数据库中有 10 万条 B-roll 素材及其 embedding，搜索有足够的候选集。

---

### TASK-09: Search Demo 页面

**背景**: 前端有路由结构但没有公开的搜索 demo 页面。作为产品展示和获客入口，需要一个可交互的搜索体验页。

**目的**: 实现一个公开可访问的搜索 demo 页面，展示 B-roll 搜索能力。

**涉及文件**:
- `frontend/app/demo/page.tsx` — 新建搜索 demo 页
- `frontend/components/demo/search-input.tsx` — 搜索输入组件
- `frontend/components/demo/result-card.tsx` — 结果卡片组件
- `frontend/components/demo/result-grid.tsx` — 结果网格布局

**测试方式**:
- 访问 `/demo`，输入搜索词，看到搜索结果
- 验证 loading/empty/error 状态正确显示
- 验证搜索结果包含缩略图、标题、来源
- `pnpm --dir frontend build` 无报错
- `pnpm --dir frontend test`

**达成效果**: 访客可以在 `/demo` 页面体验 B-roll 视频搜索，直观感受产品能力。

---

### TASK-10: Pixabay 数据源完整接入

**背景**: `workers/common/sources/pixabay.py` 已有基础客户端，但 B-roll pipeline 的 `DiscoverAssetStep` 可能只对接了 Pexels。需要确保 Pixabay 作为第二数据源完整可用。

**目的**: 确保 Pixabay 数据源在 B-roll pipeline 中完全可用，包括元数据标准化和去重。

**涉及文件**:
- `workers/common/sources/pixabay.py` — 完善 API 响应处理
- `workers/broll/steps/discover_asset.py` — 支持多数据源选择
- `workers/broll/steps/fetch_asset_metadata.py` — 确保 Pixabay 格式标准化
- `workers/tests/test_broll_steps.py` — 添加 Pixabay 相关测试

**测试方式**:
- 使用 Pixabay API key 搜索素材，验证返回格式正确
- 运行 pipeline 指定 Pixabay 为数据源
- `pytest workers/tests/test_broll_steps.py`

**达成效果**: B-roll pipeline 可以同时从 Pexels 和 Pixabay 拉取素材。

---

### TASK-11: Stripe 升级流程端到端联调

**背景**: 后端 Stripe 相关 API 和 webhook handler 已实现，前端 settings 页面有升级按钮，但端到端流程可能未经过完整联调。

**目的**: 确保从用户点击 "Upgrade to Pro" → Stripe Checkout → webhook 回调 → 用户 tier 更新的完整链路正确工作。

**涉及文件**:
- `backend/app/billing/stripe_service.py` — 验证并完善
- `backend/app/routers/webhooks.py` — 验证 webhook 处理
- `frontend/app/dashboard/settings/page.tsx` — 验证前端交互
- `backend/tests/test_stripe_e2e.py` — 新建端到端测试

**测试方式**:
- 使用 Stripe test mode 完成一次完整升级流程
- 验证 webhook 正确更新 user_profiles.tier
- 验证 dashboard 显示 Pro 状态
- 使用 Stripe CLI 模拟 webhook: `stripe trigger checkout.session.completed`

**达成效果**: 用户可以从 free 升级到 pro，Stripe 回调正确更新账户状态。

---

### TASK-12: Stub 代码清理

**背景**: 由于使用并行 worktree 开发，多个 PR 中包含 `# STUB` 标记的临时代码。现在所有 task 已合并，应该清理这些 stub。

**目的**: 移除所有 `# STUB` 标记代码，确保模块间使用真实的依赖。

**涉及文件**:
- `backend/app/db/stub.py` — 评估是否还需要
- `backend/app/db/__init__.py` — 清理 stub 导入
- `backend/app/auth/__init__.py` — 清理 stub
- 所有包含 `# STUB` 注释的文件

**测试方式**:
- `grep -r "STUB" backend/` 结果为空
- `python -m pytest backend/tests/ -v` 全部通过
- `python -m compileall backend/app backend/tests` 无报错

**达成效果**: 代码库中没有临时 stub 代码，所有模块使用真实实现。

---

### TASK-13: Database 实际连接与数据持久化

**背景**: 当前 `backend/app/db/stub.py` 提供了内存 stub，很多服务在没有 DATABASE_URL 时使用 stub 数据。需要确保配置 Neon PostgreSQL 后所有数据正确持久化。

**目的**: 配置 Neon PostgreSQL，运行 migration，验证所有数据库操作使用真实连接。

**涉及文件**:
- `db/migrations/001_initial_schema.sql` — 验证并执行
- `backend/app/db/connection.py` — 验证连接池配置
- `scripts/run_migration.py` — 新建，migration 执行脚本
- `.env.example` — 确认 DATABASE_URL 格式

**测试方式**:
- 配置 DATABASE_URL 指向 Neon 实例
- 运行 migration 创建所有表
- 创建 API key，验证写入 api_keys 表
- 执行搜索，验证 query_logs 有记录
- `pytest backend/tests/ -v`

**达成效果**: 所有数据持久化到 Neon PostgreSQL，不再依赖内存 stub。

---

### TASK-14: 文档页面内容填充

**背景**: 前端 `/docs` 和 `/docs/[slug]` 路由已搭建，但内容可能还是 placeholder。需要填充真实的 API 文档内容。

**目的**: 将 API 参考文档、快速开始指南等内容填充到文档页面。

**涉及文件**:
- `frontend/app/docs/page.tsx` — 文档首页
- `frontend/app/docs/[slug]/page.tsx` — 文档子页面
- `docs/api-reference.md` — 如果存在则同步到前端

**测试方式**:
- 访问 `/docs` 看到文档首页
- 访问 `/docs/quickstart` 看到快速开始指南
- 访问 `/docs/api-reference` 看到完整 API 参考
- `pnpm --dir frontend build`

**达成效果**: 公开文档页面有真实的 API 文档内容，可被搜索引擎索引。

---

### TASK-15: Codex / Claude Skill 实现

**背景**: ARCHITECTURE.md Week 5-6 提到 "Installable Codex / Claude skill"。`skills/` 目录已存在但内容未知。

**目的**: 实现一个可安装的 AI agent skill，允许 Codex/Claude 通过 skill 直接调用 Cerul 搜索 API。

**涉及文件**:
- `skills/cerul-search/` — skill 定义和实现
- `skills/cerul-search/skill.json` — skill 元数据
- `skills/cerul-search/handler.py` — 搜索处理逻辑

**测试方式**:
- skill 安装后，agent 可以通过自然语言触发视频搜索
- 验证 skill 正确调用 `/v1/search` API
- 验证结果格式对 agent 友好

**达成效果**: AI agent 可以通过安装 Cerul skill 直接搜索视频内容。

---

### TASK-16: 前端 Pipelines 页面实现

**背景**: Dashboard 中 `/dashboard/pipelines` 页面目前是 placeholder。需要展示 pipeline 运行状态和处理进度。

**目的**: 实现 pipeline 监控页面，展示 processing_jobs 的运行状态。

**涉及文件**:
- `frontend/app/dashboard/pipelines/page.tsx` — 替换 placeholder
- `frontend/components/dashboard/pipelines-screen.tsx` — 完善组件
- `backend/app/routers/dashboard.py` — 添加 pipeline status endpoint（如果不存在）

**测试方式**:
- 访问 `/dashboard/pipelines` 看到 job 列表
- 显示每个 job 的状态（pending/running/completed/failed）
- 显示处理进度和错误信息
- `pnpm --dir frontend build`

**达成效果**: 用户可以在 dashboard 中监控 pipeline 运行状态。

---

### TASK-17: YouTube Metadata 抓取服务

**背景**: Knowledge pipeline 的第一步是获取 YouTube 视频元数据。需要一个独立的 YouTube API 客户端。

**目的**: 实现 YouTube Data API v3 客户端，支持按频道/播放列表批量获取视频元数据。

**涉及文件**:
- `workers/common/sources/youtube.py` — 新建
- `workers/tests/test_youtube_client.py` — 新建
- `.env.example` — 确认 YOUTUBE_API_KEY

**测试方式**:
- 给定一个 YouTube 频道 ID，返回视频列表
- 给定一个视频 ID，返回完整元数据（标题、描述、时长、发布日期）
- mock API 响应的单元测试
- `pytest workers/tests/test_youtube_client.py`

**达成效果**: 可以通过 YouTube API 批量获取视频元数据，为 knowledge pipeline 提供输入。

---

### TASK-18: 配置管理完善

**背景**: `config/` 目录存在但配置管理可能不完整。ARCHITECTURE.md 第 12 节详细描述了配置层级。

**目的**: 完善基于 YAML 的配置管理，支持环境变量 override。

**涉及文件**:
- `config/base.yaml` — 验证并补全
- `config/production.yaml` — 新建
- `backend/app/config.py` — 新建配置加载模块
- `backend/tests/test_config.py` — 新建

**测试方式**:
- 验证 base.yaml 包含所有配置项
- 验证环境变量可以 override YAML 值
- 验证 production.yaml 正确覆盖开发环境配置
- `pytest backend/tests/test_config.py`

**达成效果**: 统一的配置管理，支持 YAML + 环境变量分层配置。

---

## 推荐的执行优先级

### 第一优先级（解除 stub / 打通核心链路）
1. TASK-01: Gemini Embedding 2 替换 CLIP
2. TASK-06: Embedding 查询向量实时生成
3. TASK-12: Stub 代码清理
4. TASK-13: Database 实际连接

### 第二优先级（核心产品能力）
5. TASK-04: Knowledge 视频入库 Pipeline
6. TASK-17: YouTube Metadata 抓取
7. TASK-05: Knowledge 搜索后端完善
8. TASK-08: 扩大 B-roll 种子数据

### 第三优先级（用户体验与认证）
9. TASK-02: Better Auth 集成
10. TASK-03: 速率限制
11. TASK-09: Search Demo 页面
12. TASK-11: Stripe 端到端联调

### 第四优先级（自动化与生态）
13. TASK-07: Scheduler + processing_jobs
14. TASK-10: Pixabay 完整接入
15. TASK-14: 文档内容填充
16. TASK-15: Codex/Claude Skill
17. TASK-16: Pipelines 页面
18. TASK-18: 配置管理完善

---

## 任务依赖关系

```
TASK-01 (Gemini Embedding) ──┬──→ TASK-06 (查询向量生成)
                              ├──→ TASK-04 (Knowledge Pipeline)
                              └──→ TASK-08 (B-roll 扩量)

TASK-12 (Stub 清理) ─────────→ TASK-13 (DB 连接)

TASK-04 (Knowledge Pipeline) ─→ TASK-05 (Knowledge 搜索)
TASK-17 (YouTube Client) ─────→ TASK-04 (Knowledge Pipeline)

TASK-02 (Better Auth) ────────→ TASK-11 (Stripe 联调)
TASK-07 (Scheduler) ──────────→ TASK-16 (Pipelines 页面)
```

> 没有依赖关系的任务可以通过 worktree 并行执行。
