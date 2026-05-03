// order.js
Page({
  data: {
    orders: [],
    loading: false,
    status: ''
  },

  onLoad(options) {
    if (options && options.status) {
      this.setData({ status: options.status });
    }
    this.checkLogin();
  },

  onShow() {
    this.checkLogin();
  },

  checkLogin() {
    const isLogin = wx.getStorageSync('isLogin') || false;
    
    if (!isLogin) {
      // 未登录，跳转到登录页面
      wx.redirectTo({
        url: '/pages/login/login?from=order'
      });
    } else {
      this.loadOrders();
    }
  },

  loadOrders() {
    this.setData({ loading: true });
    
    // 从后端获取订单数据
    const token = wx.getStorageSync('token');
    const { status } = this.data;
    
    // 根据状态构建API地址
    let apiUrl = getApp().globalData.baseUrl + '/orders?page=1&limit=10';
    if (status === 'month') {
      apiUrl += '&type=month';
    } else if (status === 'unsettled') {
      apiUrl += '&status=unsettled';
    }
    
    wx.request({
      url: apiUrl,
      method: 'GET',
      header: {
        'token': token,
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.data.code === 200) {
          // 确保backendOrders是数组，如果不是数组（包括空对象）则转换为空数组
          const backendData = res.data.data;
          const backendOrders = Array.isArray(backendData) ? backendData : [];
          
          // 转换后端数据为前端格式
          const orders = backendOrders.map(order => ({
            id: order.order_id,
            time: order.create_at,
            status: this.getStatusText(order.status),
            paymentStatus: order.payment_status,
            paymentStatusText: order.delivery_status === 'cancelled' ? '无需支付' : this.getPaymentStatusText(order.payment_status),
            deliveryStatus: order.delivery_status,
            deliveryStatusText: this.getDeliveryStatusText(order.delivery_status),
            totalPrice: order.total_amount,
            items: order.items.map(item => ({
              id: item.product_id || 0,
              name: item.product_name,
              unit: item.sku_unit,
              price: item.sku_selling_price,
              count: item.quantity,
              totalPrice: (item.sku_selling_price * item.quantity).toFixed(1)
            }))
          }));
          
          // 保存到本地存储
          wx.setStorageSync('orders', orders);
          this.setData({ 
            orders: orders,
            loading: false
          });
        } else {
          console.error('Failed to load orders from backend:', res.data.message);
          this.setData({ 
            orders: [],
            loading: false
          });
          wx.showToast({
            title: '获取订单失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('Failed to load orders:', error);
        this.setData({ 
          orders: [],
          loading: false
        });
        wx.showToast({
          title: '网络异常，无法获取订单',
          icon: 'none'
        });
      }
    });
  },
  
  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'pending_payment': '待支付',
      'partial_paid': '部分支付',
      'completed': '完成',
      'cancelled': '取消',
      'pending_delivery': '待配送',
      'delivered': '已送达'
    };
    return statusMap[status] || status;
  },
  
  // 获取支付状态文本
  getPaymentStatusText(paymentStatus) {
    const statusMap = {
      'unpaid': '未支付',
      'partial_paid': '部分支付',
      'paid': '已支付',
      'cancelled': '已取消'
    };
    return statusMap[paymentStatus] || paymentStatus;
  },
  
  // 获取配送状态文本
  getDeliveryStatusText(deliveryStatus) {
    const statusMap = {
      'pending_delivery': '待配送',
      'delivering': '配送中',
      'delivered': '已送达',
      'cancelled': '已取消'
    };
    return statusMap[deliveryStatus] || deliveryStatus;
  },

  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 获取状态颜色
  getStatusColor(status) {
    const statusColors = {
      '已支付': '#4caf50',
      '已送达': '#4caf50',
      '未送达': '#ff9800',
      '已送达未支付': '#ff9800',
      '已取消': '#999999',
      '部分退款': '#ff5722',
      '待处理': '#003183',
      '处理中': '#ff9800',
      '已完成': '#4caf50'
    };
    return statusColors[status] || '#003183';
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/orderDetail/orderDetail?id=' + orderId
    });
  },

  // 跳转到商品详情
  goToGoodsDetail(e) {
    const goodsId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/goodsDetail/goodsDetail?id=' + goodsId
    });
  },

  // 取消订单
  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    // 获取订单数据
    const order = this.data.orders.find(o => o.id === orderId);
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？取消后订单内商品将放回购物车。',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token');
          wx.request({
            url: `${getApp().globalData.baseUrl}/orders/${orderId}/cancel`,
            method: 'POST',
            header: {
              'token': token,
              'content-type': 'application/json'
            },
            success: (res) => {
              if (res.data.code === 200) {
                // 将订单商品放回购物车
                this.addOrderItemsToCart(order);
                this.loadOrders();
                wx.showToast({
                  title: '订单已取消，商品已放回购物车',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.data.message || '取消失败',
                  icon: 'none'
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '取消失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },
  
  // 将订单商品添加到购物车
  addOrderItemsToCart(order) {
    if (!order || !order.items) return;
    
    let cart = wx.getStorageSync('cart') || [];
    
    order.items.forEach(item => {
      const existingItem = cart.find(cartItem => 
        cartItem.product_id === item.product_id && cartItem.sku_id === item.sku_id
      );
      
      if (existingItem) {
        // 如果购物车中已有该商品，增加数量
        existingItem.count = (existingItem.count || 0) + (item.count || item.quantity || 0);
      } else {
        // 如果购物车中没有该商品，添加新商品
        cart.push({
          product_id: item.product_id,
          sku_id: item.sku_id,
          name: item.name || item.product_name,
          count: item.count || item.quantity || 0,
          price: item.price || item.sku_selling_price || 0,
          image: item.image,
          sku_unit: item.unit || item.sku_unit,
          sku_specification: item.sku_specification,
          sku_selling_price: item.sku_selling_price || item.price || 0,
          selected: true
        });
      }
    });
    
    wx.setStorageSync('cart', cart);
  }
})
