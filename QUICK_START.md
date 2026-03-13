# SkyHunter Pro - 快速启动指南

## 前置要求

- Node.js 18+ 和 npm
- Python 3.9+
- Expo CLI（可选，用于 Native 开发）

## 后端启动

### 1. 安装依赖

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env copy` 为 `.env` 并填写必要配置：

```bash
cp ".env copy" .env
```

**必需配置**：
```env
USE_MOCK_DATA=True  # 开发环境建议使用 Mock
JWT_SECRET_KEY=your-secure-random-key-at-least-32-chars
```

**可选配置**（用于真实数据测试）：
```env
DATABASE_URL=postgresql://...  # PostgreSQL 连接字符串
SERPAPI_API_KEY=your-key       # SerpApi 密钥
CORS_ALLOWED_ORIGINS=http://localhost:19006  # 开发环境可留空
```

### 3. 启动后端

```bash
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端将在 http://localhost:8000 启动

## 前端启动

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm start
# 或
npx expo start
```

### 3. 选择运行平台

- **Web**: 按 `w` 键或访问 http://localhost:19006
- **Android**: 按 `a` 键（需要 Android 模拟器或设备）
- **iOS**: 按 `i` 键（需要 macOS 和 iOS 模拟器）

## 首次使用

### 1. 注册账号

1. 打开应用（Web 或 Native）
2. 点击 "Sign up"
3. 输入邮箱、密码和姓名（可选）
4. 注册成功后自动登录

### 2. 测试搜索

1. 进入 Search 标签页
2. 输入出发地（如 JFK）和目的地（如 PVG）
3. 选择日期
4. 点击 "SEARCH" 按钮
5. 确认费用后执行搜索
6. 查看热力图结果

### 3. 创建监控任务

1. 进入 Monitors 标签页
2. 点击右下角 `+` 按钮
3. 填写监控任务信息
4. 确认费用后创建
5. 任务将出现在列表中

### 4. 测试其他功能

- 编辑监控任务：点击任务卡片
- 删除任务：长按任务卡片
- 查看回收站：点击右下角 🗑️ 按钮
- 充值积分：进入 Profile 标签页

## 开发环境配置

### 后端开发

- **Mock 模式**：`USE_MOCK_DATA=True`（推荐开发时使用）
- **真实模式**：`USE_MOCK_DATA=False`（需要 SerpApi Key）

### 前端开发

- **API URL**：开发环境自动使用 `http://localhost:8000`
- **生产 API**：在 `app.json` 的 `extra.apiUrl` 中配置

## 常见问题

### 后端启动失败

**问题**：`USE_MOCK_DATA 环境变量未配置`

**解决**：在 `.env` 文件中添加 `USE_MOCK_DATA=True`

**问题**：`JWT_SECRET_KEY 环境变量未配置`

**解决**：在 `.env` 文件中添加 `JWT_SECRET_KEY=your-secure-key`

### 前端无法连接后端

**问题**：API 请求失败

**解决**：
1. 确认后端正在运行（http://localhost:8000）
2. 检查浏览器控制台错误信息
3. 确认 CORS 配置正确（开发环境允许所有来源）

### 路由不工作

**问题**：页面显示空白或错误

**解决**：
1. 清除缓存：`npm start -- --clear`
2. 检查 `index.ts` 是否正确使用 `expo-router/entry`
3. 确认所有页面文件都在 `app/` 目录下

### 日期选择器不工作

**问题**：Web 端日期选择器无法打开

**解决**：
1. 确认浏览器支持 HTML5 `input[type="date"]`
2. 检查控制台是否有错误
3. Native 端确认已安装 `@react-native-community/datetimepicker`

## 下一步

1. 按照 `TESTING_CHECKLIST.md` 进行完整测试
2. 配置 PostgreSQL（参考 `backend/MIGRATION_POSTGRESQL.md`）
3. 配置 SerpApi（参考 `backend/SERPAPI_VERIFICATION.md`）
4. 准备生产环境部署

## 获取帮助

- 查看项目文档
- 检查代码注释
- 查看后端日志输出
- 检查浏览器/Native 控制台错误

