const { nextStepQuantity, prevStepQuantity } = require('../../utils/step');

Component({
  properties: {
    value: {
      type: Number,
      value: 0
    },
    label: {
      type: String,
      value: ''
    },
    min: {
      type: Number,
      value: 0
    },
    allowDecimal: {
      type: Boolean,
      value: false
    }
  },

  data: {
    showModal: false,
    draft: ''
  },

  methods: {
    noop() {},

    onPlus() {
      const next = nextStepQuantity(this.data.value);
      this.triggerEvent('change', { value: next });
    },

    onMinus() {
      const next = Math.max(this.data.min, prevStepQuantity(this.data.value));
      this.triggerEvent('change', { value: next });
    },

    openInput() {
      this.setData({
        showModal: true,
        draft: String(this.data.value || 1)
      });
    },

    closeInput() {
      this.setData({ showModal: false });
    },

    onDraftInput(e) {
      this.setData({ draft: e.detail.value });
    },

    pickQuick(e) {
      this.setData({ draft: String(e.currentTarget.dataset.num) });
    },

    confirmInput() {
      const raw = String(this.data.draft || '').trim();
      let parsed = this.data.allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
      if (isNaN(parsed) || parsed < this.data.min) {
        parsed = this.data.min;
      } else if (this.data.allowDecimal) {
        parsed = Math.round(parsed * 10) / 10;
      }
      this.setData({ showModal: false });
      this.triggerEvent('change', { value: parsed });
    }
  }
});
