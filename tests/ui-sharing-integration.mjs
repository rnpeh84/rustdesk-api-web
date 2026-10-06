// API 응답을 가로채지 않고 임시 DB·인증 미들웨어·암호화된 모의 장치로 공유 흐름을 검증한다.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fixture = JSON.parse(await readFile(process.env.RUSTDESK_BROWSER_READY, 'utf8'))
const ko = JSON.parse(await readFile(new URL('../src/utils/i18n/ko.json', import.meta.url), 'utf8'))
const T = key => ko[key]?.One || key
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const errors = [], requests = []
const makeContext = async token => {
  const context = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true })
  await context.addInitScript(token => { localStorage.setItem('lang', 'ko'); localStorage.setItem('access_token', token) }, token)
  const page = await context.newPage()
  page.on('pageerror', err => errors.push(err.message))
  page.on('request', request => { if (request.url().endsWith('/terminal/sessions')) requests.push(request.postDataJSON()) })
  return { context, page }
}
const owner = await makeContext(fixture.token), receiver = await makeContext(fixture.receiver_token)
const call = async (context, token, path, data) => {
  const response = await context.request[data ? 'post' : 'get'](fixture.origin + path, { headers: { 'api-token': token, Origin: fixture.origin }, ...(data ? { data } : {}) })
  assert.equal(response.status(), 200, path)
  const body = await response.json(); assert.equal(body.code, 0, path + ': ' + JSON.stringify(body)); return body.data
}
const control = async action => { const res = await owner.context.request.post(`${fixture.origin}/__fixture/control`, { headers: { 'X-Fixture-Gate': 'local-test-only' }, data: { action } }); assert.equal(res.status(), 204) }
const stats = async () => (await owner.context.request.get(`${fixture.origin}/__fixture/stats`, { headers: { 'X-Fixture-Gate': 'local-test-only' } })).json()
const waitInactive = async () => { for (let i = 0; i < 60; i++) { if ((await stats()).Active === 0) return; await new Promise(resolve => setTimeout(resolve, 100)) }; assert.fail('공유 세션 종료 누락') }
const capture = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { await page.waitForFunction(() => [...document.querySelectorAll('.el-loading-mask')].every(el => !el.getClientRects().length)); await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, name + '.png'), fullPage: true, animations: 'disabled' }) } }
const report = await owner.context.request.post(`${fixture.origin}/api/client/install/official/report`, { headers: { Authorization: `Bearer ${fixture.report_token}` }, data: { id: fixture.device_id, platform: 'linux', service_running: true, terminal: 'available', desktop: 'no_session', shell_user: 'fixture-user' } })
assert.equal(report.status(), 204)
let cid = 0
try {
  await owner.page.setViewportSize({ width: 1440, height: 1000 })
  await owner.page.goto(`${fixture.origin}/#/my/peer`)
  await owner.page.getByRole('button', { name: '123456789 장치 작업', exact: true }).click()
  await owner.page.getByRole('menuitem', { name: T('ShareDevices'), exact: true }).click()
  const dialog = owner.page.getByRole('dialog', { name: T('ShareAddressBook'), exact: true })
  await dialog.getByRole('textbox', { name: T('Name'), exact: true }).fill('운영 장치 공유')
  await dialog.getByRole('combobox').first().focus(); await owner.page.keyboard.press('ArrowDown')
  await owner.page.getByRole('option', { name: `${T('User')}: 공유받는 사용자`, exact: true }).click()
  await dialog.getByRole('combobox').first().focus(); await owner.page.keyboard.press('ArrowDown')
  await owner.page.getByRole('option', { name: `${T('Group')}: 운영팀`, exact: true }).click()
  await dialog.locator('.share-help').first().click()
  const saved = owner.page.waitForResponse(response => response.url().endsWith('/my/sharing/save') && response.request().method() === 'POST')
  await dialog.getByRole('button', { name: T('SaveSharing'), exact: true }).focus(); await owner.page.keyboard.press('Enter')
  const response = await saved; const payload = response.request().postDataJSON()
  assert.deepEqual(payload.peer_ids, [fixture.peer_id]); assert.equal(payload.recipients.length, 2)
  cid = (await response.json()).data.collection_id
  assert.ok(cid)
  await owner.page.goto(`${fixture.origin}/#/my/sharing`)
  await owner.page.getByText('운영 장치 공유', { exact: true }).waitFor()
  // 네트워크 실패를 실제로 발생시켜 빈 목록으로 오인하지 않고 재시도로 복구하는지 확인한다.
  await owner.context.setOffline(true)
  await owner.page.getByRole('button', { name: T('Refresh'), exact: true }).click()
  await owner.page.getByText(T('ShareLoadFailed'), { exact: true }).waitFor()
  await owner.context.setOffline(false)
  await owner.page.getByRole('button', { name: T('Retry'), exact: true }).click()
  await owner.page.getByText('운영 장치 공유', { exact: true }).waitFor()
  await capture(owner.page, 'rd-t027-sent-desktop')
  await owner.page.getByRole('button', { name: T('ManageSharing'), exact: true }).click()
  const managed = owner.page.getByRole('dialog', { name: T('ShareAddressBook'), exact: true })
  await managed.getByText(`${T('User')}: 공유받는 사용자`, { exact: true }).last().waitFor()
  assert.equal(await managed.locator('.share-target').count(), 2)
  await owner.page.setViewportSize({ width: 390, height: 1000 }); await capture(owner.page, 'rd-t027-manage-mobile')
  assert.equal(await managed.evaluate(el => { const box = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) }), true, '모바일 메뉴가 공유 창을 가림')
  await managed.getByRole('button', { name: T('Cancel'), exact: true }).click()
  await owner.page.setViewportSize({ width: 1440, height: 1000 })
  await owner.page.goto(`${fixture.origin}/#/my/address_book_collection`)
  await owner.page.getByRole('button', { name: T('ShareRules'), exact: true }).click()
  await managed.locator('.share-target').last().waitFor()
  assert.equal(await managed.locator('.share-target').count(), 2)
  const preserved = owner.page.waitForResponse(response => response.url().endsWith('/my/sharing/save') && response.request().method() === 'POST')
  await managed.getByRole('button', { name: T('SaveSharing'), exact: true }).click()
  assert.equal((await preserved).request().postDataJSON().recipients.length, 2)
  await owner.page.goto(`${fixture.origin}/#/my/sharing`)
  await receiver.page.goto(`${fixture.origin}/#/my/peer`)
  await receiver.page.getByRole('tab', { name: T('ReceivedDevices'), exact: true }).click()
  await receiver.page.getByText(fixture.owner_name, { exact: true }).waitFor()
  const list = await call(receiver.context, fixture.receiver_token, '/api/admin/my/peer/list?scope=received&page=1&page_size=10')
  assert.equal(list.total, 1); assert.equal(list.list[0].owner_name, fixture.owner_name); assert.deepEqual(list.list[0].share_sources, ['운영 장치 공유'])
  assert.ok(!JSON.stringify(list).includes(fixture.password), '장치 목록에 비밀번호 노출')
  const native = await receiver.context.request.post(`${fixture.origin}/api/ab/shared/profiles`, { headers: { Authorization: `Bearer ${fixture.receiver_token}` }, data: {} })
  assert.equal(native.status(), 200); const profiles = await native.json(); assert.equal(profiles.total, 1)
  const peersResponse = await receiver.context.request.post(`${fixture.origin}/api/ab/peers?ab=${profiles.data[0].guid}&current=1&pageSize=100`, { headers: { Authorization: `Bearer ${fixture.receiver_token}` }, data: {} })
  assert.equal(peersResponse.status(), 200); const nativePeers = await peersResponse.json(); assert.equal(nativePeers.data[0].password, fixture.password)
  await capture(receiver.page, 'rd-t027-received-desktop')
  for (const width of [1440, 768, 390]) {
    await receiver.page.setViewportSize({ width, height: 1000 })
    if (width < 900) await receiver.page.getByRole('button', { name: '상세 정보 123456789', exact: true }).click()
    const entry = width < 900 ? receiver.page.locator('.device-detail-drawer .device-connect') : receiver.page.locator('.device-table .device-connect').first()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const terminal = receiver.page.getByRole('dialog', { name: 'ID : 123456789', exact: true })
    await terminal.getByText('접속 중', { exact: true }).waitFor()
    assert.equal(requests.at(-1).use_saved, true); assert.equal(requests.at(-1).password, '')
    const input = `shared session ${width}`
    await receiver.page.keyboard.type(input); await receiver.page.keyboard.press('Enter')
    await receiver.page.waitForFunction(input => document.querySelector('.xterm-screen')?.textContent.includes(input), input)
    await receiver.page.setViewportSize({ width: width - 10, height: 980 })
    const box = await terminal.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width - 9)
    assert.equal(await receiver.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await capture(receiver.page, `rd-t027-shared-terminal-${width}`)
    await terminal.getByRole('button', { name: T('Close'), exact: true }).click(); await waitInactive()
    if (width < 900) await receiver.page.locator('.device-detail-drawer .el-drawer__close-btn').click()
  }
  // 한 공유 경로를 취소해도 다른 경로가 남으면 접근할 수 있다.
  await call(owner.context, fixture.token, '/api/admin/my/sharing/save', { collection_id: cid, recipients: [{ type: 2, to_id: fixture.group_id, rule: 1 }] })
  assert.equal((await call(receiver.context, fixture.receiver_token, '/api/admin/my/peer/list?scope=received')).total, 1)
  await receiver.page.setViewportSize({ width: 1440, height: 1000 })
  await receiver.page.locator('.device-table .device-connect').first().getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
  const activeTerminal = receiver.page.getByRole('dialog', { name: 'ID : 123456789', exact: true }); await activeTerminal.getByText('접속 중', { exact: true }).waitFor()
  await control('leave-share-group')
  await receiver.page.waitForFunction(() => !document.querySelector('.xterm'), undefined, { timeout: 20000 }); await waitInactive()
  const denied = await receiver.context.request.post(`${fixture.origin}/api/admin/terminal/sessions`, { headers: { 'api-token': fixture.receiver_token, Origin: fixture.origin }, data: { peer_id: fixture.peer_id, use_saved: true } }); assert.equal(denied.status(), 403)
  assert.equal((await call(receiver.context, fixture.receiver_token, '/api/admin/my/peer/list?scope=received')).total, 0)
  await control('join-share-group')
  await owner.page.getByRole('button', { name: T('ManageSharing'), exact: true }).click()
  await managed.locator('.share-target').waitFor()
  await managed.getByRole('button', { name: `${T('RemoveRecipient')} ${T('Group')}: 운영팀`, exact: true }).click()
  const revoked = owner.page.waitForResponse(response => response.url().endsWith('/my/sharing/save') && response.request().method() === 'POST')
  await managed.getByRole('button', { name: T('SaveSharing'), exact: true }).click(); await revoked
  assert.equal((await call(receiver.context, fixture.receiver_token, '/api/admin/my/sharing/books?scope=received')).total, 0)
  await receiver.page.goto(`${fixture.origin}/#/my/sharing`)
  await receiver.page.getByRole('radio', { name: T('SharedWithMe'), exact: true }).focus(); await receiver.page.keyboard.press('Space')
  await receiver.page.getByText(T('NoReceivedAddressBooks'), { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: 실제 공유 API·공식 주소록 password 계약·장치 소유자·중복 경로·3개 화면 폭의 자동 터미널 인증/입력·그룹 이탈·활성 세션 철회·정리. 공식 앱/물리 장치 인수는 별도입니다.')
} finally {
  await owner.context.request.post(`${fixture.origin}/__fixture/done`, { headers: { 'X-Fixture-Gate': 'local-test-only' } }).catch(() => {})
  await browser.close()
}
