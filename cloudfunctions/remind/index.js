// 云函数：日程提醒推送
// 每分钟由定时触发器调用，查询即将到期的日程并发送订阅消息

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 订阅消息模板ID
const TEMPLATE_ID = '2ntpB1-KftDWjdhkLA1tWUhHWjJc1Xfv1gleKt0X0nY';

exports.main = async (event, context) => {
  const now = new Date();
  // 查询窗口：当前时间 ~ 当前时间+1分钟
  const windowEnd = new Date(now.getTime() + 60 * 1000);

  try {
    // 查询 remindAt 在当前分钟内且未发送过提醒的日程
    const res = await db.collection('schedules')
      .where({
        remind: true,
        reminded: _.neq(true),
        remindAt: _.gte(now.toISOString()).and(_.lt(windowEnd.toISOString()))
      })
      .limit(100)
      .get();

    console.log(`查询到 ${res.data.length} 条待提醒日程`);

    const results = [];

    for (const item of res.data) {
      try {
        // 发送订阅消息
        await cloud.openapi.subscribeMessage.send({
          touser: item._openid,
          templateId: TEMPLATE_ID,
          page: `pages/detail/detail?id=${item.id}`,
          data: {
            // 模板字段需与公众平台申请的模板一致
            // 常见字段映射：
            thing1: { value: item.title },                         // 日程标题
            time2: { value: formatDateTime(item.date, item.time) }, // 日程时间
            thing3: { value: (item.detail || '无').substring(0, 20) } // 备注
          },
          miniprogramState: 'formal'
        });

        // 标记已提醒
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