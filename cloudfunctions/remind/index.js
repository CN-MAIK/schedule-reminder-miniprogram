// 云函数：日程提醒推送
// 每分钟由定时触发器调用，查询已到期但未提醒的日程并发送订阅消息

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 订阅消息模板ID
const TEMPLATE_ID = '2ntpB1-KftDWjdhkLA1tWUhHWjJc1Xfv1gleKt0X0nY';

exports.main = async (event, context) => {
  const now = new Date();
  // 安全上界：当前时间+2分钟（容错窗口，防止触发器执行时间偏移导致漏查）
  const windowEnd = new Date(now.getTime() + 2 * 60 * 1000);
  // 安全下界：当前时间-30分钟（避免发送很久以前的过期提醒）
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);

  try {
    // 查询条件：remindAt 在 [30分钟前, 2分钟后] 之间，且未发送过提醒
    // 不再用1分钟窄窗口，大幅减少漏查概率
    const res = await db.collection('schedules')
      .where({
        remind: true,
        reminded: _.neq(true),
        remindAt: _.gte(cutoff.toISOString()).and(_.lt(windowEnd.toISOString()))
      })
      .limit(100)
      .get();

    console.log(`查询到 ${res.data.length} 条待提醒日程, 当前UTC: ${now.toISOString()}`);

    const results = [];

    for (const item of res.data) {
      try {
        // 发送订阅消息
        await cloud.openapi.subscribeMessage.send({
          touser: item._openid,
          templateId: TEMPLATE_ID,
          page: `pages/detail/detail?id=${item.id}`,
          data: {
            thing2: { value: item.title.substring(0, 20) },
            date4: { value: formatDateTime(item.date, item.time) }
          },
          miniprogramState: 'formal'
        });

        // 标记已提醒，防止重复发送
        await db.collection('schedules').doc(item._id).update({
          data: { reminded: true }
        });

        results.push({ id: item.id, status: 'sent' });
        console.log(`已发送提醒: ${item.title}`);
      } catch (err) {
        console.error(`发送失败 [${item.title}]:`, err);
        results.push({ id: item.id, status: 'failed', error: err.message });
      }
    }

    return {
      success: true,
      total: res.data.length,
      results
    };
  } catch (err) {
    console.error('查询失败:', err);
    return { success: false, error: err.message };
  }
};

/** 格式化日期时间用于消息展示 */
function formatDateTime(date, time) {
  if (time) return `${date} ${time}`;
  return date;
}
