// API나 WebSocket을 가로채지 않는다. 로컬 TLS API와 암호화된 모의 장치를 사용한다.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fixture = JSON.parse(await readFile(process.env.RUSTDESK_BROWSER_READY, 'utf8'))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true })
await context.addInitScript(token => { localStorage.setItem('lang', 'ko'); localStorage.setItem('access_token', token) }, fixture.token)
const page = await context.newPage(), errors = [], socketURLs = [], requests = []
page.on('pageerror', e => errors.push(e.message))
page.on('websocket', socket => socketURLs.push(socket.url()))
page.on('request', request => { if (request.url().includes('/terminal/sessions')) requests.push(request.postDataJSON()) })
const control = async action => {
  const response = await context.request.post(`${fixture.origin}/__fixture/control`, { headers: { 'X-Fixture-Gate': 'local-test-only' }, data: { action } })
  assert.equal(response.status(), 204)
}
const stats = async () => (await context.request.get(`${fixture.origin}/__fixture/stats`, { headers: { 'X-Fixture-Gate': 'local-test-only' } })).json()
const report = async (desktop = 'no_session', terminal = 'available', running = true, expected = 204) => {
  const response = await context.request.post(`${fixture.origin}/api/client/install/official/report`, { headers: { Authorization: `Bearer ${fixture.report_token}` }, data: { id: fixture.device_id, service_running: running, desktop, terminal, platform: 'linux', shell_user: 'fixture-user' } })
  assert.equal(response.status(), expected)
}
const reload = async () => { await page.goto(`${fixture.origin}/#/my/peer`); await page.reload(); await page.locator('.device-connect').first().waitFor() }
const entry = async () => {
  if (page.viewportSize().width < 900) { await page.getByRole('button', { name: '상세 정보 123456789', exact: true }).click(); return page.locator('.device-detail-drawer .device-connect') }
  return page.locator('.device-connect').first()
}
const dialog = () => page.getByRole('dialog', { name: 'ID : 123456789' })
const waitOutput = text => page.waitForFunction(text => document.querySelector('.xterm-screen')?.textContent.includes(text), text)
const waitInactive = async () => {
  for (let i = 0; i < 50; i++) { if ((await stats()).Active === 0) return; await page.waitForTimeout(100) }
  assert.fail('모의 장치 연결이 종료되지 않았습니다.')
}
let finished = false
try {
  await page.setViewportSize({ width: 1440, height: 1000 })
  // 상태 보고만으로 접속 방식을 결정하며 원격 셸을 만들지 않는다.
  await report('available', 'disabled'); await reload()
  await page.getByRole('button', { name: '화면 접속 123456789', exact: true }).waitFor()
  await report('available', 'available'); await reload()
  await page.getByRole('button', { name: '접속 방식 선택 123456789', exact: true }).click()
  await page.getByRole('menuitem', { name: '화면 접속', exact: true }).waitFor()
  await page.getByRole('menuitem', { name: '터미널 접속', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await report('available', 'available', false); await reload()
  assert.equal(await page.locator('.device-connect button').first().isDisabled(), true)
  await report(); await control('stale'); await reload()
  assert.equal(await page.locator('.device-connect button').first().isDisabled(), true)
  assert.equal((await stats()).Opened, 0)
  await report()
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await reload()
    const button = await entry()
    await button.getByRole('button', { name: '터미널 접속 123456789', exact: true }).waitFor()
    const before = await stats()
    assert.equal(before.Active, 0, '버튼 클릭 전 원격 세션 생성')
    await button.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    await dialog().getByText('접속 중', { exact: true }).waitFor()
    await waitOutput('모의 장치 터미널')
    assert.equal(requests.at(-1).use_saved, true); assert.equal(requests.at(-1).password, '')
    await page.keyboard.type('integration input'); await page.keyboard.press('Enter')
    await waitOutput('integration input')
    await page.setViewportSize({ width: width - 10, height: 980 })
    await page.waitForTimeout(150)
    const box = await dialog().boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= width - 9)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    if (width === 768) {
      // 페이지 이탈 시 실제 서버와 장치 연결까지 닫히는지 확인한다.
      await page.goto(`${fixture.origin}/#/my/client`)
      await page.waitForFunction(() => !document.querySelector('.xterm'))
    } else {
      await dialog().getByRole('button', { name: '연결 종료', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('.xterm'))
      if (width !== 390) await dialog().getByRole('button', { name: '닫기', exact: true }).click()
    }
    await waitInactive()
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  // 세 번째 연결의 대화상자를 유지하고 잘못된 비밀번호·직접 입력 복구를 검증한다.
  await dialog().getByText('웹에 저장한 설치 비밀번호 사용', { exact: true }).click()
  await dialog().getByRole('textbox', { name: '장치 무인 접속 비밀번호' }).fill('wrong-fixture-password')
  await dialog().getByRole('button', { name: '확인 후 연결' }).click()
  await dialog().locator('.terminal-session-status').getByText('인증 필요', { exact: true }).waitFor()
  assert.equal(await dialog().locator('.xterm').count(), 0)
  await waitInactive()
  await dialog().getByRole('textbox', { name: '장치 무인 접속 비밀번호' }).fill(fixture.password)
  await dialog().getByRole('button', { name: '확인 후 연결' }).click()
  await dialog().getByText('접속 중', { exact: true }).waitFor()
  await waitOutput('모의 장치 터미널')
  // 사용자별 1분 5회 제한이 실제 API에도 적용된다. 다음 요청은 서버에서 막혀야 한다.
  const denied = await context.request.post(`${fixture.origin}/api/admin/terminal/sessions`, { headers: { 'api-token': fixture.token, Origin: fixture.origin }, data: { peer_id: fixture.peer_id, use_saved: true } })
  const deniedBody = await denied.json()
  assert.equal(deniedBody.code, 101)
  assert.deepEqual(deniedBody.data, { state: 'busy', stage: 'request' })
  await control('revoke')
  await page.keyboard.type('revoked input')
  await page.waitForFunction(() => !document.querySelector('.xterm'))
  await waitInactive()
  const noToken = await context.request.get(`${fixture.origin}/api/admin/terminal/status?peer_id=${fixture.peer_id}`, { headers: { 'api-token': fixture.token } })
  assert.equal((await noToken.json()).code, 403)
  // 웹 로그인 토큰과 독립적인 장치 보고 토큰도 소유자/UUID/계정 상태를 검사한다.
  await report(); await control('owner-change'); await report('no_session', 'available', true, 403)
  await control('restore-owner'); await control('uuid-change'); await report('no_session', 'available', true, 403)
  await control('restore-uuid'); await control('disable-user'); await report('no_session', 'available', true, 403)
  assert.ok(socketURLs.length >= 5)
  for (const url of socketURLs) { assert.equal(new URL(url).search, ''); assert.equal(new URL(url).protocol, 'wss:') }
  assert.deepEqual(errors, [])
  console.log('PASS: 실제 API·인증·TLS WebSocket·암호화 모의 장치, 3개 화면 폭, 사전 접속 선택, 한글/입력/크기 변경, 종료/페이지 이탈, 잘못된 비밀번호/요청 제한/로그인 취소/장치 보고 권한')
  finished = true
} finally {
  await context.close(); await browser.close()
  // 실패 시에도 테스트 서버를 종료한다. Go 검증 결과와 Node 종료 코드를 함께 확인해야 한다.
  const { request } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const cleanup = await request.newContext({ ignoreHTTPSErrors: true })
  await cleanup.post(`${fixture.origin}/__fixture/done`, { headers: { 'X-Fixture-Gate': 'local-test-only' } }).catch(() => {})
  await cleanup.dispose()
  if (!finished) console.error('FAIL: 브라우저 검증을 완료하지 못했습니다.')
}
