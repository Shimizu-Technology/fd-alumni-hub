export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'

export const metadata: Metadata = {
  title: 'Sponsors',
}

const PLACEHOLDER_TIERS = [
  {
    tier: 'Presenting Sponsor',
    description: 'Premier partnership — maximum visibility across all tournament media.',
    slots: 1,
    color: 'var(--fd-gold)',
    bg: 'rgba(217,178,111,0.08)',
    border: 'rgba(217,178,111,0.3)',
  },
  {
    tier: 'Gold Sponsor',
    description: 'High-visibility partnership with prominent logo placement.',
    slots: 3,
    color: '#d97706',
    bg: 'rgba(217,119,6,0.06)',
    border: 'rgba(217,119,6,0.2)',
  },
  {
    tier: 'Silver Sponsor',
    description: 'Supporting partnership with dedicated acknowledgment.',
    slots: 5,
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.05)',
    border: 'rgba(107,114,128,0.15)',
  },
  {
    tier: 'Community Supporter',
    description: 'Community-level recognition in tournament materials.',
    slots: 10,
    color: 'var(--fd-maroon)',
    bg: 'rgba(123,22,50,0.04)',
    border: 'rgba(123,22,50,0.12)',
  },
]

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

export default async function SponsorsPage() {
  const tournament = await getActiveTournament()
  const sponsors = tournament
    ? await db.sponsor.findMany({
        where: { tournamentId: tournament.id, active: true },
        orderBy: [{ position: 'asc' }, { tier: 'asc' }, { name: 'asc' }],
      })
    : []

  const sponsorsByTier = sponsors.reduce<Record<string, typeof sponsors>>((acc, sponsor) => {
    const tier = sponsor.tier || 'Community Supporter'
    acc[tier] = acc[tier] ?? []
    acc[tier].push(sponsor)
    return acc
  }, {})

  return (
    <section className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
          Sponsors
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          {tournament ? `${tournament.name} ${tournament.year}` : 'Partners who make FD Alumni Basketball possible.'}
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 animate-fade-up delay-75"
        style={{
          background: 'linear-gradient(135deg, var(--fd-maroon-deeper) 0%, var(--fd-maroon) 100%)',
          boxShadow: 'var(--shadow-maroon)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--fd-gold)' }}>
            Sponsorship Opportunities
          </p>
          <h2 className="text-2xl font-bold leading-snug mb-3" style={{ color: '#fff' }}>
            Partner with the FD Alumni Tournament
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(240,232,236,0.7)' }}>
            Connect your brand with Guam basketball fans and support the alumni community. Multiple tiers available for businesses of every size.
          </p>
          <a
            href="mailto:info@fdalumni.com"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: 'var(--fd-gold)', color: 'var(--fd-maroon-deeper)' }}
          >
            <StarIcon />
            Become a Sponsor
          </a>
        </div>
      </div>

      {sponsors.length > 0 ? (
        <div className="space-y-5">
          {Object.entries(sponsorsByTier).map(([tier, tierSponsors], tierIndex) => (
            <div key={tier} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>
                {tier}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tierSponsors.map((sponsor, i) => {
                  const card = (
                    <article
                      className="rounded-xl border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-up"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        boxShadow: 'var(--shadow-card)',
                        animationDelay: `${(tierIndex + i) * 60}ms`,
                      }}
                    >
                      <div className="flex min-h-20 items-center justify-center rounded-lg border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
                        {sponsor.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.logoUrl} alt={sponsor.name} className="max-h-16 object-contain" loading="lazy" />
                        ) : (
                          <span className="text-lg font-semibold" style={{ color: 'var(--fd-ink)' }}>{sponsor.name}</span>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--fd-ink)' }}>{sponsor.name}</p>
                          {sponsor.tier ? <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>{sponsor.tier}</p> : null}
                        </div>
                        {sponsor.targetUrl ? <ExternalIcon /> : null}
                      </div>
                    </article>
                  )

                  return sponsor.targetUrl ? (
                    <Link key={sponsor.id} href={sponsor.targetUrl} target="_blank" rel="noopener noreferrer">
                      {card}
                    </Link>
                  ) : (
                    <div key={sponsor.id}>{card}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>
            Sponsorship Tiers
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {PLACEHOLDER_TIERS.map((t, i) => (
              <div
                key={t.tier}
                className="rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-up"
                style={{
                  background: t.bg,
                  borderColor: t.border,
                  boxShadow: 'var(--shadow-card)',
                  animationDelay: `${(i + 2) * 75}ms`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: t.color, color: '#fff' }}>
                    <StarIcon />
                    {t.tier}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--neutral-500)' }}>
                    Up to {t.slots} {t.slots === 1 ? 'slot' : 'slots'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--neutral-600)' }}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-6 text-center animate-fade-up" style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)', animationDelay: '450ms' }}>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--fd-ink)' }}>
          Interested in sponsoring?
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--neutral-500)' }}>
          Contact the tournament organizers to discuss packages and availability.
        </p>
        <a href="mailto:info@fdalumni.com" className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5" style={{ background: 'var(--fd-maroon)', color: '#fff' }}>
          Contact Us
        </a>
      </div>
    </section>
  )
}
