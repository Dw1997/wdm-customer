const app = getApp();
const { getShareCode, getMyReferrals } = require('../../services/shop');

function fmtMoney(val) {
  const n = Number(val || 0);
  return Number.isFinite(n) ? (n % 1 === 0 ? String(n) : n.toFixed(2)) : '0';
}

function fmtDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

Page({
  data: {
    fontClass: 'font-large',
    shareInfo: {},
    rewardEnabled: true,
    rewardAmountText: '10',
    couponMinAmount: 0,
    couponMinAmountText: '0',
    couponValidDays: 30,
    totalRewardAmountText: '0',
    summary: {
      total_invited: 0,
      pending_audit_count: 0,
      pending_order_count: 0,
      rewarded_count: 0
    },
    items: []
  },

  async onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    await this.loadAll();
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  async loadAll() {
    try {
      const [shareInfo, referrals] = await Promise.all([
        getShareCode(false),
        getMyReferrals()
      ]);
      const rewardEnabled = Boolean(
        referrals && referrals.reward_enabled !== undefined
          ? referrals.reward_enabled
          : shareInfo && shareInfo.reward_enabled
      );
      const rewardAmount = (referrals && referrals.reward_amount) || (shareInfo && shareInfo.reward_amount) || 10;
      const couponMin = Number((referrals && referrals.coupon_min_amount) || 0);
      const validDays = Number((referrals && referrals.coupon_valid_days) || 30);
      const items = ((referrals && referrals.items) || []).map((item) => ({
        ...item,
        registeredAtText: fmtDate(item.registered_at),
        rewardAmountText: item.reward_amount != null ? fmtMoney(item.reward_amount) : ''
      }));

      this.setData({
        shareInfo: shareInfo || {},
        rewardEnabled,
        rewardAmountText: fmtMoney(rewardAmount),
        couponMinAmount: couponMin,
        couponMinAmountText: fmtMoney(couponMin),
        couponValidDays: validDays,
        totalRewardAmountText: fmtMoney(referrals && referrals.total_reward_amount),
        summary: {
          total_invited: Number((referrals && referrals.total_invited) || 0),
          pending_audit_count: Number((referrals && referrals.pending_audit_count) || 0),
          pending_order_count: Number((referrals && referrals.pending_order_count) || 0),
          rewarded_count: Number((referrals && referrals.rewarded_count) || 0)
        },
        items
      });
    } catch (e) {
      // 错误提示由 request.js 统一处理
    }
  },

  previewQrcode() {
    const url = this.data.shareInfo && this.data.shareInfo.qrcode_url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  saveQrcode() {
    const url = this.data.shareInfo && this.data.shareInfo.qrcode_url;
    if (!url) return;
    wx.showLoading({ title: '正在保存...' });
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({ title: '下载图片失败', icon: 'none' });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '请允许保存图片到相册', icon: 'none' });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载图片失败', icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    const code = (this.data.shareInfo && this.data.shareInfo.share_code) || '';
    const title =
      (this.data.shareInfo && this.data.shareInfo.share_text) ||
      '味都美副食老客户推荐，扫码看批发价直接下单';
    return {
      title,
      path: code ? '/pages/category/index?r=' + code : '/pages/category/index'
    };
  }
});
