# Phase 2B Execution Plan

## 目标

`Phase 2B` 的目标不是继续增加功能，而是把“代码层已支持”变成“真实环境已验证”。

本阶段重点验证：

- PostgreSQL / Supabase 真实落库
- `USE_MOCK_DATA=False` 下的真实 SerpApi 链路
- 调度器运行状态
- 关键 API 在真实配置下可用
- 生产 CORS 配置有效

## 当前已具备的验证入口

现有脚本：

- `backend/verify_postgresql.py`
- `backend/verify_serpapi.py`
- `backend/test_api.py`

现有健康检查接口：

- `GET /`
- `GET /health`

后端当前会暴露这些关键信号：

- `mock_mode`
- `serpapi_configured`
- `scheduler_running`

## 进入 Phase 2B 前的前提

在开始真实验证前，先确认以下配置项存在且值正确：

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `USE_MOCK_DATA`
- `CORS_ALLOWED_ORIGINS`
- `SERPAPI_API_KEY`（真实搜索时）

生产/远程模式下，`CORS_ALLOWED_ORIGINS` 未配置会拒绝启动。

## 当前阻塞项

### 1. 环境文件过多

`backend` 下存在多个 `.env` 相关文件：

- `.env`
- `.env.local`
- `.env.remote`
- `.env.backup.local`
- `.env.backup.remote`
- `.env copy`
- `.env copy 2`
- `.env - 副本.local`

这会直接导致：

- 不清楚当前启动到底读取哪一个
- 很容易误用旧密钥或错误数据库
- 验证结果不具备可重复性

建议：

在真正开始 Phase 2B 之前，先收口环境文件使用规则。

最低要求：

- 只保留一个“当前生效”的 `.env`
- 把其他文件视为历史备份，不参与运行
- 明确本轮验证使用的是本地 SQLite 还是远程 PostgreSQL

### 2. 版本号存在 drift

Manifest 当前版本是 `3.3.0 (Pro-Phase2)`，但后端健康检查仍返回 `3.2.0`。

这会影响：

- 健康检查判断
- 线上排障
- 验证记录归档

建议在 Phase 2B 开始前先记录此问题，作为后续修复项。

## 执行顺序

建议严格按以下顺序执行，不要跳步。

### Step 1. 确认当前运行模式

先确认本轮目标：

- 本地联调模式
- 远程 PostgreSQL 验证模式
- 真实 SerpApi 验证模式

本阶段建议目标是：

1. 先验证 PostgreSQL
2. 再验证 SerpApi
3. 最后跑完整 API 链路

### Step 2. PostgreSQL 验证

使用：

```bash
cd backend
python verify_postgresql.py
```

通过标准：

- `DATABASE_URL` 为 `postgresql://`
- 能成功连接数据库
- 能访问以下表：
  - `users`
  - `monitor_tasks`
  - `flight_cache`
  - `price_history`
- 基础查询成功

额外人工检查：

- 后端启动日志应明确显示正在使用远程 PostgreSQL
- Supabase Dashboard 中能看到表和数据变化

### Step 3. SerpApi 验证

使用：

```bash
cd backend
python verify_serpapi.py
```

通过标准：

- `USE_MOCK_DATA=False`
- `SERPAPI_API_KEY` 已配置
- 能成功访问 SerpApi
- 返回真实航班结果而不是 Mock

额外人工检查：

- `GET /health` 中 `mock_mode` 应为 `false`
- `serpapi_configured` 应为 `true`

### Step 4. 启动后端进行运行态验证

启动方式任选其一：

```bash
cd backend
python main.py
```

或：

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

启动后先检查：

- `GET /`
- `GET /health`
- `/docs`

关注以下字段：

- `mock_mode`
- `serpapi_configured`
- `scheduler_running`

### Step 5. 跑 API 基础验证

使用：

```bash
cd backend
python test_api.py
```

重点验证这些接口：

- 健康检查
- 注册 / 登录
- `/api/v1/users/me`
- `/api/v1/quote/search`
- `/api/v1/search`
- `/api/v1/monitors`
- `/api/v1/monitors/{id}`
- `/api/v1/monitors/trash`

## 建议增加的人工验证

仅跑脚本还不够，建议补这些人工检查：

### 搜索链路

- 一次固定日期搜索
- 一次日期范围搜索
- 确认 `data_source` 是 `serpapi` 而不是 `mock`
- 确认返回价格和热力图正常

### 监控链路

- 创建监控任务
- 查看 `monitor_tasks` 是否写入
- 查看 `price_history` 是否写入
- 修改监控频率
- 删除并恢复监控

### 调度器链路

- 启动后 `scheduler_running=true`
- 创建一个可观察的监控任务
- 等待调度触发至少一次
- 检查：
  - `last_checked_at`
  - `next_run_time`
  - `price_history`

### CORS 链路

- 在真实前端来源下访问 API
- 确认响应头返回正确 `Access-Control-Allow-Origin`
- 确认未授权来源不会被错误放行

## Phase 2B 验收标准

全部满足后，才能认为 Phase 2B 完成：

- PostgreSQL 连接与落库验证通过
- SerpApi 真实搜索验证通过
- 健康检查状态正确
- 调度器运行正常
- 关键 API 在真实配置下可用
- 前端至少完成一次真实搜索与一次真实监控创建
- CORS 在目标来源下正确工作

## 当前阶段不处理的内容

以下内容属于后续阶段，不纳入 Phase 2B：

- 支付接入
- 交易流水
- Push 通知
- 邮箱验证
- 后端大规模模块拆分
- 发布上架准备

## Phase 2B 完成后的下一步

完成后建议进入 `Phase 2C`：

- 密钥治理
- 缓存键正确性修复
- 扣费与补偿一致性
- 测试与监控补强
- 生产级安全加固
