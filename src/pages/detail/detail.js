// 日程详情页逻辑（含重复日程信息）

Page({
  data: {
    schedule: {},
    remindOptions: ['准时', '5分钟前', '10分钟前', '15分钟前', '30分钟前', '1小时前'],
    repeatInfo: '',
    instanceDate: ''  // 重复日程的具体实例日期
  },

  onLoad(options) {
    this.instanceDate = options.instance || '';
    if (options.id) this.loadSchedule(Number(options.id));
  },

  onShow() {
    if (this.data.schedule.id) this.loadSchedule(this.data.schedule.id);
  },

  loadSchedule(id) {
    const schedules = wx.getStorageSync('schedules') || [];
    const item = schedules.find(s => s.id === id);
    if (!item) return;

    // 重复信息
    let repeatInfo = '';
    if (item.repeatType && item.repeatType !== 'none') {
      const labels = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };
      repeatInfo = labels[item.repeatType] || '重复';
      if (item.repeatType === 'weekly' && item.repeatDays && item.repeatDays.length) {
        const wd = ['日','一','二','三','四','五','六'];
        repeatInfo = '每周' + item.repeatDays.map(d => wd[d]).join('、');
      }
      if (item.repeatEnd) repeatInfo += ' · 至 ' + item.repeatEnd;
      else if (item.repeatEndType === 'count' && item.repeatCount) repeatInfo += ' · ' + item.repeatCount + '次';
    }

    // 实例日期下是否已完成
    const ic = this.instanceDate && item.repeatType && item.repeatType !== 'none'
      ? (item.completedDates || []).includes(this.instanceDate)
      : item.completed;

    this.setData({
      schedule: { ...item, _instanceCompleted: ic },
      repeatInfo,
      instanceDate: this.instanceDate
    });
    wx.setNavigationBarTitle({ title: item.title });
  },

  // 单次/整体完成切换
  async onToggleComplete() {
    const item = this.data.schedule;
    const schedules = wx.getStorageSync('schedules') || [];
    const src = schedules.find(s => s.id === item.id);
    if (!src) return;

    if (src.repeatType && src.repeatType !== 'none' && this.instanceDate) {
      // 重复日程：单次完成
      if (!src.completedDates) src.completedDates = [];
      const idx = src.completedDates.indexOf(this.instanceDate);
      if (idx >= 0) src.completedDates.splice(idx, 1);
      else src.completedDates.push(this.instanceDate);
      src.completed = false;
    } else {
      src.completed = !src.completed;
    }
    src.updatedAt = new Date().toISOString();
    wx.setStorageSync('schedules', schedules);

    // 刷新展示
    const ic = (src.repeatType && src.repeatType !== 'none' && this.instanceDate)
      ? src.completedDates.includes(this.instanceDate)
      : src.completed;
    this.setData({ schedule: { ...src, _instanceCompleted: ic } });

    // 云端同步
    if (src._cloudId) {
      try {
        const db = wx.cloud.database();
        await db.collection('schedules').doc(src._cloudId).update({
          data: { completed: src.completed, completedDates: src.completedDates, updatedAt: src.updatedAt }
        });
      } catch (err) { console.warn('云端同步失败:', err); }
    }
  },

  onEdit() {
    const url = `/pages/index/index?id=${this.data.schedule.id}`;
    wx.navigateTo({ url });
  },

  onDelete() {
    const title = this.data.schedule.title;
    wx.showModal({
      title: '确认删除',
      content: `删除日程「${title}」？`,
      confirmText: '删除',
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return;
        const item = this.data.schedule;

        // 删除云端
        if (item._cloudId) {
          try { const db = wx.cloud.database(); await db.collection('schedules').doc(item._cloudId).remove(); } catch(e) {}
        }

        // 删除本地
        let list = wx.getStorageSync('schedules') || [];
        list = list.filter(s => s.id !== item.id);
        wx.setStorageSync('schedules', list);
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      }
    });
  }
});
