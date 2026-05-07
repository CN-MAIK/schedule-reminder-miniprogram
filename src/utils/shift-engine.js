/**
 * 排班规则引擎
 * 核心：起始日 + 班次序列 + 目标日期 → 唯一确定的班次
 * 
 * 数据模型:
 *   rule = {
 *     id, name,
 *     startDate: '2026-01-01',
 *     startShiftIndex: 0,          // 起始日在序列中的位置
 *     sequence: ['白班','白班','中班','中班','夜班','夜班','休息','休息'],
 *     shifts: {                     // 班次定义
 *       '白班': { name:'白班', color:'#FF9500', startTime:'08:00', endTime:'16:00' },
 *       '中班': { name:'中班', color:'#007AFF', startTime:'16:00', endTime:'00:00' },
 *       '夜班': { name:'夜班', color:'#5856D6', startTime:'00:00', endTime:'08:00' },
 *       '休息': { name:'休息', color:'#8E8E93' }
 *     },
 *     endDate: '',                 // 可选截止日
 *     adjustments: { '2026-05-01': '休息' }  // date → shift名称 的换班覆盖
 *   }
 */

function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 计算指定日期对应的班次 */
function getShiftForDate(rule, dateStr) {
  if (!rule || !dateStr) return null;

  // 1. 换班覆盖优先（兼容旧 string 和新 object 格式）
  if (rule.adjustments && rule.adjustments[dateStr] != null) {
    const adj = rule.adjustments[dateStr];
    const name = typeof adj === 'string' ? adj : adj.shift;
    return rule.shifts[name] || null;
  }

  const start = new Date(rule.startDate + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');

  // 2. 区间检查
  if (target < start) return null;
  if (rule.endDate) {
    const end = new Date(rule.endDate + 'T00:00:00');
    if (target > end) return null;
  }

  // 3. 数学推算
  const diffDays = Math.floor((target - start) / 86400000);
  const len = rule.sequence.length;
  const idx = ((rule.startShiftIndex + diffDays) % len + len) % len;
  const shiftName = rule.sequence[idx];
  return rule.shifts[shiftName] || null;
}

/** 获取接下来 N 天的排班列表 */
function getUpcomingShifts(rule, fromDate, days) {
  const list = [];
  const base = new Date(fromDate + 'T00:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const shift = getShiftForDate(rule, ds);
    list.push({
      date: ds,
      day: d.getDate(),
      weekday: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
      isToday: ds === fromDate,
      shift: shift || null
    });
  }
  return list;
}

/** 倒计时：距下一次「非休息」班次的天数 */
function getCountdown(rule, fromDate) {
  const base = new Date(fromDate + 'T00:00:00');
  for (let i = 0; i < 60; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const shift = getShiftForDate(rule, ds);
    if (shift && shift.name !== '休息') {
      return { days: i, date: ds, shift };
    }
  }
  return null;
}

/** 月度班次统计 */
function getMonthStats(rule, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const stats = {};
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = fmt(year, month, d);
    const shift = getShiftForDate(rule, ds);
    if (shift) {
      stats[shift.name] = (stats[shift.name] || 0) + 1;
      total++;
    }
  }
  return { stats, total };
}

/** 生成月历数据（含排班色块） */
function buildCalendarData(rule, year, month, selectedDate) {
  const today = fmt(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const days = [];

  // 上月尾部
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    const ds = fmt(py, pm, d);
    const shift = getShiftForDate(rule, ds);
    days.push({ day: d, date: ds, isOtherMonth: true, isToday: ds === today, isSelected: ds === selectedDate, shift });
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = fmt(year, month, d);
    const shift = getShiftForDate(rule, ds);
    days.push({ day: d, date: ds, isOtherMonth: false, isToday: ds === today, isSelected: ds === selectedDate, shift });
  }

  // 下月头部
  const rem = 42 - days.length;
  for (let d = 1; d <= rem; d++) {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    const ds = fmt(ny, nm, d);
    const shift = getShiftForDate(rule, ds);
    days.push({ day: d, date: ds, isOtherMonth: true, isToday: ds === today, isSelected: ds === selectedDate, shift });
  }

  return days;
}

/** 预设排班模板 */
const PRESETS = [
  {
    name: '四班三运转',
    desc: '上6休2，8小时制，煤化工最常见',
    startShiftIndex: 0,
    sequence: ['白班', '白班', '中班', '中班', '夜班', '夜班', '休息', '休息'],
    shifts: {
      '白班': { name: '白班', color: '#FF9500', startTime: '08:00', endTime: '16:00' },
      '中班': { name: '中班', color: '#007AFF', startTime: '16:00', endTime: '00:00' },
      '夜班': { name: '夜班', color: '#5856D6', startTime: '00:00', endTime: '08:00' },
      '休息': { name: '休息', color: '#8E8E93' }
    }
  },
  {
    name: '三班两倒',
    desc: '12小时制，白夜休休循环',
    startShiftIndex: 0,
    sequence: ['白班', '夜班', '休息', '休息'],
    shifts: {
      '白班': { name: '白班', color: '#FF9500', startTime: '08:00', endTime: '20:00' },
      '夜班': { name: '夜班', color: '#5856D6', startTime: '20:00', endTime: '08:00' },
      '休息': { name: '休息', color: '#8E8E93' }
    }
  },
  {
    name: '四班两倒',
    desc: '12小时制，白休夜休循环',
    startShiftIndex: 0,
    sequence: ['白班', '休息', '夜班', '休息'],
    shifts: {
      '白班': { name: '白班', color: '#FF9500', startTime: '08:00', endTime: '20:00' },
      '夜班': { name: '夜班', color: '#5856D6', startTime: '20:00', endTime: '08:00' },
      '休息': { name: '休息', color: '#8E8E93' }
    }
  },
  {
    name: '上二休二',
    desc: '12小时制，两天白班两天休息',
    startShiftIndex: 0,
    sequence: ['白班', '白班', '休息', '休息'],
    shifts: {
      '白班': { name: '白班', color: '#FF9500', startTime: '08:00', endTime: '20:00' },
      '休息': { name: '休息', color: '#8E8E93' }
    }
  },
  {
    name: '五班三运转',
    desc: '上6休2学2，10天周期',
    startShiftIndex: 0,
    sequence: ['白班', '白班', '中班', '中班', '夜班', '夜班', '休息', '休息', '学习', '学习'],
    shifts: {
      '白班': { name: '白班', color: '#FF9500', startTime: '08:00', endTime: '16:00' },
      '中班': { name: '中班', color: '#007AFF', startTime: '16:00', endTime: '00:00' },
      '夜班': { name: '夜班', color: '#5856D6', startTime: '00:00', endTime: '08:00' },
      '休息': { name: '休息', color: '#8E8E93' },
      '学习': { name: '学习', color: '#34C759' }
    }
  }
];

/** 保存 / 读取排班规则 */
function loadRules() {
  return wx.getStorageSync('shiftRules') || [];
}
function saveRules(rules) {
  wx.setStorageSync('shiftRules', rules);
}
function loadActiveRuleId() {
  return wx.getStorageSync('shiftActiveRuleId') || null;
}
function setActiveRule(id) {
  wx.setStorageSync('shiftActiveRuleId', id);
}
function getActiveRule() {
  const id = loadActiveRuleId();
  if (!id) return null;
  const rules = loadRules();
  return rules.find(r => r.id === id) || null;
}

module.exports = {
  getShiftForDate,
  getUpcomingShifts,
  getCountdown,
  getMonthStats,
  buildCalendarData,
  PRESETS,
  loadRules,
  saveRules,
  loadActiveRuleId,
  setActiveRule,
  getActiveRule,
  fmt
};
