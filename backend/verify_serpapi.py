#!/usr/bin/env python3
"""
SerpApi 验证脚本

使用方法：
1. 确保 .env 中配置了 SERPAPI_API_KEY 和 USE_MOCK_DATA=False
2. 运行: python verify_serpapi.py
"""

import os
import sys
import io
from dotenv import load_dotenv

# 修复 Windows 终端 GBK 编码问题，强制 UTF-8 输出
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

load_dotenv()

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "").strip().lower()

def verify_serpapi():
    """验证 SerpApi 配置"""
    print("=" * 60)
    print("SerpApi 验证")
    print("=" * 60)
    
    # 检查 USE_MOCK_DATA
    if USE_MOCK_DATA not in ("true", "false", "1", "0"):
        print("❌ 错误: USE_MOCK_DATA 环境变量未配置或无效")
        print("\n请在 .env 文件中添加:")
        print("USE_MOCK_DATA=False")
        return False
    
    is_mock = USE_MOCK_DATA in ("true", "1")
    if is_mock:
        print("⚠️  警告: USE_MOCK_DATA=True，将使用 Mock 数据")
        print("   如需测试真实 SerpApi，请设置 USE_MOCK_DATA=False")
        return False
    
    print("✅ USE_MOCK_DATA=False (使用真实 SerpApi)")
    
    # 检查 API Key
    if not SERPAPI_API_KEY:
        print("❌ 错误: SERPAPI_API_KEY 环境变量未配置")
        print("\n请在 .env 文件中添加:")
        print("SERPAPI_API_KEY=your-serpapi-api-key-here")
        return False
    
    print(f"✅ SERPAPI_API_KEY 已配置: {SERPAPI_API_KEY[:10]}...{SERPAPI_API_KEY[-4:]}")
    
    # 测试 API 调用
    try:
        import requests
        
        print("\n测试 SerpApi 连接...")
        test_url = "https://serpapi.com/search.json"
        params = {
            "engine": "google_flights",
            "api_key": SERPAPI_API_KEY,
            "departure_id": "JFK",
            "arrival_id": "PVG",
            "outbound_date": "2026-04-01",
            "type": "2",
            "currency": "USD",
            "hl": "en",
        }
        
        response = requests.get(test_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if "error" in data:
                print(f"❌ SerpApi 返回错误: {data.get('error', 'Unknown error')}")
                return False
            
            print("✅ SerpApi API 调用成功")
            print(f"  - 返回数据包含 {len(data.get('best_flights', []))} 个最佳航班")
            print(f"  - 数据源: {data.get('search_metadata', {}).get('engine', 'unknown')}")
            
            print("\n" + "=" * 60)
            print("✅ SerpApi 验证成功！")
            print("=" * 60)
            return True
        else:
            print(f"❌ HTTP 错误: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
            return False
            
    except ImportError:
        print("❌ 错误: requests 库未安装")
        print("   请运行: pip install requests")
        return False
    except Exception as e:
        print(f"❌ SerpApi 测试失败: {e}")
        print("\n可能的原因:")
        print("  1. API Key 无效或已过期")
        print("  2. 网络连接问题")
        print("  3. SerpApi 服务暂时不可用")
        print("  4. API 配额已用尽")
        return False

if __name__ == "__main__":
    success = verify_serpapi()
    sys.exit(0 if success else 1)

