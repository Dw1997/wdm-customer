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
    scrollIntoCategoryId: '',
    // 保存每个分类的分页状态
    categoryPagination: {}
  },

  onLoad() {
    // 直接加载数据，后端会处理登录状态
    this.loadCategories();
  },

  onShow() {
    // 页面显示时刷新数据
    if (this.data.categories.length === 0) {
      this.loadCategories();
    }
  },

  // 加载分类列表
  loadCategories() {
    wx.showLoading({
      title: '加载中...',
    });
    
    const app = getApp();
    const token = wx.getStorageSync('token');
    wx.request({
      url: app.globalData.baseUrl + '/categories',
      method: 'GET',
      header: {
        'token': token
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.data.code === 200) {
          const categoriesData = res.data.data;
          // 确保categories是数组
          const categories = Array.isArray(categoriesData) ? categoriesData : [];
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

  setCurrentGoods(categoryId, isLoadMore = false) {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    if (!isLoadMore) {
      wx.showLoading({
        title: '加载商品中...',
      });
    }
    
    const app = getApp();
    const token = wx.getStorageSync('token');
    wx.request({
      url: app.globalData.baseUrl + `/goods/category/${categoryId}`,
      method: 'GET',
      header: {
        'token': token
      },
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
          }
          
          // 转换数据格式
          let recommendedGoods = [];
          if (Array.isArray(goodsList) && goodsList.length > 0) {
            recommendedGoods = goodsList.map(item => {
              const defaultSku = item.skus.find(sku => sku.sku_is_default) || item.skus[0];
              const units = item.skus.map(sku => sku.sku_unit);
              const prices = {};
              const specsMap = {};
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
                image: item.image,
                count: 0
              };
            });
          }
          
          // 加载购物车数据
          const cart = wx.getStorageSync('cart') || [];
          // 更新商品的数量，基于当前SKU
          const goodsWithCount = recommendedGoods.map(goods => {
            const cartItem = cart.find(item => item.product_id === goods.id && item.sku_id === goods.skuId);
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
    if (this.data.isLoading || !this.data.hasMore) return;
    
    const newPage = this.data.page + 1;
    this.setData({
      page: newPage
    }, () => {
      this.setCurrentGoods(this.data.activeCategory, true);
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      currentGoods: []
    });
    this.loadCategories();
    wx.stopPullDownRefresh();
  },

  // 切换分类时重置分页
  switchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find(cat => cat.id === categoryId);
    
    if (!category || categoryId === this.data.activeCategory) return;
    
    this.setData({ 
      activeCategory: categoryId,
      currentCategoryName: category ? category.name : '',
      page: 1,
      hasMore: true,
      currentGoods: [],
      scrollIntoCategoryId: 'category-' + categoryId
    });
    
    // 加载新分类的商品
    this.setCurrentGoods(categoryId);
    
    // 延迟清空scrollIntoCategoryId
    setTimeout(() => {
      this.setData({
        scrollIntoCategoryId: ''
      });
    }, 300);
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
        const cart = wx.getStorageSync('cart') || [];
        const existingItem = cart.find(item => item.product_id === goodsId && item.sku_id === goods.skuId);
        const currentCount = existingItem ? existingItem.count : 0;
        
        let newCount;
        if (change > 0) {
          // 增加数量：按照递增规则
          const increments = [1, 2, 5, 10, 20];
          const currentIndex = increments.findIndex(v => v > currentCount);
          if (currentIndex === -1) {
            // 超过20后，每次+10
            newCount = currentCount + 10;
          } else if (currentIndex === 0) {
            // 当前为0，直接到1
            newCount = 1;
          } else {
            // 取下一个递增值
            newCount = increments[currentIndex];
          }
        } else {
          // 减少数量：每次减1
          newCount = Math.max(0, currentCount + change);
        }
        
        this.updateCart(goodsId, goods.skuId, newCount);
        return { ...goods, count: newCount };
      }
      return goods;
    });
    this.setData({ currentGoods });
  },

  updateCart(goodsId, skuId, count) {
    let cart = wx.getStorageSync('cart') || [];
    const goods = this.data.currentGoods.find(item => item.id === goodsId && item.skuId === skuId);
    const existingItem = cart.find(item => item.product_id === goodsId && item.sku_id === skuId);
    
    if (count > 0) {
      if (existingItem) {
        existingItem.count = count;
        existingItem.sku_id = goods.skuId;
        existingItem.sku_selling_price = goods.price;
        existingItem.sku_specification = goods.specs;
        existingItem.sku_unit = goods.unit;
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
          sku_unit: goods.unit
        });
      }
      // 上传到后端
      this.uploadCartToBackend(goods.id, goods.skuId, count, goods.price);
    } else {
      cart = cart.filter(item => !(item.product_id === goodsId && item.sku_id === goods.skuId));
      // 上传到后端（删除操作）
      this.uploadCartToBackend(goods.id, goods.skuId, 0, goods.price);
    }
    
    wx.setStorageSync('cart', cart);
  },

  uploadCartToBackend(goodsId, skuId, count, price) {
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.baseUrl + '/cart',
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
      fail: (err) => {
        console.error('Cart upload failed:', err);
      }
    });
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
        return { ...goods, unit, price: newPrice, specs: newSpecs, skuId: newSkuId, count: 0 };
      }
      return goods;
    });
    this.setData({ currentGoods });
  }
});
