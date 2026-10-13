// 범위·검색어 변경 후 이전 응답이 새 선택 목록을 덮어쓰지 않도록 한다.
export function createPolicyTargetSearch(load, changed) {
  let generation = 0
  return {
    reset() { generation++; changed({ loading: false, failed: false, items: [] }) },
    async search(scope, q = '') {
      const current = ++generation
      changed({ loading: true, failed: false, items: [] })
      try {
        const items = await load({ scope_type: scope, q })
        if (current === generation) changed({ loading: false, failed: false, items })
      } catch {
        if (current === generation) changed({ loading: false, failed: true, items: [] })
      }
    },
  }
}
export function policyTargetLabel(target) {
  return target.detail && target.detail !== target.name ? `${target.name} (${target.detail})` : target.name
}
