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
    baseUrl: 'https://api.example.com', // 后端API地址
    colors: {
      primary: '#003183',
      secondary: '#f5f5f5',
      text: '#333333',
      lightText: '#666666'
    }
  }
})