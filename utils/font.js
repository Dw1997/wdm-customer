const FONT_KEY = 'wdm_font_scale';

/**
 * 获取字体模式：默认大字版 'large'，可选标准版 'normal'
 */
function getFontScale() {
  const saved = wx.getStorageSync(FONT_KEY);
  return saved === 'normal' ? 'normal' : 'large';
}

function setFontScale(scale) {
  const next = scale === 'normal' ? 'normal' : 'large';
  wx.setStorageSync(FONT_KEY, next);
  return next;
}

function getFontClass(scale) {
  return (scale || getFontScale()) === 'normal' ? 'font-normal' : 'font-large';
}

module.exports = {
  getFontScale,
  setFontScale,
  getFontClass
};
