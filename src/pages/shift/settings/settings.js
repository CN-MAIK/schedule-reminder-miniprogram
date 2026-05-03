// 排班设置页：预设模板选择 + 自定义规则编辑

const engine = require('../../../utils/shift-engine');

/** 预处理预设：把 shifts 对象转为数组方便 WXML 遍历 */
function processPresets() {
  return engine.PRESETS.map(p => ({
    name: p.name,
    desc: p.desc,
    seqLen: p.sequence.length,
    shiftsArr: (p.shifts && typeof p.shifts === 'object') ? Object.values(p.shifts) : []
  }));
}

/** 从 editing.shifts 提取 key 数组 */
function extractShiftKeys(editing) {
  return (editing && editing.shifts) ? Object.keys(editing.shifts) : [];
}

Page({
  data: {
    hasRule: false,
    presets: processPresets(),
    presetSrc: engine.PRESETS,  // 原始预设数据（用于确认时取值）
    editing: {},
    editMode: 'preset',
    showTemplate: true,
    selectedPresetIdx: -1,
    shiftKeys: [],
    startDateDisplay: '',
    endDateDisplay: '',
    checkMsg: ''
  },

  onShow() {
    const rule = engine.getActiveRule();
    if (rule) {
      const editing = JSON.parse(JSON.stringify(rule));
      this.setData({
        hasRule: true,
        editing: editing,
        shiftKeys: extractShiftKeys(editing),
        editMode: rule.name && engine.PRESETS.some(p => p.name === rule.name) ? 'preset' : 'custom',
        showTemplate: false,
        startDateDisplay: rule.startDate,
        endDateDisplay: rule.endDate || ''
      });
    } else {
      this.setData({ hasRule: false, showTemplate: true, selectedPresetIdx: -1, shiftKeys: [] });
    }
  },

  /** 选择预设模板 */
  onSelectPreset(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ selectedPresetIdx: idx });
  },

  /** 确认使用预设 */
  onConfirmPreset() {
    const idx = this.data.selectedPresetIdx;
    if (idx < 0) {
      wx.showToast({ title: '请先选择模板', icon: 'none' });
      return;
    }
    const p = this.data.presetSrc[idx];
    const editing = {
      name: p.name,
      sequence: p.sequence.slice(),
      shifts: JSON.parse(JSON.stringify(p.shifts)),
      startShiftIndex: p.startShiftIndex,
      startDate: '',
      endDate: '',
      adjustments: {}
    };
    this.setData({
      editing, editMode: 'preset', showTemplate: false,
      shiftKeys: extractShiftKeys(editing),
      startDateDisplay: '', endDateDisplay: ''
    });
  },

  /** 自定义编辑 */
  onGoCustom() {
    let editing;
    if (this.data.hasRule) {
      editing = JSON.parse(JSON.stringify(engine.getActiveRule()));
    } else {
      editing = {
        name: '自定义', sequence: ['白班', '夜班', '休息'],
        shifts: {
          '白班': { name: '白班', color: '#FF9500', startTime: '08:00', endTime: '20:00' },
          '夜班': { name: '夜班', color: '#5856D6', startTime: '20:00', endTime: '08:00' },
          '休息': { name: '休息', color: '#8E8E93' }
        },
        startShiftIndex: 0, startDate: '', endDate: '', adjustments: {}
      };
    }
    this.setData({
      editing, editMode: 'custom', showTemplate: false,
      shiftKeys: extractShiftKeys(editing)
    });
  },

  /** 返回到模板列表 */
  onBackToTemplates() {
    const rule = engine.getActiveRule();
    const ed = this.data.editing;
    if (rule && ed.startDate) {
      const saved = JSON.stringify({ startDate: rule.startDate, endDate: rule.endDate || '', sequence: rule.sequence, shifts: rule.shifts, startShiftIndex: rule.startShiftIndex });
      const current = JSON.stringify({ startDate: ed.startDate, endDate: ed.endDate || '', sequence: ed.sequence, shifts: ed.shifts, startShiftIndex: ed.startShiftIndex });
      if (saved !== current) {
        wx.showModal({
          title: '未保存的修改',
          content: '返回模板列表将丢失当前修改，确定返回？',
          success: (res) => { if (res.confirm) this.setData({ showTemplate: true }); }
        });
        return;
      }
    }
    this.setData({ showTemplate: true });
  },

  onStartDateChange(e) { this._syncEdit('startDate', e.detail.value, e.detail.value); },
  onEndDateChange(e) { this._syncEdit('endDate', e.detail.value, e.detail.value); },

  _syncEdit(field, val, displayVal) {
    const ed = this.data.editing;
    ed[field] = val;
    const patch = { editing: ed };
    if (displayVal !== undefined) patch[field === 'startDate' ? 'startDateDisplay' : 'endDateDisplay'] = displayVal;
    this.setData(patch);
  },

  onSequenceInput(e) {
    const raw = e.detail.value;
    const seq = raw.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const ed = this.data.editing;
    ed.sequence = seq;
    this.setData({ editing: ed });
  },

  onShiftColorChange(e) {
    const { shift } = e.currentTarget.dataset;
    const ed = this.data.editing;
    if (ed.shifts && ed.shifts[shift]) ed.shifts[shift].color = e.detail.value;
    this.setData({ editing: ed });
  },

  onShiftTimeChange(e) {
    const { shift, field } = e.currentTarget.dataset;
    const ed = this.data.editing;
    if (ed.shifts && ed.shifts[shift]) ed.shifts[shift][field] = e.detail.value;
    this.setData({ editing: ed });
  },

  /** 添加班次类型 */
  onAddShift() {
    const ed = this.data.editing;
    const colors = ['#FF9500', '#007AFF', '#5856D6', '#34C759', '#FF3B30', '#AF52DE', '#FF2D55', '#8E8E93'];
    const len = Object.keys(ed.shifts || {}).length;
    const name = '新班次' + (len + 1);
    const color = colors[len % colors.length];
    if (!ed.shifts) ed.shifts = {};
    ed.shifts[name] = { name, color, startTime: '', endTime: '' };
    this.setData({ editing: ed, shiftKeys: extractShiftKeys(ed) });
  },

  /** 删除班次类型 */
  onRemoveShift(e) {
    const shiftName = e.currentTarget.dataset.shift;
    const ed = this.data.editing;
    if (Object.keys(ed.shifts || {}).length <= 1) {
      wx.showToast({ title: '至少保留一个班次', icon: 'none' }); return;
    }
    wx.showModal({
      title: '删除班次',
      content: `删除「${shiftName}」后将同时从序列中移除，确定？`,
      success: (res) => {
        if (!res.confirm) return;
        delete ed.shifts[shiftName];
        ed.sequence = (ed.sequence || []).filter(s => s !== shiftName);
        this.setData({ editing: ed, shiftKeys: extractShiftKeys(ed) });
      }
    });
  },

  onSave() {
    const ed = this.data.editing;
    if (!ed.startDate) { this.setData({ checkMsg: '请设置起始日期' }); return; }
    if (!ed.sequence || ed.sequence.length === 0) { this.setData({ checkMsg: '请设置班次序列' }); return; }

    const rules = engine.loadRules();
    let rule = rules.find(r => r.id === ed.id);
    if (!rule) { ed.id = Date.now(); rules.push(ed); }
    else Object.assign(rule, ed);

    engine.saveRules(rules);
    engine.setActiveRule(rule ? rule.id : ed.id);

    wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1500);
  },

  onDelete() {
    wx.showModal({
      title: '删除排班规则',
      content: '删除后需重新设置。确认删除？',
      success: (res) => {
        if (!res.confirm) return;
        const rule = engine.getActiveRule();
        if (!rule) return;
        let rules = engine.loadRules();
        rules = rules.filter(r => r.id !== rule.id);
        engine.saveRules(rules);
        engine.setActiveRule(null);
        // 清理日历缓存
        const perMonth = wx.getStorageSync('shiftCalMonth') || {};
        delete perMonth['' + rule.id];
        wx.setStorageSync('shiftCalMonth', perMonth);
        this.setData({ hasRule: false, editing: {}, showTemplate: true, selectedPresetIdx: -1, shiftKeys: [] });
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  }
});
