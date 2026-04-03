// pages/cart/cart.js
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
    ],
    submitting: false
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
      totalPrice: (item.price * item.count).toFixed(1)
    }));
    this.setData({ cart });
    this.calculateTotal();
    this.checkAllStatus();
  },

  toggleChecked(e) {
    const { id, skuId } = e.currentTarget.dataset;
    const cart = this.data.cart.map(item => {
      if (item.id === id && item.skuId === skuId) {
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
      totalPrice: totalPrice.toFixed(1),
      selectedCount: selectedCount
    });
  },

  increaseCount(e) {
    const { id, skuId } = e.currentTarget.dataset;
    const cart = this.data.cart.map(item => {
      if (item.id === id && item.skuId === skuId) {
        const newCount = item.count + 1;
        return { 
          ...item, 
          count: newCount,
          totalPrice: (item.price * newCount).toFixed(1)
        };
      }
      return item;
    });
    this.setData({ cart });
    wx.setStorageSync('cart', cart);
    this.calculateTotal();
  },

  decreaseCount(e) {
    const { id, skuId } = e.currentTarget.dataset;
    const cart = this.data.cart.map(item => {
      if (item.id === id && item.skuId === skuId && item.count > 1) {
        const newCount = item.count - 1;
        return { 
          ...item, 
          count: newCount,
          totalPrice: (item.price * newCount).toFixed(1)
        };
      }
      return item;
    });
    this.setData({ cart });
    wx.setStorageSync('cart', cart);
    this.calculateTotal();
  },

  deleteItem(e) {
    const { id, skuId } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          const cart = this.data.cart.filter(item => !(item.id === id && item.skuId === skuId));
          this.setData({ cart });
          wx.setStorageSync('cart', cart);
          this.calculateTotal();
          this.checkAllStatus();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 右划按钮点击
  slideButtonTap(e) {
    const { id, skuId } = e.currentTarget.dataset;
    this.setData({
      showDeleteDialog: true,
      deleteGoodsId: id,
      deleteGoodsSkuId: skuId
    });
  },

  // 右划删除
  showDeleteDialog(e) {
    const { id, skuId } = e.currentTarget.dataset;
    this.setData({
      showDeleteDialog: true,
      deleteGoodsId: id,
      deleteGoodsSkuId: skuId
    });
  },

  onDeleteDialogTap(e) {
    const index = e.detail.index;
    if (index === 1) {
      // 点击确定按钮
      const { deleteGoodsId, deleteGoodsSkuId } = this.data;
      const cart = this.data.cart.filter(item => !(item.id === deleteGoodsId && item.skuId === deleteGoodsSkuId));
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
    const isLogin = wx.getStorageSync('isLogin') || false;
    
    if (!isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再结算',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login?from=cart'
            });
          }
        }
      });
      return;
    }

    const checkedItems = this.data.cart.filter(item => item.checked);
    if (checkedItems.length === 0) {
      wx.showToast({
        title: '请选择要结算的商品',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交订单中...' });

    // 生成订单数据
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const time = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    const orderData = {
      items: checkedItems.map(item => ({
        goods_id: item.id,
        sku_id: item.skuId,
        quantity: item.count,
        price: item.price
      })),
      total_price: this.data.totalPrice,
      order_time: time
    };

    // 发送请求到后端
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.apiBase + '/submitOrder',
      method: 'POST',
      header: {
        'token': token,
        'content-type': 'application/json'
      },
      data: orderData,
      success: (res) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        
        if (res.data.code === 200) {
          // 保存订单到本地
          const order = {
            id: res.data.data.order_id || Date.now(),
            time: time,
            items: checkedItems,
            totalPrice: this.data.totalPrice,
            status: '待处理'
          };

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
        } else if (res.data.code === 401 || res.data.code === 402 || res.data.code === 403) {
          // 登录失败，跳转到登录页面
          wx.removeStorageSync('token');
          wx.removeStorageSync('isLogin');
          wx.showModal({
            title: '登录过期',
            content: '请重新登录',
            confirmText: '去登录',
            success: (res) => {
              if (res.confirm) {
                wx.redirectTo({
                  url: '/pages/login/login?from=cart'
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: res.data.message || '订单提交失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  }
})
