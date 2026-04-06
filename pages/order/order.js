// order.js
Page({
  data: {
    orders: [],
    loading: false
  },

  onLoad() {
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
    wx.request({
      url: getApp().globalData.apiBase + '/orders?page=1&limit=10',
      method: 'GET',
      header: {
        'token': token,
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.data.code === 200) {
          const backendOrders = res.data.data || [];
          
          // 转换后端数据为前端格式
          const orders = backendOrders.map(order => ({
            id: order.order_id,
            time: order.create_at,
            status: this.getStatusText(order.status),
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
          // 如果后端获取失败，从本地存储获取
          let orders = wx.getStorageSync('orders') || [];
          
          // 格式化时间显示
          orders = orders.map(order => {
            if (order.time) {
              // 如果时间已经是格式化的，直接使用
              if (order.time.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                return order;
              }
              // 否则格式化时间
              const date = new Date(order.time);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const seconds = String(date.getSeconds()).padStart(2, '0');
              return {
                ...order,
                time: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
              };
            }
            return order;
          });
          
          // 按时间排序，最新的订单在最前面
          orders.sort((a, b) => new Date(b.time) - new Date(a.time));
          this.setData({ 
            orders: orders,
            loading: false
          });
        }
      },
      fail: (error) => {
        console.error('Failed to load orders:', error);
        // 失败时从本地存储获取
        let orders = wx.getStorageSync('orders') || [];
        
        // 格式化时间显示
        orders = orders.map(order => {
          if (order.time) {
            // 如果时间已经是格式化的，直接使用
            if (order.time.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
              return order;
            }
            // 否则格式化时间
            const date = new Date(order.time);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return {
              ...order,
              time: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
            };
          }
          return order;
        });
        
        // 按时间排序，最新的订单在最前面
        orders.sort((a, b) => new Date(b.time) - new Date(a.time));
        this.setData({ 
          orders: orders,
          loading: false
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
    wx.showToast({
      title: '查看订单详情',
      icon: 'none'
    });
    // 这里可以跳转到订单详情页
    // wx.navigateTo({
    //   url: '/pages/orderDetail/orderDetail?id=' + orderId
    // });
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
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      success: (res) => {
        if (res.confirm) {
          let orders = wx.getStorageSync('orders') || [];
          orders = orders.map(order => {
            if (order.id === orderId) {
              return { ...order, status: '已取消' };
            }
            return order;
          });
          wx.setStorageSync('orders', orders);
          this.loadOrders();
          wx.showToast({
            title: '订单已取消',
            icon: 'success'
          });
        }
      }
    });
  }
})
