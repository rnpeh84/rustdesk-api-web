// 검색 위치는 문자열 길이 대신 xterm 셀의 실제 너비로 계산한다.
export function findTerminalMatches(buffer, query) {
  if (!buffer || !query) return []
  const matches = []
  for (let row = 0; row < buffer.length; row++) {
    const line = buffer.getLine(row)
    if (!line) continue
    let text = '', columns = []
    for (let column = 0; column < line.length; column++) {
      const cell = line.getCell(column)
      if (!cell || cell.getWidth() === 0) continue
      const chars = cell.getChars() || ' '
      for (let i = 0; i < chars.length; i++) columns.push({ start: column, end: column + cell.getWidth() })
      text += chars
    }
    for (let index = text.indexOf(query); index !== -1; index = text.indexOf(query, index + Math.max(1, query.length))) {
      const first = columns[index], last = columns[index + query.length - 1]
      if (first && last) matches.push({ row, column: first.start, length: last.end - first.start })
    }
  }
  return matches
}

export const quoteShellPath = path => "'" + path.replace(/'/g, "'\\''") + "'"
