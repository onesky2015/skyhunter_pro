# SerpApi 验证指南

## 概述

本文档说明如何关闭 Mock 模式并验证 SerpApi 真实数据链路。

## 当前状态

- ✅ 代码已支持 Mock 和真实模式切换（通过 `USE_MOCK_DATA` 环境变量）
- ✅ Mock 模式：使用模拟数据，不消耗 SerpApi 配额
- ⚠️ 真实模式：需要配置 `SERPAPI_API_KEY` 并关闭 Mock

## 验证步骤

### 1. 配置 SerpApi API Key

在 `backend/.env` 文件中添加：

```env
# SerpApi 配置
SERPAPI_API_KEY=your-serpapi-api-key-here

# 关闭 Mock 模式
USE_MOCK_DATA=False
```

### 2. 获取 SerpApi API Key

1. 访问 https://serpapi.com/
2. 注册账号并登录
3. 进入 Dashboard → API Key
4. 复制 API Key

**注意**：SerpApi 有免费配额限制，建议先用测试账号验证。

### 3. 验证后端配置

启动后端并检查日志：

```bash
cd backend
python main.py
```

应该看到：
```
✅ 使用远程 PostgreSQL 数据库
⚠️ USE_MOCK_DATA=False - 使用真实 SerpApi 数据
```

### 4. 测试搜索 API

使用 Postman 或 curl 测试搜索接口：

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

### 5. 验证响应

真实模式下，响应应包含：
- `data_source: "serpapi"`（而非 `"mock"`）
- 真实的航班价格数据
- 真实的航班详情（航司、航班号、时间等）
- 真实的预订链接

### 6. 检查 SerpApi Dashboard

1. 登录 SerpApi Dashboard
2. 查看 **Usage** 页面
3. 确认搜索请求已记录
4. 检查配额使用情况

## 端到端测试清单

### 后端测试

- [ ] 搜索接口返回真实数据
- [ ] 缓存机制正常工作（FlightCache 表）
- [ ] 价格历史记录正常写入（PriceHistory 表）
- [ ] 监控任务创建时执行真实搜索
- [ ] 调度器检查时使用真实数据

### 前端测试

- [ ] 搜索页面显示真实价格
- [ ] 热力图显示真实数据
- [ ] 创建监控任务时扣分正确
- [ ] 监控任务状态更新正常
- [ ] 邮件通知包含真实预订链接

### 集成测试

- [ ] 完整搜索流程：前端 → 后端 → SerpApi → 返回数据
- [ ] 监控任务流程：创建 → 调度器检查 → 价格更新 → 邮件通知
- [ ] 缓存机制：重复搜索使用缓存，不重复调用 SerpApi

## 常见问题

### 1. API Key 无效

**错误**：`Invalid API key`

**解决**：
- 检查 `.env` 中的 `SERPAPI_API_KEY` 是否正确
- 确认 API Key 未过期
- 检查 SerpApi 账号状态

### 2. 配额用尽

**错误**：`API quota exceeded`

**解决**：
- 检查 SerpApi Dashboard → Usage
- 升级账号或等待配额重置
- 临时切换回 Mock 模式：`USE_MOCK_DATA=True`

### 3. 搜索无结果

**可能原因**：
- 日期太早（SerpApi 可能不支持历史日期）
- 航线不存在或不可用
- SerpApi 服务暂时不可用

**解决**：
- 使用未来日期测试（建议 30 天后）
- 尝试热门航线（如 JFK → PVG）
- 检查 SerpApi 状态页面

### 4. 响应时间过长

**原因**：SerpApi 需要时间抓取数据

**解决**：
- 正常现象，真实搜索通常需要 5-30 秒
- 考虑添加超时处理和加载提示
- 使用缓存减少重复请求

## 成本控制

### 缓存策略

系统已实现 FlightCache 机制：
- 相同路线和日期的搜索会使用缓存
- 缓存有效期：4 小时（可通过 `CACHE_HOURS` 配置）
- 建议：生产环境保持缓存开启

### 配额管理

1. **监控使用量**：定期检查 SerpApi Dashboard
2. **设置告警**：在 SerpApi 中设置配额告警
3. **优化搜索**：避免不必要的重复搜索
4. **批量测试**：开发环境使用 Mock，生产环境使用真实数据

## 生产环境建议

1. **环境变量**：
   ```env
   USE_MOCK_DATA=False
   SERPAPI_API_KEY=production-key
   CACHE_HOURS=4
   ```

2. **监控**：
   - 监控 SerpApi 调用次数
   - 监控 API 响应时间
   - 监控错误率

3. **降级策略**：
   - SerpApi 不可用时，可以考虑：
     - 返回缓存数据
     - 显示友好错误信息
     - 临时切换到 Mock 模式（不推荐）

## 参考

- [SerpApi 文档](https://serpapi.com/)
- [Google Flights API](https://serpapi.com/google-flights-api)
- [API 配额说明](https://serpapi.com/pricing)

