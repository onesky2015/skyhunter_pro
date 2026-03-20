# SkyHunter Pro 开发计划与进度基准

> **文档用途**：作为后续对比完成度及升级迭代的基础指导文件。  
> **更新日期**：2026-03-18  
> **版本**：v1.0

---

## 一、项目目标

- **App Store / Play Store 上架**：满足双商店审核要求
- **Web SaaS 商业化**：落地页 + 定价页 + 收费能力
- **生产化部署**：Docker + CI/CD + 可观测性

---

## 二、功能清单与完成状态

### 2.1 第一批：商店上架阻塞项

| ID | 功能 | 后端 | 前端 | 配置/凭证 | 状态 |
|----|------|:----:|:----:|:---------:|------|
| B1-1 | Refresh Token 双 token 机制 | ✅ | ✅ | — | **已完成** |
| B1-2 | Apple Sign-In | ✅ | ✅ | Apple Developer 配置 | **代码完成** |
| B1-3 | Google Sign-In | ✅ | ✅ | Google OAuth Client ID | **代码完成** |
| B1-4 | 隐私政策/服务条款页面 | ✅ | ✅ | — | **已完成** |
| B1-5 | EAS Build 配置 | — | ✅ | EAS Project ID + 证书 | **配置完成** |
| B1-6 | 推送通知 (Expo Push) | ✅ | ✅ | 真机测试 | **代码完成** |
| B1-7 | Apple IAP | ✅ | ✅ | App Store Connect 产品 | **代码完成** |
| B1-8 | Google Play Billing | ✅ | ✅ | Play Console 产品 | **代码完成** |
| B1-9 | Stripe 支付 (Web) | ✅ | ✅ | Stripe 密钥 + Price ID | **代码完成** |

### 2.2 第二批：SaaS 商业化 + 体验

| ID | 功能 | 后端 | 前端 | 状态 |
|----|------|:----:|:----:|------|
| B2-1 | Next.js Web SaaS 落地页 + 定价页 | — | ✅ | **已完成** |
| B2-2 | 国际化 i18n (中/英) | — | ✅ | **翻译完成**，待全页面接入 |
| B2-3 | 邮件 HTML 模板 (中文 + 多人价格) | ✅ | — | **已完成** |
| B2-4 | 余额不足自动暂停 | ✅ | — | **已完成** |
| B2-5 | 连续无变化熔断 | ✅ | — | **已完成** |
| B2-6 | Sentry 接入 | ✅ | — | **代码完成**，需 SENTRY_DSN |
| B2-7 | loguru 结构化日志 | ✅ | — | **已完成** |

### 2.3 第三批：生产化部署 + 提交

| ID | 功能 | 状态 |
|----|------|------|
| B3-1 | Alembic 数据库迁移体系 | **配置完成**，待生成首次迁移 |
| B3-2 | Docker 配置 (backend + web + compose) | **已完成** |
| B3-3 | Railway 部署配置 | **已完成** |
| B3-4 | 商店提交指南文档 | **已完成** |
| B3-5 | CI 扩展 (backend + frontend + web) | **已完成** |

### 2.4 可延后（上架后迭代）

| ID | 功能 | 优先级 |
|----|------|--------|
| D1 | i18n 全页面接入 | 中 |
| D2 | Telegram 通知 | 低 |
| D3 | 价格历史折线图 | 低 |
| D4 | 深色/浅色主题切换 | 低 |
| D5 | Zustand 状态管理 | 低 |
| D6 | 周报邮件 | 低 |
| D7 | 联盟筛选 API 参数化 | 低 |
| D8 | 通知偏好页面 | 低 |
| D9 | pytest 完整测试套件 | 中 |

---

## 三、关键文件路径索引

### 后端 (backend/)

| 功能 | 文件路径 |
|------|----------|
| Refresh Token | `core/security.py`, `models/database.py` (RefreshToken), `routers/users.py` |
| OAuth | `routers/oauth.py`, `schemas/api_models.py` (OAuthAppleRequest, OAuthGoogleRequest) |
| 法律文档 | `routers/legal.py` |
| 推送 | `services/push.py`, `models/database.py` (PushToken), `routers/users.py` |
| 支付 | `routers/payments.py` |
| 调度器安全 | `services/scheduler.py` (Step 0a/0b) |
| 日志/监控 | `config.py` (loguru), `main.py` (Sentry) |
| 迁移 | `alembic/`, `alembic.ini` |
| 部署 | `Dockerfile`, `railway.json` |

### 前端 (frontend/)

| 功能 | 文件路径 |
|------|----------|
| Refresh Token | `services/api.ts`, `hooks/useAuth.ts`, `constants/api.ts` |
| OAuth | `app/auth/login.tsx`, `hooks/useAuth.ts`, `services/api.ts` |
| 法律页面 | `app/legal.tsx`, `app/_layout.tsx` |
| EAS | `eas.json`, `app.json` |
| 推送 | `hooks/usePushNotifications.ts`, `app/(tabs)/_layout.tsx` |
| 购买 | `app/purchase.tsx`, `app/_layout.tsx` |
| i18n | `i18n/en.ts`, `i18n/zh.ts`, `i18n/index.ts` |

### Web SaaS (web/)

| 功能 | 文件路径 |
|------|----------|
| 落地页 | `app/page.tsx` |
| 定价页 | `app/pricing/page.tsx` |
| 布局 | `app/layout.tsx`, `app/globals.css` |
| 部署 | `Dockerfile` |

### 文档 (docs/)

| 文档 | 路径 |
|------|------|
| 验证指南 | `docs/VERIFICATION_GUIDE.md` |
| 商店提交指南 | `docs/STORE_SUBMISSION_GUIDE.md` |
| 本计划 | `docs/SKYHUNTER_开发计划与进度基准.md` |

---

## 四、外部配置清单

### 必须配置（生产环境）

| 配置项 | 环境变量/位置 | 用途 |
|--------|---------------|------|
| JWT 密钥 | `JWT_SECRET_KEY` | 认证安全 |
| 数据库 | `DATABASE_URL` | 持久化 |
| CORS | `CORS_ALLOWED_ORIGINS` | 跨域 |
| 邮件 | `BREVO_API_KEY` 或 `EMAIL_PASSWORD` | 验证码/提醒 |

### 可选配置（按需启用）

| 配置项 | 环境变量 | 用途 |
|--------|----------|------|
| Sentry | `SENTRY_DSN` | 异常追踪 |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREDITS_*` | Web 支付 |
| Apple IAP | `APPLE_IAP_SHARED_SECRET` | iOS 内购验证 |
| EAS | `app.json` → `extra.eas.projectId` | EAS Build |
| OAuth | Apple Developer / Google Cloud Console | Apple/Google 登录 |

---

## 五、数据库变更摘要

### 新增表

- `refresh_tokens`：Refresh Token 存储
- `push_tokens`：推送设备 Token

### User 表新增字段

- `auth_provider` (VARCHAR, default: 'email')
- `apple_sub` (VARCHAR, nullable)
- `google_sub` (VARCHAR, nullable)

---

## 六、后续升级建议顺序

1. **上架前必做**
   - 配置 Apple/Google OAuth 凭证并完成真机 OAuth 登录测试
   - 在 App Store Connect / Play Console 创建 IAP 产品并完成购买流程测试
   - 配置 Stripe 并完成 Web 端支付测试
   - 运行 `alembic revision --autogenerate` 生成首次迁移
   - 填写 `eas.json` 中的 Project ID 和 submit 配置

2. **上架后优先**
   - 将 i18n 接入所有主要页面
   - 补充 pytest 测试覆盖
   - 接入 Sentry 并验证错误上报

3. **体验增强**
   - 按 D1–D9 顺序逐步实现可延后功能

---

## 七、完成度计算公式

```
完成度 = (已完成项数 + 代码完成项数 × 0.8) / 总项数 × 100%
```

- **已完成**：代码 + 配置 + 验证均通过
- **代码完成**：代码就绪，尚缺外部配置或真机验证

**当前估算**：约 75–80%

---

## 八、版本记录

| 日期 | 版本 | 变更摘要 |
|------|------|----------|
| 2026-03-18 | v1.0 | 初版：15 项功能实施完成，建立基准 |
