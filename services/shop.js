const { request } = require('../utils/request');

function getCategories() {
  return request({ url: '/shop/categories' });
}

function getProducts({ categoryId = '', frequent = false, keyword = '', page = 1, pageSize = 20 } = {}) {
  const qs = [];
  if (frequent) qs.push('frequent=true');
  if (categoryId) qs.push('category_id=' + encodeURIComponent(categoryId));
  if (keyword) qs.push('keyword=' + encodeURIComponent(keyword));
  qs.push('page=' + page, 'page_size=' + pageSize);
  return request({ url: '/shop/products?' + qs.join('&') });
}

function getProductDetail(spuId) {
  return request({ url: '/shop/products/' + spuId });
}

function getCart() {
  return request({ url: '/shop/cart', silent: true });
}

function addCartItem(skuId, quantity) {
  return request({
    url: '/shop/cart/items',
    method: 'POST',
    data: { sku_id: skuId, quantity },
    idempotent: true
  });
}

function updateCartItem(skuId, quantity) {
  return request({
    url: '/shop/cart/items/' + skuId,
    method: 'PUT',
    data: { quantity },
    idempotent: true
  });
}

function removeCartItem(skuId) {
  return request({
    url: '/shop/cart/items/' + skuId,
    method: 'DELETE',
    idempotent: true
  });
}

function getCheckoutOptions(goodsAmount) {
  const qs = goodsAmount !== undefined && goodsAmount !== null ? '?goods_amount=' + encodeURIComponent(goodsAmount) : '';
  return request({ url: '/shop/checkout-options' + qs });
}

function getMyCoupons(status = 'unused', page = 1, pageSize = 20) {
  return request({ url: `/shop/coupons?status=${encodeURIComponent(status)}&page=${page}&page_size=${pageSize}` });
}

function createOrder(payload, idempotencyKey) {
  return request({
    url: '/shop/orders',
    method: 'POST',
    data: payload,
    idempotent: true,
    idempotencyKey
  });
}

function getOrders(status = 'all', page = 1, pageSize = 20) {
  const qs = ['page=' + page, 'page_size=' + pageSize];
  if (status && status !== 'all') qs.push('status=' + encodeURIComponent(status));
  return request({ url: '/shop/orders?' + qs.join('&') });
}

function getOrderDetail(orderId) {
  return request({ url: '/shop/orders/' + orderId });
}

function cancelOrder(orderId, idempotencyKey) {
  return request({
    url: '/shop/orders/' + orderId + '/cancel',
    method: 'POST',
    idempotent: true,
    idempotencyKey
  });
}

function createWxPayPrepay(orderIds, idempotencyKey) {
  return request({
    url: '/shop/wx-pay/prepay',
    method: 'POST',
    data: { order_ids: orderIds },
    idempotent: true,
    idempotencyKey
  });
}

function getWxPayStatus(outTradeNo) {
  return request({
    url: '/shop/wx-pay/' + encodeURIComponent(outTradeNo) + '/status',
    silent: true
  });
}

function mockConfirmWxPay(outTradeNo) {
  return request({
    url: '/shop/wx-pay/' + encodeURIComponent(outTradeNo) + '/mock-confirm',
    method: 'POST',
    idempotent: true
  });
}

function getProfile() {
  return request({ url: '/shop/profile', silent: true });
}

function getShareCode(refresh) {
  return request({ url: refresh ? '/shop/share-code?refresh=true' : '/shop/share-code' });
}

function getMyReferrals() {
  return request({ url: '/shop/referrals' });
}

function getMyCredit() {
  return request({ url: '/finance/credit/me' });
}

function getMyStatements() {
  return request({ url: '/finance/statements/me' });
}

function wechatLogin(payload) {
  return request({
    url: '/auth/wechat-login',
    method: 'POST',
    data: payload,
    silent: true,
    skipAuth: true
  });
}

function wechatBindPhone(payload) {
  return request({
    url: '/auth/wechat-bind-phone',
    method: 'POST',
    data: payload,
    skipAuth: true
  });
}

module.exports = {
  getCategories,
  getProducts,
  getProductDetail,
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  getCheckoutOptions,
  getMyCoupons,
  createOrder,
  getOrders,
  getOrderDetail,
  cancelOrder,
  createWxPayPrepay,
  getWxPayStatus,
  mockConfirmWxPay,
  getProfile,
  getShareCode,
  getMyReferrals,
  getMyCredit,
  getMyStatements,
  wechatLogin,
  wechatBindPhone
};
