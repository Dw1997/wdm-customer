// category.js
Page({
  data: {
    categories: [],
    activeCategory: 0,
    currentCategoryName: '',
    currentGoods: [],
    page: 1,
    limit: 10,
    hasMore: true,
    hasPrevMore: false,
    isLoading: false,
    // 保存每个分类的分页状态
    categoryPagination: {}
  },

  onLoad() {
    // 加载分类列表
    this.loadCategories();
  },

  // 加载分类列表
  loadCategories() {
    wx.showLoading({
      title: '加载中...',
    });
    
    const app = getApp();
    // 注意：分类接口使用5001端口，与推荐商品接口不同
    wx.request({
      url: app.globalData.baseUrl + '/categories',
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        
        if (res.data.code === 200) {
          const categories = res.data.data;
          this.setData({ 
            categories,
            activeCategory: categories.length > 0 ? categories[0].id : 0,
            currentCategoryName: categories.length > 0 ? categories[0].name : ''
          });
          
          // 加载第一个分类的商品
          if (categories.length > 0) {
            this.setCurrentGoods(categories[0].id);
          }
        } else {
          wx.showToast({
            title: '加载分类失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        console.error('Failed to load categories:', err);
      }
    });
  },

  setCurrentGoods(categoryId, isLoadMore = false, checkNextCategory = false) {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    if (!isLoadMore) {
      wx.showLoading({
        title: '加载商品中...',
      });
    }
    
    const app = getApp();
    wx.request({
      url: app.globalData.baseUrl + `/goods/category/${categoryId}`,
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
          
          // 检查返回的数据是否为空数组或空对象
          const isEmpty = !goodsList || (Array.isArray(goodsList) && goodsList.length === 0) || (typeof goodsList === 'object' && Object.keys(goodsList).length === 0);
          const listLength = Array.isArray(goodsList) ? goodsList.length : 0;
          
          // 如果没有更多数据（商品数量小于limit）
          if (isEmpty || listLength < this.data.limit) {
            this.setData({ hasMore: false });
            
            // 如果是加载更多且接口返回空数据，尝试跳转到下一个分类
            if (isLoadMore && checkNextCategory && isEmpty) {
              // 延迟跳转，让用户看到最后一页商品
              setTimeout(() => {
                this.goToNextCategory();
              }, 500);
            }
          }
          
          // 转换数据格式
          let recommendedGoods = [];
          if (Array.isArray(goodsList) && goodsList.length > 0) {
            recommendedGoods = goodsList.map(item => {
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
          }
          
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
            ? [...this.data.currentGoods, ...goodsWithCount]
            : goodsWithCount;
          
          this.setData({ 
            currentGoods: finalGoods,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({
            title: '加载商品失败',
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
        console.error('Failed to load category goods:', err);
      }
    });
  },

  // 下拉加载更多
  onReachBottom() {
    if (this.data.isLoading) return;
    
    const newPage = this.data.page + 1;
    this.setData({
      page: newPage
    }, () => {
      // 总是发送请求，即使hasMore为false
      this.setCurrentGoods(this.data.activeCategory, true, true);
    });
  },

  // 跳转到下一个分类
  goToNextCategory() {
    const { categories, activeCategory } = this.data;
    const currentIndex = categories.findIndex(cat => cat.id === activeCategory);
    
    // 如果不是最后一个分类
    if (currentIndex < categories.length - 1) {
      const nextCategory = categories[currentIndex + 1];
      this.setData({ 
        activeCategory: nextCategory.id,
        currentCategoryName: nextCategory.name,
        page: 1,
        hasMore: true,
        currentGoods: []
      });
      this.setCurrentGoods(nextCategory.id);
    }
  },

  // 切换分类时重置分页
  switchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find(cat => cat.id === categoryId);
    this.setData({ 
      activeCategory: categoryId,
      currentCategoryName: category ? category.name : '',
      page: 1,
      hasMore: true,
      currentGoods: []
    });
    this.setCurrentGoods(categoryId);
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
    // 从currentGoods中查找商品信息，获取当前的unit和skuId
    const goods = this.data.currentGoods.find(item => item.id === goodsId);
    if (!goods) return;
    
    const existingItem = cart.find(item => item.id === goodsId && item.skuId === goods.skuId);
    
    if (count > 0) {
      if (existingItem) {
        existingItem.count = count;
        existingItem.totalPrice = (existingItem.price * existingItem.count).toFixed(1);
      } else {
        cart.push({ ...goods, count, totalPrice: (goods.price * count).toFixed(1) });
      }
    } else {
      cart = cart.filter(item => !(item.id === goodsId && item.skuId === goods.skuId));
    }
    
    wx.setStorageSync('cart', cart);
  },

  changeUnit(e) {
    const goodsId = e.currentTarget.dataset.id;
    const unitIndex = e.detail.value;
    const currentGoods = this.data.currentGoods.map(goods => {
      if (goods.id === goodsId) {
        const unit = goods.units[unitIndex];
        const newPrice = goods.prices[unit];
        const newSpecs = goods.specsMap && goods.specsMap[unit] ? goods.specsMap[unit] : '';
        const newSkuId = goods.skuIdMap && goods.skuIdMap[unit] ? goods.skuIdMap[unit] : goods.skuId;
        return { ...goods, unit, price: newPrice, specs: newSpecs, skuId: newSkuId };
      }
      return goods;
    });
    this.setData({ currentGoods });
    
    // 更新购物车中的商品信息
    const goods = currentGoods.find(g => g.id === goodsId);
    if (goods) {
      this.updateCartItem(goodsId, goods.skuId, goods.unit, goods.price, goods.specs);
    }
    
    console.log('Change unit for goods', goodsId, 'to', currentGoods.find(g => g.id === goodsId)?.unit);
  },
  
  updateCartItem(goodsId, skuId, unit, price, specs) {
    let cart = wx.getStorageSync('cart') || [];
    const cartItem = cart.find(item => item.id === goodsId && item.skuId === skuId);
    if (cartItem) {
      cartItem.unit = unit;
      cartItem.price = price;
      cartItem.specs = specs;
      cartItem.totalPrice = (price * cartItem.count).toFixed(1);
      wx.setStorageSync('cart', cart);
    }
  }
})