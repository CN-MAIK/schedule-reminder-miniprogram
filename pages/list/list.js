// 日程列表页逻辑

Page({
  data: {
    schedules: []  // 日程列表
  },

  onShow() {
    // 每次页面显示时重新加载数据（从添加页返回时会触发）
    this.loadSchedules();
  },

  /** 从本地存储加载日程 */
  loadSchedules() {
    const schedules = wx.getStorageSync('schedules') || [];
    // 按日期排序，最近的排前面
    schedules.sort((a, b) => {
      if (a.date === b.date) {
        return b.id - a.id;  // 同一天按创建时间倒序
      }
      return a.date > b.date ? -1 : 1;
    });
    this.setData({ schedules });
  },

  /** 点击日程卡片 — 查看详情 */
  onItemTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.schedules[index];
    wx.showModal({
      title: item.title,
      content: `日期：${item.date}\n\n${item.detail || '无详情'}`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /** 删除日程 */
  onDelete(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.schedules[index];

    wx.showModal({
      title: '确认删除',
      content: `删除日程「${item.title}」？`,
      confirmText: '删除',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) {
          const schedules = this.data.schedules;
          schedules.splice(index, 1);
          wx.setStorageSync('schedules', schedules);
          this.setData({ schedules });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  /** 跳转到添加日程页 */
  onAdd() {
    wx.navigateTo({
      url: '/pages/index/index'
    });
  }
});
