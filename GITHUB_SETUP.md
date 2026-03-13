# SkyHunter Pro - GitHub 上传指南

## 一、已配置的 .gitignore

项目根目录已创建 `.gitignore`，会忽略以下内容：

### 敏感文件（绝不提交）
- `*.env`、`.env.local`、`.env.remote` 等（仅保留 `.env.example` 作为模板）
- `*.pem`、`*.key`、`*.keystore`、`*.p12`、`*.jks`
- `credentials*`、`secrets*`

### 依赖与构建产物
- `node_modules/`、`venv/`、`.expo/`
- `*.db`、`*.sqlite`、`skyhunter_local.db`
- `dist/`、`build/`、`*.ipa`、`*.apk`

### 其他
- `__pycache__/`、`.idea/`、`.vscode/`、`.DS_Store`、`*.log`

---

## 二、上传到 GitHub 的步骤

在项目根目录 `d:\SkyHunter\SkyHunter_Pro` 下执行：

### 1. 初始化 Git（若尚未初始化）

```powershell
git init
```

### 2. 添加远程仓库

```powershell
git remote add origin https://github.com/onesky2015/skyhunter_pro.git
```

若已有 `origin` 且地址不同，可先删除再添加：

```powershell
git remote remove origin
git remote add origin https://github.com/onesky2015/skyhunter_pro.git
```

### 3. 添加文件并提交

```powershell
git add .
git status
```

检查 `git status` 输出，确认未被忽略的敏感文件（如 `.env`、`*.key`）不应出现在列表中。

```powershell
git commit -m "Initial commit: SkyHunter Pro - Expo + FastAPI"
```

### 4. 推送到 GitHub

```powershell
git branch -M main
git push -u origin main
```

若 `main` 已存在且需强制覆盖：

```powershell
git push -u origin main --force
```

---

## 三、安全检查清单

推送前请确认：

- [ ] `.env`、`.env.local`、`.env.remote` 等未出现在 `git status` 中
- [ ] `backend/venv/` 未被提交
- [ ] `frontend/node_modules/` 未被提交
- [ ] `*.db` 数据库文件未被提交
- [ ] 无硬编码的 API Key、JWT Secret、数据库密码等

---

## 四、新环境克隆后的配置

克隆后需在 `backend/` 下创建 `.env`：

```powershell
cd backend
copy .env.example .env
```

然后编辑 `.env`，填入真实配置（如 `JWT_SECRET_KEY`、`DATABASE_URL` 等）。
