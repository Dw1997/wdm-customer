// goodsDetail.js
Page({
  data: {
    units: ['斤', '件', '袋'],
    goods: {
      id: 1,
      name: '八角茴香',
      price: 38.00,
      unit: '斤',
      skuId: 1,
      prices: {
        '斤': 38.00,
        '件': 380.00,
        '袋': 40.00
      },
      description: '八角茴香是一种常用的香料，具有浓郁的香气，常用于烹饪中增加风味。精选优质原料，品质保证。',
      specs: '500g/包',
      tags: ['热销', '品质保证', '批发价'],
      images: [
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=star%20anise%20spice%20in%20package&image_size=square',
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=star%20anise%20spice%20close%20up&image_size=square',
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=star%20anise%20spice%20in%20bowl&image_size=square'
      ],
      detailImages: [
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=spice%20shop%20interior%20display&image_size=landscape_16_9',
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=herbs%20and%20spices%20collection&image_size=landscape_16_9'
      ]
    },
    count: 1,
    cartCount: 0,
    cartItems: [],
    cartTotalPrice: '0.00',
    showShareDialog: false,
    showQuantityDialog: false,
    showCartPreviewDialog: false,
    dialogCount: 1,
    dialogUnitIndex: 0,
    dialogUnit: '斤',
    currentAction: '',
    tipMsg: '',
    tipType: 'success',
    showTip: false
  },

  onLoad(options) {
    const goodsId = options.id;
    this.getGoodsDetail(goodsId);
    this.loadCartCount();
  },

  // 从接口获取商品详情
  getGoodsDetail(goodsId) {
    wx.showLoading({
      title: '加载中...'
    });
    
    wx.request({
      url: `${getApp().globalData.apiBase}/goods/${goodsId}`,
      method: 'GET',
      success: (res) => {
        if (res.data.code === 200) {
          const goodsData = res.data.data;
          // 处理数据结构
          const goods = {
            id: goodsData.id,
            name: goodsData.name,
            description: goodsData.description || '',
            images: goodsData.images || [],
            detailImages: goodsData.sub_images || [],
            tags: goodsData.tags && goodsData.tags.length > 0 ? goodsData.tags : ['热销', '品质保证', '批发价'],
            skus: goodsData.skus || []
          };
          
          // 设置默认SKU
          const defaultSku = goods.skus.find(sku => sku.sku_is_default) || goods.skus[0];
          if (defaultSku) {
            goods.price = defaultSku.sku_selling_price;
            goods.unit = defaultSku.sku_unit;
            goods.skuId = defaultSku.sku_id;
          }
          
          this.setData({
            goods,
            dialogUnit: goods.unit || '斤',
            dialogUnitIndex: this.data.units.indexOf(goods.unit || '斤')
          });
        } else {
          this.showTipMsg(res.data.message || '获取商品详情失败', 'error');
        }
      },
      fail: (error) => {
        console.error('获取商品详情失败:', error);
        this.showTipMsg('网络错误', 'error');
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  onShow() {
    this.loadCartCount();
  },

  // 加载购物车数量
  loadCartCount() {
    const cart = wx.getStorageSync('cart') || [];
    const cartCount = cart.reduce((total, item) => total + item.count, 0);
    const cartTotalPrice = cart.reduce((total, item) => total + (item.sku_selling_price || item.price) * item.count, 0).toFixed(2);
    const cartItems = cart.map(item => ({
      ...item,
      totalPrice: ((item.sku_selling_price || item.price) * item.count).toFixed(2)
    }));
    this.setData({ cartCount, cartItems, cartTotalPrice });
  },

  // 显示购物车预览模态框
  showCartPreview() {
    this.loadCartCount();
    this.setData({
      showCartPreviewDialog: true
    });
  },

  // 关闭购物车预览模态框
  closeCartPreview() {
    this.setData({
      showCartPreviewDialog: false
    });
  },

  // 显示数量选择模态框
  showQuantityDialog() {
    this.setData({
      showQuantityDialog: true,
      dialogCount: this.data.count,
      dialogUnitIndex: this.data.units.indexOf(this.data.goods.unit),
      dialogUnit: this.data.goods.unit
    });
  },

  // 显示加入购物车模态框
  showAddCartDialog() {
    this.setData({
      currentAction: 'addCart'
    });
    this.showQuantityDialog();
  },

  // 显示立即购买模态框
  showBuyNowDialog() {
    this.setData({
      currentAction: 'buyNow'
    });
    this.showQuantityDialog();
  },

  // 模态框内增加数量
  dialogIncreaseCount() {
    this.setData({
      dialogCount: this.data.dialogCount + 1
    });
  },

  // 模态框内减少数量
  dialogDecreaseCount() {
    if (this.data.dialogCount > 1) {
      this.setData({
        dialogCount: this.data.dialogCount - 1
      });
    }
  },

  // 模态框内选择单位
  dialogChangeUnit(e) {
    const unitIndex = e.detail.value;
    const unit = this.data.units[unitIndex];
    const price = this.data.goods.prices ? this.data.goods.prices[unit] : this.data.goods.price;
    // 为不同单位设置不同的skuId
    let skuId = 1;
    if (unit === '件') {
      skuId = 2;
    } else if (unit === '袋') {
      skuId = 3;
    }
    this.setData({
      dialogUnitIndex: unitIndex,
      dialogUnit: unit,
      'goods.unit': unit,
      'goods.price': price,
      'goods.skuId': skuId
    });
  },

  // 模态框内选择SKU
  dialogChangeSku(e) {
    const unit = e.currentTarget.dataset.unit;
    const skuId = parseInt(e.currentTarget.dataset.skuId);
    const price = parseFloat(e.currentTarget.dataset.price);
    
    // 从购物车中获取当前SKU的数量
    const cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.id === this.data.goods.id && item.sku_id === skuId);
    const count = existingItem ? existingItem.count : 0;
    
    this.setData({
      dialogUnit: unit,
      'goods.unit': unit,
      'goods.price': price,
      'goods.skuId': skuId,
      dialogCount: count
    });
  },

  // 模态框按钮点击
  confirmQuantityDialog() {
    // 点击确定按钮
    this.setData({
      count: this.data.dialogCount,
      showQuantityDialog: false
    });
    
    // 根据当前操作类型执行相应功能
    if (this.data.currentAction === 'addCart') {
      this.addCart();
    } else if (this.data.currentAction === 'buyNow') {
      this.buyNow();
    }
  },

  // 关闭模态框
  closeQuantityDialog() {
    this.setData({
      showQuantityDialog: false
    });
  },

  increaseCount() {
    this.setData({
      count: this.data.count + 1
    });
  },

  decreaseCount() {
    if (this.data.count > 1) {
      this.setData({
        count: this.data.count - 1
    });
    }
  },

  // 阻止事件冒泡
  noop() {
    // 空函数，用于阻止事件冒泡
  },

  // 显示提示
  showTipMsg(msg, type = 'success') {
    this.setData({
      tipMsg: msg,
      tipType: type,
      showTip: true
    });
    setTimeout(() => {
      this.setData({ showTip: false });
    }, 2000);
  },

  addCart() {
    const goods = this.data.goods;
    const count = this.data.count;

    let cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.product_id === goods.id && item.sku_id === goods.skuId);

    if (existingItem) {
      existingItem.count += count;
      existingItem.sku_id = goods.skuId;
      existingItem.sku_selling_price = goods.price;
      existingItem.sku_specification = goods.specs;
      existingItem.sku_unit = goods.unit;
      existingItem.totalPrice = (goods.price * existingItem.count).toFixed(1);
    } else {
      cart.push({
        product_id: goods.id,
        code: goods.code,
        name: goods.name,
        image: goods.image,
        sku_id: goods.skuId,
        count: count,
        sku_selling_price: goods.price,
        sku_specification: goods.specs,
        sku_unit: goods.unit,
        totalPrice: (goods.price * count).toFixed(1)
      });
    }

    wx.setStorageSync('cart', cart);
    this.loadCartCount();
    this.showTipMsg('已加入购物车');
    
    // 上传到后端
    this.uploadCartToBackend(goods.id, goods.skuId, existingItem ? existingItem.count : count, goods.price);
  },

  uploadCartToBackend(goodsId, skuId, count, price) {
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.apiBase + '/cart',
      method: 'POST',
      header: {
        'token': token
      },
      data: {
        product_id: goodsId,
        sku_id: skuId,
        count: count,
        sku_selling_price: price
      },
      success: (res) => {
        console.log('Cart upload success:', res.data);
      },
      fail: (error) => {
        console.error('Cart upload failed:', error);
      }
    });
  },

  buyNow() {
    const goods = this.data.goods;
    const count = this.data.count;

    // 上传到后端
    wx.request({
      url: getApp().globalData.apiBase + '/order/buynow',
      method: 'POST',
      data: {
        product_id: goods.id,
        sku_id: goods.skuId,
        count: count,
        sku_selling_price: goods.price
      },
      success: (res) => {
        console.log('Buy now success:', res.data);
      },
      fail: (error) => {
        console.error('Buy now failed:', error);
      }
    });

    // 生成订单数据
    const order = {
      id: Date.now(),
      time: new Date().toLocaleString(),
      items: [{ ...goods, count, totalPrice: (goods.price * count).toFixed(1) }],
      totalPrice: (goods.price * count).toFixed(1),
      status: '待处理'
    };

    // 保存订单
    let orders = wx.getStorageSync('orders') || [];
    orders.unshift(order);
    wx.setStorageSync('orders', orders);

    this.showTipMsg('订单提交成功');

    // 跳转到订单页面
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/order/order'
      });
    }, 1500);
  },

  // 跳转到购物车
  goToCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    });
  },

  // 分享商品
  shareGoods() {
    this.setData({ showShareDialog: true });
  },

  // 关闭分享弹窗
  closeShareDialog() {
    this.setData({ showShareDialog: false });
  },

  // 分享给好友
  shareToFriend() {
    this.closeShareDialog();
    const goods = this.data.goods;
    wx.shareAppMessage({
      title: goods.name || '商品分享',
      path: `/pages/goodsDetail/goodsDetail?id=${goods.id || 1}`,
      imageUrl: goods.images && goods.images[0] ? goods.images[0] : ''
    });
  },

  // 分享到朋友圈
  shareToTimeline() {
    this.closeShareDialog();
    const goods = this.data.goods;
    wx.shareTimeline({
      title: goods.name || '商品分享',
      imageUrl: goods.images && goods.images[0] ? goods.images[0] : ''
    });
  },

  // 用户点击右上角分享
  onShareAppMessage() {
    const goods = this.data.goods;
    return {
      title: goods.name || '商品分享',
      path: `/pages/goodsDetail/goodsDetail?id=${goods.id || 1}`,
      imageUrl: goods.images && goods.images[0] ? goods.images[0] : ''
    };
  }
})
