# Phase 1 剩余任务完成指南

## 概述

Phase 1 的核心代码修复和组件拆分已完成。剩余两个任务需要配置环境变量并运行验证脚本。

## 任务 1: PostgreSQL 迁移验证

### 当前状态
- ✅ 代码已支持 PostgreSQL（通过 `DATABASE_URL` 环境变量）
- ✅ 如果未配置 `DATABASE_URL`，会自动回退到 SQLite（仅开发用）
- ✅ 所有 SQLModel 表结构兼容 PostgreSQL

### 完成步骤

1. **配置 DATABASE_URL**
   
   在 `backend/.env` 文件中添加或更新：
   ```env
   DATABASE_URL=postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres
   ```
   
   获取方式：
   - 访问 https://app.supabase.com/
   - 进入项目 → Settings → Database
   - 复制 Connection string (URI 格式)

2. **运行验证脚本**
   ```bash
   cd backend
   python verify_postgresql.py
   ```

3. **验证结果**
   - ✅ 如果看到 "PostgreSQL 迁移验证成功"，说明配置正确
   - ❌ 如果看到错误，请检查：
     - DATABASE_URL 格式是否正确
     - 数据库服务器是否可访问
     - 用户名和密码是否正确

4. **启动后端验证**
   ```bash
   python main.py
   ```
   
   应该看到日志：
   ```
   ✅ 使用远程 PostgreSQL 数据库
   ```

5. **检查数据库表**
   - 在 Supabase Dashboard → Table Editor 中查看：
     - `users`
     - `monitor_tasks`
     - `flight_cache`
     - `price_history`

## 任务 2: SerpApi 真实数据验证

### 当前状态
- ✅ 代码已支持 Mock 和真实模式切换（通过 `USE_MOCK_DATA` 环境变量）
- ✅ Mock 模式：使用模拟数据，不消耗 SerpApi 配额
- ⚠️ 真实模式：需要配置 `SERPAPI_API_KEY` 并关闭 Mock

### 完成步骤

1. **配置环境变量**
   
   在 `backend/.env` 文件中更新：
   ```env
   # 关闭 Mock 模式
   USE_MOCK_DATA=False
   
   # SerpApi API Key
   SERPAPI_API_KEY=your-serpapi-api-key-here
   ```
   
   获取 SerpApi API Key：
   - 访问 https://serpapi.com/
   - 注册账号并登录
   - 进入 Dashboard → API Key
   - 复制 API Key

2. **运行验证脚本**
   ```bash
   cd backend
   python verify_serpapi.py
   ```

3. **验证结果**
   - ✅ 如果看到 "SerpApi 验证成功"，说明配置正确
   - ❌ 如果看到错误，请检查：
     - SERPAPI_API_KEY 是否正确
     - API Key 是否有效（未过期）
     - 网络连接是否正常
     - API 配额是否充足

4. **启动后端验证**
   ```bash
   python main.py
   ```
   
   应该看到日志：
   ```
   ⚠️ USE_MOCK_DATA=False - 使用真实 SerpApi 数据
   ```

5. **测试搜索 API**
   
   使用 curl 或 Postman 测试：
   ```bash
   curl -X POST http://localhost:8000/api/v1/search \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "origin": "JFK",
       "destination": "PVG",
       "start_date": "2026-04-01",
       "days": 1,
       "cabin_class": "economy",
       "adults": 1,
       "children": 0,
       "trip_type": "one_way"
     }'
   ```
   
   验证响应：
   - `data_source: "serpapi"`（而非 `"mock"`）
   - 真实的航班价格数据
   - 真实的航班详情（航司、航班号、时间等）

## 端到端测试清单

### PostgreSQL 迁移测试
- [ ] 验证脚本运行成功
- [ ] 后端启动时显示 "使用远程 PostgreSQL 数据库"
- [ ] 在 Supabase Dashboard 中看到所有表
- [ ] 创建用户、监控任务等操作正常
- [ ] 数据持久化正常（重启后端后数据仍在）

### SerpApi 真实数据测试
- [ ] 验证脚本运行成功
- [ ] 后端启动时显示 "使用真实 SerpApi 数据"
- [ ] 搜索 API 返回真实数据（`data_source: "serpapi"`）
- [ ] 热力图显示真实价格
- [ ] 创建监控任务时扣分正确
- [ ] 监控任务状态更新正常
- [ ] 在 SerpApi Dashboard 中看到 API 调用记录

## 注意事项

### PostgreSQL
- 生产环境必须使用 PostgreSQL（Supabase）
- 开发环境可以使用 SQLite（删除 DATABASE_URL 即可）
- Supabase 免费版有连接数限制（60 个连接）

### SerpApi
- 真实模式会消耗 SerpApi 配额，建议先用测试账号验证
- 开发环境建议使用 Mock 模式（`USE_MOCK_DATA=True`）
- 生产环境使用真实模式（`USE_MOCK_DATA=False`）
- 系统已实现缓存机制，相同搜索会使用缓存，减少 API 调用

## 故障排查

### PostgreSQL 连接失败
1. 检查 `DATABASE_URL` 格式是否正确
2. 确认 Supabase 项目未暂停
3. 检查网络连接和防火墙设置
4. 验证用户名和密码是否正确

### SerpApi 调用失败
1. 检查 `SERPAPI_API_KEY` 是否正确
2. 确认 API Key 未过期
3. 检查 SerpApi Dashboard 中的配额使用情况
4. 验证网络连接是否正常
5. 如果配额用尽，可以临时切换回 Mock 模式

## 参考文档

- [PostgreSQL 迁移指南](backend/MIGRATION_POSTGRESQL.md)
- [SerpApi 验证指南](backend/SERPAPI_VERIFICATION.md)

