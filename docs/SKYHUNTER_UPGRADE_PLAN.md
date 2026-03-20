# SkyHunter Pro 升级计划与完成度基准

**文档版本**: v1.0  
**基准日期**: 2026-03-18  
**用途**: 作为后续开发对比、完成度审计及升级迭代的基础指导文件

---

## 一、项目目标

- **上架 Apple App Store 和 Google Play Store**
- **Web 端作为 SaaS 网站运营，具备收费能力**
- **三端（iOS / Android / Web）共享核心功能**

---

## 二、当前完成度基准（截至 2026-03-18）

### 2.1 总体进度

| Phase | 原计划范围 | 完成度 | 说明 |
|-------|-----------|--------|------|
| Phase 0 | 后端架构重构 + 缺失功能补齐 | ~85% | 模块化、排除航司、熔断、邮件模板等 |
| Phase 1 | 认证升级 + 支付集成 | ~90% | Refresh Token、OAuth、IAP、Stripe 代码完成 |
| Phase 2 | 前端 UI 重构 + 商店适配 | ~70% | OAuth 按钮、法律页、购买页、i18n 框架 |
| Phase 3 | Web SaaS | ~80% | Next.js 落地页 + 定价页 |
| Phase 4 | 生产化 + 上架 | ~75% | Alembic、Docker、EAS、Sentry、提交指南 |

**整体完成度**: 约 **75–80%**

---

### 2.2 已实现功能清单

#### 后端 (backend/)

| 功能 | 文件/位置 | 状态 |
|------|----------|------|
| 模块化架构 | main.py, routers/, services/, models/ | ✅ |
| JWT 认证 | core/security.py, api/deps.py | ✅ |
| Refresh Token 双 token | core/security.py, routers/users.py, models/database.py (RefreshToken) | ✅ |
| Apple/Google OAuth | routers/oauth.py | ✅ |
| 用户注册/登录/邮箱验证/忘记密码/修改密码/删除账户 | routers/users.py | ✅ |
| 法律文档 API | routers/legal.py | ✅ |
| 推送 Token 注册 | routers/users.py (RegisterPushTokenRequest) | ✅ |
| 支付：商品列表、Apple IAP、Google Play、Stripe Checkout + Webhook | routers/payments.py | ✅ |
| 航班搜索 (Mock + SerpApi) | services/flight.py, routers/flights.py | ✅ |
| 监控任务 CRUD + 调度 | services/scheduler.py, routers/flights.py | ✅ |
| 积分计费 + 交易流水 | services/billing.py | ✅ |
| 邮件通知 (Brevo/SMTP) | services/email.py | ✅ |
| 推送通知发送 | services/push.py | ✅ |
| 余额不足自动暂停 + 连续无变化熔断 | services/scheduler.py | ✅ |
| Admin 管理 + 分析 | routers/admin.py, admin_analytics.py | ✅ |
| loguru 日志 | config.py | ✅ |
| Sentry 初始化 | main.py | ✅ |
| Alembic 配置 | alembic.ini, alembic/env.py | ✅ |
| Docker 配置 | Dockerfile, .dockerignore | ✅ |

#### 前端 (frontend/)

| 功能 | 文件/位置 | 状态 |
|------|----------|------|
| 登录/注册/忘记密码/邮箱验证 | app/auth/*.tsx | ✅ |
| Refresh Token 自动刷新 | services/api.ts, hooks/useAuth.ts | ✅ |
| Apple/Google 登录按钮 | app/auth/login.tsx | ✅ |
| 法律文档页面 | app/legal.tsx | ✅ |
| 推送通知注册 | hooks/usePushNotifications.ts | ✅ |
| 积分购买页面 | app/purchase.tsx | ✅ |
| 搜索页 + 热力图 | app/(tabs)/search.tsx | ✅ |
| 监控列表 + 回收站 | app/(tabs)/monitors.tsx | ✅ |
| 个人中心 | app/(tabs)/profile.tsx | ✅ |
| Admin 面板 | components/admin/* | ✅ |
| 高级筛选 | components/AdvancedFilters.tsx | ✅ |
| EAS Build 配置 | eas.json, app.json | ✅ |
| i18n 框架 | i18n/en.ts, i18n/zh.ts, i18n/index.ts | ✅ |

#### Web SaaS (web/)

| 功能 | 文件/位置 | 状态 |
|------|----------|------|
| 落地页 | app/page.tsx | ✅ |
| 定价页 | app/pricing/page.tsx | ✅ |
| Next.js + Tailwind | app/layout.tsx, globals.css | ✅ |
| Docker 配置 | Dockerfile | ✅ |

#### 基础设施

| 功能 | 文件/位置 | 状态 |
|------|----------|------|
| GitHub Actions CI | .github/workflows/ci.yml | ✅ |
| Docker Compose | docker-compose.yml | ✅ |
| Railway 配置 | backend/railway.json | ✅ |
| 环境变量模板 | backend/.env.example | ✅ |
| 商店提交指南 | docs/STORE_SUBMISSION_GUIDE.md | ✅ |
| 功能验证指南 | docs/VERIFICATION_GUIDE.md | ✅ |

---

### 2.3 部分实现 / 待配置项

| 功能 | 当前状态 | 待完成 |
|------|----------|--------|
| Apple Sign-In | 后端验证 + 前端按钮 | Apple Developer 配置 + 真机测试 |
| Google Sign-In | 后端验证 + 前端按钮 | Google OAuth Client ID 配置 |
| Apple IAP | 后端验证 API | App Store Connect 产品创建 |
| Google Play Billing | 后端验证 API | Play Console 商品 + Service Account |
| Stripe | Checkout + Webhook 代码 | Stripe 密钥 + Price ID + Webhook 配置 |
| Sentry | main.py 初始化 | SENTRY_DSN 配置 |
| EAS Build | eas.json 配置 | EAS Project ID + Apple Team ID |
| 推送通知 | Expo Push 代码 | 真机测试 + Firebase (Android) |
| i18n | 翻译文件 + useI18n hook | 各页面接入 t() 替换硬编码 |
| Alembic | 配置完成 | 生成首次迁移并执行 |

---

### 2.4 完全未实现（可延后）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| Telegram 通知 | 低 | 后端 Bot API + 前端绑定 |
| 价格历史折线图 | 低 | 前端图表组件 |
| 深色/浅色主题切换 | 低 | 主题上下文 |
| Zustand 状态管理 | 低 | 重构 hooks |
| 周报邮件 | 低 | 定时任务 + 模板 |
| 联盟筛选 API 参数化 | 低 | 后端 alliance 参数 |
| 通知偏好页面 | 低 | 独立设置页 |
| pytest 完整测试套件 | 中 | tests/ + 覆盖率 |

---

## 三、关键文件路径速查

```
SkyHunter_Pro/
├── backend/
│   ├── main.py                 # 入口 + Sentry 初始化
│   ├── config.py               # 配置 + loguru
│   ├── core/security.py        # JWT + Refresh Token + issue_token_pair
│   ├── api/deps.py             # get_current_user
│   ├── models/database.py      # User, RefreshToken, PushToken, MonitorTask...
│   ├── routers/
│   │   ├── users.py            # 认证 + push-token
│   │   ├── oauth.py            # Apple/Google OAuth
│   │   ├── legal.py            # 法律文档 API
│   │   ├── payments.py         # IAP + Stripe
│   │   ├── flights.py          # 搜索 + 监控
│   │   ├── admin.py
│   │   └── admin_analytics.py
│   ├── services/
│   │   ├── scheduler.py        # 调度 + 熔断 + 余额暂停
│   │   ├── email.py            # 邮件
│   │   ├── push.py             # 推送
│   │   └── billing.py
│   ├── templates/              # 邮件 HTML 模板
│   ├── alembic/                # 数据库迁移
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── auth/login.tsx      # OAuth 按钮
│   │   ├── legal.tsx           # 法律页面
│   │   ├── purchase.tsx        # 购买页面
│   │   └── (tabs)/             # 主 Tab 页面
│   ├── services/api.ts         # apiRequest 自动刷新
│   ├── hooks/useAuth.ts        # 认证 + oauthLogin
│   ├── hooks/usePushNotifications.ts
│   ├── i18n/                   # 中英翻译
│   ├── eas.json
│   └── app.json
├── web/                        # Next.js SaaS
│   ├── app/page.tsx            # 落地页
│   └── app/pricing/page.tsx    # 定价页
├── docs/
│   ├── STORE_SUBMISSION_GUIDE.md
│   ├── VERIFICATION_GUIDE.md
│   └── SKYHUNTER_UPGRADE_PLAN.md  # 本文件
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## 四、环境变量关键项

| 变量 | 用途 |
|------|------|
| `JWT_SECRET_KEY` | 必填 |
| `JWT_EXPIRE_HOURS` | 默认 1 |
| `JWT_REFRESH_EXPIRE_DAYS` | 默认 30 |
| `DATABASE_URL` | SQLite/PostgreSQL |
| `USE_MOCK_DATA` | true/false |
| `SENTRY_DSN` | 可选 |
| `STRIPE_SECRET_KEY` | Web 支付 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 验证 |
| `STRIPE_PRICE_CREDITS_*` | 4 个商品 Price ID |
| `APPLE_IAP_SHARED_SECRET` | iOS IAP |

---

## 五、后续升级建议顺序

### 5.1 上架前必须完成

1. 配置 Apple/Google OAuth 凭证并完成真机登录测试
2. 在 App Store Connect / Play Console 创建 IAP 商品
3. 配置 Stripe 并完成 Web 端支付测试
4. 配置 SENTRY_DSN
5. 填写 eas.json 中的 EAS Project ID 和 Apple Team ID
6. 生成 Alembic 首次迁移并执行
7. 真机测试推送通知

### 5.2 上架后优先

1. i18n 全页面接入
2. pytest 测试套件
3. Google Play Billing 服务端验证（当前为信任模式）

### 5.3 体验增强（按需）

1. Telegram 通知
2. 价格历史折线图
3. 主题切换
4. 通知偏好页面

---

## 六、版本与审计记录

| 日期 | 版本 | 变更摘要 |
|------|------|----------|
| 2026-03-18 | v1.0 | 初始基准：15 项功能实施完成，建立升级计划文档 |

---

*本文档作为后续对比完成度及规划升级的基础，建议每次重大迭代后更新「当前完成度基准」和「版本与审计记录」章节。*
