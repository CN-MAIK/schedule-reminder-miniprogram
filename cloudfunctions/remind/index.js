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
  const windowEnd = new Date(now.getTime() + 2 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);

  try {
    const res = await db.collection('schedules')
      .where({
        remind: true,
        reminded: _.neq(true),
        completed: _.neq(true),   // 过滤已完成的日程，不再提醒
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
          page: `pages/list/list`,
          data: {
            thing2: { value: item.title.substring(0, 20) },
            date4: { value: formatDateForMsg(item.date, item.time) }
          },
          miniprogramState: 'developer'  // 开发阶段用developer，上线后改formal
        });

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

/**
 * 格式化日期时间为订阅消息要求的格式
 * date 类型字段要求：2026年04月27日 21:00
 */
function formatDateForMsg(date, time) {
  if (!date) return '';
  const parts = date.split('-');
  const cnDate = `${parts[0]}年${parts[1].padStart(2, '0')}月${parts[2].padStart(2, '0')}日`;
  if (time) return `${cnDate} ${time}`;
  return cnDate;
}
