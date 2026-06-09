// category.js
Page({
  data: {
    categories: [],          // 分类及商品数据
    activeCategory: 0,      // 当前高亮的分类ID
    activeMenuId: '',       // 左侧要滚动到的菜单项id（scroll-into-view）
    loading: false,
    loadingCategory: null,   // 当前正在加载的分类ID（用于防止重复加载）
    noMore: false,
    pageSize: 10,
    // 辅助数据
    sectionTopList: [],     // 存储每个分类区块距离右侧滚动容器顶部的距离
    // 保存每个分类的分页状态
    categoryPagination: {}
  },

  // 节流函数（控制滚动事件频率）
  throttle(fn, gapTime = 100) {
    let lastTime = 0;
    return function (...args) {
      let now = Date.now();
      if (now - lastTime > gapTime) {
        fn.apply(this, args);
        lastTime = now;
      }
    };
  },

  onLoad() {
    this.loadInitialData();
    // 绑定滚动处理函数（节流）
    this.onGoodsScroll = this.throttle(this.onGoodsScroll.bind(this), 100);
  },

  onShow() {
    // 页面显示时刷新购物车数量
    this.refreshCartCount();
  },

  // 加载初始化数据（从服务器获取分类和第一页商品）
  loadInitialData() {
    wx.showLoading({ title: '加载中' });
    
    const app = getApp();
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: app.globalData.baseUrl + '/categories',
      method: 'GET',
      header: { 'token': token },
      success: (res) => {
        wx.hideLoading();
        
        if (res.data.code === 200) {
          const categoriesData = res.data.data;
          const categories = Array.isArray(categoriesData) ? categoriesData : [];
          
          // 为每个分类初始化商品数组
          const categoriesWithGoods = categories.map(cat => ({
            ...cat,
            goods: []
          }));
          
          this.setData({ categories: categoriesWithGoods }, () => {
            // 加载第一个分类的商品
            if (categories.length > 0) {
              this.setData({ 
                activeCategory: categories[0].id 
              });
              this.loadGoodsForCategory(categories[0].id);
            }
          });
        } else {
          wx.showToast({ title: '分类加载失败，请下拉刷新重试', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '网络连接失败，请检查网络后重试', icon: 'none' });
        console.error('Failed to load categories:', err);
      }
    });
  },

  // 加载指定分类的商品
  loadGoodsForCategory(categoryId, isLoadMore = false) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    const app = getApp();
    const token = wx.getStorageSync('token');
    // 获取该分类的当前页码
    const pagination = this.data.categoryPagination[categoryId] || { page: 1, hasMore: true };
    const page = isLoadMore ? pagination.page + 1 : 1;
    
    wx.request({
      url: app.globalData.baseUrl + `/goods/category/${categoryId}`,
      method: 'GET',
      header: { 'token': token },
      data: { page, limit: this.data.pageSize },
      success: (res) => {
        this.setData({ loading: false });
        
        if (res.data.code === 200) {
          const responseData = res.data.data;
          // 解析后端返回的数据结构：{ hasMore: boolean, list: [] }
          const hasMore = responseData && responseData.hasMore !== undefined ? responseData.hasMore : false;
          const goodsList = responseData && responseData.list && Array.isArray(responseData.list) ? responseData.list : [];
          
          // 转换数据格式
          let processedGoods = [];
          if (goodsList.length > 0) {
            processedGoods = goodsList.map(item => {
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
          const goodsWithCount = processedGoods.map(goods => {
            const cartItem = cart.find(item => item.product_id === goods.id && item.sku_id === goods.skuId);
            return { ...goods, count: cartItem ? cartItem.count : 0 };
          });
          
          // 更新分类商品数据
          const categories = this.data.categories.map(cat => {
            if (cat.id === categoryId) {
              return {
                ...cat,
                goods: isLoadMore ? [...cat.goods, ...goodsWithCount] : goodsWithCount
              };
            }
            return cat;
          });
          
          // 更新分页状态（使用后端返回的hasMore）
          this.data.categoryPagination[categoryId] = { page, hasMore };
          
          this.setData({ 
            categories,
            noMore: !hasMore && goodsList.length === 0
          });
          
          // 加载新数据后，重新计算区块位置
          setTimeout(() => {
            this.calcSectionsTop();
          }, 100);
          
          // 如果当前分类没有更多商品，自动加载下一个分类的商品
          if (!hasMore && goodsList.length > 0) {
            this.loadNextCategory(categoryId);
          }
        } else {
          wx.showToast({ title: '商品加载失败，请下拉刷新重试', icon: 'none' });
        }
      },
      fail: (err) => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络连接失败，请检查网络后重试', icon: 'none' });
        console.error('Failed to load category goods:', err);
      }
    });
  },

  // 计算每个分类区块距离右侧滚动容器顶部的距离
  calcSectionsTop() {
    const query = wx.createSelectorQuery().in(this);
    query.selectAll('.category-section').boundingClientRect();
    query.select('.category-right').scrollOffset();
    query.exec((res) => {
      const sections = res[0];      // 各个区块的 rect
      const scrollTop = res[1]?.scrollTop || 0;
      if (sections && sections.length) {
        const topList = sections.map(section => ({
          id: section.id.replace('section-', ''), // 提取分类ID
          top: section.top + scrollTop            // 绝对位置（相对于滚动内容）
        }));
        this.setData({ sectionTopList: topList });
      }
    });
  },

  // 右侧滚动时触发：根据滚动位置计算当前应该高亮的分类
  onGoodsScroll(e) {
    const scrollTop = e.detail.scrollTop;
    const { sectionTopList, categories } = this.data;

    // 找出第一个 top 大于 scrollTop 的分类索引（或最后一个）
    let currentId = null;
    if (sectionTopList.length > 0) {
      for (let i = sectionTopList.length - 1; i >= 0; i--) {
        if (sectionTopList[i].top <= scrollTop + 30) { // 加30偏移量更灵敏
          currentId = sectionTopList[i].id;
          break;
        }
      }
    }
    
    // 如果通过区块位置无法确定当前分类，尝试通过滚动位置估算
    if (!currentId && categories.length > 0) {
      let accumulatedHeight = 0;
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const estimatedHeight = 60 + (cat.goods && cat.goods.length ? cat.goods.length * 240 : 40);
        if (scrollTop < accumulatedHeight + estimatedHeight) {
          currentId = String(cat.id);
          break;
        }
        accumulatedHeight += estimatedHeight;
      }
    }
    
    // 默认使用第一个分类
    if (!currentId && categories.length > 0) {
      currentId = String(categories[0].id);
    }

    // 更新当前分类高亮
    if (currentId && Number(currentId) !== this.data.activeCategory) {
      const categoryId = Number(currentId);
      this.setData({ activeCategory: categoryId });
      this.setData({ activeMenuId: `menu-${currentId}` });
      
      // 检查该分类是否有商品，如果没有则加载
      const category = categories.find(cat => cat.id === categoryId);
      if (category && (!category.goods || category.goods.length === 0)) {
        this.loadGoodsForCategory(categoryId);
      }
    }
    
    // 预加载机制：检测即将滚动到的分类并提前加载
    this.preloadCategories(scrollTop);
  },
  
  // 预加载机制：提前加载即将滚动到的分类商品
  preloadCategories(scrollTop) {
    const { categories } = this.data;
    const viewportHeight = 750; // 屏幕高度（rpx）
    
    let accumulatedHeight = 0;
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      // 预估每个分类区块的高度
      const estimatedHeight = 60 + (cat.goods && cat.goods.length ? cat.goods.length * 240 : 40);
      
      // 检查该分类是否在当前可见区域或即将进入可见区域（提前200rpx预加载）
      if (accumulatedHeight < scrollTop + viewportHeight + 200 && 
          accumulatedHeight + estimatedHeight > scrollTop - 200) {
        // 如果该分类没有商品，且尚未加载中，自动加载
        if (!cat.goods || cat.goods.length === 0) {
          // 检查是否正在加载该分类
          const isLoading = this.data.loadingCategory === cat.id;
          if (!isLoading) {
            this.setData({ loadingCategory: cat.id });
            this.loadGoodsForCategory(cat.id);
          }
        }
      }
      
      accumulatedHeight += estimatedHeight;
    }
  },
  
  // 自动加载下一个分类的商品（当前分类hasMore=false时调用）
  loadNextCategory(currentCategoryId) {
    const { categories } = this.data;
    const currentIndex = categories.findIndex(cat => cat.id === currentCategoryId);
    
    // 找到下一个没有商品的分类
    for (let i = currentIndex + 1; i < categories.length; i++) {
      const nextCat = categories[i];
      // 如果下一个分类没有商品，且不在加载中，则加载
      if ((!nextCat.goods || nextCat.goods.length === 0) && this.data.loadingCategory !== nextCat.id) {
        this.setData({ loadingCategory: nextCat.id });
        this.loadGoodsForCategory(nextCat.id);
        break; // 只加载第一个未加载的分类
      }
    }
  },

  // 点击左侧菜单：右侧滚动到对应分类区块
  switchCategory(e) {
    const categoryId = Number(e.currentTarget.dataset.id);
    const category = this.data.categories.find(cat => cat.id === categoryId);
    
    if (!category || categoryId === this.data.activeCategory) return;
    
    this.setData({ 
      activeCategory: categoryId,
      activeMenuId: `menu-${categoryId}`
    });
    
    // 如果该分类没有商品，先加载商品
    if (!category.goods || category.goods.length === 0) {
      this.loadGoodsForCategory(categoryId);
      return;
    }
    
    // 滚动右侧到指定区块
    wx.createSelectorQuery().in(this)
      .select(`#section-${categoryId}`)
      .boundingClientRect()
      .select('.category-right')
      .scrollOffset()
      .exec((res) => {
        if (res[0]) {
          const sectionTop = res[0].top;
          const currentScrollTop = res[1]?.scrollTop || 0;
          // 滚动到目标位置
          wx.pageScrollTo({
            scrollTop: currentScrollTop + sectionTop - 10, // 减去偏移让标题不完全贴边
            duration: 300
          });
        }
      });
  },

  // 下拉加载更多
  onReachBottom() {
    if (this.data.loading || this.data.noMore) return;
    
    const currentCategory = this.data.categories.find(cat => cat.id === this.data.activeCategory);
    if (!currentCategory) return;
    
    const pagination = this.data.categoryPagination[this.data.activeCategory] || { hasMore: true };
    if (!pagination.hasMore) {
      this.setData({ noMore: true });
      return;
    }
    
    this.loadGoodsForCategory(this.data.activeCategory, true);
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      categoryPagination: {},
      noMore: false
    });
    this.loadInitialData();
    wx.stopPullDownRefresh();
  },

  // 刷新购物车数量
  refreshCartCount() {
    const cart = wx.getStorageSync('cart') || [];
    const categories = this.data.categories.map(cat => ({
      ...cat,
      goods: cat.goods?.map(goods => {
        const cartItem = cart.find(item => item.product_id === goods.id && item.sku_id === goods.skuId);
        return { ...goods, count: cartItem ? cartItem.count : 0 };
      }) || []
    }));
    this.setData({ categories });
  },

  goToGoodsDetail(e) {
    const goodsId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/goodsDetail/goodsDetail?id=${goodsId}`
    });
  },

  increaseCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    const categoryId = e.currentTarget.dataset.categoryId;
    this.updateGoodsCount(goodsId, categoryId, 1);
  },

  decreaseCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    const categoryId = e.currentTarget.dataset.categoryId;
    this.updateGoodsCount(goodsId, categoryId, -1);
  },

  updateGoodsCount(goodsId, categoryId, change) {
    const categories = this.data.categories.map(cat => {
      if (cat.id === Number(categoryId)) {
        return {
          ...cat,
          goods: cat.goods?.map(goods => {
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
              
              this.updateCart(goodsId, goods.skuId, newCount, goods);
              return { ...goods, count: newCount };
            }
            return goods;
          }) || []
        };
      }
      return cat;
    });
    this.setData({ categories });
  },

  updateCart(goodsId, skuId, count, goods) {
    let cart = wx.getStorageSync('cart') || [];
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
      cart = cart.filter(item => !(item.product_id === goodsId && item.sku_id === skuId));
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
      header: { 'token': token },
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
    const categoryId = e.currentTarget.dataset.categoryId;
    const unitIndex = e.detail.value;
    
    const categories = this.data.categories.map(cat => {
      if (cat.id === Number(categoryId)) {
        return {
          ...cat,
          goods: cat.goods?.map(goods => {
            if (goods.id === goodsId) {
              const unit = goods.units[unitIndex];
              const newPrice = goods.prices[unit];
              const newSpecs = goods.specsMap && goods.specsMap[unit] ? goods.specsMap[unit] : '';
              const newSkuId = goods.skuIdMap && goods.skuIdMap[unit] ? goods.skuIdMap[unit] : goods.skuId;
              return { ...goods, unit, price: newPrice, specs: newSpecs, skuId: newSkuId, count: 0 };
            }
            return goods;
          }) || []
        };
      }
      return cat;
    });
    this.setData({ categories });
  }
});
