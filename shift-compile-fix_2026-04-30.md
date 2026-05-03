# 排班模块 — 编译错误修复

**时间：** 2026-04-30 18:47 GMT+8  
**修复内容：** 2 个编译错误

---

## 错误 1：settings.wxml WXS `for...in` 不兼容

**根因：** 微信 WXS 脚本不支持 `for (k in obj)` 语法，编译器报 `Unexpected token 'nv_in'`

**修复方案：** 彻底移除 WXS 块，在 JS 层预计算数组传入模板
- `settings.js` 新增 `processPresets()` → 把每个预设的 `shifts` 对象转为 `shiftsArr` 数组
- `settings.js` 新增 `extractShiftKeys()` → 把 `editing.shifts` 的 key 提取为 `shiftKeys` 数组
- `settings.wxml` 改为 `wx:for="{{item.shiftsArr}}"` 和 `wx:for="{{shiftKeys}}"`
- 删除了整个 `<wxs module="utils">` 块

## 错误 2：`wx.switchTab` 指向非 tabBar 页面

**根因：** `home.js` 的 `onGoCalendar()` 用了 `wx.switchTab`，但日历页不在 tabBar 里

**修复：** 改为 `wx.navigateTo({ url: '/pages/shift/calendar/calendar' })`

## 衍生错误：`__route__ is not defined`

源代码中不存在该引用，是 WXML 编译失败导致页面无法加载、框架抛出的衍生错误。修复 1 后自行消失。
