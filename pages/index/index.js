// 添加/编辑日程页面逻辑

Page({
  data: {
    title: '',
    date: '',
    time: '',         // 时间 HH:mm
    detail: '',
    remind: false,    // 是否开启提醒
    remindIndex: 0,   // 提前提醒选项索引
    remindOptions: ['准时', '5分钟前', '10分钟前', '15分钟前', '30分钟前', '1小时前'],
    today: '',
    canSave: false,
    isEdit: false,    // 是否编辑模式
    editId: null      // 编辑的日程ID
  },

  onLoad(options) {
    const now = new Date();
    const today = this.formatDate(now);
    this.setData({ today });

    // 如果传了 id，说明是编辑模式
    if (options.id) {
      const schedules = wx.getStorageSync('schedules') || [];
      const item = schedules.find(s => s.id === Number(options.id));
      if (item) {
        this.setData({
          title: item.title,
          date: item.date,
          time: item.time || '',
          detail: item.detail || '',
          remind: item.remind || false,
          remindIndex: item.remindIndex || 0,
          isEdit: true,
          editId: item.id
        });
        this.checkCanSave();
      }
    }
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

  /** 时间选择 */
  onTimeChange(e) {
    const time = e.detail.value;
    this.setData({ time });
    // 选了时间就默认开启提醒
    if (time && !this.data.remind) {
      this.setData({ remind: true });
    }
    // 清除时间时关闭提醒
    if (!time) {
      this.setData({ remind: false });
    }
  },

  /** 提醒开关 */
  onRemindChange(e) {
    this.setData({ remind: e.detail.value });
  },

  /** 提前提醒时间选择 */
  onRemindTimeChange(e) {
    this.setData({ remindIndex: Number(e.detail.value) });
  },

  /** 详情输入 */
  onDetailInput(e) {
    this.setData({ detail: e.detail.value });
  },

  /** 检查是否可以保存 */
  checkCanSave() {
    const canSave = this.data.title.trim() !== '' && this.data.date !== '';
    this.setData({ canSave });
  },

  /** 请求订阅消息授权 */
  requestSubscribe() {
    return new Promise((resolve) => {
      if (!this.data.remind || !this.data.time) {
        resolve(false);
        return;
      }
      // TODO: 替换为你在公众平台申请的模板ID
      const templateId = '2ntpB1-KftDWjdhkLA1tWUhHWjJc1Xfv1gleKt0X0nY';
      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        success(res) {
          console.log('订阅授权结果:', res);
          resolve(res[templateId] === 'accept');
        },
        fail(err) {
          console.warn('订阅授权失败:', err);
          resolve(false);
        }
      });
    });
  },

  /** 计算提醒触发时间（返回 ISO 字符串） */
  calcRemindAt() {
    if (!this.data.remind || !this.data.time) return '';
    const { date, time, remindIndex, remindOptions } = this.data;
    // 解析目标时间
    const target = new Date(`${date}T${time}:00`);
    // 提前量（分钟）
    const minutesMap = [0, 5, 10, 15, 30, 60];
    const ahead = minutesMap[remindIndex] || 0;
    const remindAt = new Date(target.getTime() - ahead * 60000);
    return remindAt.toISOString();
  },

  /** 保存日程 */
  async onSave() {
    if (!this.data.canSave) return;

    // 如果开启提醒，先请求订阅授权
    const subscribed = await this.requestSubscribe();

    const schedule = {
      title: this.data.title.trim(),
      date: this.data.date,
      time: this.data.time,
      detail: this.data.detail.trim(),
      remind: this.data.remind && this.data.time !== '',
      remindIndex: this.data.remindIndex,
      remindAt: this.calcRemindAt(),
      subscribed: subscribed,
      completed: false,
      id: this.data.isEdit ? this.data.editId : Date.now(),
      createdAt: this.data.isEdit ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 编辑模式不覆盖 createdAt
    if (this.data.isEdit) {
      const schedules = wx.getStorageSync('schedules') || [];
      const idx = schedules.findIndex(s => s.id === this.data.editId);
      if (idx !== -1) {
        schedule.createdAt = schedules[idx].createdAt;
        schedules[idx] = schedule;
        wx.setStorageSync('schedules', schedules);
      }
    } else {
      const schedules = wx.getStorageSync('schedules') || [];
      schedules.push(schedule);
      wx.setStorageSync('schedules', schedules);
    }

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1500
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});