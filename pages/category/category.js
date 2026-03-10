// category.js
Page({
  data: {
    units: ['斤', '件', '袋'],
    categories: [
      { id: 1, name: '香料大全' },
      { id: 2, name: '草药类' },
      { id: 3, name: '豆制品' }
    ],
    activeCategory: 1,
    currentCategoryName: '香料大全',
    goods: {
      1: [
        { id: 1, name: '八角茴香', price: 38.00, unit: '斤', specs: '500g/包', prices: { '斤': 38.00, '件': 380.00, '袋': 40.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=star%20anise%20spice%20in%20package&image_size=square' },
        { id: 2, name: '桂皮', price: 25.00, unit: '斤', specs: '500g/包', prices: { '斤': 25.00, '件': 250.00, '袋': 27.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinnamon%20sticks%20spice&image_size=square' },
        { id: 3, name: '香叶', price: 45.00, unit: '斤', specs: '500g/包', prices: { '斤': 45.00, '件': 450.00, '袋': 48.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=bay%20leaves%20spice&image_size=square' },
        { id: 4, name: '花椒', price: 32.00, unit: '斤', specs: '500g/包', prices: { '斤': 32.00, '件': 320.00, '袋': 35.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Sichuan%20peppercorns%20spice&image_size=square' }
      ],
      2: [
        { id: 5, name: '枸杞', price: 68.00, unit: '斤', specs: '500g/包', prices: { '斤': 68.00, '件': 680.00, '袋': 70.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=goji%20berries%20dried%20herbs&image_size=square' },
        { id: 6, name: '红枣', price: 25.00, unit: '斤', specs: '500g/包', prices: { '斤': 25.00, '件': 250.00, '袋': 27.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=red%20dates%20dried%20herbs&image_size=square' },
        { id: 7, name: '桂圆', price: 35.00, unit: '斤', specs: '500g/包', prices: { '斤': 35.00, '件': 350.00, '袋': 38.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=longan%20dried%20herbs&image_size=square' }
      ],
      3: [
        { id: 8, name: '大豆', price: 5.80, unit: '斤', specs: '500g/包', prices: { '斤': 5.80, '件': 58.00, '袋': 6.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=soybeans%20dried%20legumes&image_size=square' },
        { id: 9, name: '豆腐皮', price: 12.00, unit: '斤', specs: '500g/包', prices: { '斤': 12.00, '件': 120.00, '袋': 13.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=tofu%20skin%20soy%20product&image_size=square' },
        { id: 10, name: '腐竹', price: 18.00, unit: '斤', specs: '500g/包', prices: { '斤': 18.00, '件': 180.00, '袋': 20.00 }, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=腐竹%20dried%20soy%20product&image_size=square' }
      ]
    },
    currentGoods: []
  },

  onLoad() {
    this.setCurrentGoods(1);
  },

  switchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find(cat => cat.id === categoryId);
    this.setData({ 
      activeCategory: categoryId,
      currentCategoryName: category ? category.name : ''
    });
    this.setCurrentGoods(categoryId);
  },

  setCurrentGoods(categoryId) {
    const goods = this.data.goods[categoryId];
    const cart = wx.getStorageSync('cart') || [];
    
    // 更新商品的数量
    const currentGoods = goods.map(item => {
      const cartItem = cart.find(cartItem => cartItem.id === item.id);
      return {
        ...item,
        count: cartItem ? cartItem.count : 0
      };
    });
    
    this.setData({ currentGoods });
  },

  goToGoodsDetail(e) {
    const goodsId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/goodsDetail/goodsDetail?id=${goodsId}`
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
    const currentGoods = this.data.currentGoods.map(goods => {
      if (goods.id === goodsId) {
        const newCount = Math.max(0, (goods.count || 0) + change);
        // 更新购物车
        this.updateCart(goodsId, newCount);
        return { ...goods, count: newCount };
      }
      return goods;
    });
    this.setData({ currentGoods });
  },

  updateCart(goodsId, count) {
    let cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.id === goodsId);
    
    if (count > 0) {
      if (existingItem) {
        existingItem.count = count;
      } else {
        // 查找商品信息
        let goods = null;
        for (const categoryId in this.data.goods) {
          const categoryGoods = this.data.goods[categoryId];
          const foundGoods = categoryGoods.find(item => item.id === goodsId);
          if (foundGoods) {
            goods = foundGoods;
            break;
          }
        }
        if (goods) {
          cart.push({ ...goods, count });
        }
      }
    } else {
      cart = cart.filter(item => item.id !== goodsId);
    }
    
    wx.setStorageSync('cart', cart);
  },

  changeUnit(e) {
    const goodsId = e.currentTarget.dataset.id;
    const unit = e.detail.value;
    const currentGoods = this.data.currentGoods.map(goods => {
      if (goods.id === goodsId) {
        const newPrice = goods.prices[unit];
        return { ...goods, unit, price: newPrice };
      }
      return goods;
    });
    this.setData({ currentGoods });
    console.log('Change unit for goods', goodsId, 'to', unit);
  }
})