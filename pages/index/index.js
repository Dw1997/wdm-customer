// index.js
Page({
  data: {
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
    recommendedGoods: [],
    page: 1,
    limit: 10,
    hasMore: true,
    isLoading: false
  },

  onLoad() {
    // 加载推荐商品
    this.loadRecommendedGoods();
  },

  // 加载推荐商品
  loadRecommendedGoods(isLoadMore = false) {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    if (!isLoadMore) {
      wx.showLoading({
        title: '加载中...',
      });
    }
    
    const app = getApp();
    wx.request({
      url: app.globalData.baseUrl + '/goods/recommended',
      method: 'GET',
      data: {
        page: this.data.page,
        limit: this.data.limit
      },
      success: (res) => {
        if (!isLoadMore) {
          wx.hideLoading();
        }
        
        if (res.data.code === 200) {
          const goodsList = res.data.data;
          
          // 如果没有更多数据
          if (goodsList.length < this.data.limit) {
            this.setData({ hasMore: false });
          }
          
          // 转换数据格式
          const recommendedGoods = goodsList.map(item => {
            // 找到默认sku
            const defaultSku = item.skus.find(sku => sku.sku_is_default) || item.skus[0];
            // 提取所有单位
            const units = item.skus.map(sku => sku.sku_unit);
            // 构建价格对象
            const prices = {};
            // 构建规格对象
            const specsMap = {};
            // 构建sku_id映射
            const skuIdMap = {};
            item.skus.forEach(sku => {
              prices[sku.sku_unit] = sku.sku_selling_price;
              specsMap[sku.sku_unit] = sku.sku_specification && sku.sku_specification !== 'None' ? sku.sku_specification : '';
              skuIdMap[sku.sku_unit] = sku.sku_id;
            });
            
            return {
              id: item.id,
              code: item.code,
              name: item.name,
              price: defaultSku.sku_selling_price,
              unit: defaultSku.sku_unit,
              skuId: defaultSku.sku_id,
              specs: defaultSku.sku_specification && defaultSku.sku_specification !== 'None' ? defaultSku.sku_specification : '',
              prices: prices,
              units: units,
              specsMap: specsMap,
              skuIdMap: skuIdMap,
              image: item.image || 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=star%20anise%20spice%20in%20package&image_size=square',
              count: 0
            };
          });
          
          // 加载购物车数据
          const cart = wx.getStorageSync('cart') || [];
          // 更新商品的数量
          const goodsWithCount = recommendedGoods.map(goods => {
            const cartItem = cart.find(item => item.id === goods.id);
            return {
              ...goods,
              count: cartItem ? cartItem.count : 0
            };
          });
          
          // 合并数据（加载更多时）或替换数据（首次加载）
          const finalGoods = isLoadMore 
            ? [...this.data.recommendedGoods, ...goodsWithCount]
            : goodsWithCount;
          
          this.setData({ 
            recommendedGoods: finalGoods,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        if (!isLoadMore) {
          wx.hideLoading();
        }
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        console.error('Failed to load recommended goods:', err);
      }
    });
  },

  // 下拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadRecommendedGoods(true);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      recommendedGoods: []
    });
    this.loadRecommendedGoods();
    wx.stopPullDownRefresh();
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
    const unitIndex = e.detail.value;
    const recommendedGoods = this.data.recommendedGoods.map(goods => {
      if (goods.id === goodsId) {
        const unit = goods.units[unitIndex];
        const newPrice = goods.prices[unit];
        const newSpecs = goods.specsMap && goods.specsMap[unit] ? goods.specsMap[unit] : '';
        return { ...goods, unit, price: newPrice, specs: newSpecs };
      }
      return goods;
    });
    this.setData({ recommendedGoods });
    
    // 更新购物车中的商品信息
    this.updateCartItem(goodsId, unit, newPrice, newSpecs);
    
    console.log('Change unit for goods', goodsId, 'to', recommendedGoods.find(g => g.id === goodsId)?.unit);
  },
  
  updateCartItem(goodsId, unit, price, specs) {
    let cart = wx.getStorageSync('cart') || [];
    const cartItem = cart.find(item => item.id === goodsId);
    if (cartItem) {
      cartItem.unit = unit;
      cartItem.price = price;
      cartItem.specs = specs;
      cartItem.totalPrice = (price * cartItem.count).toFixed(2);
      wx.setStorageSync('cart', cart);
    }
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