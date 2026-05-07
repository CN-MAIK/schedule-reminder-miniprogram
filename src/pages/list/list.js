// 日程列表页逻辑（万年历 + 重复日程虚拟展开 + 单次完成 + 排班联动）

var scheduleUtils = require('../../utils/schedule-utils');
var engine = require('../../utils/shift-engine');

Page({
  data: {
    schedules: [],
    filteredList: [],
    filter: 'all',

    // 日历
    showCalendar: true,
    currentYear: 2026,
    currentMonth: 1,
    calendarTitle: '',
    calendarDays: [],
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    selectedDate: '',
    selectedDateInfo: '',
    scheduleDates: {},

    // 排班联动
    selectedShift: null,
    hasShiftRule: false
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
  },

  onShow() { this.loadSchedules(); },
  onPullDownRefresh() { this.loadSchedules(); wx.stopPullDownRefresh(); },

  // 复用 schedule-utils 的方法，挂到 this 上方便 template 里 wx:if 用
  fmt: scheduleUtils.fmt,

  /** ========== 重复日程：下一次日期 ========== */
  getRepeatNextDate(baseDate, type, currentDate) {
    const d = new Date(baseDate + 'T00:00:00');
    const cur = new Date(currentDate + 'T00:00:00');
    if (d >= cur) return null;
    switch (type) {
      case 'daily': {
        const diff = Math.floor((cur - d) / 86400000);
        d.setDate(d.getDate() + diff);
        if (d.getTime() <= cur.getTime()) d.setDate(d.getDate() + 1);
        return scheduleUtils.fmt(d.getFullYear(), d.getMonth()+1, d.getDate());
      }
      case 'weekly': {
        while (d <= cur) d.setDate(d.getDate() + 7);
        return scheduleUtils.fmt(d.getFullYear(), d.getMonth()+1, d.getDate());
      }
      case 'monthly': {
        while (d <= cur) d.setMonth(d.getMonth() + 1);
        return scheduleUtils.fmt(d.getFullYear(), d.getMonth()+1, d.getDate());
      }
      case 'yearly': {
        while (d <= cur) d.setFullYear(d.getFullYear() + 1);
        return scheduleUtils.fmt(d.getFullYear(), d.getMonth()+1, d.getDate());
      }
      default: return null;
    }
  },

  loadSchedules() {
    let schedules = wx.getStorageSync('schedules') || [];
    schedules = schedules.map(s => ({
      ...s,
      time: s.time || '',
      remind: s.remind || false,
      remindIndex: s.remindIndex || 0,
      completed: s.completed || false,
      completedDates: s.completedDates || [],
      repeatType: s.repeatType || 'none',
      repeatStart: s.repeatStart || s.date,
      repeatEnd: s.repeatEnd || '',
      repeatEndType: s.repeatEndType || 'date',
      repeatCount: s.repeatCount || 0,
      repeatDays: s.repeatDays || [],
      excludeDates: s.excludeDates || []
    }));

    schedules.sort((a, b) => {
      const aR = (a.repeatType && a.repeatType !== 'none') ? 1 : 0;
      const bR = (b.repeatType && b.repeatType !== 'none') ? 1 : 0;
      const now = new Date(); const todayStr = scheduleUtils.fmt(now.getFullYear(), now.getMonth()+1, now.getDate());
      const aF = a.date > todayStr || (a.date === todayStr);
      const bF = b.date > todayStr || (b.date === todayStr);
      const aP = a.date < todayStr;
      const bP = b.date < todayStr;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (aF && bP) return -1;
      if (aP && bF) return 1;
      if (a.date === b.date && aR === bR) return b.id - a.id;
      return a.date < b.date ? -1 : 1;
    });

    wx.setStorageSync('schedules', schedules);
    const scheduleDates = scheduleUtils.buildScheduleDates(schedules);
    if (!this.data.selectedDate) this.setData({ schedules, scheduleDates, selectedDate: scheduleUtils.fmt(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate()) });
    else this.setData({ schedules, scheduleDates });
    this.generateCalendar();
    this.applyFilter();
    this.checkShiftForDate();
  },

  generateCalendar() {
    const { currentYear, currentMonth, scheduleDates, selectedDate } = this.data;
    const today = scheduleUtils.fmt(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
    const calendarTitle = `${currentYear}年${currentMonth}月`;
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    const days = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i, pm = currentMonth === 1 ? 12 : currentMonth - 1, py = currentMonth === 1 ? currentYear - 1 : currentYear;
      const date = scheduleUtils.fmt(py, pm, d);
      days.push({ key: date, day: d, date, isOtherMonth: true, isToday: date === today, isSelected: date === selectedDate, hasSchedule: !!scheduleDates[date] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = scheduleUtils.fmt(currentYear, currentMonth, d);
      days.push({ key: date, day: d, date, isOtherMonth: false, isToday: date === today, isSelected: date === selectedDate, hasSchedule: !!scheduleDates[date] });
    }
    const rem = 42 - days.length;
    for (let d = 1; d <= rem; d++) {
      const nm = currentMonth === 12 ? 1 : currentMonth + 1, ny = currentMonth === 12 ? currentYear + 1 : currentYear;
      const date = scheduleUtils.fmt(ny, nm, d);
      days.push({ key: date, day: d, date, isOtherMonth: true, isToday: date === today, isSelected: date === selectedDate, hasSchedule: !!scheduleDates[date] });
    }
    let info = '';
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      info = `周${['日','一','二','三','四','五','六'][d.getDay()]}  ${d.getMonth()+1}月${d.getDate()}日`;
    }
    this.setData({ calendarTitle, calendarDays: days, selectedDateInfo: info });
  },

  onPrevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (--currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.setData({ currentYear, currentMonth }); this.generateCalendar();
  },
  onNextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (++currentMonth > 12) { currentMonth = 1; currentYear++; }
    this.setData({ currentYear, currentMonth }); this.generateCalendar();
  },

  onDayTap(e) {
    const { date, isOther } = e.currentTarget.dataset;
    if (!date) return;
    const parts = date.split('-');
    this.setData({
      currentYear: Number(parts[0]),
      currentMonth: Number(parts[1]),
      selectedDate: date
    });
    this.generateCalendar();
    this.applyFilter();
    this.checkShiftForDate();
  },

  /** ========== 排查当天排班 ========== */
  checkShiftForDate() {
    const rule = engine.getActiveRule();
    if (!rule) {
      this.setData({ selectedShift: null, hasShiftRule: false });
      return;
    }
    const shift = engine.getShiftForDate(rule, this.data.selectedDate);
    this.setData({ selectedShift: shift, hasShiftRule: true });
  },

  onToggleView() {
    const v = !this.data.showCalendar;
    this.setData({ showCalendar: v });
    if (!v) this.setData({ filter: 'all' });
    this.applyFilter();
  },

  applyFilter() {
    const { schedules, filter, showCalendar, selectedDate } = this.data;
    let list = [];
    if (showCalendar && selectedDate) {
      list = scheduleUtils.expandRepeatingSchedules(schedules, selectedDate);
    } else {
      list = schedules;
      if (filter === 'pending') list = list.filter(s => !s.completed);
      else if (filter === 'completed') list = list.filter(s => s.completed);
      list = list.map(s => ({ ...s, _instanceDate: s.date, _instanceCompleted: s.completed }));
    }
    this.setData({ filteredList: list });
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter });
    this.applyFilter();
  },

  onItemTap(e) {
    const { id, date } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}${date ? '&instance=' + date : ''}` });
  },

  async onToggleComplete(e) {
    const { id, date } = e.currentTarget.dataset;
    const item = this.data.schedules.find(s => s.id === id);
    if (!item) return;
    if (item.repeatType && item.repeatType !== 'none') {
      // 重复日程：单次完成
      if (!item.completedDates) item.completedDates = [];
      const idx = item.completedDates.indexOf(date);
      if (idx >= 0) item.completedDates.splice(idx, 1);
      else item.completedDates.push(date);
      item.completed = false; // 母日程不标完成
    } else {
      item.completed = !item.completed;
    }
    item.updatedAt = new Date().toISOString();
    wx.setStorageSync('schedules', this.data.schedules);
    this.loadSchedules();

    // 云端同步
    if (item._cloudId) {
      try {
        const db = wx.cloud.database();
        await db.collection('schedules').doc(item._cloudId).update({
          data: { completed: item.completed, completedDates: item.completedDates, updatedAt: item.updatedAt }
        });
      } catch (err) {}
    }
  },

  onAdd() {
    const d = this.data.showCalendar && this.data.selectedDate ? `?date=${this.data.selectedDate}` : '';
    wx.navigateTo({ url: `/pages/index/index${d}` });
  }
});
