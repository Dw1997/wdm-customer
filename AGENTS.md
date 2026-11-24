# AGENTS.md — 味都美小程序商城 (`wdm-customer`)

纯原生微信小程序（WXML / WXSS / JS），无 npm 构建步骤，打开微信开发者工具即可编译预览。
全局业务规则与页面文档位于主仓库 `docs/01-features/miniprogram/`，接口契约位于 `docs/00-core/api/shop.md`。

## 核心架构约定

1. **无首页，首屏即分类**：底部 4 Tab 为 `分类 / 购物车 / 订单 / 我的`。有历史已送达订单的老客户在分类左侧最顶置顶「★ 常购」并默认选中；新客户/未登录自动隐藏。
2. **默认大字版（适老化）**：目标客户以中老年人为主，默认 `fontScale = 'large'`（对应根节点 `.font-large`）；在「我的」中可切回 `'normal'`（`.font-normal`），持久化在 `wx.setStorageSync('wdm_font_scale')`。所有页面最外层必须绑定 `class="page-root {{fontClass}}"`，并在 `onShow` 同步 `app.globalData.fontClass`。
3. **统一请求层**：所有接口必须经过 `services/shop.js` → `utils/request.js`，禁止页面直接调 `wx.request`。
   - 基础路径统一 `/api/v1`（按 `wx.getAccountInfoSync().miniProgram.envVersion` 区分 `develop` / `trial` / `release`）。
   - 鉴权头 `Authorization: Bearer <access_token>`，`401` 先走 `POST /auth/refresh` 换新令牌，失败再跳登录页。
   - 写操作（提交订单、取消订单、购物车写操作）必须携带 `Idempotency-Key`。
4. **价格与库存红线**：
   - 价格只在服务端计算，前端不算规则价、不传价格字段给后端；未登录显示「登录后可见」、待审核显示「审核通过后可见」，不显示 `0` 或 `¥--`。
   - 不展示任何库存或"有货/无货"文案，不做在线支付，不让客户改送货地址。
5. **数量步进规范**：统一复用 `components/qty-stepper/` 与 `utils/step.js`：点 `+` 按 `0 → 1 → 2 → 5 → 10 → 20 → +10` 跳跃递增，点 `-` 每次减 1，点击数字弹手动输入弹窗。

## 目录结构

```
app.js / app.json / app.wxss / sitemap.json
assets/tabbar/          底部 4 Tab 图标
utils/
  config.js             环境地址配置
  font.js               大字版 / 标准版持久化工具
  step.js               跳跃步进与幂等键生成
  request.js            统一请求封装、401 刷新与错误码处理
services/
  shop.js               接口方法集合
components/
  qty-stepper/          跳跃步进器 + 手动输入弹窗
  spec-sheet/           多规格半屏选择器
pages/
  category/             分类选品（首屏）
  product-detail/       商品详情
  cart/                 购物车
  checkout/             确认订单
  order-list/           订单列表
  order-detail/         订单详情
  mine/                 个人中心（含字体切换、分享码）
  debt/                 我的欠款
  login/                微信登录与手机号绑定
```
