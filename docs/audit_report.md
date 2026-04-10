# SkyHunter Pro 全面系统体检与上架审计报告

基于对代码库的整体扫描与分析，系统的整体架构已经相对成熟，但在最终上架**Apple App Store**、**Google Play Store**以及投入真正的生产环境前，还需要对配置、安全和系统扩展性进行最后的打磨。以下是具体的审计结果和操作指南。

## 1. 总体情况 (Executive Summary)
- 总体完成度：**高 (约 90%)**
- 移动端上架合规度：**极高**（内置了苹果强制要求的账号注销、隐私政策模块，明确排除了需要豁免审核的加密选项，Apple IAP / Google Play 支付及验证均已写好）。
- 生产环境安全性：**中上**（代码层面防护较好，但环境运维方面需注意）。
- 服务端扩展性：**单节点优异，多节点存在瓶颈**（内存锁定问题）。

---

## 2. 规范与合规性 (App Store / Google Play 审核要求)

### ✅ 已符合的标准要求
*   **账号注销功能 (Apple 强制要求)**：后端 `routers/users.py` 的 `delete_account` 实现了物理删除关联数据，应用内支持密码二次验证注销，完全符合 App Store 要求。
*   **隐私政策与用户条款 (Apple/Google 强制要求)**：通过 `/docs` 加载 Markdown 并通过 `/api/v1/legal/` 传递给前端进行渲染 (`app/legal.tsx`)，随时可动态更新维护，设计优秀。
*   **第三方登录接入**：集成了 Apple OAuth 验证逻辑，符合苹果“使用第三方登录时必须提供 Sign In with Apple”的政策。
*   **非豁免加密声明**：`app.json` 中配置了 `usesNonExemptEncryption: false`，避免了出口合规的繁琐审查。

### ⚠️ 仍然需要确认的配置（上架前必须完成）
*   **开发者 ID 补全**：前端 `eas.json` 与 `app.json` 中仍有一些诸如 Bundle ID、Apple ID 或证书的占位配置需替换为您自己的正式账号信息。

---

## 3. 安全性 (Security)

### ✅ 代码级安全
*   **密码与密钥保护**：采用了主流安全的 `bcrypt` 算法对密码进行了哈希加盐，并且完美防御了 bcrypt 72字节截断漏洞（见 `core/security.py`）。
*   **Token 策略**：采用了合理的 `Access Token` + `Refresh Token` 机制。

### ⚠️ 环境变量的处置级别 (高危)
*   **本地开发秘钥保护**：我们发现 `.env.example` 和 Git 历史中有效隔离了 `.env` 文件（通过 `.gitignore`），这意味着关键环境秘钥没有被直接推送到公共库，这是一个很好的习惯。
*   **生产密码管理**：上架生产环境时，切记**不要**把服务器的 `.env` 暴露在互联网可访问的目录下，推荐使用 Vercel/Render/Fly.io 环境参数管理或 Docker/Kubernetes 的 Secrets 技术直接挂载 `DATABASE_URL` 和 `JWT_SECRET_KEY`。

---

## 4. 商业化与支付 (Payments & Stripe)

目前支付网关和产品列表已写死或配置了数据库占位。代码本身存在于 `routers/payments.py` 中。

### ✅ IAP 验证完备
*   已经实现了苹果与谷歌商店收据的服务端验证逻辑（ `/api/v1/payments/apple/verify` 和 `google/verify` ），这对防范“内购破解”至关重要。

### 🚨 Stripe Web 端配置缺失（需立即补充）
如您的需求所述，系统缺少 Stripe 配置：
1.  **产品价格映射**：缺少将系统内商品 (50 / 200 / 500 Credits) 映射到正式环境 Stripe `Price ID` (如 `price_1Pxxx...` ) 的设置。
2.  **Webhook 安全机制**：需要配置并监听 `STRIPE_WEBHOOK_SECRET`，这是 Stripe 服务器调回调为您用户增加积分的关键鉴权签名。
3.  **Checkout 返回页**：缺少将系统 `STRIPE_SUCCESS_URL` 与前端 `payment/success.tsx` 在公网的域名挂钩。

---

## 5. 架构扩展性 (Scalability & Architecture)

在“单台小服务器”上，系统速度很快。但当用户大量增加，我们面临**多节点部署（多台机器 / 多个 Docker Workers）**时，系统会有两个潜在瓶颈：

1.  **基于内存的速率限制 (Rate Limit)**：
    *   在 `core/rate_limit.py` 中，使用的是 Python 原生 `dict` 字典来限制同 IP 访问。如果部署了多个 Worker 进程，该字典不共享，限流就会失效。
    *   **应对方案**：对于专业生产环境，应将该模块升级为 `Redis` 限流。
2.  **APScheduler 后台调度器**：
    *   `services/scheduler.py` 也在本地内存中运行检查任务。如果开启了多个节点进程，会导致重复搜票和复发相同邮件。
    *   **应对方案**：引入 `Celery`/`Redis` 列队，或限定仅在 1 个独立的小“后台机或单 Worker”上启动 Scheduler。

---

## 6. 代码复用性与质量

*   **模块化优雅**：前后端都大量使用了 Component 复用。例如，Hooks (`useAuth`, `useSearch`) 和通用 API (`api.ts`) 把耦合解开了，开发效率很高。
*   **数据库框架**：`SQLModel` 的使用使数据库定义与 FastAPI 路由验证极其统一。
*   **容灾跟踪**：引入了 `Sentry` 用作 Crash 监控，这个决定帮助快速排查由于终端环境产生的 React Native 闪退。

---

## 7. 下一步行动计划 (Action Items)

为了让系统真正达到商业发布级别，建议依次补齐以下内容：

1.  **打通 Stripe 配置链路 **（核心）
    *   配置好 `STRIPE_WEBHOOK_SECRET` 及签名校验。
    *   创建 Stripe Dashboard 并绑定正式或沙盒 `Price IDs`。
2.  **集群架构演进(可选)**
    *   如果您打算首发只用单机运行（推荐 `uvicorn --workers=1`），可以保留内存缓存和调度。如果预计发布后同时上线的并发很高，需迁移使用 Redis。
3.  **准备上架信息包裹**
    *   修改 `eas.json` 与 `app.json` 以补充真实的证书 ID，编译 iOS IPA 和 Android AAB 准备提交。
