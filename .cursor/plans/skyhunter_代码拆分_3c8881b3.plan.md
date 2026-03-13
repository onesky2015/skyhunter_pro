---
name: SkyHunter 代码拆分
overview: 前端已按 Expo Router 拆分为多文件，但存在若干超大组件（如 CreateMonitorModal 1063 行）；后端 main.py 约 3323 行单文件，需拆分为多模块。本计划将两者都纳入拆分范围。
todos: []
isProject: false
---

# SkyHunter Pro 代码拆分计划

## 当前状态

### 前端（已部分拆分）

项目使用 **Expo Router** 文件路由，**不存在** 单一 App.tsx 5300 行的情况。入口为 `index.ts` → `expo-router/entry`，布局在 `app/_layout.tsx`（25 行）。


| 文件                                                                   | 行数   | 说明            |
| -------------------------------------------------------------------- | ---- | ------------- |
| [CreateMonitorModal.tsx](frontend/components/CreateMonitorModal.tsx) | 1063 | 最大单文件，表单字段多   |
| [search.tsx](frontend/app/(tabs)/search.tsx)                         | 633  | 搜索页，状态与 UI 混杂 |
| [MonitorCard.tsx](frontend/components/MonitorCard.tsx)               | 480  | 监控卡片          |
| [EditMonitorModal.tsx](frontend/components/EditMonitorModal.tsx)     | 449  | 编辑弹窗          |
| [AdminPanel.tsx](frontend/components/AdminPanel.tsx)                 | 430  | 管理面板          |
| [monitors.tsx](frontend/app/(tabs)/monitors.tsx)                     | 412  | 监控列表页         |


### 后端（单文件）

[main.py](backend/main.py) 约 3323 行，包含：

- 配置、限流、JWT 认证
- 5 个 ORM 模型 + 20+ Pydantic 模型
- SerpApi 搜索、Mock 热力图、邮件、调度器
- 20+ 路由（auth、search、monitors、admin）

---

## 拆分方案

### 一、后端 main.py 拆分

目标：将 `main.py` 拆成多模块，保持 `main.py` 仅负责组装与启动。

```
backend/
├── main.py              # 入口，组装 app（约 80 行）
├── config.py            # 环境变量、CORS、DB 配置
├── models/
│   ├── __init__.py      # 导出 User, MonitorTask, FlightCache, PriceHistory, ...
│   └── user.py          # User, PasswordReset, TransactionHistory
│   └── monitor.py       # MonitorTask
│   └── cache.py         # FlightCache, PriceHistory
├── schemas/
│   ├── __init__.py
│   ├── auth.py          # SignupRequest, TokenResponse, UserResponse, ...
│   ├── search.py        # SearchRequest, SearchResponse, HeatmapCell, ...
│   └── monitor.py       # MonitorCreateRequest, MonitorResponse, ...
├── routers/
│   ├── __init__.py
│   ├── auth.py          # signup, login, forgot, reset, change-password, topup
│   ├── search.py        # POST /search, POST /quote/search
│   ├── monitors.py      # CRUD, trash, restore, status, history
│   ├── admin.py         # stats, users, monitors, delete, adjust credits
│   └── track.py         # GET /track/{id}
├── services/
│   ├── __init__.py
│   ├── auth.py          # hash_password, verify_password, create_access_token, get_current_user
│   ├── serpapi.py       # _search_serpapi_single_day, _search_range, mock 热力图
│   ├── email.py         # send_alert_email, send_reset_code_email
│   └── scheduler.py     # _process_active_monitors, start/stop_scheduler
└── db.py                # engine, get_session, SQLite 初始化
```

**依赖关系**：`routers` 依赖 `schemas`、`services`、`models`；`services` 依赖 `models`、`config`；`main.py` 只 import 并挂载 routers。

**注意**：`_process_active_monitors` 与搜索、邮件强耦合，可保留在 `services/scheduler.py` 中，通过 import `serpapi`、`email` 调用。

---

### 二、前端大文件拆分

#### 1. CreateMonitorModal.tsx（1063 行）

按表单区块拆分为子组件，主 Modal 只负责布局与提交：

```
components/
├── CreateMonitorModal.tsx       # 主 Modal 壳（约 150 行）
├── CreateMonitorForm/
│   ├── index.tsx                # 导出主表单
│   ├── BasicFields.tsx          # 出发/到达/日期/舱位/人数
│   ├── AdvancedFiltersSection.tsx  # 经停/时间/航司/联盟/排除航司
│   ├── FrequencyDurationSection.tsx # 频率、时长、计费展示
│   └── TargetPriceSection.tsx   # 目标价、邮箱
```

`AdvancedFiltersSection` 可与 [AdvancedFilters.tsx](frontend/components/AdvancedFilters.tsx) 复用或抽取共享逻辑。

#### 2. search.tsx（633 行）

- 抽取 `SearchFormSection`：出发/到达、日期、往返、人数、舱位等表单 UI
- 抽取 `SearchResultSection`：热力图 + 结果列表 + 创建监控入口
- 主页面只负责状态聚合与 `confirmAndSearch` 调用

#### 3. EditMonitorModal.tsx（449 行）

与 CreateMonitorModal 结构类似，可复用 `BasicFields`、`AdvancedFiltersSection`、`FrequencyDurationSection` 等，通过 props 区分创建/编辑模式。

#### 4. MonitorCard.tsx（480 行）

- 抽取 `MonitorCardHeader`、`MonitorCardBody`、`MonitorCardActions`
- 或按展示区块拆为 `MonitorCardInfo`、`MonitorCardPriceHistory`、`MonitorCardButtons`

---

## 实施顺序

1. **后端拆分**（优先，影响面集中）
  - 创建 `config.py`、`db.py`，迁移配置与数据库
  - 创建 `models/`，迁移 ORM
  - 创建 `schemas/`，迁移 Pydantic
  - 创建 `services/`，迁移 auth、serpapi、email、scheduler
  - 创建 `routers/`，迁移路由
  - 精简 `main.py` 为组装入口
  - 验证 `python main.py` 与现有 API 行为一致
2. **前端 CreateMonitorModal 拆分**
  - 新建 `CreateMonitorForm/` 子组件
  - 主 Modal 引用子组件，逐步替换内联 JSX
  - 确保 CreateMonitorModal 对外接口不变（props、MonitorPrefillData）
3. **前端 search.tsx 拆分**
  - 抽取 SearchFormSection、SearchResultSection
  - 保持 useSearch、useMonitors 调用不变
4. **前端 EditMonitorModal / MonitorCard 拆分**（可选，按需进行）

---

## 风险与注意事项

- **后端**：`_process_active_monitors` 依赖 Session、SerpApi、邮件、MonitorTask，需确保 `services/scheduler.py` 能正确 import 并调用，避免循环依赖。
- **前端**：CreateMonitorModal 与 EditMonitorModal 共享表单项时，需统一 `MonitorPrefillData` 与 `MonitorCreatePayload` 的字段映射，避免重复逻辑。
- **契约**：拆分不改变 API 与数据类型，`manifests/system_manifest.json` 保持不变。
- **测试**：每完成一个模块迁移，运行后端 `python main.py` 与前端 `npx expo start --web` 做冒烟验证。

