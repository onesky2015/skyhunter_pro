#!/bin/bash
# SkyHunter Pro - API 端点验证脚本

BASE_URL="http://localhost:8000"
TOKEN=""

echo "=== SkyHunter Pro API 验证 ==="
echo ""

# 1. 健康检查
echo "1. 健康检查..."
curl -s "$BASE_URL/health" | jq .
echo ""

# 2. 用户注册
echo "2. 用户注册..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "full_name": "Test User"
  }')
echo "$REGISTER_RESPONSE" | jq .
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token // empty')
echo ""

# 3. 用户登录（如果注册失败，尝试登录）
if [ -z "$TOKEN" ]; then
  echo "3. 用户登录..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=test@example.com&password=test123456")
  echo "$LOGIN_RESPONSE" | jq .
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')
  echo ""
fi

# 4. 获取用户信息
if [ -n "$TOKEN" ]; then
  echo "4. 获取用户信息..."
  curl -s -X GET "$BASE_URL/api/v1/users/me" \
    -H "Authorization: Bearer $TOKEN" | jq .
  echo ""

  # 5. 搜索询价
  echo "5. 搜索询价..."
  curl -s -X POST "$BASE_URL/api/v1/quote/search" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"days": 30}' | jq .
  echo ""

  # 6. 执行搜索
  echo "6. 执行搜索..."
  curl -s -X POST "$BASE_URL/api/v1/search" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "origin": "JFK",
      "destination": "PVG",
      "start_date": "2026-04-01",
      "days": 1,
      "cabin_class": "economy",
      "adults": 1,
      "children": 0,
      "trip_type": "one_way"
    }' | jq .
  echo ""

  # 7. 创建监控任务
  echo "7. 创建监控任务..."
  MONITOR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/monitors" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "origin": "JFK",
      "destination": "PVG",
      "start_date": "2026-04-01",
      "days": 30,
      "cabin_class": "economy",
      "adults": 1,
      "children": 0,
      "trip_type": "one_way"
    }')
  echo "$MONITOR_RESPONSE" | jq .
  MONITOR_ID=$(echo "$MONITOR_RESPONSE" | jq -r '.id // empty')
  echo ""

  # 8. 获取监控列表
  echo "8. 获取监控列表..."
  curl -s -X GET "$BASE_URL/api/v1/monitors" \
    -H "Authorization: Bearer $TOKEN" | jq .
  echo ""

  # 9. 编辑监控任务
  if [ -n "$MONITOR_ID" ]; then
    echo "9. 编辑监控任务..."
    curl -s -X PUT "$BASE_URL/api/v1/monitors/$MONITOR_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "target_price": 500
      }' | jq .
    echo ""

    # 10. 获取回收站
    echo "10. 获取回收站..."
    curl -s -X GET "$BASE_URL/api/v1/monitors/trash" \
      -H "Authorization: Bearer $TOKEN" | jq .
    echo ""
  fi
else
  echo "❌ 无法获取 Token，跳过需要认证的测试"
fi

echo "=== 验证完成 ==="

