// 로컬 전용 로그인 후 이력·접속 방식 응답만 모의하여 페이지와 반응형 UI를 검증한다.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = new URL('../../runtime/web-terminal-preview/', import.meta.url)
const { origin } = JSON.parse(await readFile(new URL('ready.json', root), 'utf8'))
const access = await readFile(new URL('계정정보.txt', root), 'utf8')
const password = access.match(/^비밀번호: (.+)$/m)[1].trim()
const contrast = (foreground, background) => {
  const luminance = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  const a = luminance(foreground), b = luminance(background)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR' })
const page = await context.newPage(), errors = [], queries = []
page.on('pageerror', error => errors.push(error.message))
page.setDefaultTimeout(15000)
await context.addInitScript(() => localStorage.setItem('lang', 'ko'))
let mode = 'terminal', fail = false
await page.route('**/api/admin/terminal/status?*', async route => {
  const reply = await route.fetch(), body = await reply.json()
  body.data.desktop_web_enabled = true
  body.data.desktop_state = mode === 'terminal' ? 'unavailable' : 'available'
  body.data.terminal_state = mode === 'desktop' ? 'unavailable' : 'available'
  body.data.reported_at = Math.floor(Date.now() / 1000)
  body.data.service_running = true
  await route.fulfill({ response: reply, json: body })
})
await page.route('**/api/admin/terminal/history?*', async route => {
  const query = new URL(route.request().url()).searchParams
  queries.push(Object.fromEntries(query))
  if (fail) return route.fulfill({ status: 503, json: { code: 101 } })
  const pageNumber = Number(query.get('page') || 1), size = Number(query.get('page_size') || 5)
  const records = Array.from({ length: 47 }, (_, index) => ({ id: 100 - index, resource: 'web_terminal', action: index % 3 === 0 ? 'disconnect' : 'connect', result: ['ended', 'connected', 'started'][index % 3], created_at: 1791289800 - index * 60 }))
  await route.fulfill({ json: { code: 0, data: { list: records.slice((pageNumber - 1) * size, pageNumber * size), total: 47, before_id: 100 } } })
})
try {
  await page.goto(origin + '/#/my/peer')
  await page.locator('.login-form input[type="username"]').fill('local-tester')
  await page.locator('.login-form input[type="password"]').fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.getByRole('button', { name: '터미널 접속 123456789', exact: true }).waitFor()
  await page.locator('.el-message').waitFor({ state: 'hidden' })
  if (process.env.UI_TEST_THEME === 'dark') await page.getByRole('button', { name: '다크 모드로 전환', exact: true }).click()
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByRole('button', { name: '상세 정보 123456789', exact: true }).click()
    const drawer = page.locator('.device-detail-drawer')
    await drawer.locator('.device-activity-list li').nth(4).waitFor()
    assert.equal(await drawer.locator('.device-activity-list li').count(), 5)
    const rows = await drawer.locator('.device-activity-list li').evaluateAll(elements => elements.map(row => {
      const text = row.querySelector('.activity-description'), label = text.querySelector('strong'), state = text.querySelector('.activity-state'), time = row.querySelector('time')
      let ancestor = row
      while (ancestor.parentElement && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)') ancestor = ancestor.parentElement
      return { background: getComputedStyle(ancestor).backgroundColor, height: text.getBoundingClientRect().height, state: getComputedStyle(state).color, label: getComputedStyle(label).color, fits: text.getBoundingClientRect().right <= time.getBoundingClientRect().left }
    }))
    assert.ok(rows.every(row => row.height < 25 && row.fits), '한 줄 이력의 겹침 또는 줄바꿈')
    assert.ok(rows.every(row => contrast(row.state, row.background) >= 4.5), '상태 색 텍스트 대비 부족: ' + JSON.stringify(rows))
    assert.equal(new Set(rows.slice(0, 3).map(row => row.state)).size, 3)
    assert.ok(rows.every(row => row.state !== row.label), '상태 이외의 제목까지 색이 적용됨')
    assert.ok(await drawer.getByRole('button', { name: '터미널 접속 123456789', exact: true }).locator('svg').count())
    const details = drawer.getByRole('button', { name: '상세보기', exact: true })
    await details.focus(); await page.keyboard.press('Enter')
    const history = page.getByRole('dialog', { name: '접속 기록', exact: true })
    await history.locator('.device-activity-list li').nth(19).waitFor()
    assert.equal(await history.locator('.device-activity-list li').count(), 20)
    await history.locator('.btn-next').click()
    await page.waitForFunction(() => document.querySelector('.connection-history-dialog .el-pager li.is-active')?.textContent === '2')
    await history.locator('.device-activity-list li').nth(19).waitFor()
    assert.ok(queries.some(query => query.page === '2' && query.before_id === '100'))
    await history.locator('.btn-next').click()
    await page.waitForFunction(() => document.querySelector('.connection-history-dialog .device-activity-list')?.children.length === 7)
    if (width === 1440) {
      fail = true; await history.getByRole('button', { name: '새로고침', exact: true }).click()
      await history.getByRole('alert').waitFor()
      fail = false; await history.getByRole('button', { name: '새로고침', exact: true }).click()
      await history.locator('.device-activity-list li').nth(19).waitFor()
    }
    assert.equal(await history.getByRole('radio').count(), 0, '일반 사용자에게 관리자 접속 기록 선택이 노출됨')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    if (process.env.UI_TEST_SCREENSHOTS) await page.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, 'device-history-' + width + (process.env.UI_TEST_THEME === 'dark' ? '-dark' : '') + '.png') })
    await page.keyboard.press('Escape'); await history.waitFor({ state: 'hidden' })
    await drawer.locator('.el-drawer__close-btn').click(); await drawer.waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.notification-center').count(), 0)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const nextMode of ['desktop', 'both']) {
    mode = nextMode; await page.reload()
    const name = nextMode === 'desktop' ? '화면 접속 123456789' : '접속 방식 선택 123456789'
    const button = page.getByRole('button', { name, exact: true })
    await button.waitFor()
    assert.ok(await button.locator('svg').count() >= (nextMode === 'both' ? 3 : 1))
    if (nextMode === 'both') {
      await button.focus(); await page.keyboard.press('Enter')
      await page.getByRole('menuitem', { name: '화면 접속', exact: true }).waitFor()
      await page.getByRole('menuitem', { name: '터미널 접속', exact: true }).waitFor()
      await page.keyboard.press('Escape')
    }
  }
  assert.deepEqual(errors, [])
  console.log('PASS: 최근 5개·20개 페이지/범위 고정·상태 3색/한 줄·아이콘·오류 복구·키보드·1440/768/390px')
} finally { await context.close(); await browser.close() }
