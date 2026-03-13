#!/usr/bin/env python3
"""
PostgreSQL 迁移验证脚本

使用方法：
1. 确保 .env 中配置了 DATABASE_URL
2. 运行: python verify_postgresql.py
"""

import os
import sys
import io
from dotenv import load_dotenv
from sqlalchemy import text

# 修复 Windows 终端 GBK 编码问题，强制 UTF-8 输出
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

def verify_postgresql():
    """验证 PostgreSQL 配置和连接"""
    print("=" * 60)
    print("PostgreSQL 迁移验证")
    print("=" * 60)
    
    if not DATABASE_URL:
        print("❌ 错误: DATABASE_URL 环境变量未配置")
        print("\n请在 .env 文件中添加:")
        print("DATABASE_URL=postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres")
        return False
    
    if not DATABASE_URL.startswith("postgresql://"):
        print(f"⚠️  警告: DATABASE_URL 不是 PostgreSQL 格式: {DATABASE_URL[:50]}...")
        print("   如果使用 SQLite，请删除 DATABASE_URL 环境变量")
        return False
    
    print(f"✅ DATABASE_URL 已配置: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else '***'}")
    
    # 尝试连接数据库
    try:
        from sqlmodel import create_engine, Session
        from main import User, MonitorTask, FlightCache, PriceHistory
        
        print("\n正在连接数据库...")
        engine = create_engine(DATABASE_URL, echo=False)
        
        with Session(engine) as session:
            # 检查表是否存在
            print("检查数据库表...")
            tables = ["users", "monitor_tasks", "flight_cache", "price_history"]
            for table in tables:
                try:
                    result = session.exec(text(f"SELECT 1 FROM {table} LIMIT 1"))
                    print(f"  ✅ 表 {table} 存在")
                except Exception as e:
                    print(f"  ❌ 表 {table} 不存在或无法访问: {e}")
                    return False
            
            # 测试基本查询
            print("\n测试基本查询...")
            users = session.exec(text("SELECT COUNT(*) FROM users")).first()
            tasks = session.exec(text("SELECT COUNT(*) FROM monitor_tasks")).first()
            print(f"  ✅ Users 表: {users} 条记录")
            print(f"  ✅ MonitorTasks 表: {tasks} 条记录")
        
        print("\n" + "=" * 60)
        print("✅ PostgreSQL 迁移验证成功！")
        print("=" * 60)
        return True
        
    except ImportError as e:
        print(f"❌ 导入错误: {e}")
        print("   请确保已安装所有依赖: pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print("\n可能的原因:")
        print("  1. DATABASE_URL 格式错误")
        print("  2. 数据库服务器不可访问")
        print("  3. 用户名或密码错误")
        print("  4. 网络连接问题")
        return False

if __name__ == "__main__":
    success = verify_postgresql()
    sys.exit(0 if success else 1)

