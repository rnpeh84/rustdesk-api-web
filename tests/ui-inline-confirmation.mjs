// 샘플 페이지에서 실제 컴포넌트의 크기·스크롤·확인 동작을 검사한다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const artifacts = process.env.INLINE_ARTIFACTS || '../runtime/inline-confirmation'
await mkdir(artifacts, { recursive: true })
const observations = []
const baseline = process.env.INLINE_BASELINE === '1'
try {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, locale: 'ko-KR', reducedMotion: 'reduce' })
    const errors = [], requests = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) requests.push(r.url()) })
    await page.goto('http://127.0.0.1:5189/tests/inlineConfirmation.html')
    const edge = page.getByTestId('edge')
    await edge.waitFor()
    const dimensions = () => page.evaluate(() => ({
      document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight, scrollX, scrollY],
      tables: [...document.querySelectorAll('.el-scrollbar__wrap')].map(el => [el.scrollWidth, el.scrollHeight, el.scrollLeft, el.scrollTop]),
      button: (() => { const r = document.querySelector('[data-testid="edge"]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })(),
    }))
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await page.getByRole('button', { name: '라이트 모드', exact: true }).click()
      if (!baseline) {
        const style = async button => {
          await button.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))) })
          return button.evaluate(el => {
          const css = getComputedStyle(el), r = el.getBoundingClientRect(), icon = el.querySelector('.el-icon').getBoundingClientRect()
          return { color: css.color, background: css.backgroundColor, border: css.borderColor, radius: css.borderRadius, width: r.width, height: r.height, iconX: icon.x + icon.width / 2 - r.x - r.width / 2, iconY: icon.y + icon.height / 2 - r.y - r.height / 2 }
          })
        }
        let standard, standardHover
        for (const scope of ['row-actions', 'card-actions', 'table-actions']) {
          for (const key of ['edit', 'share', 'view', 'refresh', 'validate', 'publish', 'cancel', 'more', 'copy', 'order']) {
            const button = page.getByTestId(`action-${scope}-${key}`)
            await page.mouse.move(0, 0); await page.locator('h1').click(); await page.waitForTimeout(20)
            const initial = await style(button)
            assert.equal(initial.width, 28); assert.equal(initial.height, 28); assert.equal(initial.radius, '4px')
            assert.ok(Math.abs(initial.iconX) <= .5 && Math.abs(initial.iconY) <= .5)
            if (!standard) standard = initial
            assert.deepEqual(initial, standard, `일반 아이콘 기본 스타일 불일치: ${scope}/${key}`)
            await button.hover(); await page.waitForTimeout(20)
            const hovered = await style(button)
            if (!standardHover) standardHover = hovered
            assert.deepEqual(hovered, standardHover, `일반 아이콘 호버 불일치: ${scope}/${key}`)
          }
          const disabled = page.getByTestId(`action-${scope}-disabled`)
          await disabled.hover(); await page.waitForTimeout(20)
          const disabledStyle = await style(disabled)
          assert.equal(disabledStyle.width, 28); assert.equal(disabledStyle.height, 28)
          assert.equal(disabledStyle.background, 'rgba(0, 0, 0, 0)')
          const confirm = page.getByTestId(`action-${scope}-confirm`)
          await confirm.click(); await page.waitForTimeout(20)
          assert.equal(await confirm.getAttribute('aria-pressed'), 'true')
          assert.deepEqual(await style(confirm), standardHover, '비삭제 확인은 동일 파란색 호버 스타일이어야 함')
          await confirm.press('Escape')
          const unshare = page.getByTestId(`action-${scope}-unshare`)
          const paths = button => button.locator('svg').evaluate(svg => [...svg.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'))
          assert.notEqual(await paths(unshare), await paths(edge), '공유 해제와 삭제의 기본 아이콘은 달라야 함')
          await unshare.hover(); await page.waitForTimeout(20)
          const unshareHover = await style(unshare)
          const red = unshareHover.color.match(/\d+/g).map(Number)
          assert.ok(red[0] > red[1] && red[0] > red[2], '공유 해제 호버는 붉은색이어야 함')
          await unshare.click(); await page.waitForTimeout(20)
          assert.equal(await unshare.getAttribute('aria-pressed'), 'true')
          const unshareConfirm = await style(unshare)
          assert.equal(unshareConfirm.color, unshareHover.color)
          assert.equal(unshareConfirm.background, unshareHover.background)
          assert.ok(Math.abs(unshareConfirm.iconX) <= .5 && Math.abs(unshareConfirm.iconY) <= .5)
          await unshare.press('Escape')
          await unshare.click()
          assert.equal(await unshare.getAttribute('aria-pressed'), 'true')
          await unshare.click()
          assert.equal(await unshare.getAttribute('aria-pressed'), 'false')
          assert.ok((await page.locator('.preview-status').innerText()).includes('공유 해제'))
          const revoke = page.getByTestId(`action-${scope}-revoke`)
          await revoke.hover(); await page.waitForTimeout(20)
          const revokeHover = await style(revoke)
          assert.equal(revokeHover.color, unshareHover.color, '세션·토큰 해제도 공유 해제와 같은 붉은색이어야 함')
          assert.equal(revokeHover.background, unshareHover.background)
          await revoke.click(); await page.waitForTimeout(20)
          assert.equal(await revoke.getAttribute('aria-pressed'), 'true')
          const revokeConfirm = await style(revoke)
          assert.equal(revokeConfirm.color, unshareConfirm.color)
          assert.equal(revokeConfirm.background, unshareConfirm.background)
          await revoke.press('Escape')
        }
        assert.ok(Number(standard.color.match(/\d+/g)[2]) > Number(standard.color.match(/\d+/g)[0]), '일반 아이콘 기본 색은 파란색이어야 함')
      }
      await edge.hover()
      await page.waitForTimeout(500)
      if (!baseline) {
        const hover = await edge.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))
        for (const value of Object.values(hover)) { const rgb = value.match(/\d+/g).map(Number); assert.ok(rgb[0] > rgb[1] && rgb[0] > rgb[2], '삭제 호버는 붉은색이어야 함') }
      }
      const before = await dimensions()
      await edge.click()
      const samples = []
      for (let i = 0; i < 15; i++) { samples.push(await dimensions()); await page.waitForTimeout(25) }
      const color = await edge.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))
      observations.push({ width, theme, before, samples, color, errors, apiRequests: requests })
      if (!baseline) {
        assert.deepEqual(samples, samples.map(() => before), `첫 클릭 스크롤/위치 변경: ${width} ${theme}`)
        assert.equal(await edge.getAttribute('aria-pressed'), 'true')
        const layout = await edge.evaluate(el => {
          const button = el.getBoundingClientRect(), icon = el.querySelector('.el-icon').getBoundingClientRect()
          return { x: icon.x + icon.width / 2 - button.x - button.width / 2, y: icon.y + icon.height / 2 - button.y - button.height / 2, background: getComputedStyle(document.documentElement).getPropertyValue('--console-danger-soft').trim() }
        })
        assert.ok(Math.abs(layout.x) <= 0.5 && Math.abs(layout.y) <= 0.5, `체크 가운데 정렬: ${JSON.stringify(layout)}`)
        const soft = await edge.evaluate(el => { const probe = document.createElement('span'); probe.style.backgroundColor = 'var(--console-danger-soft)'; el.append(probe); const value = getComputedStyle(probe).backgroundColor; probe.remove(); return value })
        assert.equal(color.background, soft, '확인 배경은 호버와 같은 옅은 붉은색이어야 함')
        const rgb = color.background.match(/\d+/g).map(Number)
        assert.ok(rgb[0] > rgb[1] && rgb[0] > rgb[2], '확인 배경은 붉은색이어야 함')
      }
      await page.screenshot({ path: `${artifacts}/${baseline ? 'before' : 'after'}-${width}-${theme}.png`, fullPage: true })
      await edge.press('Escape')
      assert.equal(await edge.getAttribute('aria-pressed'), 'false')
    }
    if (!baseline) {
      const reset = page.getByRole('button', { name: '초기화', exact: true })
      const normal = page.getByTestId('row-1').getByRole('button')
      await normal.click()
      assert.ok((await page.locator('.preview-status').innerText()).includes('삭제 실행 0회'))
      await normal.click()
      // 처리 중 DOM click을 반복해도 실행은 한 번만 발생해야 한다.
      await normal.evaluate(el => { el.click(); el.click() })
      await page.getByTestId('row-1').waitFor({ state: 'hidden' })
      assert.ok((await page.locator('.preview-status').innerText()).includes('삭제 실행 1회'))
      await reset.click()
      await normal.focus(); await normal.press('Enter')
      assert.equal(await normal.getAttribute('aria-pressed'), 'true')
      await normal.dispatchEvent('keydown', { key: 'Enter', repeat: true })
      assert.equal(await normal.getAttribute('aria-pressed'), 'true')
      await normal.press('Tab')
      assert.equal(await normal.getAttribute('aria-pressed'), 'false')
      await edge.click(); await page.locator('h1').click()
      assert.equal(await edge.getAttribute('aria-pressed'), 'false')
      await edge.focus(); await edge.press('Space')
      assert.equal(await edge.getAttribute('aria-pressed'), 'true')
      await page.waitForTimeout(5150)
      assert.equal(await edge.getAttribute('aria-pressed'), 'false')
      const own = page.getByTestId('row-2').getByRole('button')
      const ownStart = await own.boundingBox(), ownDocument = await dimensions()
      await own.click()
      await page.waitForFunction(() => document.querySelector('[data-testid="row-2"] button').getAttribute('aria-pressed') === 'true')
      const ownBefore = await own.boundingBox()
      assert.deepEqual(ownBefore, ownStart)
      assert.deepEqual(await dimensions(), ownDocument)
      await own.press('Escape')
      assert.equal(await own.getAttribute('aria-pressed'), 'false')
      await own.click()
      await page.waitForFunction(() => document.querySelector('[data-testid="row-2"] button').getAttribute('aria-pressed') === 'true')
      assert.deepEqual(await own.boundingBox(), ownBefore)
      await own.click()
      await page.getByTestId('row-2').waitFor({ state: 'hidden' })
      const shared = page.getByTestId('row-3').getByRole('button')
      await shared.click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await page.screenshot({ path: `${artifacts}/shared-${width}.png`, fullPage: true })
      await dialog.getByRole('button', { name: '취소', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(await shared.isVisible(), true)
      const batch = page.getByTestId('batch'), rect = await batch.boundingBox()
      await batch.click()
      assert.deepEqual(await batch.boundingBox(), rect)
      await batch.press('Escape')
      assert.equal(await batch.getAttribute('aria-pressed'), 'false')
      assert.deepEqual(errors, [])
      assert.deepEqual(requests, [], '샘플 페이지에서 실제 API 요청 발생')
    }
    await page.close()
  }
} finally { await browser.close(); await writeFile(`${artifacts}/${baseline ? 'before' : 'after'}.json`, JSON.stringify(observations, null, 2)) }
console.log(JSON.stringify({ baseline, screens: observations.length, artifacts, passed: !baseline }))
