// index.js
Page({
  data: {
    banners: [],
    defaultBanners: [
      {
        id: 1,
        image: 'https://wdm-1258000354.cos.ap-guangzhou.myqcloud.com/defaults/banner/2026/05/03/2c7d2461-0f7d-4870-b1ab-fb5b8b1c6f0c-waitupload_banner.png'
      },
      {
        id: 2,
        image: 'https://wdm-1258000354.cos.ap-guangzhou.myqcloud.com/defaults/banner/2026/05/03/2c7d2461-0f7d-4870-b1ab-fb5b8b1c6f0c-waitupload_banner.png'
      },
      {
        id: 3,
        image: 'https://wdm-1258000354.cos.ap-guangzhou.myqcloud.com/defaults/banner/2026/05/03/2c7d2461-0f7d-4870-b1ab-fb5b8b1c6f0c-waitupload_banner.png'
      }
    ],
    recommendedGoods: [],
    page: 1,
    limit: 10,
    hasMore: true,
    isLoading: false,
    // 搜索相关
    keyword: '',
    showSearchModal: false,
    searchResults: [],
    searchLoading: false,
    searchLoadingMore: false,
    searchHasMore: true,
    searchPage: 1,
    searchLimit: 10,
    searched: false,

  },

  onLoad() {
    console.log('首页 onLoad 执行');
    // 直接加载数据，后端会处理登录状态
    console.log('调用 loadBanners');
    this.loadBanners();
    console.log('调用 loadRecommendedGoods');
    this.loadRecommendedGoods();
  },
  
  onShow() {
    console.log('首页 onShow 执行');
    this.refreshCartCounts();
  },
  
  // 刷新所有商品卡片上显示的购物车数量
  refreshCartCounts() {
    const cart = wx.getStorageSync('cart') || [];
    if (this.data.recommendedGoods.length === 0) return;
    
    const updatedGoods = this.data.recommendedGoods.map(goods => {
      const cartItem = cart.find(item => 
        item.product_id == goods.id && item.sku_id == goods.skuId
      );
      return {
        ...goods,
        count: cartItem ? cartItem.count : 0
      };
    });
    this.setData({ recommendedGoods: updatedGoods });
  },
  
  // 加载banner图
  loadBanners() {
    console.log('loadBanners 方法执行');
    const token = wx.getStorageSync('token');
    const app = getApp();
    console.log('token:', token ? '存在' : '不存在');
    console.log('baseUrl:', app.globalData.baseUrl);
    
    wx.request({
      url: app.globalData.baseUrl + '/banners',
      method: 'GET',
      header: {
        'token': token
      },
      success: (res) => {
        if (res.data.code === 200) {
          const banners = res.data.data;
          // 检查是否是有效的数组
          if (Array.isArray(banners) && banners.length > 0) {
            this.setData({ banners: banners });
          } else {
            // 如果后端没有返回有效的banner数据（空对象、空数组等），使用默认数据
            this.setData({ banners: this.data.defaultBanners });
          }
        } else {
          // 请求失败，使用默认banner数据
          this.setData({ banners: this.data.defaultBanners });
        }
      },
      fail: (error) => {
        console.error('加载banner失败:', error);
        // 网络请求失败，使用默认banner数据
        this.setData({ banners: this.data.defaultBanners });
      }
    });
  },

  // 加载推荐商品
  loadRecommendedGoods(isLoadMore = false) {
    if (this.data.isLoading) {
      console.log('正在加载中，跳过请求');
      return;
    }
    
    this.setData({ isLoading: true });
    console.log('开始加载推荐商品，页码:', this.data.page);
    
    if (!isLoadMore) {
      wx.showLoading({
        title: '加载中...',
      });
    }
    
    const app = getApp();
    const token = wx.getStorageSync('token');
    wx.request({
      url: app.globalData.baseUrl + '/goods/recommended',
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
          const goodsData = res.data.data;
          // 兼容两种后端返回格式：纯数组 [...] 或 { hasMore, list: [...] }
          let goodsList;
          if (Array.isArray(goodsData)) {
            goodsList = goodsData;
          } else if (goodsData && Array.isArray(goodsData.list)) {
            goodsList = goodsData.list;
          } else {
            goodsList = [];
          }
          
          console.log('加载推荐商品 页码=' + this.data.page + ' 数量=' + goodsList.length);
          
          // 返回数量不足一页时，标记没有更多
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
              skuIdMap[sku.sku_unit] = Number(sku.sku_id);
            });
            
            return {
              id: item.id,
              code: item.code,
              name: item.name,
              price: defaultSku.sku_selling_price,
              unit: defaultSku.sku_unit,
              skuId: Number(defaultSku.sku_id),
              specs: defaultSku.sku_specification && defaultSku.sku_specification !== 'None' ? defaultSku.sku_specification : '',
              prices: prices,
              units: units,
              specsMap: specsMap,
              skuIdMap: skuIdMap,
              image: item.image,
              count: 0
            };
          });
          
          // 加载购物车数据
          const cart = wx.getStorageSync('cart') || [];
          // 更新商品的数量，基于当前SKU
          const goodsWithCount = recommendedGoods.map(goods => {
            const cartItem = cart.find(item => item.product_id == goods.id && item.sku_id == goods.skuId);
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
            title: '商品加载失败，请下拉刷新重试',
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
          title: '网络连接失败，请检查网络后重试',
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
    this.loadBanners();
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
        // 从购物车中获取当前SKU的数量
        const cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.product_id == goodsId && item.sku_id == goods.skuId);
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
        
        // 更新购物车
        this.updateCart(goodsId, newCount);
        console.log('Updated count for goods', goodsId, 'SKU', goods.skuId, 'to', newCount);
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
    const goods = this.data.recommendedGoods.find(item => item.id === goodsId);
    const existingItem = cart.find(item => item.product_id === goodsId && item.sku_id === goods.skuId);
    
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
      cart = cart.filter(item => !(item.product_id == goodsId && item.sku_id == goods.skuId));
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
    let unit, newPrice, newSpecs, newSkuId, newCount;
    const recommendedGoods = this.data.recommendedGoods.map(goods => {
      if (goods.id === goodsId) {
        unit = goods.units[unitIndex];
        newPrice = goods.prices[unit];
        newSpecs = goods.specsMap && goods.specsMap[unit] ? goods.specsMap[unit] : '';
        newSkuId = goods.skuIdMap[unit];
        
        // 从购物车中获取新SKU的数量
        const cart = wx.getStorageSync('cart') || [];
        const cartItem = cart.find(item => item.product_id == goodsId && item.sku_id == newSkuId);
        newCount = cartItem ? cartItem.count : 0;
        
        return { ...goods, unit, price: newPrice, specs: newSpecs, skuId: newSkuId, count: newCount };
      }
      return goods;
    });
    this.setData({ recommendedGoods });
    
    console.log('Change unit for goods', goodsId, 'to', unit, 'skuId:', newSkuId, 'count:', newCount);
  },

  // 搜索相关函数
  onInput(e) {
    this.setData({
      keyword: e.detail.value
    });
  },

  onSearchFocus() {
    // 可以在这里做一些聚焦时的处理
  },

  onSearch() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      this.showError('请输入搜索关键词');
      return;
    }

    // 禁止页面滚动
    wx.setPageStyle({
      style: {
        overflow: 'hidden'
      }
    });

    this.setData({
      showSearchModal: true,
      searchLoading: true,
      searchPage: 1,
      searchResults: [],
      searchHasMore: true,
      searched: true
    });

    this.fetchSearchResults();
  },

  clearInput() {
    this.setData({
      keyword: ''
    });
  },

  closeSearchModal() {
    // 恢复页面滚动
    wx.setPageStyle({
      style: {
        overflow: 'auto'
      }
    });

    this.setData({
      showSearchModal: false
    });
  },

  fetchSearchResults() {
    const { keyword, searchPage, searchLimit } = this.data;
    const app = getApp();
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: `${app.globalData.baseUrl}/goods/search`,
      method: 'GET',
      header: {
        'token': token
      },
      data: {
        keyword: keyword,
        page: searchPage,
        limit: searchLimit
      },
      success: (res) => {
        if (res.data.code === 200) {
          const searchData = res.data.data;
          // 兼容两种后端返回格式：纯数组 或 { hasMore, list }
          let newResults;
          let responseHasMore;
          if (Array.isArray(searchData)) {
            newResults = searchData;
            responseHasMore = newResults.length >= searchLimit;
          } else if (searchData && typeof searchData === 'object') {
            newResults = Array.isArray(searchData.list) ? searchData.list : [];
            responseHasMore = searchData.hasMore !== undefined ? searchData.hasMore : (newResults.length >= searchLimit);
          } else {
            newResults = [];
            responseHasMore = false;
          }
          // 为每个商品添加默认选中的SKU和数量
          const processedResults = newResults.map(item => {
            const defaultSku = item.skus.find(sku => sku.sku_is_default) || item.skus[0];
            // 从购物车中获取该SKU的数量
            const cart = wx.getStorageSync('cart') || [];
            const cartItem = cart.find(c => c.product_id == item.id && c.sku_id == defaultSku.sku_id);
            return {
              ...item,
              selectedSku: defaultSku,
              count: cartItem ? cartItem.count : 0
            };
          });
          const results = searchPage === 1 ? processedResults : [...this.data.searchResults, ...processedResults];
          
          this.setData({
            searchResults: results,
            searchHasMore: responseHasMore,
            searchLoading: false,
            searchLoadingMore: false
          });
        } else {
          this.setData({
            searchLoading: false,
            searchLoadingMore: false
          });
          this.showError(res.data.message || '搜索失败');
        }
      },
      fail: (err) => {
        console.error('搜索失败:', err);
        this.setData({
          searchLoading: false,
          searchLoadingMore: false
        });
        this.showError('网络连接失败，请检查网络后重试');
      }
    });
  },

  loadMoreSearch() {
    if (!this.data.searchHasMore || this.data.searchLoadingMore) return;
    
    this.setData({
      searchPage: this.data.searchPage + 1,
      searchLoadingMore: true
    }, () => {
      this.fetchSearchResults();
    });
  },

  // SKU选择点击事件
  onSkuClick(e) {
    const goodsId = e.currentTarget.dataset.goodsId;
    const skuId = e.currentTarget.dataset.skuId;
    
    if (!skuId) return;
    
    // 直接修改对应索引的商品，避免遍历整个数组
    const searchResults = [...this.data.searchResults];
    const goodsIndex = searchResults.findIndex(item => item.id === goodsId);
    
    if (goodsIndex !== -1) {
      const goodsItem = {...searchResults[goodsIndex]};
      const selectedSku = goodsItem.skus.find(sku => sku.sku_id === skuId);
      goodsItem.selectedSku = selectedSku || goodsItem.skus[0];
      
      // 检查购物车中是否已有该SKU的记录
      const cart = wx.getStorageSync('cart') || [];
      const existingItem = cart.find(item => item.product_id == goodsId && item.sku_id == skuId);
      // 如果有，使用购物车中的数量；如果没有，重置为0
      goodsItem.count = existingItem ? existingItem.count : 0;
      
      searchResults[goodsIndex] = goodsItem;
      
      this.setData({ searchResults });
    }
  },

  // 搜索商品数量操作
  increaseSearchCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    this.updateSearchGoodsCount(goodsId, 1);
  },

  decreaseSearchCount(e) {
    const goodsId = e.currentTarget.dataset.id;
    this.updateSearchGoodsCount(goodsId, -1);
  },

  updateSearchGoodsCount(goodsId, change) {
    const searchResults = this.data.searchResults.map(item => {
      if (item.id === goodsId) {
        const currentCount = item.count || 0;
        
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
        
        // 更新购物车
        this.updateSearchCart(item, newCount);
        return { ...item, count: newCount };
      }
      return item;
    });
    this.setData({ searchResults });
  },

  updateSearchCart(goodsItem, count) {
    let cart = wx.getStorageSync('cart') || [];
    const existingItemIndex = cart.findIndex(item => item.product_id == goodsItem.id && item.sku_id == goodsItem.selectedSku.sku_id);
    
    if (count > 0) {
      if (existingItemIndex > -1) {
        cart[existingItemIndex].count = count;
        cart[existingItemIndex].sku_id = goodsItem.selectedSku.sku_id;
        cart[existingItemIndex].sku_selling_price = goodsItem.selectedSku.sku_selling_price;
        cart[existingItemIndex].sku_specification = goodsItem.selectedSku.sku_specification && goodsItem.selectedSku.sku_specification !== 'None' ? goodsItem.selectedSku.sku_specification : '';
        cart[existingItemIndex].sku_unit = goodsItem.selectedSku.sku_unit;
      } else {
        cart.push({
          product_id: goodsItem.id,
          code: goodsItem.code,
          name: goodsItem.name,
          image: goodsItem.image,
          sku_id: goodsItem.selectedSku.sku_id,
          count: count,
          sku_selling_price: goodsItem.selectedSku.sku_selling_price,
          sku_specification: goodsItem.selectedSku.sku_specification && goodsItem.selectedSku.sku_specification !== 'None' ? goodsItem.selectedSku.sku_specification : '',
          sku_unit: goodsItem.selectedSku.sku_unit
        });
      }
      // 上传到后端
      this.uploadCartToBackend(goodsItem.id, goodsItem.selectedSku.sku_id, count, goodsItem.selectedSku.sku_selling_price);
    } else {
      cart = cart.filter(item => !(item.product_id == goodsItem.id && item.sku_id == goodsItem.selectedSku.sku_id));
      // 上传到后端（删除操作）
      this.uploadCartToBackend(goodsItem.id, goodsItem.selectedSku.sku_id, 0, goodsItem.selectedSku.sku_selling_price);
    }
    
    wx.setStorageSync('cart', cart);
  },

  showError(msg) {
    wx.showToast({
      title: msg,
      icon: 'none',
      duration: 2000
    });
  }
})
