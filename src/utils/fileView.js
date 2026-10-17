// 두 전송 어댑터가 공유하는 파일 UI. 연결·권한·파일 작업은 호출자가 담당한다.
import ko from './i18n/fileView.ko.json' with {type:'json'};
import en from './i18n/fileView.en.json' with {type:'json'};
const text=ko;
export const FILE_VIEW_DEFAULTS=Object.freeze({showHidden:false,sort:'name-asc'});
export const fileViewLabels=locale=>locale==='ko'?ko:en;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function fileViewMarkup(icon, labels = {}) {
  const t = {...text,...labels}, button = (id,label,symbol) => `<button id="${id}" type="button" class="icon-button" aria-label="${escape(label)}" title="${escape(label)}">${icon(symbol)}</button>`;
  return `<div id="file-browser" class="file-browser-ui" hidden>
    <form id="file-path-form"><div class="file-path"><input id="file-path" aria-label="${escape(t.path)}" autocomplete="off" spellcheck="false" maxlength="4096">${button('file-go',t.go,'arrow')}</div></form>
    <div class="file-actions">${button('file-parent',t.parent,'back')}${button('file-home',t.home,'home')}${button('file-refresh',t.refresh,'refresh')}${button('file-mkdir',t.mkdir,'folder-add')}${button('file-drives',t.drives,'monitor')}<button id="file-upload" type="button" class="file-upload" title="${escape(t.upload)}">${icon('upload')}<span>${escape(t.upload)}</span></button><input id="file-input" type="file" multiple hidden></div>
    <div class="file-search">${icon('search')}<input id="file-search" type="search" placeholder="${escape(t.search)}" aria-label="${escape(t.search)}" autocomplete="off" maxlength="256"></div>
    <div class="file-selection" hidden><span id="file-selection-name"></span><button id="file-selected-open" type="button"></button><button id="file-selected-menu" type="button"></button></div>
    <p class="file-interaction-hint" id="file-list-help">더블클릭으로 폴더 열기 · 우클릭으로 작업</p>
    <div class="file-list-stage"><div id="file-list" class="file-list" role="grid" aria-label="원격 파일 목록" aria-colcount="4" aria-describedby="file-list-help" tabindex="0"><div class="file-list-header" role="row">${['name','size'].map(key=>`<div id="file-column-${key}" role="columnheader" aria-sort="none"><button id="file-sort-${key}" type="button" class="file-sort-button" title="${escape(t[key])} 정렬">${escape(t[key])}<span class="file-sort-caret" aria-hidden="true"><i class="ascending"></i><i class="descending"></i></span></button></div>`).join('')}<span></span><span></span></div><div id="file-rows" role="rowgroup"></div></div><div id="file-list-loading" class="file-list-loading" role="status" hidden><span class="file-loading-spinner" aria-hidden="true"></span><span class="file-loading-label">${escape(t.loading)}</span></div></div>
    <div class="file-summary"><span id="file-count" class="field-hint"></span><label><input type="checkbox" id="file-hidden">${escape(t.hidden)}</label><span id="file-access" hidden></span></div>
    <form id="file-create-form" class="file-create-form" role="dialog" aria-label="${escape(t.mkdir)}" hidden><label for="file-create-name">${escape(t.folderName)}</label><input id="file-create-name" autocomplete="off" maxlength="255" required><p id="file-create-error" role="alert" hidden></p><div>${button('file-create-cancel',t.cancel,'close')}<button id="file-create-submit" type="submit">${escape(t.create)}</button></div></form>
  </div>`;
}

export function updateFileSort(host, sort) {
  for (const key of ['name','size']) {
    const active = sort.startsWith(key+'-'), direction = active ? sort.endsWith('desc') ? 'descending' : 'ascending' : 'none';
    host.querySelector('#file-column-'+key).setAttribute('aria-sort',direction);
    host.querySelector('#file-sort-'+key).setAttribute('aria-label',(key==='name'?'파일명':'크기')+' 정렬'+(active?(direction==='ascending'?' · 오름차순':' · 내림차순'):''));
  }
}

// 각 행은 문자열 HTML이 아닌 textContent로 표시해 파일 이름을 실행하지 않는다.
export function renderFileRows(host, items, options) {
  const list=host.querySelector('#file-list'), rows=host.querySelector('#file-rows'), focused=list.contains(document.activeElement);
  rows.replaceChildren();
  items.forEach((item,index)=>{
    const row=document.createElement('div');row.className='file-row';row.dataset.name=item.name;row.dataset.blocked=String(!!item.blocked);row.setAttribute('role','row');row.setAttribute('aria-rowindex',String(index+2));
    const name=document.createElement('span'), size=document.createElement('span'), actions=document.createElement('span');
    name.className='file-name-cell';name.setAttribute('role','gridcell');name.title=item.name;
    const entry=document.createElement('button');entry.type='button';entry.className='file-entry'+(item.kind==='directory'?' is-folder':'');entry.tabIndex=-1;entry.disabled=!options.enabled||item.blocked;
    entry.innerHTML=options.icon(item.kind==='directory'?'folder':'file');entry.setAttribute('aria-label',item.parent?'상위 폴더 열기':item.kind==='directory'?'폴더 열기: '+item.name:'파일 선택: '+item.name);
    const label=document.createElement('span');label.textContent=item.name;entry.append(label);name.append(entry);
    size.className='file-entry-size';size.setAttribute('role','gridcell');size.textContent=item.kind==='directory'?'—':item.sizeLabel;
    actions.className='file-row-actions';actions.setAttribute('role','gridcell');actions.setAttribute('aria-colspan','2');
    const download=document.createElement('button'),more=document.createElement('button');download.type=more.type='button';download.tabIndex=more.tabIndex=-1;
    download.className='icon-button file-download'+(item.kind!=='file'?' file-action-placeholder':'');more.className='icon-button file-more'+(item.parent||item.blocked?' file-action-placeholder':'');
    download.innerHTML=options.icon('download');download.title='다운로드: '+item.name;download.setAttribute('aria-label',download.title);if(item.kind!=='file')download.setAttribute('aria-hidden','true');
    more.innerHTML=options.icon('more');more.title='파일 작업: '+item.name;more.setAttribute('aria-label',more.title);more.setAttribute('aria-haspopup','menu');if(item.parent||item.blocked)more.setAttribute('aria-hidden','true');
    const select=focus=>{if(options.enabled&&!item.blocked)options.select(item,focus)};
    entry.onclick=event=>{event.stopPropagation();select(false)};entry.ondblclick=event=>{event.stopPropagation();select(false);if(options.enabled&&!item.blocked)options.open(item,row)};
    download.onclick=event=>{event.stopPropagation();select(false);if(options.enabled&&!item.blocked)options.download(item)};
    more.onclick=event=>{event.stopPropagation();select(false);const box=more.getBoundingClientRect();if(options.enabled)options.menu(item,box.left,box.bottom,more)};
    actions.append(download,more);row.append(name,size,actions);
    row.onclick=()=>select(true);row.ondblclick=event=>{if(!event.target.closest('button')&&options.enabled&&!item.blocked){select(false);options.open(item,row)}};
    row.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();select(true);if(options.enabled&&!item.blocked)options.menu(item,event.clientX,event.clientY,row)};
    row.onkeydown=event=>{
      if(!options.enabled)return;
      if(item.blocked&&!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'&&options.copy&&!item.parent&&item.kind==='file'){event.preventDefault();event.stopPropagation();options.copy(item);return}
      if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();event.stopPropagation();select(false);const box=row.getBoundingClientRect();options.menu(item,box.left+12,box.bottom,row);return}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&!event.altKey){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowDown'?1:-1)));options.select(items[next],true);return}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();select(false);if(event.key==='Enter')options.open(item,row)}
      if(event.key==='Backspace'||(event.altKey&&event.key==='ArrowUp')){event.preventDefault();event.stopPropagation();options.parent()}
    };
    rows.append(row);
  });
  list.setAttribute('aria-rowcount',String(items.length+1));
  if(!items.length||items.every(item=>item.parent)){const empty=document.createElement('p');empty.className='file-empty';empty.textContent=options.empty||text.empty;rows.append(empty)}
  updateFileSelection(host,options.selected,options.enabled);
  if(focused&&options.enabled)([...rows.querySelectorAll('.file-row')].find(row=>row.dataset.name===options.selected)||rows.querySelector('.file-row')||list).focus();
}

export function updateFileSelection(host, selected, enabled) {
  host.querySelectorAll('.file-row').forEach((row,index)=>{const active=row.dataset.name===selected;row.setAttribute('aria-selected',String(active));row.tabIndex=enabled&&(active||(!selected&&index===0))?0:-1;row.querySelectorAll('button').forEach(button=>button.disabled=!enabled||row.dataset.blocked==='true')});
  host.querySelector('#file-list').setAttribute('aria-disabled',String(!enabled));
}

export function fileSizeLabel(value) {
  if(!Number.isSafeInteger(value)||value<0)return '크기 미확인';
  if(value<1024)return value+' B';
  for(const [unit,limit] of [['KiB',1024**2],['MiB',1024**3],['GiB',1024**4]])if(value<limit)return (value/(limit/1024)).toFixed(1)+' '+unit;
  return (value/1024**4).toFixed(1)+' TiB';
}

export function bindFileView(host, handlers, labels = {}) {
  const t={...text,...labels};
  const $=id=>host.querySelector('#'+id), form=$('file-create-form');let sort='name-asc', enabled=false, creating=false, disposed=false, creationSequence=0, renderedPath, wasLoading=false;
  $('file-go').type='submit';$('file-path-form').onsubmit=event=>{event.preventDefault();if(enabled)handlers.navigate($('file-path').value)};
  for(const action of ['parent','home','refresh','drives','upload'])$('file-'+action).onclick=()=>{if(enabled)handlers.action(action)};
  $('file-search').oninput=()=>handlers.search($('file-search').value);
  $('file-hidden').onchange=()=>handlers.hidden($('file-hidden').checked);
  for(const key of ['name','size'])$('file-sort-'+key).onclick=()=>{if(!enabled)return;sort=sort===key+'-asc'?key+'-desc':key+'-asc';updateFileSort(host,sort);handlers.sort(sort)};
  const closeCreate=()=>{if(creating)return;form.hidden=true;if($('file-mkdir').getClientRects().length)$('file-mkdir').focus()};
  $('file-mkdir').onclick=()=>{if(!enabled||$('file-mkdir').disabled)return;form.hidden=false;$('file-create-name').value='';$('file-create-error').hidden=true;$('file-create-name').focus()};
  $('file-create-cancel').onclick=closeCreate;
  form.onkeydown=event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();closeCreate()}};
  form.onsubmit=async event=>{
    event.preventDefault();if(creating||!enabled)return;
    const name=$('file-create-name').value;
    if(!name||name.length>255||/[\\/\x00-\x1f]/.test(name)||name==='.'||name==='..'){ $('file-create-error').textContent=t.invalidName;$('file-create-error').hidden=false;return }
    const sequence=++creationSequence;creating=true;$('file-create-submit').disabled=$('file-create-cancel').disabled=true;$('file-create-name').readOnly=true;
    try{await handlers.mkdir(name);if(!disposed&&sequence===creationSequence){form.hidden=true;handlers.notice?.(t.created)}}
    catch(error){if(!disposed&&sequence===creationSequence){$('file-create-error').textContent=error instanceof Error?error.message:'폴더를 만들지 못했습니다.';$('file-create-error').hidden=false}}
    finally{if(!disposed&&sequence===creationSequence){creating=false;$('file-create-submit').disabled=$('file-create-cancel').disabled=false;$('file-create-name').readOnly=false;if(!form.hidden)$('file-create-name').focus()}}
  };
  return {
    update(state){
      enabled=state.enabled;sort=state.sort||sort;updateFileSort(host,sort);
      for(const id of ['file-go','file-parent','file-home','file-refresh','file-drives','file-upload','file-search','file-hidden','file-sort-name','file-sort-size'])$(id).disabled=!enabled;
      $('file-path').readOnly=!enabled;$('file-path').disabled=!enabled;$('file-parent').disabled=!enabled||state.atRoot;
      $('file-upload').disabled=!enabled||!state.writable;$('file-mkdir').disabled=!enabled||!state.writable||!handlers.mkdir;$('file-drives').hidden=!state.drives;
      $('file-list').setAttribute('aria-busy',String(!!state.loading));$('file-list-loading').hidden=!state.loading;
      if(state.hidden!==undefined)$('file-hidden').checked=state.hidden;
      if(state.count!==undefined)$('file-count').textContent=state.count;
      if(state.path!==undefined&&(state.path!==renderedPath||(wasLoading&&!state.loading))){$('file-path').value=state.path;renderedPath=state.path}
      if(state.query!==undefined&&$('file-search').value!==state.query)$('file-search').value=state.query;
      wasLoading=!!state.loading;
      $('file-access').hidden=!state.access;$('file-access').textContent=state.access||'';
    },closeCreate,
    resetCreate(){creationSequence++;creating=false;form.hidden=true;$('file-create-submit').disabled=$('file-create-cancel').disabled=false;$('file-create-name').readOnly=false},
    dispose(){disposed=true;creationSequence++;form.hidden=true}
  };
}
