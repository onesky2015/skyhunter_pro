---
name: SkyHunter 基线计划与升级指导
version: "1.0"
created: "2026-03-18"
overview: 作为 SkyHunter Pro 项目的基线参考文档，用于后续对比完成度、规划升级路线。包含当前实现状态、待配置项、未实现功能及升级优先级。
isProject: false
---

# SkyHunter Pro 基线计划与升级指导

> **文档用途**：本计划作为项目基线，供后续开发时对比完成度、制定升级路线。更新时请同步修改版本号与日期。

---

## 一、项目目标（不变）

1. **上架 Apple App Store**：满足审核要求
2. **上架 Google Play Store**：满足审核要求
3. **Web SaaS 商业化**：落地页 + 定价页 + 收费能力

---

## 二、当前实现状态总览

### 2.1 完成度概览

| 维度 | 完成度 | 说明 |
|------|--------|------|
| 核心业务 | ~95% | 搜索、监控、计费、通知链路完整 |
| 认证与安全 | ~95% | JWT + Refresh + OAuth 代码（Apple/Google）已全面完成，需平台账号配置生效 |
| 支付体系 | ~85% | IAP/Stripe 代码完成（前端仅 mock），需商店与 Stripe 配置配置、查重 |
| 生产化 | ~80% | Docker/Alembic/Sentry 已配置，需首次迁移与 DSN |
| 体验增强 | ~60% | 添加了 3 套主题（Tactical/Light/Glass），其余待完善（如 i18n、Telegram） |

**总体估算**：约 **80–85%** 完成。

---

## 三、已实现功能清单

### 3.1 后端 (Backend)

| 模块 | 功能 | 文件/端点 | 备注 |
|------|------|-----------|------|
| 认证 | JWT + bcrypt | `core/security.py` | Access 1h, Refresh 30d |
| 认证 | Refresh Token 双 token | `routers/users.py` | `/auth/refresh`, `/auth/logout` |
| 认证 | Apple/Google OAuth | `routers/oauth.py` | `/auth/oauth/apple`, `/auth/oauth/google` |
| 认证 | 注册/登录/邮箱验证/忘记密码 | `routers/users.py` | 全流程 |
| 认证 | 修改密码/删除账户 | `routers/users.py` | Apple 合规 |
| 法律 | 隐私政策/服务条款 API | `routers/legal.py` | `/legal/privacy`, `/legal/terms` |
| 推送 | 推送 Token 注册/注销 | `routers/users.py` | `/users/push-token` |
| 推送 | Expo Push 发送 | `services/push.py` | 价格达标时调用 |
| 支付 | 商品列表 | `routers/payments.py` | `/payments/products` |
| 支付 | Apple IAP 验证 | `routers/payments.py` | `/payments/apple/verify` |
| 支付 | Google Play 验证 | `routers/payments.py` | `/payments/google/verify` |
| 支付 | Stripe Checkout + Webhook | `routers/payments.py` | `/payments/stripe/*` |
| 调度 | 余额不足自动暂停 | `services/scheduler.py` | credits≤0 → paused |
| 调度 | 连续 10 次无变化熔断 | `services/scheduler.py` | 自动 paused |
| 日志 | loguru 结构化日志 | `config.py` | 控制台 + 按日文件 |
| 监控 | Sentry 初始化 | `main.py` | 需 SENTRY_DSN |
| 迁移 | Alembic 配置 | `alembic/` | 需生成首次迁移 |
| 部署 | Dockerfile | `backend/Dockerfile` | 多阶段构建 |
| 部署 | docker-compose | `docker-compose.yml` | backend + db + web |

### 3.2 前端 (Frontend - Expo)

| 模块 | 功能 | 文件 | 备注 |
|------|------|------|------|
| 认证 | 登录/注册/验证/忘记密码 | `app/auth/*` | 全流程 |
| 认证 | Refresh Token 自动刷新 | `services/api.ts` | 401 时自动重试 |
| 认证 | OAuth 按钮 (Apple/Google) | `app/auth/login.tsx` | 需配置 OAuth |
| 法律 | 隐私政策/服务条款页面 | `app/legal.tsx` | 双 Tab |
| 购买 | 积分购买页 | `app/purchase.tsx` | 按平台选 IAP/Stripe（当前 mock）|
| 推送 | 推送注册 Hook | `hooks/usePushNotifications.ts` | 登录后自动注册 |
| 国际化 | 中/英翻译 + useI18n | `i18n/en.ts`, `i18n/zh.ts` | 未全页面接入 |
| 体验 | 3个主题切换选项 | `theme/themes.ts`, `app/settings.tsx`| 已实现（Tactical/Light/Glass）|
| 构建 | EAS 配置 | `eas.json`, `app.json` | 需填 Project ID |

### 3.3 Web SaaS (Next.js)

| 模块 | 功能 | 文件 | 备注 |
|------|------|------|------|
| 落地页 | Hero + Features + How It Works | `web/app/page.tsx` | 深色战术风格 |
| 定价页 | 4 套餐 + FAQ | `web/app/pricing/page.tsx` | 链接到 App 购买 |
| 部署 | Dockerfile | `web/Dockerfile` | standalone 输出 |

### 3.4 基础设施

| 项目 | 内容 | 文件 |
|------|------|------|
| CI | Backend + Frontend + Web 三 job | `.github/workflows/ci.yml` |
| 文档 | 验证指南 | `docs/VERIFICATION_GUIDE.md` |
| 文档 | 商店提交指南 | `docs/STORE_SUBMISSION_GUIDE.md` |
| 邮件模板 | 价格提醒 + 验证码 | `backend/templates/*.html` |

---

## 四、待配置项（代码已有，需外部配置）

| 配置项 | 用途 | 配置位置 | 优先级 |
|--------|------|----------|--------|
| Apple Developer 账号 + Service ID | Apple Sign-In | Apple Developer Console | P0 |
| Google OAuth Client ID | Google Sign-In | `app.json` / Google Cloud | P0 |
| App Store Connect IAP 产品 | Apple 内购 | App Store Connect | P0 |
| Google Play 商品 | Android 内购 | Play Console | P0 |
| Stripe 密钥 + Price ID + Webhook | Web 支付 | `.env` + Stripe Dashboard | P0 |
| EAS Project ID | EAS Build | `app.json` extra.eas | P0 |
| SENTRY_DSN | 异常追踪 | `.env` | P1 |
| Firebase 项目 (Android 推送) | FCM | 可选 | P2 |

---

## 五、未实现功能清单

### 5.1 高优先级（影响上架或核心体验）

| 功能 | 说明 | 预估工作量 |
|------|------|------------|
| i18n 全页面接入 | 翻译文件已有，各页面需替换硬编码文案 | 2–3 天 |
| 监控任务 Range 模式日期范围 | 出发/返程支持日期范围选择 | 见「新监控任务UI修复计划」 |
| 航司选择器弹窗层级 | Modal 被遮挡问题 | 0.5 天 |
| Alembic 首次迁移 | `alembic revision --autogenerate` | 0.5 天 |

### 5.2 中优先级（上架后可迭代）

| 功能 | 说明 | 预估工作量 |
|------|------|------------|
| Google Play 收据验证 | 当前为信任模式，需接入 Play Developer API | 2–3 天 |
| 联盟筛选 API 参数化 | 后端将 alliance 作为搜索/监控参数 | 1 天 |
| 通知偏好页面 | 独立设置页（邮件/推送/Telegram 开关） | 1–2 天 |
| pytest 完整测试套件 | tests/ 目录 + 覆盖率 | 3–5 天 |

### 5.3 低优先级（体验增强）

| 功能 | 说明 | 预估工作量 |
|------|------|------------|
| Telegram 通知 | Bot API + 前端绑定 | 2–3 天 |
| 价格历史折线图 | 前端图表组件 | 2 天 |
| Zustand 状态管理 | 重构 hooks → store | 3–4 天 |
| 周报邮件 | 定时任务 + 模板 | 2 天 |

---

## 六、数据库与模型变更（基线）

### 6.1 新增表

| 表名 | 用途 |
|------|------|
| `refresh_tokens` | JWT Refresh Token 存储 |
| `push_tokens` | 推送设备 Token |

### 6.2 User 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `auth_provider` | VARCHAR | email / apple / google |
| `apple_sub` | VARCHAR | Apple 用户唯一标识 |
| `google_sub` | VARCHAR | Google 用户唯一标识 |

### 6.3 环境变量新增

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_EXPIRE_HOURS` | 1 | Access Token 过期（小时） |
| `JWT_REFRESH_EXPIRE_DAYS` | 30 | Refresh Token 过期（天） |
| `SENTRY_DSN` | "" | Sentry 项目 DSN |
| `STRIPE_SECRET_KEY` | "" | Stripe 密钥 |
| `STRIPE_WEBHOOK_SECRET` | "" | Webhook 签名密钥 |
| `STRIPE_PRICE_CREDITS_*` | "" | 4 个商品的 Price ID |
| `APPLE_IAP_SHARED_SECRET` | "" | Apple IAP 共享密钥 |

---

## 七、升级路线建议

### 7.1 上架前必做

1. 配置 Apple/Google OAuth、IAP、Stripe、EAS Project ID
2. ~~完成「新监控任务UI修复计划」中的日期范围与航司选择器~~ (已修复)
3. ~~生成并执行 Alembic 首次迁移~~ (已生成并执行)
4. 真机测试推送通知
5. 按 `docs/STORE_SUBMISSION_GUIDE.md` 准备商店素材

### 7.2 上架后首月

1. i18n 全页面接入
2. ~~Google Play 收据验证~~ (后端已实现并补充 API 校验)
3. ~~Sentry 接入并监控~~ (前端拦截、后端 init 均已配置)
4. 通知偏好页面

### 7.3 中长期

1. pytest 测试套件
2. Telegram 通知
3. 价格历史折线图
4. Zustand 重构

---

## 八、对比与更新说明

### 8.1 如何用本文档做对比

1. **完成度对比**：将「已实现功能清单」与当前代码逐项核对
2. **待配置对比**：检查「待配置项」是否已全部完成
3. **未实现对比**：将「未实现功能清单」与需求/计划对照，调整优先级

### 8.2 文档更新规范

- 完成新功能后：在「已实现功能清单」中补充，并更新完成度概览
- 完成配置后：在「待配置项」中标记为已完成
- 调整优先级后：在「未实现功能清单」中更新优先级与预估
- 每次重大更新：修改文档顶部的 `version` 和 `created` 日期

---

## 九、相关文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 开发进度审计 | `.cursor/plans/skyhunter_开发进度审计_20771008.plan.md` | 原始审计与批次任务 |
| 全面重构计划 | `.cursor/plans/skyhunter_全面重构计划_41d6e170.plan.md` | Phase 0–4 原始规划 |
| 新监控任务 UI 修复 | `.cursor/plans/新监控任务UI修复计划_日期范围和航司选择器.md` | 日期范围与航司选择器 |
| 验证指南 | `docs/VERIFICATION_GUIDE.md` | 功能验证步骤 |
| 商店提交指南 | `docs/STORE_SUBMISSION_GUIDE.md` | App Store / Play Store 提交清单 |
