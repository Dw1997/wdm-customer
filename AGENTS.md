# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

This repository is the WeChat Mini Program (微信小程序) frontend for the 味都美副食商城 customer app (副食 B2C ordering). It is a native mini program using the WeUI component library; the backend is a separate service, and the API contract lives in `api.md`.

## Build, Test, and Development Commands

- `npm install` — install dependencies (`weui-miniprogram`).
- Open the project root in WeChat DevTools, then run **工具 → 构建 npm** to regenerate `miniprogram_npm/`.
- There is no CLI build; compile and preview from DevTools.
- `npm test` is a placeholder — no automated tests are configured. Verify changes manually in the DevTools simulator.

## High-Level Architecture

### Environment & API Configuration

Base URL is resolved at runtime in `app.js` `onLaunch` via `wx.getAccountInfoSync().miniProgram.envVersion`:

| envVersion | baseUrl |
|---|---|
| `release` (正式版) | `https://pwdm.dwhhh.cn/miniapi` |
| `trial` (体验版) | `https://twdm.dwhhh.cn/miniapi` |
| `develop` (开发版) | `http://192.168.100.108:5001/miniapi` |

The resolved URL is stored as `app.globalData.baseUrl` and accessed by pages via `getApp().globalData.baseUrl`. **Never hardcode API URLs** — always read from `globalData.baseUrl`.

### Authentication & Login Flow

Login is a two-stage process coordinated between `app.js` and `pages/login/login.js`:

1. **Silent login** (`app.js` → `silentLogin` → `sendCodeToServer`): On app launch, `wx.login` gets a `code`, posted to `/silentLogin`. The backend returns `{ token, hasPhone, userInfo, customerInfo }`. The `token` is stored via `wx.setStorageSync('token')`.
2. **Phone binding** (`login.js` → `onGetPhoneNumber` → `bindPhone`): If `hasPhone` is false, the user is not fully logged in (`isLogin` stays `false`). The user taps the phone-number button, which yields `encryptedData` + `iv`, posted to `/bindPhone` with the `token` header. On success, `isLogin` is set to `true`.

**Token convention**: every authenticated request sends `{ 'token': token }` in the header, where `token` comes from `wx.getStorageSync('token')`. When the backend returns code `401`/`402`/`403`, pages clear the token and redirect to `/pages/login/login`.

**Login callback**: `app.setLoginCallback(fn)` / `app.triggerLoginCallback()` lets pages register a one-shot callback that fires after silent login completes (used to defer data loading until the token is available). The callback fires only once and is then nulled.

### Cart Architecture (Local-First with Backend Sync)

The cart is the most architecturally significant module. It is **local-first**: the source of truth during a session is `wx.getStorageSync('cart')`, and changes are pushed to the backend asynchronously.

- **Cart item shape**: `{ product_id, sku_id, code, name, image, count, sku_selling_price, sku_specification, sku_unit }`. Items are uniquely identified by the composite key `product_id + '_' + sku_id`.
- **Backend sync on login**: After silent login (when `hasPhone` is true), `app.getCartFromBackend()` fetches `/cart` (GET) and calls `app.mergeCarts(backendCart, localCart)`. The merge takes the union of both carts; for the same SKU it keeps the **larger** count. Items present only locally are uploaded via `/cart` (POST).
- **Incremental sync**: Each page that modifies the cart (index, category, goodsDetail, cart) calls its own `uploadCartToBackend(goodsId, skuId, count, price)` to POST to `/cart`. Setting `count: 0` is the delete convention.
- **Cart page load**: `pages/cart/cart.js` calls `getApp().getCartFromBackend(callback)` on `onLoad`/`onShow` before rendering, ensuring the local cart is reconciled with the backend.
- **Order cancellation → cart restore**: When an order is cancelled (`/orders/:id/cancel`), the backend returns items to the cart; pages call `getApp().getCartFromBackend()` to sync.

### SKU & Product Data Model

Products (`goods`) have a `skus` array. Each SKU has: `sku_id`, `sku_unit`, `sku_selling_price`, `sku_specification`, `sku_is_default`.

Pages transform backend goods into a flat UI model via a `transformGoods` function (present in index.js, category.js). The transformation:
- Picks the default SKU (`sku_is_default === true` or first).
- Builds parallel lookup maps: `prices[unit]`, `specsMap[unit]`, `skuIdMap[unit]`, plus a `units` array.
- When the user switches unit, the page reads `skuIdMap[unit]` to get the new `skuId` and `prices[unit]` for the new price, then checks the cart for the new SKU's existing count.

**Type pitfall**: `sku_id` arrives as strings from `wx.request` responses in some contexts and as numbers in others. The codebase defensively uses `==` (loose equality) for `product_id` / `sku_id` comparisons in cart lookups, and `Number(sku.sku_id)` when building maps. When adding new cart logic, match the existing `==` convention for cross-type ID comparisons or explicitly normalize with `Number()`.

### Quantity Increment Pattern

All goods-listing pages (index, category, cart, goodsDetail) use a **non-linear increment rule** for the "+" button, defined identically in each page's `increaseCount`/`updateGoodsCount`:

```javascript
const increments = [1, 2, 5, 10, 20];
// currentCount 0 → 1 → 2 → 5 → 10 → 20, then +10 each tap
```

The "−" button always decrements by 1 (floor at 0, which removes the item from the cart). If you add a new page with add-to-cart UI, replicate this exact rule for consistency.

### Page Architecture Patterns

- **index (首页)**: Banner carousel + recommended goods with **page preloading**. `preloadNextPage()` fetches the next page in the background after the current page renders; `usePreloadedData()` swaps in the cached result on `onReachBottom`. Includes an in-page search modal that overlays the goods list.
- **category (分类)**: Left-menu / right-scroll two-column layout. `calcSectionsTop()` measures each category section's offset via `wx.createSelectorQuery`; `onGoodsScroll` (throttled to 100ms) maps scroll position to the active category. Includes **scroll-based preloading** (`preloadCategories`) that loads category goods before they enter the viewport.
- **cart (购物车)**: Checkout entry point. `submitOrder()` POSTs checked items to `/submitOrder`, then clears purchased items from local storage and switches to the order tab. Guards on `isLogin` before allowing checkout.
- **order (订单)**: Status-filtered list from `/orders`. Converts backend fields (`order_id`, `create_at`, `total_amount`, `delivery_status`, `payment_status`) to frontend display text via `getStatusText` / `getDeliveryStatusText` / `getPaymentStatusText` maps.
- **goodsDetail (商品详情)**: SKU selection modal (`showQuantityDialog`) with per-SKU count tracking via `skuCounts` map. Supports add-to-cart and buy-now flows. Buy-now posts to `/order/buynow`.
- **login (登录)**: Phone-number authorization button. `from` query param controls post-login navigation (cart → navigateBack, order → switchTab, default → profile).
- **profile (个人中心)**: Guarded page — redirects to login if `isLogin` is false. Loads stats from `/shop/stats`.

### Data Persistence & Storage Keys

All state is stored via `wx.setStorageSync` / `wx.getStorageSync`:

| Key | Type | Purpose |
|---|---|---|
| `token` | string | Auth token from `/silentLogin` and `/bindPhone` |
| `isLogin` | boolean | True only after phone binding completes |
| `cart` | array | Local cart (merged with backend on login) |
| `userInfo` | object | WeChat user profile |
| `customerInfo` | object | Business customer info (name, phone, isVip, isBound) |
| `orders` | array | **Cleared on every app launch** (`onLaunch`), `onHide`, and `onUnload`; always re-fetched from backend |

## API Contract Notes

- All endpoints return `{ code, message, data }`; treat `code === 200` as success.
- **`api.md` is partially outdated**: it documents `globalData.api.baseUrl` / `globalData.api.categoryUrl` and a `goodsId`/`count`/`unit` cart payload, but the actual code uses a single `globalData.baseUrl` and cart POSTs `{ product_id, sku_id, count, sku_selling_price }`. When changing API calls, update both the code and `api.md`, and verify against the real backend response shapes.
- Some list endpoints return a bare array; others return `{ hasMore, list }`. Page code handles both formats defensively — preserve this dual-format handling when adding new list consumers.

## Coding Style & Naming Conventions

- Two-space indentation (configured in `project.config.json`); ES6 syntax enabled.
- `camelCase` for JavaScript identifiers: `loadBanners`, `refreshCartCounts`, `hasMore`.
- `snake_case` for backend API fields: `product_id`, `sku_id`, `sku_selling_price`.
- Comments and UI copy are in Chinese; keep new comments consistent.
- Use `console.log` / `console.error` for debugging (left in production code intentionally).
- Register WeUI components in `app.json` `usingComponents` via `miniprogram_npm/weui-miniprogram/...`.
- Global theme colors live in `app.globalData.colors` (primary `#003183`); the navigation bar and tab bar use the same primary color.

## Commit & Pull Request Guidelines

- Commit messages are short, single-line, imperative, and written in Chinese with a verb prefix:
  - `修复...` (fix), `优化...` (optimize), `完成...` (complete), `添加...` (add), `实现...` (implement).
  - Example: `修复购物车商品和取消订单商品合并问题`.
- Branch flow: work lands on `dev`, then `test`, then `prod`; `main` stays stable.
- Pull requests: describe the change, name the affected pages, attach simulator screenshots for UI changes, and flag any backend API dependencies.

## Agent-Specific Instructions

- Never commit generated files (`miniprogram_npm/`, `node_modules/`, `.env`).
- Do not hardcode API URLs; base URL resolution lives in `app.js` and is environment-aware.
- When changing API calls, update `api.md` and keep the `token` request-header convention.
- The `transformGoods` SKU-flattening logic and the quantity increment rule (`[1, 2, 5, 10, 20]`) are duplicated across multiple pages. If you change one, update all copies to avoid behavior drift.
