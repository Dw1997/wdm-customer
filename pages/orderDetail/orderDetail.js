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
            paymentStatus: orderData.payment_status,
            paymentStatusText: orderData.delivery_status === 'cancelled' ? '无需支付' : this.getPaymentStatusText(orderData.payment_status),
            deliveryStatus: orderData.delivery_status,
            deliveryStatusText: this.getDeliveryStatusText(orderData.delivery_status),
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
  },
  
  // 取消订单
  cancelOrder() {
    const orderId = this.data.order.id;
    const order = this.data.order;
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？取消后订单内商品将放回购物车。',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token');
          wx.request({
            url: `${getApp().globalData.apiBase}/orders/${orderId}/cancel`,
            method: 'POST',
            header: {
              'token': token,
              'content-type': 'application/json'
            },
            success: (res) => {
              if (res.data.code === 200) {
                // 将订单商品放回购物车
                this.addOrderItemsToCart(order);
                wx.showToast({
                  title: '订单已取消，商品已放回购物车',
                  icon: 'success'
                });
                // 返回上一页并刷新订单列表
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
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
});
