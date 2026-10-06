// 모의 API·WebSocket을 사용하며 운영 장치에서 명령을 실행하지 않는다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:15173'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR' })
await context.addInitScript(() => { if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'ko'); localStorage.setItem('access_token', 'fixture-local-ui-token') })
const page = await context.newPage()
page.setDefaultTimeout(15000)
const errors = [], requests = [], input = []
let state = 'unknown', response = 'ready', responseStage = '', rawMessage, closeSocket = false, sessionHTTPStatus = 200, prepareState = '', closed = 0, admin = false, sessionSocket
const ko = JSON.parse(await readFile(new URL('../src/utils/i18n/ko.json', import.meta.url), 'utf8'))
const en = JSON.parse(await readFile(new URL('../src/utils/i18n/en.json', import.meta.url), 'utf8'))
page.on('pageerror', e => errors.push(e.message))
await page.route('**/api/admin/**', async route => {
  const path = new URL(route.request().url()).pathname
  let data = { list: [], total: 0 }
  if (path.endsWith('/user/current')) data = { id: 1, username: 'fixture-user', role: admin ? 'device_admin' : 'user', permissions: admin ? ['device.read','device.write'] : ['client.download'], route_names: admin ? ['Peer','DeviceGroup','MyPeer'] : ['MyPeer', 'MyClient'] }
  if (path.endsWith('/config/admin')) data = { title: '로컬 터미널 검증' }
  if (path.endsWith('/config/app')) data = { web_client: 0 }
  if (path.endsWith('/peer/list')) data = { list: [{ row_id: 10, id: '123456789', hostname: '검증용 Linux', os: 'Linux', user_id: admin ? 2 : 1, last_online_time: Math.floor(Date.now() / 1000) }], total: 1 }
  if (path.endsWith('/terminal/status')) data = { state, checked_at: 0, has_saved_password: !admin, desktop_state:'no_session',terminal_state:'available',service_running:true,reported_at:Math.floor(Date.now()/1000),desktop_web_enabled:false,platform:'linux' }
  if (path.endsWith('/terminal/sessions')) {
    requests.push(route.request().postDataJSON())
    if (sessionHTTPStatus !== 200) { await route.fulfill({ status: sessionHTTPStatus, contentType: 'application/json', body: JSON.stringify({ message: 'fixture-private-request-reason' }) }); return }
    if (prepareState) { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 101, message: '연결 요청 검증 오류', data: { state: prepareState, stage: 'fixture-private-stage' } }) }); return }
    data = { ticket: 'fixture-single-use-ticket', websocket_path: '/api/terminal/connect', expires_in: 30 }
  }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data }) })
})
await page.routeWebSocket('**/api/terminal/connect', ws => {
  sessionSocket = ws
  ws.onClose(() => closed++)
  ws.onMessage(message => {
    const v = JSON.parse(message)
    input.push(v)
    if (v.type === 'open') {
      ws.send(JSON.stringify({ type: 'opened', state: 'ready' }))
      ws.send(JSON.stringify({ type: 'output', data: Buffer.from('\x1b[32mfixture shell\x1b[0m\r\n한글 출력\r\n$ ').toString('base64') }))
    }
  })
  setTimeout(() => {
    if (closeSocket) { ws.close({ code: 1011, reason: 'fixture-private-socket-reason' }); return }
    ws.send(rawMessage ?? JSON.stringify(response === 'ready' ? { type: 'status', state: 'allowed' } : { type: 'error', state: response, stage: responseStage, message: 'fixture-private-server-reason' }))
  }, 50)
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
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).waitFor()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'ID : 123456789' })
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
    assert.equal(await dialog.locator('.terminal-explanation').count(), 0)
    const normalHeight = (await dialog.locator('.terminal-screen').boundingBox()).height
    await dialog.getByRole('button', { name: '터미널 크게 보기', exact: true }).click()
    await page.waitForTimeout(200)
    const expandedBox = await dialog.boundingBox()
    assert.ok(expandedBox.width >= width - 2)
    assert.ok((await dialog.locator('.terminal-screen').boundingBox()).height > normalHeight)
    sessionSocket.send(JSON.stringify({ type: 'output', data: Buffer.from('스크롤 확인용 출력\r\n'.repeat(200)).toString('base64') }))
    for (const height of [1000, 600, 390]) {
      await page.setViewportSize({ width, height })
      await page.waitForTimeout(200)
      const layout = await dialog.evaluate(element => {
        const panel = element.querySelector('.el-dialog') || element
        const bounds = panel.getBoundingClientRect(), footer = element.querySelector('.el-dialog__footer').getBoundingClientRect()
        const containers = [panel, element.querySelector('.el-dialog__body'), element.closest('.el-overlay-dialog')]
        const viewport = element.querySelector('.xterm-viewport')
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, footerBottom: footer.bottom, overflow: containers.map(node => node.scrollHeight - node.clientHeight), terminalScroll: viewport.scrollHeight - viewport.clientHeight }
      })
      assert.ok(Math.abs(layout.x) <= 1 && Math.abs(layout.y) <= 1 && Math.abs(layout.width - width) <= 1 && Math.abs(layout.height - height) <= 1, `${width}x${height}: 확대 창이 화면을 채우지 않음`)
      assert.ok(layout.overflow.every(value => value <= 1), `${width}x${height}: 확대 창에 추가 스크롤 발생 ${JSON.stringify(layout)}`)
      assert.ok(layout.footerBottom <= height + 1, `${width}x${height}: 하단 버튼 가림`)
      assert.ok(layout.terminalScroll > 0, `${width}x${height}: 터미널 출력 스크롤 누락`)
    }
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForTimeout(200)
    if (process.env.UI_TEST_SCREENSHOTS) await dialog.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, `web-terminal-expanded-${width}.png`) })
    await dialog.getByRole('button', { name: '터미널 원래 크기', exact: true }).click()
    await page.waitForTimeout(200)
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
    const dialog = page.getByRole('dialog', { name: 'ID : 123456789' })
    await dialog.waitFor()
    await dialog.getByText(label, { exact: true }).waitFor()
    const form=await dialog.locator('.terminal-connect-form').boundingBox(),check=await dialog.locator('.terminal-connect-form>.el-checkbox').boundingBox(),connect=await dialog.getByRole('button',{name:'확인 후 연결',exact:true}).boundingBox()
    assert.ok(Math.abs(check.y+check.height/2-connect.y-connect.height/2)<2,`연결 체크박스와 버튼의 세로 중심이 다릅니다: ${JSON.stringify({form,check,connect})}`)
    assert.ok(form.x+form.width-connect.x-connect.width<=17&&form.x+form.width-connect.x-connect.width>=11,'연결 버튼의 우측 여백/정렬이 다릅니다.')
    assert.ok(form.height<=48,'저장 비밀번호 연결 행의 위아래 여백이 과도합니다.')
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
  // 서버 원인은 정해진 번역으로 표시하고 임의 원문·내부 정보는 화면에 반영하지 않는다.
  for (const [code, stage] of [
    ['key_mismatch','rendezvous'], ['offline','rendezvous'], ['peer_not_found','rendezvous'], ['server_rejected','rendezvous'],
    ['signature_failed','server_verification'], ['id_server_unreachable','id_server'], ['relay_unreachable','relay'],
    ['connection_timeout','authentication'], ['connection_closed','session'], ['protocol_error','device_verification'],
    ['browser_transport','browser'], ['request_failed','request'], ['access_denied','request'], ['browser_terminal_error','browser'],
    ['fixture-private-unknown-state','fixture-private-unknown-stage'],
  ]) {
    response = code; responseStage = stage; await page.reload()
    const entry = await openEntry()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'ID : 123456789' })
    const expected = ko[`TerminalState_${code}`] ? code : 'unavailable'
    const status = dialog.getByRole('status')
    await status.getByText(ko[`TerminalState_${expected}`].One, { exact: true }).waitFor()
    await status.getByText(ko[`TerminalHelp_${expected}`].One, { exact: true }).waitFor()
    if (ko[`TerminalStage_${stage}`]) await status.getByText(`실패 단계: ${ko[`TerminalStage_${stage}`].One}`, { exact: true }).waitFor()
    else assert.equal(await status.locator('.terminal-failure-stage').count(), 0)
    assert.equal((await dialog.innerText()).includes('fixture-private-'), false)
    assert.equal(await dialog.locator('.xterm').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    if (code === 'key_mismatch') {
      if (process.env.UI_TEST_SCREENSHOTS) await dialog.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, 'web-terminal-key-mismatch-390.png') })
      response = 'ready'; responseStage = ''
      await dialog.getByRole('button', { name: '확인 후 연결' }).click()
      await status.getByText('접속 중', { exact: true }).waitFor()
      assert.equal(await status.locator('.terminal-failure-stage').count(), 0, '복구 후 이전 실패 단계 노출')
    }
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.keyboard.press('Escape')
    await page.locator('.device-detail-drawer').waitFor({ state: 'hidden' })
  }
  // JSON 해석 실패·브라우저 연결 종료·HTTP 거부도 실제 프런트엔드 처리 경로를 실행한다.
  response = 'ready'; responseStage = ''
  for (const [kind, expected, stage] of [['null','protocol_error','browser'], ['json','protocol_error','browser'], ['closed','connection_closed','browser'], ['403','access_denied','request'], ['500','request_failed','request']]) {
    rawMessage = kind === 'null' ? 'null' : kind === 'json' ? '{' : undefined
    closeSocket = kind === 'closed'; sessionHTTPStatus = /^\d+$/.test(kind) ? Number(kind) : 200
    await page.reload(); const entry = await openEntry()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'ID : 123456789' })
    await dialog.getByRole('status').getByText(ko[`TerminalState_${expected}`].One, { exact: true }).waitFor()
    await dialog.getByText(`실패 단계: ${ko[`TerminalStage_${stage}`].One}`, { exact: true }).waitFor()
    assert.equal((await dialog.innerText()).includes('fixture-private-'), false)
    assert.equal(await dialog.locator('.xterm').count(), 0)
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' }); await page.keyboard.press('Escape')
    await page.locator('.device-detail-drawer').waitFor({ state: 'hidden' })
  }
  rawMessage = undefined; closeSocket = false; sessionHTTPStatus = 200
  for (const code of ['busy', 'saved_password_unavailable', 'fixture-private-unknown-request', 'ready']) {
    prepareState = code; await page.reload(); const entry = await openEntry()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'ID : 123456789' })
    const expected = ['busy','saved_password_unavailable'].includes(code) ? code : 'request_failed'
    await dialog.getByRole('status').getByText(ko[`TerminalState_${expected}`].One, { exact: true }).waitFor()
    await dialog.getByText(ko[`TerminalHelp_${expected}`].One, { exact: true }).waitFor()
    await dialog.getByText('실패 단계: 웹 연결 요청 발급', { exact: true }).waitFor()
    assert.equal((await dialog.innerText()).includes('fixture-private-'), false)
    assert.equal(await dialog.locator('.xterm').count(), 0)
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' }); await page.keyboard.press('Escape')
    await page.locator('.device-detail-drawer').waitFor({ state: 'hidden' })
  }
  prepareState = ''
  // 긴 실패 안내를 태블릿·데스크톱에서도 확인하고 영문 번역 및 키보드 재시도를 검증한다.
  for (const width of [768, 1440]) {
    response = 'key_mismatch'; responseStage = 'rendezvous'
    await page.setViewportSize({ width, height: 1000 }); await page.reload()
    const entry = await openEntry()
    await entry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'ID : 123456789' })
    await dialog.getByRole('status').getByText('서버 공개키 불일치', { exact: true }).waitFor()
    const box = await dialog.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1)
    if (process.env.UI_TEST_SCREENSHOTS) await dialog.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, `web-terminal-key-mismatch-${width}.png`) })
    response = 'ready'; responseStage = ''
    await dialog.getByRole('button', { name: '확인 후 연결' }).focus(); await page.keyboard.press('Enter')
    await dialog.getByRole('status').getByText('접속 중', { exact: true }).waitFor()
    assert.equal(await dialog.locator('.terminal-failure-stage').count(), 0)
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    if (width < 900) { await page.keyboard.press('Escape'); await page.locator('.device-detail-drawer').waitFor({ state: 'hidden' }) }
  }
  await page.evaluate(() => localStorage.setItem('lang','en'))
  response = 'key_mismatch'; responseStage = 'rendezvous'; await page.reload()
  await page.locator('.device-connect button').first().click()
  const englishDialog = page.getByRole('dialog')
  await englishDialog.getByRole('status').getByText(en.TerminalState_key_mismatch.One, { exact: true }).waitFor()
  await englishDialog.getByText(`${en.TerminalFailureStage.One}: ${en.TerminalStage_rendezvous.One}`, { exact: true }).waitFor()
  await englishDialog.getByRole('button', { name: 'Close', exact: true }).click()
  await englishDialog.waitFor({ state: 'hidden' })
  await page.evaluate(() => localStorage.setItem('lang','ko')); await page.reload()
  assert.ok(closed >= 3, '종료 후 WebSocket 정리')
  admin = true; response = 'ready'; state = 'unknown'
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${origin}/#/user/peer`)
  await page.reload()
  const adminEntry = page.locator('.device-connect').first()
  await adminEntry.getByRole('button', { name: '터미널 접속 123456789', exact: true }).click()
  const adminDialog = page.getByRole('dialog', { name: 'ID : 123456789' })
  await adminDialog.getByRole('textbox', { name: '장치 무인 접속 비밀번호' }).fill('fixture-admin-device-password')
  assert.equal(await adminDialog.getByRole('checkbox').count(), 0, '타인 장치에 저장 비밀번호 선택 노출')
  await adminDialog.getByRole('button', { name: '확인 후 연결' }).click()
  await adminDialog.getByText('접속 중', { exact: true }).waitFor()
  assert.equal(requests.at(-1).use_saved, false)
  await page.goto(`${origin}/#/user/deviceGroup`)
  await page.waitForFunction(() => !document.querySelector('.xterm'))
  assert.deepEqual(errors, [])
  console.log('PASS: 1440/768/390px, 사용자·장치관리자, 저장 비밀번호·직접 입력, 렌더링·키보드·정리, 기존 5개·추가 15개 실패 원인/단계/대처 안내, 요청 제한/저장 비밀번호 실패, 미등록 코드/원문 비노출, JSON/연결 종료/HTTP 오류, 재시도 복구·영문')
} finally { await context.close(); await browser.close() }
