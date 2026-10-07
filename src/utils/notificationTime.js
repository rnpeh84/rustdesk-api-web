export const isRecentNotification = (item, now) => Boolean(item && !item.read && now - item.time < 5000 && now >= item.time)

export function notificationAge(time, now, locale = 'ko') {
  const seconds = Math.max(0, Math.floor((now - time) / 1000))
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (seconds < 60) return formatter.format(-seconds, 'second')
  if (seconds < 3600) return formatter.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return formatter.format(-Math.floor(seconds / 3600), 'hour')
  return formatter.format(-Math.floor(seconds / 86400), 'day')
}
