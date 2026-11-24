const app = getApp();
const { wechatLogin, wechatBindPhone } = require('../../services/shop');
const { setTokens, getAccessToken } = require('../../utils/request');

function wxLoginCode() {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => resolve((res && res.code) || ''),
      fail: () => resolve('')
    });
  });
}

Page({
  data: {
    fontClass: 'font-large',
    agreed: true,
    hasReferral: false,
    submitting: false,
    blockReason: '',
    contactPhone: '13800138000'
  },

  async onShow() {
    const ref = app.getValidReferral();
    this.setData({
      fontClass: app.globalData.fontClass,
      hasReferral: !!(ref && (ref.sales_code || ref.share_code))
    });
    if (!getAccessToken()) {
      await this.trySilentWechatLogin();
    }
  },

  async trySilentWechatLogin() {
    const code = await wxLoginCode();
    if (!code) return;
    try {
      const res = await wechatLogin({ code });
      if (res && !res.need_bind_phone && res.access_token) {
        setTokens(res.access_token, res.refresh_token);
        if (res.customer) app.globalData.customer = res.customer;
        wx.switchTab({ url: '/pages/category/index' });
      }
    } catch (err) {
      if (err && err.code === 'customer_login_disabled') {
        const salesPhone = err.details && err.details.sales_phone;
        this.setData({
          blockReason: err.message || '您的账号已被限制登录，请联系业务员核实。',
          contactPhone: salesPhone || this.data.contactPhone
        });
      }
    }
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  async onGetPhoneNumber(e) {
    if (this.data.submitting) return;
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意用户协议与隐私政策', icon: 'none' });
      return;
    }

    if (!e.detail || !e.detail.code) {
      wx.showToast({ title: '已取消手机号授权', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const loginCode = await wxLoginCode();
      if (!loginCode) {
        wx.showToast({ title: '获取微信登录凭证失败，请重试', icon: 'none' });
        return;
      }
      const ref = app.getValidReferral() || {};
      const res = await wechatBindPhone({
        code: loginCode,
        phone_code: e.detail.code,
        sales_code: ref.sales_code || undefined,
        share_code: ref.share_code || undefined
      });
      if (res && res.access_token) {
        setTokens(res.access_token, res.refresh_token);
      }
      if (res && res.customer) {
        app.globalData.customer = res.customer;
        if (res.customer.status === 'login_disabled') {
          this.setData({
            blockReason: res.customer.reject_reason || '您的账号已被限制登录，请联系业务员核实。',
            contactPhone: res.customer.sales_phone || this.data.contactPhone
          });
          return;
        }
      }
      app.clearReferral();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/category/index' });
      }, 600);
    } catch (err) {
      if (err && err.code === 'phone_bound_other_wechat') {
        this.setData({
          blockReason: '该手机号已绑定其他微信，请联系专属业务员为您解绑后重新登录。'
        });
      } else if (err && err.code === 'customer_login_disabled') {
        const salesPhone = err.details && err.details.sales_phone;
        this.setData({
          blockReason: err.message || '您的账号已被限制登录，请联系业务员核实。',
          contactPhone: salesPhone || this.data.contactPhone
        });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  onSkip() {
    wx.switchTab({ url: '/pages/category/index' });
  },

  callShop() {
    wx.makePhoneCall({ phoneNumber: this.data.contactPhone });
  }
});
