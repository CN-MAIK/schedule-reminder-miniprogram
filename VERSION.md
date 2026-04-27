# 版本快照记录

## v0.1 — 2026-04-26 23:01

**状态：✅ 测试通过**

### 包含页面
- `pages/index/index` — 添加日程页（标题、日期、详情、保存）
- `pages/list/list` — 日程列表页（查看、删除、跳转添加）

### 功能
- 添加日程：标题+日期必填，详情可选，保存到 localStorage
- 日程列表：按日期倒序，点击查看详情，左下删除（二次确认）
- 两页闭环：列表点"+"→添加→保存→返回列表自动刷新

### app.json 配置
```json
{
  "pages": [
    "pages/list/list",
    "pages/index/index"
  ]
}
```

### 回滚方法
把 `versions/v0.1/pages/` 下的文件覆盖回 `pages/` 即可：

```
versions/v0.1/pages/index/  →  pages/index/
versions/v0.1/pages/list/   →  pages/list/
```
