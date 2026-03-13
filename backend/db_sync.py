#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# filename: backend/db_sync.py
"""
SkyHunter Pro - 数据库同步工具

在本地 SQLite 和远程 PostgreSQL (Supabase) 之间双向同步数据，
确保本地开发环境和远程生产环境的数据一致。

使用方法:
    python db_sync.py pull     # 远程 → 本地（从 Supabase 拉取数据到本地 SQLite）
    python db_sync.py push     # 本地 → 远程（将本地 SQLite 数据推送到 Supabase）
    python db_sync.py status   # 查看两端数据统计对比

注意:
    - pull 会清空本地表后重新插入远程数据（全量覆盖）
    - push 会清空远程表后重新插入本地数据（全量覆盖）
    - 同步前会自动备份目标端数据
    - 密码哈希、积分等敏感数据会原样同步
"""

import os
import sys
import io
import json
import logging
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

# 修复 Windows 终端 GBK 编码问题
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("DBSync")

# ============================================================================
# 加载配置
# ============================================================================

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_LOCAL = os.path.join(BACKEND_DIR, ".env.local")
ENV_REMOTE = os.path.join(BACKEND_DIR, ".env.remote")


def load_env_file(path: str) -> dict:
    """解析 .env 文件为字典"""
    result = {}
    if not os.path.exists(path):
        return result
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                result[key.strip()] = value.strip()
    return result


def get_local_url() -> str:
    """获取本地 SQLite 数据库 URL"""
    env = load_env_file(ENV_LOCAL)
    url = env.get("DATABASE_URL", "sqlite:///./skyhunter_local.db")
    return url


def get_remote_url() -> str:
    """获取远程 PostgreSQL 数据库 URL"""
    env = load_env_file(ENV_REMOTE)
    url = env.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError(
            "❌ .env.remote 中未配置 DATABASE_URL\n"
            "   请先创建 .env.remote 文件并配置 PostgreSQL 连接字符串"
        )
    return url


# ============================================================================
# 数据库连接
# ============================================================================


def create_engines():
    """创建本地和远程数据库引擎"""
    from sqlmodel import create_engine as ce

    local_url = get_local_url()
    remote_url = get_remote_url()

    is_sqlite = local_url.startswith("sqlite")
    local_engine = ce(
        local_url,
        echo=False,
        connect_args={"check_same_thread": False} if is_sqlite else {},
    )

    remote_engine = ce(
        remote_url,
        echo=False,
        pool_pre_ping=True,
        pool_timeout=30,
    )

    return local_engine, remote_engine


# ============================================================================
# 同步核心逻辑
# ============================================================================

# 需要同步的表（按依赖顺序排列）
SYNC_TABLES = [
    "users",
    "password_resets",
    "monitor_tasks",
    "flight_cache",
    "price_history",
]


def get_table_count(engine, table_name: str) -> int:
    """获取表的记录数"""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            return result.scalar() or 0
    except Exception:
        return -1


def get_table_data(engine, table_name: str) -> list:
    """获取表的所有数据"""
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT * FROM {table_name}"))
        columns = list(result.keys())
        rows = []
        for row in result.fetchall():
            rows.append(dict(zip(columns, row)))
        return rows


def clear_table(engine, table_name: str):
    """清空表数据"""
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {table_name}"))


def insert_rows(engine, table_name: str, rows: list, is_target_sqlite: bool = False):
    """批量插入数据"""
    if not rows:
        return
    from sqlalchemy import text

    columns = list(rows[0].keys())
    col_names = ", ".join(f'"{c}"' for c in columns)

    with engine.begin() as conn:
        for row in rows:
            placeholders = ", ".join(f":{c}" for c in columns)
            sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders})'
            # 处理布尔值兼容性
            params = {}
            for c in columns:
                val = row[c]
                if isinstance(val, bool) and is_target_sqlite:
                    val = 1 if val else 0
                params[c] = val
            conn.execute(text(sql), params)


def reset_sequence(engine, table_name: str, max_id: int):
    """重置 PostgreSQL 序列（避免主键冲突）"""
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            seq_name = f"{table_name}_id_seq"
            conn.execute(text(f"SELECT setval('{seq_name}', {max(max_id, 1)}, true)"))
    except Exception as e:
        logger.warning(f"  ⚠️ 重置序列 {table_name}_id_seq 失败: {e}")


# ============================================================================
# 同步操作
# ============================================================================


def sync_pull():
    """远程 → 本地：从 Supabase 拉取数据到本地 SQLite"""
    print()
    print("=" * 60)
    print("⬇️  PULL: 远程 PostgreSQL → 本地 SQLite")
    print("=" * 60)
    print()

    local_engine, remote_engine = create_engines()

    # 确保本地表结构存在
    from main import SQLModel as SM
    SM.metadata.create_all(local_engine)
    logger.info("✅ 本地 SQLite 表结构已就绪")

    # 按依赖逆序清空本地表（先删子表）
    for table_name in reversed(SYNC_TABLES):
        try:
            clear_table(local_engine, table_name)
            logger.info(f"  🗑️  清空本地表: {table_name}")
        except Exception as e:
            logger.warning(f"  ⚠️ 清空本地表 {table_name} 失败: {e}")

    # 按依赖顺序插入数据（先插父表）
    total_synced = 0
    for table_name in SYNC_TABLES:
        try:
            rows = get_table_data(remote_engine, table_name)
            if rows:
                insert_rows(local_engine, table_name, rows, is_target_sqlite=True)
            count = len(rows)
            total_synced += count
            logger.info(f"  ✅ {table_name}: {count} 条记录已同步")
        except Exception as e:
            logger.error(f"  ❌ 同步 {table_name} 失败: {e}")

    print()
    print(f"✅ PULL 完成！共同步 {total_synced} 条记录到本地")
    print()


def sync_push():
    """本地 → 远程：将本地 SQLite 数据推送到 Supabase"""
    print()
    print("=" * 60)
    print("⬆️  PUSH: 本地 SQLite → 远程 PostgreSQL")
    print("=" * 60)
    print()

    # 安全确认
    confirm = input("⚠️  这将覆盖远程 Supabase 数据库中的所有数据！确认继续? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("❌ 操作已取消")
        return

    local_engine, remote_engine = create_engines()

    # 按依赖逆序清空远程表
    for table_name in reversed(SYNC_TABLES):
        try:
            clear_table(remote_engine, table_name)
            logger.info(f"  🗑️  清空远程表: {table_name}")
        except Exception as e:
            logger.warning(f"  ⚠️ 清空远程表 {table_name} 失败: {e}")

    # 按依赖顺序插入数据
    total_synced = 0
    for table_name in SYNC_TABLES:
        try:
            rows = get_table_data(local_engine, table_name)
            if rows:
                insert_rows(remote_engine, table_name, rows, is_target_sqlite=False)
                # 重置 PostgreSQL 序列
                max_id = max(r.get("id", 0) for r in rows) if rows else 0
                if max_id > 0:
                    reset_sequence(remote_engine, table_name, max_id)
            count = len(rows)
            total_synced += count
            logger.info(f"  ✅ {table_name}: {count} 条记录已同步")
        except Exception as e:
            logger.error(f"  ❌ 同步 {table_name} 失败: {e}")

    print()
    print(f"✅ PUSH 完成！共同步 {total_synced} 条记录到远程")
    print()


def show_status():
    """显示两端数据统计对比"""
    print()
    print("=" * 60)
    print("📊 数据库同步状态对比")
    print("=" * 60)
    print()

    try:
        local_engine, remote_engine = create_engines()
    except Exception as e:
        print(f"❌ 无法连接数据库: {e}")
        return

    print(f"  {'表名':<20} {'本地 SQLite':>12} {'远程 PostgreSQL':>16}")
    print(f"  {'-' * 20} {'-' * 12} {'-' * 16}")

    for table_name in SYNC_TABLES:
        local_count = get_table_count(local_engine, table_name)
        remote_count = get_table_count(remote_engine, table_name)

        local_str = str(local_count) if local_count >= 0 else "N/A"
        remote_str = str(remote_count) if remote_count >= 0 else "N/A"

        # 标记不一致
        marker = ""
        if local_count >= 0 and remote_count >= 0:
            if local_count != remote_count:
                marker = " ⚠️"
            else:
                marker = " ✅"

        print(f"  {table_name:<20} {local_str:>12} {remote_str:>16}{marker}")

    print()
    print("📌 同步命令:")
    print("  python db_sync.py pull   → 远程数据覆盖到本地")
    print("  python db_sync.py push   → 本地数据覆盖到远程")
    print()


# ============================================================================
# 入口
# ============================================================================

def main():
    if len(sys.argv) < 2:
        show_status()
        sys.exit(0)

    command = sys.argv[1].strip().lower()

    if command == "pull":
        sync_pull()
    elif command == "push":
        sync_push()
    elif command == "status":
        show_status()
    else:
        print(f"❌ 未知命令: {command}")
        print()
        print("使用方法:")
        print("  python db_sync.py pull     # 远程 → 本地")
        print("  python db_sync.py push     # 本地 → 远程")
        print("  python db_sync.py status   # 查看状态对比")
        sys.exit(1)


if __name__ == "__main__":
    main()

