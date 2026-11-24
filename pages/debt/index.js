const app = getApp();
const { getMyCredit, getMyStatements, getProfile } = require('../../services/shop');

function formatMoney(v, digits = 2) {
  return Number(v || 0).toFixed(digits);
}

function mapLedgerItem(l) {
  const num = Number(l.delta || 0);
  const isAdd = num > 0;
  return {
    ...l,
    isAdd,
    displayTitle: l.ref_no ? `${l.type} · ${l.ref_no}` : l.type,
    deltaText: (isAdd ? '+¥' : '-¥') + Math.abs(num).toFixed(2),
    balanceText: formatMoney(l.balance)
  };
}

function mapUnpaidOrder(o) {
  const overdueDays = Number(o.overdue_days || 0);
  const daysUntilDue = o.days_until_due;
  let badgeText = '未到期';
  let badgeClass = 'ok';
  if (overdueDays > 0) {
    badgeText = `已逾期 ${overdueDays} 天`;
    badgeClass = 'ov';
  } else if (daysUntilDue === 0) {
    badgeText = '今日到期';
    badgeClass = 'warn';
  } else if (typeof daysUntilDue === 'number' && daysUntilDue > 0) {
    badgeText = `距到期 ${daysUntilDue} 天`;
    badgeClass = daysUntilDue <= 3 ? 'warn' : 'ok';
  }
  return {
    ...o,
    overdue_days: overdueDays,
    dueText: o.due_date || '—',
    badgeText,
    badgeClass,
    totalText: formatMoney(o.total_amount),
    unpaidText: formatMoney(o.unpaid_amount)
  };
}

Page({
  data: {
    fontClass: 'font-large',
    loading: false,
    tab: 'orders',
    debtAmountText: '0.00',
    overdueAmountText: '0.00',
    creditLimitText: '0',
    availableCreditText: '0',
    hasDebt: false,
    hasOverdue: false,
    unpaidOrders: [],
    ledger: [],
    statements: [],
    activeStmt: null,
    generatingImg: false,
    canvasWidth: 375,
    canvasHeight: 520
  },

  async onShow() {
    this.setData({ fontClass: app.globalData.fontClass });
    await this.loadData();
  },

  async onPullDownRefresh() {
    await this.loadData(true);
    wx.stopPullDownRefresh();
  },

  async loadData(silent = false) {
    if (!silent) this.setData({ loading: true });
    try {
      const tasks = [getMyCredit(), getMyStatements()];
      if (!app.globalData.customer) {
        tasks.push(getProfile().catch(() => null));
      }
      const [credit, stmtRes, profile] = await Promise.all(tasks);
      if (profile) {
        app.globalData.customer = profile;
      }
      const debt = Number((credit && credit.debt_amount) || 0);
      const overdue = Number((credit && credit.overdue_amount) || 0);
      const statements = ((stmtRes && stmtRes.items) || []).map((s) => ({
        ...s,
        openingText: formatMoney(s.opening_debt),
        debitText: formatMoney(s.debit_total),
        creditText: formatMoney(s.credit_total),
        endingText: formatMoney(s.ending_debt),
        entries: (s.entries || []).map(mapLedgerItem)
      }));

      this.setData({
        debtAmountText: debt.toFixed(2),
        overdueAmountText: overdue.toFixed(2),
        creditLimitText: formatMoney(credit && credit.credit_limit, 0),
        availableCreditText: formatMoney(credit && credit.available_credit, 0),
        hasDebt: debt > 0,
        hasOverdue: overdue > 0,
        unpaidOrders: ((credit && credit.unpaid_orders) || []).map(mapUnpaidOrder),
        ledger: ((credit && credit.ledger) || []).map(mapLedgerItem),
        statements
      });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '账务数据加载失败', icon: 'none' });
    } finally {
      if (!silent) this.setData({ loading: false });
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
  },

  goOrderDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/index?id=' + e.currentTarget.dataset.id });
  },

  openStatement(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const stmt = this.data.statements[idx];
    if (!stmt) return;
    this.setData({ activeStmt: stmt });
  },

  closeStatement() {
    this.setData({ activeStmt: null });
  },

  noop() {},

  async generateStatementImage(stmt) {
    if (stmt.image_url) return stmt.image_url;

    const entries = stmt.entries || [];
    const width = 375;
    const rowH = 54;
    const headerH = 112;
    const summaryH = 118;
    const listTitleH = 38;
    const footerH = 56;
    const listH = Math.max(entries.length, 1) * rowH;
    const height = headerH + summaryH + listTitleH + listH + footerH;

    await new Promise((resolve) => {
      this.setData({ canvasWidth: width, canvasHeight: height }, resolve);
    });

    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query
        .select('#stmtCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const item = res && res[0];
          if (!item || !item.node) {
            reject(new Error('画布初始化失败'));
            return;
          }
          const canvas = item.node;
          const ctx = canvas.getContext('2d');
          const dpr = 2;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          // 白色背景
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // 顶部深蓝抬头
          ctx.fillStyle = '#1B4B91';
          ctx.fillRect(0, 0, width, headerH);

          const customerName = (app.globalData.customer && app.globalData.customer.name) || '尊敬的客户';
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText(`味都美副食 · ${stmt.period}`, 18, 36);

          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = '13px sans-serif';
          ctx.fillText(`客户：${customerName}`, 18, 64);
          ctx.fillText(`账期：${stmt.period_start} 至 ${stmt.period_end}`, 18, 86);

          // 汇总卡片区
          const sy = headerH + 14;
          ctx.fillStyle = '#F4F6FA';
          ctx.fillRect(16, sy, width - 32, summaryH - 22);

          const drawMetric = (x, y, label, val, color) => {
            ctx.fillStyle = '#5E6C80';
            ctx.font = '12px sans-serif';
            ctx.fillText(label, x, y);
            ctx.fillStyle = color;
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(val, x, y + 20);
          };
          drawMetric(28, sy + 22, '期初欠款', `¥${stmt.openingText}`, '#111927');
          drawMetric(200, sy + 22, '本期挂账', `+¥${stmt.debitText}`, '#E8452A');
          drawMetric(28, sy + 64, '本期还款/冲抵', `-¥${stmt.creditText}`, '#157347');
          drawMetric(200, sy + 64, '期末欠款', `¥${stmt.endingText}`, '#1B4B91');

          // 明细标题
          let cy = headerH + summaryH + 22;
          ctx.fillStyle = '#111927';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(`往来明细（共 ${stmt.item_count} 笔）`, 18, cy);
          cy += 14;

          if (!entries.length) {
            ctx.fillStyle = '#5E6C80';
            ctx.font = '13px sans-serif';
            ctx.fillText('本期无往来明细', 18, cy + 28);
          } else {
            entries.forEach((e, i) => {
              const ry = cy + i * rowH;
              ctx.fillStyle = '#E5ECF4';
              ctx.fillRect(18, ry, width - 36, 1);

              ctx.fillStyle = '#111927';
              ctx.font = 'bold 13px sans-serif';
              const title = e.displayTitle.length > 20 ? e.displayTitle.slice(0, 20) + '…' : e.displayTitle;
              ctx.fillText(title, 18, ry + 22);

              ctx.fillStyle = '#5E6C80';
              ctx.font = '11px sans-serif';
              ctx.fillText(e.created_at, 18, ry + 41);

              ctx.textAlign = 'right';
              ctx.fillStyle = e.isAdd ? '#E8452A' : '#157347';
              ctx.font = 'bold 14px sans-serif';
              ctx.fillText(e.deltaText, width - 18, ry + 22);

              ctx.fillStyle = '#5E6C80';
              ctx.font = '11px sans-serif';
              ctx.fillText(`余额 ¥${e.balanceText}`, width - 18, ry + 41);
              ctx.textAlign = 'left';
            });
          }

          // 底部核对说明
          const fy = height - 24;
          ctx.fillStyle = '#8C9AB0';
          ctx.font = '11px sans-serif';
          ctx.fillText(`统计日期：${stmt.created_at}  ·  如有疑问请联系专属业务员核对`, 18, fy);

          wx.canvasToTempFilePath({
            canvas,
            fileType: 'png',
            quality: 1,
            success: (out) => resolve(out.tempFilePath),
            fail: (err) => reject(err)
          });
        });
    });
  },

  async previewStatementImage() {
    if (!this.data.activeStmt || this.data.generatingImg) return;
    this.setData({ generatingImg: true });
    try {
      const path = await this.generateStatementImage(this.data.activeStmt);
      wx.previewImage({ urls: [path] });
    } catch (_err) {
      wx.showToast({ title: '对账单图片生成失败', icon: 'none' });
    } finally {
      this.setData({ generatingImg: false });
    }
  },

  async saveStatementImage() {
    if (!this.data.activeStmt || this.data.generatingImg) return;
    this.setData({ generatingImg: true });
    try {
      const path = await this.generateStatementImage(this.data.activeStmt);
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: resolve,
          fail: reject
        });
      });
      wx.showToast({ title: '已保存到手机相册', icon: 'success' });
    } catch (err) {
      const msg = (err && err.errMsg) || '';
      if (msg.includes('auth deny') || msg.includes('authorize')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中开启「保存到相册」权限后重试',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) wx.openSetting();
          }
        });
      } else if (!msg.includes('cancel')) {
        wx.showToast({ title: '保存失败，可先预览长按保存', icon: 'none' });
      }
    } finally {
      this.setData({ generatingImg: false });
    }
  },

  callSales() {
    const phone = app.globalData.customer && app.globalData.customer.sales_phone;
    if (!phone) {
      wx.showToast({ title: '暂未绑定专属业务员电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  }
});
