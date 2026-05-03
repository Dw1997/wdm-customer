// pages/login/login.js
Page({
  data: {
    loading: false,
    tipMsg: '',
    tipType: '',
    showTip: false
  },

  onLoad(options) {
    const from = options.from || '';
    this.setData({ from });
  },

  onGetPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 用户同意授权，拿到加密数据
      const { encryptedData, iv } = e.detail;
      this.setData({ loading: true });
      
      console.log('用户同意授权', e.detail);
      
      // 将加密数据 + 本地存储的 token 发送给后端
      this.bindPhone(encryptedData, iv);
    } else {
      // 用户拒绝授权
      console.log('用户拒绝授权', e.detail);
      this.showTip('授权失败', 'warn');
    }
  },

  bindPhone(encryptedData, iv) {
    const token = wx.getStorageSync('token');
    
    wx.showLoading({ title: '登录中...' });
    
    wx.request({
      url: getApp().globalData.baseUrl + '/bindPhone',
      method: 'POST',
      header: { 'token': token }, // 携带登录态
      data: {
        encryptedData: encryptedData,
        iv: iv
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({ loading: false });
        
        if (res.data.code === 200) {
          // 登录成功，保存 token 和用户信息
          const { token, userInfo, customerInfo } = res.data.data;
          
          wx.setStorageSync('token', token);
          wx.setStorageSync('userInfo', userInfo);
          wx.setStorageSync('customerInfo', customerInfo);
          wx.setStorageSync('isLogin', true);

          this.showTip('登录成功', 'success');

          setTimeout(() => {
            if (this.data.from === 'cart') {
              wx.navigateBack();
            } else if (this.data.from === 'order') {
              wx.switchTab({
                url: '/pages/order/order'
              });
            } else if (this.data.from === 'profile') {
              wx.switchTab({
                url: '/pages/profile/profile'
              });
            } else {
              wx.switchTab({
                url: '/pages/profile/profile'
              });
            }
          }, 1500);
        } else {
          this.showTip(res.data.message || '登录失败', 'warn');
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ loading: false });
        this.showTip('网络请求失败', 'error');
      }
    });
  },

  showTip(msg, type) {
    this.setData({
      tipMsg: msg,
      tipType: type,
      showTip: true
    });

    setTimeout(() => {
      this.setData({ showTip: false });
    }, 2000);
  }
});
