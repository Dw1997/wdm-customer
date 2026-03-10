// index.js
Page({
  data: {
    units: ['斤', '件', '袋'],
    banners: [
      {
        id: 1,
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=spice%20shop%20banner%20with%20herbs%20and%20spices%20display&image_size=landscape_16_9'
      },
      {
        id: 2,
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=dried%20food%20products%20banner%20for%20wholesale&image_size=landscape_16_9'
      },
      {
        id: 3,
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=soy%20products%20display%20banner%20in%20market&image_size=landscape_16_9'
      }
    ],
    recommendedGoods: [
      {
        id: 1,
        name: '八角茴香',
        price: 38.00,
        unit: '斤',
        specs: '500g/包',
        prices: {
          '斤': 38.00,
          '件': 380.00,
          '袋': 40.00
        },
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=star%20anise%20spice%20in%20package&image_size=square'
      },
      {
        id: 2,
        name: '桂皮',
        price: 25.00,
        unit: '斤',
        specs: '500g/包',
        prices: {
          '斤': 25.00,
          '件': 250.00,
          '袋': 27.00
        },
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinnamon%20sticks%20spice&image_size=square'
      },
      {
        id: 3,
        name: '香叶',
        price: 45.00,
        unit: '斤',
        specs: '500g/包',
        prices: {
          '斤': 45.00,
          '件': 450.00,
          '袋': 48.00
        },
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=bay%20leaves%20spice&image_size=square'
      },
      {
        id: 4,
        name: '大豆',
        price: 5.80,
        unit: '斤',
        specs: '500g/包',
        prices: {
          '斤': 5.80,
          '件': 58.00,
          '袋': 6.00
        },
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=soybeans%20dried%20legumes&image_size=square'
      }
    ]
  },

  onLoad() {
    // 加载购物车数据
    const cart = wx.getStorageSync('cart') || [];
    // 更新商品的数量
    const recommendedGoods = this.data.recommendedGoods.map(goods => {
      const cartItem = cart.find(item => item.id === goods.id);
      return {
        ...goods,
        count: cartItem ? cartItem.count : 0
      };
    });
    this.setData({ recommendedGoods });
  },

  goToGoodsDetail(e) {
    const goodsId = e.currentTarget.dataset.id;
    console.log('Go to goods detail', goodsId);
    wx.navigateTo({
      url: '/pages/goodsDetail/goodsDetail?id=' + goodsId,
      success: function(res) {
        console.log('Navigate success', res);
      },
      fail: function(res) {
        console.log('Navigate fail', res);
      }
    });
  },

  increaseCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    this.updateGoodsCount(goodsId, 1);
  },

  decreaseCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    this.updateGoodsCount(goodsId, -1);
  },

  updateGoodsCount(goodsId, change) {
    const recommendedGoods = this.data.recommendedGoods.map(goods => {
      if (goods.id === goodsId) {
        const newCount = Math.max(0, (goods.count || 0) + change);
        // 更新购物车
        this.updateCart(goodsId, newCount);
        console.log('Updated count for goods', goodsId, 'to', newCount);
        return { ...goods, count: newCount };
      }
      return goods;
    });
    this.setData({ recommendedGoods }, () => {
      console.log('Set data completed', this.data.recommendedGoods);
    });
  },

  updateCart(goodsId, count) {
    let cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.id === goodsId);
    
    if (count > 0) {
      if (existingItem) {
        existingItem.count = count;
      } else {
        const goods = this.data.recommendedGoods.find(item => item.id === goodsId);
        cart.push({ ...goods, count });
      }
    } else {
      cart = cart.filter(item => item.id !== goodsId);
    }
    
    wx.setStorageSync('cart', cart);
  },

  changeUnit(e) {
    const goodsId = e.currentTarget.dataset.id;
    const unit = e.detail.value;
    const recommendedGoods = this.data.recommendedGoods.map(goods => {
      if (goods.id === goodsId) {
        const newPrice = goods.prices[unit];
        return { ...goods, unit, price: newPrice };
      }
      return goods;
    });
    this.setData({ recommendedGoods });
    console.log('Change unit for goods', goodsId, 'to', unit);
  },

  // 搜索功能
  onSearch(e) {
    const keyword = e.detail.value;
    if (!keyword.trim()) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }
    
    wx.showToast({
      title: '搜索: ' + keyword,
      icon: 'none'
    });
    
    // 这里可以实现搜索逻辑
    console.log('搜索关键词:', keyword);
  }
})