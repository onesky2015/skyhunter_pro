#!/usr/bin/env python3
"""
SkyHunter Pro - API 端点验证脚本
使用 Python requests 库测试所有 API 端点
"""

import requests
import json
import time
from typing import Optional

BASE_URL = "http://localhost:8000"
TOKEN: Optional[str] = None

def print_section(title: str):
    print(f"\n{'='*50}")
    print(f"{title}")
    print('='*50)

def test_health_check():
    """测试健康检查端点"""
    print_section("1. 健康检查")
    last_error = None
    for attempt in range(1, 4):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            print(f"Status: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
            return response.status_code == 200
        except Exception as e:
            last_error = e
            print(f"⚠️ 第 {attempt} 次健康检查失败: {e}")
            if attempt < 3:
                time.sleep(2)
    print(f"❌ 错误: {last_error}")
    return False

def test_signup() -> bool:
    """测试用户注册"""
    print_section("2. 用户注册")
    global TOKEN
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/signup",
            json={
                "email": "test@example.com",
                "password": "test123456",
                "full_name": "Test User"
            }
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
        if response.status_code == 201:
            TOKEN = data.get("access_token")
            return True
        elif response.status_code == 400:
            print("⚠️  用户可能已存在，尝试登录...")
            return False
        return False
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_login() -> bool:
    """测试用户登录"""
    print_section("3. 用户登录")
    global TOKEN
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/token",
            data={
                "username": "test@example.com",
                "password": "test123456"
            }
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
        if response.status_code == 200:
            TOKEN = data.get("access_token")
            return True
        return False
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_get_user_info() -> bool:
    """测试获取用户信息"""
    print_section("4. 获取用户信息")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/users/me",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_login_rate_limit() -> bool:
    """测试登录限流：连续失败后应返回 429"""
    print_section("4A. 登录限流")
    email = f"limit-test-{int(time.time())}@example.com"
    try:
        last_status = None
        for attempt in range(1, 7):
            response = requests.post(
                f"{BASE_URL}/api/v1/auth/token",
                data={
                    "username": email,
                    "password": "wrong-password"
                }
            )
            last_status = response.status_code
            print(f"Attempt {attempt}: {response.status_code}")
            if response.status_code == 429:
                print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
                return True
        print(f"⚠️ 最终状态码: {last_status}")
        return False
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_quote_search() -> bool:
    """测试搜索询价"""
    print_section("5. 搜索询价")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/quote/search",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json"
            },
            json={"days": 30}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_search() -> bool:
    """测试搜索功能"""
    print_section("6. 执行搜索")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/search",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "origin": "JFK",
                "destination": "PVG",
                "start_date": "2026-04-01",
                "days": 1,
                "cabin_class": "economy",
                "adults": 1,
                "children": 0,
                "trip_type": "one_way"
            }
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        if "heatmap_data" in data:
            print(f"Heatmap cells: {len(data['heatmap_data'])}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_create_monitor() -> Optional[int]:
    """测试创建监控任务"""
    print_section("7. 创建监控任务")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return None
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/monitors",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "origin": "JFK",
                "destination": "PVG",
                "start_date": "2026-04-01",
                "days": 30,
                "cabin_class": "economy",
                "adults": 1,
                "children": 0,
                "trip_type": "one_way"
            }
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
        if response.status_code == 201:
            return data.get("id")
        return None
    except Exception as e:
        print(f"❌ 错误: {e}")
        return None

def test_topup(amount: int = 10) -> bool:
    """为后续创建监控补充积分，避免被当前动态计费误判为失败"""
    print_section("7A. 补充积分")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/users/topup",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json"
            },
            json={"amount": amount}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_get_transactions() -> bool:
    """测试获取当前用户积分流水"""
    print_section("7B. 获取积分流水")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/users/transactions?limit=20",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Transactions count: {len(data) if isinstance(data, list) else 'N/A'}")
        if isinstance(data, list) and data:
            print(f"Latest transaction: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
        return response.status_code == 200 and isinstance(data, list)
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_get_monitors() -> bool:
    """测试获取监控列表"""
    print_section("8. 获取监控列表")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/monitors",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Monitors count: {len(data)}")
        if data:
            print(f"First monitor: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_update_monitor(monitor_id: int) -> bool:
    """测试编辑监控任务"""
    print_section("9. 编辑监控任务")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.put(
            f"{BASE_URL}/api/v1/monitors/{monitor_id}",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json"
            },
            json={"target_price": 500}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_get_trash() -> bool:
    """测试获取回收站"""
    print_section("10. 获取回收站")
    if not TOKEN:
        print("❌ 无 Token，跳过")
        return False
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/monitors/trash",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Trash count: {len(data)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def main():
    """主函数"""
    print("\n" + "="*50)
    print("SkyHunter Pro - API 端点验证")
    print("="*50)
    
    results = {}
    
    # 1. 健康检查
    results["health"] = test_health_check()
    
    # 2. 注册或登录
    if not test_signup():
        results["login"] = test_login()
    else:
        results["signup"] = True
    
    # 3. 需要认证的端点
    if TOKEN:
        results["user_info"] = test_get_user_info()
        results["login_rate_limit"] = test_login_rate_limit()
        results["quote"] = test_quote_search()
        results["search"] = test_search()
        results["topup"] = test_topup()
        results["transactions"] = test_get_transactions()
        monitor_id = test_create_monitor()
        results["create_monitor"] = monitor_id is not None
        results["get_monitors"] = test_get_monitors()
        if monitor_id:
            results["update_monitor"] = test_update_monitor(monitor_id)
        results["trash"] = test_get_trash()
    
    # 总结
    print_section("验证结果总结")
    for endpoint, success in results.items():
        status = "✅" if success else "❌"
        print(f"{status} {endpoint}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\n总计: {passed}/{total} 通过")

if __name__ == "__main__":
    main()

