const app = getApp();
const { updateCartItem, removeCartItem } = require('../../services/shop');
const { thumbImage } = require('../../utils/image');

Page({
  data: {
    fontClass: 'font-large',
    validItems: [],
    invalidItems: [],
    checkedMap: {},
    managing: false,
    allChecked: false,
    selectedKinds: 0,
    selectedQty: 0,
    selectedAmountText: '0.00'
  },

  async onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    await this.loadCart();
  },

  async loadCart() {
    const data = await app.refreshCartBadge();
    const rawItems = (data && data.items) || [];
    const checkedMap = { ...this.data.checkedMap };
    const validItems = [];
    const invalidItems = [];

    rawItems.forEach((it) => {
      const shortTitle = (it.name || '').slice(0, 2);
      const imageUrl = thumbImage(it.image_url);
      if (it.invalid_reason) {
        invalidItems.push({ ...it, image_url: imageUrl, shortTitle });
      } else {
        if (checkedMap[it.sku_id] === undefined) checkedMap[it.sku_id] = true;
        validItems.push({
          ...it,
          image_url: imageUrl,
          shortTitle,
          checked: !!checkedMap[it.sku_id],
          priceText: Number(it.price || 0).toFixed(2)
        });
      }
    });

    this.setData({ validItems, invalidItems, checkedMap }, () => this.recalc());
  },

  recalc() {
    const { validItems } = this.data;
    const selected = validItems.filter((x) => x.checked);
    const amount = selected.reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 0), 0);
    const qty = selected.reduce((s, x) => s + Number(x.quantity || 0), 0);
    this.setData({
      allChecked: validItems.length > 0 && selected.length === validItems.length,
      selectedKinds: selected.length,
      selectedQty: qty,
      selectedAmountText: amount.toFixed(2)
    });
  },

  toggleCheck(e) {
    const skuId = Number(e.currentTarget.dataset.skuId);
    const checkedMap = { ...this.data.checkedMap };
    checkedMap[skuId] = !checkedMap[skuId];
    const validItems = this.data.validItems.map((it) => ({
      ...it,
      checked: !!checkedMap[it.sku_id]
    }));
    this.setData({ checkedMap, validItems }, () => this.recalc());
  },

  toggleAll() {
    const next = !this.data.allChecked;
    const checkedMap = { ...this.data.checkedMap };
    const validItems = this.data.validItems.map((it) => {
      checkedMap[it.sku_id] = next;
      return { ...it, checked: next };
    });
    this.setData({ checkedMap, validItems }, () => this.recalc());
  },

  toggleManage() {
    this.setData({ managing: !this.data.managing });
  },

  async onQtyChange(e) {
    const skuId = Number(e.currentTarget.dataset.skuId);
    const quantity = Number(e.detail.value) || 0;
    if (quantity <= 0) {
      const res = await new Promise((resolve) => {
        wx.showModal({
          title: '移出购物车',
          content: '确定要将该商品移出购物车吗？',
          success: resolve
        });
      });
      if (!res.confirm) return;
      await removeCartItem(skuId);
    } else {
      await updateCartItem(skuId, quantity);
    }
    await this.loadCart();
  },

  async clearInvalid() {
    for (const inv of this.data.invalidItems) {
      await removeCartItem(inv.sku_id);
    }
    wx.showToast({ title: '已清空失效商品', icon: 'none' });
    await this.loadCart();
  },

  async onMainAction() {
    const selected = this.data.validItems.filter((x) => x.checked);
    if (!selected.length) return;
    if (this.data.managing) {
      for (const it of selected) {
        await removeCartItem(it.sku_id);
      }
      this.setData({ managing: false });
      wx.showToast({ title: '已删除所选商品', icon: 'none' });
      await this.loadCart();
      return;
    }
    wx.setStorageSync('wdm_checkout_items', selected);
    wx.navigateTo({ url: '/pages/checkout/index' });
  },

  goDetail(e) {
    const spuId = Number(e.currentTarget.dataset.spuId);
    if (!spuId) return;
    wx.navigateTo({ url: '/pages/product-detail/index?spu_id=' + spuId });
  },

  goCategory() {
    wx.switchTab({ url: '/pages/category/index' });
  }
});
