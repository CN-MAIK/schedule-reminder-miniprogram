// 添加日程页面逻辑

Page({
  data: {
    title: '',       // 日程标题
    date: '',        // 选中日期
    detail: '',      // 日程详情
    today: '',       // 今天日期，限制选择器不能选过去
    canSave: false   // 保存按钮是否可用
  },

  onLoad() {
    // 设置今天日期，作为日期选择器的起始值
    const now = new Date();
    const today = this.formatDate(now);
    this.setData({ today });
  },

  /** 格式化日期为 YYYY-MM-DD */
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /** 标题输入 */
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
    this.checkCanSave();
  },

  /** 日期选择 */
  onDateChange(e) {
    this.setData({ date: e.detail.value });
    this.checkCanSave();
  },

  /** 详情输入 */
  onDetailInput(e) {
    this.setData({ detail: e.detail.value });
  },

  /** 检查是否可以保存（标题和日期都填了才行） */
  checkCanSave() {
    const canSave = this.data.title.trim() !== '' && this.data.date !== '';
    this.setData({ canSave });
  },

  /** 保存日程 */
  onSave() {
    if (!this.data.canSave) return;

    const schedule = {
      title: this.data.title.trim(),
      date: this.data.date,
      detail: this.data.detail.trim(),
      id: Date.now(),  // 用时间戳作为简易 ID
      createdAt: new Date().toISOString()
    };

    // 从本地存储读取已有日程列表
    const schedules = wx.getStorageSync('schedules') || [];
    schedules.push(schedule);
    wx.setStorageSync('schedules', schedules);

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1500
    });

    // 延迟返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});
