// app.js
App({
  onLaunch() {
    // 初始化购物车
    if (!wx.getStorageSync('cart')) {
      wx.setStorageSync('cart', []);
    }
    
    // 执行静默登录
    this.silentLogin();
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
      url: this.globalData.apiBase + '/silentLogin',
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
          } else {
            // 未绑定，标记为未登录状态
            wx.setStorageSync('isLogin', false);
            console.log('需要绑定手机号');
          }
        }
      }
    });
  },
  
  globalData: {
    userInfo: null,
    apiBase: 'http://192.168.100.108:5001/miniapi', // 后端API地址
    baseUrl: 'http://192.168.100.108:5001/miniapi', // 后端API地址（兼容旧代码）
    colors: {
      primary: '#003183',
      secondary: '#f5f5f5',
      text: '#333333',
      lightText: '#666666'
    }
  }
})
