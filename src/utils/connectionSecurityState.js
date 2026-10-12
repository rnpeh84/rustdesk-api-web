const states = {
 reported: ['ConnectionSecurityReported', 'info'],
 policy_pending: ['ConnectionSecurityPolicyPending', 'warning'],
 stale: ['ConnectionSecurityStale', 'warning'],
 error: ['ConnectionSecurityReportError', 'danger'],
 unsupported: ['ConnectionSecurityUnsupported', 'warning'],
 credential_changed: ['ConnectionSecurityCredentialChanged', 'danger'],
 device_access_pending: ['ConnectionSecurityDevicePending', 'warning'],
 unverified: ['ConnectionSecurityUnverified', 'info']
}
export function connectionSecurityBadge(row, now = Date.now()) {
 if (row.last_checked_at && now >= row.last_checked_at * 1000 + 60000) return states.stale
 return states[row.state] || states.unverified
}
export function connectionSecurityFailure(code) {
 return ({ api_unavailable: 'ConnectionSecurityApiUnavailable', api_rejected: 'ConnectionSecurityApiRejected',
  invalid_response: 'ConnectionSecurityInvalidResponse', enforcement_disabled: 'ConnectionSecurityDisabled' })[code] || 'ConnectionSecurityUnverified'
}
