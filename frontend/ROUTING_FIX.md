# 路由问题修复说明

## 问题
访问 `localhost:8081` 时显示 "Unmatched Route" 错误。

## 原因
expo-router 需要一个 `app/index.tsx` 文件来处理根路径 `/`。

## 已修复
✅ 已创建 `app/index.tsx` 文件
✅ 已更新 `app/_layout.tsx` 添加 index 路由
✅ 已更新 `package.json` 的 main 字段

## 解决步骤

### 1. 停止当前开发服务器
按 `Ctrl+C` 停止 Expo 开发服务器

### 2. 清除缓存并重启

```bash
cd frontend
npm start -- --clear
```

或者：

```bash
cd frontend
npx expo start --clear
```

### 3. 重新访问
在浏览器中访问 http://localhost:8081（或 Expo 显示的 URL）

## 预期行为

1. **首次访问**：显示加载画面（SKYHUNTER + Loading）
2. **未登录**：自动跳转到 `/auth/login`
3. **已登录**：自动跳转到 `/(tabs)/search`

## 如果仍然不工作

1. **删除 node_modules 并重新安装**：
   ```bash
   cd frontend
   rm -rf node_modules
   npm install
   npm start -- --clear
   ```

2. **检查文件结构**：
   确保 `app/index.tsx` 文件存在

3. **检查控制台错误**：
   打开浏览器开发者工具，查看是否有错误信息

## 文件结构确认

确保以下文件存在：
```
frontend/
├── app/
│   ├── index.tsx          ✅ 根路由（必须）
│   ├── _layout.tsx        ✅ 根布局
│   ├── (tabs)/
│   │   ├── _layout.tsx   ✅ Tab 布局
│   │   ├── search.tsx    ✅
│   │   ├── monitors.tsx   ✅
│   │   └── profile.tsx   ✅
│   └── auth/
│       ├── login.tsx     ✅
│       ├── signup.tsx    ✅
│       └── forgot.tsx    ✅
└── index.ts              ✅ 入口文件（使用 expo-router/entry）
```

