// pages/orderDetail/orderDetail.js
Page({
  data: {
    order: null,
    loading: true,
    error: false
  },

  onLoad(options) {
    const orderId = options.id;
    if (orderId) {
      this.loadOrderDetail(orderId);
    } else {
      this.setData({ error: true, loading: false });
    }
  },

  loadOrderDetail(orderId) {
    const id = orderId || this.data.order?.id;
    if (!id) {
      this.setData({ error: true, loading: false });
      return;
    }
    
    this.setData({ loading: true, error: false });
    
    // 从后端获取订单详情
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.apiBase + `/orders/${id}`,
      method: 'GET',
      header: {
        'token': token,
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.data.code === 200) {
          const orderData = res.data.data;
          // 转换数据格式
          const order = {
            id: orderData.ordder_id,
            totalPrice: orderData.total_amount,
            status: this.getStatusText(orderData.status),
            createTime: orderData.create_at,
            orderType: orderData.order_type === 'delivered' ? '已送订单' : '预送订单',
            invoicePath: orderData.invoice_path,
            itemsCount: orderData.items_count,
            items: orderData.items.map(item => ({
              product_id: item.product_id,
              product_name: item.product_name,
              sku_unit: item.sku_unit,
              sku_specification: item.sku_specification,
              sku_selling_price: item.sku_selling_price,
              quantity: item.quantity,
              image: item.image,
              totalPrice: (item.sku_selling_price * item.quantity).toFixed(1)
            }))
          };
          this.setData({ order, loading: false });
        } else {
          this.setData({ error: true, loading: false });
        }
      },
      fail: (error) => {
        console.error('Failed to load order detail:', error);
        this.setData({ error: true, loading: false });
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

  // 查看销售单图片
  viewInvoice() {
    if (this.data.order && this.data.order.invoicePath) {
      wx.previewImage({
        urls: [this.data.order.invoicePath]
      });
    }
  },

  // 跳转到商品详情
  goToGoodsDetail(e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/goodsDetail/goodsDetail?id=${productId}`
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});
