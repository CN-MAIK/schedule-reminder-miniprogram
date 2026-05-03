// 添加/编辑日程页面逻辑（含重复日程）

Page({
  data: {
    title: '', date: '', time: '', detail: '',
    remind: false, remindIndex: 0,
    remindOptions: ['准时', '5分钟前', '10分钟前', '15分钟前', '30分钟前', '1小时前'],
    today: '', canSave: false, isEdit: false, editId: null,
    _cloudId: null, _completed: false, _createdAt: null,

    // 重复
    repeatType: 'none',
    repeatStart: '',
    repeatEnd: '',
    repeatEndType: 'date',
    repeatCount: 0,
    repeatDays: [],
    repeatLabel: '不重复',

    // 弹窗
    showRepeatPopup: false,
    popupRepeatType: 'none',
    popupEndDate: '',
    popupEndType: 'date',
    popupRepeatCount: 0,
    weekdaySelected: [false, false, false, false, false, false, false]
  },

  WEEKDAY_MAP: ['周日','周一','周二','周三','周四','周五','周六'],
  REPEAT_LABELS: { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' },

  onLoad(options) {
    const now = new Date();
    const today = this.fmt(now);
    this.setData({ today });

    if (options.id) {
      const schedules = wx.getStorageSync('schedules') || [];
      const item = schedules.find(s => s.id === Number(options.id));
      if (item) {
        const rt = item.repeatType || 'none';
        this.setData({
          title: item.title, date: item.date, time: item.time || '',
          detail: item.detail || '', remind: item.remind || false,
          remindIndex: item.remindIndex || 0, isEdit: true, editId: item.id,
          _cloudId: item._cloudId || null, _completed: item.completed || false,
          _createdAt: item.createdAt || null,
          repeatType: rt, repeatStart: item.repeatStart || item.date,
          repeatEnd: item.repeatEnd || '', repeatEndType: item.repeatEndType || 'date',
          repeatCount: item.repeatCount || 0,
          repeatDays: item.repeatDays || [],
          repeatLabel: rt === 'weekly' && item.repeatDays && item.repeatDays.length
            ? '每周(' + item.repeatDays.map(d => this.WEEKDAY_MAP[d]).join('、') + ')'
            : this.REPEAT_LABELS[rt] || '不重复'
        });
        this.checkCanSave();
      }
    } else if (options.date) {
      this.setData({ date: options.date, repeatStart: options.date });
      this.checkCanSave();
    }
  },

  fmt(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); },

  onTitleInput(e) { this.setData({ title: e.detail.value }); this.checkCanSave(); },
  onDateChange(e) {
    const d = e.detail.value;
    this.setData({ date: d, repeatStart: this.data.isEdit ? this.data.repeatStart : d });
    this.checkCanSave();
  },
  onTimeChange(e) {
    const t = e.detail.value;
    this.setData({ time: t });
    if (t && !this.data.remind) this.setData({ remind: true });
    if (!t) this.setData({ remind: false });
  },
  onRemindChange(e) { this.setData({ remind: e.detail.value }); },
  onRemindTimeChange(e) { this.setData({ remindIndex: Number(e.detail.value) }); },
  onDetailInput(e) { this.setData({ detail: e.detail.value }); },
  checkCanSave() { this.setData({ canSave: this.data.title.trim() !== '' && this.data.date !== '' }); },

  // ==================== 重复设置弹窗 ====================
  onTapRepeat() {
    const rts = this.data.repeatType;
    let sel = [false, false, false, false, false, false, false];
    if (rts === 'weekly' && this.data.repeatDays.length) {
      this.data.repeatDays.forEach(d => { if (d >= 0 && d <= 6) sel[d] = true; });
    }
    this.setData({
      showRepeatPopup: true,
      popupRepeatType: this.data.repeatType,
      popupEndDate: this.data.repeatEnd,
      popupEndType: this.data.repeatEndType,
      popupRepeatCount: this.data.repeatCount,
      weekdaySelected: sel
    });
  },
  onCloseRepeatPopup() { this.setData({ showRepeatPopup: false }); },
  onSelRepeatType(e) { this.setData({ popupRepeatType: e.currentTarget.dataset.type }); },
  onSelEndType(e) { this.setData({ popupEndType: e.currentTarget.dataset.type }); },
  onEndDateChange(e) { this.setData({ popupEndDate: e.detail.value }); },
  onRepeatCountInput(e) { this.setData({ popupRepeatCount: Number(e.detail.value) || 0 }); },
  onToggleWeekday(e) {
    const day = Number(e.currentTarget.dataset.day);
    const sel = [...this.data.weekdaySelected];
    sel[day] = !sel[day];
    this.setData({ weekdaySelected: sel });
  },

  onConfirmRepeat() {
    const { popupRepeatType, popupEndType, popupEndDate, popupRepeatCount, weekdaySelected } = this.data;
    let label = this.REPEAT_LABELS[popupRepeatType] || '不重复';
    let days = [];
    if (popupRepeatType === 'weekly') {
      days = weekdaySelected.map((v, i) => v ? i : -1).filter(v => v >= 0);
      if (days.length) label = '每周(' + days.map(d => this.WEEKDAY_MAP[d]).join('、') + ')';
    }
    this.setData({
      repeatType: popupRepeatType,
      repeatEndType: popupEndType,
      repeatEnd: popupEndType === 'date' ? popupEndDate : '',
      repeatCount: popupEndType === 'count' ? popupRepeatCount : 0,
      repeatDays: days,
      repeatLabel: label,
      showRepeatPopup: false
    });
  },

  // ==================== 订阅授权 ====================
  requestSubscribe() {
    return new Promise((resolve) => {
      if (!this.data.remind || !this.data.time) { resolve(false); return; }
      wx.requestSubscribeMessage({
        tmplIds: ['2ntpB1-KftDWjdhkLA1tWUhHWjJc1Xfv1gleKt0X0nY'],
        success(res) {
          const ok = res['2ntpB1-KftDWjdhkLA1tWUhHWjJc1Xfv1gleKt0X0nY'] === 'accept';
          if (!ok) wx.showToast({ title: '未授权提醒，将收不到通知', icon: 'none', duration: 2500 });
          resolve(ok);
        },
        fail() {
          wx.showModal({
            title: '提醒授权', content: '需要在弹窗中允许通知才能收到提醒。如未弹出，请在微信设置中开启通知权限。',
            showCancel: true, confirmText: '知道了', cancelText: '忽略'
          });
          resolve(false);
        }
      });
    });
  },

  calcRemindAt() {
    if (!this.data.remind || !this.data.time) return '';
    const target = new Date(`${this.data.date}T${this.data.time}:00`);
    const min = [0,5,10,15,30,60][this.data.remindIndex] || 0;
    return new Date(target.getTime() - min * 60000).toISOString();
  },

  // ==================== 云端同步 ====================
  async syncToCloud(schedule) {
    try {
      const db = wx.cloud.database();
      const col = db.collection('schedules');
      const data = { ...schedule };
      if (data._cloudId) { const cid = data._cloudId; delete data._cloudId; delete data.completedDates; delete data.excludeDates; await col.doc(cid).update({ data }); return cid; }
      if (this.data._cloudId) { delete data._cloudId; delete data.completedDates; delete data.excludeDates; await col.doc(this.data._cloudId).update({ data }); return this.data._cloudId; }
      delete data._cloudId;
      const res = await col.add({ data });
      return res._id;
    } catch (err) {
      console.error('云端同步失败:', err);
      wx.showModal({ title: '同步失败', content: '失败原因：' + (err.errMsg || err.message || '未知'), showCancel: false });
      return null;
    }
  },

  // ==================== 保存 ====================
  async onSave() {
    if (!this.data.canSave) return;
    const subscribed = await this.requestSubscribe();

    const schedule = {
      title: this.data.title.trim(),
      date: this.data.date,
      time: this.data.time,
      detail: this.data.detail.trim(),
      remind: this.data.remind && this.data.time !== '',
      remindIndex: this.data.remindIndex,
      remindAt: this.calcRemindAt(),
      subscribed,
      completed: this.data.isEdit ? this.data._completed : false,
      id: this.data.isEdit ? this.data.editId : Date.now(),
      createdAt: this.data.isEdit ? this.data._createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 重复字段
      repeatType: this.data.repeatType,
      repeatStart: this.data.repeatStart || this.data.date,
      repeatEnd: this.data.repeatType === 'none' ? '' : this.data.repeatEnd,
      repeatEndType: this.data.repeatType === 'none' ? 'date' : this.data.repeatEndType,
      repeatCount: this.data.repeatType === 'none' ? 0 : this.data.repeatCount,
      repeatDays: this.data.repeatDays,
      completedDates: [],
      excludeDates: []
    };

    // 编辑时保留已有的 completedDates
    if (this.data.isEdit) {
      const old = (wx.getStorageSync('schedules') || []).find(s => s.id === this.data.editId);
      if (old) schedule.completedDates = old.completedDates || [];
    }

    // 云端同步
    let cloudId = null;
    if (schedule.remind) {
      wx.showLoading({ title: '同步中...' });
      cloudId = await this.syncToCloud(schedule);
      wx.hideLoading();
      if (cloudId) schedule._cloudId = cloudId;
    } else if (this.data._cloudId) {
      try { const db = wx.cloud.database(); await db.collection('schedules').doc(this.data._cloudId).remove(); } catch(e) {}
    }

    // 本地保存
    let list = wx.getStorageSync('schedules') || [];
    if (this.data.isEdit) {
      const i = list.findIndex(s => s.id === this.data.editId);
      if (i >= 0) {
        if (!cloudId && list[i]._cloudId) schedule._cloudId = list[i]._cloudId;
        list[i] = schedule;
      }
    } else { list.push(schedule); }
    wx.setStorageSync('schedules', list);

    wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1500);
  }
});
