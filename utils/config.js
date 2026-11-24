/**
 * 接口环境配置（按微信 envVersion 自动切换）
 */
const BASE_URLS = {
  develop: 'http://127.0.0.1:9020/api/v1',
  trial: 'https://twdm.dwhhh.cn/api/v1',
  release: 'https://pwdm.dwhhh.cn/api/v1'
};

function getBaseUrl() {
  try {
    const info = wx.getAccountInfoSync();
    const env = info && info.miniProgram && info.miniProgram.envVersion;
    return BASE_URLS[env] || BASE_URLS.develop;
  } catch (e) {
    return BASE_URLS.develop;
  }
}

module.exports = {
  getBaseUrl
};
