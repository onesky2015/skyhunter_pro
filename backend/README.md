# SkyHunter Pro Backend

基于 FastAPI 的 SkyHunter Pro 后端服务。

## 技术栈

- **FastAPI**: 现代、快速的 Web 框架
- **Uvicorn**: ASGI 服务器
- **Python 3.8+**: 推荐使用 Python 3.9 或更高版本

## 快速开始

### 1. 创建虚拟环境

```bash
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1

# Windows CMD
python -m venv venv
venv\Scripts\activate.bat

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 运行开发服务器

```bash
# 方法 1: 直接运行 Python 文件
python main.py

# 方法 2: 使用 uvicorn 命令
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API

- **API 根路径**: http://localhost:8000/
- **交互式文档 (Swagger UI)**: http://localhost:8000/docs
- **ReDoc 文档**: http://localhost:8000/redoc
- **健康检查**: http://localhost:8000/health

## API 端点

### GET /
返回服务状态信息。

**响应示例:**
```json
{
  "status": "SkyHunter Backend is running"
}
```

### GET /health
健康检查端点。

**响应示例:**
```json
{
  "status": "healthy",
  "service": "SkyHunter Pro Backend"
}
```

## 项目结构

```
backend/
├── venv/              # 虚拟环境（需要创建）
├── main.py            # FastAPI 应用主文件
├── requirements.txt   # Python 依赖
└── README.md          # 项目文档
```

## 开发注意事项

- 确保在虚拟环境中运行项目
- 使用 `--reload` 参数启用热重载，代码修改后自动重启
- 生产环境部署时请修改 CORS 配置，限制允许的源

