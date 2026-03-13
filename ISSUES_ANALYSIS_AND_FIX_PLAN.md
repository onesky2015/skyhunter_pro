# 问题分析与修改方案

**分析日期**: 2026-02-11  
**问题数量**: 5 个  
**优先级**: 全部为 P0（核心功能问题）

---

## 一、问题详细分析

### 问题 1: 搜索范围日期固定显示为 30 天

**当前状态**:
- UI 显示: "📊 Range 30 Days"（固定文本）
- 实际逻辑: 代码已支持根据 `startDate` 和 `endDate` 计算天数
- 问题: UI 文本误导用户，没有明确说明是用户自定义范围

**代码位置**:
- `frontend/app/(tabs)/search.tsx:134` - "📊 Range 30 Days" 文本
- `frontend/app/(tabs)/search.tsx:47-56` - 天数计算逻辑（已正确）

**影响**:
- 用户体验：用户可能认为只能搜索 30 天
- 功能误解：实际支持自定义范围，但 UI 未体现

**修复方案**:
1. 修改按钮文本为 "📊 Date Range" 或动态显示实际天数
2. 在日期选择器下方显示实际搜索天数
3. 更新费用显示，根据实际天数计算

---

### 问题 2: 单程固定日期搜索的 DEPARTURE DATE 无法输入

**当前状态**:
- `DatePicker` 组件已实现点击弹出日历功能
- Web 平台：使用 HTML5 `input[type="date"]`
- Native 平台：使用 `@react-native-community/datetimepicker`

**可能的问题**:
1. Web 平台的 `openWebDatePicker` 可能在某些情况下不工作
2. Native 平台的 DateTimePicker 可能没有正确显示
3. 用户体验不够直观

**代码位置**:
- `frontend/components/DatePicker.tsx:42-67` - Web 平台日期选择
- `frontend/components/DatePicker.tsx:86-106` - Native 平台日期选择

**修复方案**:
1. 改进 Web 平台的日期选择器实现（使用 Modal + 日历组件）
2. 确保 Native 平台的 DateTimePicker 正确显示
3. 添加视觉反馈，明确指示可点击

---

### 问题 3: 航司和联盟选择器应该分开

**当前状态**:
- `AirlinePicker` 组件将联盟和航司混在一起
- 后端 API 使用 `airline_include` 字段，支持联盟名称或航司代码
- 用户无法区分选择联盟还是具体航司

**代码位置**:
- `frontend/components/AirlinePicker.tsx` - 当前实现
- `frontend/constants/utils.ts:80-95` - AIRLINE_OPTIONS 数据

**后端支持**:
- `backend/main.py:273` - `airline_include` 字段支持联盟名称（如 "Star Alliance"）或航司代码（如 "UA"）

**修复方案**:
1. 创建两个独立的选择器：
   - `AlliancePicker` - 选择联盟（Star Alliance, SkyTeam, Oneworld）
   - `AirlinePicker` - 选择具体航司（UA, SQ, DL 等）
2. 更新 `AdvancedFilters` 组件，使用两个独立选择器
3. 更新 `CreateMonitorModal`，使用两个独立选择器
4. 后端 API 保持不变（`airline_include` 字段）

---

### 问题 4: 日期范围选择的开始和结束日期无法选择

**当前状态**:
- `DatePicker` 组件已实现，但可能在某些情况下不工作
- Range 模式显示两个日期选择器（START DATE 和 END DATE）

**可能的问题**:
1. 日期选择器点击无响应
2. 日历弹窗未正确显示
3. 日期选择后未更新

**代码位置**:
- `frontend/app/(tabs)/search.tsx:168-182` - 日期选择器使用
- `frontend/components/DatePicker.tsx` - 日期选择器实现

**修复方案**:
1. 改进 `DatePicker` 组件的可靠性
2. 添加调试日志，确认点击事件触发
3. 确保所有平台的日期选择器正常工作
4. 添加日期验证（结束日期必须晚于开始日期）

---

### 问题 5: 监控页面应显示所有监控任务（包括运行中、暂停的）

**当前状态**:
- `useMonitors` hook 获取所有监控任务
- `MonitorCard` 组件显示任务状态
- 可能的问题：任务状态显示不够清晰，或未按状态分组

**代码位置**:
- `frontend/app/(tabs)/monitors.tsx` - 监控列表页面
- `frontend/components/MonitorCard.tsx` - 监控任务卡片
- `frontend/hooks/useMonitors.ts` - 监控任务逻辑

**任务状态**:
- `active` - 正在运行
- `paused` - 已暂停
- `found` - 找到目标价格
- `expired` - 已过期

**修复方案**:
1. 在监控页面添加状态筛选（全部 / 运行中 / 暂停 / 已找到）
2. 按状态分组显示任务
3. 添加状态统计（运行中 X 个，暂停 Y 个）
4. 改进状态显示，使用更明显的视觉标识

---

## 二、修改方案

### 方案 1: 修复日期范围显示和计算

**文件**: `frontend/app/(tabs)/search.tsx`

**修改内容**:
1. 修改按钮文本：`"📊 Range 30 Days"` → `"📊 Date Range"`
2. 添加动态天数显示：在日期选择器下方显示 "Searching X days"
3. 更新费用计算：根据实际天数动态计算费用

**代码修改**:
```typescript
// 计算实际天数
const calculateDays = () => {
  if (searchMode === 'fixed') return 1;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  }
  return 30; // 默认值
};

// UI 显示
<Text>📊 Date Range ({calculateDays()} days)</Text>
```

---

### 方案 2: 改进日期选择器

**文件**: `frontend/components/DatePicker.tsx`

**修改内容**:
1. 改进 Web 平台实现：使用更可靠的日历弹窗
2. 添加视觉反馈：点击时显示加载状态
3. 确保 Native 平台正确显示 DateTimePicker
4. 添加日期验证和错误提示

**改进点**:
- Web: 使用 Modal + 自定义日历组件（或改进现有实现）
- Native: 确保 DateTimePicker 正确显示和关闭
- 添加 `onPress` 事件处理，确保点击响应

---

### 方案 3: 分离航司和联盟选择器

**新增文件**:
1. `frontend/components/AlliancePicker.tsx` - 联盟选择器
2. 修改 `frontend/components/AirlinePicker.tsx` - 仅显示航司

**修改文件**:
1. `frontend/components/AdvancedFilters.tsx` - 使用两个独立选择器
2. `frontend/components/CreateMonitorModal.tsx` - 使用两个独立选择器
3. `frontend/app/(tabs)/search.tsx` - 使用两个独立选择器

**数据结构**:
```typescript
// 联盟选项
const ALLIANCE_OPTIONS = [
  { value: '', label: 'Any Alliance' },
  { value: 'Star Alliance', label: '⭐ Star Alliance' },
  { value: 'SkyTeam', label: '🔷 SkyTeam' },
  { value: 'Oneworld', label: '🌐 Oneworld' },
];

// 航司选项（从 AIRLINE_OPTIONS 中过滤出 type === 'airline' 的）
const AIRLINE_OPTIONS_ONLY = AIRLINE_OPTIONS.filter(o => o.type === 'airline');
```

**API 参数**:
- 如果选择联盟：`airline_include: "Star Alliance"`
- 如果选择航司：`airline_include: "UA"`
- 如果两者都选：优先使用航司（或后端支持两个字段）

---

### 方案 4: 修复日期选择器功能

**文件**: `frontend/components/DatePicker.tsx`

**修改内容**:
1. 确保 Web 平台日期选择器正常工作
2. 确保 Native 平台日期选择器正确显示
3. 添加日期验证（结束日期 > 开始日期）
4. 改进错误处理和用户反馈

**测试点**:
- Web: 点击日期输入框应弹出 HTML5 日期选择器
- iOS: 点击应显示 spinner 选择器
- Android: 点击应显示原生日期选择器对话框

---

### 方案 5: 改进监控页面状态显示

**文件**: `frontend/app/(tabs)/monitors.tsx`

**修改内容**:
1. 添加状态筛选器（Tab 或按钮组）
2. 按状态分组显示任务
3. 添加状态统计信息
4. 改进状态视觉标识

**UI 设计**:
```
[全部] [运行中] [暂停] [已找到]
─────────────────────────────
运行中 (3)
  [Monitor Card 1]
  [Monitor Card 2]
  [Monitor Card 3]

暂停 (2)
  [Monitor Card 4]
  [Monitor Card 5]
```

**或使用 Tab 切换**:
```
Tab 1: 全部
Tab 2: 运行中 (3)
Tab 3: 暂停 (2)
Tab 4: 已找到 (1)
```

---

## 三、实施优先级

### P0（立即修复）
1. ✅ 问题 1: 日期范围显示修复
2. ✅ 问题 2: 日期选择器功能修复
3. ✅ 问题 4: 日期范围选择修复
4. ✅ 问题 5: 监控页面状态显示

### P1（重要改进）
1. ✅ 问题 3: 航司和联盟选择器分离

---

## 四、详细修改计划

### 修改 1: 日期范围显示和计算

**文件**: `frontend/app/(tabs)/search.tsx`

**步骤**:
1. 添加 `calculateDays` 函数
2. 修改按钮文本为动态显示
3. 更新费用显示逻辑
4. 添加日期范围验证

---

### 修改 2: 改进日期选择器

**文件**: `frontend/components/DatePicker.tsx`

**步骤**:
1. 改进 Web 平台实现
2. 确保 Native 平台正确显示
3. 添加视觉反馈
4. 添加日期验证

---

### 修改 3: 分离航司和联盟选择器

**步骤**:
1. 创建 `AlliancePicker.tsx` 组件
2. 修改 `AirlinePicker.tsx` 仅显示航司
3. 更新 `AdvancedFilters.tsx`
4. 更新 `CreateMonitorModal.tsx`
5. 更新搜索页面

**注意**: 后端 API 使用 `airline_include` 字段，需要决定：
- 选项 A: 两个字段 `alliance` 和 `airline_code`（需要后端修改）
- 选项 B: 保持 `airline_include`，优先使用航司代码（前端逻辑处理）

---

### 修改 4: 监控页面状态显示

**文件**: `frontend/app/(tabs)/monitors.tsx`

**步骤**:
1. 添加状态筛选状态管理
2. 添加状态筛选 UI（Tab 或按钮组）
3. 实现按状态过滤逻辑
4. 添加状态统计显示
5. 改进状态视觉标识

---

## 五、测试验证

### 测试 1: 日期范围功能
- [ ] Range 模式显示正确的天数
- [ ] 修改开始/结束日期，天数自动更新
- [ ] 费用根据实际天数计算

### 测试 2: 日期选择器
- [ ] Web 平台点击弹出日历
- [ ] iOS 平台显示 spinner
- [ ] Android 平台显示日期对话框
- [ ] 日期选择后正确更新

### 测试 3: 航司和联盟选择
- [ ] 联盟选择器独立显示
- [ ] 航司选择器独立显示
- [ ] 选择后正确传递到 API

### 测试 4: 监控页面状态
- [ ] 显示所有任务
- [ ] 状态筛选正常工作
- [ ] 状态统计正确
- [ ] 状态视觉标识清晰

---

## 六、风险评估

### 低风险
- 日期范围显示修复（仅 UI 文本）
- 监控页面状态显示（UI 改进）

### 中风险
- 日期选择器改进（需要测试多平台）
- 航司和联盟分离（需要确保后端兼容）

### 注意事项
1. 航司和联盟分离需要考虑后端 API 兼容性
2. 日期选择器改进需要测试所有平台
3. 监控页面状态显示需要考虑性能（大量任务时）

---

**分析完成时间**: 2026-02-11  
**下一步**: 等待用户确认后开始实施修改

