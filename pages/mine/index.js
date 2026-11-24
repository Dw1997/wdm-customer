const app = getApp();
const { getProfile, getShareCode } = require('../../services/shop');
const { clearTokens, hasToken } = require('../../utils/request');

function fmtMoney(val) {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

Page({
  data: {
    fontScale: 'large',
    fontClass: 'font-large',
    customer: null,
    avatarChar: '客',
    debtAmountText: '0.00',
    overdueAmountText: '0.00',
    hasOverdue: false,
    couponAmountText: '0',
    shareThumbUrl: '',
    referralRewardText: '首单得拉新券',
    showShareModal: false,
    shareInfo: {}
  },

  async onShow() {
    this.setData({
      fontScale: app.globalData.fontScale,
      fontClass: app.globalData.fontClass
    });
    await this.loadProfile();
  },

  async loadProfile() {
    await app.ensureSilentLogin();
    if (!hasToken()) {
      app.globalData.customer = null;
      this.setData({
        customer: null,
        couponAmountText: '0',
        shareThumbUrl: '',
        referralRewardText: '首单得拉新券'
      });
      return;
    }
    const profile = await getProfile();
    app.globalData.customer = profile;
    if (!profile) {
      this.setData({
        customer: null,
        couponAmountText: '0',
        shareThumbUrl: '',
        referralRewardText: '首单得拉新券'
      });
      return;
    }
    const debt = Number(profile.debt_amount || 0);
    const overdue = Number(profile.overdue_amount || 0);
    this.setData({
      customer: profile,
      avatarChar: (profile.name || '客').slice(0, 1),
      debtAmountText: debt.toFixed(2),
      overdueAmountText: overdue.toFixed(2),
      hasOverdue: overdue > 0,
      couponAmountText: fmtMoney(profile.available_coupon_amount)
    });

    if (profile.status === 'active') {
      this.loadShareThumb();
    } else {
      this.setData({
        shareThumbUrl: '',
        referralRewardText: '首单得拉新券'
      });
    }
  },

  async loadShareThumb() {
    try {
      const info = await getShareCode(false);
      if (!info) return;
      const thumbUrl = info.qrcode_url || info.poster_url || '';
      const rewardAmt = Number(info.reward_amount || 0);
      const referralRewardText =
        info.reward_enabled && rewardAmt > 0
          ? `首单得¥${fmtMoney(rewardAmt)}券`
          : '分享得拉新券';
      this.setData({
        shareThumbUrl: thumbUrl,
        referralRewardText
      });
    } catch (e) {
      // 缩略图加载失败不阻断个人中心展示
    }
  },

  onSwitchFont(e) {
    const scale = e.currentTarget.dataset.scale;
    const fontClass = app.changeFontScale(scale);
    this.setData({ fontScale: scale, fontClass });
    wx.showToast({
      title: scale === 'large' ? '已切换为大字版（默认）' : '已切换为标准字体',
      icon: 'none'
    });
  },

  goDebt() {
    wx.navigateTo({ url: '/pages/debt/index' });
  },

  goCoupons() {
    wx.navigateTo({ url: '/pages/coupons/index' });
  },

  goReferrals() {
    wx.navigateTo({ url: '/pages/referrals/index' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  callSales() {
    const phone = this.data.customer && this.data.customer.sales_phone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  },

  async openShareCode() {
    const info = await getShareCode();
    this.setData({ shareInfo: info, showShareModal: true });
  },

  closeShareCode() {
    this.setData({ showShareModal: false });
  },

  noop() {},

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将无法查看专属批发价与欠款，确定退出吗？',
      success: (res) => {
        if (!res.confirm) return;
        clearTokens();
        app.globalData.customer = null;
        wx.removeTabBarBadge({ index: 1 });
        this.setData({
          customer: null,
          couponAmountText: '0',
          shareThumbUrl: '',
          referralRewardText: '首单得拉新券'
        });
        wx.showToast({ title: '已退出登录', icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    const code = this.data.shareInfo.share_code || '';
    return {
      title: this.data.shareInfo.share_text || '味都美副食老客户推荐，扫码看批发价',
      path: code ? '/pages/login/index?r=' + code : '/pages/category/index'
    };
  }
});
