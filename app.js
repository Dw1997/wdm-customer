// app.js
App({
  onLaunch() {
    // 获取当前小程序的账号信息
    const accountInfo = wx.getAccountInfoSync();
    // 获取当前环境：develop(开发版), trial(体验版), release(正式版)
    const envVersion = accountInfo.miniProgram.envVersion;
    
    // 根据环境设置 baseUrl
    let baseUrl = '';
    if (envVersion === 'release') {
      baseUrl = 'https://pwdm.dwhhh.cn/miniapi';
    } else if (envVersion === 'trial') {
      baseUrl = 'https://twdm.dwhhh.cn/miniapi';
    } else {
      baseUrl = 'http://192.168.100.108:5001/miniapi';
    }
    
    // 设置全局 baseUrl
    this.globalData.baseUrl = baseUrl;
    console.log('当前环境:', envVersion, 'baseUrl:', baseUrl);
    
    // 初始化购物车
    const cart = wx.getStorageSync('cart');
    if (!cart || cart.length === 0) {
      wx.setStorageSync('cart', []);
    }
    
    // 删除订单本地缓存（小程序打开时清空，重新从后端获取）
    wx.removeStorageSync('orders');
    
    // 执行静默登录
    this.silentLogin();
  },
  
  // 从后端获取购物车数据并合并本地购物车
  getCartFromBackend(callback) {
    const token = wx.getStorageSync('token');
    if (!token) {
      if (callback) callback();
      return;
    }
    wx.request({
      url: this.globalData.baseUrl + '/cart',
      method: 'GET',
      header: {
        'token': token
      },
      success: (res) => {
        if (res.data.code === 200) {
          // 确保backendCart是数组，如果不是数组则转换为空数组
          const backendData = res.data.data;
          const backendCart = Array.isArray(backendData) ? backendData : [];
          const localCart = wx.getStorageSync('cart') || [];
          
          // 合并购物车数据
          const mergedCart = this.mergeCarts(backendCart, localCart);
          
          // 保存合并后的购物车数据到本地存储
          wx.setStorageSync('cart', mergedCart);
          console.log('从后端获取购物车数据成功并合并:', mergedCart);
        }
        if (callback) callback();
      },
      fail: (error) => {
        console.error('从后端获取购物车数据失败:', error);
        if (callback) callback();
      }
    });
  },
  
  // 合并购物车：取并集，同SKU取数量更大的一方
  mergeCarts(backendCart, localCart) {
    const normalize = item => ({
      product_id: Number(item.product_id),
      sku_id: Number(item.sku_id),
      code: item.code || '',
      name: item.name || '',
      image: item.image || '',
      count: item.count || 0,
      sku_selling_price: item.sku_selling_price || 0,
      sku_specification: item.sku_specification || '',
      sku_unit: item.sku_unit || ''
    });
    const getKey = item => String(item.product_id) + '_' + String(item.sku_id);

    const normLocal = localCart.map(normalize);
    const normBackend = backendCart.map(normalize);

    const backendMap = {};
    normBackend.forEach(item => { backendMap[getKey(item)] = item; });

    // 结果：以本地为基础，同SKU取数量更大的
    const resultMap = {};
    normLocal.forEach(item => {
      const key = getKey(item);
      const backendItem = backendMap[key];
      if (backendItem && backendItem.count > item.count) {
        resultMap[key] = backendItem;
      } else {
        resultMap[key] = item;
        if (!backendItem) {
          this.uploadCartItemToBackend(item);
        }
      }
    });

    // 后端有但本地没有的 → 加入
    normBackend.forEach(item => {
      const key = getKey(item);
      if (!resultMap[key]) {
        resultMap[key] = item;
      }
    });

    // 转为数组返回
    const merged = [];
    Object.keys(resultMap).forEach(key => merged.push(resultMap[key]));
    return merged;
  },
  
  // 上传购物车商品到后端
  uploadCartItemToBackend(item) {
    const token = wx.getStorageSync('token');
    wx.request({
      url: this.globalData.baseUrl + '/cart',
      method: 'POST',
      header: {
        'token': token
      },
      data: {
        product_id: item.product_id,
        sku_id: item.sku_id,
        count: item.count,
        sku_selling_price: item.sku_selling_price
      },
      success: (res) => {
        console.log('上传购物车商品成功:', res.data);
      },
      fail: (error) => {
        console.error('上传购物车商品失败:', error);
      }
    });
  },
  
  silentLogin: function () {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 获取到 code
          console.log('登录成功，code:', res.code);
          // 将 code 发送到后端服务器
          this.sendCodeToServer(res.code);
        } else {
          console.error('wx.login 调用失败!', res.errMsg);
        }
      },
      fail: (err) => {
        console.error('网络异常，wx.login 调用失败', err);
      }
    });
  },
  
  sendCodeToServer: function (code) {
    wx.request({
      url: this.globalData.baseUrl + '/silentLogin',
      method: 'POST',
      data: { code: code },
      success: (res) => {
        console.log('静默登录返回数据:', res.data);
        
        if (res.data.code === 200) {
          const data = res.data.data;
          
          // 保存后端返回的 Token
          wx.setStorageSync('token', data.token);
          
          // 判断用户是否已绑定手机号
          if (data.hasPhone) {
            // 已绑定，设置登录状态
            wx.setStorageSync('isLogin', true);
            wx.setStorageSync('userInfo', data.userInfo || {});
            wx.setStorageSync('customerInfo', data.customerInfo || {});
            
            // 登录成功后，获取后端购物车数据并合并本地购物车
            this.getCartFromBackend();
            
            // 触发登录完成回调，通知页面加载数据
            this.triggerLoginCallback();
          } else {
            // 未绑定，标记为未登录状态
            wx.setStorageSync('isLogin', false);
            console.log('需要绑定手机号');
          }
        }
      },
      fail: (err) => {
        console.error('静默登录请求失败:', err);
        // 静默登录失败不阻塞使用，标记为未登录状态
        wx.setStorageSync('isLogin', false);
      }
    });
  },
  
  onHide() {
    // 小程序退出时删除订单本地缓存
    wx.removeStorageSync('orders');
  },
  
  onUnload() {
    // 小程序卸载时删除订单本地缓存
    wx.removeStorageSync('orders');
  },
  
  globalData: {
    userInfo: null,
    baseUrl: '', // 后端API地址，动态设置
    colors: {
      primary: '#003183',
      secondary: '#f5f5f5',
      text: '#333333',
      lightText: '#666666'
    },
    loginCallback: null // 登录完成回调函数
  },
  
  // 设置登录完成回调
  setLoginCallback(callback) {
    this.globalData.loginCallback = callback;
  },
  
  // 触发登录完成回调
  triggerLoginCallback() {
    if (this.globalData.loginCallback) {
      this.globalData.loginCallback();
      this.globalData.loginCallback = null; // 只触发一次
    }
  }
})
