const { thumbImage } = require('../../utils/image');

Component({
  properties: {
    visible: { type: Boolean, value: false },
    product: { type: Object, value: {} },
    cartMap: { type: Object, value: {} }
  },

  data: {
    skus: [],
    thumbUrl: '',
    shortTitle: '',
    subtotalText: '0.00',
    hasVisiblePrice: true,
    priceHiddenText: '审核通过后可见'
  },

  observers: {
    'product, cartMap, visible': function (product, cartMap, visible) {
      if (!visible || !product || !product.skus) return;
      const map = cartMap || {};
      let sum = 0;
      let hasVisiblePrice = false;
      const skus = product.skus.map((s) => {
        const qty = Number(map[s.sku_id]) || 0;
        if (s.price !== null && s.price !== undefined) {
          hasVisiblePrice = true;
          sum += qty * Number(s.price);
        }
        return {
          ...s,
          qty,
          priceText: s.price !== null && s.price !== undefined ? Number(s.price).toFixed(2) : ''
        };
      });
      const hiddenText = product.price_hidden_reason === 'login_required' ? '登录后可见' : '审核通过后可见';
      const imgs = product.image_urls || [];
      this.setData({
        skus,
        thumbUrl: thumbImage(imgs.length ? imgs[0] : (product.image_url || '')),
        shortTitle: (product.name || '').slice(0, 2),
        subtotalText: sum.toFixed(2),
        hasVisiblePrice,
        priceHiddenText: hiddenText
      });
    }
  },

  methods: {
    noop() {},
    onClose() {
      this.triggerEvent('close');
    },
    onGoCart() {
      this.triggerEvent('close');
      wx.switchTab({ url: '/pages/cart/index' });
    },
    onSkuQtyChange(e) {
      const skuId = Number(e.currentTarget.dataset.skuId);
      const quantity = Number(e.detail.value) || 0;
      this.triggerEvent('change', { skuId, quantity });
    }
  }
});
