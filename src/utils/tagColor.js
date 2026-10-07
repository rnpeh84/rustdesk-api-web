// CSS 색상을 기존 Flutter ARGB 정수 계약으로 변환한다.
export function cssToFlutterColor(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\s*\)$/i)
  if (!match) return null
  const channels = match.slice(1, 4).map(Number)
  const alpha = match[4] === undefined ? 1 : Number(match[4])
  if (channels.some(channel => channel > 255) || alpha > 1) return null
  return ((Math.round(alpha * 255) << 24) | (channels[0] << 16) | (channels[1] << 8) | channels[2]) >>> 0
}

export function flutterColorToCss(value) {
  const color = Number(value) >>> 0
  return `rgba(${(color >>> 16) & 255}, ${(color >>> 8) & 255}, ${color & 255}, ${(color >>> 24) / 255})`
}
