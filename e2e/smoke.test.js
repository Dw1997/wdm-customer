/**
 * 微信小程序商城核心页面冒烟自动化测试。
 *
 * 前置条件：
 * 1. 安装依赖：cd apps/wdm-customer/e2e && npm install
 * 2. 打开微信开发者工具 -> 设置 -> 安全设置 -> 开启「服务端口」
 * 3. 运行测试：npm test
 *    可选环境变量：
 *      WX_CLI_PATH=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
 *      WX_PORT=9420
 */

const path = require('node:path')
const automator = require('miniprogram-automator')

const PROJECT_PATH = path.resolve(__dirname, '..')
const CLI_PATH =
  process.env.WX_CLI_PATH ||
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

describe('味都美小程序商城主流程冒烟', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
      port: Number(process.env.WX_PORT || 9420),
    })
  }, 60_000)

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close()
    }
  })

  test('首页分类页可正常启动与渲染', async () => {
    const page = await miniProgram.reLaunch('/pages/category/index')
    await page.waitFor(1000)
    expect(page.path).toBe('pages/category/index')
  }, 30_000)

  test('核心 Tab 页（购物车、订单列表、我的）可正常切换无白屏', async () => {
    for (const tabPath of [
      '/pages/cart/index',
      '/pages/order-list/index',
      '/pages/mine/index',
    ]) {
      const page = await miniProgram.switchTab(tabPath)
      await page.waitFor(800)
      expect(`/${page.path}`).toBe(tabPath)
    }
  }, 30_000)

  test('登录页可正常打开', async () => {
    const page = await miniProgram.navigateTo('/pages/login/index')
    await page.waitFor(800)
    expect(page.path).toBe('pages/login/index')
  }, 30_000)
})
