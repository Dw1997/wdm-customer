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
    tipMsg: '',
    tipType: '',
    showTip: false
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
    const orders = wx.getStorageSync('orders') || [];
    
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + parseFloat(order.totalPrice || 0), 0);
    const unsettledAmount = orders
      .filter(order => order.status === '待处理' || order.status === '未送达' || order.status === '已送达未支付')
      .reduce((sum, order) => sum + parseFloat(order.totalPrice || 0), 0);

    this.setData({
      stats: {
        unsettledAmount: unsettledAmount.toFixed(1),
        totalOrders,
        totalAmount: totalAmount.toFixed(1)
      }
    });
  },

  editProfile() {
    if (!this.data.customerInfo.isBound) {
      this.showTip('账号尚未与客户信息关联，请联系管理员', 'warn');
      return;
    }
    
    wx.showToast({
      title: '编辑个人资料',
      icon: 'none'
    });
  },

  goToAddress() {
    if (!this.data.customerInfo.isBound) {
      this.showTip('账号尚未与客户信息关联，请联系管理员', 'warn');
      return;
    }
    
    wx.showToast({
      title: '收货地址',
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
          title: '拨号失败，请检查权限',
          icon: 'none'
        });
      }
    });
  },

  goToAbout() {
    wx.showToast({
      title: '关于我们',
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
          this.showTip('缓存已清除', 'success');
        }
      }
    });
  },

  checkUpdate() {
    this.showTip('已是最新版本', 'success');
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('customerInfo');
          wx.removeStorageSync('isLogin');
          
          // 退出登录后跳转到登录页面
          wx.redirectTo({
            url: '/pages/login/login?from=profile'
          });
        }
      }
    });
  },

  goToOrders(e) {
    if (!this.data.customerInfo.isBound) {
      this.showTip('账号尚未与客户信息关联，请联系管理员', 'warn');
      return;
    }
    
    const status = e.currentTarget.dataset.status;
    wx.switchTab({
      url: '/pages/order/order'
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
})
