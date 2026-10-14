// 현재 목록과 같은 공유 범위·만료 조건으로 목록에 포함된 장치 항목 수를 집계한다.
export function sharingDeviceCounts(books, scope, now) {
 const counts = {device:0,address_book:0}
 for (const book of books || []) {
  const recipients = book.recipients || []
  const visible = scope === 'sent' ? recipients.length > 0 : recipients.some(r => !r.expires_at || r.expires_at > now)
  const kind = book.share_kind || 'address_book'
  if (visible && Object.hasOwn(counts,kind)) counts[kind] += Math.max(0,Number(book.device_count) || 0)
 }
 return counts
}
