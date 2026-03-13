#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# filename: backend/switch_env.py
"""
SkyHunter Pro - 环境切换工具

一键切换本地开发 / 远程生产环境。
将对应的 .env.local 或 .env.remote 复制为 .env 并重启服务。

使用方法:
    python switch_env.py local    # 切换到本地 SQLite + Mock（快速开发）
    python switch_env.py remote   # 切换到远程 PostgreSQL + SerpApi（生产测试）
    python switch_env.py status   # 查看当前环境状态
"""

import os
import sys
import shutil
import io

# 修复 Windows 终端 GBK 编码问题，强制 UTF-8 输出
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BACKEND_DIR, ".env")
ENV_LOCAL = os.path.join(BACKEND_DIR, ".env.local")
ENV_REMOTE = os.path.join(BACKEND_DIR, ".env.remote")


def get_current_mode() -> str:
    """读取当前 .env 中的 DB_MODE"""
    if not os.path.exists(ENV_FILE):
        return "未配置"
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DB_MODE="):
                return line.split("=", 1)[1].strip()
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip()
                if "sqlite" in url:
                    return "local (auto-detected)"
                elif "postgresql" in url:
                    return "remote (auto-detected)"
    return "unknown"


def show_status():
    """显示当前环境状态"""
    print("=" * 60)
    print("🔍 SkyHunter Pro 环境状态")
    print("=" * 60)

    current_mode = get_current_mode()
    print(f"  当前模式: {current_mode}")
    print(f"  .env 文件: {'✅ 存在' if os.path.exists(ENV_FILE) else '❌ 不存在'}")
    print(f"  .env.local: {'✅ 存在' if os.path.exists(ENV_LOCAL) else '❌ 不存在'}")
    print(f"  .env.remote: {'✅ 存在' if os.path.exists(ENV_REMOTE) else '❌ 不存在'}")

    # 检查本地 SQLite 数据库
    sqlite_db = os.path.join(BACKEND_DIR, "skyhunter_local.db")
    if os.path.exists(sqlite_db):
        size_mb = os.path.getsize(sqlite_db) / (1024 * 1024)
        print(f"  本地数据库: ✅ skyhunter_local.db ({size_mb:.2f} MB)")
    else:
        print("  本地数据库: ❌ skyhunter_local.db 不存在（首次启动时自动创建）")

    print("=" * 60)
    print()
    print("📌 切换命令:")
    print("  python switch_env.py local   → 本地 SQLite + Mock（快速）")
    print("  python switch_env.py remote  → 远程 PostgreSQL + SerpApi")
    print("  python switch_env.py sync    → 同步本地↔远程数据库")


def switch_to(mode: str):
    """切换到指定模式"""
    if mode == "local":
        source = ENV_LOCAL
        label = "🏠 本地开发 (SQLite + Mock)"
    elif mode == "remote":
        source = ENV_REMOTE
        label = "🌐 远程生产 (PostgreSQL + SerpApi)"
    else:
        print(f"❌ 未知模式: {mode}")
        print("   可用模式: local / remote / status / sync")
        sys.exit(1)

    if not os.path.exists(source):
        print(f"❌ 配置文件不存在: {source}")
        print(f"   请先创建 .env.{mode} 文件")
        sys.exit(1)

    # 备份当前 .env（如果存在）
    if os.path.exists(ENV_FILE):
        current_mode = get_current_mode()
        backup_name = f".env.backup.{current_mode}" if current_mode not in ("未配置", "unknown") else ".env.backup"
        backup_path = os.path.join(BACKEND_DIR, backup_name)
        shutil.copy2(ENV_FILE, backup_path)
        print(f"  📦 已备份当前 .env → {backup_name}")

    # 复制新配置
    shutil.copy2(source, ENV_FILE)

    print()
    print("=" * 60)
    print(f"✅ 已切换到: {label}")
    print("=" * 60)
    print()
    print("⚠️  请重启后端服务以使配置生效:")
    print("   1. 停止当前运行的 python main.py (Ctrl+C)")
    print("   2. 重新运行: python main.py")
    print()

    if mode == "local":
        print("💡 提示:")
        print("   - 本地模式使用 SQLite，无需网络连接")
        print("   - Mock 数据模式已开启，不消耗 SerpApi 额度")
        print("   - 如需同步远程数据到本地: python switch_env.py sync")
    elif mode == "remote":
        print("💡 提示:")
        print("   - 远程模式连接 Supabase PostgreSQL (美国)")
        print("   - 网络延迟可能导致操作稍慢")
        print("   - USE_MOCK_DATA=False，将消耗 SerpApi 额度")


def run_sync():
    """调用 db_sync.py 同步数据库"""
    sync_script = os.path.join(BACKEND_DIR, "db_sync.py")
    if not os.path.exists(sync_script):
        print("❌ db_sync.py 不存在")
        sys.exit(1)
    os.system(f'python "{sync_script}"')


def main():
    if len(sys.argv) < 2:
        show_status()
        sys.exit(0)

    command = sys.argv[1].strip().lower()

    if command == "status":
        show_status()
    elif command in ("local", "remote"):
        switch_to(command)
    elif command == "sync":
        run_sync()
    else:
        print(f"❌ 未知命令: {command}")
        print()
        print("使用方法:")
        print("  python switch_env.py local   # 切换到本地开发")
        print("  python switch_env.py remote  # 切换到远程生产")
        print("  python switch_env.py status  # 查看当前状态")
        print("  python switch_env.py sync    # 同步数据库")
        sys.exit(1)


if __name__ == "__main__":
    main()

