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
const storage = new Map([['readme.txt', Buffer.from('한글 파일\n'.repeat(1200))]])
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
    if(value.op==='list')result={entries:[{name:'docs',kind:'directory',size:0},{name:'outside-link',kind:'blocked',size:0},...Array.from(storage,([name,data])=>({name,kind:'file',size:data.length}))],next:null}
    if(value.op==='upload_start'){if(storage.has(value.name))result={error:'exists'};else job={name:value.name,chunks:[],size:value.size}}
    if(value.op==='upload_chunk'){job.chunks.push(Buffer.from(value.data,'base64'));await new Promise(resolve=>setTimeout(resolve,20));result={count:Buffer.concat(job.chunks).length}}
    if(value.op==='upload_finish'){const body=Buffer.concat(job.chunks);assert.equal(body.length,job.size);assert.equal(hash(body),value.sha256);storage.set(job.name,body);job=null;result={sha256:value.sha256}}
    if(value.op==='download_start'){job={data:storage.get(value.name),offset:0};result={size:job.data.length}}
    if(value.op==='download_next'){if(job.offset===job.data.length){result={done:true,sha256:badHash?'0'.repeat(64):hash(job.data)};job=null}else{const chunk=job.data.subarray(job.offset,job.offset+6144);job.offset+=chunk.length;result={data:chunk.toString('base64'),count:job.offset}}}
    if(value.op==='cancel'){job=null;result={cancelled:true}}
    ws.send(JSON.stringify({...result,type:'files_result',id:value.id}))
  })
  setTimeout(()=>{
    if(mode==='files'){info=metadata;ws.send(JSON.stringify({type:'files_ready',user:'fixture-user',limit:67108864,system_info:metadata}))}
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
    const terminal=page.getByRole('dialog',{name:'웹 터미널 · 123456789',exact:true})
    await terminal.getByText('접속 중',{exact:true}).waitFor()
    await terminal.getByRole('button',{name:'파일 전송',exact:true}).click()
    const files=page.getByRole('dialog',{name:'파일 전송 · 123456789',exact:true})
    await files.getByText('readme.txt',{exact:true}).waitFor()
    const data=Buffer.from('upload 한글\n'.repeat(1500)),name=`uploaded-${width}.txt`
    await files.locator('input[type="file"]').setInputFiles({name,mimeType:'text/plain',buffer:data})
    await files.getByText('1개 파일을 업로드했습니다.',{exact:true}).waitFor()
    assert.deepEqual(storage.get(name),data)
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
      await files.getByText(/같은 이름의 파일이 있습니다/).waitFor()
      assert.deepEqual(storage.get(name),data)
      badHash=true
      await files.getByRole('button',{name:`다운로드 ${name}`,exact:true}).click()
      await files.getByText(/파일 검증에 실패했습니다/).waitFor();badHash=false
      await files.locator('input[type="file"]').setInputFiles({name:'cancel.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(120000)})
      await files.getByRole('button',{name:'취소',exact:true}).click()
      await files.getByText('전송을 취소했습니다.',{exact:true}).waitFor()
      assert.equal(storage.has('cancel.bin'),false)
      await files.locator('.files-workspace').evaluate(element=>{
        const transfer=new DataTransfer();transfer.items.add(new File(['drag data'],'drag.txt',{type:'text/plain'}));element.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}))
      })
      await files.getByText('1개 파일을 업로드했습니다.',{exact:true}).waitFor()
      assert.equal(storage.get('drag.txt').toString(),'drag data')
    }
    await files.getByRole('button',{name:'닫기',exact:true}).click();await files.waitFor({state:'hidden'})
    await terminal.getByRole('button',{name:'닫기',exact:true}).click();await terminal.waitFor({state:'hidden'})
    await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'})
  }
  assert.ok(prepares.some(v=>v.mode==='files'&&v.use_saved&&v.password===''))
  assert.ok(closed>=6)
  assert.deepEqual(errors,[])
  console.log('PASS: 3개 화면 폭, 시스템 정보 자동 보완/온라인 표시, 파일 선택·양방향 SHA256·드래그 앤 드롭·취소·동명 파일 보존·링크 비활성·연결 정리')
}finally{await context.close();await browser.close()}
