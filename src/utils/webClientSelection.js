// 서버가 반환한 고정 경로만 같은 출처에서 열며 조회 실패 시 기본값으로 우회하지 않는다.
export function selectedWebClientURL(path, origin) {
  if(typeof path!=='string' || !/^\/(webclient2|webcl)\/#\/[^?#]*$/.test(path))throw new Error('invalid_web_client_path')
  const url=new URL(path,origin)
  if(url.origin!==origin || (url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('invalid_web_client_origin')
  return url.href
}

export async function openSelectedWebClient({row,origin,open,resolve}) {
  // 클릭 시 탭을 먼저 열어 비동기 조회 후 브라우저의 팝업 차단을 피한다.
  const tab=open()
  if(!tab)throw new Error('web_client_popup_blocked')
  tab.opener=null
  try{const result=await resolve({peer_id:row.row_id||undefined,device_id:row.id});tab.location.replace(selectedWebClientURL(result.path,origin))}
  catch(error){tab.close();throw error}
}
