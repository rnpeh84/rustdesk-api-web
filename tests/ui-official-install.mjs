// 별도 브라우저와 모의 API를 사용한다. 운영 API와 설치 명령은 실행하지 않는다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:15173'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_TEST_BROWSER_CHANNEL || 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR' })
await context.addInitScript(() => {
  localStorage.setItem('lang', 'ko'); localStorage.setItem('access_token', 'fixture-local-ui-token')
  window.fixtureCopies = []; window.fixtureCopyBlocked = false
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    async writeText(value) {
      if (window.fixtureCopyBlocked) throw new DOMException('검증용 복사 거부', 'NotAllowedError')
      window.fixtureCopies.push(value)
    },
  } })
})
const page = await context.newPage()
let saved = false, settingsError = false, expiresPast = false, missingServer = false, prepareError = false, prepareDelay = 0
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
    if (prepareDelay) await new Promise(resolve => setTimeout(resolve, prepareDelay))
    if (prepareError) { await route.fulfill({ status: 503, body: '{}' }); return }
    const platform = issued.at(-1).platform
    const file = platform === 'windows' ? 'windows.ps1' : `${platform}.sh`
    data = { command: `curl https://api.example.test/api/client/install/official/${file} # fixture-command-only-${issued.length}`, expires_at: Math.floor(Date.now() / 1000) + (expiresPast ? -60 : 900) }
  }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data }) })
})
try {
  await page.goto(`${origin}/#/my/dashboard`)
  const install = page.getByRole('region', { name: '공식 클라이언트 빠른 설치',exact:true })
  await install.waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('#official-install-password')?.value.length === 8)
  assert.match(await page.locator('#official-install-password').inputValue(), /^[A-Za-z0-9]{8}$/)
  const icon = (os, arch) => install.getByRole('button', { name: `${os} ${arch} 설치 명령 복사`, exact: true })
  const commandBox = install.getByRole('textbox', { name: '공식 클라이언트 설치 명령', exact: true })
  assert.equal(await install.locator('.install-copy-icon').count(), 6)
  assert.equal(await install.getByRole('button', { name: '설치 명령 만들기', exact: true }).count(), 0)
  assert.equal(await install.getByRole('button', { name: '설치 명령 복사', exact: true }).count(), 0)
  assert.equal(issued.length, 0, '페이지 조회만으로 명령 발급')
  for (const os of ['Linux', 'Windows', 'macOS']) {
    assert.equal(await install.getByRole('group', { name: os, exact: true }).locator('.install-copy-icon').count(), 2)
  }
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
  prepareDelay = 250
  await icon('Linux', 'x64').focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  assert.equal(await icon('Linux', 'x64').evaluate(el => el === document.activeElement), true)
  assert.match(await icon('Linux', 'x64').evaluate(el => getComputedStyle(el).outlineStyle), /solid/)
  await icon('Linux', 'x64').press('Enter')
  await page.waitForFunction(() => document.querySelector('.official-install')?.getAttribute('aria-busy') === 'true')
  assert.equal(await install.locator('.install-copy-icon:disabled').count(), 6, '발급 중 중복 요청 허용')
  await page.waitForFunction(() => window.fixtureCopies.length === 1)
  prepareDelay = 0
  assert.equal(issued.length, 1)
  assert.equal(issued[0].shell_user, 'shelluser')
  assert.equal(issued[0].platform, 'linux')
  assert.equal(issued[0].replace_password, false)
  assert.equal(issued[0].replace_server, false)
  assert.equal(issued[0].switch_official, false)
  assert.equal(await commandBox.inputValue(), await page.evaluate(() => window.fixtureCopies.at(-1)), '클립보드와 표시 명령 불일치')
  assert.ok(!(await commandBox.inputValue()).includes(issued[0].password))
  assert.equal(await icon('Linux', 'x64').evaluate(el => el.classList.contains('is-copied')), true)
  await install.locator('.install-feedback').getByText('Linux x64 설치 명령을 복사했습니다.', { exact: true }).waitFor()
  assert.match(await install.getByRole('link', { name: '내 장치에서 확인 및 웹 터미널 연결' }).getAttribute('href'), /\/my\/peer$/)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await install.scrollIntoViewIfNeeded()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${width}px 등록 안내 가로 넘침`)
    if (process.env.UI_TEST_SCREENSHOTS) await install.screenshot({ path: join(process.env.UI_TEST_SCREENSHOTS, `official-install-registration-${width}.png`) })
  }
  await install.getByRole('button', { name: '8자리 생성' }).click()
  assert.equal(await commandBox.count(), 0, '설정 변경 후 이전 명령 유지')
  for (const [os, platform] of [['Windows', 'windows'], ['macOS', 'macos'], ['Linux', 'linux']]) {
    for (const arch of ['x64', 'ARM64']) {
      const previous = issued.length, copies = await page.evaluate(() => window.fixtureCopies.length)
      await icon(os, arch).click()
      await page.waitForFunction(count => window.fixtureCopies.length === count + 1, copies)
      assert.equal(issued.length, previous + 1)
      assert.equal(issued.at(-1).platform, platform)
      assert.equal(await commandBox.inputValue(), await page.evaluate(() => window.fixtureCopies.at(-1)))
      await install.locator('.install-feedback').getByText(`${os} ${arch} 설치 명령을 복사했습니다.`, { exact: true }).waitFor()
    }
  }
  await page.evaluate(() => { window.fixtureCopyBlocked = true })
  await icon('macOS', 'ARM64').click()
  await install.getByText('클립보드에 복사하지 못했습니다. 같은 복사 아이콘을 다시 누르거나 위 명령을 선택해 직접 복사하세요.').waitFor()
  const failedCommand = await commandBox.inputValue(), beforeRetry = issued.length
  assert.equal(await icon('macOS', 'ARM64').evaluate(el => el.classList.contains('is-copied')), false)
  await page.evaluate(() => { window.fixtureCopyBlocked = false })
  await icon('macOS', 'ARM64').click()
  await page.waitForFunction(value => window.fixtureCopies.at(-1) === value, failedCommand)
  assert.equal(issued.length, beforeRetry, '복사 재시도에서 유효한 명령 폐기')
  assert.equal(await install.locator('.install-error').count(), 0)

  await install.getByRole('button', { name: '추가 설정', exact: true }).click()
  await page.getByLabel('터미널 셸 계정', { exact: true }).fill('Windows User')
  assert.equal(await icon('Linux', 'x64').isDisabled(), true)
  assert.equal(await icon('macOS', 'ARM64').isDisabled(), true)
  assert.equal(await icon('Windows', 'ARM64').isDisabled(), false)
  await page.locator('#official-install-password').fill('short')
  assert.equal(await install.locator('.install-copy-icon:disabled').count(), 6)
  await page.getByLabel('터미널 셸 계정', { exact: true }).fill('')
  await install.getByRole('button', { name: '8자리 생성' }).click()
  await install.getByRole('button', { name: '추가 설정', exact: true }).click()
  prepareError = true
  await icon('Windows', 'x64').click()
  await install.getByText('설치 명령을 만들지 못했습니다. 서버 설정과 입력값을 확인하고 다시 시도해 주세요.').waitFor()
  assert.equal(await commandBox.count(), 0)
  prepareError = false
  await icon('Windows', 'x64').click()
  await install.locator('.install-feedback').getByText('Windows x64 설치 명령을 복사했습니다.', { exact: true }).waitFor()
  await page.reload()
  await page.waitForFunction(() => document.querySelector('#official-install-password')?.placeholder === '저장한 비밀번호 유지')
  assert.equal(await page.locator('#official-install-password').inputValue(), '')
  await install.getByRole('button', { name: '저장값 불러오기' }).click()
  await page.waitForFunction(() => document.querySelector('#official-install-password')?.value === 'SavedFixture8')
  assert.equal(await page.locator('#official-install-password').getAttribute('type'), 'password')
  expiresPast = true
  const copiesBeforeExpiry = await page.evaluate(() => window.fixtureCopies.length)
  await icon('Linux', 'ARM64').click()
  await install.getByText('명령이 만료되었습니다. 해당 복사 아이콘을 다시 눌러 주세요.').waitFor()
  assert.equal(await commandBox.inputValue(), '')
  assert.equal(await page.evaluate(() => window.fixtureCopies.length), copiesBeforeExpiry, '만료 명령 복사')
  expiresPast = false
  const issuedBeforeExpiryRetry = issued.length
  await icon('Linux', 'ARM64').press('Space')
  await install.locator('.install-feedback').getByText('Linux ARM64 설치 명령을 복사했습니다.', { exact: true }).waitFor()
  assert.equal(issued.length, issuedBeforeExpiryRetry + 1, '만료 후 새 명령 미발급')
  settingsError = true
  await page.reload()
  await install.getByText('설치 설정을 불러오지 못했습니다.', { exact: true }).waitFor()
  settingsError = false
  await install.getByRole('button', { name: '다시 시도', exact: true }).click()
  await install.getByRole('button', { name: '저장값 불러오기' }).waitFor()
  missingServer = true
  await page.reload()
  await install.getByText('관리자가 HTTPS API 주소와 서버 주소·공개키를 설정하면 설치 명령을 만들 수 있습니다.').waitFor()
  assert.equal(await install.locator('.install-copy-icon:disabled').count(), 6)

  // 모의 쓰기 검증 외에 Chrome의 실제 Clipboard API도 별도로 확인한다.
  missingServer = false
  await page.reload()
  await install.getByRole('button', { name: '저장값 불러오기' }).waitFor()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
  await page.evaluate(() => { delete navigator.clipboard })
  await icon('Windows', 'ARM64').click()
  await install.locator('.install-feedback').getByText('Windows ARM64 설치 명령을 복사했습니다.', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await commandBox.inputValue(), '실제 Clipboard API 복사 실패')
  assert.deepEqual(errors, [], '브라우저 런타임 오류')
  console.log('PASS: 6개 OS·CPU 아이콘 즉시 복사, 실제 Chrome Clipboard API, 1440/768/390px, Enter·Space·초점, 중복 요청 차단, 복사 실패 재시도·만료·설정 변경·저장 비밀번호·입력 검증·API 오류·서버 미설정')
} finally { await context.close(); await browser.close() }
