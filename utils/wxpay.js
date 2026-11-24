const { createWxPayPrepay, getWxPayStatus, mockConfirmWxPay } = require('../services/shop');
const { generateIdempotencyKey } = require('./step');

function requestWechatPayment(payParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType || 'RSA',
      paySign: payParams.paySign,
      success: resolve,
      fail: reject
    });
  });
}

function showMockPayModal(totalAmount, orderCount) {
  return new Promise((resolve) => {
    wx.showModal({
      title: '模拟微信支付（开发模式）',
      content: `即将支付 ${orderCount} 笔订单，合计 ¥${Number(totalAmount || 0).toFixed(2)}。\n商户号申请期间使用模拟支付验证全链路入账。`,
      confirmText: '确认支付',
      confirmColor: '#07C160',
      cancelText: '取消',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollPayResult(outTradeNo, maxAttempts = 6) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const st = await getWxPayStatus(outTradeNo);
    if (st && st.status === 'paid') {
      return st;
    }
    if (st && (st.status === 'closed' || st.status === 'failed')) {
      return st;
    }
    if (i < maxAttempts - 1) {
      await sleep(1000);
    }
  }
  return getWxPayStatus(outTradeNo);
}

/**
 * 统一发起微信小程序支付（支持单单或勾选多单合并支付）
 * @param {number[]} orderIds
 * @returns {Promise<{paid: boolean, cancelled?: boolean, status?: object}>}
 */
async function payOrders(orderIds) {
  const ids = (orderIds || []).map((id) => Number(id)).filter((id) => id > 0);
  if (!ids.length) {
    wx.showToast({ title: '请选择待支付订单', icon: 'none' });
    return { paid: false, cancelled: true };
  }

  wx.showLoading({ title: '正在发起支付...', mask: true });
  let prepay = null;
  try {
    prepay = await createWxPayPrepay(ids, generateIdempotencyKey());
  } finally {
    wx.hideLoading();
  }

  if (!prepay || !prepay.out_trade_no) {
    return { paid: false };
  }

  // 开发/测试期 Mock 模式
  if (prepay.mock_mode) {
    const confirmed = await showMockPayModal(prepay.total_amount, prepay.order_count);
    if (!confirmed) {
      wx.showToast({ title: '已取消支付', icon: 'none' });
      return { paid: false, cancelled: true };
    }
    wx.showLoading({ title: '确认入账中...', mask: true });
    try {
      const status = await mockConfirmWxPay(prepay.out_trade_no);
      wx.showToast({ title: '支付成功', icon: 'success' });
      return { paid: Boolean(status && status.status === 'paid'), status };
    } finally {
      wx.hideLoading();
    }
  }

  // 正式微信小程序支付
  try {
    await requestWechatPayment(prepay.pay_params);
  } catch (err) {
    const msg = (err && err.errMsg) || '';
    if (msg.includes('cancel')) {
      wx.showToast({ title: '已取消支付，可在订单列表继续付款', icon: 'none', duration: 2400 });
      return { paid: false, cancelled: true };
    }
    wx.showToast({ title: '调起微信支付失败，请重试', icon: 'none' });
    return { paid: false };
  }

  wx.showLoading({ title: '正在确认支付结果...', mask: true });
  try {
    const status = await pollPayResult(prepay.out_trade_no);
    if (status && status.status === 'paid') {
      wx.showToast({ title: '支付成功', icon: 'success' });
      return { paid: true, status };
    }
    wx.showToast({ title: '支付处理中，请稍后刷新查看', icon: 'none', duration: 2400 });
    return { paid: false, status };
  } finally {
    wx.hideLoading();
  }
}

module.exports = {
  payOrders
};
