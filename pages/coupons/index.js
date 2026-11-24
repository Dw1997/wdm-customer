const app = getApp();
const { getMyCoupons } = require('../../services/shop');

const TYPE_LABELS = {
  festival: '节日券',
  freight_subsidy: '运费补贴',
  diff_subsidy: '差额补贴',
  referral_reward: '拉新奖励'
};

Page({
  data: {
    fontClass: 'font-large',
    status: 'unused',
    counts: { unused: 0, used: 0, expired: 0 },
    items: [],
    loading: true
  },

  onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    this.loadCoupons();
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.status) return;
    this.setData({ status });
    this.loadCoupons();
  },

  async loadCoupons() {
    this.setData({ loading: true });
    try {
      const res = await getMyCoupons(this.data.status, 1, 50);
      const items = ((res && res.items) || []).map((c) => {
        const threshold = Number(c.min_order_amount || 0);
        return {
          ...c,
          typeLabel: TYPE_LABELS[c.coupon_type] || '优惠券',
          amountText: Number(c.amount || 0).toFixed(2),
          thresholdText: threshold > 0 ? `满¥${threshold.toFixed(0)}可用` : '无门槛',
          validToText: (c.valid_to || '').slice(0, 10),
          discountText: Number(c.discount_applied || c.amount || 0).toFixed(2)
        };
      });
      this.setData({
        items,
        counts: (res && res.counts) || { unused: 0, used: 0, expired: 0 },
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  goUse() {
    wx.switchTab({ url: '/pages/category/index' });
  },

  goOrder(e) {
    const orderId = e.currentTarget.dataset.orderId;
    if (orderId) {
      wx.navigateTo({ url: '/pages/order-detail/index?id=' + orderId });
    }
  }
});
