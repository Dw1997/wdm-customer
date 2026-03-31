// app.js
App({
  onLaunch() {
    // 初始化购物车
    if (!wx.getStorageSync('cart')) {
      wx.setStorageSync('cart', []);
    }
  },
  globalData: {
    userInfo: null,
    apiBase: 'http://localhost:5001/miniapi', // 后端API地址
    baseUrl: 'http://localhost:5001/miniapi', // 后端API地址（兼容旧代码）
    colors: {
      primary: '#003183',
      secondary: '#f5f5f5',
      text: '#333333',
      lightText: '#666666'
    }
  }
})