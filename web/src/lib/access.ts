export type GrantSelection = { capability: string; actions: string[] }
export type GrantScope = { email: string; scopeType: string; scopeId: string | null }
export type PermissionGrant = GrantSelection & GrantScope & { id: string; acceptedAt: string | null }
export type GrantPreset = { key: string; label: string; scopeTypes: string[]; grants: GrantSelection[] }
export type AccessDirectory = {
  presets: GrantPreset[]
  capabilities: Record<string, string[]>
  users: {
    id: string
    email: string
    fullName: string
    active: boolean
    superAdmin: boolean
    grants: PermissionGrant[]
    campaignMemberships: { campaignId: string; campaignTitle: string; roles: string[] }[]
  }[]
  pendingInvites: PermissionGrant[]
  tournaments: { id: string; year: number; name: string }[]
  campaigns: { id: string; title: string }[]
  activeSuperAdminCount: number | null
}
