export const registrationStatusKey = state => ({pending:'ManualRegistrationPending',expired:'ManualRegistrationExpired',changed:'ManualRegistrationChanged',registered:'ManualRegistrationComplete'}[state?.status] || 'ManualRegistrationPending')
export const registrationCommandActive = (expiresAt, now = Date.now()) => Number.isFinite(expiresAt) && expiresAt * 1000 > now
