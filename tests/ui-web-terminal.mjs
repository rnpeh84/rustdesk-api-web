// 모의 API·WebSocket을 사용하며 운영 장치에서 명령을 실행하지 않는다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:15173'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR' })
await context.addInitScript(() => { localStorage.setItem('lang', 'ko'); localStorage.setItem('access_token', 'fixture-local-ui-token') })
const page = await context.newPage()
const errors = [], requests = [], input = []
let state = 'unknown', response = 'ready', closed = 0, admin = false
page.on('pageerror', e => errors.push(e.message))
await page.route('**/api/admin/**', async route => {
  const path = new URL(route.request().url()).pathname
  let data = { list: [], total: 0 }
  if (path.endsWith('/user/current')) data = { id: 1, username: 'fixture-user', role: admin ? 'device_admin' : 'user', permissions: admin ? ['device.read','device.write'] : ['client.download'], route_names: admin ? ['Peer','DeviceGroup','MyPeer'] : ['MyPeer', 'MyClient'] }
  if (path.endsWith('/config/admin')) data = { title: '로컬 터미널 검증' }
  if (path.endsWith('/config/app')) data = { web_client: 0 }
  if (path.endsWith('/peer/list')) data = { list: [{ row_id: 10, id: '123456789', hostname: '검증용 Linux', os: 'Linux', user_id: admin ? 2 : 1, last_online_time: Math.floor(Date.now() / 1000) }], total: 1 }
  if (path.endsWith('/terminal/status')) data = { state, checked_at: 0, has_saved_password: !admin, desktop_state:'no_session',terminal_state:'available',service_running:true,reported_at:Math.floor(Date.now()/1000),desktop_web_enabled:false,platform:'linux' }
  if (path.endsWith('/terminal/sessions')) { requests.push(route.request().postDataJSON()); data = { ticket: 'fixture-single-use-ticket', websocket_path: '/api/terminal/connect', expires_in: 30 } }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data }) })
})
await page.routeWebSocket('**/api/terminal/connect', ws => {
  ws.onClose(() => closed++)
  ws.onMessage(message => {
    const v = JSON.parse(message)
    input.push(v)
    if (v.type === 'open') {
      ws.send(JSON.stringify({ type: 'opened', state: 'ready' }))
      ws.send(JSON.stringify({ type: 'output', data: Buffer.from('\x1b[32mfixture shell\x1b[0m\r\n한글 출력\r\n$ ').toString('base64') }))
    }
  })
  setTimeout(() => { ws.send(JSON.stringify(response === 'ready' ? { type: 'status', state: 'allowed' } : { type: 'error', state: response })) }, 50)
})
try {
  const openEntry = async () => {
    if (page.viewportSize().width < 900) {
      await page.getByRole('button', { name: '상세 정보 123456789', exact: true }).click()
      const entry = page.locator('.device-detail-drawer .device-connect')
      await entry.waitFor()
      return entry
    }
    return page.locator('.device-connect').first()
  }
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${origin}/#/my/peer`)
    const entry = await openEntry()
    await entry.getByText('터미널 사용 가능', { exact: true }).waitFor()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '웹 터미널 · 123456789' })
    await dialog.waitFor()
    await dialog.getByText('접속 중', { exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('.xterm-screen')?.textContent.includes('한글 출력'))
    assert.equal(requests.at(-1).use_saved, true)
    assert.equal(requests.at(-1).password, '')
    assert.ok(input.some(v => v.type === 'open' && v.rows >= 2 && v.cols >= 2))
    await page.keyboard.type('whoami')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.classList.contains('xterm-helper-textarea'))
    assert.ok(input.some(v => v.type === 'input'), '키 입력 전달 누락')
    const box = await dialog.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${width}px 대화상자 넘침`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    if (process.env.UI_TEST_SCREENSHOTS) await dialog.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, `web-terminal-${width}.png`) })
    await dialog.getByRole('button', { name: '연결 종료', exact: true }).click()
    await dialog.getByText('상태 미확인', { exact: true }).waitFor()
    assert.equal(await dialog.locator('.xterm').count(), 0, '종료 후 화면 정리')
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    if (width < 900) { await page.keyboard.press('Escape'); await page.locator('.device-detail-drawer').waitFor({ state: 'hidden' }) }
  }
  for (const [code,label] of [['disabled','터미널 비활성'],['unsupported','터미널 미지원'],['auth_required','인증 필요'],['pty_failed','셸 열기 실패'],['unavailable','연결 확인 실패']]) {
    response = code; state = 'unknown'
    await page.reload()
    const entry = await openEntry()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '웹 터미널 · 123456789' })
    await dialog.waitFor()
    await dialog.getByText(label, { exact: true }).waitFor()
    await dialog.getByText('웹에 저장한 설치 비밀번호 사용', { exact: true }).click()
    await dialog.getByRole('textbox', { name: '장치 무인 접속 비밀번호' }).fill('fixture-password')
    await dialog.getByRole('button', { name: '확인 후 연결' }).click()
    await dialog.getByText(label, { exact: true }).waitFor()
    assert.equal(await dialog.locator('.xterm').count(), 0, `${code}: 인증 실패 후 셸 생성`)
    assert.equal(requests.at(-1).use_saved, false)
    assert.equal(requests.at(-1).password, 'fixture-password')
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.keyboard.press('Escape')
    await page.locator('.device-detail-drawer').waitFor({ state: 'hidden' })
  }
  assert.ok(closed >= 3, '종료 후 WebSocket 정리')
  admin = true; response = 'ready'; state = 'unknown'
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${origin}/#/user/peer`)
  await page.reload()
  const adminEntry = page.locator('.device-connect').first()
  await adminEntry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
  const adminDialog = page.getByRole('dialog', { name: '웹 터미널 · 123456789' })
  await adminDialog.getByRole('textbox', { name: '장치 무인 접속 비밀번호' }).fill('fixture-admin-device-password')
  assert.equal(await adminDialog.getByRole('checkbox').count(), 0, '타인 장치에 저장 비밀번호 선택 노출')
  await adminDialog.getByRole('button', { name: '확인 후 연결' }).click()
  await adminDialog.getByText('접속 중', { exact: true }).waitFor()
  assert.equal(requests.at(-1).use_saved, false)
  await page.goto(`${origin}/#/user/deviceGroup`)
  await page.waitForFunction(() => !document.querySelector('.xterm'))
  assert.deepEqual(errors, [])
  console.log('PASS: 1440/768/390px, 사용자·장치관리자, 저장 비밀번호·직접 입력, 터미널 렌더링·키보드·종료·화면 이탈, 비활성·미지원·인증·셸·연결 실패 표시')
} finally { await context.close(); await browser.close() }
