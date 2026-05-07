/**
 * 日程公共工具
 * 日程模块和排班模块共用
 */

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

/** 判断某天是否被重复日程覆盖 */
function isRepeatHit(item, targetDate) {
  if (!item.repeatType || item.repeatType === 'none') return false;
  var start = new Date((item.repeatStart || item.date) + 'T00:00:00');
  var end = item.repeatEnd ? new Date(item.repeatEnd + 'T00:00:00') : null;
  var target = new Date(targetDate + 'T00:00:00');
  if (target < start) return false;
  if (end && target > end) return false;
  if (item.excludeDates && item.excludeDates.includes(targetDate)) return false;

  var baseDate = new Date((item.repeatStart || item.date) + 'T00:00:00');
  switch (item.repeatType) {
    case 'daily': {
      var diff = Math.floor((target - baseDate) / 86400000);
      return diff >= 0 && diff % 1 === 0;
    }
    case 'weekly': {
      var diff = Math.floor((target - baseDate) / 86400000);
      if (diff < 0) return false;
      if (item.repeatDays && item.repeatDays.length > 0) {
        var targetDay = target.getDay();
        if (!item.repeatDays.includes(targetDay)) return false;
      }
      return (diff >= 0 && diff % 7 === 0) || (item.repeatDays && item.repeatDays.length > 0 && diff >= 0);
    }
    case 'monthly': {
      var targetDay = target.getDate();
      var baseDay = baseDate.getDate();
      return targetDay === baseDay && target >= baseDate;
    }
    case 'yearly': {
      return target.getMonth() === baseDate.getMonth() &&
             target.getDate() === baseDate.getDate() &&
             target >= baseDate;
    }
    default: return false;
  }
}

/** 生成虚拟展开列表 */
function expandRepeatingSchedules(schedules, targetDate) {
  if (!targetDate) return schedules.filter(function(s) { return !s.repeatType || s.repeatType === 'none'; });
  var result = [];
  schedules.forEach(function(item) {
    if (!item.repeatType || item.repeatType === 'none') {
      if (item.date === targetDate) {
        result.push({ ...item, _instanceDate: item.date, _instanceCompleted: item.completed });
      }
    } else {
      if (item.date === targetDate) {
        result.push({ ...item, _instanceDate: item.date, _instanceCompleted: (item.completedDates || []).includes(item.date) || item.completed });
      }
      if (item.date !== targetDate && isRepeatHit(item, targetDate)) {
        result.push({ ...item, _instanceDate: targetDate, _instanceCompleted: (item.completedDates || []).includes(targetDate) });
      }
    }
  });
  return result;
}

/** 计算有日程的日期集合（含重复展开） */
function buildScheduleDates(schedules) {
  var dates = {};
  schedules.forEach(function(item) {
    dates[item.date] = true;
    if (item.repeatType && item.repeatType !== 'none') {
      var start = new Date((item.repeatStart || item.date) + 'T00:00:00');
      var end = item.repeatEnd ? new Date(item.repeatEnd + 'T23:59:59') : new Date(new Date().getFullYear() + 1, 0, 1);
      var cur = new Date(start);
      var endMs = Math.min(end.getTime(), new Date().setFullYear(new Date().getFullYear() + 1));
      while (cur.getTime() <= endMs) {
        var ds = fmt(cur.getFullYear(), cur.getMonth()+1, cur.getDate());
        if (ds !== item.date && isRepeatHit(item, ds)) dates[ds] = true;
        cur.setDate(cur.getDate() + 1);
        if (cur - start > 400 * 86400000) break;
      }
    }
  });
  return dates;
}

module.exports = { pad: pad, fmt: fmt, isRepeatHit: isRepeatHit, expandRepeatingSchedules: expandRepeatingSchedules, buildScheduleDates: buildScheduleDates };
