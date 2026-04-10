# SkyHunter Pro — 生产部署与上架总览

本文档说明 **生产环境应部署哪些组件**、**移动端与 Web SaaS 如何接入同一套后端**、以及 **与 App Store / Google Play 配套的工程步骤**。商店审核清单、截图与元数据细则见同目录下的 [`STORE_SUBMISSION_GUIDE.md`](./STORE_SUBMISSION_GUIDE.md)。

---

## 1. 架构结论（必读）

| 组件 | 是否需要单独部署 | 说明 |
|------|------------------|------|
| **FastAPI 后端 + PostgreSQL** | **是（生产必须）** | 所有客户端共用；承载认证、业务 API、Webhook（如 Stripe）、定时任务等。 |
| **iOS / Android 应用** | **否（不在服务器上“部署”应用代码）** | 通过 EAS 构建 **IPA / AAB**，上传到 **App Store Connect** / **Google Play**。用户从商店安装；应用内通过 HTTPS 调用生产 API。 |
| **Web SaaS 前端** | **是（前端站点托管）** | Expo Web 或独立前端站点的 **静态/托管构建产物** 部署到 CDN / PaaS / 自有 Nginx；**不**需要为 Web 再写一套业务后端。 |
| **“商店专用服务器”** | **不需要** | 苹果与谷歌 **不分发你的后端**；只要客户端里的 `apiUrl` 指向公网 API 即可。 |

推荐域名划分（可按实际品牌调整）：

- `https://api.<your-domain>` — 后端 API（本项目 `frontend/app.json` 中 `extra.apiUrl` 示例为 `https://api.skyhunter.app`）。
- `https://app.<your-domain>` — Web SaaS（SPA 入口）。
- 官网/落地页可与 `www` 共用或单独子域。

---

## 2. 仓库内相关路径

| 路径 | 用途 |
|------|------|
| `backend/` | FastAPI 服务；`Dockerfile` 用于容器化部署 |
| `backend/.env.example` | 环境变量模板（生产请用密钥管理/注入，勿提交真实 `.env`） |
| `frontend/` | Expo（iOS / Android / Web）；`app.json` 含 `extra.apiUrl`、OAuth 客户端 ID、`bundleIdentifier` / `package` |
| `frontend/eas.json` | EAS Build / Submit 配置 |
| `docker-compose.yml` | **本地/单机** 编排：`backend` + `db` + 可选 `web`；生产环境通常改用托管数据库 + 单容器或多副本 |

---

## 3. 后端生产部署

### 3.1 部署要求

- **PostgreSQL**：生产使用托管实例或自建高可用集群；连接串通过 `DATABASE_URL` 注入。
- **HTTPS**：对外仅暴露 TLS；将 `https://api.<your-domain>` 反向代理到 Uvicorn 监听端口（容器内为 `8000`）。
- **进程模型**：`backend/Dockerfile` 默认 `uvicorn ... --workers 1`。流量增大时可提高 workers 或使用多实例 + 负载均衡（注意会话/定时任务单实例一致性，按实际代码评估）。

### 3.2 构建与运行（容器示例）

在已安装 Docker 的构建机或 CI 中：

```bash
# 在仓库根目录
docker build -t skyhunter-api:latest -f backend/Dockerfile backend
```

运行时需挂载或注入环境变量（勿将生产 `.env` 提交到 Git）。Compose 仅供形态参考；生产建议将 `db` 换为托管数据库服务，仅部署 API 容器/服务。

### 3.3 生产环境变量（与 `backend/.env.example` 对齐）

以下项在生产中应重点核对：

| 变量 | 生产要求 |
|------|----------|
| `USE_MOCK_DATA` | 必须为 **`false`**（或等价关闭 mock 的配置，以你部署时所用法为准） |
| `DATABASE_URL` | 指向 **生产** PostgreSQL |
| `JWT_SECRET_KEY` | 高强度随机密钥；**勿**与测试环境共用 |
| `API_BASE_URL` | 公网 API 根 URL，例如 `https://api.skyhunter.app`（用于邮件内链、部分回调拼接等） |
| `CORS_ALLOWED_ORIGINS` | 逗号分隔的 **Web 正式域名**（及必要的本地调试域）。**禁止**在生产长期使用 `*` |
| `STRIPE_*` / `STRIPE_WEBHOOK_SECRET` | 使用 Stripe **生产**密钥；Webhook URL 指向生产路由 |
| `SERPAPI_API_KEY`、邮件、OAuth 依赖的第三方 | 全部使用生产凭据 |
| `SENTRY_DSN` | 可选；用于生产错误聚合 |

若代码要求 `DB_MODE` 等变量，以当前 `backend/config.py` 与 `.env.example` 为准保持一致。

### 3.4 部署后自检

- 浏览器或 `curl` 访问文档/健康路径（若已启用 OpenAPI，通常为 `/docs`；生产可关闭或加鉴权）。
- 用生产前端或临时脚本测试：注册/登录、一条核心业务请求、Stripe Webhook 测试事件（若已接入）。

---

## 4. Web SaaS 前端部署

### 4.1 与后端关系

- Web 与 App **共用同一 `apiUrl` 对应的后端**。
- 后端必须将 **Web 站点源** 列入 `CORS_ALLOWED_ORIGINS`。

### 4.2 Expo Web（`frontend/`）

1. 确认 `app.json` 中 `extra.apiUrl` 为生产 API。
2. 使用与项目兼容的 Expo CLI 导出 Web 构建（具体命令以官方文档及当前 Expo 版本为准，常见形态为导出静态资源到 `dist` 类目录）。
3. 将导出目录上传到 **Vercel / Netlify / 云厂商静态托管 / 自建 Nginx**。
4. 配置 SPA 回退：未知路径回退到 `index.html`，避免刷新 404。

### 4.3 仓库中的 `web` 服务（`docker-compose.yml`）

Compose 中包含可选 `web` 服务（端口 `3000`）。若生产单独维护该站点，请明确：**它与 Expo Web 的分工**，避免两套前端长期漂移；OAuth 回调域名与 Stripe `success_url` / `cancel_url` 须与真实入口一致。

---

## 5. 移动端：EAS 构建与商店提交

### 5.1 前置条件

- Expo 账户与 EAS Project（`app.json` → `extra.eas.projectId`）。
- `frontend/eas.json`：**补全** `submit.production.ios` 的 `appleId`、`ascAppId`、`appleTeamId`；Android 配置 **Google Play 服务账号 JSON** 路径，并将 `track` 从内测逐步切到 `production`。
- 包标识与商店一致：**iOS** `app.skyhunter.flight`，**Android** `app.skyhunter.flight`（见 `frontend/app.json`）。

### 5.2 常用命令

在 `frontend` 目录执行：

```bash
# iOS 生产构建
eas build --platform ios --profile production

# Android 生产构建（AAB）
eas build --platform android --profile production

# 提交（需先完成 eas.json / 凭证配置）
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

更完整的审核前勾选、截图尺寸、隐私链接等见 [`STORE_SUBMISSION_GUIDE.md`](./STORE_SUBMISSION_GUIDE.md)。

### 5.3 “应用如何连上后端与商店”（工程含义）

- **连后端**：生产构建中 `extra.apiUrl` 必须指向公网 HTTPS API；无本地回环地址。
- **OAuth（Google / Apple）**：在各自控制台中为 iOS Bundle ID、Android 包名+签名、Web 类型客户端配置一致；重定向 URI 与后端路由匹配。
- **深度链接 / 应用链接**：若使用自定义 scheme（如 `skyhunter`）或 Universal Links / App Links，按平台要求配置域名验证文件。
- **与苹果/谷歌“沟通”**：日常通过 **App Store Connect**、**Play Console** 的审核与 Resolution Center；无需单独“部署到苹果服务器”。

---

## 6. 安全与运维建议

- **密钥**：生产密钥由平台密钥管理或 CI 秘密变量注入；轮换 `JWT_SECRET_KEY` 会导致已签发 token 失效，需计划维护窗口。
- **数据库**：自动备份、连接 TLS（若云厂商支持）、最小权限账号。
- **依赖与镜像**：定期更新基础镜像与 `requirements.txt`，关注 CVE。
- **日志**：容器 stdout + 集中日志；文件日志路径见 `backend/config.py`（持久卷时注意容量）。

---

## 7. 发布顺序建议（可执行流水线）

1. 部署 **生产 PostgreSQL** 与 **后端 API**，完成 TLS 与 `CORS_ALLOWED_ORIGINS`。
2. 部署 **Web SaaS** 静态站点，联调登录与核心业务流程。
3. 配置 Stripe（或其他支付）**生产** Webhook 指向上一步 API。
4. `eas build` 生产包，**内测轨道**（TestFlight / Play internal）全链路验证。
5. 填写商店元数据、隐私与数据安全问卷，**提交审核**。
6. 审核通过后分阶段发布；保留回滚版本与数据库迁移策略。

---

## 8. 文档索引

- [`STORE_SUBMISSION_GUIDE.md`](./STORE_SUBMISSION_GUIDE.md) — App Store / Play 材料清单与 EAS 命令摘要  
- [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) / [`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md) — 上架常用法律页面（URL 需可公网访问）

---

*本文档随仓库演进；若 `app.json`、`eas.json` 或环境变量约定变更，请同步更新本节。*
