# 版本记录

## v0.2 — 2026-04-27

P0 补全版本，四个核心功能全部落地：

- **P0-1 时间选择**：添加 `mode="time"` picker，选时间后自动弹出提醒开关
- **P0-2 提醒推送（前端）**：保存日程时调用 `wx.requestSubscribeMessage()` 请求授权；计算 `remindAt` 提醒时间
- **P0-3 编辑日程**：详情页点"编辑"进入编辑模式（复用添加页，传 id 参数）
- **P0-4 已完成标记**：列表页勾选圈 + 详情页切换 + 筛选栏（全部/待办/已完成）

新增文件：
- `app.js` / `app.json` / `app.wxss` — 小程序入口（含旧数据迁移逻辑）
- `pages/detail/detail.*` — 日程详情页
- `project.config.json` / `sitemap.json` — 项目配置

## v0.1 — 2026-04-27

初始版本：
- 添加日程（标题+日期+详情）
- 日程列表（卡片布局、排序、删除）
- 本地存储 `wx.setStorageSync`