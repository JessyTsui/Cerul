# Dashboard UI/UX Cleanup

Codex 新增了多个 dashboard 组件用于 billing/credits/account 功能，但引入了以下问题：

1. **配色不统一**：`dashboard-account-hub.tsx`、`dashboard-top-account-controls.tsx`、`dashboard-billing-modal.tsx` 使用了深色/黑色渐变背景（`rgba(29,29,31)`、`rgba(23,20,17)`），与全站的 warm cream `soft-theme` 严重冲突
2. **功能重复散落**：billing/credits/upgrade 信息出现在 5+ 个不同位置（sidebar 底部、top-right 下拉、account center modal、billing modal、settings page）
3. **页面职责不清**：Settings 里有 billing，Usage 里有 billing，还有单独的 billing modal

---

## 目标

1. **所有组件统一使用 soft-theme 暖色调**，去掉所有深色渐变背景
2. **简化页面结构**，减少重复，每个功能只在一个地方出现
3. **克制设计**：不堆信息，用户需要时才展开细节

---

## 页面职责重新划分

### Dashboard 导航结构

```
侧边栏:
  Overview          ← 总览：API keys + 快速状态
  Usage             ← 用量 + credits 详情 + billing 管理（合并）
  Settings          ← 纯账户设置（profile、API keys 管理）
  ---
  Docs →
  API Reference →
  Pricing →
  ---
  [底部] 用户头像 + 名字 + 简短余额 (不要深色块，用一行文字即可)

顶栏右侧:
  [credits 余额小徽章] [用户头像下拉]
```

### 各页面内容

#### Overview（总览）
保持现有内容，简洁：
- API Keys 表格
- 当前 plan 卡片（plan 名称 + billing 周期 + included credits 进度条）
- 4 个 stat 卡片（Requests / Spendable / Included remaining / Active keys）
- Free searches today: X / 10

不需要 billing 操作按钮。用户想操作时去 Usage 页。

#### Usage（用量 + Billing，合并）
这个页面是 billing 的主阵地，把 settings 里的 billing 内容都搬过来：

**Section 1: Credit Balance**（现有 CreditBalancePanel）
- 总余额
- 分项：Included / Purchased / Bonus
- Free searches today: X / 10
- 进度条

**Section 2: Buy Credits**
- credits 数量选择器（min 1000, step 100, 预设 1000/2500/5000/10000）
- 总价显示
- "Buy credits" 按钮
- 仅在用户已登录时显示

**Section 3: Plan & Subscription**
- 当前 plan 显示（Free / Pro）
- Free 用户：显示 "Upgrade to Pro" 按钮（直接触发 Stripe checkout，不弹 modal）
- Pro 用户：显示 "Manage subscription" 按钮（打开 Stripe portal）

**Section 4: Auto-recharge**
- 开关 + threshold + quantity 设置
- 仅在有 stripe_customer_id 时显示

**Section 5: Usage Analytics**（现有）
- 日用量图表
- 每日明细表

#### Settings（纯账户设置）
只保留：
- Profile（名字、邮箱）
- API Keys 管理（创建、删除、列表）
- Referral code 兑换
- Admin bootstrap（如果适用）

**不放任何 billing/credits/upgrade 内容。**

---

## 组件处理

### 要删除的组件

| 组件 | 原因 |
|------|------|
| `dashboard-billing-modal.tsx` | 不再需要弹窗，billing 操作直接在 Usage 页内完成 |
| `dashboard-account-center-modal.tsx` | 过于复杂，功能已分散到 Usage 和 Settings 页 |
| `dashboard-overlay-dialog.tsx` | 如果上面两个 modal 都删了，这个基础组件也不需要了 |

### 要大幅简化的组件

| 组件 | 改动 |
|------|------|
| `dashboard-account-hub.tsx` | 去掉深色渐变。简化为一行：用户名 + plan badge + 简短余额数字。使用 `surface-elevated` 或透明背景，文字用 `var(--foreground-secondary)` |
| `dashboard-top-account-controls.tsx` | 去掉深色渐变 wallet 按钮。改为：简洁的 credits 数字 badge（如 `⚡ 4,200`）+ 用户头像。头像下拉菜单保留但统一浅色。点击 credits 数字跳转到 Usage 页 |
| `settings-screen.tsx` | 删除所有 billing 相关的 section（Plan、Buy Credits、Auto-recharge、Catalog）。只保留 Profile + API Keys + Referral + Admin |
| `usage-screen.tsx` | 加入 Buy Credits、Plan 管理、Auto-recharge 三个 section |

### 不需要改动的组件

| 组件 | 说明 |
|------|------|
| `credit-balance-panel.tsx` | 已有，样式正确，继续在 Usage 页使用 |
| `overview-screen.tsx` | 基本 OK，不动 |
| `dashboard-sidebar.tsx` | 侧边栏结构正确，只需简化底部 account hub |
| `dashboard-top-nav.tsx` | 结构正确，只需简化右侧 controls |
| `dashboard-app-shell.tsx` | 去掉 modal 层的引用 |

---

## 配色修复

所有组件禁止使用以下样式：

```
❌ bg-[linear-gradient(180deg,rgba(29,29,31,...),rgba(22,22,24,...))]
❌ bg-[linear-gradient(180deg,rgba(31,28,24,...),rgba(20,18,16,...))]
❌ bg-[linear-gradient(180deg,rgba(23,20,17,...),rgba(34,30,27,...))]
❌ text-white（配合深色背景使用时）
```

所有 dashboard 组件必须使用 `soft-theme` 下的 CSS 变量：

```
✅ bg-[var(--surface)]
✅ bg-[var(--background-elevated)]
✅ text-[var(--foreground)]
✅ text-[var(--foreground-secondary)]
✅ border-[var(--border)]
✅ 或者 surface-elevated class
```

---

## Sidebar 底部简化设计

**现在（深色大块）：**
```
┌─────────────────────────┐
│ ██████████████████████  │  ← 深色渐变背景
│ █ PLAN        Manage █  │
│ █ Pro                █  │
│ █                    █  │
│ █ 1/5000 credits     █  │
│ █ ████████░░░░░░░░░  █  │
│ █                    █  │
│ █ Spendable  4,200   █  │
│ █ PAYG       1,600   █  │
│ ██████████████████████  │
└─────────────────────────┘
```

**目标（轻量一行）：**
```
┌─────────────────────────┐
│ [Avatar] Jessy           │
│ Pro · ⚡ 4,200 credits   │
│ [Sign out]               │
└─────────────────────────┘
```

用 `text-[var(--foreground-secondary)]`，无背景色，用 `border-t border-[var(--border)]` 与上方导航分隔。

---

## Top-right 简化设计

**现在（深色按钮 + 下拉）：**
```
[████ Pro · ⚡ 4,200 ████]  [👤]
  ← 深色渐变按钮
```

**目标（轻量 badge）：**
```
⚡ 4,200  [👤 ▾]
```

- credits 数字用普通文字，点击跳转 `/dashboard/usage`
- 用户头像用 `[var(--foreground-secondary)]` 色调
- 下拉菜单：Account settings / Usage & billing / Sign out

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `dashboard-billing-modal.tsx` | Delete | Billing 操作移到 Usage 页 |
| `dashboard-account-center-modal.tsx` | Delete | 功能已拆分到 Usage 和 Settings |
| `dashboard-overlay-dialog.tsx` | Delete | Modal 基础组件不再需要 |
| `dashboard-account-hub.tsx` | Rewrite | 去掉深色渐变，简化为一行：avatar + name + plan + credits |
| `dashboard-top-account-controls.tsx` | Rewrite | 去掉深色按钮，改为轻量 credits badge + 头像下拉 |
| `dashboard-app-shell.tsx` | Modify | 移除 modal 层引用 |
| `dashboard-state.tsx` | Modify | 移除 modal state 如果有 |
| `usage-screen.tsx` | Modify | 加入 Buy Credits、Plan 管理、Auto-recharge sections（从 settings-screen 搬过来） |
| `settings-screen.tsx` | Simplify | 删除所有 billing/credits 内容，只保留 Profile + API Keys + Referral |
| `overview-screen.tsx` | Minor | 确认没有深色样式 |
| `dashboard-sidebar.tsx` | Minor | 确认 account hub 引用更新 |

---

## Design Constraints

- 所有背景必须使用 `soft-theme` CSS 变量，禁止硬编码深色 rgba
- 不使用 modal 弹窗做 billing 操作 — 直接在页面内完成
- "Buy Credits" 按钮直接跳 Stripe Checkout，不弹中间步骤 modal
- "Upgrade to Pro" 按钮直接跳 Stripe Checkout
- "Manage subscription" 按钮直接跳 Stripe Portal
- 每个信息只出现在一个位置，不重复显示
- 保持页面内容克制，不堆叠卡片

---

## Testing Checklist

- [ ] 全站无深色/黑色背景块，所有组件统一 warm cream 调
- [ ] Sidebar 底部是轻量 avatar + plan + credits 一行，无深色渐变
- [ ] Top-right 是轻量 credits badge + 用户头像，无深色按钮
- [ ] Usage 页包含：Credit Balance + Buy Credits + Plan 管理 + Auto-recharge + 图表
- [ ] Settings 页只有：Profile + API Keys + Referral
- [ ] "Buy Credits" 按钮直接触发 Stripe Checkout
- [ ] "Upgrade to Pro" 按钮直接触发 Stripe Checkout
- [ ] 删除 billing modal、account center modal、overlay dialog 三个文件
- [ ] Overview 页展示 Free searches today
- [ ] 页面切换流畅，无 modal 层残留
