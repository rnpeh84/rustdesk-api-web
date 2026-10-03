// API·GitHub·사용자 DB에 접속하지 않는 화면 회귀 검증이다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { open: false, host: '127.0.0.1', port: 18994, strictPort: true } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let mode = 'source', number = 1, posts = 0, delay = 0
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    let data = {}, code = 0, message = ''
    if (url.pathname.endsWith('/endpoint-profiles')) data = { list: [{ id: 1, name: '사내 연결', revision: 1, is_default: true }] }
    else if (url.pathname.endsWith('/github-sources')) data = { list: [{ id: 1, name: '사내 RustDesk', owner: 'company', repository: 'client', branch: 'master', status: 'ready', is_enabled: true }] }
    else if (url.pathname.endsWith('/readiness')) data = { ready: true, checks: [{ key: 'source', ready: true, message: '빌드 준비 완료' }] }
    else if (url.pathname.endsWith('/version-preview')) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      if (mode === 'error') { code = 101; message = 'GitHub 권한을 확인해 주세요.' }
      else {
        const initial = url.searchParams.get('base_version'), missing = mode === 'initial' && !initial
        data = { official_version: mode === 'source' ? '1.4.9' : '', previous_version: mode === 'history' ? '1.4.9-company.009' : '', origin: mode, commit_sha: 'a'.repeat(40), needs_initial_version: missing,
          version: missing ? '' : `${mode === 'initial' ? initial : '1.4.9'}-company.${String(number).padStart(3, '0')}` }
      }
    } else if (url.pathname.endsWith('/jobs')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); posts++
        assert.equal(body.auto_version, true); assert.equal(body.expected_commit_sha, 'a'.repeat(40)); assert.equal(body.version, undefined)
        number++; data = { id: posts }
      } else data = { list: [] }
    } else { assert.fail(`예상하지 않은 API 요청: ${url.pathname}`) }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code, message, data }) })
  })
  await page.goto('http://127.0.0.1:18994/tests/clientBuildVersion.html')
  const version = page.getByPlaceholder('소스에서 자동 계산'), start = page.getByRole('button', { name: '빌드 시작' })
  await version.waitFor()
  await page.waitForFunction(() => document.querySelector('input[name="calculated_version"]')?.value === '1.4.9-company.001')
  assert.equal(await version.getAttribute('readonly'), '')
  assert.equal(await start.isEnabled(), true)
  await start.click()
  await page.waitForFunction(() => document.querySelector('input[name="calculated_version"]')?.value === '1.4.9-company.002')
  assert.equal(posts, 1)
  mode = 'history'; number = 10
  await page.getByRole('button', { name: '버전 다시 조회' }).click()
  await page.getByText('소스 버전 조회 불가 · 이전 기록 기준').waitFor()
  assert.equal(await version.inputValue(), '1.4.9-company.010')
  mode = 'initial'; number = 1
  await page.getByRole('button', { name: '버전 다시 조회' }).click()
  const initial = page.getByPlaceholder('1.4.9', { exact: true })
  await initial.waitFor(); assert.equal(await start.isDisabled(), true)
  await initial.fill('2.0.0')
  await page.waitForFunction(() => document.querySelector('input[name="calculated_version"]')?.value === '2.0.0-company.001')
  assert.equal(await initial.inputValue(), '2.0.0')
  mode = 'error'
  await page.getByRole('button', { name: '버전 다시 조회' }).click()
  await page.getByRole('alert').filter({ hasText: 'GitHub 권한을 확인해 주세요.' }).first().waitFor()
  assert.equal(await start.isDisabled(), true)
  mode = 'source'
  await page.getByRole('button', { name: '버전 다시 조회' }).click()
  await page.waitForFunction(() => document.querySelector('input[name="calculated_version"]')?.value === '1.4.9-company.001')
  delay = 700
  await page.getByPlaceholder('master 또는 tag').fill('release/new')
  assert.equal(await start.isDisabled(), true)
  await page.waitForTimeout(1300)
  assert.equal(await start.isEnabled(), true)
  assert.equal(await page.locator('.el-message--error').count(), 0, '취소·인라인 오류를 중복 알림으로 표시하지 않음')
  await page.waitForTimeout(1800)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}px 가로 넘침`)
    if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/client-version-${width}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: '버전 다시 조회' }).focus()
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '버전 다시 조회')
  assert.deepEqual(errors, [])
  console.log('PASS: 자동 버전·재계산·최초 입력·fallback·오류·요청 중 차단·1440/768/390px·키보드 초점')
} finally {
  await browser?.close()
  await server.close()
}
