const app = getApp();
const { getOrderDetail, cancelOrder, addCartItem } = require('../../services/shop');
const { generateIdempotencyKey } = require('../../utils/step');
const { thumbImage } = require('../../utils/image');
const { payOrders } = require('../../utils/wxpay');

const STATUS_MAP = {
  pending_approval: ['审批中', ''],
  pending: ['待配送', '订单已确认，正在为您备货排车，出车前可取消'],
  delivering: ['配送中', '货品已发出，请留意接听送货电话'],
  delivered: ['已送达', '货品已签收，感谢您的惠顾'],
  cancelled: ['已取消', '本订单已取消'],
  rejected: ['未通过', '']
};

const PAY_MAP = {
  unpaid: '未付（挂账）',
  partial: '部分付',
  paid: '已付清'
};

Page({
  data: {
    fontClass: 'font-large',
    orderId: 0,
    customer: {},
    order: { items: [], returns: [] },
    statusLabel: '',
    statusDesc: '',
    payLabel: '',
    totalAmountText: '0.00',
    couponAmount: 0,
    couponAmountText: '0.00',
    couponName: '',
    discountAmount: 0,
    discountAmountText: '0.00',
    payableAmountText: '0.00',
    paidAmountText: '0.00',
    unpaidAmountText: '0.00',
    canPay: false,
    paying: false
  },

  onLoad(options) {
    this.setData({ orderId: Number(options.id) || 501 });
  },

  async onShow() {
    this.setData({
      fontClass: app.globalData.fontClass,
      customer: app.globalData.customer || {}
    });
    await this.loadDetail();
  },

  async loadDetail() {
    const o = await getOrderDetail(this.data.orderId);
    const st = STATUS_MAP[o.status] || [o.status, ''];
    const items = (o.items || []).map((it) => ({
      ...it,
      image_url: thumbImage(it.image_url),
      shortTitle: (it.name || '').slice(0, 2),
      priceText: Number(it.price || 0).toFixed(2),
      amountText: Number(it.amount || 0).toFixed(2)
    }));
    const returns = (o.returns || []).map((r) => ({
      ...r,
      refundText: Number(r.refund_amount || 0).toFixed(2)
    }));
    const discount = Number(o.discount_amount || 0);
    const couponAmt = Number(o.coupon_amount || 0);
    const baseAmt = Number(
      o.delivered_amount !== null && o.delivered_amount !== undefined
        ? o.delivered_amount
        : o.total_amount || 0
    );
    const payable = o.payable_amount !== null && o.payable_amount !== undefined
      ? Number(o.payable_amount)
      : Math.max(0, baseAmt - couponAmt - discount);

    this.setData({
      order: { ...o, items, returns },
      statusLabel: st[0],
      statusDesc: st[1],
      payLabel: PAY_MAP[o.payment_status] || '未付',
      totalAmountText: Number(o.total_amount || 0).toFixed(2),
      couponAmount: couponAmt,
      couponAmountText: couponAmt.toFixed(2),
      couponName: o.coupon_name || '',
      discountAmount: discount,
      discountAmountText: discount.toFixed(2),
      payableAmountText: payable.toFixed(2),
      paidAmountText: Number(o.paid_amount || 0).toFixed(2),
      unpaidAmountText: Number(o.unpaid_amount || 0).toFixed(2),
      canPay: Boolean(o.can_pay) && Number(o.unpaid_amount || 0) > 0
    });
  },

  async onPayNow() {
    if (this.data.paying || !this.data.canPay) return;
    this.setData({ paying: true });
    try {
      const res = await payOrders([this.data.orderId]);
      if (res && res.paid) {
        await this.loadDetail();
      }
    } finally {
      this.setData({ paying: false });
    }
  },

  copyOrderNo() {
    wx.setClipboardData({ data: this.data.order.order_no || '' });
  },

  callSales() {
    const phone = this.data.customer.sales_phone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  },

  onCancel() {
    wx.showModal({
      title: '确认取消订单？',
      content: '取消后订单将不再配送，如为审批中订单也会保留取消记录。',
      confirmColor: '#D93829',
      success: async (res) => {
        if (!res.confirm) return;
        await cancelOrder(this.data.orderId, generateIdempotencyKey());
        wx.showToast({ title: '订单已取消', icon: 'none' });
        await this.loadDetail();
      }
    });
  },

  async onReorder() {
    for (const it of this.data.order.items || []) {
      await addCartItem(it.sku_id, it.quantity);
    }
    await app.refreshCartBadge();
    wx.switchTab({ url: '/pages/cart/index' });
  }
});
