---
name: SkyHunter 全面重构计划
overview: 基于旧版 SkyHunter (Streamlit + FastAPI 单体) 与当前 Pro 拆分版 (Expo + FastAPI) 的全面功能对比，制定以上架 Apple App Store、Google Play Store 和 Web SaaS 为最终目标的分阶段重构方案。
todos:
  - id: phase0-backend-split
    content: "Phase 0: 后端 main.py 模块化拆分 (routers/services/models)"
    status: pending
  - id: phase0-missing-features
    content: "Phase 0: 补齐旧版缺失功能 (排除航司/联盟/Telegram/中文邮件/周报/熔断)"
    status: pending
  - id: phase0-email-template
    content: "Phase 0: 重写邮件模板 (中文/多人价格/航司信息，参考用户截图)"
    status: pending
  - id: phase1-refresh-token
    content: "Phase 1: Refresh Token + Token 刷新机制"
    status: pending
  - id: phase1-oauth
    content: "Phase 1: Apple Sign-In + Google Sign-In OAuth2 集成"
    status: pending
  - id: phase1-payment
    content: "Phase 1: Stripe + Apple IAP + Google Billing 支付集成"
    status: pending
  - id: phase1-privacy
    content: "Phase 1: 隐私政策/服务条款/用户数据删除"
    status: pending
  - id: phase2-ui-redesign
    content: "Phase 2: 前端 UI 重构 (HIG/Material Design 适配)"
    status: pending
  - id: phase2-advanced-filters
    content: "Phase 2: 搜索/监控高级筛选补齐 (往返/时间/航司/联盟)"
    status: pending
  - id: phase2-i18n
    content: "Phase 2: 国际化 (中英双语) + 主题切换"
    status: pending
  - id: phase3-web-saas
    content: "Phase 3: Web SaaS 落地页 + 定价页 (Next.js)"
    status: pending
  - id: phase4-production
    content: "Phase 4: 生产化 (Alembic/CI-CD/Sentry/loguru) + 上架提交"
    status: pending
isProject: false
---

# SkyHunter Pro 全面重构计划

## 一、当前架构状态总结

**旧版 (v1.4.5)**: Streamlit 3700 行单文件前端 + FastAPI 后端，部署在 Hugging Face Spaces，使用 Argon2 + X-User-Id 认证，Admin/Agent 双角色 B2B2C 模型。

**Pro 拆分版 (v3.3.0)**: Expo + React Native + react-native-web 前端 + FastAPI 单文件后端 (`main.py` ~3163 行)，JWT + bcrypt 认证，user/admin/agent 角色系统，支持 iOS/Android/Web 三端。

---

## 二、功能对比矩阵 (旧版 vs Pro 版 vs 上架目标)

### A. 已在 Pro 版实现 (可复用)


| 功能                      | Pro 版状态 | 说明                               |
| ----------------------- | ------- | -------------------------------- |
| JWT 认证 (bcrypt + HS256) | 已实现     | 替代旧版 X-User-Id，安全性大幅提升           |
| 用户注册/登录                 | 已实现     | 自建 email+password，含 401 自动登出     |
| 忘记密码 (验证码)              | 已实现     | 6位验证码 + 邮件发送                     |
| API 版本化 (/api/v1/)      | 已实现     | 旧版无版本化                           |
| 航班搜索 (热力图)              | 已实现     | 30天热力图，Mock/SerpApi 双模式          |
| 监控任务 CRUD               | 已实现     | 创建/编辑/删除/暂停/恢复/归档                |
| 软删除 + 回收站               | 已实现     | 旧版无此功能，Pro 版新增                   |
| 积分计费系统                  | 已实现     | 搜索 1/5 积分，监控按频率动态计费              |
| 交易流水记录                  | 已实现     | 完整 credits_before/after 审计       |
| 数据隔离 (user_id)          | 已实现     | 所有查询按当前用户过滤                      |
| Admin 管理面板              | 已实现     | 统计/用户管理/积分调整/删除用户                |
| APScheduler 调度          | 已实现     | 5分钟心跳，per-task 独立调度              |
| 邮件通知 (Brevo/SMTP)       | 已实现     | 降价提醒 + 密码重置                      |
| 搜索缓存 (FlightCache)      | 已实现     | 按 origin+destination+date 缓存     |
| 询价确认流程                  | 已实现     | 搜索/创建监控前先询价确认                    |
| 前端三端支持                  | 已实现     | iOS/Android/Web 通过 Expo + RN Web |
| 限流保护                    | 已实现     | 登录/忘记密码/重置密码有 IP+email 限流        |


### B. 旧版有但 Pro 版缺失 (需补齐)


| 功能                                 | 旧版状态    | Pro 版状态        | 优先级 |
| ---------------------------------- | ------- | -------------- | --- |
| **邮件 HTML 中文模板 (多人价格)**            | 有精美中文邮件 | 英文简易模板，无多人价格对比 | P0  |
| **排除航司 (excluded_airlines)**       | 已实现     | 后端无此字段         | P0  |
| **航空联盟筛选 (Star/SkyTeam/OneWorld)** | 已实现     | 后端无联盟字段        | P1  |
| **Telegram 通知**                    | 已实现     | 完全缺失           | P1  |
| **Admin 充值/进货/分销 (B2B)**           | 已实现     | 仅有 admin 积分调整  | P1  |
| **修改密码 (已登录状态)**                   | 已实现     | 仅有忘记密码流程       | P1  |
| **预订链接点击追踪**                       | 已实现     | 缺失             | P2  |
| **数据库每日备份邮件**                      | 已实现     | 缺失             | P2  |
| **每周运营周报**                         | 已实现     | 缺失             | P2  |
| **连续无变化熔断**                        | 已实现     | 缺失             | P2  |
| **余额不足自动暂停**                       | 已实现     | 缺失             | P2  |
| **手动触发查价**                         | 已实现     | 缺失             | P2  |
| **Google Flights 深度链接**            | 已实现     | 缺失             | P2  |
| Agent 客户层级 (Standard/VIP/Agency)   | 已实现     | 缺失             | P3  |
| 时间窗口显示 (起飞/降落筛选展示)                 | 已实现     | 后端支持但前端部分缺失    | P1  |


### C. 上架商店必须新增 (两版均无)


| 功能                               | 重要性   | 说明                             |
| -------------------------------- | ----- | ------------------------------ |
| **OAuth2 社交登录 (Apple + Google)** | P0 必须 | Apple Store 强制要求 Apple Sign-In |
| **IAP 应用内购买 (Apple + Google)**   | P0 必须 | 虚拟商品必须走平台支付                    |
| **Stripe 支付 (Web 端)**            | P0 必须 | Web 端积分充值                      |
| **Refresh Token 机制**             | P0 必须 | 当前仅有 access_token，无刷新机制        |
| **推送通知 (APNs + FCM)**            | P0 必须 | 降价提醒需要原生推送                     |
| **隐私政策 / 服务条款页面**                | P0 必须 | 双商店强制要求                        |
| **用户数据删除功能**                     | P0 必须 | GDPR + 商店要求                    |
| **API 分页 + 排序**                  | P1 重要 | 数据量增长后必须                       |
| **CORS 安全配置**                    | P1 重要 | 当前 `allow_origins=["*"]` 不安全   |
| **速率限制 (全局)**                    | P1 重要 | 防滥用                            |
| **结构化日志 (loguru)**               | P1 重要 | 替代 print，生产级可观测性               |
| **CI/CD Pipeline**               | P1 重要 | GitHub Actions 自动构建测试          |
| **Web SaaS 落地页**                 | P1 重要 | SEO 友好的营销页面                    |
| **国际化 (中/英双语)**                  | P1 重要 | 面向多语种用户                        |
| **错误码标准化**                       | P1 重要 | 统一 JSON 错误格式                   |
| **WebSocket 实时更新**               | P2 可选 | 价格变动实时推送                       |
| **Redis 缓存层**                    | P2 可选 | 替代数据库缓存表                       |
| **Celery 替代 APScheduler**        | P2 可选 | 支持水平扩展                         |


### D. 架构层面问题 (必须解决)


| 问题                     | 影响        | 解决方案                               |
| ---------------------- | --------- | ---------------------------------- |
| 后端 `main.py` 3163 行单文件 | 不可维护，无法协作 | 拆分为 routers + services + models 模块 |
| 无 Alembic 数据库迁移        | 生产环境升级困难  | 引入 Alembic 管理 schema 变更            |
| 前端缺少状态管理框架             | 复杂页面状态混乱  | 引入 Zustand 或 TanStack Query        |
| 无自动化测试                 | 质量无保障     | pytest (后端) + Jest (前端)            |
| 前端 UI 粗糙               | 商店审核可能被拒  | 重新设计 UI，符合 HIG/Material Design     |


---

## 三、分阶段实施路线图

### Phase 0: 后端架构重构 + 缺失功能补齐 (2-3 周)

**目标**: 将单文件后端拆分为模块化架构，补齐旧版已有但 Pro 版缺失的功能

**后端模块化拆分** (从 `main.py` 3163 行拆分):

```
backend/
  app/
    __init__.py
    main.py              # FastAPI app 实例 + 启动逻辑 (~50 行)
    config.py             # 环境变量配置
    database.py           # 数据库连接
    dependencies.py       # 通用依赖 (get_current_user 等)
    models/
      __init__.py
      user.py             # User ORM
      monitor.py          # MonitorTask ORM
      cache.py            # FlightCache ORM
      history.py          # PriceHistory ORM
      transaction.py      # TransactionHistory ORM
      schemas.py          # Pydantic 请求/响应模型
    routers/
      __init__.py
      auth.py             # /api/v1/auth/*
      users.py            # /api/v1/users/*
      search.py           # /api/v1/search
      monitors.py         # /api/v1/monitors/*
      admin.py            # /api/v1/admin/*
    services/
      __init__.py
      auth_service.py     # 认证逻辑
      flight_engine.py    # 航班搜索引擎
      notification.py     # 邮件 + Telegram + 推送
      scheduler.py        # 调度器
      billing.py          # 计费逻辑
      report.py           # 周报生成
    templates/
      alert_email.html    # 降价提醒邮件模板
      reset_email.html    # 密码重置邮件模板
      weekly_report.html  # 周报模板
```

**补齐旧版功能**:

- 排除航司字段 (excluded_airlines) + 联盟筛选 (alliance)
- 中文邮件模板 + 多人价格对比显示 (参考用户提供的截图)
- Telegram 通知渠道
- 修改密码 API (已登录状态)
- 预订链接追踪
- 连续无变化熔断 + 余额不足自动暂停
- 数据库备份 + 周报

### Phase 1: 认证系统升级 + 支付集成 (2-3 周)

**目标**: 满足商店上架的认证和支付硬性要求

- Refresh Token 机制 (access_token 30min + refresh_token 30天)
- Apple Sign-In (后端验证 Apple ID Token)
- Google Sign-In (后端验证 Google ID Token)
- Stripe 支付 (Web 端积分充值)
- Apple IAP 服务端验证
- Google Play Billing 服务端验证
- 隐私政策 + 服务条款页面
- 用户账户删除 API

### Phase 2: 前端 UI 重构 + 商店适配 (3-4 周)

**目标**: 前端达到商店审核标准

- UI 重新设计 (符合 Apple HIG + Material Design)
- 引入 Zustand 状态管理
- OAuth 登录页面 (Apple + Google 按钮)
- IAP 充值页面
- 补齐搜索页高级筛选 (往返/时间/航司/联盟/经停/策略)
- 编辑监控补齐时间/航司字段
- 通知设置页面 (邮件/Telegram/推送偏好)
- 价格历史走势图 (Recharts/Victory)
- 国际化 (中/英双语)
- 深色/浅色主题

### Phase 3: Web SaaS 独立站 (3-4 周)

**目标**: 建设 Web 端 SaaS 营销 + 功能站

- 方案 A (推荐): 复用 Expo Web，添加 Next.js 落地页
- 方案 B: 纯 Next.js 重写 Web 端
- 落地页 + 定价页 (SEO 友好)
- Stripe Checkout 集成
- Admin Portal (Web 专用增强版)
- OpenAPI 文档页

### Phase 4: 生产化 + 上架 (2-3 周)

- Alembic 数据库迁移体系
- CI/CD (GitHub Actions)
- 结构化日志 (loguru)
- Sentry 错误追踪
- 生产环境部署 (Railway / AWS ECS)
- HTTPS + CDN 配置
- Apple App Store 提交 (截图/描述/审核)
- Google Play Store 提交
- Web SaaS 域名上线

---

## 四、关键技术决策

- **前端框架**: 保留 Expo + React Native (已支持三端)，不需要 Flutter 重写
- **Web SaaS**: Expo Web 作为 App 功能页 + Next.js 作为落地页/SEO 页面
- **状态管理**: Zustand (轻量) + TanStack Query (API 缓存)
- **支付**: Stripe (Web) + Apple IAP (iOS) + Google Billing (Android)
- **推送**: Firebase Cloud Messaging (统一 iOS + Android)
- **数据库迁移**: Alembic
- **日志**: loguru
- **部署**: Railway (后端) + Vercel (Web 前端) + EAS Build (App)

