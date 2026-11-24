const app = getApp();
const { getOrders, cancelOrder, addCartItem } = require('../../services/shop');
const { generateIdempotencyKey } = require('../../utils/step');
const { hasToken } = require('../../utils/request');
const { payOrders } = require('../../utils/wxpay');

const STATUS_LABELS = {
  pending_approval: '审批中',
  pending: '待配送',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
  rejected: '未通过'
};

const PAY_LABELS = {
  unpaid: '未付',
  partial: '部分付',
  paid: '已付清'
};

Page({
  data: {
    fontClass: 'font-large',
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending_approval', label: '审批中' },
      { key: 'pending', label: '待配送' },
      { key: 'delivering', label: '配送中' },
      { key: 'delivered', label: '已送达' },
      { key: 'cancelled', label: '已取消' },
      { key: 'rejected', label: '未通过' }
    ],
    orders: [],
    selectedIds: [],
    selectedCount: 0,
    selectedTotalText: '0.00',
    allPayableSelected: false,
    payableCount: 0,
    paying: false,
    page: 1,
    hasMore: false,
    loading: false,
    isLoggedIn: false
  },

  async onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    await app.ensureSilentLogin();
    if (!hasToken()) {
      this.setData({
        isLoggedIn: false,
        orders: [],
        selectedIds: [],
        selectedCount: 0,
        selectedTotalText: '0.00',
        payableCount: 0,
        hasMore: false,
        loading: false
      });
      return;
    }
    this.setData({ isLoggedIn: true });
    await this.loadOrders(true);
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  async onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    await this.loadOrders(false);
  },

  syncSelection(orders, rawSelectedIds) {
    const validPayableIds = new Set(
      orders.filter((o) => o.can_pay).map((o) => Number(o.id))
    );
    const nextIds = (rawSelectedIds || [])
      .map((id) => Number(id))
      .filter((id) => validPayableIds.has(id));
    const selectedSet = new Set(nextIds);

    let total = 0;
    const decorated = orders.map((o) => {
      const checked = selectedSet.has(Number(o.id));
      if (checked) {
        total += Number(o.unpaid_amount || 0);
      }
      return { ...o, checked };
    });

    const payableCount = validPayableIds.size;
    this.setData({
      orders: decorated,
      selectedIds: nextIds,
      selectedCount: nextIds.length,
      selectedTotalText: total.toFixed(2),
      payableCount,
      allPayableSelected: payableCount > 0 && nextIds.length === payableCount
    });
  },

  async loadOrders(reset = true) {
    if (this.data.loading && !reset) return;
    const nextPage = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    try {
      const res = await getOrders(this.data.activeTab, nextPage, 20);
      const rows = ((res && res.items) || []).map((o) => {
        const unpaidNum = Number(o.unpaid_amount || 0);
        const canPay = Boolean(o.can_pay) && unpaidNum > 0;
        return {
          ...o,
          can_pay: canPay,
          statusLabel: STATUS_LABELS[o.status] || o.status,
          payLabel: PAY_LABELS[o.payment_status] || '未付',
          totalAmountText: Number(o.total_amount || 0).toFixed(2),
          unpaidAmountText: unpaidNum.toFixed(2),
          previewItems: (o.items || []).slice(0, 3),
          checked: false
        };
      });
      const merged = reset ? rows : this.data.orders.concat(rows);
      const total = Number(res && res.total) || merged.length;
      this.setData({
        page: nextPage,
        hasMore: merged.length < total,
        loading: false
      });
      this.syncSelection(merged, reset ? [] : this.data.selectedIds);
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onSelectTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key });
    this.loadOrders(true);
  },

  toggleSelectOrder(e) {
    const id = Number(e.currentTarget.dataset.id);
    const current = new Set(this.data.selectedIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.syncSelection(this.data.orders, Array.from(current));
  },

  toggleSelectAll() {
    if (this.data.allPayableSelected) {
      this.syncSelection(this.data.orders, []);
    } else {
      const allIds = this.data.orders.filter((o) => o.can_pay).map((o) => Number(o.id));
      this.syncSelection(this.data.orders, allIds);
    }
  },

  async onPaySingle(e) {
    if (this.data.paying) return;
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    this.setData({ paying: true });
    try {
      const res = await payOrders([id]);
      if (res && res.paid) {
        await this.loadOrders(true);
      }
    } finally {
      this.setData({ paying: false });
    }
  },

  async onPayBatch() {
    if (this.data.paying || !this.data.selectedIds.length) return;
    this.setData({ paying: true });
    try {
      const res = await payOrders(this.data.selectedIds);
      if (res && res.paid) {
        await this.loadOrders(true);
      }
    } finally {
      this.setData({ paying: false });
    }
  },

  noop() {},

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/order-detail/index?id=' + id });
  },

  onCancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认取消订单？',
      content: '取消后订单将不再配送，如为审批中订单也会保留取消记录。',
      confirmColor: '#D93829',
      success: async (res) => {
        if (!res.confirm) return;
        await cancelOrder(id, generateIdempotencyKey());
        wx.showToast({ title: '订单已取消', icon: 'none' });
        await this.loadOrders(true);
      }
    });
  },

  async onReorder(e) {
    const id = Number(e.currentTarget.dataset.id);
    const order = this.data.orders.find((o) => Number(o.id) === id);
    if (!order || !order.items) return;
    for (const it of order.items) {
      await addCartItem(it.sku_id, it.quantity);
    }
    await app.refreshCartBadge();
    wx.showToast({ title: '已加入购物车，请核对数量', icon: 'none' });
    wx.switchTab({ url: '/pages/cart/index' });
  }
});
