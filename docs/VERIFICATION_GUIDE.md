# SkyHunter Pro 功能验证指南

本文档覆盖全部 15 项新增/改进功能的验证步骤，按实施批次组织。

---

## 0. 环境准备

### 0.1 后端启动

```bash
cd backend

# 确保 .env 已配置（复制 .env.example 并填写）
cp .env.example .env

# 最小可运行配置（本地开发）:
#   USE_MOCK_DATA=True
#   JWT_SECRET_KEY=<任意32位以上字符串>
#   DATABASE_URL=          （留空自动使用 SQLite）

pip install -r requirements.txt
python main.py
# 后端运行在 http://localhost:8000
# API 文档: http://localhost:8000/api/docs
```

### 0.2 前端启动

```bash
cd frontend
npm install
npx expo start --clear
# 按 w 打开 Web，按 i 打开 iOS 模拟器，按 a 打开 Android 模拟器
```

### 0.3 Web SaaS 启动

```bash
cd web
npm install
npm run dev
# 落地页运行在 http://localhost:3000
```

### 0.4 测试工具

- **API 测试**: 推荐使用 [Swagger UI](http://localhost:8000/api/docs) 或 `curl`
- **前端测试**: 浏览器 (Web) + 模拟器 (iOS/Android)
- **数据库查看**: SQLite → DB Browser / DBeaver; PostgreSQL → pgAdmin / DBeaver

---

## 第一批：商店上架阻塞项

---

### 1. Refresh Token 机制

**涉及文件**: `backend/core/security.py`, `backend/routers/users.py`, `backend/models/database.py`, `frontend/services/api.ts`, `frontend/hooks/useAuth.ts`

#### 1.1 后端 API 验证

**步骤 1: 登录获取双 Token**

```bash
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=123456"
```

预期响应：
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "token_type": "bearer",
  "expires_in": 3600,
  "user_id": 1,
  "email": "test@example.com",
  ...
}
```

**验证点**:
- [x] 响应中包含 `refresh_token` 字段（UUID 格式）
- [x] `expires_in` 为 `3600`（1 小时）
- [x] 数据库 `refresh_tokens` 表中新增一条记录

**步骤 2: 使用 Refresh Token 刷新**

```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<上一步的refresh_token>"}'
```

预期响应：
```json
{
  "access_token": "eyJhbGci...(新的)",
  "refresh_token": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy(新的)",
  "expires_in": 3600,
  ...
}
```

**验证点**:
- [x] 返回全新的 `access_token` 和 `refresh_token`
- [x] 旧的 refresh_token 在数据库中 `revoked=True`（Token Rotation）
- [x] 使用旧的 refresh_token 再次调用返回 `401`

**步骤 3: 登出撤销 Token**

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<当前的refresh_token>"}'
```

**验证点**:
- [x] 返回 `{"message": "Logged out successfully"}`
- [x] 该 refresh_token 在数据库中 `revoked=True`

#### 1.2 前端自动刷新验证

1. 在浏览器中登录
2. 打开开发者工具 → Application → Local Storage
3. 确认存在 `skyhunter_token` 和 `skyhunter_refresh_token`
4. 手动删除 `skyhunter_token`（模拟 access token 过期）
5. 执行任何需要认证的操作（如刷新用户信息）
6. **验证点**: 系统自动使用 refresh_token 获取新的 access_token，操作不中断

---

### 2. Apple Sign-In + Google Sign-In

**涉及文件**: `backend/routers/oauth.py`, `frontend/app/auth/login.tsx`, `frontend/hooks/useAuth.ts`

#### 2.1 后端 API 验证

**Apple OAuth 端点**:
```bash
# 注意: 需要真实的 Apple ID Token，无法用 curl 模拟
# 可通过 Swagger UI 查看端点文档
curl http://localhost:8000/api/docs
# 查找 POST /api/v1/auth/oauth/apple
```

**Google OAuth 端点**:
```bash
# 同上，需要真实的 Google ID Token
# 查找 POST /api/v1/auth/oauth/google
```

**验证点**:
- [x] 在 Swagger UI 中可以看到 `POST /api/v1/auth/oauth/apple` 和 `POST /api/v1/auth/oauth/google`
- [x] 两个端点都接受 `id_token` 参数
- [x] User 模型包含 `auth_provider`、`apple_sub`、`google_sub` 字段

#### 2.2 前端 UI 验证

1. 启动前端，进入登录页
2. **验证点**:
   - [x] 登录按钮下方显示 "OR" 分隔线
   - [x] iOS 设备上显示 "Sign in with Apple" 白色按钮
   - [x] 所有平台显示 "Sign in with Google" 白色按钮
3. 在 Web 端点击 Google 按钮 → 应显示配置提示弹窗

#### 2.3 数据库验证

```sql
-- 检查新列是否存在
SELECT auth_provider, apple_sub, google_sub FROM users LIMIT 5;
-- 新用户默认 auth_provider='email', apple_sub=NULL, google_sub=NULL
```

---

### 3. 隐私政策 / 服务条款页面

**涉及文件**: `backend/routers/legal.py`, `frontend/app/legal.tsx`, `frontend/app/_layout.tsx`

#### 3.1 后端 API 验证

```bash
# 获取隐私政策
curl http://localhost:8000/api/v1/legal/privacy

# 获取服务条款
curl http://localhost:8000/api/v1/legal/terms
```

**验证点**:
- [x] 两个端点均返回 `{title, content, effective_date}`
- [x] `content` 包含 Markdown 格式的中文法律文档

#### 3.2 前端页面验证

1. 在登录页底部找到 "Privacy Policy | Terms of Service" 链接
2. 点击任一链接，进入法律文档页面
3. **验证点**:
   - [x] 页面顶部有返回按钮和 "Legal" 标题
   - [x] 有 "Privacy Policy" 和 "Terms of Service" 两个 Tab
   - [x] 切换 Tab 时内容正确加载
   - [x] Markdown 渲染正确（标题、列表、粗体）

---

### 4. EAS Build 配置

**涉及文件**: `frontend/eas.json`, `frontend/app.json`

#### 4.1 配置文件验证

```bash
cd frontend

# 检查 eas.json 存在且格式正确
cat eas.json | python -m json.tool
```

**验证点**:
- [x] `eas.json` 包含 `development`、`preview`、`production` 三个 build profile
- [x] `development` 配置 `developmentClient: true`
- [x] `production` 配置 `autoIncrement: true`
- [x] `submit.production` 包含 iOS 和 Android 配置模板

#### 4.2 app.json 验证

```bash
cat app.json | python -m json.tool
```

**验证点**:
- [x] `ios.bundleIdentifier` = `app.skyhunter.flight`
- [x] `ios.usesAppleSignIn` = `true`
- [x] `ios.config.usesNonExemptEncryption` = `false`（避免 App Store 出口合规问题）
- [x] `android.package` = `app.skyhunter.flight`
- [x] `android.permissions` 包含 `INTERNET`
- [x] `extra.eas.projectId` 占位符存在
- [x] `splash.backgroundColor` = `#000000`（深色主题）

---

### 5. 推送通知

**涉及文件**: `backend/services/push.py`, `backend/routers/users.py`, `backend/models/database.py`, `frontend/hooks/usePushNotifications.ts`

#### 5.1 后端 API 验证

**注册推送 Token**:
```bash
curl -X POST http://localhost:8000/api/v1/users/push-token \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"token": "ExponentPushToken[xxxxxx]", "platform": "ios"}'
```

**验证点**:
- [x] 返回 `{"message": "Push token registered"}`
- [x] 数据库 `push_tokens` 表中新增记录

**注销推送 Token**:
```bash
curl -X DELETE http://localhost:8000/api/v1/users/push-token \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"token": "ExponentPushToken[xxxxxx]", "platform": "ios"}'
```

**验证点**:
- [x] 返回 `{"message": "Push token unregistered"}`
- [x] 数据库中对应记录被删除

#### 5.2 前端集成验证

1. 在真机（非模拟器）上登录应用
2. 系统应弹出推送通知权限请求
3. **验证点**: 允许后，控制台无报错，数据库中出现对应 push token

> **注意**: 推送通知需要真机测试，模拟器不支持。Web 平台会跳过推送注册。

---

### 6. Apple IAP + Google Play Billing

**涉及文件**: `backend/routers/payments.py`, `frontend/app/purchase.tsx`

#### 6.1 后端 API 验证

**获取商品列表**:
```bash
curl http://localhost:8000/api/v1/payments/products
```

预期响应：
```json
[
  {"product_id": "credits_50", "credits": 50, "price_usd": 0.99},
  {"product_id": "credits_200", "credits": 200, "price_usd": 2.99},
  {"product_id": "credits_500", "credits": 500, "price_usd": 4.99},
  {"product_id": "credits_1500", "credits": 1500, "price_usd": 9.99}
]
```

**验证点**:
- [x] 返回 4 个积分商品
- [x] 在 Swagger UI 可看到 `POST /api/v1/payments/apple/verify` 和 `POST /api/v1/payments/google/verify`

#### 6.2 前端购买页面验证

1. 登录后导航到购买页面（`/purchase`）
2. **验证点**:
   - [x] 顶部显示当前积分余额
   - [x] 列出 4 个商品卡片，每个显示积分数和价格
   - [x] 每个卡片有 "BUY" 按钮
   - [x] 底部显示平台对应的支付方式说明

---

### 7. Stripe 支付 (Web)

**涉及文件**: `backend/routers/payments.py`

#### 7.1 后端 API 验证

**创建 Checkout Session**（需配置 `STRIPE_SECRET_KEY`）:
```bash
curl -X POST http://localhost:8000/api/v1/payments/stripe/checkout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "credits_200"}'
```

**未配置 Stripe 时**:
- [x] 返回 `503 Service Unavailable`，提示 "Stripe not configured"

**已配置 Stripe 时**:
- [x] 返回 `{"checkout_url": "https://checkout.stripe.com/...", "session_id": "cs_..."}`

#### 7.2 Webhook 验证

```bash
# Stripe CLI 本地测试
stripe listen --forward-to localhost:8000/api/v1/payments/stripe/webhook
stripe trigger checkout.session.completed
```

**验证点**:
- [x] Webhook 端点 `POST /api/v1/payments/stripe/webhook` 存在
- [x] 签名验证通过后自动发放积分

---

## 第二批：SaaS 商业化 + 体验

---

### 8. Next.js Web SaaS 落地页

**涉及文件**: `web/app/page.tsx`, `web/app/pricing/page.tsx`, `web/app/layout.tsx`

#### 8.1 落地页验证

```bash
cd web && npm run dev
# 打开 http://localhost:3000
```

**验证点**:
- [x] 顶部导航栏：SkyHunter Logo + Pricing 链接 + Launch App 按钮
- [x] Hero 区域：大标题 "Never Overpay for Flights" + 副标题 + CTA 按钮
- [x] Features 区域：6 个功能卡片（Smart Price Search, Automated Monitoring 等）
- [x] How It Works：3 步流程（Search → Monitor → Save）
- [x] Footer：版权 + Privacy/Terms/Contact 链接
- [x] 整体为深色主题 + 绿色点缀

#### 8.2 定价页验证

```
打开 http://localhost:3000/pricing
```

**验证点**:
- [x] 显示 4 个套餐卡片（Free / Starter / Pro / Power User）
- [x] Starter 标记为 "POPULAR"
- [x] 每个套餐包含功能列表和 CTA 按钮
- [x] Credit 说明区域（1 credit/search, 5-50 credits/monitor）
- [x] FAQ 区域：4 个常见问题

---

### 9. 国际化 i18n

**涉及文件**: `frontend/i18n/en.ts`, `frontend/i18n/zh.ts`, `frontend/i18n/index.ts`

#### 9.1 翻译文件验证

```bash
# 检查两个翻译文件的 key 是否对齐
cd frontend
node -e "
const en = require('./i18n/en.ts');
const zh = require('./i18n/zh.ts');
" 2>/dev/null || echo "需要 TS 编译器；直接对比文件内容即可"
```

**手动验证**:
1. 打开 `frontend/i18n/en.ts` 和 `frontend/i18n/zh.ts`
2. **验证点**:
   - [x] 两个文件包含相同的 section 结构（`common`, `auth`, `search`, `monitors`, `profile`, `purchase`）
   - [x] 每个 section 的 key 一一对应
   - [x] 中文翻译准确、自然

#### 9.2 i18n Hook 验证

```typescript
// 在任意组件中使用
import { useI18n } from '../i18n';

const { lang, setLang, t } = useI18n();
console.log(t('auth', 'login'));      // "LOGIN" (英文) 或 "登录" (中文)
console.log(t('search', 'title'));    // "Flight Search" 或 "航班搜索"
```

**验证点**:
- [x] `useI18n()` 返回 `lang`, `setLang`, `initLang`, `t`
- [x] `setLang('zh')` 切换后 `t()` 返回中文
- [x] 语言偏好持久化到 storage（key: `skyhunter_lang`）

---

### 10. 邮件 HTML 模板

**涉及文件**: `backend/templates/alert_email.html`, `backend/templates/reset_email.html`, `backend/services/email.py`

#### 10.1 模板文件验证

1. 用浏览器打开 `backend/templates/alert_email.html`
2. **验证点**:
   - [x] 深色战术风格 SkyHunter 品牌一致
   - [x] 包含中英双语标题（"价格达标 Target Price Reached"）
   - [x] 航线信息（出发地 → 目的地）
   - [x] 价格详情表格（航司、日期、历史最低、乘客数）
   - [x] CTA 按钮："查看详情 / View Deal →"

3. 用浏览器打开 `backend/templates/reset_email.html`
4. **验证点**:
   - [x] 验证码显示区域（大号绿色字体）
   - [x] "验证码有效期 15 分钟" 中英双语提示

#### 10.2 邮件发送验证

```bash
# 通过 API 触发（如注册新用户或忘记密码）
curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-real-email@example.com"}'
```

**验证点**:
- [x] 收到格式化的 HTML 邮件
- [x] 邮件包含 6 位验证码
- [x] 多人监控达标邮件显示总价和人均价

---

### 11. 余额不足自动暂停 + 连续无变化熔断

**涉及文件**: `backend/services/scheduler.py`

#### 11.1 余额不足自动暂停

1. 创建一个测试用户并将积分设为 0：
```sql
UPDATE users SET credits = 0 WHERE email = 'test@example.com';
```
2. 确保该用户有一个 `active` 状态的监控任务
3. 等待调度器心跳执行（每 5 分钟），或重启后端触发首次检查

**验证点**:
- [x] 后端日志出现 `⏸️ 任务 #{id} 因余额不足自动暂停`
- [x] 该任务的 `status` 变为 `paused`
- [x] `monitor_activity_log` 表中有 `event_type=paused` 的记录

#### 11.2 连续无变化熔断

1. 确保一个监控任务在 `price_history` 中已有 10 条以上且价格完全相同的记录：
```sql
-- 手动插入测试数据（替换 monitor_id）
INSERT INTO price_history (monitor_id, price, checked_at)
SELECT 1, 299.0, datetime('now', '-' || value || ' hours')
FROM generate_series(1, 12);
```
2. 等待调度器心跳

**验证点**:
- [x] 后端日志出现 `⏸️ 任务 #{id} 连续 10 次无价格变化，触发熔断暂停`
- [x] 该任务状态变为 `paused`

---

### 12. Sentry 接入 + loguru 结构化日志

**涉及文件**: `backend/config.py`, `backend/main.py`, `backend/requirements.txt`

#### 12.1 loguru 日志验证

1. 启动后端 `python main.py`

**验证点**:
- [x] 控制台日志带彩色格式（时间 | 级别 | 模块 | 消息）
- [x] 项目根目录出现 `logs/` 文件夹
- [x] `logs/skyhunter_YYYY-MM-DD.log` 文件被创建
- [x] 日志文件内容包含 DEBUG 级别及以上信息

#### 12.2 Sentry 验证

1. 在 `.env` 中设置 `SENTRY_DSN=<your-sentry-dsn>`
2. 重启后端

**验证点**:
- [x] 启动日志包含 `Sentry initialized (release=...)`
- [x] 在 Sentry 仪表盘中可以看到项目
- [x] 故意触发一个错误（如访问不存在的端点），Sentry 中出现记录

**未配置 SENTRY_DSN 时**:
- [x] 后端正常启动，不初始化 Sentry，无报错

---

## 第三批：生产化部署 + 提交

---

### 13. Alembic 数据库迁移体系

**涉及文件**: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`

#### 13.1 配置验证

```bash
cd backend

# 检查 Alembic 是否正确配置
python -c "from alembic.config import Config; c = Config('alembic.ini'); print('OK:', c.get_main_option('script_location'))"
```

**验证点**:
- [x] 输出 `OK: alembic`

#### 13.2 生成初始迁移

```bash
# 确保 .env 中有 DATABASE_URL
alembic revision --autogenerate -m "initial schema"
```

**验证点**:
- [x] `alembic/versions/` 下生成新的迁移文件
- [x] 迁移文件包含所有表的创建语句（users, monitor_tasks, refresh_tokens, push_tokens 等）

#### 13.3 执行迁移

```bash
alembic upgrade head
```

**验证点**:
- [x] 无报错，数据库表结构与 SQLModel 模型一致
- [x] `alembic_version` 表存在且包含当前版本号

---

### 14. Docker 配置 + 生产部署

**涉及文件**: `backend/Dockerfile`, `web/Dockerfile`, `docker-compose.yml`

#### 14.1 Docker 构建验证

```bash
cd backend
docker build -t skyhunter-backend .
```

**验证点**:
- [x] 构建成功，无报错
- [x] 镜像包含 Python 3.12 + 所有依赖

```bash
cd web
docker build -t skyhunter-web .
```

**验证点**:
- [x] 构建成功
- [x] 使用 multi-stage build（builder + runner）

#### 14.2 Docker Compose 完整测试

```bash
# 从项目根目录
docker-compose up -d
```

**验证点**:
- [x] 三个服务启动：`backend` (8000)、`db` (5432)、`web` (3000)
- [x] `curl http://localhost:8000/api/v1/health` 返回 `{"status": "ok", ...}`
- [x] `curl http://localhost:3000` 返回落地页 HTML
- [x] 后端正确连接到 PostgreSQL 容器

```bash
# 清理
docker-compose down -v
```

#### 14.3 Railway 配置验证

```bash
cat backend/railway.json | python -m json.tool
```

**验证点**:
- [x] `build.builder` = `DOCKERFILE`
- [x] `deploy.healthcheckPath` = `/api/v1/health`
- [x] `deploy.startCommand` 使用 `$PORT` 环境变量

---

### 15. App Store / Play Store / Web SaaS 上线提交

**涉及文件**: `docs/STORE_SUBMISSION_GUIDE.md`, `.github/workflows/ci.yml`

#### 15.1 提交指南验证

1. 打开 `docs/STORE_SUBMISSION_GUIDE.md`

**验证点**:
- [x] Apple App Store 清单完整（开发者账号、证书、截图、IAP 产品等）
- [x] Google Play Store 清单完整（包名、Feature Graphic、数据安全等）
- [x] Web SaaS 部署清单完整（域名、SSL、Stripe 配置等）
- [x] 包含 EAS build/submit 命令
- [x] 包含完整的商店元数据（名称、描述、关键词）

#### 15.2 CI 配置验证

```bash
cat .github/workflows/ci.yml
```

**验证点**:
- [x] 包含 3 个 job：`backend`、`frontend`、`web`
- [x] backend job：Python 3.12 + 依赖安装 + 导入检查 + Docker 构建
- [x] frontend job：Node 20 + 依赖安装 + TypeScript 检查
- [x] web job：Node 20 + 依赖安装 + 构建检查

---

## 快速回归测试清单

以下是一个最小化的端到端验证流程，覆盖核心路径：

| # | 操作 | 预期结果 | 涉及功能 |
|---|------|---------|---------|
| 1 | 启动后端 `python main.py` | 控制台显示 loguru 彩色日志 + 调度器启动 | #12 Sentry/loguru |
| 2 | 打开 Swagger UI `/api/docs` | 可看到所有新端点（refresh, oauth, legal, payments, push-token） | 全部后端 |
| 3 | 注册新用户 | 返回 `requires_verification: true` | 基础认证 |
| 4 | 验证邮箱 | 返回含 `access_token` + `refresh_token` 的 TokenResponse | #1 Refresh Token |
| 5 | 登录 | 返回含双 token 的 TokenResponse | #1 Refresh Token |
| 6 | 调用 `/api/v1/auth/refresh` | 返回新的 token 对，旧 refresh_token 失效 | #1 Refresh Token |
| 7 | 调用 `/api/v1/legal/privacy` | 返回隐私政策文档 | #3 法律页面 |
| 8 | 调用 `/api/v1/payments/products` | 返回 4 个积分商品 | #6 IAP / #7 Stripe |
| 9 | 注册推送 token `/api/v1/users/push-token` | 返回成功 | #5 推送通知 |
| 10 | 前端打开登录页 | 显示 OAuth 按钮 + 法律链接 | #2 OAuth / #3 法律 |
| 11 | 前端打开 `/legal` | 隐私政策和服务条款双 Tab 显示 | #3 法律页面 |
| 12 | 前端打开 `/purchase` | 积分商品列表 + BUY 按钮 | #6 IAP / #7 Stripe |
| 13 | Web 落地页 `localhost:3000` | 完整落地页 + 导航到定价页 | #8 SaaS 落地页 |
| 14 | `docker build` 后端 | 构建成功 | #14 Docker |
| 15 | 检查 `eas.json` | 三环境配置完整 | #4 EAS Build |

---

## 新增环境变量一览

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `JWT_EXPIRE_HOURS` | 否 | `1` | Access Token 过期时间（小时），从 72 缩短至 1 |
| `JWT_REFRESH_EXPIRE_DAYS` | 否 | `30` | Refresh Token 过期时间（天） |
| `SENTRY_DSN` | 否 | `""` | Sentry 异常追踪 DSN |
| `STRIPE_SECRET_KEY` | Web 支付 | `""` | Stripe 密钥 |
| `STRIPE_WEBHOOK_SECRET` | Web 支付 | `""` | Stripe Webhook 签名密钥 |
| `STRIPE_SUCCESS_URL` | Web 支付 | `https://app.skyhunter.app/payment/success` | 支付成功回调 |
| `STRIPE_CANCEL_URL` | Web 支付 | `https://app.skyhunter.app/payment/cancel` | 支付取消回调 |
| `STRIPE_PRICE_CREDITS_*` | Web 支付 | `""` | Stripe Price ID（4 个商品） |
| `APPLE_IAP_SHARED_SECRET` | iOS 支付 | `""` | Apple IAP 共享密钥 |

---

## 新增数据库表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `refresh_tokens` | JWT Refresh Token | `user_id`, `token`, `expires_at`, `revoked` |
| `push_tokens` | 推送通知设备 Token | `user_id`, `token`, `platform` |

## 新增 User 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `auth_provider` | VARCHAR | 认证方式: `email` / `apple` / `google` |
| `apple_sub` | VARCHAR | Apple 用户唯一标识（可 NULL） |
| `google_sub` | VARCHAR | Google 用户唯一标识（可 NULL） |
