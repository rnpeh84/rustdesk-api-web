// 별도 브라우저와 모의 API를 사용한다. 운영 API와 설치 명령은 실행하지 않는다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:15173'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_TEST_BROWSER_CHANNEL || 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR' })
await context.addInitScript(() => { localStorage.setItem('lang', 'ko'); localStorage.setItem('access_token', 'fixture-local-ui-token'); Object.defineProperty(navigator,'platform',{value:'Linux x86_64'}); Object.defineProperty(navigator,'userAgentData',{value:{platform:'Linux'}}) })
const page = await context.newPage()
let saved = false, settingsError = false, expiresPast = false, missingServer = false
const issued = [], errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/admin/**', async route => {
  const path = new URL(route.request().url()).pathname
  let data = { list: [], total: 0 }
  const server = { name: '검증용 서버', id_server: 'id.example.test', key: 'fixture-public-key', api_server: 'https://api.example.test', relay_server: 'relay.example.test' }
  if (path.endsWith('/user/current')) data = { username: 'fixture-user', nickname: '검증 사용자', role: 'user', token: 'fixture-local-ui-token', route_names: ['MyPeer', 'MyClient'] }
  if (path.endsWith('/config/admin')) data = { title: '로컬 검증', hello: '' }
  if (path.endsWith('/config/app')) data = { web_client: 0 }
  if (path.endsWith('/config/server')) data = server
  if (path.endsWith('/client/releases')) data = { list: [], server: missingServer ? {} : server }
  if (path.endsWith('/official-install/settings')) {
    if (settingsError) { await route.fulfill({ status: 503, body: '{}' }); return }
    data = { has_password: saved, mode: 'auto', shell_user: '' }
  }
  if (path.endsWith('/official-install/password')) data = { password: 'SavedFixture8' }
  if (path.endsWith('/official-install/prepare')) {
    issued.push(route.request().postDataJSON()); saved = true
    data = { command: "curl https://api.example.test/api/client/install/official/linux.sh # fixture-command-only", expires_at: Math.floor(Date.now() / 1000) + (expiresPast ? -60 : 900) }
  }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data }) })
})
try {
  await page.goto(`${origin}/#/my/dashboard`)
  const install = page.getByRole('region', { name: '공식 클라이언트 빠른 설치',exact:true })
  await install.waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('#official-install-password')?.value.length === 8)
  assert.match(await page.locator('#official-install-password').inputValue(), /^[A-Za-z0-9]{8}$/)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await install.scrollIntoViewIfNeeded()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${width}px 가로 넘침`)
    if (process.env.UI_TEST_SCREENSHOTS) await install.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, `official-install-${width}.png`) })
    await install.getByRole('button', { name: '추가 설정', exact: true }).click()
    await page.getByLabel('터미널 셸 계정', { exact: true }).waitFor({ state: 'visible' })
    await page.getByLabel('터미널 셸 계정', { exact: true }).fill('shelluser')
    await page.getByLabel('터미널 셸 계정', { exact: true }).press('Tab')
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY')
    await install.getByRole('button', { name: '추가 설정', exact: true }).click()
  }
  await install.getByRole('button', { name: '설치 명령 만들기', exact: true }).click()
  await install.getByRole('textbox', { name: '공식 클라이언트 설치 명령' }).waitFor({ state: 'visible' })
  assert.equal(issued.length, 1)
  assert.equal(issued[0].shell_user, 'shelluser')
  assert.equal(issued[0].platform, 'linux')
  assert.equal(issued[0].replace_password, false)
  assert.equal(issued[0].replace_server, false)
  assert.equal(issued[0].switch_official, false)
  assert.ok(!(await install.getByRole('textbox', { name: '공식 클라이언트 설치 명령' }).inputValue()).includes(issued[0].password))
  assert.match(await install.getByRole('link', { name: '내 장치에서 확인 및 웹 터미널 연결' }).getAttribute('href'), /\/my\/peer$/)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await install.scrollIntoViewIfNeeded()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${width}px 등록 안내 가로 넘침`)
    if (process.env.UI_TEST_SCREENSHOTS) await install.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, `official-install-registration-${width}.png`) })
  }
  await install.getByRole('button', { name: '설치 명령 복사' }).click()
  await install.getByRole('button', { name: '8자리 생성' }).click()
  assert.equal(await install.getByRole('textbox', { name: '공식 클라이언트 설치 명령' }).count(), 0, '설정 변경 후 이전 명령 유지')
  for(const [os,platform] of [['Windows','windows'],['macOS','macos'],['Linux','linux']]){
    await install.locator('.el-select').first().click()
    await page.getByRole('option',{name:os,exact:true}).click()
    assert.equal(await install.getByRole('textbox',{name:'공식 클라이언트 설치 명령'}).count(),0,'OS 변경 후 이전 명령 노출')
    await install.getByRole('button',{name:'설치 명령 만들기',exact:true}).click()
    await install.getByRole('textbox',{name:'공식 클라이언트 설치 명령'}).waitFor()
    assert.equal(issued.at(-1).platform,platform)
  }
  await page.reload()
  await page.waitForFunction(() => document.querySelector('#official-install-password')?.placeholder === '저장한 비밀번호 유지')
  assert.equal(await page.locator('#official-install-password').inputValue(), '')
  await install.getByRole('button', { name: '저장값 불러오기' }).click()
  await page.waitForFunction(() => document.querySelector('#official-install-password')?.value === 'SavedFixture8')
  assert.equal(await page.locator('#official-install-password').getAttribute('type'), 'password')
  expiresPast = true
  await install.getByRole('button', { name: '설치 명령 만들기', exact: true }).click()
  await install.getByText('명령이 만료되었습니다. 새 명령을 만들어 주세요.').waitFor()
  assert.equal(await install.getByRole('button', { name: '설치 명령 복사' }).isDisabled(), true)
  settingsError = true
  await page.reload()
  await install.getByText('설치 설정을 불러오지 못했습니다.', { exact: true }).waitFor()
  settingsError = false
  await install.getByRole('button', { name: '다시 시도', exact: true }).click()
  await install.getByRole('button', { name: '저장값 불러오기' }).waitFor()
  missingServer = true
  await page.reload()
  await install.getByText('관리자가 HTTPS API 주소와 서버 주소·공개키를 설정하면 설치 명령을 만들 수 있습니다.').waitFor()
  assert.equal(await install.getByRole('button', { name: '설치 명령 만들기', exact: true }).isDisabled(), true)
  assert.deepEqual(errors, [], '브라우저 런타임 오류')
  console.log('PASS: 1440/768/390px, 키보드 초점, 기본값·암호 표시·설정 변경·명령 발급·만료·오류 재시도·서버 미설정')
} finally { await context.close(); await browser.close() }
