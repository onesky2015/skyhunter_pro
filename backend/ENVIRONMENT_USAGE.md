# Backend Environment Usage

## 目的

本文件用于明确 `backend` 目录下环境文件的职责，避免在 `Phase 2C` 之后继续出现环境混用、误切换或误读取旧配置的问题。

## 文件角色

### `.env.local`

用于本地开发。

特点：

- `DB_MODE=local`
- `DATABASE_URL=sqlite:///./skyhunter_local.db`
- `USE_MOCK_DATA=True`
- 不依赖远程数据库
- 不消耗真实 SerpApi 配额

适用场景：

- 本地 UI 联调
- 本地接口开发
- 不需要真实航班数据时

### `.env.remote`

用于远程验证和真实链路测试。

特点：

- `DB_MODE=remote`
- `DATABASE_URL=postgresql://...`
- `USE_MOCK_DATA=False`
- 使用真实 SerpApi
- 需要显式配置 `CORS_ALLOWED_ORIGINS`

适用场景：

- `Phase 2B` 真实环境闭环验证
- 远程数据库验证
- 真实搜索链路验证

### `.env`

当前激活环境。

规则：

- `main.py` 默认读取 `.env`
- 不应手工长期维护多份不同内容的 `.env`
- 应通过 `switch_env.py` 从 `.env.local` 或 `.env.remote` 复制生成

## 推荐使用方式

### 查看当前模式

```bash
cd backend
python switch_env.py status
```

### 切换到本地模式

```bash
cd backend
python switch_env.py local
```

### 切换到远程模式

```bash
cd backend
python switch_env.py remote
```

### 切换后必须执行

```bash
cd backend
python main.py
```

切换环境后必须重启后端，新的 `.env` 才会生效。

## 当前约束

以下文件可以继续保留：

- `.env.local`
- `.env.remote`
- `.env`

以下文件不应继续作为“运行配置源”使用：

- `.env.backup.*`
- `.env copy`
- `.env copy 2`
- `.env - 副本.local`

它们只应视为历史备份或临时副本，不应作为当前环境切换入口。

## 安全约束

- 不要把真实密钥写进 `.env.example`
- 不要在文档、日志、截图中展示完整密钥
- 后续建议执行密钥轮换，尤其是远程数据库、JWT、邮件和 SerpApi 相关密钥

## 当前阶段建议

在 `Phase 2C` 中，环境治理的最低要求是：

1. 只通过 `switch_env.py` 切换当前环境
2. 只让 `.env.local` 和 `.env.remote` 作为源文件
3. 使用 `.env.example` 说明字段，不存真实值
4. 后续不再新增新的 `.env copy` 类型文件
