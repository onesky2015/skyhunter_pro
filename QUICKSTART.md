# SkyHunter Pro - 快速启动指南

## 🚀 5 分钟启动完整系统

### 步骤 1: 启动后端 API

```bash
# 进入后端目录
cd backend

# 安装依赖（首次运行）
pip install -r requirements.txt

# 启动服务器
python main.py
# 或: uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**看到以下日志说明成功**:
```
============================================================
🚀 SkyHunter Pro API v3.0.0 Starting...
   Mock Mode: ON (省钱模式)
   Scheduler: Every 4 hours
   Database: skyhunter_pro.db
============================================================
✅ 数据库表已初始化
⏰ 调度器已启动: 每 4 小时执行一次
🔍 启动后立即执行首次检查...
💓 [Scheduler] 心跳 08:12:26 UTC - 检查活跃任务...
  ℹ️ 无活跃任务
INFO:     Application startup complete.
```

### 步骤 2: 启动前端 App

```bash
# 进入前端目录
cd frontend

# 安装依赖（首次运行）
npm install

# Web 版
npx expo start --web

# 移动端（iOS/Android 模拟器或扫码真机）
npx expo start
```

**访问地址**:
- Web: http://localhost:19006 或 http://localhost:8081
- 移动端: 扫描终端二维码

---

## 🧪 快速测试 API

### 测试 1: 健康检查

```bash
curl http://localhost:8000/health
```

**期望输出**:
```json
{
  "status": "healthy",
  "service": "SkyHunter Pro API",
  "version": "3.0.0",
  "mock_mode": true,
  "scheduler_running": true
}
```

### 测试 2: 创建监控任务

```bash
curl -X POST http://localhost:8000/api/v1/monitors \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "PVG",
    "start_date": "2026-04-15",
    "days": 30,
    "cabin_class": "business",
    "adults": 2,
    "children": 1,
    "target_price": 3500,
    "notification_email": "test@example.com"
  }'
```

**期望输出** (201 Created):
```json
{
  "id": 1,
  "origin": "JFK",
  "destination": "PVG",
  "cabin_class": "business",
  "adults": 2,
  "children": 1,
  "current_price": 4238.54,
  "status": "active",
  "airline": "American Airlines",
  "flight_number": "AA6181"
}
```

### 测试 3: 获取所有任务

```bash
curl http://localhost:8000/api/v1/monitors
```

### 测试 4: 30天热力图搜索

```bash
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "PVG",
    "start_date": "2026-04-01",
    "days": 30,
    "cabin_class": "economy"
  }'
```

**响应包含**:
- `heatmap_data`: 30 个格子的 `{date, price, level}`
- `lowest_price` / `average_price` / `highest_price`
- `best_flight`: 航班详情

---

## 🎮 前端使用指南

### 主界面功能

1. **热力图查看**
   - 绿色格子 = 低价（< 均价 15%）
   - 黄色格子 = 中等（均价附近）
   - 红色格子 = 高价（> 均价 15%）
   - 深灰色 = 无航班数据
   - 点击格子查看具体日期和价格

2. **ADD MONITOR 按钮**
   - 点击打开创建表单
   - 填写完整信息（必填：Origin、Destination、Date）
   - 可选：舱位、乘客、目标价、邮箱
   - 点击 CREATE 立即创建并执行首次查询

3. **Route Feed 任务列表**
   - 显示所有持久化监控任务
   - 绿色边框 = 已找到达标价格
   - 黄色边框 = 活跃监控中
   - 灰色边框 = 已过期
   - **长按任务卡片** → 弹出删除确认
   - 显示实时状态："Checked: 2h ago"

4. **下拉刷新**
   - 在主界面下拉即可刷新热力图和任务列表

---

## 🔐 生产环境配置

### 环境变量（backend/.env）

```bash
# ========== 必需配置 ==========
# 关闭 Mock 模式（使用真实 SerpApi）
# → 修改代码: USE_MOCK_DATA = False

# SerpApi 密钥
SERPAPI_API_KEY=your_serpapi_key_here

# ========== 可选配置 ==========
# Brevo 邮件通知
BREVO_API_KEY=your_brevo_key_here
EMAIL_SENDER=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# 调度器间隔（小时）
SCHEDULER_INTERVAL_HOURS=2

# 缓存有效期（小时）
CACHE_HOURS=4
```

### 切换到真实 SerpApi

编辑 `backend/main.py` 第 33 行:

```python
# 改为 False 启用真实 API
USE_MOCK_DATA: bool = False  # ← 改这里
```

### 部署建议

**推荐方案**: Railway / Render / Fly.io

```bash
# Dockerfile (可选)
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**注意事项**:
1. 生产环境应使用 PostgreSQL 替换 SQLite
2. 配置环境变量，禁用 Mock 模式
3. 限制 CORS `allow_origins` 为具体域名
4. 添加 API 认证（JWT）
5. 启用 HTTPS

---

## 🆘 故障排查

### 问题: 前端无法连接后端

**检查清单**:
1. 后端服务器是否运行？ → `curl http://localhost:8000/health`
2. CORS 是否开启？ → 后端日志中应有 `CORS middleware enabled`
3. 前端 API_URL 是否正确？ → 检查 `App.tsx` 中的 `getApiUrl()`
4. Android 模拟器？ → 应使用 `10.0.2.2:8000`，非 `localhost`

### 问题: Mock 价格不合理

**调整参数**:
编辑 `backend/main.py` 中的价格生成逻辑：
- `base_low` / `base_high`: 基础价格范围
- `CABIN_PRICE_MULTIPLIER`: 舱位系数
- 周末/临近涨价比例

### 问题: 调度器未运行

**检查**:
```bash
curl http://localhost:8000/health
# 查看: "scheduler_running": true
```

**手动触发**:
```python
import requests
requests.post("http://localhost:8000/api/v1/monitors")  # 创建任务会触发立即检查
```

---

## 📚 API 文档

启动后端后访问：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

交互式 API 测试，无需 curl 或 Postman。

---

## 💡 开发技巧

### 1. 快速重建数据库

```bash
cd backend
rm skyhunter_pro.db
# 重启服务器（自动重建）
```

### 2. 手动触发调度器（调试）

```python
# 在 Python REPL 中
import requests
r = requests.post("http://localhost:8000/api/v1/monitors", json={
    "origin": "TEST", "destination": "TEST", "start_date": "2026-12-31"
})
# 调度器会在下一个 4 小时周期自动检查此任务
```

### 3. 查看数据库内容

```bash
cd backend
python -c "
import sqlite3
conn = sqlite3.connect('skyhunter_pro.db')
cursor = conn.cursor()
cursor.execute('SELECT id, origin, destination, cabin_class, adults, children, status, current_price FROM monitor_tasks')
rows = cursor.fetchall()
for r in rows:
    print(r)
"
```

### 4. 前端热重载

Expo 支持代码热重载：
- 保存 `App.tsx` 后自动刷新
- 摇晃手机打开开发菜单
- `r` 键快速重载

---

## 🎓 学习资源

- **FastAPI 文档**: https://fastapi.tiangolo.com/
- **SQLModel 文档**: https://sqlmodel.tiangolo.com/
- **APScheduler 文档**: https://apscheduler.readthedocs.io/
- **SerpApi Google Flights**: https://serpapi.com/google-flights-api
- **Brevo API**: https://developers.brevo.com/docs
- **React Native**: https://reactnative.dev/
- **Expo**: https://docs.expo.dev/

---

**最后更新**: 2026-02-10  
**当前版本**: v3.0.0  
**下一版本**: v3.1.0 (计划实现返程票、搜索缓存、暂停/恢复)

