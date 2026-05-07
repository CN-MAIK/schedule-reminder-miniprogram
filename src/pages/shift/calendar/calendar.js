// 排班月历页：月历展示 + 点击调整换班 + 备注 + 日程联动

var engine = require('../../../utils/shift-engine');
var scheduleUtils = require('../../../utils/schedule-utils');

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
    canGoNext: true,

    // 日程联动
    dateSchedules: [],
    hasDateSchedules: false,

    // 换班备注
    adjustNote: '',
    noteMaxLen: 20
  },

  onShow() { this.refresh(); },

  refresh() {
    var rule = engine.getActiveRule();
    if (!rule) {
      this.setData({ hasRule: false });
      return;
    }

    var now = new Date();
    var perMonth = wx.getStorageSync('shiftCalMonth') || {};
    var key = '' + rule.id;
    var year = perMonth[key] ? perMonth[key].year : now.getFullYear();
    var month = perMonth[key] ? perMonth[key].month : now.getMonth() + 1;

    var shiftsOptions = Object.values(rule.shifts).map(function(s) { return s.name; });

    this.setData({
      hasRule: true,
      ruleName: rule.name,
      currentYear: year,
      currentMonth: month,
      shiftsOptions: shiftsOptions
    });
    this.generateCalendar();

    // 加载日程并匹配当前选中日期
    this.loadSchedulesForDate(this.data.selectedDate);
  },

  generateCalendar(explicitRule) {
    var rule = explicitRule || engine.getActiveRule();
    if (!rule) return;

    var currentYear = this.data.currentYear;
    var currentMonth = this.data.currentMonth;
    var today = engine.fmt(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    var sel = this.data.selectedDate || today;

    // 翻月边界检查
    var canGoPrev = true;
    if (rule.startDate) {
      var py = currentYear, pm = currentMonth - 1;
      if (pm < 1) { pm = 12; py--; }
      var prevLast = new Date(py, pm, 0).getDate();
      var prevEnd = engine.fmt(py, pm, prevLast);
      canGoPrev = prevEnd >= rule.startDate;
    }
    var canGoNext = true;
    if (rule.endDate) {
      var ny = currentYear, nm = currentMonth + 1;
      if (nm > 12) { nm = 1; ny++; }
      var nextStart = engine.fmt(ny, nm, 1);
      canGoNext = nextStart <= rule.endDate;
    }

    var calendarTitle = currentYear + '年' + currentMonth + '月';
    var days = engine.buildCalendarData(rule, currentYear, currentMonth, sel);
    var selectedShift = engine.getShiftForDate(rule, sel);

    // 查询已有备注
    var existingNote = '';
    if (rule.adjustments && rule.adjustments[sel] != null) {
      var adj = rule.adjustments[sel];
      if (typeof adj === 'object' && adj.note) existingNote = adj.note;
    }

    this.setData({
      calendarTitle: calendarTitle,
      calendarDays: days,
      selectedDate: sel,
      selectedShift: selectedShift,
      canGoPrev: canGoPrev,
      canGoNext: canGoNext,
      adjustNote: existingNote
    });
  },

  onPrevMonth() {
    if (!this.data.canGoPrev) { wx.showToast({ title: '已到起始月', icon: 'none' }); return; }
    var currentYear = this.data.currentYear;
    var currentMonth = this.data.currentMonth;
    if (--currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.setData({ currentYear: currentYear, currentMonth: currentMonth });
    this.saveCalState();
    this.generateCalendar();
    this.loadSchedulesForDate(this.data.selectedDate);
  },

  onNextMonth() {
    if (!this.data.canGoNext) { wx.showToast({ title: '已到截止月', icon: 'none' }); return; }
    var currentYear = this.data.currentYear;
    var currentMonth = this.data.currentMonth;
    if (++currentMonth > 12) { currentMonth = 1; currentYear++; }
    this.setData({ currentYear: currentYear, currentMonth: currentMonth });
    this.saveCalState();
    this.generateCalendar();
    this.loadSchedulesForDate(this.data.selectedDate);
  },

  saveCalState() {
    var rule = engine.getActiveRule();
    if (!rule) return;
    var perMonth = wx.getStorageSync('shiftCalMonth') || {};
    perMonth['' + rule.id] = { year: this.data.currentYear, month: this.data.currentMonth };
    wx.setStorageSync('shiftCalMonth', perMonth);
  },

  onDayTap(e) {
    var date = e.currentTarget.dataset.date;
    if (!date) return;
    var rule = engine.getActiveRule();
    var shift = engine.getShiftForDate(rule, date);

    var existingNote = '';
    if (rule.adjustments && rule.adjustments[date] != null) {
      var adj = rule.adjustments[date];
      if (typeof adj === 'object' && adj.note) existingNote = adj.note;
    }

    this.setData({
      selectedDate: date,
      selectedShift: shift,
      isAdjusting: false,
      adjustNote: existingNote
    });
    this.generateCalendar();
    this.loadSchedulesForDate(date);
  },

  /** ========== 日程联动：查询选中日期的日程 ========== */
  loadSchedulesForDate(date) {
    if (!date) return;
    var schedules = wx.getStorageSync('schedules') || [];
    // 补充默认字段
    schedules = schedules.map(function(s) {
      return {
        ...s,
        repeatType: s.repeatType || 'none',
        repeatStart: s.repeatStart || s.date,
        repeatEnd: s.repeatEnd || '',
        completedDates: s.completedDates || [],
        excludeDates: s.excludeDates || []
      };
    });
    var dateSchedules = scheduleUtils.expandRepeatingSchedules(schedules, date);
    this.setData({
      dateSchedules: dateSchedules,
      hasDateSchedules: dateSchedules.length > 0
    });
  },

  /** ========== 换班：弹出选择 + 备注输入 ========== */
  onAdjust() {
    if (!this.data.selectedDate) return;
    this.setData({ isAdjusting: true });
  },

  onSelectAdjust(e) {
    var shiftName = e.currentTarget.dataset.name;
    var rule = engine.getActiveRule();
    if (!rule) return;

    var date = this.data.selectedDate;
    var note = (this.data.adjustNote || '').trim().substring(0, 20);

    if (!rule.adjustments) rule.adjustments = {};
    rule.adjustments[date] = { shift: shiftName };
    if (note) rule.adjustments[date].note = note;

    var rules = engine.loadRules();
    var idx = rules.findIndex(function(r) { return r.id === rule.id; });
    if (idx >= 0) {
      rules[idx] = rule;
      engine.saveRules(rules);
    }

    this.setData({ isAdjusting: false, adjustNote: note });
    this.generateCalendar(rule);
  },

  onCancelAdjust() {
    this.setData({ isAdjusting: false });
  },

  /** 换班备注输入 */
  onNoteInput(e) {
    var val = e.detail.value || '';
    if (val.length > this.data.noteMaxLen) val = val.substring(0, this.data.noteMaxLen);
    this.setData({ adjustNote: val });
  },

  /** 清除换班覆盖，恢复自动推算 */
  onClearAdjust() {
    var rule = engine.getActiveRule();
    if (!rule || !rule.adjustments) return;

    var date = this.data.selectedDate;
    delete rule.adjustments[date];
    if (Object.keys(rule.adjustments).length === 0) delete rule.adjustments;

    var rules = engine.loadRules();
    var idx = rules.findIndex(function(r) { return r.id === rule.id; });
    if (idx >= 0) {
      rules[idx] = rule;
      engine.saveRules(rules);
    }

    this.setData({ adjustNote: '' });
    this.generateCalendar(rule);
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/shift/home/home' });
  }
});
