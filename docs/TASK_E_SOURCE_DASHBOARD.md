# Task E: Source Progress Dashboard

> **Codex 任务** — 改进 Admin Ingestion 页面，展示每个频道的索引进度

---

## 目标

把 `/admin/ingestion` 页面的 "Source health" 表格改进为 "Source Progress" 面板，让管理员一眼看到每个频道的索引进度。

---

## 当前状态

`frontend/components/admin/ingestion-screen.tsx` 中已有 "Source health" 表格，显示 Source / Track / Backlog / Failed / Last job。数据来自 `data.sourceHealth`，已有 `jobsCreated`, `jobsCompleted`, `jobsFailed`, `backlog` 字段。

---

## 实现

### 修改 `frontend/components/admin/ingestion-screen.tsx`

把现有的 "Source health" `<article>` 替换为改进版，从占 xl:grid-cols-2 的一半改为**独占一整行**（放在 grid 上面），表格增加以下列：

| 列 | 数据来源 | 说明 |
|----|----------|------|
| Source | `source.displayName` | 频道名 |
| Type | `source.track` | unified/knowledge/broll |
| Completed | `source.jobsCompleted` | 已完成数量，绿色 |
| Running | 从 statusCounts 或用 `source.backlog` 减 pending | 正在跑的 |
| Pending | `source.backlog` | 排队中 |
| Failed | `source.jobsFailed` | 失败数量，红色 |
| Progress | 计算百分比 | 进度条：completed / (completed + backlog + failed) |
| Last Job | `source.lastJobAt` | 最后活动时间 |
| Status | `source.isActive` | 绿点/灰点 |

### 进度条设计

用一个简单的 CSS 进度条：

```tsx
function ProgressBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return <span className="text-[var(--foreground-tertiary)]">—</span>;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--foreground-secondary)]">{pct}%</span>
    </div>
  );
}
```

### 排序

按 completed 数量降序排列（完成最多的在最前面），和 `scripts/source-stats.sql` 一致。

### 汇总行

表格底部加一行汇总：

```
Total    —    156    3    42    8    —    —
```

显示所有频道的 completed/running/pending/failed 合计。

### "Recent failures" 保持不变

右边的 "Recent failures" 面板不改动，但因为 "Source Progress" 独占一行了，"Recent failures" 也改为独占一行，放在 Source Progress 下面。

---

## 布局变化

**之前：**
```
[Worker Live Panel]
[Video Library Panel]
[Metrics Cards: 3 cols]
[Source Health (half)] [Recent Failures (half)]
```

**之后：**
```
[Worker Live Panel]
[Video Library Panel]
[Metrics Cards: 3 cols]
[Source Progress (full width)]
[Recent Failures (full width)]
```

---

## 不需要改的

- 后端 API — `sourceHealth` 数据已经足够
- `admin-api.ts` — 类型已经包含 jobsCompleted/jobsCreated
- 不需要新的 API 端点

---

## 验证

```bash
pnpm --dir frontend build
```

启动后访问 `http://localhost:3000/admin/ingestion`，确认：
1. Source Progress 表格正确显示所有频道
2. 进度条百分比正确
3. 汇总行数据正确
4. Recent Failures 面板正常显示

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `frontend/components/admin/ingestion-screen.tsx` | 改进 Source health 为 Source Progress 面板 |
