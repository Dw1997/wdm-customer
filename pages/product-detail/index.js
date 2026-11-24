const app = getApp();
const { getProductDetail, updateCartItem, removeCartItem } = require('../../services/shop');
const { detailImage, thumbImage } = require('../../utils/image');

Page({
  data: {
    fontClass: 'font-large',
    spuId: 0,
    product: {},
    skus: [],
    minPriceText: '',
    priceHiddenText: '审核通过后可见',
    totalCartCount: 0,
    selfQty: 0,
    selfSumText: '0.00',
    cartSheetVisible: false,
    cartItems: [],
    cartTotalAmountText: '0.00'
  },

  onLoad(options) {
    this.setData({ spuId: Number(options.spu_id) || 101 });
  },

  async onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    await this.loadData();
  },

  async loadData() {
    const [detail, cartData] = await Promise.all([
      getProductDetail(this.data.spuId),
      app.refreshCartBadge()
    ]);
    const cartMap = {};
    const cartItems = [];
    let cartTotalAmount = 0;
    if (cartData && cartData.items) {
      cartData.items.forEach((it) => {
        if (!it.invalid_reason) {
          cartMap[it.sku_id] = it.quantity;
          const priceNum = it.price !== null && it.price !== undefined ? Number(it.price) : null;
          if (priceNum !== null) {
            cartTotalAmount += priceNum * Number(it.quantity || 0);
          }
          cartItems.push({
            ...it,
            image_url: thumbImage(it.image_url),
            shortTitle: (it.name || '').slice(0, 2),
            priceText: priceNum !== null ? priceNum.toFixed(2) : ''
          });
        }
      });
    }
    let minPrice = null;
    let selfQty = 0;
    let selfSum = 0;
    const skus = (detail.skus || []).map((s) => {
      const qty = cartMap[s.sku_id] || 0;
      if (s.price !== null && s.price !== undefined) {
        const p = Number(s.price);
        if (minPrice === null || p < minPrice) minPrice = p;
        selfSum += p * qty;
      }
      selfQty += qty;
      return {
        ...s,
        qty,
        priceText: s.price !== null && s.price !== undefined ? Number(s.price).toFixed(2) : ''
      };
    });

    this.setData({
      product: {
        ...detail,
        image_urls: (detail.image_urls || []).map(detailImage)
      },
      skus,
      minPriceText: minPrice !== null ? minPrice.toFixed(2) : '',
      priceHiddenText: detail.price_hidden_reason === 'login_required' ? '登录后可见' : '审核通过后可见',
      totalCartCount: (cartData && cartData.total_quantity) || 0,
      selfQty,
      selfSumText: selfSum.toFixed(2),
      cartItems,
      cartTotalAmountText: cartTotalAmount.toFixed(2)
    });
  },

  async onSkuQtyChange(e) {
    const c = app.globalData.customer;
    if (!c) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    if (c.status === 'pending') {
      wx.showToast({ title: '审核通过后即可下单', icon: 'none' });
      return;
    }
    const skuId = Number(e.currentTarget.dataset.skuId);
    const quantity = Number(e.detail.value) || 0;
    if (quantity <= 0) {
      await removeCartItem(skuId);
    } else {
      await updateCartItem(skuId, quantity);
    }
    await this.loadData();
  },

  toggleCartSheet() {
    this.setData({ cartSheetVisible: !this.data.cartSheetVisible });
  },

  closeCartSheet() {
    this.setData({ cartSheetVisible: false });
  },

  noop() {},

  goCart() {
    this.setData({ cartSheetVisible: false });
    wx.switchTab({ url: '/pages/cart/index' });
  },

  onShareAppMessage() {
    // 分享仅带商品链接，不带价格（不同客户价格不同）
    return {
      title: this.data.product.name || '味都美副食商品推荐',
      path: '/pages/product-detail/index?spu_id=' + this.data.spuId
    };
  }
});
