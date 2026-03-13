# Phase 2A Contract Alignment

## 目的

本文件用于固化 `Phase 2A` 当前已经达成的前后端契约对齐结论，避免后续继续重构时出现字段漂移、语义混淆或编辑边界失控。

适用范围：

- 前端 `frontend/types/index.ts`
- 前端搜索链路 `search.tsx` / `useSearch.ts`
- 前端监控链路 `CreateMonitorModal.tsx` / `EditMonitorModal.tsx` / `useMonitors.ts`
- 后端 `backend/main.py` 中的：
  - `SearchRequest`
  - `MonitorCreateRequest`
  - `MonitorUpdateRequest`

## 当前结论

- `SearchRequestPayload` 已与后端 `SearchRequest` 对齐。
- `MonitorCreatePayload` 已与后端 `MonitorCreateRequest` 对齐。
- `MonitorUpdatePayload` 已与后端 `MonitorUpdateRequest` 对齐。
- 编辑监控当前采用“受控冻结”策略，而不是“可编辑字段越多越好”策略。

## 核心语义

必须统一使用以下定义：

- `days`：航班搜索窗口天数
- `duration_days`：监控持续时长

不要混用这两个字段，也不要把 `duration_days` 当成航班日期范围。

## 搜索请求对齐

前端模型：`SearchRequestPayload`

后端模型：`SearchRequest`

已对齐字段：

- `origin`
- `destination`
- `start_date`
- `days`
- `cabin_class`
- `adults`
- `children`
- `max_stops`
- `departure_time_min`
- `departure_time_max`
- `sort_strategy`
- `trip_type`
- `return_date`
- `arrival_time_min`
- `arrival_time_max`
- `airline_include`

前端内部状态，但不属于后端请求字段：

- `searchMode`
- `endDate`
- `allianceInclude`

说明：

- `searchMode` 仅用于界面控制固定日期/范围搜索。
- `endDate` 仅用于前端计算 `days`。
- `allianceInclude` 最终必须映射到 `airline_include`，后端不单独接收 `allianceInclude`。

## 创建监控请求对齐

前端模型：`MonitorCreatePayload`

后端模型：`MonitorCreateRequest`

已对齐字段：

- `origin`
- `destination`
- `start_date`
- `days`
- `cabin_class`
- `adults`
- `children`
- `target_price`
- `notification_email`
- `max_stops`
- `departure_time_min`
- `departure_time_max`
- `sort_strategy`
- `trip_type`
- `return_date`
- `arrival_time_min`
- `arrival_time_max`
- `airline_include`
- `interval_minutes`
- `duration_days`

## 搜索到创建监控的贯通规则

从搜索页或热力图进入创建监控时，必须尽量保留原始搜索上下文。

当前应传递：

- `origin`
- `destination`
- `start_date`
- `days`
- `cabin_class`
- `adults`
- `children`
- `trip_type`
- `return_date`
- `max_stops`
- `departure_time_min`
- `departure_time_max`
- `arrival_time_min`
- `arrival_time_max`
- `airline_include`
- `sort_strategy`

约束：

- 不允许再把 `days` 硬编码为 `30`
- 点击热力图创建监控时，必须优先沿用真实搜索窗口

## 编辑监控请求对齐

前端模型：`MonitorUpdatePayload`

后端模型：`MonitorUpdateRequest`

当前允许编辑并已对齐的字段：

- `target_price`
- `notification_email`
- `start_date`
- `return_date`
- `interval_minutes`

## 编辑边界

当前阶段以下字段冻结，不进入编辑表单：

- `origin`
- `destination`
- `days`
- `trip_type`
- `cabin_class`
- `adults`
- `children`
- `max_stops`
- `departure_time_min`
- `departure_time_max`
- `arrival_time_min`
- `arrival_time_max`
- `airline_include`
- `sort_strategy`
- `duration_days`

这是当前阶段的设计边界，不视为缺失。

原因：

- 避免同一阶段同时扩大前端表单和后端校验范围
- 降低监控调度、状态重置和计费逻辑的联动风险
- 优先稳定当前主流程，再决定是否进入高级编辑阶段

## 当前阶段已完成事项

- 搜索请求类型化
- 创建监控请求类型化
- 编辑监控请求类型化
- 搜索到创建监控的关键参数贯通
- `days` 不再在创建监控时退回默认值
- 编辑监控边界已在 UI 中明确提示

## 下一阶段建议

如果进入 `Phase 2A.2`，可再评估是否开放以下字段编辑：

- `max_stops`
- `sort_strategy`
- `departure_time_min`
- `departure_time_max`
- `arrival_time_min`
- `arrival_time_max`
- `airline_include`
- `duration_days`

在未进入 `Phase 2A.2` 前，请继续以本文件为准，不要擅自扩展编辑能力。
