// 온라인 heartbeat와 기능 보고를 구분한다. 보고 도구가 없어도 접속 시 검사를 허용한다.
export function connectionAvailability(peer, status, now = Date.now() / 1000) {
  const reported = Number(status.reported_at) || 0
  const fresh = reported > 0 && now - reported <= 90 && now >= reported - 5
  const lastOnline = Number(status.device?.last_online_time ?? peer.last_online_time) || 0
  const online = fresh ? !!status.service_running : lastOnline > 0 && now - lastOnline < 60 && now >= lastOnline - 5
  const modes = []
  const unknown = !fresh || status.desktop_state === 'unknown' || status.terminal_state === 'unknown'
  if (online) {
    if (status.desktop_web_enabled && (!fresh || ['available', 'unknown'].includes(status.desktop_state))) modes.push('desktop')
    if ((!fresh || ['available', 'unknown'].includes(status.terminal_state)) && !['disabled', 'unsupported'].includes(status.state)) modes.push('terminal')
  }
  return { fresh, online, modes, unknown }
}
