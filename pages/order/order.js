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
