export const policySyncStatusKey = (state, now = Date.now() / 1000) => {
 if (!state?.supported) return 'PolicySyncUnsupported'
 if (state.last_observed_at && now - state.last_observed_at > 60) return 'PolicySyncStale'
 return ({ pending: 'PolicySyncPending', delivered: 'PolicySyncDelivered', acknowledged: 'PolicySyncAcknowledged' })[state.status] || 'PolicySyncPending'
}
export const directIPKey = value => ({ Y: 'PolicyDirectAllowed', N: 'PolicyDirectDisabled' })[value] || 'PolicyNotManaged'
export const policySourceKey = value => ({ published_policy: 'PolicySourcePublished', reset_default: 'PolicySourceReset' })[value] || 'PolicyNotManaged'
export const policyCapabilityKey = value => ({ source_contract_checked: 'PolicySourceChecked', ios_sync_unsupported: 'PolicyIosUnsupported', version_unverified: 'PolicyVersionUnverified', platform_unverified: 'PolicyPlatformUnverified' })[value] || 'PolicySyncUnsupported'
export const policyOptionKey = key => ({ 'direct-server': 'PolicyDirectIP', 'enable-lan-discovery': 'PolicyLanDiscovery', 'enable-terminal': 'PolicyTerminal', 'enable-keyboard': 'PolicyKeyboard', 'enable-clipboard': 'PolicyClipboard', 'enable-file-transfer': 'PolicyFileTransfer', 'allow-remote-config-modification': 'PolicyRemoteConfig' })[key] || key
export function changePolicyOption(text, key, value) {
 const config = JSON.parse(text)
 if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('InvalidJson')
 if (config.options !== undefined && (!config.options || typeof config.options !== 'object' || Array.isArray(config.options))) throw new Error('InvalidJson')
 config.options ||= {}
 if (value === '__unmanaged') delete config.options[key]
 else config.options[key] = value
 return JSON.stringify(config, null, 2)
}

export const policyOptionValueKey = value => ({Y:'PolicySettingEnabled',N:'PolicySettingDisabled','':'PolicySettingDefault'})[value] || 'PolicySettingDefault'
export const policyOptionEntries = options => Object.entries(options || {}).sort(([a],[b]) => a.localeCompare(b))
