// pages/login/login.js
Page({
  data: {
    loading: false
  },

  onLoad(options) {
    const from = options.from || '';
    this.setData({ from });
  },

  onGetPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      const { encryptedData, iv } = e.detail;
      this.setData({ loading: true });
      this.bindPhone(encryptedData, iv);
    } else {
      wx.showToast({ title: '您取消了手机号授权，登录后可体验完整功能', icon: 'none' });
    }
  },

  bindPhone(encryptedData, iv) {
    const token = wx.getStorageSync('token');
    
    if (!token) {
      const app = getApp();
      app.silentLogin();
      wx.showToast({ title: '网络尚未就绪，请稍后再试', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '正在登录...', mask: true });
    
    wx.request({
      url: getApp().globalData.baseUrl + '/bindPhone',
      method: 'POST',
      header: { 'token': token },
      data: {
        encryptedData: encryptedData,
        iv: iv
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({ loading: false });
        
        if (res.data.code === 200) {
          const { token, userInfo, customerInfo } = res.data.data;
          
          wx.setStorageSync('token', token);
          wx.setStorageSync('userInfo', userInfo);
          wx.setStorageSync('customerInfo', customerInfo);
          wx.setStorageSync('isLogin', true);

          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500
          });

          setTimeout(() => {
            this.navigateAfterLogin();
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.message || '登录失败，请检查网络后重试',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ loading: false });
        wx.showToast({ title: '网络连接失败，请检查网络后重试', icon: 'none', duration: 2000 });
      }
    });
  },

  navigateAfterLogin() {
    if (this.data.from === 'cart') {
      wx.navigateBack();
    } else if (this.data.from === 'order') {
      wx.switchTab({ url: '/pages/order/order' });
    } else {
      wx.switchTab({ url: '/pages/profile/profile' });
    }
  },

});
