import type { AuditEvent } from './types'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]))
  }
  return value
}

export function auditFieldDiff(event: Pick<AuditEvent, 'before' | 'after' | 'legacySource'>) {
  if (event.legacySource === 'finance_audit_events') {
    const listFields = new Set(['blockers_overridden', 'warnings_at_archive'])
    return Object.entries(event.after.changes ?? {}).map(([field, value]) => {
      const pair = Array.isArray(value) && value.length === 2 && !listFields.has(field)
      return { field, before: pair ? value[0] : undefined, after: pair ? value[1] : value }
    })
  }

  const fields = new Set([...Object.keys(event.before), ...Object.keys(event.after)])
  return [...fields].sort()
    .filter((field) => !['updated_at', 'lock_version'].includes(field))
    .filter((field) => JSON.stringify(canonical(event.before[field])) !== JSON.stringify(canonical(event.after[field])))
    .map((field) => ({ field, before: event.before[field], after: event.after[field] }))
}

export function auditFieldLabel(value: string) {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\bid\b/gi, 'ID')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
