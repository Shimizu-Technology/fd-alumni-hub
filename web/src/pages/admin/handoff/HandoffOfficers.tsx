import type { HandoffOfficer } from '../../../lib/types'

const actionNames: Record<string, string> = {
  view: 'View', edit: 'Edit', publish: 'Publish events', manage_donation_links: 'Manage donation links',
  view_receipts: 'View private receipts', record: 'Record entries', approve: 'Approve reimbursements',
  payout: 'Mark reimbursements paid', export: 'Export finance data',
}

export const officerNames = { chair: 'Class Chair', treasurer: 'Treasurer' }

function PermittedActions({ actions }: { actions: Record<string, string[]> }) {
  const fundraising = actions.fundraisers_and_sponsors
  const finance = actions.finance_and_reimbursements
  return (
    <>
      {!!fundraising?.length && <p>Fundraisers · {fundraising.map((action) => actionNames[action]).join(', ')}</p>}
      {!!finance?.length && <p>Finance · {finance.map((action) => actionNames[action]).join(', ')}</p>}
    </>
  )
}

export function HandoffOfficers({ officers }: { officers: HandoffOfficer[] | null }) {
  if (!officers) return <p className="muted">Campaign officers and people managers can view invitation details.</p>

  return (
    <ul className="handoff-list" aria-label="Incoming officers">
      {officers.map((officer) => (
        <li key={officer.role}>
          <strong>{officerNames[officer.role]}</strong>
          <p>{officer.accepted ? 'Accepted · active access' : officer.invited ? 'Invited · awaiting active access' : 'Invitation needed'}</p>
          {officer.members.map((member) => (
            <div key={member.email}>
              <p>{member.name} ({member.email})</p>
              <PermittedActions actions={member.actions} />
            </div>
          ))}
          {officer.invitations.filter((invite) => !officer.members.some((member) => member.email === invite.email)).map((invite) => (
            <p key={`${invite.email}:${invite.status}`}>{invite.email} · {invite.status === 'pending' ? 'Pending verified sign-in' : 'Accepted · membership inactive'}</p>
          ))}
          {!officer.accepted && <PermittedActions actions={officer.pendingActions} />}
        </li>
      ))}
    </ul>
  )
}
