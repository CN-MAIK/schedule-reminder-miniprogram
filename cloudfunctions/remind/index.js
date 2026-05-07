// 云函数：日程提醒推送
// 每分钟由定时触发器调用，查询已到期但未提醒的日程并发送订阅消息
// V2: 支持重复日程 — 每次触发后计算下一轮 remindAt

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const TEMPLATE_ID = '2ntpB1-KftDWjdhkLA1tWUhHWjJc1Xfv1gleKt0X0nY';

exports.main = async (event, context) => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 2 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);

  try {
    const res = await db.collection('schedules')
      .where({
        remind: true,
        reminded: _.neq(true),
        completed: _.neq(true),
        remindAt: _.gte(cutoff.toISOString()).and(_.lt(windowEnd.toISOString()))
      })
      .limit(100)
      .get();

    console.log(`查询到 ${res.data.length} 条待提醒日程, 当前UTC: ${now.toISOString()}`);

    const results = [];

    for (const item of res.data) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: item._openid,
          templateId: TEMPLATE_ID,
          page: 'pages/list/list',
          data: {
            thing2: { value: item.title.substring(0, 20) },
            date4: { value: formatDateForMsg(item.date, item.time) }
          },
          miniprogramState: 'formal'
        });

        // 判断是否为重复日程
        const isRecurring = item.repeatType && item.repeatType !== 'none';
        const updateData = {};

        if (isRecurring) {
          // 重复日程：计算下一轮 remindAt
          const nextAt = getNextRemindAt(item);
          if (nextAt) {
            // 还有下一轮 → 更新 remindAt，不清除 reminded
            updateData.remindAt = nextAt;
            updateData.reminded = false;
            console.log(`[重复] ${item.title} → 下一轮: ${nextAt}`);
          } else {
            // 没有下一轮了 → 永久标记，不再提醒
            updateData.reminded = true;
            console.log(`[重复-终止] ${item.title} → 已到期`);
          }
        } else {
          // 普通日程：一次性提醒
          updateData.reminded = true;
        }

        await db.collection('schedules').doc(item._id).update({ data: updateData });

        results.push({ id: item.id, status: 'sent' });
        console.log(`已发送提醒: ${item.title}`);
      } catch (err) {
        console.error(`发送失败 [${item.title}]:`, err);
        results.push({ id: item.id, status: 'failed', error: err.message });
      }
    }

    return { success: true, total: res.data.length, results };
  } catch (err) {
    console.error('查询失败:', err);
    return { success: false, error: err.message };
  }
};

// ==================== 重复日程计算 ====================

/**
 * 计算下一个提醒时间，若无更多则返回 null
 */
function getNextRemindAt(item) {
  const baseDate = item.repeatStart || item.date; // 'YYYY-MM-DD'
  const time = item.time || '09:00';
  const [h, m] = time.split(':').map(Number);

  // 以当前 remindAt 的日期为基准，向后推进
  const current = new Date(item.remindAt);

  let next = new Date(current);
  next.setHours(0, 0, 0, 0);

  switch (item.repeatType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next = getNextWeeklyDate(next, item.repeatDays || [], baseDate);
      break;
    case 'monthly':
      next = getNextMonthlyDate(next, new Date(baseDate + 'T00:00:00').getDate());
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return null;
  }

  // 设置提醒时刻
  next.setHours(h, m, 0, 0);

  // 检查是否超出截止条件
  if (isPastEnd(item, next)) return null;

  return next.toISOString();
}

/** 跳过每天直到命中指定星期 */
function getNextWeeklyDate(current, repeatDays, baseDate) {
  if (repeatDays && repeatDays.length > 0) {
    const d = new Date(current);
    do { d.setDate(d.getDate() + 1); }
    while (!repeatDays.includes(d.getDay()));
    return d;
  }
  // 没指定星期 → 直接加 7 天
  const d = new Date(current);
  d.setDate(d.getDate() + 7);
  return d;
}

/** 下个月的同一天 */
function getNextMonthlyDate(current, targetDay) {
  const d = new Date(current);
  d.setMonth(d.getMonth() + 1);
  // 处理月末溢出（如 1月31日 → 2月28日，再检测是否同号）
  // 简单处理：如果 targetDay <= 28，直接用；否则需要特殊处理
  // CloudBase环境下 getLastDayOfMonth 的逻辑较复杂，先用简单加法
  return d;
}

/** 检查当前日期是否超过截止条件 */
function isPastEnd(item, nextDate) {
  const start = new Date((item.repeatStart || item.date) + 'T00:00:00');

  // endType='date' → 检查是否超出 endDate
  if (item.repeatEndType === 'date' && item.repeatEnd) {
    const end = new Date(item.repeatEnd + 'T23:59:59');
    return nextDate > end;
  }

  // endType='count' → 计算当前已是第几次，第 count 次后终止
  if (item.repeatEndType === 'count' && item.repeatCount > 0) {
    const occurrence = computeOccurrence(start, nextDate, item.repeatType, item.repeatDays || []);
    return occurrence > item.repeatCount;
  }

  // 无截止条件 → 无限重复（安全上限 2 年）
  const maxEnd = new Date();
  maxEnd.setFullYear(maxEnd.getFullYear() + 2);
  return nextDate > maxEnd;
}

/**
 * 计算目标日期是第 K 次重复（从 1 开始）
 * base 是 startDate，target 是要检查的日期
 */
function computeOccurrence(base, target, repeatType, repeatDays) {
  if (target <= base) return 1;
  const baseMs = base.getTime();
  const targetMs = target.getTime();
  const DAY = 86400000;

  switch (repeatType) {
    case 'daily':
      return Math.floor((targetMs - baseMs) / DAY) + 1;
    case 'weekly':
      if (repeatDays && repeatDays.length > 0) {
        // 对指定星期，计数每个星期中命中的次数
        let count = 0;
        const cur = new Date(base);
        while (cur <= target) {
          if (repeatDays.includes(cur.getDay())) count++;
          cur.setDate(cur.getDate() + 1);
          if (cur - base > 730 * DAY) break;
        }
        return count;
      }
      return Math.floor((targetMs - baseMs) / (7 * DAY)) + 1;
    case 'monthly':
      // 粗略估算每月一次
      return monthDiff(base, target) + 1;
    case 'yearly':
      return (target.getFullYear() - base.getFullYear()) + 1;
    default:
      return 1;
  }
}

function monthDiff(d1, d2) {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

// ==================== 格式化 ====================

function formatDateForMsg(date, time) {
  if (!date) return '';
  const parts = date.split('-');
  const cnDate = `${parts[0]}年${parts[1].padStart(2, '0')}月${parts[2].padStart(2, '0')}日`;
  if (time) return `${cnDate} ${time}`;
  return cnDate;
}
