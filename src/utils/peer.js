// 접속 방식만 지정하며 인증정보는 URL에 포함하지 않는다.
export const clientConnectionUrl = (id, mode = 'desktop') => {
  const target = encodeURIComponent(String(id))
  return mode === 'terminal' ? `rustdesk://terminal/${target}` : `rustdesk://${target}`
}

export const connectByClient = (id, mode = 'desktop') => {
  let a = document.createElement('a')
  a.href = clientConnectionUrl(id, mode)
  a.target = '_self'
  a.click()

}
