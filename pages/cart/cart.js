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
  
  // 下拉刷新
  onPullDownRefresh() {
    this.syncCartFromBackend();
  },
  
  // 从后端同步购物车数据
  syncCartFromBackend() {
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.apiBase + '/cart',
      method: 'GET',
      header: {
        'token': token
      },
      success: (res) => {
        if (res.data.code === 200) {
          // 确保backendCart是数组，如果不是数组则转换为空数组
          const backendData = res.data.data;
          const backendCart = Array.isArray(backendData) ? backendData : [];
          const localCart = wx.getStorageSync('cart') || [];
          
          // 创建本地购物车的映射
          const localCartMap = {};
          localCart.forEach(item => {
            const key = `${item.product_id}_${item.sku_id}`;
            localCartMap[key] = item;
          });
          
          // 创建后端购物车的映射
          const backendCartMap = {};
          backendCart.forEach(item => {
            const key = `${item.product_id}_${item.sku_id}`;
            backendCartMap[key] = item;
          });
          
          // 找出后端有但本地没有的商品
          const newItems = [];
          backendCart.forEach(backendItem => {
            const key = `${backendItem.product_id}_${backendItem.sku_id}`;
            if (!localCartMap[key]) {
              newItems.push(backendItem);
            }
          });
          
          // 找出本地有但后端没有的商品，上传到后端
          const uploadItems = [];
          localCart.forEach(localItem => {
            const key = `${localItem.product_id}_${localItem.sku_id}`;
            if (!backendCartMap[key]) {
              uploadItems.push(localItem);
            }
          });
          
          // 上传本地有但后端没有的商品
          uploadItems.forEach(item => {
            this.uploadCartItem(item);
          });
          
          if (newItems.length > 0 && uploadItems.length > 0) {
            // 将新商品添加到本地购物车
            const mergedCart = [...localCart, ...newItems];
            wx.setStorageSync('cart', mergedCart);
            wx.showToast({
              title: `同步${newItems.length}件，上传${uploadItems.length}件`,
              icon: 'success'
            });
          } else if (newItems.length > 0) {
            // 将新商品添加到本地购物车
            const mergedCart = [...localCart, ...newItems];
            wx.setStorageSync('cart', mergedCart);
            wx.showToast({
              title: `成功同步${newItems.length}件商品`,
              icon: 'success'
            });
          } else if (uploadItems.length > 0) {
            wx.showToast({
              title: `成功上传${uploadItems.length}件商品`,
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '购物车已是最新',
              icon: 'none'
            });
          }
          
          // 刷新页面显示
          this.loadCart();
        } else {
          wx.showToast({
            title: '同步失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('同步购物车失败:', error);
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      },
      complete: () => {
        // 停止下拉刷新
        wx.stopPullDownRefresh();
      }
    });
  },
  
  // 上传购物车商品到后端
  uploadCartItem(item) {
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.apiBase + '/cart',
      method: 'POST',
      header: {
        'token': token
      },
      data: {
        product_id: item.product_id,
        sku_id: item.sku_id,
        count: item.count,
        sku_selling_price: item.sku_selling_price
      },
      success: (res) => {
        console.log('上传购物车商品成功:', res.data);
      },
      fail: (error) => {
        console.error('上传购物车商品失败:', error);
      }
    });
  },
  
  // 从后端删除购物车商品
  deleteCartItemFromBackend(productId, skuId) {
    const token = wx.getStorageSync('token');
    wx.request({
      url: `${getApp().globalData.apiBase}/cart/${skuId}`,
      method: 'DELETE',
      header: {
        'token': token
      },
      success: (res) => {
        console.log('删除后端购物车商品成功:', res.data);
      },
      fail: (error) => {
        console.error('删除后端购物车商品失败:', error);
      }
    });
  },

  loadCart() {
    let cart = wx.getStorageSync('cart') || [];
    // 为每个商品添加checked属性和计算总价
    cart = cart.map(item => ({
      ...item,
      checked: true,
      totalPrice: (item.sku_selling_price * item.count).toFixed(1)
    }));
    this.setData({ cart });
    this.calculateTotal();
    this.checkAllStatus();
  },

  toggleChecked(e) {
    const { id, skuId } = e.currentTarget.dataset;
    const cart = this.data.cart.map(item => {
      if (item.product_id === id && item.sku_id === skuId) {
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
    const totalPrice = selectedItems.reduce((total, item) => total + item.sku_selling_price * item.count, 0);
    const selectedCount = selectedItems.reduce((count, item) => count + item.count, 0);
    this.setData({
      totalPrice: totalPrice.toFixed(1),
      selectedCount: selectedCount
    });
  },

  increaseCount(e) {
    const { id, skuId } = e.currentTarget.dataset;
    const cart = this.data.cart.map(item => {
      if (item.product_id === id && item.sku_id === skuId) {
        const newCount = item.count + 1;
        return { 
          ...item, 
          count: newCount,
          totalPrice: (item.sku_selling_price * newCount).toFixed(1)
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
      if (item.product_id === id && item.sku_id === skuId && item.count > 1) {
        const newCount = item.count - 1;
        return { 
          ...item, 
          count: newCount,
          totalPrice: (item.sku_selling_price * newCount).toFixed(1)
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
          // 删除本地购物车
          const cart = this.data.cart.filter(item => !(item.product_id === id && item.sku_id === skuId));
          this.setData({ cart });
          wx.setStorageSync('cart', cart);
          this.calculateTotal();
          this.checkAllStatus();
          
          // 删除后端购物车商品
          this.deleteCartItemFromBackend(id, skuId);
          
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

  onDeleteDialogTap(e) {
    const index = e.detail.index;
    if (index === 1) {
      // 点击确定按钮
      const { deleteGoodsId, deleteGoodsSkuId } = this.data;
      const cart = this.data.cart.filter(item => !(item.id === deleteGoodsId && item.sku_id === deleteGoodsSkuId));
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
    
    const orderData = checkedItems.map(item => ({
      product_id: item.product_id,
      sku_id: item.sku_id,
      count: item.count,
      sku_selling_price: item.sku_selling_price
    }));

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
            time: res.data.data.created_at || time(),
            items: checkedItems,
            totalPrice: this.data.total_amount,
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
