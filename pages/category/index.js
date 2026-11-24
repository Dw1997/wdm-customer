const app = getApp();
const {
  getCategories,
  getProducts,
  getProductDetail,
  updateCartItem,
  getProfile
} = require('../../services/shop');
const { hasToken } = require('../../utils/request');
const { thumbImage } = require('../../utils/image');

const PAGE_SIZE = 20;
const PRELOAD_BUFFER_PX = 900;

Page({
  data: {
    fontClass: 'font-large',
    categories: [],
    activeCatId: '',
    activeCatNavId: '',
    subCategories: [],
    activeSubCatId: '',
    keyword: '',
    paneTitle: '★ 常购商品',
    paneSub: '常买置顶',

    // 无级分类流状态
    isFilterMode: false,
    sections: [],
    streamStartIdx: 0,
    streamEndIdx: -1,
    prevCatName: '',
    prevRefreshing: false,
    prevLoading: false,
    streamLoading: false,
    streamHasMore: false,
    streamScrollTop: 0,
    scrollIntoView: '',
    scrollWithAnim: false,

    // 搜索 / 二级子分类筛选状态
    filterProducts: [],
    filterTotal: 0,
    filterPage: 1,
    filterHasMore: false,
    filterLoading: false,
    filterScrollTop: 0,

    // 购物车与弹窗
    cartMap: {},
    spuCartMap: {},
    noticeText: '',
    showLoginBtn: false,
    sheetVisible: false,
    sheetProduct: {}
  },

  _searchTimer: null,
  _filterRequestSeq: 0,
  _streamVersion: 0,
  _loadingStream: false,
  _loadingPrev: false,
  _scrollTop: 0,
  _lastScrollTop: 0,
  _touchStartY: 0,
  _touchStartScrollTop: 0,
  _viewportHeight: 600,
  _contentHeight: 0,
  _sectionOffsets: [],
  _navLockUntil: 0,

  async onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    const prevCustomerId = app.globalData.customer ? app.globalData.customer.id : null;
    const prevStatus = app.globalData.customer ? app.globalData.customer.status : null;
    await this.syncProfileAndCart();
    const curCustomerId = app.globalData.customer ? app.globalData.customer.id : null;
    const curStatus = app.globalData.customer ? app.globalData.customer.status : null;
    const authChanged = prevCustomerId !== curCustomerId || prevStatus !== curStatus;

    if (!this.data.categories.length || authChanged) {
      await this.loadCategories();
    } else {
      this.syncProductCartCounts();
    }
  },

  onHide() {
    this.clearSearchTimer();
  },

  onUnload() {
    this.clearSearchTimer();
  },

  clearSearchTimer() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
  },

  applyCartData(cartData) {
    const cartMap = {};
    const spuCartMap = {};
    let totalQty = 0;
    if (cartData && Array.isArray(cartData.items)) {
      cartData.items.forEach((it) => {
        if (it.invalid_reason) return;
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) return;
        cartMap[it.sku_id] = qty;
        spuCartMap[it.spu_id] = (spuCartMap[it.spu_id] || 0) + qty;
        totalQty += qty;
      });
    }
    const badgeCount = cartData && typeof cartData.total_quantity === 'number'
      ? cartData.total_quantity
      : totalQty;
    app.globalData.cartCount = badgeCount;
    if (badgeCount > 0) {
      wx.setTabBarBadge({
        index: 1,
        text: badgeCount > 99 ? '99+' : String(badgeCount)
      });
    } else {
      wx.removeTabBarBadge({ index: 1 });
    }

    const updatedSections = this.data.sections.map((sec) => ({
      ...sec,
      products: sec.products.map((p) => ({
        ...p,
        cartCount: spuCartMap[p.spu_id] || 0
      }))
    }));
    const updatedFilterProducts = this.data.filterProducts.map((p) => ({
      ...p,
      cartCount: spuCartMap[p.spu_id] || 0
    }));

    this.setData({
      cartMap,
      spuCartMap,
      sections: updatedSections,
      filterProducts: updatedFilterProducts
    });
  },

  syncProductCartCounts() {
    const { spuCartMap, sections, filterProducts } = this.data;
    const patch = {};
    if (sections.length) {
      patch.sections = sections.map((sec) => ({
        ...sec,
        products: sec.products.map((p) => ({
          ...p,
          cartCount: spuCartMap[p.spu_id] || 0
        }))
      }));
    }
    if (filterProducts.length) {
      patch.filterProducts = filterProducts.map((p) => ({
        ...p,
        cartCount: spuCartMap[p.spu_id] || 0
      }));
    }
    if (Object.keys(patch).length) {
      this.setData(patch);
    }
  },

  async syncProfileAndCart() {
    await app.ensureSilentLogin();
    if (!hasToken()) {
      app.globalData.customer = null;
      this.setData({
        noticeText: '登录后查看您的专属批发价',
        showLoginBtn: true
      });
      this.applyCartData(null);
      if (app.globalData.pendingPromoAutoLogin) {
        app.globalData.pendingPromoAutoLogin = false;
        wx.navigateTo({ url: '/pages/login/index' });
      }
      return;
    }

    let profile = null;
    try {
      profile = await getProfile();
    } catch (e) {
      profile = null;
    }
    app.globalData.customer = profile;
    let noticeText = '';
    let showLoginBtn = false;
    if (!profile) {
      noticeText = '登录后查看您的专属批发价';
      showLoginBtn = true;
    } else if (profile.status === 'pending') {
      noticeText = '您的账号正在审核中，通过后可看价下单';
    }
    this.setData({ noticeText, showLoginBtn });

    const cartData = await app.refreshCartBadge();
    this.applyCartData(cartData);
  },

  formatProductCard(p, spuCartMap) {
    return {
      ...p,
      image_url: thumbImage(p.image_url),
      shortTitle: (p.name || '').slice(0, 2),
      priceText: p.price !== null && p.price !== undefined ? Number(p.price).toFixed(2) : '',
      priceHiddenText: p.price_hidden_reason === 'login_required' ? '登录后可见' : '审核通过后可见',
      cartCount: spuCartMap[p.spu_id] || 0
    };
  },

  makeSection(cat, catIndex) {
    return {
      id: cat.id,
      catIndex,
      name: cat.name,
      isFreq: cat.isFreq,
      title: cat.isFreq ? '★ 常购商品' : cat.name,
      subTitle: cat.isFreq ? '按历史已送达订单置顶' : '',
      products: [],
      total: 0,
      page: 0,
      hasMore: true,
      loaded: false,
      loading: false
    };
  },

  buildHeaderPatch(catId) {
    const cat = this.data.categories.find((c) => c.id === catId);
    const sec = this.data.sections.find((s) => s.id === catId);
    if (!cat) {
      return {
        activeCatId: '',
        activeCatNavId: '',
        subCategories: [],
        paneTitle: '全部商品',
        paneSub: '0 款'
      };
    }
    const paneTitle = cat.isFreq ? '★ 常购商品' : cat.name;
    let paneSub = '';
    if (cat.isFreq) {
      paneSub = '按历史已送达订单置顶';
    } else if (sec && sec.loaded) {
      paneSub = `${sec.total} 款`;
    }
    return {
      activeCatId: cat.id,
      activeCatNavId: 'cat-' + cat.id,
      subCategories: cat.children || [],
      paneTitle,
      paneSub
    };
  },

  async loadCategories() {
    try {
      const res = await getCategories();
      const list = [];
      if (res && res.has_frequent) {
        list.push({ id: 'freq', name: '常购', isFreq: true, children: [] });
      }
      ((res && res.items) || []).forEach((c) => {
        const children = (c.children || []).map((ch) => ({
          id: String(ch.id),
          name: ch.name
        }));
        list.push({
          id: String(c.id),
          name: c.name,
          isFreq: false,
          children
        });
      });

      this.setData({
        categories: list,
        keyword: '',
        activeSubCatId: '',
        isFilterMode: false
      });

      if (!list.length) {
        this.setData({
          sections: [],
          activeCatId: '',
          activeCatNavId: '',
          subCategories: [],
          paneTitle: '全部商品',
          paneSub: '0 款',
          streamHasMore: false,
          streamLoading: false
        });
        return;
      }

      await this.initStreamFrom(0);
    } catch (e) {
      this.setData({
        categories: [],
        sections: [],
        streamHasMore: false,
        streamLoading: false
      });
    }
  },

  async initStreamFrom(startIdx) {
    const { categories } = this.data;
    if (!categories.length || startIdx < 0 || startIdx >= categories.length) return;

    const version = ++this._streamVersion;
    this._loadingStream = false;
    this._loadingPrev = false;
    this._scrollTop = 0;
    this._lastScrollTop = 0;
    this._contentHeight = 0;
    this._sectionOffsets = [];

    const firstCat = categories[startIdx];
    const firstSec = this.makeSection(firstCat, startIdx);
    const prevCatName = startIdx > 0 ? categories[startIdx - 1].name : '';

    this.setData({
      isFilterMode: false,
      activeSubCatId: '',
      sections: [firstSec],
      streamStartIdx: startIdx,
      streamEndIdx: startIdx,
      prevCatName,
      prevRefreshing: false,
      prevLoading: false,
      streamHasMore: true,
      streamLoading: false,
      streamScrollTop: 0,
      scrollIntoView: '',
      scrollWithAnim: false,
      activeCatId: firstCat.id,
      activeCatNavId: 'cat-' + firstCat.id,
      subCategories: firstCat.children || [],
      paneTitle: firstCat.isFreq ? '★ 常购商品' : firstCat.name,
      paneSub: firstCat.isFreq ? '按历史已送达订单置顶' : ''
    });

    await this.loadNextStreamChunk(version);
  },

  async loadNextStreamChunk(version) {
    if (version !== this._streamVersion) return;
    if (this._loadingStream || this.data.isFilterMode) return;

    const { categories, sections, streamEndIdx } = this.data;
    if (!categories.length) return;

    let targetSecIdx = sections.length - 1;
    let nextSections = sections.slice();
    let nextEndIdx = streamEndIdx;

    if (targetSecIdx < 0) {
      return;
    }

    if (!nextSections[targetSecIdx].hasMore) {
      if (streamEndIdx + 1 >= categories.length) {
        this.setData({ streamHasMore: false, streamLoading: false });
        return;
      }
      nextEndIdx = streamEndIdx + 1;
      nextSections.push(this.makeSection(categories[nextEndIdx], nextEndIdx));
      targetSecIdx = nextSections.length - 1;
    }

    const targetSec = nextSections[targetSecIdx];
    const nextPage = targetSec.page + 1;
    const params = { page: nextPage, pageSize: PAGE_SIZE };
    if (targetSec.isFreq) {
      params.frequent = true;
    } else {
      params.categoryId = targetSec.id;
    }

    this._loadingStream = true;
    nextSections[targetSecIdx] = { ...targetSec, loading: true };
    this.setData({
      sections: nextSections,
      streamEndIdx: nextEndIdx,
      streamLoading: true
    });

    try {
      const res = await getProducts(params);
      if (version !== this._streamVersion) {
        this._loadingStream = false;
        return;
      }

      const spuCartMap = this.data.spuCartMap || {};
      const rows = ((res && res.items) || []).map((p) => this.formatProductCard(p, spuCartMap));
      const total = Number(res && res.total) || rows.length;

      const curSections = this.data.sections.slice();
      const curIdx = curSections.findIndex((s) => s.id === targetSec.id);
      const curSec = curIdx >= 0 ? curSections[curIdx] : null;
      if (!curSec) {
        this._loadingStream = false;
        return;
      }

      const merged = curSec.products.concat(rows);
      // 常购接口最多 20 条且不分页，普通分类按总数判断是否还有下一页
      const secHasMore = curSec.isFreq ? false : (rows.length > 0 && merged.length < total);
      const subTitle = curSec.isFreq ? '按历史已送达订单置顶' : `${total} 款`;

      curSections[curIdx] = {
        ...curSec,
        products: merged,
        total,
        page: nextPage,
        hasMore: secHasMore,
        loaded: true,
        loading: false,
        subTitle
      };

      const streamHasMore = secHasMore || (this.data.streamEndIdx + 1 < this.data.categories.length);
      const patch = {
        sections: curSections,
        streamLoading: false,
        streamHasMore
      };
      if (this.data.activeCatId === curSec.id && !curSec.isFreq) {
        patch.paneSub = subTitle;
      }

      this._loadingStream = false;
      this.setData(patch, () => {
        this.measureAndEnsureFilled(version);
      });
    } catch (e) {
      this._loadingStream = false;
      if (version === this._streamVersion) {
        const curSections = this.data.sections.slice();
        const curIdx = curSections.findIndex((s) => s.id === targetSec.id);
        if (curIdx >= 0) {
          curSections[curIdx] = { ...curSections[curIdx], loading: false };
        }
        this.setData({
          sections: curSections,
          streamLoading: false
        });
      }
    }
  },

  measureAndEnsureFilled(version) {
    if (version !== this._streamVersion || this.data.isFilterMode) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('.goods-scroll').boundingClientRect();
    query.selectAll('.sec-block').boundingClientRect();
    query.exec((res) => {
      if (version !== this._streamVersion || this.data.isFilterMode) return;
      const scrollRect = res && res[0];
      const secRects = (res && res[1]) || [];
      if (!scrollRect || !secRects.length) return;

      const offsets = [];
      secRects.forEach((rect, idx) => {
        const sec = this.data.sections[idx];
        if (!sec) return;
        offsets.push({
          id: sec.id,
          top: rect.top - scrollRect.top + this._scrollTop,
          bottom: rect.bottom - scrollRect.top + this._scrollTop
        });
      });
      this._sectionOffsets = offsets;

      const lastRect = secRects[secRects.length - 1];
      this._viewportHeight = scrollRect.height || 600;
      this._contentHeight = lastRect.bottom - scrollRect.top + this._scrollTop;
      const remainingBelowViewport = lastRect.bottom - scrollRect.bottom;
      if (remainingBelowViewport < PRELOAD_BUFFER_PX && this.data.streamHasMore && !this._loadingStream) {
        this.loadNextStreamChunk(version);
      }
    });
  },

  onStreamScroll(e) {
    const scrollTop = e.detail.scrollTop;
    const isScrollingUp = scrollTop < this._lastScrollTop;
    this._lastScrollTop = scrollTop;
    this._scrollTop = scrollTop;

    const contentHeight = e.detail.scrollHeight || this._contentHeight;
    if (contentHeight > 0 && this.data.streamHasMore && !this._loadingStream) {
      const remaining = contentHeight - (scrollTop + this._viewportHeight);
      if (remaining < PRELOAD_BUFFER_PX) {
        this.loadNextStreamChunk(this._streamVersion);
      }
    }

    if (
      isScrollingUp &&
      scrollTop <= 120 &&
      this.data.streamStartIdx > 0 &&
      !this._loadingPrev &&
      Date.now() >= this._navLockUntil
    ) {
      this.prependPrevCategory({ fromClick: false });
      return;
    }

    if (Date.now() < this._navLockUntil) return;
    const offsets = this._sectionOffsets;
    if (!offsets.length) return;

    const anchorY = scrollTop + 30;
    let hitId = offsets[0].id;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i].top <= anchorY) {
        hitId = offsets[i].id;
      } else {
        break;
      }
    }

    if (hitId && hitId !== this.data.activeCatId) {
      this.setData(this.buildHeaderPatch(hitId));
    }
  },

  onStreamScrollToUpper() {
    if (this.data.isFilterMode) return;
    if (this.data.streamStartIdx > 0 && !this._loadingPrev && Date.now() >= this._navLockUntil) {
      this.prependPrevCategory({ fromClick: false });
    }
  },

  onStreamTouchStart(e) {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    this._touchStartY = touch.clientY;
    this._touchStartScrollTop = this._scrollTop;
  },

  onStreamTouchEnd(e) {
    if (this.data.isFilterMode || this.data.streamStartIdx <= 0 || this._loadingPrev) return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const deltaY = touch.clientY - this._touchStartY;
    // 在顶部直接向下拖（想往上滑看上一个分类）时兜底触发，避免 refresher 门槛过高导致无响应
    if (this._touchStartScrollTop <= 8 && deltaY > 45) {
      this.prependPrevCategory({ fromClick: false });
    }
  },

  onStreamLoadMore() {
    if (!this.data.streamHasMore || this._loadingStream) return;
    this.loadNextStreamChunk(this._streamVersion);
  },

  onLoadPrevCategory() {
    if (this.data.streamStartIdx <= 0) {
      this.setData({ prevRefreshing: false });
      return;
    }
    this.setData({ prevRefreshing: true });
    this.prependPrevCategory({ fromClick: false });
  },

  onClickPrevCategory() {
    this.prependPrevCategory({ fromClick: true });
  },

  async prependPrevCategory({ fromClick = false } = {}) {
    const { categories, streamStartIdx, isFilterMode } = this.data;
    if (isFilterMode || streamStartIdx <= 0 || this._loadingPrev) {
      if (this.data.prevRefreshing) this.setData({ prevRefreshing: false });
      return;
    }

    const version = this._streamVersion;
    const prevIdx = streamStartIdx - 1;
    const prevCat = categories[prevIdx];
    if (!prevCat) {
      if (this.data.prevRefreshing) this.setData({ prevRefreshing: false });
      return;
    }

    this._loadingPrev = true;
    const oldScrollTop = this._scrollTop;
    this.setData({ prevLoading: true });

    try {
      const spuCartMap = this.data.spuCartMap || {};
      const allRows = [];
      let total = 0;
      let page = 1;
      const maxPages = prevCat.isFreq ? 1 : 5;

      while (page <= maxPages) {
        const params = { page, pageSize: PAGE_SIZE };
        if (prevCat.isFreq) {
          params.frequent = true;
        } else {
          params.categoryId = prevCat.id;
        }
        const res = await getProducts(params);
        if (version !== this._streamVersion) {
          this._loadingPrev = false;
          return;
        }
        const rows = ((res && res.items) || []).map((p) => this.formatProductCard(p, spuCartMap));
        total = Number(res && res.total) || (allRows.length + rows.length);
        allRows.push(...rows);
        if (prevCat.isFreq || rows.length < PAGE_SIZE || allRows.length >= total) {
          break;
        }
        page += 1;
      }

      if (version !== this._streamVersion) {
        this._loadingPrev = false;
        return;
      }

      const prevSec = {
        ...this.makeSection(prevCat, prevIdx),
        products: allRows,
        total,
        page,
        hasMore: false,
        loaded: true,
        loading: false,
        subTitle: prevCat.isFreq ? '按历史已送达订单置顶' : `${total} 款`
      };

      const nextSections = [prevSec].concat(this.data.sections);
      const nextPrevCatName = prevIdx > 0 ? categories[prevIdx - 1].name : '';
      const patch = {
        sections: nextSections,
        streamStartIdx: prevIdx,
        prevCatName: nextPrevCatName,
        prevLoading: false,
        prevRefreshing: false,
        scrollIntoView: '',
        scrollWithAnim: false
      };

      if (fromClick) {
        this._navLockUntil = Date.now() + 500;
        patch.streamScrollTop = this.data.streamScrollTop === 0 ? 1 : 0;
        patch.activeCatId = prevCat.id;
        patch.activeCatNavId = 'cat-' + prevCat.id;
        patch.subCategories = prevCat.children || [];
        patch.paneTitle = prevCat.isFreq ? '★ 常购商品' : prevCat.name;
        patch.paneSub = prevSec.subTitle;
      } else {
        this._navLockUntil = Date.now() + 500;
      }

      this.setData(patch, () => {
        if (version !== this._streamVersion) {
          this._loadingPrev = false;
          return;
        }
        if (fromClick) {
          this._scrollTop = 0;
          this._lastScrollTop = 0;
          this._loadingPrev = false;
          this.measureAndEnsureFilled(version);
          return;
        }

        // 测量新前置插入的分类区块高度，保持在两分类交界处上方，方便继续向上无缝浏览上一分类
        const query = wx.createSelectorQuery().in(this);
        query.select('#sec-' + prevSec.id).boundingClientRect();
        query.exec((res) => {
          if (version !== this._streamVersion) {
            this._loadingPrev = false;
            return;
          }
          const rect = res && res[0];
          const prevHeight = rect ? rect.height : 0;
          const targetScrollTop = Math.max(0, Math.round(prevHeight + oldScrollTop - 60));
          const safeScrollTop = targetScrollTop === this.data.streamScrollTop
            ? targetScrollTop + 1
            : targetScrollTop;
          this._scrollTop = safeScrollTop;
          this._lastScrollTop = safeScrollTop;
          const scrollPatch = {
            streamScrollTop: safeScrollTop,
            scrollWithAnim: false
          };
          if (prevHeight > 0 && targetScrollTop < prevHeight) {
            scrollPatch.activeCatId = prevCat.id;
            scrollPatch.activeCatNavId = 'cat-' + prevCat.id;
            scrollPatch.subCategories = prevCat.children || [];
            scrollPatch.paneTitle = prevCat.isFreq ? '★ 常购商品' : prevCat.name;
            scrollPatch.paneSub = prevSec.subTitle;
          }
          this.setData(scrollPatch, () => {
            this._loadingPrev = false;
            this.measureAndEnsureFilled(version);
          });
        });
      });
    } catch (e) {
      this._loadingPrev = false;
      if (version === this._streamVersion) {
        this.setData({
          prevLoading: false,
          prevRefreshing: false
        });
      }
    }
  },

  // ---------- 搜索 / 二级子分类筛选模式 ----------

  async loadFilterProducts(reset = true) {
    if (this.data.filterLoading && !reset) return;
    const {
      keyword,
      activeCatId,
      activeSubCatId,
      categories,
      subCategories,
      spuCartMap,
      filterPage,
      filterProducts
    } = this.data;

    const trimmedKeyword = keyword.trim();
    const nextPage = reset ? 1 : filterPage + 1;
    const params = { page: nextPage, pageSize: PAGE_SIZE };
    let paneTitle = '';
    let paneSub = '';

    if (trimmedKeyword) {
      params.keyword = trimmedKeyword;
    } else if (activeSubCatId) {
      params.categoryId = activeSubCatId;
      const curRoot = categories.find((c) => c.id === activeCatId);
      const curSub = subCategories.find((s) => s.id === activeSubCatId);
      paneTitle = curSub ? curSub.name : (curRoot ? curRoot.name : '全部商品');
    } else {
      return;
    }

    const seq = ++this._filterRequestSeq;
    this.setData({ filterLoading: true });
    try {
      const res = await getProducts(params);
      if (seq !== this._filterRequestSeq) return;

      const rows = ((res && res.items) || []).map((p) =>
        this.formatProductCard(p, this.data.spuCartMap || spuCartMap)
      );
      const total = Number(res && res.total) || rows.length;
      const merged = reset ? rows : filterProducts.concat(rows);
      const filterHasMore = rows.length > 0 && merged.length < total;

      if (trimmedKeyword) {
        paneTitle = `搜索结果（${total}）`;
        paneSub = '';
      } else {
        paneSub = `${total} 款`;
      }

      this.setData({
        filterProducts: merged,
        filterTotal: total,
        filterPage: nextPage,
        filterHasMore,
        paneTitle,
        paneSub,
        filterLoading: false
      });
    } catch (e) {
      if (seq === this._filterRequestSeq) {
        this.setData({ filterLoading: false });
      }
    }
  },

  onFilterLoadMore() {
    if (!this.data.filterHasMore || this.data.filterLoading) return;
    this.loadFilterProducts(false);
  },

  restoreStreamView() {
    const version = this._streamVersion;
    const headerPatch = this.buildHeaderPatch(this.data.activeCatId || (this.data.categories[0] && this.data.categories[0].id));
    this.setData({
      isFilterMode: false,
      activeSubCatId: '',
      ...headerPatch
    }, () => {
      if (!this.data.sections.length && this.data.categories.length) {
        this.initStreamFrom(0);
      } else {
        this.measureAndEnsureFilled(version);
      }
    });
  },

  // ---------- 分类与搜索交互 ----------

  onSelectCategory(e) {
    const id = String(e.currentTarget.dataset.id);
    const { categories, streamStartIdx, streamEndIdx } = this.data;
    const targetIdx = categories.findIndex((c) => c.id === id);
    if (targetIdx < 0) return;

    this.clearSearchTimer();
    const inLoadedStream = targetIdx >= streamStartIdx && targetIdx <= streamEndIdx && this.data.sections.length > 0;

    if (inLoadedStream) {
      this._navLockUntil = Date.now() + 500;
      const headerPatch = this.buildHeaderPatch(id);
      const version = this._streamVersion;
      this.setData({
        keyword: '',
        activeSubCatId: '',
        isFilterMode: false,
        scrollWithAnim: true,
        scrollIntoView: '',
        ...headerPatch
      }, () => {
        this.setData({ scrollIntoView: 'sec-' + id }, () => {
          setTimeout(() => {
            this.measureAndEnsureFilled(version);
          }, 350);
        });
      });
    } else {
      this.setData({ keyword: '', activeSubCatId: '' });
      this.initStreamFrom(targetIdx);
    }
  },

  onSelectSubCategory(e) {
    const subId = String(e.currentTarget.dataset.id || '');
    if (subId === this.data.activeSubCatId) return;
    if (!subId) {
      this.restoreStreamView();
      return;
    }
    this.setData({
      activeSubCatId: subId,
      isFilterMode: true,
      filterProducts: [],
      filterPage: 1,
      filterHasMore: false,
      filterScrollTop: 0
    });
    this.loadFilterProducts(true);
  },

  onSearchInput(e) {
    const val = e.detail.value || '';
    const trimmed = val.trim();
    this.clearSearchTimer();

    if (!trimmed) {
      this.setData({ keyword: val });
      if (this.data.activeSubCatId) {
        this.loadFilterProducts(true);
      } else {
        this.restoreStreamView();
      }
      return;
    }

    this.setData({
      keyword: val,
      isFilterMode: true,
      filterScrollTop: 0
    });
    this._searchTimer = setTimeout(() => {
      this.loadFilterProducts(true);
    }, 250);
  },

  onSearchConfirm() {
    this.clearSearchTimer();
    if (this.data.keyword.trim()) {
      this.setData({ isFilterMode: true, filterScrollTop: 0 });
      this.loadFilterProducts(true);
    }
  },

  onClearSearch() {
    this.clearSearchTimer();
    this.setData({ keyword: '' });
    if (this.data.activeSubCatId) {
      this.setData({ isFilterMode: true, filterScrollTop: 0 });
      this.loadFilterProducts(true);
    } else {
      this.restoreStreamView();
    }
  },

  // ---------- 购物车与跳转 ----------

  checkOrderPermission() {
    const c = app.globalData.customer;
    if (!c) {
      wx.navigateTo({ url: '/pages/login/index' });
      return false;
    }
    if (c.status === 'pending') {
      wx.showToast({ title: '审核通过后即可下单', icon: 'none' });
      return false;
    }
    return true;
  },

  async onSingleQtyChange(e) {
    if (!this.checkOrderPermission()) return;
    const skuId = Number(e.currentTarget.dataset.skuId);
    const quantity = Number(e.detail.value) || 0;
    try {
      const cartData = await updateCartItem(skuId, quantity);
      this.applyCartData(cartData);
    } catch (err) {
      // 失败提示由 request.js 统一弹出
    }
  },

  async openSpecSheet(e) {
    if (!this.checkOrderPermission()) return;
    const spuId = e.currentTarget.dataset.spuId;
    try {
      const detail = await getProductDetail(spuId);
      this.setData({ sheetProduct: detail, sheetVisible: true });
    } catch (err) {
      // 失败提示由 request.js 统一弹出
    }
  },

  closeSpecSheet() {
    this.setData({ sheetVisible: false });
  },

  async onSheetQtyChange(e) {
    if (!this.checkOrderPermission()) return;
    const { skuId, quantity } = e.detail;
    try {
      const cartData = await updateCartItem(skuId, quantity);
      this.applyCartData(cartData);
    } catch (err) {
      // 失败提示由 request.js 统一弹出
    }
  },

  goDetail(e) {
    const spuId = e.currentTarget.dataset.spuId;
    wx.navigateTo({ url: '/pages/product-detail/index?spu_id=' + spuId });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  }
});
