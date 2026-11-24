const app = getApp();
const { getCart, getCheckoutOptions, createOrder } = require('../../services/shop');
const { generateIdempotencyKey } = require('../../utils/step');
const { thumbImage } = require('../../utils/image');
const { payOrders } = require('../../utils/wxpay');

function formatCheckoutItem(it) {
  const price = Number(it.price || 0);
  const qty = Number(it.quantity || 1);
  return {
    ...it,
    image_url: thumbImage(it.image_url),
    shortTitle: (it.name || '').slice(0, 2),
    quantity: qty,
    price,
    priceText: price.toFixed(2),
    subtotalText: (price * qty).toFixed(2)
  };
}

Page({
  data: {
    fontClass: 'font-large',
    customer: {},
    options: null,
    deliveryMode: 'pickup',
    selectedTripIndex: 0,
    selectedLineIndex: 0,
    tripDates: [],
    freightLines: [],
    modeCards: [],
    modeDetailText: '',
    cutoffWarnText: '',
    freightText: '无运费',
    warnings: [],
    submitError: '',
    hasInvalidItem: false,
    items: [],
    totalQty: 0,
    totalAmountText: '0.00',
    availableCoupons: [],
    selectedCouponId: null,
    selectedCouponName: '',
    couponDeductAmount: 0,
    couponDeductText: '0.00',
    payableAmountText: '0.00',
    usableCouponCount: 0,
    showCouponPicker: false,
    userClearedCoupon: false,
    remark: '',
    payMethod: 'credit', // credit（记账） | wxpay（立即微信支付）
    loading: true,
    submitting: false,
    idempotencyKey: ''
  },

  async onLoad() {
    const raw = wx.getStorageSync('wdm_checkout_items') || [];
    this.setData({
      idempotencyKey: generateIdempotencyKey(),
      items: raw.map(formatCheckoutItem)
    });
    this.recalcTotals();
    await this.loadOptionsAndRefreshPrices();
  },

  onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
  },

  refreshIdempotencyKey() {
    this.setData({ idempotencyKey: generateIdempotencyKey(), submitError: '' });
  },

  async loadOptionsAndRefreshPrices() {
    this.setData({ loading: true, submitError: '' });
    try {
      const [opt, cartData] = await Promise.all([
        getCheckoutOptions(this.data.totalAmountText),
        getCart()
      ]);

      // 用服务端实时重算后的购物车单价刷新已选商品，并检测是否有商品刚下架
      const cartBySku = {};
      if (cartData && Array.isArray(cartData.items)) {
        cartData.items.forEach((it) => {
          cartBySku[Number(it.sku_id)] = it;
        });
      }

      let hasInvalidItem = false;
      const refreshedItems = this.data.items.map((it) => {
        const latest = cartBySku[Number(it.sku_id)];
        if (!latest) return it;
        if (latest.invalid_reason) {
          hasInvalidItem = true;
        }
        return formatCheckoutItem({
          ...it,
          name: latest.name || it.name,
          image_url: latest.image_url !== undefined ? latest.image_url : it.image_url,
          spec: latest.spec || it.spec,
          unit: latest.unit || it.unit,
          allow_decimal: latest.allow_decimal !== undefined ? latest.allow_decimal : it.allow_decimal,
          price: latest.price !== null && latest.price !== undefined ? latest.price : it.price,
          invalid_reason: latest.invalid_reason || null
        });
      });

      const modes = (opt && opt.delivery_modes) || ['pickup'];
      const defaultMode = (opt && opt.default_mode) || modes[0] || 'pickup';
      const tripDates = (opt && opt.trip_dates) || [];
      const freightLines = (opt && opt.freight_lines) || [];
      const rawCoupons = (opt && opt.available_coupons) || [];
      const recId = (opt && opt.recommended_coupon_id) || null;

      this.setData({
        options: opt,
        customer: (opt && opt.customer) || app.globalData.customer || {},
        deliveryMode: defaultMode,
        selectedTripIndex: 0,
        selectedLineIndex: 0,
        tripDates,
        freightLines,
        availableCoupons: rawCoupons,
        selectedCouponId: this.data.userClearedCoupon ? null : recId,
        warnings: (opt && opt.warnings) || [],
        items: refreshedItems,
        hasInvalidItem,
        submitError: hasInvalidItem ? '清单中有商品已下架或暂不可售，请返回购物车调整' : '',
        loading: false
      });
      this.recalcTotals();
      this.updateModeDisplay();
    } catch (err) {
      this.setData({
        loading: false,
        submitError: (err && err.message) || '加载确认订单信息失败，请重试'
      });
    }
  },

  updateModeDisplay() {
    const { options, deliveryMode, tripDates, freightLines, selectedTripIndex, selectedLineIndex } = this.data;
    if (!options) return;
    const hasRoute = (options.delivery_modes || []).includes('route');
    const hasFreight = (options.delivery_modes || []).includes('freight') && freightLines.length > 0;
    const hasLocal = (options.delivery_modes || []).includes('local');
    const trip = tripDates[selectedTripIndex] || tripDates[0] || null;
    const line = freightLines[selectedLineIndex] || freightLines[0] || null;

    const modeCards = [
      { key: 'route', name: '跟车送', sub: hasRoute ? (trip ? trip.trip_date : '等待排车') : '未设地址', disabled: !hasRoute },
      { key: 'freight', name: '发物流', sub: hasFreight ? (line.cutoff_passed ? '顺延明天' : '今天发车') : '暂不支持', disabled: !hasFreight },
      { key: 'local', name: '城区自送', sub: hasLocal ? '店里直达' : '限城区', disabled: !hasLocal },
      { key: 'pickup', name: '到店自提', sub: '随时可取', disabled: false }
    ];

    let modeDetailText = '';
    let cutoffWarnText = '';
    let freightText = '无运费';

    if (deliveryMode === 'route') {
      modeDetailText = trip ? `预计送达：${trip.trip_name}` : '预计送达：等待排车，排车后由业务员通知';
      freightText = '跟车配送免费';
    } else if (deliveryMode === 'freight' && line) {
      modeDetailText = `物流线路：${line.name}（每天 ${line.depart_time} 发车，${line.cutoff_time || '15:30'} 截单）`;
      if (line.cutoff_passed) {
        cutoffWarnText = '已过今天截单时间，本单将自动顺延至明天发车批次';
      }
      freightText = '运费从货款中扣除';
    } else if (deliveryMode === 'local') {
      modeDetailText = '城区自送：下单后由店里直接配送到店';
      freightText = '城区自送免费';
    } else {
      modeDetailText = '到店自提：下单后随时到味都美副食总店报店名提货';
      freightText = '无运费';
    }

    this.setData({ modeCards, modeDetailText, cutoffWarnText, freightText });
  },

  selectMode(e) {
    const { key, disabled } = e.currentTarget.dataset;
    if (disabled) {
      let tip = '您所在的乡镇暂不支持物流，请联系业务员';
      if (key === 'route') {
        tip = '您尚未登记送货地点，请选择到店自提或联系业务员';
      } else if (key === 'local') {
        tip = '仅限城区客户，请联系业务员';
      }
      wx.showToast({ title: tip, icon: 'none' });
      return;
    }
    if (key === this.data.deliveryMode) return;
    this.setData({ deliveryMode: key });
    this.refreshIdempotencyKey();
    this.updateModeDisplay();
  },

  selectTrip(e) {
    const idx = Number(e.currentTarget.dataset.index) || 0;
    if (idx === this.data.selectedTripIndex) return;
    this.setData({ selectedTripIndex: idx });
    this.refreshIdempotencyKey();
    this.updateModeDisplay();
  },

  selectFreightLine(e) {
    const idx = Number(e.currentTarget.dataset.index) || 0;
    if (idx === this.data.selectedLineIndex) return;
    this.setData({ selectedLineIndex: idx });
    this.refreshIdempotencyKey();
    this.updateModeDisplay();
  },

  onItemQtyChange(e) {
    const skuId = Number(e.currentTarget.dataset.skuId);
    const quantity = Math.max(1, Number(e.detail.value) || 1);
    const items = this.data.items.map((it) => {
      if (Number(it.sku_id) !== skuId) return it;
      return {
        ...it,
        quantity,
        subtotalText: (Number(it.price || 0) * quantity).toFixed(2)
      };
    });
    this.setData({ items });
    this.refreshIdempotencyKey();
    this.recalcTotals();
  },

  recalcTotals() {
    let totalQty = 0;
    let totalAmount = 0;
    this.data.items.forEach((it) => {
      totalQty += Number(it.quantity || 0);
      totalAmount += Number(it.price || 0) * Number(it.quantity || 0);
    });

    const COUPON_TYPE_LABELS = {
      festival: '节日券',
      freight_subsidy: '运费补贴',
      diff_subsidy: '差额补贴',
      referral_reward: '拉新奖励'
    };

    const evaluated = (this.data.availableCoupons || []).map((c) => {
      const face = Number(c.amount || 0);
      const threshold = Number(c.min_order_amount || 0);
      const usable = totalAmount >= threshold;
      const deduct = usable ? Math.min(face, totalAmount) : 0;
      return {
        ...c,
        typeLabel: COUPON_TYPE_LABELS[c.coupon_type] || '优惠券',
        amountText: face.toFixed(2),
        thresholdText: threshold > 0 ? `满¥${threshold.toFixed(0)}可用` : '无门槛',
        validToText: (c.valid_to || '').slice(0, 10),
        usable,
        unusable_reason: usable ? null : `还差 ${(threshold - totalAmount).toFixed(2)} 元可用`,
        deduct_amount: deduct.toFixed(2)
      };
    });
    evaluated.sort((a, b) => {
      if (a.usable !== b.usable) return a.usable ? -1 : 1;
      const diff = Number(b.deduct_amount) - Number(a.deduct_amount);
      if (diff !== 0) return diff;
      return (a.valid_to || '').localeCompare(b.valid_to || '');
    });

    const usableCoupons = evaluated.filter((c) => c.usable);
    let selectedId = this.data.selectedCouponId;
    if (!this.data.userClearedCoupon) {
      const stillValid = usableCoupons.find((c) => c.id === selectedId);
      if (!stillValid) {
        selectedId = usableCoupons.length ? usableCoupons[0].id : null;
      }
    } else if (selectedId && !usableCoupons.some((c) => c.id === selectedId)) {
      selectedId = null;
    }

    const picked = usableCoupons.find((c) => c.id === selectedId) || null;
    const deductNum = picked ? Number(picked.deduct_amount || 0) : 0;
    const payable = Math.max(0, totalAmount - deductNum);

    this.setData({
      totalQty,
      totalAmountText: totalAmount.toFixed(2),
      availableCoupons: evaluated,
      usableCouponCount: usableCoupons.length,
      selectedCouponId: selectedId,
      selectedCouponName: picked ? picked.name : '',
      couponDeductAmount: deductNum,
      couponDeductText: deductNum.toFixed(2),
      payableAmountText: payable.toFixed(2)
    });
  },

  openCouponPicker() {
    if (!this.data.availableCoupons.length) return;
    this.setData({ showCouponPicker: true });
  },

  closeCouponPicker() {
    this.setData({ showCouponPicker: false });
  },

  chooseCoupon(e) {
    const id = Number(e.currentTarget.dataset.id);
    const usable = e.currentTarget.dataset.usable;
    if (!usable) return;
    this.setData({
      selectedCouponId: id,
      userClearedCoupon: false,
      showCouponPicker: false
    });
    this.refreshIdempotencyKey();
    this.recalcTotals();
  },

  clearCoupon() {
    this.setData({
      selectedCouponId: null,
      userClearedCoupon: true,
      showCouponPicker: false
    });
    this.refreshIdempotencyKey();
    this.recalcTotals();
  },

  noop() {},

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
    this.refreshIdempotencyKey();
  },

  selectPayMethod(e) {
    const method = e.currentTarget.dataset.method;
    if (!method || method === this.data.payMethod) return;
    this.setData({ payMethod: method });
  },

  callSales() {
    const phone = this.data.customer.sales_phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  backToCart() {
    wx.switchTab({ url: '/pages/cart/index' });
  },

  async onSubmit() {
    if (this.data.submitting || this.data.loading || !this.data.items.length) return;
    if (this.data.hasInvalidItem) {
      wx.showToast({ title: '有商品已下架，请回购物车调整', icon: 'none' });
      return;
    }

    const {
      deliveryMode,
      tripDates,
      freightLines,
      selectedTripIndex,
      selectedLineIndex,
      remark,
      items,
      idempotencyKey
    } = this.data;
    const trip = tripDates[selectedTripIndex] || tripDates[0] || null;
    const line = freightLines[selectedLineIndex] || freightLines[0] || null;

    const deliveryDate = deliveryMode === 'route' && trip
      ? trip.trip_date
      : (deliveryMode === 'freight' && line ? line.ship_date : undefined);

    const payload = {
      items: items.map((it) => ({ sku_id: Number(it.sku_id), quantity: it.quantity })),
      delivery_mode: deliveryMode,
      delivery_date: deliveryDate,
      freight_line_id: deliveryMode === 'freight' && line ? line.line_id : undefined,
      customer_coupon_id: this.data.selectedCouponId || undefined,
      remark: remark.trim() || undefined,
      from_cart: true
    };

    this.setData({ submitting: true, submitError: '' });
    try {
      const res = await createOrder(payload, idempotencyKey);
      wx.removeStorageSync('wdm_checkout_items');
      await app.refreshCartBadge();
      const order = (res && res.order) || {};

      if (this.data.payMethod === 'wxpay' && order.id && Number(order.unpaid_amount || order.payable_amount || 0) > 0) {
        try {
          await payOrders([order.id]);
        } catch (payErr) {
          // 支付失败或取消不影响已创建的订单，跳转详情后可随时继续支付
        }
        wx.redirectTo({ url: '/pages/order-detail/index?id=' + order.id });
        return;
      }

      wx.showToast({
        title: order.status === 'pending_approval' ? '已提交，订单审批中' : '下单成功，等待配送',
        icon: 'none'
      });
      // 提交成功后重定向到订单详情，不留在确认页防重复提交
      wx.redirectTo({ url: '/pages/order-detail/index?id=' + order.id });
    } catch (err) {
      this.setData({
        submitting: false,
        submitError: (err && err.message) || '提交订单失败，请稍后重试'
      });
    }
  }
});
