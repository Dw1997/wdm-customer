const { getBaseUrl } = require('./config');
const { generateIdempotencyKey } = require('./step');

const TOKEN_KEY = 'wdm_access_token';
const REFRESH_KEY = 'wdm_refresh_token';

const ERROR_MESSAGES = {
  customer_order_disabled: '您的账户暂不能下单，请联系业务员',
  overdue_blocked: '有逾期欠款，请先结清后再下单',
  freight_line_unavailable: '该线路今天已停止收货，请改选其他方式',
  sku_unavailable: '有商品已下架，请回购物车调整',
  sku_disabled: '商品规格已停用，请重新选择',
  sku_not_on_shop: '该商品已下架',
  order_not_cancellable: '订单已出车或已交车，如需调整请联系业务员',
  phone_bound_other_wechat: '该手机号已绑定其他微信，请联系业务员'
};

let refreshingPromise = null;

function getAccessToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function hasToken() {
  return Boolean(wx.getStorageSync(TOKEN_KEY) || wx.getStorageSync(REFRESH_KEY));
}

function setTokens(accessToken, refreshToken) {
  if (accessToken) wx.setStorageSync(TOKEN_KEY, accessToken);
  if (refreshToken) wx.setStorageSync(REFRESH_KEY, refreshToken);
}

function clearTokens() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(REFRESH_KEY);
}

function isOnLoginPage() {
  try {
    const pages = getCurrentPages();
    const top = pages && pages[pages.length - 1];
    return Boolean(top && top.route === 'pages/login/index');
  } catch (e) {
    return false;
  }
}

function rawRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

async function tryRefreshToken() {
  const refreshToken = wx.getStorageSync(REFRESH_KEY);
  if (!refreshToken) return false;
  if (!refreshingPromise) {
    refreshingPromise = rawRequest({
      url: getBaseUrl() + '/auth/refresh',
      method: 'POST',
      data: { refresh_token: refreshToken },
      header: { 'Content-Type': 'application/json' }
    })
      .then((res) => {
        const okCode = res.data && (res.data.code === 0 || res.data.code === 200);
        if (res.statusCode === 200 && okCode && res.data.data) {
          setTokens(res.data.data.access_token, res.data.data.refresh_token);
          return true;
        }
        clearTokens();
        return false;
      })
      .catch(() => {
        clearTokens();
        return false;
      })
      .finally(() => {
        refreshingPromise = null;
      });
  }
  return refreshingPromise;
}

/**
 * 统一请求入口：拼 /api/v1、带 Bearer 令牌、解信封、401 自动刷新、写操作带幂等键
 */
async function request({
  url,
  method = 'GET',
  data = null,
  idempotent = false,
  idempotencyKey = '',
  silent = false,
  skipAuth = false
}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = skipAuth ? '' : getAccessToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (idempotent || method === 'POST' || method === 'PUT' || method === 'DELETE') {
    headers['Idempotency-Key'] = idempotencyKey || generateIdempotencyKey();
  }

  const res = await rawRequest({
    url: getBaseUrl() + url,
    method,
    data,
    header: headers
  });

  if (res.statusCode === 401 && !skipAuth) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request({ url, method, data, idempotent, idempotencyKey, silent, skipAuth });
    }
    clearTokens();
    if (silent) {
      return null;
    }
    if (!isOnLoginPage()) {
      wx.navigateTo({ url: '/pages/login/index' });
    }
    const err = new Error('请先登录');
    err.code = 'unauthorized';
    err.statusCode = 401;
    throw err;
  }

  const body = res.data || {};
  if (res.statusCode >= 200 && res.statusCode < 300 && (body.code === 0 || body.code === 200)) {
    return body.data;
  }

  const errCode = body.error_code || '';
  const msg = ERROR_MESSAGES[errCode] || body.message || '请求失败，请稍后重试';
  if (!silent) {
    wx.showToast({ title: msg, icon: 'none', duration: 2200 });
  }
  const err = new Error(msg);
  err.code = errCode;
  err.statusCode = res.statusCode;
  err.details = body.data || null;
  throw err;
}

module.exports = {
  request,
  getAccessToken,
  hasToken,
  setTokens,
  clearTokens,
  ERROR_MESSAGES
};
