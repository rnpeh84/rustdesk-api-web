import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

// 실제 컴포넌트의 초기 모델을 평가하고 명령 생성에 사용되는 필드를 확인한다.
const source = await readFile(new URL('../src/components/client/OfficialClientInstall.vue', import.meta.url), 'utf8')
const expression = source.match(/const form = reactive\((\{[^\n]+\})\)/)?.[1]
assert.ok(expression)
const defaults = () => vm.runInNewContext(`(${expression})`)
const form = defaults()
assert.equal(form.replace_password, true)
assert.equal(form.replace_server, true)
assert.equal(form.switch_official, false)
form.replace_password = false
form.replace_server = false
assert.equal(form.replace_password, false)
assert.equal(form.replace_server, false)
assert.equal(defaults().replace_password, true)
assert.equal(defaults().replace_server, true)
console.log('PASS: 재설치 비밀번호·서버 전환 기본 선택, 사용자 해제 및 새 모델 기본값 유지')
