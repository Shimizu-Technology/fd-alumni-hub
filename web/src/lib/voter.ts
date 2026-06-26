const voterTokenKey = 'fd-alumni-voter-token'

export function readOrCreateVoterToken() {
  try {
    const existing = window.localStorage.getItem(voterTokenKey)
    if (existing) return existing

    const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(voterTokenKey, token)
    return token
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
