// 排班首页：今日班次 + 倒计时 + 本月统计

const engine = require('../../../utils/shift-engine');

Page({
  data: {
    hasRule: false,
    today: '',
    todayShift: null,
    countdown: null,
    monthStats: null,
    upcoming: [],
    currentMonthLabel: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const rule = engine.getActiveRule();
    if (!rule) {
      this.setData({ hasRule: false });
      return;
    }

    const today = engine.fmt(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    const todayShift = engine.getShiftForDate(rule, today);
    const countdown = engine.getCountdown(rule, today);
    const upcoming = engine.getUpcomingShifts(rule, today, 7);
    const now = new Date();
    const monthStats = engine.getMonthStats(rule, now.getFullYear(), now.getMonth() + 1);

    // 统计排序
    const statsArr = Object.entries(monthStats.stats)
      .map(([name, count]) => {
        const def = rule.shifts[name] || {};
        return { name, count, color: def.color || '#999' };
      })
      .sort((a, b) => b.count - a.count);

    this.setData({
      hasRule: true,
      today,
      todayShift,
      countdown,
      upcoming,
      monthStats: { statsArr, total: monthStats.total },
      currentMonthLabel: `${now.getMonth() + 1}月`
    });
  },

  /** 跳转排班日历 */
  onGoCalendar() {
    wx.navigateTo({ url: '/pages/shift/calendar/calendar' });
  },

  /** 跳转设置 */
  onGoSettings() {
    wx.navigateTo({ url: '/pages/shift/settings/settings' });
  },

  /** 初始化排班引导 */
  onSetup() {
    wx.navigateTo({ url: '/pages/shift/settings/settings' });
  }
});
