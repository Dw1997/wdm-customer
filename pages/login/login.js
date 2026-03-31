// pages/login/login.js
Page({
  data: {
    loading: false,
    needPhoneAuth: false,
    openid: '',
    unionid: '',
    userInfo: {},
    tipMsg: '',
    tipType: '',
    showTip: false
  },

  onLoad(options) {
    const from = options.from || '';
    this.setData({ from });
  },

  onGetUserInfo(e) {
    if (e.detail.userInfo) {
      this.setData({ 
        loading: true,
        userInfo: e.detail.userInfo 
      });

      wx.login({
        success: (res) => {
          if (res.code) {
            wx.request({
              url: getApp().globalData.apiBase + '/login',
              method: 'POST',
              data: { 
                code: res.code
              },
              success: (wxRes) => {
                if (wxRes.data.code === 200) {
                  const { token, userInfo, customerInfo, bound } = wxRes.data.data;
                  
                  if (bound) {
                    // 已绑定，直接登录成功
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
                    // 未绑定，显示手机号授权
                    this.setData({ 
                      needPhoneAuth: true, 
                      openid: wxRes.data.data.openid,
                      unionid: wxRes.data.data.unionid,
                      loading: false
                    });
                  }
                } else {
                  this.setData({ loading: false });
                  this.showTip(wxRes.data.message || '登录失败', 'warn');
                }
              },
              fail: () => {
                this.setData({ loading: false });
                this.showTip('网络错误，请重试', 'error');
              }
            });
          } else {
            this.setData({ loading: false });
            this.showTip('获取登录凭证失败', 'warn');
          }
        },
        fail: () => {
          this.setData({ loading: false });
          this.showTip('微信登录失败', 'error');
        }
      });
    } else {
      this.showTip('需要授权才能登录', 'warn');
    }
  },

  onGetPhoneNumber(e) {
    if (e.detail.code) {
      this.setData({ loading: true });
      
      // 调用后端接口获取手机号并完成登录
      wx.request({
        url: getApp().globalData.apiBase + '/loginWithPhone',
        method: 'POST',
        data: {
          code: e.detail.code,
          openid: this.data.openid,
          unionid: this.data.unionid,
          nickName: this.data.userInfo.nickName,
          avatarUrl: this.data.userInfo.avatarUrl
        },
        success: (res) => {
          if (res.data.code === 200) {
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
            this.setData({ loading: false });
            this.showTip(res.data.message || '登录失败', 'warn');
          }
        },
        fail: () => {
          this.setData({ loading: false });
          this.showTip('网络错误，请重试', 'error');
        }
      });
    } else {
      this.showTip('需要授权手机号才能登录', 'warn');
    }
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
