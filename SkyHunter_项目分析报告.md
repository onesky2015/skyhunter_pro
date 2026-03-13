# SkyHunter 项目分析报告

> **版本：** v1.4.5  
> **生成日期：** 2026-03-10  
> **文档用途：** 项目现状分析 · 多端拆分技术架构 · 上架商店依据

---

## 目录

- [一、项目总览](#一项目总览)
- [二、技术栈现状](#二技术栈现状)
- [三、已实现功能清单](#三已实现功能清单)
- [四、代码结构详解](#四代码结构详解)
- [五、数据模型设计](#五数据模型设计)
- [六、API 端点清单](#六api-端点清单)
- [七、技术债务与风险评估](#七技术债务与风险评估)
- [八、多端拆分技术架构方案](#八多端拆分技术架构方案)
- [九、上架苹果/安卓商店关键要求](#九上架苹果安卓商店关键要求)
- [十、后端部署架构升级方案](#十后端部署架构升级方案)
- [十一、代码复用评估](#十一代码复用评估)
- [十二、分阶段实施路线图](#十二分阶段实施路线图)
- [附录：文件清单与行数统计](#附录文件清单与行数统计)

---

## 一、项目总览

### 1.1 项目定位

**SkyHunter** 是一个 **航班价格监控 B2B2C SaaS 平台**，采用 Admin（管理员）+ Agent（代理商）双角色模型。核心能力是通过 SerpApi 调用 Google Flights 数据源，为用户提供自动化的航班价格追踪和降价提醒服务。

### 1.2 商业模式

- **B2B（管理员 → 代理商）：** Admin 向 Agent 分销积分，Agent 使用积分为客户创建监控任务
- **B2C（代理商 → 终端用户）：** Agent 为客户设置航班监控，当价格低于目标价时发送通知
- **计费方式：** 按查询次数扣积分，支持动态定价和任务独立定价

### 1.3 当前部署

- **平台：** Hugging Face Spaces（Docker 容器）
- **地址：** `https://huggingface.co/spaces/holderzhang/skyhunter`
- **端口：** Streamlit 前端 7860（对外），FastAPI 后端 8000（内部）

---

## 二、技术栈现状

| 层级 | 技术 | 版本/说明 |
|------|------|-----------|
| **后端框架** | FastAPI + Uvicorn | REST API 服务，端口 8000 |
| **前端** | Streamlit | Python Web UI，端口 7860，约 3700 行单文件 |
| **数据库** | PostgreSQL (Supabase) / SQLite | ORM 使用 SQLModel (SQLAlchemy) |
| **定时调度** | APScheduler (BackgroundScheduler) | 进程内后台调度器 |
| **认证** | Argon2 密码哈希 (passlib) | 无 JWT/OAuth，基于 X-User-Id Header |
| **邮件通知** | Brevo HTTP API | 价格警报、周报、数据库备份 |
| **即时通知** | Telegram Bot API | 降价推送 |
| **数据源** | SerpApi (Google Flights) | 航班价格查询 |
| **配置管理** | python-dotenv | .env 文件 |
| **数据处理** | pandas | 前端表格展示 |
| **容器化** | Docker (Python 3.10-slim) | Hugging Face Spaces 部署 |
| **AI 支持** | openai, google-generativeai | 已引入依赖，具体用途待确认 |

### Python 依赖清单 (requirements.txt)

```
# 核心 Web 框架
fastapi, uvicorn, streamlit, python-multipart

# 数据库支持
sqlmodel, sqlalchemy, psycopg2-binary

# 核心功能库
google-search-results, python-dotenv, pandas, requests, pillow, 
greenlet, click, pydantic, tenacity, watchdog

# 定时任务
APScheduler

# 认证与安全
passlib[argon2], argon2-cffi

# AI 支持
openai, google-generativeai
```

---

## 三、已实现功能清单

### 3.1 核心业务功能

| 模块 | 功能 | 状态 | 实现文件 |
|------|------|------|----------|
| **航班监控** | 固定日期价格查询 | ✅ 完成 | `flight_engine.py` |
| | 日期范围批量查询 | ✅ 完成 | `flight_engine.py` |
| | 搜索结果缓存（减少 API 调用） | ✅ 完成 | `flight_engine.py` + `SearchCache` 模型 |
| | 航司偏好 / 排除航司筛选 | ✅ 完成 | `flight_engine.py` |
| | 航空联盟偏好筛选 (Star/SkyTeam/OneWorld) | ✅ 完成 | `flight_engine.py` |
| | 起飞 / 降落时间窗口筛选 | ✅ 完成 | `flight_engine.py` |
| | Google Flights 深度链接生成 | ✅ 完成 | `flight_engine.py` |
| | 预订链接点击追踪 | ✅ 完成 | `routes.py` (`/api/track/{task_id}`) |

### 3.2 任务管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建监控任务 | ✅ | 支持固定日期 / 日期范围 |
| 编辑任务参数 | ✅ | 全字段可更新 |
| 删除任务 | ✅ | 软删除/硬删除 |
| 暂停 / 恢复任务 | ✅ | 状态切换 |
| 自定义监控频率 | ✅ | `interval_minutes` 字段，最低 10 分钟 |
| 服务到期自动过期 | ✅ | `service_end_date` 检查 |
| 连续无变化熔断 | ✅ | `consecutive_no_change_count` |
| 余额不足自动暂停 | ✅ | `insufficient_funds` 状态 |
| 手动触发查价 | ✅ | 测试用端点 |

### 3.3 计费系统 (Bluebird v3)

| 功能 | 状态 | 说明 |
|------|------|------|
| 积分余额体系 | ✅ | `Profile.credits`（float 精度） |
| 按次扣费（动态定价） | ✅ | `SystemSettings.base_cost_per_scan` |
| 任务独立定价 | ✅ | `Subscription.custom_cost_per_scan` |
| 交易流水记录 | ✅ | `TransactionHistory` 表 |
| 累计消耗统计 | ✅ | `total_consumed_credits` / `total_run_count` |

### 3.4 用户与权限 (Eagle 计划)

| 功能 | 状态 | 说明 |
|------|------|------|
| Admin 登录（环境变量凭证） | ✅ | 超级管理员，不在数据库中 |
| Agent 登录（数据库密码） | ✅ | 代理商角色 |
| 数学验证码防暴力破解 | ✅ | 前端 Streamlit 实现 |
| Argon2 密码哈希 | ✅ | `auth_service.py` |
| 修改密码（Agent 自助） | ✅ | `change_password()` |
| Admin 重置 Agent 密码 | ✅ | `admin_reset_password()` |
| 首次创建任务自动注册 | ✅ | `subscription_service.py` |

### 3.5 财务与分销 (Eagle 计划)

| 功能 | 状态 | 说明 |
|------|------|------|
| 管理员给 Agent 充值积分 | ✅ | `admin_recharge_credits()` |
| 总账户进货（Admin 注资） | ✅ | `admin_deposit()` |
| 代理商分销转账 | ✅ | `admin_transfer()` |
| 完整交易流水记录 | ✅ | 支持 recharge / consumption / refund / system_adjustment |

### 3.6 通知系统

| 功能 | 状态 | 渠道 |
|------|------|------|
| 价格降价警报 | ✅ | 邮件 (Brevo) + Telegram |
| 邮件 HTML 模板 | ✅ | 精美的航班信息邮件 |
| Telegram 消息推送 | ✅ | Bot API |
| 数据库每日备份邮件 | ✅ | 每日 2:00 UTC |
| 每周运营周报 | ✅ | 每周五 18:00 UTC |
| 邮件配置测试 | ✅ | `test_email_config()` |

### 3.7 调度系统

| 功能 | 状态 | 说明 |
|------|------|------|
| 每分钟轮询到期任务 | ✅ | APScheduler IntervalTrigger |
| 自定义间隔调度 | ✅ | 基于 `next_run_time` 判断 |
| 每日数据库备份 | ✅ | CronTrigger 2:00 UTC |
| 每周报告发送 | ✅ | CronTrigger 周五 18:00 |
| 异常保护不中断调度 | ✅ | `_safe_job_wrapper` 封装 |

### 3.8 前端功能 (Streamlit)

| 功能 | 状态 | 说明 |
|------|------|------|
| 登录页（双角色） | ✅ | Admin / Agent 分流 |
| Admin 仪表板 | ✅ | 全局任务总览 |
| Admin 充值管理 | ✅ | 给 Agent 充值积分 |
| Admin 进货管理 | ✅ | 总账户注资 |
| Admin 分销管理 | ✅ | 向 Agent 转账 |
| Admin 密码重置 | ✅ | 重置 Agent 密码 |
| Agent 任务管理 | ✅ | 创建 / 编辑 / 删除 / 暂停 / 恢复 |
| Agent 交易流水 | ✅ | 查看充值消费记录 |
| 任务创建表单 | ✅ | 完整参数配置 |
| 成本预估显示 | ✅ | 根据频率估算积分消耗 |
| API 健康检查 | ✅ | 连接状态指示 |

---

## 四、代码结构详解

### 4.1 目录树

```
skyhunter/
├── src/                              # 源代码目录
│   ├── __init__.py                   #   包初始化
│   ├── main.py                       #   FastAPI 主应用入口 (126 行)
│   ├── config.py                     #   环境变量配置管理 (76 行)
│   ├── database.py                   #   数据库连接与迁移 (99 行)
│   ├── models.py                     #   SQLModel/Pydantic 数据模型 (376 行)
│   ├── scheduler.py                  #   APScheduler 后台调度 (481 行)
│   ├── frontend.py                   #   Streamlit 前端 (~3711 行)
│   │
│   ├── api/                          #   API 路由层
│   │   ├── __init__.py
│   │   └── routes.py                 #     REST API 路由定义 (678 行)
│   │
│   ├── services/                     #   业务逻辑层
│   │   ├── __init__.py
│   │   ├── flight_engine.py          #     航班价格查询引擎 (932 行)
│   │   ├── subscription_service.py   #     订阅任务管理 (401 行)
│   │   ├── auth_service.py           #     认证与密码管理 (247 行)
│   │   ├── notification_service.py   #     邮件/Telegram 通知 (521 行)
│   │   └── report_service.py         #     周报数据与 HTML 生成 (329 行)
│   │
│   └── scripts/                      #   工具脚本
│       ├── migrate_add_excluded_airlines.py  # 数据库迁移
│       └── clean_cache.py                    # 缓存清理
│
├── docs/                             # 项目文档
│   ├── PROJECT_EAGLE_SUMMARY.md
│   ├── EAGLE_TEST_GUIDE.md
│   └── ...
│
├── manifests/                        # 系统配置清单（事实来源）
│   ├── system_manifest.json
│   ├── system_manifest_v1.json
│   ├── system_manifest_v2.json
│   └── system_manifest_v3.json
│
├── migrations/                       # 数据库迁移脚本
│   ├── v3_schema_update.sql
│   ├── add_commercial_features.sql
│   └── DEPLOYMENT_GUIDE_v3.md
│
├── Dockerfile                        # Docker 构建文件
├── requirements.txt                  # Python 依赖
├── start.sh                          # 启动脚本（前后端同时启动）
├── entrypoint.sh                     # 备选启动脚本
├── run_api.py                        # API 独立启动
├── run_frontend.py                   # 前端独立启动
├── push_to_hf.sh                     # 推送到 Hugging Face (Linux)
├── push_to_hf.ps1                    # 推送到 Hugging Face (Windows)
├── verify_setup.py                   # 环境校验脚本
├── .env.example                      # 环境变量模板
├── .gitignore                        # Git 忽略规则
├── .cursorrules                      # Cursor AI 规则
└── README.md                         # 项目说明
```

### 4.2 架构图

```
┌─────────────────────────────────────────────────────┐
│              Streamlit Frontend (7860)               │
│          (frontend.py ~3700 行单文件)                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│   │  Login   │  │  Admin   │  │  Agent   │         │
│   │  View    │  │  View    │  │  View    │         │
│   └──────────┘  └──────────┘  └──────────┘         │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (requests 库)
┌────────────────────▼────────────────────────────────┐
│              FastAPI Backend (8000)                   │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │          api/routes.py (REST 路由)          │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                                │
│  ┌──────────────────▼─────────────────────────┐     │
│  │              Services Layer                 │     │
│  │  ┌────────────────┐ ┌───────────────────┐  │     │
│  │  │ flight_engine  │ │ subscription_svc  │  │     │
│  │  │   (SerpApi)    │ │   (CRUD / 计费)    │  │     │
│  │  └────────────────┘ └───────────────────┘  │     │
│  │  ┌────────────────┐ ┌───────────────────┐  │     │
│  │  │ notification   │ │  auth_service     │  │     │
│  │  │ (邮件/Telegram) │ │   (Argon2)       │  │     │
│  │  └────────────────┘ └───────────────────┘  │     │
│  │  ┌────────────────┐                        │     │
│  │  │ report_service │                        │     │
│  │  │   (周报生成)    │                        │     │
│  │  └────────────────┘                        │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │         scheduler.py (APScheduler)          │     │
│  │    定时查价 │ 数据库备份 │ 周报发送           │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │     database.py ←→ models.py (SQLModel)     │     │
│  └──────────────────┬─────────────────────────┘     │
└─────────────────────┼───────────────────────────────┘
                      │
        ┌─────────────▼─────────────┐
        │  PostgreSQL (Supabase)    │
        └───────────────────────────┘
```

### 4.3 模块依赖关系

```
main.py
├── api/routes.py
│   ├── database.py → get_session()
│   ├── models.py → 所有数据模型
│   ├── services/subscription_service.py
│   ├── services/auth_service.py
│   ├── services/flight_engine.py
│   └── scheduler.py → get_scheduler_status()
├── config.py → Config 单例
├── database.py → create_db_and_tables()
└── scheduler.py
    ├── database.py → get_engine()
    ├── models.py → Subscription, Profile, SystemSettings
    ├── services/flight_engine.py → FlightEngine
    ├── services/notification_service.py → NotificationService
    ├── services/report_service.py → ReportService
    └── config.py → Config

frontend.py (独立进程)
├── requests (HTTP 调用 FastAPI 后端)
├── streamlit
└── pandas
```

---

## 五、数据模型设计

### 5.1 数据库表结构

#### profiles（用户档案）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID (PK) | 用户 ID |
| `email` | str | 用户邮箱 |
| `tier` | str | 用户层级：free / pro |
| `credits` | float | 剩余积分 |
| `plan_type` | str | 套餐类型 |
| `total_api_calls` | int | 累计 API 调用次数 |
| `password_hash` | str (nullable) | Argon2 密码哈希 |
| `created_at` | datetime | 创建时间 |

#### subscriptions（监控任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int (PK, 自增) | 任务 ID |
| `user_id` | UUID (FK→profiles) | 所属用户 |
| `origin` | str | 出发地 IATA 代码 |
| `destination` | str | 目的地 IATA 代码 |
| `departure_date` | date | 出发日期 |
| `return_date` | date (nullable) | 返程日期 |
| `target_price` | float (nullable) | 目标价格 (USD) |
| `status` | str | active / paused / expired / insufficient_funds |
| `search_type` | str | fixed（固定日期）/ range（范围） |
| `end_date` | date (nullable) | 范围搜索结束日期 |
| `cabin_class` | str | economy / premium_economy / business / first |
| `strategy` | str | best（综合最优）/ cheapest（绝对低价） |
| `max_stops` | int (nullable) | 最大中转次数 |
| `adults` | int | 成人数量 |
| `children` | int | 儿童数量 |
| `client_name` | str | 客户名称/任务标识 |
| `client_tier` | str | Standard / VIP / Agency |
| `email` | str (nullable) | 接收警报的邮箱 |
| `notify_telegram` | bool | Telegram 通知开关 |
| `telegram_chat_id` | str (nullable) | Telegram Chat ID |
| `airline_preference` | str (nullable) | 偏好航司代码 |
| `excluded_airlines` | str (nullable) | 排除航司代码 |
| `alliance` | str (nullable) | 联盟偏好 |
| `departure_time_window` | str | 起飞时间窗口 |
| `landing_time_window` | str | 降落时间窗口 |
| `interval_minutes` | int | 监控频率（分钟） |
| `next_run_time` | datetime | 下次调度执行时间 |
| `custom_cost_per_scan` | float (nullable) | 任务独立定价 |
| `total_consumed_credits` | float | 累计消耗积分 |
| `total_run_count` | int | 累计运行次数 |
| `consecutive_no_change_count` | int | 连续无变化次数 |
| `service_end_date` | datetime (nullable) | 服务到期时间 |
| `last_checked_at` | datetime (nullable) | 上次检查时间 |
| `last_price` | float (nullable) | 上次查到的价格 |
| `last_alert_sent` | datetime (nullable) | 最后报警时间 |
| `last_alert_price` | float (nullable) | 上次报警价格 |
| `click_count` | int | 预订链接点击次数 |
| `last_clicked_at` | datetime (nullable) | 最后点击时间 |
| `created_at` | datetime | 创建时间 |

#### price_history（价格历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int (PK, 自增) | 记录 ID |
| `subscription_id` | int (FK→subscriptions) | 关联任务 |
| `price` | float | 价格 (USD) |
| `booking_link` | str (nullable) | 预订链接 |
| `checked_at` | datetime | 检查时间 |
| `airline_name` | str (nullable) | 航司名称 |
| `flight_number` | str (nullable) | 航班号 |

#### transaction_history（交易流水）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int (PK, 自增) | 流水 ID |
| `user_id` | UUID (FK→profiles) | 关联用户 |
| `amount` | float | 变动金额（+充值 / -消费） |
| `type` | str | recharge / consumption / refund / system_adjustment |
| `description` | str (nullable) | 交易备注 |
| `created_at` | datetime | 交易时间 |

#### search_cache（搜索缓存）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int (PK, 自增) | 缓存 ID |
| `origin` | str | 出发地 |
| `destination` | str | 目的地 |
| `departure_date` | date | 出发日期 |
| `return_date` | date (nullable) | 返程日期 |
| `cabin_class` | str | 舱位 |
| `max_stops` | int (nullable) | 中转限制 |
| `adults` | int | 成人数 |
| `children` | int | 儿童数 |
| `price` | float | 缓存价格 |
| `booking_link` | str (nullable) | 预订链接 |
| `created_at` | datetime | 缓存时间 |

#### system_settings（系统配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | str (PK) | 配置键 |
| `value` | str | 配置值 |
| `description` | str (nullable) | 说明 |
| `updated_at` | datetime | 更新时间 |

---

## 六、API 端点清单

### 6.1 健康检查

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/` | 基础健康检查 | 无 |
| GET | `/health` | 详细健康检查 | 无 |

### 6.2 认证

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 | 无 |
| POST | `/api/auth/change-password` | 修改密码 | X-User-Id |
| POST | `/api/admin/reset-password` | 管理员重置密码 | X-User-Id (Admin) |

### 6.3 订阅任务

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/subscriptions` | 创建监控任务 | X-User-Id |
| GET | `/api/subscriptions` | 获取任务列表 | X-User-Id |
| GET | `/api/subscriptions/{id}` | 获取单个任务 | X-User-Id |
| PUT | `/api/subscriptions/{id}` | 更新任务 | X-User-Id |
| DELETE | `/api/subscriptions/{id}` | 删除任务 | X-User-Id |
| PATCH | `/api/subscriptions/{id}/status` | 更新任务状态 | X-User-Id |

### 6.4 用户与财务

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/profile` | 获取用户档案 | X-User-Id |
| GET | `/api/transactions` | 获取交易记录 | X-User-Id |
| POST | `/api/admin/recharge` | 管理员充值 | X-User-Id (Admin) |
| POST | `/api/admin/deposit` | 总账户进货 | X-User-Id (Admin) |
| POST | `/api/admin/transfer` | 分销转账 | X-User-Id (Admin) |

### 6.5 其他

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/track/{task_id}` | 预订链接跟踪重定向 | 无 |
| POST | `/api/test/trigger-check` | 手动触发价格检查 | X-User-Id |

---

## 七、技术债务与风险评估

### 7.1 高优先级问题 (P0)

| 问题 | 风险 | 影响范围 |
|------|------|----------|
| **无 JWT/Token 认证** | 安全漏洞：任何人可以伪造 `X-User-Id` Header 冒充任何用户 | 所有 API 端点 |
| **前端单文件 3700 行** | 无法维护、无法复用、无法迁移到多端 | `frontend.py` |
| **CORS 全开 `allow_origins=["*"]`** | 跨站请求伪造风险 | `main.py` |

### 7.2 中优先级问题 (P1)

| 问题 | 风险 | 影响范围 |
|------|------|----------|
| **SubscriptionUpdate 重复定义** | `models.py` 第 176 行和第 240 行定义了两个同名类，后者覆盖前者 | `models.py` |
| **前后端同进程/同容器** | 无法独立扩缩容，Streamlit 崩溃影响后端 | 部署架构 |
| **无 API 分页** | 数据量增长后列表查询性能恶化 | 所有列表端点 |
| **无速率限制** | API 容易被滥用或 DDoS | 所有端点 |
| **无系统化测试** | 只有少量脚本，无 CI/CD 集成 | 全局 |
| **APScheduler 进程内调度** | 不支持多实例水平扩展 | `scheduler.py` |
| **硬编码默认凭证** | `admin123` 默认密码 | `config.py` |

### 7.3 低优先级问题 (P2)

| 问题 | 风险 | 影响范围 |
|------|------|----------|
| 无日志框架（使用 print） | 不便排查生产问题 | 全局 |
| 无监控告警 | 服务异常无法感知 | 运维 |
| AI 依赖已引入但未使用 | 增大镜像体积 | `requirements.txt` |

---

## 八、多端拆分技术架构方案

### 8.1 目标架构

```
┌───────────────────────────────────────────────────────────────┐
│                         客户端层 (Clients)                      │
│                                                               │
│  ┌───────────┐  ┌───────────┐  ┌─────────────────────────┐   │
│  │  iOS App  │  │ Android   │  │  Web SaaS               │   │
│  │  (Flutter │  │ App       │  │  (Next.js / React)      │   │
│  │   / Swift)│  │ (Flutter  │  │  ┌───────┐ ┌────────┐  │   │
│  │           │  │  / Kotlin)│  │  │ Admin │ │ Agent  │  │   │
│  │           │  │           │  │  │Portal │ │ Portal │  │   │
│  └─────┬─────┘  └─────┬─────┘  │  └───────┘ └────────┘  │   │
│        │               │        └──────────┬──────────────┘   │
└────────┼───────────────┼───────────────────┼──────────────────┘
         │               │                   │
         └───────────────┼───────────────────┘
                         │  HTTPS (REST API / WebSocket)
┌────────────────────────▼──────────────────────────────────────┐
│               API Gateway (Kong / AWS API GW / Nginx)          │
│          Rate Limiting · JWT 验证 · 日志 · CORS · 路由          │
└────────────────────────┬──────────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────────┐
│                     统一后端 API (Backend)                       │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐    │
│  │               FastAPI v2 (保留升级)                      │    │
│  │                                                       │    │
│  │  ┌───────────┐ ┌───────────┐ ┌─────────────────────┐ │    │
│  │  │Auth API   │ │Flight API │ │ Subscription API    │ │    │
│  │  │(JWT +     │ │           │ │                     │ │    │
│  │  │ OAuth2)   │ │           │ │                     │ │    │
│  │  └───────────┘ └───────────┘ └─────────────────────┘ │    │
│  │  ┌───────────┐ ┌───────────┐ ┌─────────────────────┐ │    │
│  │  │Payment API│ │Notifi-    │ │ Admin API           │ │    │
│  │  │(Stripe/   │ │cation API │ │                     │ │    │
│  │  │ IAP)      │ │(+APNs/FCM)│ │                     │ │    │
│  │  └───────────┘ └───────────┘ └─────────────────────┘ │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │
│  │ Celery Workers │ │  Redis         │ │  S3 / OSS      │    │
│  │ (替代APSched)   │ │  (Cache +      │ │  (文件存储)     │    │
│  │                │ │   Session +    │ │                │    │
│  │                │ │   Queue)       │ │                │    │
│  └────────────────┘ └────────────────┘ └────────────────┘    │
└────────────────────────┬──────────────────────────────────────┘
                         │
           ┌─────────────▼─────────────┐
           │  PostgreSQL (Supabase/RDS) │
           └───────────────────────────┘
```

### 8.2 后端 API 标准化改造

#### 8.2.1 JWT 认证系统

**当前问题：** 使用 `X-User-Id` Header 透传用户身份，无签名验证，任何人可伪造。

**改造方案：**

```python
# 认证流程
POST /api/v1/auth/login        → 返回 { access_token, refresh_token }
POST /api/v1/auth/refresh      → 刷新 access_token
POST /api/v1/auth/register     → 用户注册
POST /api/v1/auth/oauth/apple  → Apple Sign-In 回调
POST /api/v1/auth/oauth/google → Google Sign-In 回调

# 所有业务 API 通过 Bearer Token 认证
Authorization: Bearer <access_token>
```

**技术选型：** `python-jose[cryptography]` 或 `PyJWT`

#### 8.2.2 API 版本化

```
/api/v1/subscriptions    # 当前功能
/api/v1/profile
/api/v1/auth/login
/api/v2/...              # 未来破坏性变更
```

#### 8.2.3 分页标准化

```json
// 请求
GET /api/v1/subscriptions?page=1&size=20&sort=-created_at

// 响应
{
  "items": [...],
  "total": 150,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

#### 8.2.4 错误码标准化

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "账户积分不足，请充值后重试",
    "details": { "required": 2.5, "available": 1.0 }
  }
}
```

#### 8.2.5 推送通知扩展

| 渠道 | 用途 | 技术 |
|------|------|------|
| APNs | iOS 推送 | `aioapns` 或 Firebase Admin SDK |
| FCM | Android 推送 | Firebase Admin SDK |
| 邮件 | 保持 Brevo | 不变 |
| Telegram | 保持 Bot API | 不变 |
| WebSocket | 实时价格更新 | FastAPI WebSocket |

---

## 九、上架苹果/安卓商店关键要求

### 9.1 Apple App Store

| 要求 | 说明 | 行动项 |
|------|------|--------|
| **Apple Developer 账号** | 年费 $99/年 | 注册 https://developer.apple.com |
| **Apple Sign-In** | 有第三方登录就必须支持 Apple 登录 | 后端实现 Apple ID Token 验证 |
| **IAP（应用内购买）** | 虚拟商品（积分）必须用 IAP，Apple 抽成 15-30% | 积分充值走 IAP，不能用 Stripe |
| **隐私政策 URL** | 必须提供可访问的隐私政策页面 | 创建隐私政策网页 |
| **App Review 审核** | 1-7 个工作日，可能被拒需修改重提 | 确保功能完整、无崩溃 |
| **ATS (App Transport Security)** | 所有网络请求必须 HTTPS | 后端配置 SSL 证书 |
| **年龄分级** | 需要声明内容分级 | 填写分级问卷 |
| **屏幕截图** | 需提供多尺寸设备截图 | iPhone 6.7" / 6.5" / 5.5", iPad |
| **App 描述与关键词** | 需要多语言描述 | 准备中英文 App Store 描述 |

#### Apple IAP 定价建议

| 商品 | 类型 | 价格 | 积分 |
|------|------|------|------|
| 入门包 | 消耗型 | ¥6 / $0.99 | 100 积分 |
| 标准包 | 消耗型 | ¥30 / $3.99 | 600 积分 |
| 专业包 | 消耗型 | ¥98 / $12.99 | 2500 积分 |
| 企业包 | 消耗型 | ¥298 / $39.99 | 8000 积分 |

### 9.2 Google Play Store

| 要求 | 说明 | 行动项 |
|------|------|--------|
| **Google Developer 账号** | 一次性 $25 | 注册 https://play.google.com/console |
| **Google Play Billing** | 虚拟商品必须用 Google Play Billing | 积分充值走 Google Billing |
| **隐私政策** | 必须提供 | 同 Apple |
| **数据安全声明** | 必须声明数据收集情况 | 填写 Play Console 数据安全表单 |
| **Target SDK Level** | 需满足最新要求（目前 API 34+） | 保持 Flutter SDK 更新 |
| **内容分级** | IARC 分级问卷 | 填写分级问卷 |
| **App Bundle** | AAB 格式上传（非 APK） | Flutter 默认支持 |

### 9.3 共同要求

| 要求 | 说明 |
|------|------|
| HTTPS 全站 | 所有 API 和网页必须 HTTPS |
| 隐私政策 | 明确说明数据收集、使用、存储方式 |
| 用户协议 / 服务条款 | 说明服务范围、退款政策等 |
| 用户数据删除 | 用户可以请求删除账户和数据 |
| 推送通知权限 | 必须在使用前请求用户授权 |

---

## 十、后端部署架构升级方案

### 10.1 当前 vs 目标

| 组件 | 当前 | 目标 | 原因 |
|------|------|------|------|
| **调度器** | APScheduler（进程内） | Celery + Redis (Broker) | 支持多实例水平扩展 |
| **缓存** | 数据库表 (search_cache) | Redis + 数据库 | 高性能，毫秒级响应 |
| **前端** | Streamlit（同容器） | Next.js（Vercel 独立部署） | SEO、性能、可维护性 |
| **认证** | X-User-Id Header | JWT + OAuth2 | 安全、标准化、支持多端 |
| **文件存储** | 无 | AWS S3 / 阿里云 OSS | 报告、备份、用户头像 |
| **监控** | print 日志 | Sentry + Prometheus + Grafana | 生产级可观测性 |
| **日志** | print() | structlog / loguru | 结构化日志，便于搜索 |
| **CI/CD** | 手动推送 HF | GitHub Actions | 自动化构建、测试、部署 |
| **部署平台** | HF Spaces (单容器) | AWS ECS / 阿里云容器 / Railway | 生产级弹性伸缩 |

### 10.2 生产部署架构

```
                    ┌──────────────────────┐
                    │  CDN (CloudFlare)    │
                    │  静态资源加速 + DDoS   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Load Balancer       │
                    │  (Nginx / AWS ALB)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼───────┐ ┌─────▼──────┐ ┌───────▼──────────┐
    │  API Server #1  │ │ API Server │ │  Web Frontend    │
    │  (FastAPI)      │ │ #2 (扩展)   │ │  (Next.js)       │
    └─────────┬───────┘ └─────┬──────┘ │  Vercel 独立部署  │
              │               │        └──────────────────┘
    ┌─────────▼───────────────▼─────┐
    │     Redis (多功能)              │
    │  • Session/Token 存储          │
    │  • 搜索结果缓存                 │
    │  • Celery 消息队列             │
    │  • 速率限制计数器               │
    └─────────┬─────────────────────┘
              │
    ┌─────────▼─────────────────────┐
    │  Celery Workers (独立进程)     │
    │  ┌───────┐ ┌──────┐ ┌──────┐ │
    │  │ 查价   │ │ 通知  │ │ 报告 │ │
    │  │Worker  │ │Worker│ │Worker│ │
    │  └───────┘ └──────┘ └──────┘ │
    └─────────┬─────────────────────┘
              │
    ┌─────────▼─────────────────────┐
    │   PostgreSQL (Supabase / RDS) │
    │   • 主库 (读写)               │
    │   • 只读副本 (查询扩展)        │
    └───────────────────────────────┘
```

### 10.3 环境变量扩展

```bash
# === 现有 (保留) ===
DATABASE_URL=postgresql://...
SERPAPI_API_KEY=...
BREVO_API_KEY=...
TELEGRAM_BOT_TOKEN=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...

# === 新增：认证 ===
JWT_SECRET_KEY=...
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# === 新增：Redis ===
REDIS_URL=redis://...

# === 新增：Celery ===
CELERY_BROKER_URL=redis://...
CELERY_RESULT_BACKEND=redis://...

# === 新增：推送 ===
FIREBASE_CREDENTIALS_JSON=...
APNS_KEY_FILE=...

# === 新增：支付 ===
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
APPLE_IAP_SHARED_SECRET=...

# === 新增：存储 ===
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# === 新增：监控 ===
SENTRY_DSN=...
```

---

## 十一、代码复用评估

### 11.1 可复用模块

| 模块 | 文件 | 行数 | 复用度 | 改造工作量 |
|------|------|------|--------|-----------|
| **数据模型** | `models.py` | 376 | 🟢 90% | 删除重复 `SubscriptionUpdate`，加分页模型 |
| **航班引擎** | `flight_engine.py` | 932 | 🟢 95% | 几乎无需改动，核心价值所在 |
| **订阅服务** | `subscription_service.py` | 401 | 🟢 85% | 加分页参数、完善错误码 |
| **通知服务** | `notification_service.py` | 521 | 🟢 80% | 新增 APNs/FCM 推送渠道 |
| **报告服务** | `report_service.py` | 329 | 🟢 90% | 几乎无需改动 |
| **数据库层** | `database.py` | 99 | 🟢 85% | 加连接池优化 |
| **配置管理** | `config.py` | 76 | 🟢 80% | 扩展新配置项 |

### 11.2 需重构模块

| 模块 | 文件 | 行数 | 复用度 | 改造说明 |
|------|------|------|--------|---------|
| **认证服务** | `auth_service.py` | 247 | 🟡 50% | 需重构为 JWT + OAuth2 |
| **API 路由** | `routes.py` | 678 | 🟡 60% | 需加版本化、JWT 中间件、分页、错误码 |

### 11.3 需替换模块

| 模块 | 文件 | 行数 | 复用度 | 替代方案 |
|------|------|------|--------|---------|
| **调度器** | `scheduler.py` | 481 | 🔴 30% | 迁移到 Celery，业务逻辑可复用 |
| **前端** | `frontend.py` | 3711 | 🔴 0% | Streamlit 无法复用，需用 Next.js/Flutter 全部重写 |

### 11.4 复用价值总结

**后端业务逻辑复用率约 80%**，最大工作量在于：
1. 认证系统重建 (JWT + OAuth2)
2. 前端全部重写 (Web: Next.js, App: Flutter)
3. 调度系统迁移 (APScheduler → Celery)

---

## 十二、分阶段实施路线图

### Phase 1：后端 API 标准化（1-2 个月）

> **目标：** 将后端改造为可被任何客户端安全调用的标准 REST API

| 序号 | 任务 | 优先级 | 预估工时 |
|------|------|--------|----------|
| 1 | JWT 认证系统（Access + Refresh Token） | P0 | 3 天 |
| 2 | OAuth2 集成（Apple Sign-In + Google Sign-In） | P0 | 5 天 |
| 3 | API 版本化（/api/v1/...） | P0 | 1 天 |
| 4 | 所有列表 API 加分页 + 排序 | P1 | 2 天 |
| 5 | 错误码标准化（统一 JSON 错误格式） | P1 | 2 天 |
| 6 | 速率限制（slowapi / API Gateway） | P1 | 1 天 |
| 7 | OpenAPI 文档完善（示例、错误码） | P1 | 2 天 |
| 8 | 核心服务单元测试（pytest, 80%+ 覆盖率） | P1 | 5 天 |
| 9 | APNs + FCM 推送通知 API | P1 | 3 天 |
| 10 | 删除重复 SubscriptionUpdate 等技术债 | P2 | 0.5 天 |

### Phase 2：Web SaaS 前端重写（2-3 个月）

> **目标：** 用现代前端框架替代 Streamlit，支持 SEO 和自助订阅

| 序号 | 任务 | 说明 |
|------|------|------|
| 1 | Next.js 14+ 项目搭建 | App Router, TypeScript, Tailwind CSS |
| 2 | 落地页 + 定价页 | SEO 友好，转化优化 |
| 3 | 认证页面 | 登录、注册、OAuth、忘记密码 |
| 4 | Agent Dashboard | 任务列表、余额、快捷操作 |
| 5 | 任务管理页面 | 创建、编辑、详情（价格走势图） |
| 6 | Admin Portal | 用户管理、充值、进货、分销、全局配置 |
| 7 | 交易流水页面 | 充值消费记录 |
| 8 | Stripe 支付集成 | Web 端积分充值 |
| 9 | 通知设置页面 | 邮件、Telegram 偏好 |
| 10 | 国际化（中英双语） | next-intl |

**技术选型：**
- 框架：Next.js 14+ (App Router)
- UI：Tailwind CSS + shadcn/ui
- 状态管理：TanStack Query (API 缓存)
- 认证：NextAuth.js
- 图表：Recharts
- 部署：Vercel

### Phase 3：移动端 App 开发（2-3 个月）

> **目标：** 一套代码发布 iOS + Android，上架两大商店

**推荐方案：Flutter（Dart 语言）**

| 理由 | 说明 |
|------|------|
| 一套代码 | iOS + Android 共享 95%+ 代码 |
| 高性能 | 原生编译，流畅度接近原生 |
| 丰富生态 | 支持 IAP、推送、生物识别等所有需求 |
| 学习曲线 | Python 背景易上手 Dart 语言 |

| 序号 | 任务 | 说明 |
|------|------|------|
| 1 | Flutter 项目搭建 | 项目结构、路由、状态管理 |
| 2 | 认证模块 | 邮箱登录 + Apple Sign-In + Google Sign-In + 生物识别 |
| 3 | Dashboard | 活跃任务、余额卡片、最近变动 |
| 4 | 任务管理 | 创建、列表、详情（价格走势图）、暂停/恢复 |
| 5 | 通知中心 | 推送通知列表、通知偏好设置 |
| 6 | 钱包模块 | 余额详情、交易流水、IAP 充值 |
| 7 | 设置页面 | 个人资料、修改密码、通知、语言/主题 |
| 8 | Apple IAP 集成 | iOS 应用内购买 |
| 9 | Google Billing 集成 | Android 应用内购买 |
| 10 | 上架审核 | 截图、描述、隐私政策、提交审核 |

### Phase 4：生产化运维（持续迭代）

| 序号 | 任务 | 说明 |
|------|------|------|
| 1 | Celery + Redis 替代 APScheduler | 支持多实例扩展 |
| 2 | Redis 缓存层 | 替代数据库缓存表 |
| 3 | CI/CD Pipeline (GitHub Actions) | 自动化构建、测试、部署 |
| 4 | 监控告警（Sentry + Prometheus + Grafana） | 异常追踪、性能监控 |
| 5 | 结构化日志（structlog / loguru） | 替代 print 日志 |
| 6 | 数据库读写分离 | 查询性能优化 |
| 7 | CDN 接入（CloudFlare） | 静态资源加速 + DDoS 防护 |

### 时间线总览

```
2026 Q2 (4-6月)
├── Phase 1: 后端 API 标准化 ████████████████ (6-8 周)
└── Phase 2 启动: Next.js 项目搭建

2026 Q3 (7-9月)
├── Phase 2: Web SaaS 前端 ████████████████████████ (8-12 周)
└── Phase 3 启动: Flutter 项目搭建

2026 Q4 (10-12月)
├── Phase 3: 移动端 App ████████████████████████ (8-12 周)
├── Apple App Store 审核提交
└── Google Play Store 审核提交

2027 Q1+
└── Phase 4: 生产化运维（持续迭代）
```

---

## 附录：文件清单与行数统计

### 源代码文件

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `src/main.py` | 126 | FastAPI 主应用入口 |
| `src/config.py` | 76 | 环境变量配置管理 |
| `src/database.py` | 99 | 数据库连接与迁移 |
| `src/models.py` | 376 | SQLModel / Pydantic 数据模型 |
| `src/scheduler.py` | 481 | APScheduler 后台调度 |
| `src/frontend.py` | ~3711 | Streamlit Web 前端 |
| `src/api/__init__.py` | 5 | API 包初始化 |
| `src/api/routes.py` | 678 | REST API 路由定义 |
| `src/services/__init__.py` | 8 | 服务包初始化 |
| `src/services/flight_engine.py` | 932 | 航班价格查询引擎 |
| `src/services/subscription_service.py` | 401 | 订阅任务业务逻辑 |
| `src/services/auth_service.py` | 247 | 认证与密码管理 |
| `src/services/notification_service.py` | 521 | 邮件 / Telegram 通知 |
| `src/services/report_service.py` | 329 | 周报数据与 HTML 生成 |
| `src/scripts/migrate_add_excluded_airlines.py` | 44 | 数据库迁移脚本 |
| `src/scripts/clean_cache.py` | 56 | 缓存清理脚本 |
| **总计** | **~8,090** | |

### 配置与部署文件

| 文件 | 用途 |
|------|------|
| `Dockerfile` | Docker 镜像构建（Python 3.10-slim） |
| `requirements.txt` | Python 依赖清单 |
| `start.sh` | 启动脚本（前后端同时启动） |
| `entrypoint.sh` | 备选启动脚本 |
| `.env.example` | 环境变量模板 |
| `.gitignore` | Git 忽略规则 |
| `manifests/system_manifest.json` | 系统配置清单（唯一事实来源） |

---

> **文档结束**  
> 生成工具：Cursor AI  
> 项目：SkyHunter v1.4.5  
> 日期：2026-03-10
