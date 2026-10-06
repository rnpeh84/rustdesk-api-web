import { prepareTerminal } from '@/api/terminal'

export class DeviceFilesClient {
  constructor(peer) { this.peer = peer; this.sequence = 0; this.socket = null; this.pending = null; this.opening = null; this.onClose = () => {} }
  async connect(password, useSaved) {
    let res
    try { res = await prepareTerminal({ peer_id: this.peer.row_id, password: useSaved ? '' : password, use_saved: useSaved, mode: 'files' }) }
    catch (error) { throw new Error(error?.data?.state === 'files_unavailable' ? 'account' : error?.data?.state || ([401,403].includes(error?.response?.status) || error?.code === 403 ? 'access_denied' : 'transport')) }
    if (this.closed) throw new Error('closed')
    const api = new URL(import.meta.env.VITE_SERVER_API || '/api/admin', window.location.href)
    const url = new URL(res.data.websocket_path, api.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return await new Promise((resolve, reject) => {
      this.opening = { resolve, reject, timer: setTimeout(() => this.fail('helper'), 25000) }
      const socket = new WebSocket(url, ['rustdesk-terminal-v1', `ticket.${res.data.ticket}`])
      this.socket = socket
      socket.onmessage = event => {
        let v
        try { v = JSON.parse(event.data) } catch { this.fail('protocol'); return }
        if (v.type === 'ping') { this.send({ type: 'pong' }); return }
        if (v.type === 'files_ready' && this.opening) {
          clearTimeout(this.opening.timer); this.opening.resolve(v); this.opening = null
        } else if (v.type === 'files_result' && this.pending && v.id === this.pending.id) {
          const current = this.pending; this.pending = null; clearTimeout(current.timer)
          if (v.error) current.reject(new Error(v.error)); else current.resolve(v)
        } else if (v.type === 'error' || v.type === 'files_error') this.fail(v.error || v.state || 'io')
      }
      socket.onerror = () => this.fail('transport')
      socket.onclose = () => this.fail('closed')
    })
  }
  send(value) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(value)) }
  request(op, data = {}) {
    if (this.closed || this.pending || this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('closed'))
    return new Promise((resolve, reject) => {
      const id = ++this.sequence
      this.pending = { id, resolve, reject, timer: setTimeout(() => this.fail('timeout'), 45000) }
      this.send({ ...data, op, id })
    })
  }
  fail(code) {
    for (const task of [this.opening, this.pending]) { if (task) { clearTimeout(task.timer); task.reject(new Error(code)) } }
    this.opening = this.pending = null
    this.close(); this.onClose(code)
  }
  close() {
    this.closed = true
    const socket = this.socket; this.socket = null
    if (socket) { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'close' })); socket.close() }
    for (const task of [this.opening, this.pending]) { if (task) { clearTimeout(task.timer); task.reject(new Error('closed')) } }
    this.opening = this.pending = null
  }
}

export const fileErrorKey = code => ['path','account','permission','exists','size','integrity','helper','sandbox','protocol','busy','io','transport','closed','timeout','blocked','nonempty','cross_device'].includes(code) ? `FilesError_${code}` : ['auth_required','access_denied','saved_password_unavailable','key_mismatch','disabled','unsupported','offline','relay_unreachable','id_server_unreachable','connection_timeout','signature_failed','connection_closed'].includes(code) ? `TerminalHelp_${code}` : 'FilesError_io'
