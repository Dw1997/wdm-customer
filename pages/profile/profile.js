// pages/profile/profile.js
Page({
  data: {
    userInfo: {
      avatar: '',
      nickname: '客户',
      phone: '138****8888',
      isVip: false,
      isLogin: false
    },
    customerInfo: {
      name: '',
      phone: '',
      isBound: false
    },
    stats: {
      unsettledAmount: '0.0',
      totalOrders: 0,
      totalAmount: '0.0'
    },
  },

  onLoad(options) {
    this.checkLogin();
  },

  onShow() {
    this.checkLogin();
  },

  checkLogin() {
    const isLogin = wx.getStorageSync('isLogin') || false;
    
    if (isLogin) {
      this.loadUserInfo();
      this.loadStats();
    } else {
      // 未登录，跳转到登录页面
      wx.redirectTo({
        url: '/pages/login/login?from=profile'
      });
    }
  },

  loadUserInfo() {
    const isLogin = wx.getStorageSync('isLogin') || false;
    const userInfo = wx.getStorageSync('userInfo') || {};
    const customerInfo = wx.getStorageSync('customerInfo') || {};

    if (isLogin && userInfo) {
      this.setData({
        userInfo: {
          avatar: userInfo.avatarUrl || userInfo.avatar || '',
          nickname: userInfo.nickName || userInfo.nickname || userInfo.username || '客户',
          phone: customerInfo.phone || userInfo.phone || '138****8888',
          isVip: customerInfo.isVip || false,
          isLogin: true
        },
        customerInfo: {
          name: customerInfo.name || '',
          phone: customerInfo.phone || userInfo.phone || '',
          isBound: !!customerInfo.name // 有姓名则表示已绑定
        }
      });
    } else {
      this.setData({
        userInfo: {
          avatar: '',
          nickname: '客户',
          phone: '138****8888',
          isVip: false,
          isLogin: false
        },
        customerInfo: {
          name: '',
          phone: '',
          isBound: false
        }
      });
    }
  },

  loadStats() {
    const token = wx.getStorageSync('token');
    wx.request({
      url: getApp().globalData.baseUrl + '/shop/stats',
      method: 'GET',
      header: {
        'token': token
      },
      success: (res) => {
        if (res.data.code === 200) {
          const data = res.data.data;
          this.setData({
            stats: {
              monthlyTotalOrders: data.monthly_total_orders,
              monthlyTotalConsumption: data.monthly_total_consumption.toFixed(1),
              unsettledAmount: data.unsettled_amount.toFixed(1)
            }
          });
        } else {
          console.error('获取统计数据失败:', res.data.message);
        }
      },
      fail: (error) => {
        console.error('网络请求失败:', error);
      }
    });
  },

  editProfile() {
    if (!this.data.customerInfo.isBound) {
      wx.showToast({
        title: '暂无关联店铺，请联系管理员绑定',
        icon: 'none',
        duration: 2500
      });
      return;
    }
    
    wx.showToast({
      title: '个人资料编辑功能开发中',
      icon: 'none'
    });
  },

  goToAddress() {
    if (!this.data.customerInfo.isBound) {
      wx.showToast({
        title: '暂无关联店铺，请联系管理员绑定',
        icon: 'none',
        duration: 2500
      });
      return;
    }
    
    wx.showToast({
      title: '收货地址功能开发中',
      icon: 'none'
    });
  },

  contactService() {
    wx.makePhoneCall({
      phoneNumber: '13330143106',
      success: () => {
        console.log('成功唤起拨号界面');
      },
      fail: (err) => {
        console.error('拨号失败', err);
        wx.showToast({
          title: '拨号失败，请在系统设置中开启电话权限',
          icon: 'none'
        });
      }
    });
  },

  goToAbout() {
    wx.showToast({
      title: '味都美副食商城 v1.0',
      icon: 'none'
    });
  },

  clearCache() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          this.loadUserInfo();
          this.loadStats();
          wx.showToast({
            title: '缓存已清理完毕',
            icon: 'success'
          });
        }
      }
    });
  },

  checkUpdate() {
    wx.showToast({
      title: '当前已是最新版本',
      icon: 'success'
    });
  },



  goToOrders(e) {
    const status = e.currentTarget.dataset.status;
    wx.switchTab({
      url: `/pages/order/order?status=${status}`
    });
  },

})
