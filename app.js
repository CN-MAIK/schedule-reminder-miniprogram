// 小程序入口
App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-d2gpr441j7abd606c',
        traceUser: true
      });
      console.log('云开发初始化成功');
    } else {
      console.warn('当前环境不支持云开发');
    }

    // 检查本地存储版本，必要时做数据迁移
    const version = wx.getStorageSync('dataVersion') || 1;
    if (version < 2) {
      // v1 → v2: 为旧数据补充 time/remind 字段
      const schedules = wx.getStorageSync('schedules') || [];
      schedules.forEach(item => {
        if (!item.time) item.time = '';
        if (item.remind === undefined) item.remind = false;
      });
      wx.setStorageSync('schedules', schedules);
      wx.setStorageSync('dataVersion', 2);
    }
  }
});