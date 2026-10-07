// 입력을 잠시 모아 조회하고 Enter는 예약된 조회를 즉시 한 번 실행한다.
export function createQueryScheduler(execute, schedule = setTimeout, clear = clearTimeout) {
  let timer
  const cancel = () => { if (timer !== undefined) clear(timer); timer = undefined }
  const flush = () => { cancel(); execute() }
  const queue = () => { cancel(); timer = schedule(flush, 350) }
  return { queue, flush, cancel }
}
