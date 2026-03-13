---
name: 新监控任务UI修复计划 - 日期范围和航司选择器
overview: 修复 New Monitor Modal 中的3个关键问题：1) Range 模式支持日期范围选择（出发和返程都需要范围），2) 确保所有日期字段使用弹窗选择器，3) 修复航司选择器弹窗层级问题
todos:
  - id: fix-date-range-input
    content: "修复 Range 模式日期选择：添加 inputStartDateEnd 和 inputReturnDateEnd 状态，UI 显示开始/结束日期选择器"
    status: pending
  - id: fix-date-picker-modal
    content: "确保所有日期字段使用弹窗选择器（Web 端 HTML5 input，Native 端 DateTimePicker），移除手工输入"
    status: pending
  - id: fix-airline-picker-zindex
    content: "修复航司选择器弹窗层级问题：确保 airlinePickerVisible Modal 显示在 New Monitor Modal 之上"
    status: pending
  - id: update-create-monitor-api
    content: "更新 createMonitor API 调用，支持日期范围参数（start_date 和 end_date）"
    status: pending
---

# 新监控任务 UI 修复计划 - 日期范围和航司选择器

## 问题分析

### 问题 1: Range 模式日期范围选择缺失
**当前状态**：
- `inputStartDate` 和 `inputReturnDate` 都是单个日期字符串
- 当 `searchMode === 'range'` 时，仍然只能选择一个日期，无法选择日期范围
- 返程任务也需要支持日期范围

**需要修复**：
- 添加 `inputStartDateEnd` 状态（出发日期范围结束日期）
- 添加 `inputReturnDateEnd` 状态（返程日期范围结束日期）
- 在 UI 中，当 `searchMode === 'range'` 时，显示两个日期选择器：
  - 出发日期：开始日期 + 结束日期
  - 返程日期（如果是往返）：开始日期 + 结束日期
- 更新 `createMonitor` API 调用，传递日期范围参数

### 问题 2: 日期选择方式不统一
**当前状态**：
- 代码中已有 `openDatePicker` 函数和 `DateTimePicker` 组件
- Web 端使用 HTML5 `input type="date"`
- Native 端使用 `@react-native-community/datetimepicker`
- 但需要确认所有日期字段都正确使用了弹窗选择器

**需要修复**：
- 确保所有日期字段（`inputStartDate`, `inputStartDateEnd`, `inputReturnDate`, `inputReturnDateEnd`）都使用 `openDatePicker` 函数
- 移除任何手工输入的 TextInput 日期字段
- 确保 Web 端和 Native 端都能正常弹出日期选择器

### 问题 3: 航司选择器弹窗层级问题
**当前状态**：
- `airlinePickerVisible` Modal 已实现
- 但可能被 New Monitor Modal 遮挡，无法显示在最前层

**需要修复**：
- 检查 Modal 的 `zIndex` 或层级设置
- 确保 `airlinePickerVisible` Modal 的层级高于 `modalVisible`（New Monitor Modal）
- 或者将航司选择器 Modal 放在 New Monitor Modal 外部，确保它始终显示在最前层

## 实施步骤

### 步骤 1: 添加日期范围状态变量

**文件**: `frontend/App.tsx`

在状态声明部分（约第 400 行）添加：

```typescript
// 当前已有：
const [inputStartDate, setInputStartDate] = useState<string>('');
const [inputReturnDate, setInputReturnDate] = useState<string>('');

// 需要添加：
const [inputStartDateEnd, setInputStartDateEnd] = useState<string>(''); // Range 模式出发日期结束日期
const [inputReturnDateEnd, setInputReturnDateEnd] = useState<string>(''); // Range 模式返程日期结束日期
```

### 步骤 2: 更新日期选择器处理函数

**文件**: `frontend/App.tsx` (约第 463-488 行)

在 `handleDatePickerChange` 函数中添加新的 case：

```typescript
case 'inputStartEnd':
  setInputStartDateEnd(dateStr);
  break;
case 'inputReturnEnd':
  setInputReturnDateEnd(dateStr);
  break;
```

### 步骤 3: 更新 New Monitor Modal UI - 出发日期范围

**文件**: `frontend/App.tsx` (约第 2963-2972 行)

将单个日期选择器改为条件渲染：

```typescript
<Text style={styles.inputLabel}>
  {searchMode === 'fixed' 
    ? 'Departure Date (出发日期)' 
    : 'Departure Date Range (出发日期范围)'}
</Text>

{searchMode === 'fixed' ? (
  // Fixed Date: 单个日期选择器
  <TouchableOpacity
    style={styles.textInput}
    onPress={() => openDatePicker('inputStart', inputStartDate)}
    activeOpacity={0.7}
  >
    <Text style={{ color: inputStartDate ? '#ffffff' : '#555', fontSize: 16 }}>
      {inputStartDate || '2026-04-01'}
    </Text>
  </TouchableOpacity>
) : (
  // Range Mode: 两个日期选择器（开始 + 结束）
  <>
    <TouchableOpacity
      style={[styles.textInput, { marginBottom: 8 }]}
      onPress={() => openDatePicker('inputStart', inputStartDate)}
      activeOpacity={0.7}
    >
      <Text style={{ color: inputStartDate ? '#ffffff' : '#555', fontSize: 16 }}>
        Start: {inputStartDate || '2026-04-01'}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.textInput}
      onPress={() => openDatePicker('inputStartEnd', inputStartDateEnd)}
      activeOpacity={0.7}
    >
      <Text style={{ color: inputStartDateEnd ? '#ffffff' : '#555', fontSize: 16 }}>
        End: {inputStartDateEnd || '2026-04-30'}
      </Text>
    </TouchableOpacity>
  </>
)}
```

### 步骤 4: 更新 New Monitor Modal UI - 返程日期范围

**文件**: `frontend/App.tsx` (约第 2974-2988 行)

将返程日期也改为支持范围：

```typescript
{inputTripType === 'round_trip' && (
  <>
    <Text style={styles.inputLabel}>
      {searchMode === 'fixed' 
        ? 'Return Date (返程日期)' 
        : 'Return Date Range (返程日期范围)'}
    </Text>
    
    {searchMode === 'fixed' ? (
      // Fixed Date: 单个日期选择器
      <TouchableOpacity
        style={styles.textInput}
        onPress={() => openDatePicker('inputReturn', inputReturnDate)}
        activeOpacity={0.7}
      >
        <Text style={{ color: inputReturnDate ? '#ffffff' : '#555', fontSize: 16 }}>
          {inputReturnDate || '2026-04-08'}
        </Text>
      </TouchableOpacity>
    ) : (
      // Range Mode: 两个日期选择器（开始 + 结束）
      <>
        <TouchableOpacity
          style={[styles.textInput, { marginBottom: 8 }]}
          onPress={() => openDatePicker('inputReturn', inputReturnDate)}
          activeOpacity={0.7}
        >
          <Text style={{ color: inputReturnDate ? '#ffffff' : '#555', fontSize: 16 }}>
            Start: {inputReturnDate || '2026-04-08'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textInput}
          onPress={() => openDatePicker('inputReturnEnd', inputReturnDateEnd)}
          activeOpacity={0.7}
        >
          <Text style={{ color: inputReturnDateEnd ? '#ffffff' : '#555', fontSize: 16 }}>
            End: {inputReturnDateEnd || '2026-04-15'}
          </Text>
        </TouchableOpacity>
      </>
    )}
  </>
)}
```

### 步骤 5: 更新 createMonitor 函数 - 日期验证和 API 调用

**文件**: `frontend/App.tsx` (约第 1054-1150 行)

**重要**：后端 API 使用 `start_date` + `days` 参数，而不是 `end_date`。前端需要计算 `days` 值（结束日期 - 开始日期 + 1）。

更新日期验证逻辑：

```typescript
// 验证出发日期
let searchDays = 1; // 默认值
if (searchMode === 'fixed') {
  // Fixed Date: 单个日期，days = 1
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimDate)) {
    Alert.alert('Error', 'Date must be YYYY-MM-DD format');
    return;
  }
  searchDays = 1;
} else {
  // Range Mode: 日期范围，计算 days
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimDate)) {
    Alert.alert('Error', 'Start date must be YYYY-MM-DD format');
    return;
  }
  const trimDateEnd = inputStartDateEnd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimDateEnd)) {
    Alert.alert('Error', 'End date must be YYYY-MM-DD format');
    return;
  }
  if (trimDateEnd <= trimDate) {
    Alert.alert('Error', 'End date must be after start date');
    return;
  }
  // 计算天数：结束日期 - 开始日期 + 1
  const startDateObj = new Date(trimDate);
  const endDateObj = new Date(trimDateEnd);
  const diffTime = endDateObj.getTime() - startDateObj.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays < 1 || diffDays > 60) {
    Alert.alert('Error', 'Date range must be between 1 and 60 days');
    return;
  }
  searchDays = diffDays;
}

// 验证返程日期（如果是往返）
if (inputTripType === 'round_trip') {
  if (searchMode === 'fixed') {
    // Fixed Date: 单个日期
    const trimReturn = inputReturnDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimReturn)) {
      Alert.alert('Error', 'Return date must be YYYY-MM-DD format');
      return;
    }
    if (trimReturn <= trimDate) {
      Alert.alert('Error', 'Return date must be after departure date');
      return;
    }
  } else {
    // Range Mode: 日期范围验证
    const trimReturn = inputReturnDate.trim();
    const trimReturnEnd = inputReturnDateEnd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimReturn)) {
      Alert.alert('Error', 'Return start date must be YYYY-MM-DD format');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimReturnEnd)) {
      Alert.alert('Error', 'Return end date must be YYYY-MM-DD format');
      return;
    }
    if (trimReturnEnd <= trimReturn) {
      Alert.alert('Error', 'Return end date must be after return start date');
      return;
    }
    // 验证返程开始日期必须晚于出发结束日期
    const trimDateEnd = inputStartDateEnd.trim();
    if (trimReturn <= trimDateEnd) {
      Alert.alert('Error', 'Return start date must be after departure end date');
      return;
    }
  }
}
```

更新 API 请求体（使用 `days` 而不是 `end_date`）：

```typescript
const body: any = {
  origin: trimOrigin,
  destination: trimDest,
  start_date: trimDate,
  days: searchDays, // 计算出的天数（Fixed = 1, Range = 结束日期 - 开始日期 + 1）
  cabin_class: inputCabinClass,
  adults: inputAdults,
  children: inputChildren,
  target_price: inputTargetPrice.trim() ? parseFloat(inputTargetPrice.trim()) : null,
  notification_email: inputEmail.trim() || null,
  trip_type: inputTripType,
  // 往返航班：返程日期（后端只支持单个返程日期，不支持范围）
  // 注意：如果用户选择了返程日期范围，我们使用返程开始日期
  ...(inputTripType === 'round_trip' && {
    return_date: inputReturnDate.trim(), // 使用返程开始日期
  }),
  // 高级筛选
  ...(inputMaxStops !== null && { max_stops: inputMaxStops }),
  ...(departTimeRange[0] > 0 || departTimeRange[1] < 1440) && {
    departure_time_min: departTimeRange[0],
    departure_time_max: departTimeRange[1],
  },
  ...(arrivalTimeRange[0] > 0 || arrivalTimeRange[1] < 1440) && {
    arrival_time_min: arrivalTimeRange[0],
    arrival_time_max: arrivalTimeRange[1],
  },
  ...(inputAirlineInclude.trim() && { airline_include: inputAirlineInclude.trim() }),
  ...(inputSortStrategy !== 'best' && { sort_strategy: inputSortStrategy }),
};
```

**注意**：后端 API 的 `return_date` 字段只支持单个日期，不支持日期范围。如果用户选择了返程日期范围，我们使用返程开始日期作为 `return_date`。如果需要支持返程日期范围，需要更新后端 API。

### 步骤 6: 修复航司选择器弹窗层级

**文件**: `frontend/App.tsx` (约第 2365-2528 行)

确保航司选择器 Modal 显示在最前层。有两种方案：

**方案 A: 提高 zIndex（推荐）**

在 `airlinePickerOverlay` 样式中添加：

```typescript
airlinePickerOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.9)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
  zIndex: 9999, // 确保在最前层
  position: 'absolute', // 如果需要
},
```

**方案 B: 将航司选择器 Modal 移到 New Monitor Modal 外部**

确保 `airlinePickerVisible` Modal 的代码位置在 `modalVisible` Modal 之后，这样它会自然显示在上层。

### 步骤 7: 更新 Modal 重置逻辑

**文件**: `frontend/App.tsx` (约第 1350-1370 行)

在关闭 New Monitor Modal 时，重置所有新增的状态：

```typescript
const closeModal = () => {
  setModalVisible(false);
  setInputOrigin('');
  setInputDestination('');
  setInputStartDate('');
  setInputStartDateEnd(''); // 新增
  setInputReturnDate('');
  setInputReturnDateEnd(''); // 新增
  setInputCabinClass('economy');
  setInputAdults(1);
  setInputChildren(0);
  setInputTargetPrice('');
  setInputEmail('');
  setAdvancedVisible(false);
  setInputMaxStops(null);
  setDepartTimeRange([0, 1440]);
  setArrivalTimeRange([0, 1440]);
  setInputAirlineInclude('');
  setInputSortStrategy('best');
  setSearchMode('range');
  setInputTripType('one_way');
};
```

### 步骤 8: 后端 API 说明

**文件**: `backend/main.py`

**当前状态**：
- 后端 API 使用 `start_date` + `days` 参数来表示日期范围
- `return_date` 字段只支持单个日期，不支持日期范围
- 前端需要计算 `days` 值（结束日期 - 开始日期 + 1）

**未来扩展**（可选）：
如果需要支持返程日期范围，需要更新后端 API：
1. 在 `MonitorCreateRequest` 中添加 `return_end_date: Optional[str]` 字段
2. 在 `create_monitor` 函数中处理返程日期范围
3. 在 `MonitorTask` 模型中添加 `return_end_date` 字段

## 测试清单

- [ ] Range 模式出发日期：可以选择开始和结束日期
- [ ] Range 模式返程日期：往返任务可以选择返程开始和结束日期
- [ ] Fixed Date 模式：仍然只显示单个日期选择器
- [ ] 日期选择器弹窗：Web 端和 Native 端都能正常弹出
- [ ] 日期验证：确保结束日期晚于开始日期
- [ ] 航司选择器：点击后能正常显示在最前层，不被 New Monitor Modal 遮挡
- [ ] 航司选择确认：选择航司后能正确返回并显示在输入框中
- [ ] API 调用：创建监控任务时正确传递日期范围参数

## 注意事项

1. **向后兼容**：确保 Fixed Date 模式仍然正常工作
2. **默认值**：为新增的日期范围字段设置合理的默认值
3. **用户体验**：日期范围选择器应该有清晰的标签（Start / End）
4. **错误提示**：日期验证失败时给出清晰的错误信息

