// 모의 장치로 화면과 전송 계약을 검증한다. 운영 파일에는 접근하지 않는다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:15173'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ locale: 'ko-KR', acceptDownloads: true })
await context.addInitScript(() => { localStorage.setItem('lang','ko'); localStorage.setItem('access_token','fixture-only') })
const page = await context.newPage(), errors = [], prepares = [], operations = []
page.on('pageerror', e => errors.push(e.message))
const metadata = { os:'AlmaLinux 10.1',cpu:'Fixture CPU / 8 CPU',memory:'16.0 GB',version:'1.5.0',hostname:'검증용 서버' }
const home = '/home/fixture-user'
const storage = new Map([[`${home}/readme.txt`, Buffer.from('한글 파일\n'.repeat(1200))]])
const directories = new Set(['/', '/home', home, `${home}/docs`, '/tmp', '/etc'])
const modes = new Map()
let info = {}, nextMode = '', badHash = false, closed = 0
const hash = data => createHash('sha256').update(data).digest('hex')
await page.route('**/api/admin/**', async route => {
  const path = new URL(route.request().url()).pathname
  let data = { list:[], total:0 }
  if (path.endsWith('/user/current')) data={id:1,username:'fixture-user',role:'user',permissions:['client.download'],route_names:['MyPeer','MyClient']}
  if (path.endsWith('/config/admin')) data={title:'파일 전송 검증'}
  if (path.endsWith('/config/app')) data={web_client:0}
  if (path.endsWith('/peer/list')) data={list:[{row_id:10,id:'123456789',hostname:'검증용 서버',last_online_time:Math.floor(Date.now()/1000)-3600}],total:1}
  if (path.endsWith('/terminal/status')) data={state:'unknown',terminal_state:'available',desktop_state:'no_session',service_running:true,reported_at:Math.floor(Date.now()/1000),has_saved_password:true,files_enabled:true,platform:'linux',shell_user:'fixture-user',device:{...info,last_online_time:Math.floor(Date.now()/1000)-3600}}
  if (path.endsWith('/terminal/sessions')) { const value=route.request().postDataJSON();prepares.push(value);nextMode=value.mode;data={ticket:'fixture-ticket',websocket_path:'/api/terminal/connect'} }
  await route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data})})
})
await page.routeWebSocket('**/api/terminal/connect', ws => {
  const mode = nextMode
  let job
  ws.onClose(() => closed++)
  ws.onMessage(async raw => {
    const value=JSON.parse(raw)
    if(value.type==='open'){ws.send(JSON.stringify({type:'opened'}));ws.send(JSON.stringify({type:'output',data:Buffer.from('fixture shell\r\n$ ').toString('base64')}));return}
    if(!value.op)return
    operations.push(value)
    let result={}
    const path=value.path || home, full=name=>`${path==='/'?'':path}/${name}`
    if(value.op==='list'){
      if(!directories.has(path))result={error:'permission'}
      else result={path,writable:path!=='/etc',entries:[...Array.from(directories).filter(p=>p!==path&&p.substring(0,p.lastIndexOf('/'))===(path==='/'?'':path)).map(p=>({name:p.split('/').pop(),kind:'directory',size:0,mode:'700',uid:1000,gid:1000,can_chmod:true})),...(path===home?[{name:'outside-link',kind:'blocked',size:0}]:[]),...Array.from(storage).filter(([p])=>p.substring(0,p.lastIndexOf('/'))===(path==='/'?'':path)).map(([p,data])=>({name:p.split('/').pop(),kind:'file',size:data.length,mode:modes.get(p)||'600',uid:1000,gid:1000,can_chmod:true}))],next:null}
    }
    if(value.op==='mkdir'){if(directories.has(full(value.name)))result={error:'exists'};else directories.add(full(value.name))}
    if(['copy','move','rename'].includes(value.op)){const source=full(value.name),target=`${value.target_path==='/'?'':value.target_path}/${value.target_name}`;if(storage.has(target))result={error:'exists'};else{storage.set(target,storage.get(source));if(value.op!=='copy')storage.delete(source)}}
    if(value.op==='remove'){storage.delete(full(value.name));directories.delete(full(value.name))}
    if(value.op==='chmod')modes.set(full(value.name),value.mode.toString(8).padStart(3,'0'))
    if(value.op==='upload_start'){if(storage.has(full(value.name)))result={error:'exists'};else job={name:full(value.name),chunks:[],size:value.size}}
    if(value.op==='upload_chunk'){job.chunks.push(Buffer.from(value.data,'base64'));await new Promise(resolve=>setTimeout(resolve,20));result={count:Buffer.concat(job.chunks).length}}
    if(value.op==='upload_finish'){const body=Buffer.concat(job.chunks);assert.equal(body.length,job.size);assert.equal(hash(body),value.sha256);storage.set(job.name,body);job=null;result={sha256:value.sha256}}
    if(value.op==='download_start'){job={data:storage.get(full(value.name)),offset:0};result={size:job.data.length}}
    if(value.op==='download_next'){if(job.offset===job.data.length){result={done:true,sha256:badHash?'0'.repeat(64):hash(job.data)};job=null}else{const chunk=job.data.subarray(job.offset,job.offset+6144);job.offset+=chunk.length;result={data:chunk.toString('base64'),count:job.offset}}}
    if(value.op==='cancel'){job=null;result={cancelled:true}}
    ws.send(JSON.stringify({...result,type:'files_result',id:value.id}))
  })
  setTimeout(()=>{
    if(mode==='files'){info=metadata;ws.send(JSON.stringify({type:'files_ready',user:'fixture-user',home,limit:67108864,system_info:metadata}))}
    else ws.send(JSON.stringify({type:'status',state:'allowed'}))
  },40)
})
try {
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:1000});await page.goto(`${origin}/#/my/peer`)
    await page.getByRole('button',{name:'상세 정보 123456789',exact:true}).click()
    const drawer=page.locator('.device-detail-drawer')
    await drawer.getByText(metadata.cpu,{exact:true}).waitFor()
    await drawer.getByText(metadata.memory,{exact:true}).waitFor()
    await drawer.getByText('온라인',{exact:true}).waitFor()
    assert.equal(await drawer.locator('.connection-summary,.connection-hint').count(),0)
    await drawer.getByRole('button',{name:'터미널 접속 123456789',exact:true}).click()
    const terminal=page.getByRole('dialog',{name:'ID : 123456789',exact:true})
    await terminal.getByText('접속 중',{exact:true}).waitFor()
    await terminal.getByRole('button',{name:'파일 전송',exact:true}).click()
    const files=page.getByRole('region',{name:'파일 전송 · 123456789',exact:true})
    await files.getByText('readme.txt',{exact:true}).waitFor()
    const data=Buffer.from('upload 한글\n'.repeat(1500)),name=`uploaded-${width}.txt`
    await files.locator('input[type="file"]').setInputFiles({name,mimeType:'text/plain',buffer:data})
    await page.locator('.notification-summary').getByText('1개 파일을 업로드했습니다.',{exact:true}).waitFor()
    assert.deepEqual(storage.get(`${home}/${name}`),data)
    const downloadWait=page.waitForEvent('download')
    await files.getByRole('button',{name:`다운로드 ${name}`,exact:true}).click()
    const downloaded=await downloadWait
    assert.deepEqual(await readFile(await downloaded.path()),data)
    assert.equal(await files.getByRole('button',{name:'다운로드 outside-link',exact:true}).count(),0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
    assert.equal(await files.locator('.el-table__body-wrapper .el-scrollbar__wrap').evaluate(element=>element.scrollWidth>element.clientWidth+1),false,'파일 목록 가로 스크롤 없이 파일명·다운로드 동시 표시')
    if(process.env.UI_TEST_SCREENSHOTS)await files.screenshot({path:join(process.env.UI_TEST_SCREENSHOTS,`device-files-${width}.png`)})
    if(width===1440){
      await files.locator('input[type="file"]').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from('new')})
      await page.locator('.notification-summary').getByText(/같은 이름의 파일이 있습니다/).waitFor()
      assert.deepEqual(storage.get(`${home}/${name}`),data)
      badHash=true
      await files.getByRole('button',{name:`다운로드 ${name}`,exact:true}).click()
      await page.locator('.notification-summary').getByText(/파일 검증에 실패했습니다/).waitFor();badHash=false
      await files.locator('input[type="file"]').setInputFiles({name:'cancel.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(120000)})
      await files.getByRole('button',{name:'취소',exact:true}).click()
      await page.locator('.notification-summary').getByText('전송을 취소했습니다.',{exact:true}).waitFor()
      assert.equal(storage.has(`${home}/cancel.bin`),false)
      await files.locator('.files-workspace').evaluate(element=>{
        const transfer=new DataTransfer();transfer.items.add(new File(['drag data'],'drag.txt',{type:'text/plain'}));element.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}))
      })
      await page.locator('.notification-summary').getByText('1개 파일을 업로드했습니다.',{exact:true}).waitFor()
      assert.equal(storage.get(`${home}/drag.txt`).toString(),'drag data')
      await files.getByRole('button',{name:'새 폴더',exact:true}).click()
      let editor=page.getByRole('dialog',{name:'새 폴더',exact:true})
      await editor.getByRole('textbox',{name:'파일명',exact:true}).fill('new-folder')
      await editor.getByRole('button',{name:'적용',exact:true}).click();await editor.waitFor({state:'hidden'})
      await files.getByRole('button',{name:'new-folder',exact:true}).waitFor()
      const action=async(op,name)=>{
        await files.getByRole('button',{name:`파일 작업 ${name}`,exact:true}).click()
        await page.getByRole('menuitem',{name:op,exact:true}).click()
        return page.getByRole('dialog',{name:op,exact:true})
      }
      await files.getByRole('button',{name:`파일 작업 ${name}`,exact:true}).click()
      assert.equal(await page.getByRole('menuitem',{name:'다운로드',exact:true}).evaluate(element=>element===document.activeElement),true)
      await page.keyboard.press('ArrowDown')
      assert.equal(await page.getByRole('menuitem',{name:'텍스트 편집기',exact:true}).evaluate(element=>element===document.activeElement),true)
      await page.keyboard.press('ArrowDown')
      assert.equal(await page.getByRole('menuitem',{name:'이름 변경',exact:true}).evaluate(element=>element===document.activeElement),true)
      await page.keyboard.press('Escape');await page.getByRole('menu',{name:'파일 작업',exact:true}).waitFor({state:'hidden'})
      assert.equal(await files.getByRole('button',{name:`파일 작업 ${name}`,exact:true}).evaluate(element=>element===document.activeElement),true)
      editor=await action('파일 복사',name)
      await editor.getByRole('textbox',{name:'파일명',exact:true}).fill('copied.txt')
      await editor.getByRole('textbox',{name:'대상 폴더의 절대 경로',exact:true}).fill('/tmp')
      await editor.getByRole('button',{name:'적용',exact:true}).click();await editor.waitFor({state:'hidden'})
      assert.deepEqual(storage.get('/tmp/copied.txt'),data)
      editor=await action('이름 변경','drag.txt')
      await editor.getByRole('textbox',{name:'파일명',exact:true}).fill('renamed.txt')
      await editor.getByRole('button',{name:'적용',exact:true}).click();await editor.waitFor({state:'hidden'})
      await files.getByRole('button',{name:'renamed.txt',exact:true}).click({button:'right'})
      await page.getByRole('menuitem',{name:'권한 변경',exact:true}).click()
      editor=page.getByRole('dialog',{name:'권한 변경',exact:true})
      await editor.getByRole('textbox',{name:'권한 (8진수)',exact:true}).fill('640')
      await editor.getByRole('button',{name:'적용',exact:true}).click();await editor.waitFor({state:'hidden'})
      assert.equal(modes.get(`${home}/renamed.txt`),'640')
      editor=await action('이동','renamed.txt')
      await editor.getByRole('textbox',{name:'대상 폴더의 절대 경로',exact:true}).fill('/tmp')
      await editor.getByRole('button',{name:'적용',exact:true}).click();await editor.waitFor({state:'hidden'})
      assert.equal(storage.has(`${home}/renamed.txt`),false)
      const pathInput=files.getByRole('textbox',{name:'현재 경로',exact:true})
      await pathInput.fill('/tmp');await files.getByRole('button',{name:'경로 이동',exact:true}).click()
      await files.getByRole('button',{name:'copied.txt',exact:true}).waitFor()
      await files.getByRole('button',{name:'copied.txt',exact:true}).focus();await page.keyboard.press('Shift+F10')
      await page.getByRole('menuitem',{name:'삭제',exact:true}).click()
      const confirmation=page.getByRole('dialog',{name:'삭제',exact:true})
      await confirmation.getByRole('button',{name:'취소',exact:true}).click()
      assert.ok(storage.has('/tmp/copied.txt'))
      await files.getByRole('button',{name:'파일 작업 copied.txt',exact:true}).click()
      await page.getByRole('menuitem',{name:'삭제',exact:true}).click()
      await confirmation.getByRole('button',{name:'삭제',exact:true}).click()
      await files.getByRole('button',{name:'copied.txt',exact:true}).waitFor({state:'hidden'})
      assert.equal(storage.has('/tmp/copied.txt'),false)
      await pathInput.fill('/etc');await files.getByRole('button',{name:'경로 이동',exact:true}).click()
      await files.getByText('이 폴더는 읽기 전용입니다.',{exact:true}).waitFor()
      assert.equal(await files.getByRole('button',{name:'업로드',exact:true}).isDisabled(),true)
      assert.equal(await files.getByRole('button',{name:'새 폴더',exact:true}).isDisabled(),true)
      await files.getByRole('button',{name:'상위 폴더',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.files-location input').value==='/')
      assert.equal(await files.getByRole('button',{name:'상위 폴더',exact:true}).isDisabled(),true)
      await pathInput.fill('/forbidden');await files.getByRole('button',{name:'경로 이동',exact:true}).click()
      await page.locator('.notification-summary').getByText('지정 OS 계정에 이 파일·폴더 접근 권한이 없습니다.',{exact:true}).waitFor()
      await files.getByRole('button',{name:'홈 폴더',exact:true}).click();await files.getByRole('button',{name:'readme.txt',exact:true}).waitFor()
      const divider=terminal.getByRole('separator',{name:'파일 패널 너비 조절',exact:true})
      const initial=Number(await divider.getAttribute('aria-valuenow'))
      await divider.focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await divider.getAttribute('aria-valuenow')),initial+20)
      const bounds=await divider.boundingBox();await page.mouse.move(bounds.x+4,bounds.y+40);await page.mouse.down();await page.mouse.move(bounds.x+44,bounds.y+40);await page.mouse.up()
      assert.equal(Number(await divider.getAttribute('aria-valuenow')),initial+60)
      await terminal.getByRole('button',{name:'파일 전송',exact:true}).click();await files.waitFor({state:'hidden'})
      await terminal.getByRole('button',{name:'파일 전송',exact:true}).click();await files.getByRole('button',{name:'readme.txt',exact:true}).waitFor()
    }
    await terminal.getByRole('button',{name:'터미널 크게 보기',exact:true}).click()
    for(const height of [1000,600,390]){
      await page.setViewportSize({width,height});await page.waitForTimeout(150)
      const pathBounds=await files.locator('.files-location .el-input__wrapper').boundingBox(),goBounds=await files.getByRole('button',{name:'경로 이동',exact:true}).boundingBox()
      assert.ok(Math.abs(pathBounds.height-goBounds.height)<1&&Math.abs(pathBounds.y-goBounds.y)<1,'경로 입력/버튼 높이가 다릅니다: '+JSON.stringify({width,height,pathBounds,goBounds}))
      const layout=await terminal.evaluate(element=>({overflow:[element,element.querySelector('.el-dialog'),element.querySelector('.el-dialog__body'),element.querySelector('.terminal-workspace'),element.querySelector('.device-files-panel')].map(node=>node.scrollHeight-node.clientHeight),footer:element.querySelector('.el-dialog__footer').getBoundingClientRect().bottom}))
      if(layout.overflow.some(value=>value>1))console.log('짧은 화면 패널 구성:',await files.evaluate(element=>Array.from(element.querySelectorAll('.files-heading,.files-workspace,.files-workspace>*')).map(node=>({class:node.className,height:node.getBoundingClientRect().height,margin:getComputedStyle(node).margin,minHeight:getComputedStyle(node).minHeight}))))
      assert.ok(layout.overflow.every(v=>v<=1),`${width}x${height} 파일 패널 외부 스크롤: ${JSON.stringify(layout)}`)
      assert.ok(layout.footer<=height+1)
    }
    await page.setViewportSize({width,height:1000});await page.waitForTimeout(150)
    if(process.env.UI_TEST_SCREENSHOTS)await terminal.screenshot({path:join(process.env.UI_TEST_SCREENSHOTS,`terminal-file-panel-${width}.png`)})
    await files.getByRole('button',{name:'파일 패널 닫기',exact:true}).click();await files.waitFor({state:'hidden'})
    await terminal.getByRole('button',{name:'닫기',exact:true}).click();await terminal.waitFor({state:'hidden'})
    await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'})
  }
  assert.ok(prepares.some(v=>v.mode==='files'&&v.use_saved&&v.password===''))
  assert.ok(closed>=6)
  assert.deepEqual(errors,[])
  console.log('PASS: 3개 화면 폭·짧은 확대 화면, 왼쪽 패널 표시/숨김/크기 조절, 홈 밖 경로·읽기 전용·권한 거부, 우클릭/키보드 파일 관리·삭제 확인·권한 변경, 양방향 SHA256·드롭·취소·연결 정리')
}finally{await context.close();await browser.close()}
