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

  /**
   * 切换完成状态
   * 同步更新本地存储 + 云数据库
   */
  async onToggleComplete() {
    const schedules = wx.getStorageSync('schedules') || [];
    const item = schedules.find(s => s.id === this.data.schedule.id);
    if (!item) return;

    item.completed = !item.completed;
    item.updatedAt = new Date().toISOString();
    wx.setStorageSync('schedules', schedules);
    this.setData({ schedule: item });

    // 同步到云数据库
    if (item._cloudId) {
      try {
        const db = wx.cloud.database();
        await db.collection('schedules').doc(item._cloudId).update({
          data: {
            completed: item.completed,
            updatedAt: item.updatedAt
          }
        });
        console.log(`[完成状态] 云端同步成功: ${item.title} → ${item.completed ? '已完成' : '待办'}`);
      } catch (err) {
        console.warn(`[完成状态] 云端同步失败:`, err);
      }
    }
  },

  /** 编辑 */
  onEdit() {
    wx.navigateTo({
      url: `/pages/index/index?id=${this.data.schedule.id}`
    });
  },

  /**
   * 删除日程
   * 同时删除本地存储 + 云数据库记录
   */
  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: `删除日程「${this.data.schedule.title}」？`,
      confirmText: '删除',
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (res.confirm) {
          const item = this.data.schedule;

          // 删除云数据库记录
          if (item._cloudId) {
            try {
              const db = wx.cloud.database();
              await db.collection('schedules').doc(item._cloudId).remove();
              console.log(`[删除] 云端记录已删除: ${item.title}`);
            } catch (err) {
              console.warn(`[删除] 云端记录删除失败:`, err);
              // 本地仍可删除，不阻塞
            }
          }

          // 删除本地存储
          let schedules = wx.getStorageSync('schedules') || [];
          schedules = schedules.filter(s => s.id !== item.id);
          wx.setStorageSync('schedules', schedules);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        }
      }
    });
  }
});
