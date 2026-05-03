// 排班月历页：月历展示 + 点击调整换班

const engine = require('../../../utils/shift-engine');

Page({
  data: {
    hasRule: false,
    ruleName: '',
    currentYear: 2026,
    currentMonth: 1,
    calendarTitle: '',
    calendarDays: [],
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    selectedDate: '',
    selectedShift: null,
    isAdjusting: false,
    shiftsOptions: [],
    canGoPrev: true,
    canGoNext: true
  },

  onShow() { this.refresh(); },

  refresh() {
    const rule = engine.getActiveRule();
    if (!rule) {
      this.setData({ hasRule: false });
      return;
    }

    const now = new Date();
    const perMonth = wx.getStorageSync('shiftCalMonth') || {};
    const key = '' + rule.id;
    const year = perMonth[key] ? perMonth[key].year : now.getFullYear();
    const month = perMonth[key] ? perMonth[key].month : now.getMonth() + 1;

    const shiftsOptions = Object.values(rule.shifts).map(s => s.name);

    this.setData({
      hasRule: true,
      ruleName: rule.name,
      currentYear: year,
      currentMonth: month,
      shiftsOptions
    });
    this.generateCalendar();
  },

  generateCalendar(explicitRule) {
    const rule = explicitRule || engine.getActiveRule();
    if (!rule) return;

    const { currentYear, currentMonth } = this.data;
    const today = engine.fmt(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    const sel = this.data.selectedDate || today;

    // 翻月边界检查
    let canGoPrev = true;
    if (rule.startDate) {
      let py = currentYear, pm = currentMonth - 1;
      if (pm < 1) { pm = 12; py--; }
      const prevLast = new Date(py, pm, 0).getDate();
      const prevEnd = engine.fmt(py, pm, prevLast);
      canGoPrev = prevEnd >= rule.startDate;
    }
    let canGoNext = true;
    if (rule.endDate) {
      let ny = currentYear, nm = currentMonth + 1;
      if (nm > 12) { nm = 1; ny++; }
      const nextStart = engine.fmt(ny, nm, 1);
      canGoNext = nextStart <= rule.endDate;
    }

    const calendarTitle = `${currentYear}年${currentMonth}月`;
    const days = engine.buildCalendarData(rule, currentYear, currentMonth, sel);
    const selectedShift = engine.getShiftForDate(rule, sel);

    this.setData({ calendarTitle, calendarDays: days, selectedDate: sel, selectedShift, canGoPrev, canGoNext });
  },

  onPrevMonth() {
    if (!this.data.canGoPrev) { wx.showToast({ title: '已到起始月', icon: 'none' }); return; }
    let { currentYear, currentMonth } = this.data;
    if (--currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.setData({ currentYear, currentMonth });
    this.saveCalState();
    this.generateCalendar();
  },

  onNextMonth() {
    if (!this.data.canGoNext) { wx.showToast({ title: '已到截止月', icon: 'none' }); return; }
    let { currentYear, currentMonth } = this.data;
    if (++currentMonth > 12) { currentMonth = 1; currentYear++; }
    this.setData({ currentYear, currentMonth });
    this.saveCalState();
    this.generateCalendar();
  },

  saveCalState() {
    const rule = engine.getActiveRule();
    if (!rule) return;
    const perMonth = wx.getStorageSync('shiftCalMonth') || {};
    perMonth['' + rule.id] = { year: this.data.currentYear, month: this.data.currentMonth };
    wx.setStorageSync('shiftCalMonth', perMonth);
  },

  onDayTap(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    const rule = engine.getActiveRule();
    const shift = engine.getShiftForDate(rule, date);
    this.setData({ selectedDate: date, selectedShift: shift, isAdjusting: false });
    this.generateCalendar();
  },

  /** 换班：为选中日期覆盖班次 */
  onAdjust() {
    if (!this.data.selectedDate) return;
    this.setData({ isAdjusting: true });
  },

  onSelectAdjust(e) {
    const shiftName = e.currentTarget.dataset.name;
    const rule = engine.getActiveRule();
    if (!rule) return;

    const date = this.data.selectedDate;
    if (!rule.adjustments) rule.adjustments = {};
    rule.adjustments[date] = shiftName;

    const rules = engine.loadRules();
    const idx = rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = rule;
      engine.saveRules(rules);
    }

    this.setData({ isAdjusting: false });
    this.generateCalendar(rule);
  },

  onCancelAdjust() {
    this.setData({ isAdjusting: false });
  },

  /** 清除换班覆盖，恢复自动推算 */
  onClearAdjust() {
    const rule = engine.getActiveRule();
    if (!rule || !rule.adjustments) return;

    const date = this.data.selectedDate;
    delete rule.adjustments[date];
    if (Object.keys(rule.adjustments).length === 0) delete rule.adjustments;

    const rules = engine.loadRules();
    const idx = rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = rule;
      engine.saveRules(rules);
    }

    this.generateCalendar(rule);
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/shift/home/home' });
  }
});
