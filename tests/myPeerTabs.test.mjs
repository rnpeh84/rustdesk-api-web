// 실제 화면 컴포넌트와 모의 API로 탭·검색·소유권별 작업 노출을 검증한다. 운영 데이터에는 접근하지 않는다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { open: false, host: '127.0.0.1', port: 18995, strictPort: true } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1393, height: 1000 } })
  const errors = [], scopes = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  const peers = [
    { row_id: 2, id: '987654321', hostname: '내 Linux', owner_name: '나', is_owned: true, share_sources: [], os: 'Linux' },
    { row_id: 1, id: '123456789', hostname: '공유 Windows', owner_name: '동료', is_owned: false, share_sources: ['운영팀'], os: 'Windows' },
  ]
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    let data = { list: [], total: 0 }
    if (url.pathname.endsWith('/my/peer/counts')) data = { mine: 1, received: 1 }
    else if (url.pathname.endsWith('/my/peer/list')) {
      const scope = url.searchParams.get('scope')
      scopes.push(scope)
      const list = peers.filter(peer => (scope === 'all' || peer.is_owned === (scope === 'mine')) && (!url.searchParams.get('id') || peer.id.includes(url.searchParams.get('id'))))
      data = { list, total: list.length }
    } else if (url.pathname.endsWith('/config/admin')) data = { title: 'Re;De' }
    else if (url.pathname.endsWith('/terminal/status')) data = { enabled: false }
    else if (!url.pathname.endsWith('/my/address_book_collection/list')) assert.fail(`예상하지 않은 API: ${url.pathname}`)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data }) })
  })
  await page.goto('http://127.0.0.1:18995/tests/myPeerTabs.html')
  const all = page.getByRole('tab', { name: '전체 (2)', exact: true })
  await all.waitFor()
  assert.equal(await all.getAttribute('aria-selected'), 'true')
  const rows = page.locator('.el-table__body tr')
  await rows.nth(1).waitFor()
  assert.equal(await rows.count(), 2)
  assert.equal(await rows.nth(0).getByRole('button', { name: '삭제', exact: true }).count(), 1)
  assert.equal(await rows.nth(1).getByRole('button', { name: '삭제', exact: true }).count(), 0)
  assert.equal(await rows.nth(1).locator('input[type=checkbox]').isDisabled(), true)
  await rows.nth(0).locator('label.el-checkbox').click()
  await page.locator('.batch-action-bar').waitFor()
  await page.getByRole('tab', { name: '공유받은 장치 (1)', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.el-table__body tr').length === 1 && document.querySelector('.el-table__body')?.textContent.includes('123456789'))
  assert.equal(await page.locator('.batch-action-bar').count(), 0)
  assert.equal(await page.getByRole('button', { name: '삭제', exact: true }).count(), 0)
  await page.getByRole('tab', { name: '내 장치 (1)', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.el-table__body')?.textContent.includes('987654321'))
  await all.click()
  await page.getByPlaceholder('장치 ID 검색').fill('123456789')
  await page.waitForFunction(() => document.querySelectorAll('.el-table__body tr').length === 1 && document.querySelector('.el-table__body')?.textContent.includes('123456789'))
  await page.getByRole('button', { name: '초기화', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.el-table__body tr').length === 2)
  if (process.env.RUSTDESK_UI_OUTPUT) {
    await mkdir(process.env.RUSTDESK_UI_OUTPUT, { recursive: true })
    await page.screenshot({ path: join(process.env.RUSTDESK_UI_OUTPUT, 'peer-tabs-desktop-dark.png'), fullPage: true })
  }
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await all.isVisible(), true)
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}px 가로 넘침`)
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  if (process.env.RUSTDESK_UI_OUTPUT) await page.screenshot({ path: join(process.env.RUSTDESK_UI_OUTPUT, 'peer-tabs-mobile-light.png'), fullPage: true })
  await all.focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.getByRole('tab', { name: '내 장치 (1)', exact: true }).getAttribute('aria-selected'), 'true')
  assert.ok(scopes.includes('all') && scopes.includes('mine') && scopes.includes('received'))
  assert.deepEqual(errors, [])
  console.log('PASS: 기본 전체·장치 수·탭 전환·검색·선택 초기화·소유권별 작업·키보드·1393/768/390px·라이트/다크')
} finally {
  await browser?.close()
  await server.close()
}
