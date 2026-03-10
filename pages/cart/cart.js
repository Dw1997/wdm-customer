// cart.js
Page({
  data: {
    cart: [],
    allChecked: false,
    totalPrice: 0,
    selectedCount: 0,
    showDeleteDialog: false,
    deleteGoodsId: null,
    slideButtons: [
      {
        text: '删除',
        type: 'warn',
        extClass: 'delete-btn'
      }
    ],
    dialogButtons: [
      { text: '取消', type: 'default' },
      { text: '确定', type: 'primary' }
    ]
  },

  onLoad() {
    this.loadCart();
  },

  onShow() {
    this.loadCart();
  },

  loadCart() {
    let cart = wx.getStorageSync('cart') || [];
    // 为每个商品添加checked属性和计算总价
    cart = cart.map(item => ({
      ...item,
      checked: true,
      totalPrice: (item.price * item.count).toFixed(2)
    }));
    this.setData({ cart });
    this.calculateTotal();
    this.checkAllStatus();
  },

  toggleChecked(e) {
    const goodsId = e.currentTarget.dataset.id;
    const cart = this.data.cart.map(item => {
      if (item.id === goodsId) {
        return { ...item, checked: !item.checked };
      }
      return item;
    });
    this.setData({ cart });
    this.calculateTotal();
    this.checkAllStatus();
  },

  toggleAllChecked(e) {
    // 微信小程序的checkbox组件，当选中时e.detail.value是一个数组，包含value值
    // 当未选中时e.detail.value是空数组
    const allChecked = e.detail.value.length > 0;
    const cart = this.data.cart.map(item => ({
      ...item,
      checked: allChecked
    }));
    this.setData({ cart, allChecked });
    // 保存到本地存储
    wx.setStorageSync('cart', cart);
    this.calculateTotal();
    console.log('Toggle all checked:', allChecked);
  },

  checkAllStatus() {
    const allChecked = this.data.cart.every(item => item.checked);
    this.setData({ allChecked });
  },

  calculateTotal() {
    const selectedItems = this.data.cart.filter(item => item.checked);
    const totalPrice = selectedItems.reduce((total, item) => total + item.price * item.count, 0);
    const selectedCount = selectedItems.reduce((count, item) => count + item.count, 0);
    this.setData({
      totalPrice: totalPrice.toFixed(2),
      selectedCount: selectedCount
    });
  },

  increaseCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    const cart = this.data.cart.map(item => {
      if (item.id === goodsId) {
        const newCount = item.count + 1;
        return { 
          ...item, 
          count: newCount,
          totalPrice: (item.price * newCount).toFixed(2)
        };
      }
      return item;
    });
    this.setData({ cart });
    wx.setStorageSync('cart', cart);
    this.calculateTotal();
  },

  decreaseCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    const cart = this.data.cart.map(item => {
      if (item.id === goodsId && item.count > 1) {
        const newCount = item.count - 1;
        return { 
          ...item, 
          count: newCount,
          totalPrice: (item.price * newCount).toFixed(2)
        };
      }
      return item;
    });
    this.setData({ cart });
    wx.setStorageSync('cart', cart);
    this.calculateTotal();
  },

  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 右划按钮点击
  slideButtonTap(e) {
    const goodsId = e.currentTarget.dataset.id;
    this.setData({
      showDeleteDialog: true,
      deleteGoodsId: goodsId
    });
  },

  // 右划删除
  showDeleteDialog(e) {
    const goodsId = e.currentTarget.dataset.id;
    this.setData({
      showDeleteDialog: true,
      deleteGoodsId: goodsId
    });
  },

  onDeleteDialogTap(e) {
    const index = e.detail.index;
    if (index === 1) {
      // 点击确定按钮
      const cart = this.data.cart.filter(item => item.id !== this.data.deleteGoodsId);
      this.setData({ cart, showDeleteDialog: false });
      wx.setStorageSync('cart', cart);
      this.calculateTotal();
      this.checkAllStatus();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
    } else {
      // 点击取消按钮
      this.setData({ showDeleteDialog: false });
    }
  },

  goToGoodsDetail(e) {
    const goodsId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/goodsDetail/goodsDetail?id=${goodsId}`
    });
  },

  submitOrder() {
    const checkedItems = this.data.cart.filter(item => item.checked);
    if (checkedItems.length === 0) {
      wx.showToast({
        title: '请选择要结算的商品',
        icon: 'none'
      });
      return;
    }

    // 生成订单数据
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const time = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    const order = {
      id: Date.now(),
      time: time,
      items: checkedItems,
      totalPrice: this.data.totalPrice,
      status: '待处理'
    };

    // 保存订单
    let orders = wx.getStorageSync('orders') || [];
    orders.unshift(order); // 新订单放在最前面
    wx.setStorageSync('orders', orders);

    // 清空购物车中已结算的商品
    const remainingCart = this.data.cart.filter(item => !item.checked);
    wx.setStorageSync('cart', remainingCart);

    // 跳转到订单页面
    wx.switchTab({
      url: '/pages/order/order'
    });

    wx.showToast({
      title: '订单提交成功',
      icon: 'success'
    });
  }
})