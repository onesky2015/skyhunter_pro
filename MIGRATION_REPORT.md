# SkyHunter Pro v3.0.0 - 完整功能升级报告

## 📊 旧版 MVP vs 新版 Pro 功能对比

### ✅ 已完整实现的核心功能

| # | 功能 | 旧版位置 | 新版位置 | 说明 |
|---|------|---------|---------|------|
| 1 | **数据库持久化** | `database.py`, `models.py` | ✅ `MonitorTask` + `PriceHistory` SQLModel | SQLite 本地存储 |
| 2 | **监控任务 CRUD** | `subscription_service.py`, `routes.py` | ✅ `POST/GET/DELETE /api/v1/monitors` | 完整 REST API |
| 3 | **后台调度器** | `scheduler.py` (APScheduler 每1分钟) | ✅ APScheduler 每4小时 | 定时检查所有活跃任务 |
| 4 | **邮件通知** | `notification_service.py` (Brevo) | ✅ `send_alert_email()` | 降价达标时触发 |
| 5 | **30天热力图** | `frontend.py` (单日查询) | ✅ `POST /api/v1/search` | level 分级 (low/med/high) |
| 6 | **Mock 模式** | ❌ 旧版无 | ✅ `USE_MOCK_DATA = True` | 节省 API 费用 |
| 7 | **舱位等级支持** | ✅ 4种舱位 | ✅ economy/premium/business/first | 前端 4 按钮选择器 |
| 8 | **乘客数量** | ✅ adults + children | ✅ + / - 步进器 | 范围 1-9 成人，0-9 儿童 |
| 9 | **价格历史记录** | `price_history` 表 | ✅ `price_history` 表 + API | `GET /monitors/{id}/history` |
| 10 | **目标价格** | ✅ target_price | ✅ target_price | 达标后标记 'found' |
| 11 | **实时状态** | ✅ last_checked_at | ✅ "Checked: 2h ago" | timeAgo() 友好显示 |
| 12 | **长按删除** | ❌ 旧版无 | ✅ onLongPress | 确认对话框 |
| 13 | **下拉刷新** | ❌ 旧版无 | ✅ RefreshControl | 拉动刷新列表 |
| 14 | **SerpApi 集成** | ✅ `flight_engine.py` | ✅ `_search_serpapi_single_day()` | Google Flights API |
| 15 | **赛博朋克 UI** | ❌ 旧版 Streamlit | ✅ React Native | 黑绿配色 + 热力图 |

### ❌ 旧版有但新版尚未实现的高级功能

<table>
<tr><th>类别</th><th>功能</th><th>旧版实现</th><th>新版状态</th><th>优先级</th></tr>
<tr><td rowspan="7"><b>搜索参数</b></td><td>返程日期（往返票）</td><td>✅ return_date</td><td>❌ 只支持单程</td><td>🟡 P1</td></tr>
<tr><td>搜索策略 (best/cheapest)</td><td>✅ strategy</td><td>❌ 固定 best</td><td>🟡 P1</td></tr>
<tr><td>中转限制 (max_stops)</td><td>✅ 0=直飞</td><td>✅ 已实现</td><td>✅ Done</td></tr>
<tr><td>航空联盟筛选</td><td>✅ alliance</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>航司偏好</td><td>✅ airline_preference</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>起飞时间窗口</td><td>✅ departure_time_window</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>降落时间窗口</td><td>✅ landing_time_window</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td rowspan="5"><b>任务管理</b></td><td>暂停/恢复</td><td>✅ PATCH status</td><td>❌ 缺失</td><td>🟡 P1</td></tr>
<tr><td>编辑任务</td><td>✅ PUT /subscriptions</td><td>❌ 缺失</td><td>🟡 P1</td></tr>
<tr><td>自定义频率</td><td>✅ interval_minutes</td><td>❌ 固定 4h</td><td>🟡 P1</td></tr>
<tr><td>客户名称/等级</td><td>✅ client_name/tier</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>服务到期日期</td><td>✅ service_end_date</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td rowspan="2"><b>通知</b></td><td>Telegram 通知</td><td>✅ notify_telegram</td><td>❌ 缺失</td><td>🟡 P1</td></tr>
<tr><td>通知配置开关</td><td>✅ 每个任务独立</td><td>❌ 全局邮箱</td><td>🟡 P1</td></tr>
<tr><td rowspan="6"><b>多用户系统</b></td><td>用户认证</td><td>✅ login/change_password</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>Admin/Agent 角色</td><td>✅ 双视图</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>数据隔离</td><td>✅ user_id 过滤</td><td>❌ 单用户</td><td>🟢 P2</td></tr>
<tr><td>积分/余额系统</td><td>✅ credits 扣费</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>交易流水</td><td>✅ transaction_history</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>充值/分销</td><td>✅ admin_deposit/transfer</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td rowspan="3"><b>高级功能</b></td><td>搜索缓存</td><td>✅ search_cache 表</td><td>❌ 缺失</td><td>🟡 P1</td></tr>
<tr><td>周报系统</td><td>✅ 每周五发送</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
<tr><td>数据库备份</td><td>✅ 每日邮件备份</td><td>❌ 缺失</td><td>🟢 P2</td></tr>
</table>

---

## 🚀 新版 v3.0.0 新增功能

| 功能 | 说明 |
|------|------|
| **统一 REST API** | 替代 Streamlit，支持移动端/Web/任意客户端 |
| **热力图可视化** | 30天价格等级 (low/medium/high/unavailable) |
| **前端现代化** | React Native + 赛博朋克 UI + 跨平台 |
| **Mock 开关** | 一键切换真实/模拟数据，节省调试成本 |
| **舱位选择器** | 4个按钮：Economy / Premium / Business / First |
| **乘客步进器** | +/- 按钮调整成人和儿童数量 |
| **长按删除** | iOS/Android 原生交互 |
| **下拉刷新** | 原生下拉刷新组件 |

---

## 📁 文件结构

```
SkyHunter_Pro/
├── backend/
│   ├── main.py               # ✅ FastAPI 主应用 (v3.0.0, 1052 行)
│   ├── requirements.txt      # ✅ 依赖清单
│   ├── skyhunter_pro.db      # ✅ SQLite 数据库（自动创建）
│   └── venv/                 # Python 虚拟环境
├── frontend/
│   ├── App.tsx               # ✅ React Native 主界面 (v3.0.0, 715 行)
│   ├── package.json          # Node.js 依赖
│   └── assets/               # 图标资源
└── MIGRATION_REPORT.md       # 本文档
```

---

## 🔧 安装与启动

### 后端安装

```bash
cd backend
pip install -r requirements.txt

# 依赖清单：
# - fastapi==0.109.0
# - uvicorn==0.27.0
# - sqlmodel>=0.0.14          ← 数据库 ORM
# - apscheduler>=3.10.0       ← 后台调度器
# - requests>=2.31.0
# - google-search-results>=2.4.2
# - python-dotenv>=1.0.0
```

### 后端启动

```bash
cd backend
python main.py
# 或: uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 前端启动

```bash
cd frontend
npm install
npx expo start --web    # Web 版
npx expo start          # 移动端（扫码）
```

---

## 🔑 环境变量配置

创建 `backend/.env` 文件：

```bash
# ============ Mock 模式开关 ============
# 在代码中修改 USE_MOCK_DATA = True/False

# ============ SerpApi (真实搜索) ============
SERPAPI_API_KEY=your_serpapi_key_here

# ============ 邮件通知 (Brevo API) ============
BREVO_API_KEY=your_brevo_key_here
EMAIL_SENDER=noreply@skyhunter.app
ADMIN_EMAIL=admin@example.com

# ============ 调度器配置 ============
SCHEDULER_INTERVAL_HOURS=4    # 默认 4 小时检查一次

# ============ 缓存配置 ============
CACHE_HOURS=4
```

---

## 📡 API 端点列表

### Health & Status

- `GET /` - 服务状态
- `GET /health` - 健康检查（含调度器状态）

### 一次性搜索（无状态）

- `POST /api/v1/search` - 30天热力图搜索

**请求示例**:
```json
{
  "origin": "JFK",
  "destination": "PVG",
  "start_date": "2026-04-01",
  "days": 30,
  "cabin_class": "business",
  "adults": 2,
  "children": 1,
  "max_stops": null
}
```

**响应包含**:
- `heatmap_data[]` - 30 个格子的价格和等级
- `lowest_price` / `average_price` / `highest_price`
- `best_flight` - 最佳航班详情
- `data_source` - "mock" 或 "serpapi"

### 持久化监控任务

- `POST /api/v1/monitors` - **创建监控任务**（存数据库 + 立即查价）

**请求示例**:
```json
{
  "origin": "JFK",
  "destination": "PVG",
  "start_date": "2026-04-15",
  "days": 30,
  "cabin_class": "business",
  "adults": 2,
  "children": 1,
  "target_price": 3500,
  "notification_email": "user@example.com"
}
```

- `GET /api/v1/monitors` - **获取所有任务**（倒序）
- `DELETE /api/v1/monitors/{id}` - **删除任务**
- `GET /api/v1/monitors/{id}/history` - 价格历史记录

---

## 🧪 测试验证结果

### 后端 API 测试（全部通过）

```
✅ Create Business Class Monitor (2A + 1C)  → 201 (ID=3, $4238, status=active)
✅ Create First Class Monitor (1A)          → 201 (ID=4, $4067, status=active)
✅ List All Monitors                        → 200 (4 tasks with cabin/passengers)
✅ Delete Monitor                           → 204
✅ Search Heatmap                           → 200 (30 cells, level distribution)
✅ Health Check                             → 200 (scheduler_running: true)
```

### 前端功能测试

| 功能 | 状态 |
|------|------|
| 30天热力图渲染（绿/黄/红/灰） | ✅ |
| Modal 舱位选择器（4 按钮） | ✅ |
| Modal 乘客数量调整（+ / -） | ✅ |
| Modal 日期输入（YYYY-MM-DD） | ✅ |
| Modal 目标价格输入 | ✅ |
| Modal 邮箱输入 | ✅ |
| Route Feed 从数据库加载 | ✅ |
| Route Feed 显示舱位/乘客 | ✅ |
| Route Feed 显示实时状态 | ✅ |
| 长按删除任务 | ✅ |
| 下拉刷新 | ✅ |

---

## 🎨 前端 UI 亮点

### Add Monitor Modal（完整表单）

```
┌─────────────────────────────────────┐
│ New Monitor                         │
│ Set up a persistent price monitor.  │
│ We'll check every 4 hours.          │
│                                     │
│ ORIGIN (出发地)                     │
│ ┌─────────────────────────────────┐ │
│ │         JFK         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ DESTINATION (目的地)                │
│ ┌─────────────────────────────────┐ │
│ │         PVG         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ START DATE (起始日期)               │
│ ┌─────────────────────────────────┐ │
│ │    2026-04-01      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ CABIN CLASS (舱位等级)              │
│ ┌───┐ ┌────┐ ┌───┐ ┌───┐           │
│ │Eco│ │Prem│ │Biz│ │1st│  ← 4按钮 │
│ └───┘ └────┘ └───┘ └───┘           │
│  ✓                                  │
│                                     │
│ PASSENGERS (乘客数量)                │
│ ┌──────────┐  ┌──────────┐         │
│ │ Adults   │  │ Children │         │
│ │ [-] 2 [+]│  │ [-] 1 [+]│  ← 步进器│
│ └──────────┘  └──────────┘         │
│                                     │
│ TARGET PRICE USD (目标价格)         │
│ ┌─────────────────────────────────┐ │
│ │    e.g. 900    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ NOTIFICATION EMAIL (通知邮箱)       │
│ ┌─────────────────────────────────┐ │
│ │  you@example.com   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌────────┐     ┌────────┐          │
│ │ CANCEL │     │ CREATE │          │
│ └────────┘     └────────┘          │
└─────────────────────────────────────┘
```

### Route Feed Card（实时数据）

```
┌──────────────────────────────────────────────┐
│ ┃ JFK → PVG                         $4,238  │
│ ┃ 2026-04-15 · 30d · Target: $3500         │
│ ┃ 💼 Business · 2 adults + 1 child    ┌───┐ │
│ ┃ Checked: 5m ago                     │ACT│ │
│ ┃                                     └───┘ │
└──────────────────────────────────────────────┘
  ↑ 绿色边框（found）或黄色边框（active）
  
长按弹出删除确认对话框
```

---

## 🔄 后台调度器工作流程

```
启动时
  ↓
初始化数据库 (SQLModel.metadata.create_all)
  ↓
启动 APScheduler (interval=4h)
  ↓
立即执行首次检查
  ↓
┌─────────────────────────────────────────┐
│ 每 4 小时执行一次                        │
│                                         │
│ 1. 查询所有 status='active' 的任务     │
│ 2. 逐个检查：                           │
│    - 检查是否过期 (start_date + days)   │
│    - 执行搜索 (Mock 或 SerpApi)         │
│    - 更新 current_price                 │
│    - 如果 < lowest_price，更新          │
│    - 如果 <= target_price:              │
│      • 标记 status = 'found'            │
│      • 发送邮件通知                     │
│    - 记录价格历史                       │
│ 3. 速率限制：每个任务间隔 2 秒          │
└─────────────────────────────────────────┘
```

---

## 💰 价格计算逻辑（Mock 模式）

### 舱位等级价格系数

```python
CABIN_PRICE_MULTIPLIER = {
    "economy": 1.0,           # 基准
    "premium_economy": 1.6,   # +60%
    "business": 3.2,          # +220%
    "first": 5.5,             # +450%
}
```

### 动态调整因素

1. **长途航线**: JFK↔PVG, LAX↔NRT 等基础价格 $800-1800（短途 $600-1500）
2. **周末涨价**: 周六/周日 +15-30%
3. **临近起飞涨价**:
   - < 7天: +20-40%
   - 7-14天: +5-15%
   - \> 14天: 正常
4. **舱位系数**: 最终价格 = 基础价格 × 舱位系数
5. **随机无数据**: 8% 概率标记为 unavailable

**示例计算**:
- JFK → PVG, Business, 周六, 5天后
- 基础: $1200
- 周末: $1200 × 1.25 = $1500
- 临近: $1500 × 1.30 = $1950
- 舱位: $1950 × 3.2 = **$6240**

---

## 📊 数据库结构

### monitor_tasks 表

```sql
CREATE TABLE monitor_tasks (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    origin               VARCHAR(3) NOT NULL,
    destination          VARCHAR(3) NOT NULL,
    start_date           VARCHAR(10) NOT NULL,
    days                 INTEGER DEFAULT 30,
    cabin_class          VARCHAR(20) DEFAULT 'economy',
    adults               INTEGER DEFAULT 1,          -- ✅ 新增
    children             INTEGER DEFAULT 0,          -- ✅ 新增
    target_price         FLOAT NULL,
    notification_email   VARCHAR NULL,
    status               VARCHAR(10) DEFAULT 'active',
    lowest_price         FLOAT NULL,
    lowest_price_date    VARCHAR(10) NULL,
    current_price        FLOAT NULL,
    last_checked_at      VARCHAR NULL,
    created_at           VARCHAR NOT NULL,
    booking_link         VARCHAR NULL,
    airline              VARCHAR NULL,
    flight_number        VARCHAR NULL
);
```

### price_history 表

```sql
CREATE TABLE price_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id   INTEGER NOT NULL,
    price        FLOAT NOT NULL,
    checked_at   VARCHAR NOT NULL,
    booking_link VARCHAR NULL,
    FOREIGN KEY (monitor_id) REFERENCES monitor_tasks(id)
);
```

---

## 🧪 快速测试脚本

### 测试舱位和乘客功能

```python
import requests

BASE = "http://127.0.0.1:8000"

# 创建 Business Class 监控（2成人 + 1儿童）
r = requests.post(f"{BASE}/api/v1/monitors", json={
    "origin": "JFK",
    "destination": "PVG",
    "start_date": "2026-04-15",
    "days": 30,
    "cabin_class": "business",
    "adults": 2,
    "children": 1,
    "target_price": 3500,
    "notification_email": "test@example.com"
})

print(r.json())
# 输出: {'id': 1, 'cabin_class': 'business', 'adults': 2, 'children': 1, ...}

# 获取所有任务
monitors = requests.get(f"{BASE}/api/v1/monitors").json()
for m in monitors:
    print(f"#{m['id']} {m['origin']}->{m['destination']} | {m['cabin_class']} | {m['adults']}A+{m['children']}C")
```

---

## 📈 性能优化建议

### 当前状态（v3.0.0）

- ✅ Mock 模式：零 API 调用，无限调试
- ✅ 速率限制：SerpApi 调用间隔 1.5-2 秒
- ✅ SQLite 本地数据库：快速查询，无网络延迟
- ❌ 搜索缓存：未实现（每次都重新查询）

### 下一步优化（P1 待实现）

1. **搜索缓存**: 存储 SerpApi 结果 4 小时，避免重复查询
2. **批量查询**: 调度器应批量处理任务，而非逐个
3. **异步 IO**: 使用 `asyncio` + `aiohttp` 并发查询
4. **PostgreSQL**: 替换 SQLite，支持多实例部署
5. **Redis 缓存**: 热数据缓存，加速读取

---

## 🐛 已知问题 & 解决方案

### 问题 1: 数据库字段变更导致服务器崩溃

**现象**: 添加新字段后启动报错 `no such column: monitor_tasks.adults`

**原因**: SQLModel 的 `create_all()` 不执行 ALTER TABLE 迁移

**解决方案**:
```bash
# 方案 A: 删除旧数据库（开发阶段）
cd backend
rm skyhunter_pro.db
# 重启服务器，自动重建表

# 方案 B: 手动添加列（保留数据）
python -c "import sqlite3; conn = sqlite3.connect('skyhunter_pro.db'); c = conn.cursor(); c.execute('ALTER TABLE monitor_tasks ADD COLUMN adults INTEGER DEFAULT 1'); c.execute('ALTER TABLE monitor_tasks ADD COLUMN children INTEGER DEFAULT 0'); conn.commit(); conn.close()"
```

### 问题 2: Windows 终端 Unicode 编码错误

**现象**: `UnicodeEncodeError: 'gbk' codec can't encode character`

**解决方案**: 在测试脚本中添加编码修复
```python
import sys, codecs
if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
```

---

## 🚧 路线图：P1 优先级功能（下一步实现）

| # | 功能 | 工作量 | 价值 |
|---|------|--------|------|
| 1 | **返程日期** (往返票支持) | 中等 | 高 |
| 2 | **暂停/恢复** 任务 | 小 | 高 |
| 3 | **编辑任务** (PATCH API) | 中等 | 高 |
| 4 | **搜索缓存** (search_cache 表) | 大 | 高（省钱）|
| 5 | **Telegram 通知** | 小 | 中 |
| 6 | **自定义监控频率** | 小 | 中 |
| 7 | **搜索策略** (best/cheapest 切换) | 小 | 中 |

---

## 📝 代码质量

- ✅ **类型安全**: 完整的 Pydantic 和 TypeScript 接口
- ✅ **错误处理**: 所有 API 调用包裹 try-except
- ✅ **日志完善**: 结构化日志，便于调试
- ✅ **CORS 配置**: 支持 Expo / Web 跨域请求
- ✅ **代码注释**: 完整的 docstrings 和行内注释
- ✅ **零 Lint 错误**: 通过 ESLint 和 Python 静态检查

---

## 🎯 总结

### 当前版本 (v3.0.0) 核心能力

1. ✅ **持久化监控** - 创建任务后自动定时检查
2. ✅ **完整参数支持** - 舱位、乘客、日期、目标价
3. ✅ **邮件通知** - Brevo API 降价提醒
4. ✅ **热力图可视化** - 30天价格趋势
5. ✅ **Mock 调试** - 零成本开发测试
6. ✅ **现代 UI** - React Native 跨平台

### 与旧版 MVP 的主要差异

| 维度 | 旧版 MVP | 新版 Pro v3.0 |
|------|---------|--------------|
| **前端技术** | Streamlit (Python Web) | React Native (跨平台) |
| **API 架构** | 单体 (frontend.py 调用 backend) | RESTful API (解耦) |
| **数据可视化** | 表格 + 状态卡片 | 热力图 + 赛博朋克 UI |
| **多用户** | ✅ Admin/Agent 角色系统 | ❌ 单用户（P2 待实现） |
| **高级筛选** | ✅ 联盟/航司/时间窗口 | ❌ 基础参数（P2 待实现） |
| **积分系统** | ✅ 充值/扣费/流水 | ❌ 无计费（P2 待实现） |
| **调试成本** | ❌ 每次查询都调 API | ✅ Mock 模式零成本 |

---

**结论**: 新版 v3.0.0 已实现 **核心监控功能**，适合作为 React Native App 的 MVP 后端。高级功能（多用户、积分、高级筛选）属于 P1/P2 路线图，可按需迭代开发。

