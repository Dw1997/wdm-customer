const CDN_ORIGIN = 'https://img.dwhhh.cn';
const COS_ORIGIN_RE = /^https?:\/\/[^/]+\.cos\.[^/]+\.myqcloud\.com(?=\/|$)/i;

const THUMB_PROCESS = 'imageMogr2/thumbnail/300x300/format/webp/quality/80';
const DETAIL_PROCESS = 'imageMogr2/thumbnail/800x/format/webp/quality/85';

/**
 * 将历史腾讯云 COS 源站域名统一替换为 CDN 加速域名。
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.replace(COS_ORIGIN_RE, CDN_ORIGIN);
}

function appendProcess(url, processRule) {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return '';
  if (!normalized.startsWith(CDN_ORIGIN + '/') && !COS_ORIGIN_RE.test(normalized)) {
    return normalized;
  }
  if (normalized.includes('imageMogr2') || normalized.includes('?')) {
    return normalized;
  }
  return `${normalized}?${processRule}`;
}

/**
 * 列表/购物车/确认订单/订单详情/规格弹窗统一缩略图（300x300 WebP），
 * 全端共用同一 URL 以最大化命中微信本地磁盘缓存。
 */
function thumbImage(url) {
  return appendProcess(url, THUMB_PROCESS);
}

/**
 * 商品详情轮播大图（800 宽 WebP）。
 */
function detailImage(url) {
  return appendProcess(url, DETAIL_PROCESS);
}

module.exports = {
  normalizeImageUrl,
  thumbImage,
  detailImage
};
