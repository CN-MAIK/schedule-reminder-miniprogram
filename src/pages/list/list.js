// 日程列表页逻辑（含万年历）

Page({
  data: {
    // 日程数据
    schedules: [],
    filteredList: [],
    filter: 'all',         // all | pending | completed

    // 日历数据
    showCalendar: true,    // 默认显示日历
    currentYear: 2026,
    currentMonth: 1,       // 1-12
    calendarTitle: '',     // "2026年4月"
    calendarDays: [],      // 日历网格数据
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    selectedDate: '',      // 选中的日期 YYYY-MM-DD
    selectedDateInfo: '',  // "周三 4月29日"

    // 有日程的日期集合（用于标记圆点）
    scheduleDates: {}
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
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
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (aIsFuture && bIsPast) return -1;
      if (aIsPast && bIsFuture) return 1;
      const aKey = a.date + (a.time ? ' ' + a.time : '');
      const bKey = b.date + (b.time ? ' ' + b.time : '');
      if (aKey === bKey) return b.id - a.id;
      return aKey < bKey ? -1 : 1;
    });

    wx.setStorageSync('schedules', schedules);

    // 计算有日程的日期集合
    const scheduleDates = {};
    schedules.forEach(item => {
      scheduleDates[item.date] = true;
    });

    // 如果还没选中日期，默认选今天
    if (!this.data.selectedDate) {
      this.setData({
        schedules,
        scheduleDates,
        selectedDate: todayStr
      });
    } else {
      this.setData({ schedules, scheduleDates });
    }

    this.generateCalendar();
    this.applyFilter();
  },

  /** 生成日历数据 */
  generateCalendar() {
    const { currentYear, currentMonth, scheduleDates, selectedDate } = this.data;
    const today = this.formatDate(new Date());

    // 月份标题
    const calendarTitle = `${currentYear}年${currentMonth}月`;

    // 本月第一天是星期几（0=周日）
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    // 本月天数
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    // 上月天数
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();

    const calendarDays = [];

    // 填充上月尾部
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarDays.push({
        key: date,
        day,
        date,
        isOtherMonth: true,
        isToday: date === today,
        isSelected: date === selectedDate,
        hasSchedule: !!scheduleDates[date]
      });
    }

    // 填充本月
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarDays.push({
        key: date,
        day,
        date,
        isOtherMonth: false,
        isToday: date === today,
        isSelected: date === selectedDate,
        hasSchedule: !!scheduleDates[date]
      });
    }

    // 填充下月头部（凑满6行 = 42格）
    const remain = 42 - calendarDays.length;
    for (let day = 1; day <= remain; day++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarDays.push({
        key: date,
        day,
        date,
        isOtherMonth: true,
        isToday: date === today,
        isSelected: date === selectedDate,
        hasSchedule: !!scheduleDates[date]
      });
    }

    // 选中日期的中文信息
    let selectedDateInfo = '';
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      selectedDateInfo = `${weekdays[d.getDay()]}  ${d.getMonth() + 1}月${d.getDate()}日`;
    }

    this.setData({ calendarTitle, calendarDays, selectedDateInfo });
  },

  /** 上一个月 */
  onPrevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  /** 下一个月 */
  onNextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  /** 点击日期 */
  onDayTap(e) {
    const { date, isOther } = e.currentTarget.dataset;
    if (!date) return;

    // 如果点了其他月的日期，先跳转到那个月
    if (isOther) {
      const parts = date.split('-');
      this.setData({
        currentYear: Number(parts[0]),
        currentMonth: Number(parts[1]),
        selectedDate: date
      });
      this.generateCalendar();
    } else {
      this.setData({ selectedDate: date });
      this.generateCalendar();
    }
    this.applyFilter();
  },

  /** 切换日历/全部视图 */
  onToggleView() {
    const showCalendar = !this.data.showCalendar;
    this.setData({ showCalendar });
    if (!showCalendar) {
      // 全部模式下重置筛选
      this.setData({ filter: 'all' });
    }
    this.applyFilter();
  },

  /** 应用筛选 */
  applyFilter() {
    const { schedules, filter, showCalendar, selectedDate } = this.data;
    let filteredList;

    if (showCalendar && selectedDate) {
      // 日历模式：只显示选中日期的日程
      filteredList = schedules.filter(s => s.date === selectedDate);
    } else {
      // 全部模式：按筛选标签
      filteredList = schedules;
      if (filter === 'pending') {
        filteredList = schedules.filter(s => !s.completed);
      } else if (filter === 'completed') {
        filteredList = schedules.filter(s => s.completed);
      }
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
      }
    }
  },

  /** 跳转到添加日程页（带上选中日期） */
  onAdd() {
    const date = this.data.showCalendar && this.data.selectedDate
      ? `?date=${this.data.selectedDate}`
      : '';
    wx.navigateTo({
      url: `/pages/index/index${date}`
    });
  }
});
