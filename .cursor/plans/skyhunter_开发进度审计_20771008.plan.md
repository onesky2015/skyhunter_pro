---
name: SkyHunter 开发进度审计
overview: 基于对 backend/、frontend/、项目根目录的全面代码审查，核对当前开发进度，明确已实现/部分实现/未实现的功能清单，并按「上架 Apple/Android 商店 + Web SaaS 收费系统」目标制定剩余工作路线。
todos:
  - id: batch1-refresh-token
    content: "第一批: Refresh Token 机制 (后端双 token + 前端自动刷新)"
    status: completed
  - id: batch1-oauth
    content: "第一批: Apple Sign-In + Google Sign-In (后端 OAuth 验证 + 前端登录按钮)"
    status: completed
  - id: batch1-legal-pages
    content: "第一批: 隐私政策/服务条款前端页面 + 后端 API"
    status: completed
  - id: batch1-eas
    content: "第一批: EAS Build 配置 (eas.json + 证书 + 首次构建)"
    status: completed
  - id: batch1-push
    content: "第一批: 推送通知 (Firebase + expo-notifications)"
    status: completed
  - id: batch1-iap
    content: "第一批: Apple IAP + Google Play Billing 集成"
    status: completed
  - id: batch1-stripe
    content: "第一批: Stripe 支付 (Web 端积分充值)"
    status: completed
  - id: batch2-saas-landing
    content: "第二批: Next.js Web SaaS 落地页 + 定价页"
    status: completed
  - id: batch2-i18n
    content: "第二批: 国际化 i18n (中/英双语)"
    status: completed
  - id: batch2-email-template
    content: "第二批: 邮件 HTML 模板 (中文 + 多人价格)"
    status: completed
  - id: batch2-scheduler-safety
    content: "第二批: 余额不足自动暂停 + 连续无变化熔断"
    status: completed
  - id: batch2-sentry-loguru
    content: "第二批: Sentry 接入 + loguru 结构化日志"
    status: completed
  - id: batch3-alembic
    content: "第三批: Alembic 数据库迁移体系"
    status: completed
  - id: batch3-docker-deploy
    content: "第三批: Docker 配置 + 生产部署 (Railway/AWS + Vercel)"
    status: completed
  - id: batch3-store-submit
    content: "第三批: App Store / Play Store / Web SaaS 上线提交"
    status: completed
isProject: false
---

# SkyHunter Pro 开发进度审计与剩余工作计划

---

## 一、当前项目结构概览

```
SkyHunter_Pro/
├── backend/          # FastAPI 后端 (已模块化拆分)
│   ├── main.py       # ~146 行入口
│   ├── routers/      # users, flights, admin, admin_analytics
│   ├── services/     # billing, email, flight, geolocation, scheduler
│   ├── models/       # database.py (SQLModel)
│   ├── schemas/      # api_models.py (Pydantic)
│   ├── core/         # middleware, rate_limit, security
│   └── api/          # deps.py (认证依赖)
├── frontend/         # Expo + React Native + expo-router
│   ├── app/          # 路由页面 (tabs + auth)
│   ├── components/   # UI 组件 + admin/
│   ├── hooks/        # useAuth, useMonitors, useSearch
│   └── services/     # api.ts, storage.ts
├── docs/             # TERMS_OF_SERVICE.md, PRIVACY_POLICY.md
├── .github/workflows/ci.yml  # CI 配置
└── (大量 .md 文档)
```

---

## 二、功能完成度总览

### A. 已完成 (可直接复用)

**后端 - 22 项已完成:**

- 模块化架构拆分 (main.py 146行, routers/services/models 分离) -- Phase 0 目标已达成
- JWT 认证 (bcrypt + HS256)
- 用户注册/登录 + 邮箱验证 (6位验证码)
- 忘记密码 + 重置密码
- 修改密码 API (`POST /api/v1/auth/change-password`)
- 用户账户删除 API (`POST /api/v1/auth/delete-account`) -- 含关联数据清理
- API 版本化 (`/api/v1/`)
- 航班搜索 (Mock + SerpApi 双模式)
- 监控任务 CRUD (创建/编辑/删除/暂停/恢复)
- 软删除 + 回收站 + 恢复
- 积分计费系统 + 询价确认
- 交易流水记录 (credits_before/after)
- 数据隔离 (user_id)
- Admin 管理面板 + 分析面板 (7个分析维度, 数据导出)
- APScheduler 调度 (per-task 独立)
- 邮件通知 (Brevo/SMTP)
- 搜索缓存 (FlightCache)
- 限流保护 (IP + email)
- `excluded_airlines` 排除航司字段
- CORS 可配置 (从 .env 读取)
- Admin TOTP 二步验证
- 机场数据管理 (CRUD + CSV 导入)

**前端 - 12 项已完成:**

- 登录/注册/忘记密码/邮箱验证 全流程
- 搜索页 (含 30 天价格热力图)
- 监控列表页 (含创建/编辑/删除/暂停/恢复/回收站)
- 个人中心页 (积分余额/交易记录/修改密码/删除账户)
- Admin 管理面板 (仪表盘/分析/成本/安全)
- 高级搜索筛选 (往返/时间/航司/联盟/经停/舱位/人数)
- 修改密码 UI
- 账户删除 UI (含密码确认弹窗)
- Expo 三端支持 (iOS/Android/Web)
- 深色战术风格 UI
- app.json 配置 (bundleIdentifier/package 已设置)
- iOS `usesAppleSignIn: true` 能力声明

**基础设施 - 3 项已完成:**

- GitHub Actions CI (`ci.yml`)
- 环境变量模板 (`backend/.env.example`)
- 法律文档草稿 (`docs/TERMS_OF_SERVICE.md`, `docs/PRIVACY_POLICY.md`)

---

### B. 部分实现 (需补齐)


| 功能          | 当前状态                                                            | 缺失部分                           |
| ----------- | --------------------------------------------------------------- | ------------------------------ |
| 航空联盟筛选      | 前端 `AlliancePicker` 已有, 后端 Mock 数据有联盟字段                         | 后端未暴露为用户可配置的 API 筛选参数          |
| 价格历史展示      | 热力图 + 监控事件列表                                                    | 缺少价格走势折线图                      |
| 通知设置        | 监控内可设 notification_email                                        | 无独立通知偏好页, 无多渠道选择               |
| Sentry 错误追踪 | `sentry-sdk` 已在 requirements.txt, `.env.example` 有 `SENTRY_DSN` | main.py 未初始化 Sentry            |
| 数据库备份       | 机场 CSV 有本地备份, `db_sync.py` 支持同步                                 | 无定时全库自动备份                      |
| 测试          | test_api.py / test_email.py 脚本                                  | 非 pytest 框架, 无 tests/ 目录, 覆盖率低 |


---

### C. 完全未实现 (按上架优先级排序)

#### P0 - 商店上架硬性要求 (必须完成)


| 功能                      | 影响                      | 工作量估算                               |
| ----------------------- | ----------------------- | ----------------------------------- |
| **Apple Sign-In**       | App Store 强制要求          | 后端验证 + 前端按钮, 3-4天                   |
| **Google Sign-In**      | Play Store 强烈建议         | 后端验证 + 前端按钮, 2-3天                   |
| **Refresh Token 机制**    | 当前 72h 固定过期, 用户体验差      | 后端 + 前端自动刷新, 2天                     |
| **Apple IAP (应用内购买)**   | iOS 虚拟商品必须走 IAP         | 后端验证 + 前端购买流程, 5-7天                 |
| **Google Play Billing** | Android 虚拟商品必须走 Billing | 后端验证 + 前端购买流程, 3-5天                 |
| **Stripe 支付 (Web)**     | Web SaaS 收费             | 后端 Checkout + Webhook, 3-4天         |
| **隐私政策/服务条款页面**         | 双商店强制要求                 | 前端页面 + 后端 API (文档已有草稿), 1天          |
| **推送通知 (FCM)**          | 降价提醒核心体验                | Firebase + expo-notifications, 3-4天 |
| **EAS Build 配置**        | 构建 iOS/Android 安装包      | eas.json + 证书配置, 1-2天               |


#### P1 - SaaS 商业化必须


| 功能                 | 影响             | 工作量估算                    |
| ------------------ | -------------- | ------------------------ |
| **Web SaaS 落地页**   | SEO + 营销转化     | Next.js 落地页 + 定价页, 5-7天  |
| **国际化 (中/英)**      | 多语种用户群         | i18n 框架 + 文案翻译, 3-5天     |
| **Alembic 数据库迁移**  | 生产环境 schema 升级 | 初始化 + 迁移脚本, 2天           |
| **结构化日志 (loguru)** | 生产可观测性         | 替换 logging, 1天           |
| **Sentry 接入**      | 错误追踪           | main.py 初始化, 0.5天        |
| **Docker 配置**      | 标准化部署          | Dockerfile + compose, 1天 |


#### P2 - 体验增强


| 功能             | 影响        | 工作量估算                   |
| -------------- | --------- | ----------------------- |
| Telegram 通知    | 多渠道降价提醒   | 后端 Bot API + 前端绑定, 2-3天 |
| 余额不足自动暂停       | 避免无效调度    | scheduler.py 逻辑, 0.5天   |
| 连续无变化熔断        | 节约 API 额度 | scheduler.py 逻辑, 0.5天   |
| 价格历史折线图        | 趋势可视化     | 前端图表组件, 2天              |
| 深色/浅色主题切换      | 用户偏好      | 主题上下文 + 样式, 2-3天        |
| 状态管理 (Zustand) | 代码质量      | 重构 hooks, 3-4天          |
| 周报邮件           | 运营功能      | 定时任务 + 模板, 2天           |
| 邮件 HTML 模板     | 专业度       | templates/ + Jinja2, 2天 |
| 通知偏好页面         | 用户控制      | 独立设置页, 1-2天             |


---

## 三、与原计划 Phase 对照

### Phase 0: 后端架构重构 + 缺失功能补齐


| 原计划项            | 状态                                         |
| --------------- | ------------------------------------------ |
| main.py 模块化拆分   | **已完成** (146行入口 + routers/services/models) |
| 排除航司字段          | **已完成**                                    |
| 联盟筛选 (alliance) | **部分** (前端有, 后端未作为 API 参数)                 |
| 中文邮件模板          | **未完成**                                    |
| Telegram 通知     | **未完成**                                    |
| 修改密码 API        | **已完成**                                    |
| 预订链接追踪          | **已完成** (`/api/v1/track/{monitor_id}`)     |
| 熔断 + 自动暂停       | **未完成**                                    |
| 周报 + 备份         | **未完成**                                    |


**Phase 0 完成度: ~50%**

### Phase 1: 认证升级 + 支付集成


| 原计划项           | 状态                       |
| -------------- | ------------------------ |
| Refresh Token  | **未完成**                  |
| Apple Sign-In  | **未完成**                  |
| Google Sign-In | **未完成**                  |
| Stripe 支付      | **未完成**                  |
| Apple IAP      | **未完成**                  |
| Google Billing | **未完成**                  |
| 隐私政策/服务条款页面    | **部分** (文档有草稿, 无 API/页面) |
| 用户账户删除         | **已完成**                  |


**Phase 1 完成度: ~15%**

### Phase 2: 前端 UI 重构 + 商店适配


| 原计划项             | 状态                   |
| ---------------- | -------------------- |
| UI 重新设计 (HIG/MD) | **未完成** (当前为自定义战术风格) |
| Zustand 状态管理     | **未完成**              |
| OAuth 登录页面       | **未完成**              |
| IAP 充值页面         | **未完成**              |
| 高级筛选补齐           | **已完成**              |
| 通知设置页面           | **未完成**              |
| 价格历史走势图          | **部分**               |
| 国际化              | **未完成**              |
| 主题切换             | **未完成**              |


**Phase 2 完成度: ~15%**

### Phase 3: Web SaaS


| 原计划项            | 状态              |
| --------------- | --------------- |
| Next.js 落地页     | **未完成**         |
| 定价页             | **未完成**         |
| Stripe Checkout | **未完成**         |
| Admin Portal 增强 | **部分** (已有分析面板) |


**Phase 3 完成度: ~10%**

### Phase 4: 生产化 + 上架


| 原计划项          | 状态              |
| ------------- | --------------- |
| Alembic       | **未完成**         |
| CI/CD         | **已完成** (基础 CI) |
| loguru        | **未完成**         |
| Sentry        | **部分** (依赖已装)   |
| 生产部署          | **未完成**         |
| App Store 提交  | **未完成**         |
| Play Store 提交 | **未完成**         |


**Phase 4 完成度: ~10%**

---

## 四、总体进度评估

```
Phase 0 ████████░░░░░░░░ ~50%
Phase 1 ██░░░░░░░░░░░░░░ ~15%
Phase 2 ██░░░░░░░░░░░░░░ ~15%
Phase 3 █░░░░░░░░░░░░░░░ ~10%
Phase 4 █░░░░░░░░░░░░░░░ ~10%
─────────────────────────
总体   ███░░░░░░░░░░░░░ ~20%
```

---

## 五、建议执行顺序 (按上架目标优化)

以下是调整后的执行顺序，将商店上架硬性要求前置：

### 第一批: 商店上架阻塞项 (预计 3-4 周)

1. **Refresh Token 机制** -- 后端 + 前端自动刷新
2. **Apple Sign-In + Google Sign-In** -- 后端 OAuth 验证 + 前端登录按钮
3. **隐私政策/服务条款页面** -- 前端路由 + 后端 API (利用现有 docs/ 草稿)
4. **EAS Build 配置** -- eas.json + 证书 + 首次构建测试
5. **推送通知 (FCM + expo-notifications)** -- 降价提醒原生推送
6. **Apple IAP + Google Play Billing** -- 积分充值走平台内购
7. **Stripe 支付** -- Web 端积分充值

### 第二批: SaaS 商业化 + 体验 (预计 3-4 周)

1. **Web SaaS 落地页** -- Next.js 落地页 + 定价页 + Stripe Checkout
2. **国际化 (中/英)** -- i18n 框架接入
3. **邮件 HTML 模板** -- 中文模板 + 多人价格对比
4. **余额不足自动暂停 + 熔断** -- scheduler.py 逻辑
5. **Sentry 接入** -- main.py 初始化
6. **loguru 日志** -- 替换 logging

### 第三批: 生产化部署 + 提交 (预计 2-3 周)

1. **Alembic 数据库迁移** -- 初始化 + 生产 schema 管理
2. **Docker 配置** -- Dockerfile + docker-compose
3. **生产部署** -- Railway/AWS + Vercel + CDN
4. **App Store / Play Store 提交** -- 截图/描述/审核材料
5. **Web SaaS 域名上线**

### 可延后 (上架后迭代)

- Telegram 通知
- 价格历史折线图
- 深色/浅色主题切换
- Zustand 状态管理重构
- 周报邮件
- 联盟筛选 API 参数化
- 通知偏好页面
- pytest 完整测试套件

