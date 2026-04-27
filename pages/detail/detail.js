// 日程详情页逻辑

Page({
  data: {
    schedule: {},
    remindOptions: ['准时', '5分钟前', '10分钟前', '15分钟前', '30分钟前', '1小时前']
  },

  onLoad(options) {
    if (options.id) {
      this.loadSchedule(Number(options.id));
    }
  },

  onShow() {
    // 从编辑页返回时刷新数据
    if (this.data.schedule.id) {
      this.loadSchedule(this.data.schedule.id);
    }
  },

  /** 加载日程数据 */
  loadSchedule(id) {
    const schedules = wx.getStorageSync('schedules') || [];
    const item = schedules.find(s => s.id === id);
    if (item) {
      this.setData({ schedule: item });
      wx.setNavigationBarTitle({ title: item.title });
    }
  },

  /** 切换完成状态 */
  onToggleComplete() {
    const schedules = wx.getStorageSync('schedules') || [];
    const item = schedules.find(s => s.id === this.data.schedule.id);
    if (item) {
      item.completed = !item.completed;
      item.updatedAt = new Date().toISOString();
      wx.setStorageSync('schedules', schedules);
      this.setData({ schedule: item });
    }
  },

  /** 编辑 */
  onEdit() {
    wx.navigateTo({
      url: `/pages/index/index?id=${this.data.schedule.id}`
    });
  },

  /** 删除 */
  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: `删除日程「${this.data.schedule.title}」？`,
      confirmText: '删除',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) {
          let schedules = wx.getStorageSync('schedules') || [];
          schedules = schedules.filter(s => s.id !== this.data.schedule.id);
          wx.setStorageSync('schedules', schedules);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        }
      }
    });
  }
});