const { getFontClass, getFontScale, setFontScale } = require('./utils/font');
const { getCart, wechatLogin } = require('./services/shop');
const { hasToken, setTokens } = require('./utils/request');

const REF_KEY = 'wdm_referral_info';
const REF_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function wxLoginCode() {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => resolve((res && res.code) || ''),
      fail: () => resolve('')
    });
  });
}

App({
  globalData: {
    fontScale: 'large',
    fontClass: 'font-large',
    customer: null,
    cartCount: 0,
    pendingPromoAutoLogin: false
  },

  _silentLoginDone: false,
  _silentLoginPromise: null,

  onLaunch(options) {
    this.syncFontFromStorage();
    this.captureReferral(options);
  },

  onShow(options) {
    this.captureReferral(options);
  },

  /**
   * 首次进入小程序时尝试一次微信静默登录（单飞，不重复发请求）：
   * 已绑定微信的老客户自动拿到令牌进入正常态；未绑定或失败则维持游客浏览态。
   */
  async ensureSilentLogin() {
    if (hasToken() || this._silentLoginDone) return hasToken();
    if (!this._silentLoginPromise) {
      this._silentLoginPromise = (async () => {
        try {
          const code = await wxLoginCode();
          if (!code) return false;
          const res = await wechatLogin({ code });
          if (res && !res.need_bind_phone && res.access_token) {
            setTokens(res.access_token, res.refresh_token);
            if (res.customer) this.globalData.customer = res.customer;
            return true;
          }
          return false;
        } catch (e) {
          return false;
        } finally {
          this._silentLoginDone = true;
          this._silentLoginPromise = null;
        }
      })();
    }
    return this._silentLoginPromise;
  },

  syncFontFromStorage() {
    const scale = getFontScale();
    this.globalData.fontScale = scale;
    this.globalData.fontClass = getFontClass(scale);
  },

  changeFontScale(scale) {
    const next = setFontScale(scale);
    this.globalData.fontScale = next;
    this.globalData.fontClass = getFontClass(next);
    return this.globalData.fontClass;
  },

  /**
   * 启动或扫码时记录销售推广码（s=）或客户分享码（r=），本地保存 7 天
   */
  captureReferral(options) {
    if (!options) return;
    const query = options.query || {};
    let salesCode = query.s || '';
    let shareCode = query.r || '';
    if (query.scene) {
      try {
        const decoded = decodeURIComponent(query.scene);
        decoded.split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k === 's' && v) salesCode = v;
          if (k === 'r' && v) shareCode = v;
        });
      } catch (e) {
        // 忽略非法 scene
      }
    }
    if (salesCode || shareCode) {
      // 7 天内多次扫码以最后一次有效扫码为准覆盖（Last-Touch）
      wx.setStorageSync(REF_KEY, {
        sales_code: salesCode || null,
        share_code: shareCode || null,
        saved_at: Date.now()
      });
      if (!hasToken()) {
        this.globalData.pendingPromoAutoLogin = true;
      }
    }
  },

  getValidReferral() {
    const info = wx.getStorageSync(REF_KEY);
    if (!info || !info.saved_at) return null;
    if (Date.now() - info.saved_at > REF_TTL_MS) {
      wx.removeStorageSync(REF_KEY);
      return null;
    }
    return info;
  },

  clearReferral() {
    wx.removeStorageSync(REF_KEY);
  },

  /**
   * 刷新底部购物车 Tab 角标
   */
  async refreshCartBadge() {
    if (!hasToken()) {
      this.globalData.cartCount = 0;
      wx.removeTabBarBadge({ index: 1 });
      return null;
    }
    try {
      const data = await getCart();
      const count = (data && data.total_quantity) || 0;
      this.globalData.cartCount = count;
      if (count > 0) {
        wx.setTabBarBadge({
          index: 1,
          text: count > 99 ? '99+' : String(count)
        });
      } else {
        wx.removeTabBarBadge({ index: 1 });
      }
      return data;
    } catch (e) {
      return null;
    }
  }
});
