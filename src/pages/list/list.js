// 日程列表页逻辑

Page({
  data: {
    schedules: [],
    filteredList: [],
    filter: 'all'  // all | pending | completed
  },

  onShow() {
    this.loadSchedules();
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.loadSchedules();
    wx.stopPullDownRefresh();
  },

  /** 格式化日期为 YYYY-MM-DD */
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /** 从本地存储加载日程 */
  loadSchedules() {
    let schedules = wx.getStorageSync('schedules') || [];
    // 兼容旧数据：补全字段
    schedules = schedules.map(item => ({
      ...item,
      time: item.time || '',
      remind: item.remind || false,
      remindIndex: item.remindIndex || 0,
      completed: item.completed || false
    }));
    // 排序：未来最近 → 今天 → 已过期沉底
    const now = new Date();
    const todayStr = this.formatDate(now);
    const nowTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    schedules.sort((a, b) => {
      const aIsFuture = a.date > todayStr || (a.date === todayStr && a.time && a.time > nowTime);
      const bIsFuture = b.date > todayStr || (b.date === todayStr && b.time && b.time > nowTime);
      const aIsPast = a.date < todayStr || (a.date === todayStr && a.time && a.time <= nowTime);
      const bIsPast = b.date < todayStr || (b.date === todayStr && b.time && b.time <= nowTime);

      // 已完成的沉最底
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // 未过期的排前面，过期的沉底
      if (aIsFuture && bIsPast) return -1;
      if (aIsPast && bIsFuture) return 1;
      // 同区间内：日期近的排前面
      const aKey = a.date + (a.time ? ' ' + a.time : '');
      const bKey = b.date + (b.time ? ' ' + b.time : '');
      if (aKey === bKey) return b.id - a.id;
      return aKey < bKey ? -1 : 1;
    });
    wx.setStorageSync('schedules', schedules);
    this.setData({ schedules });
    this.applyFilter();
  },

  /** 应用筛选 */
  applyFilter() {
    const { schedules, filter } = this.data;
    let filteredList = schedules;
    if (filter === 'pending') {
      filteredList = schedules.filter(s => !s.completed);
    } else if (filter === 'completed') {
      filteredList = schedules.filter(s => s.completed);
    }
    this.setData({ filteredList });
  },

  /** 切换筛选 */
  onFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ filter });
    this.applyFilter();
  },

  /** 点击日程卡片 — 跳转详情页 */
  onItemTap(e) {
    const item = this.data.filteredList[e.currentTarget.dataset.index];
    wx.navigateTo({
      url: `/pages/detail/detail?id=${item.id}`
    });
  },

  /**
   * 切换完成状态
   * 同步更新本地存储 + 云数据库
   */
  async onToggleComplete(e) {
    const id = e.currentTarget.dataset.id;
    const schedules = this.data.schedules;
    const item = schedules.find(s => s.id === id);
    if (!item) return;

    item.completed = !item.completed;
    item.updatedAt = new Date().toISOString();
    wx.setStorageSync('schedules', schedules);
    this.loadSchedules();

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
        // 不阻塞用户操作，静默失败
      }
    }
  },

  /** 跳转到添加日程页 */
  onAdd() {
    wx.navigateTo({
      url: '/pages/index/index'
    });
  }
});
