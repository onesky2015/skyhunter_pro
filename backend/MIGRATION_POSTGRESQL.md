# PostgreSQL 迁移指南

## 概述

SkyHunter Pro 后端已支持 PostgreSQL（通过 Supabase），代码层面已完成迁移。本文档说明如何从 SQLite 迁移到 PostgreSQL。

## 当前状态

- ✅ 代码已支持 PostgreSQL（通过 `DATABASE_URL` 环境变量）
- ✅ 如果未配置 `DATABASE_URL`，会自动回退到 SQLite（仅开发用）
- ✅ 所有 SQLModel 表结构兼容 PostgreSQL

## 迁移步骤

### 1. 创建 Supabase 项目

1. 访问 https://app.supabase.com/
2. 创建新项目或使用现有项目
3. 记录项目 URL 和 Service Role Key

### 2. 获取数据库连接字符串

1. 在 Supabase Dashboard 中，进入 **Settings** → **Database**
2. 找到 **Connection string** 部分
3. 选择 **URI** 格式，复制连接字符串
4. 格式示例：`postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

### 3. 配置环境变量

在 `backend/.env` 文件中添加：

```env
# PostgreSQL Database Connection String
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres

# 如果未设置 DATABASE_URL，将使用 SQLite（仅开发用）
# DATABASE_URL=sqlite:///skyhunter_pro.db
```

### 4. 初始化数据库表

后端启动时会自动创建所有表（通过 SQLModel 的 `create_all`）。首次连接 PostgreSQL 时：

1. 确保 `.env` 中的 `DATABASE_URL` 指向 Supabase
2. 启动后端：`python main.py` 或 `uvicorn main:app --reload`
3. 检查日志，确认看到 "✅ 使用远程 PostgreSQL 数据库"

### 5. 验证迁移

1. 在 Supabase Dashboard → **Table Editor** 中查看表：
   - `users`
   - `monitor_tasks`
   - `flight_cache`
   - `price_history`
2. 测试 API 端点，确保数据正常读写

## 数据迁移（可选）

如果需要从 SQLite 迁移现有数据到 PostgreSQL：

### 方法 1: 使用 SQLAlchemy 脚本

```python
# migrate_data.py
from sqlalchemy import create_engine
from sqlmodel import Session, select
from main import User, MonitorTask, FlightCache, PriceHistory

# SQLite 源数据库
sqlite_engine = create_engine("sqlite:///skyhunter_pro.db")
# PostgreSQL 目标数据库
pg_engine = create_engine("postgresql://postgres:password@db.ref.supabase.co:5432/postgres")

with Session(sqlite_engine) as sqlite_session, Session(pg_engine) as pg_session:
    # 迁移 Users
    users = sqlite_session.exec(select(User)).all()
    for user in users:
        pg_session.add(user)
    
    # 迁移 MonitorTasks
    tasks = sqlite_session.exec(select(MonitorTask)).all()
    for task in tasks:
        pg_session.add(task)
    
    # 迁移 FlightCache
    cache = sqlite_session.exec(select(FlightCache)).all()
    for item in cache:
        pg_session.add(item)
    
    # 迁移 PriceHistory
    history = sqlite_session.exec(select(PriceHistory)).all()
    for item in history:
        pg_session.add(item)
    
    pg_session.commit()
```

### 方法 2: 使用 pg_dump / pg_restore

不适用，因为 SQLite 和 PostgreSQL 格式不同。

## 生产环境配置

### 必需的环境变量

```env
# 数据库
DATABASE_URL=postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres

# 安全
JWT_SECRET_KEY=your-secure-random-key-at-least-32-chars
USE_MOCK_DATA=False

# CORS（生产环境必须设置）
CORS_ALLOWED_ORIGINS=https://app.skyhunter.app,https://www.skyhunter.app

# SerpApi（生产环境）
SERPAPI_API_KEY=your-serpapi-key

# 邮件
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-key
EMAIL_SENDER=noreply@skyhunter.app
ADMIN_EMAIL=admin@skyhunter.app
```

### Supabase 连接池配置

Supabase 免费版连接数限制：
- 最大连接数：60
- 建议：使用连接池（Supabase 自动管理）

### 性能优化

1. **索引**：SQLModel 已自动创建索引（`user_id`, `origin`, `destination` 等）
2. **连接池**：Supabase 自动管理，无需手动配置
3. **查询优化**：使用 `select()` 和 `where()` 过滤，避免全表扫描

## 回退到 SQLite（仅开发）

如果需要临时回退到 SQLite：

```env
# 注释掉 PostgreSQL URL
# DATABASE_URL=postgresql://...

# 或删除 DATABASE_URL，系统会自动使用 SQLite
```

## 故障排查

### 连接失败

1. 检查 `DATABASE_URL` 格式是否正确
2. 确认 Supabase 项目未暂停
3. 检查网络连接和防火墙设置

### 表不存在

1. 确保后端启动时执行了 `SQLModel.metadata.create_all(engine)`
2. 检查 Supabase Dashboard → Table Editor 确认表已创建

### 性能问题

1. 检查 Supabase Dashboard → Database → Connection Pooling
2. 查看慢查询日志
3. 考虑添加额外索引

## 参考

- [Supabase 文档](https://supabase.com/docs)
- [SQLModel 文档](https://sqlmodel.tiangolo.com/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

