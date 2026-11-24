import type { AdminCampaignEvent, AdminHostCampaign, HafapassEventSummary, HostYearResponse, PublicCampaignEvent, PublicHostCampaign, Tournament } from '../lib/types'

export const tournament: Tournament = {
  id: '1', name: 'Alumni Tournament', year: 2090, startDate: '2090-07-01', endDate: '2090-07-20', status: 'upcoming',
}

export const campaign: PublicHostCampaign = {
  id: '10', slug: 'alumni-host-year', title: 'Alumni Host Year', tagline: 'Build the court',
  description: 'Help build a new half court.', status: 'active', featured: true, tournament,
  hostClass: null, countdownTargetAt: '2090-07-01T18:00:00+10:00', countdownLabel: 'Countdown to tip-off',
  heroImageUrl: null, donationUrl: 'https://example.com/donate', donationInstructions: 'Checks payable at the next host night.',
  golfUrl: null, meter: { enabled: true, goalCents: 3_000_000, raisedCents: 420_000, percent: 14, goalReached: false, updatedAt: null },
}

export const hafapassEvent: HafapassEventSummary = {
  id: 'hp-1', slug: 'dinner', title: 'Alumni dinner', shortDescription: null, startsAt: null,
  endsAt: null, venueName: null, venueCity: null, organizerSlug: 'host-class', isPass: false,
  seriesSlug: null, ticketState: 'on_sale', minAllInPriceCents: 2500, ticketTypes: [],
  availabilityLabel: null, buyUrl: 'https://example.com/tickets', stale: false,
}

export const upcomingEvent: PublicCampaignEvent = {
  id: '20', kind: 'fundraiser', title: 'Alumni dinner', startsAt: '2090-03-14T09:00:00Z', endsAt: null,
  dateLabel: null, venue: 'Main hall', description: 'Dinner with the host class.',
  imageUrl: 'https://images.example.com/flyer.jpg', hafapassEventId: 'hp-1',
  hafapassEventSlug: null, hafapassDistributionCode: null, externalUrl: null, ctaLabel: null,
  status: 'open', position: 0, recapNotes: null, recapHighlights: null, raisedDisplay: null, recapPhotos: [],
  hafapass: hafapassEvent,
}

export const completedEvent: PublicCampaignEvent = {
  ...upcomingEvent, id: '21', title: 'Alumni night', status: 'completed', imageUrl: null,
  recapNotes: 'Thank you for supporting the court.', recapHighlights: 'Alumni scrimmage.',
  raisedDisplay: '$4,200 raised',
  recapPhotos: [
    { url: 'https://images.example.com/team.jpg', caption: 'The team' },
    { url: 'https://images.example.com/court.jpg', caption: 'First tip-off' },
  ],
}

export const hafapass = { available: true, stale: false, fetchedAt: null }
export const hostYear: HostYearResponse = {
  campaign, hafapass: { ...hafapass, events: [] }, events: [upcomingEvent, completedEvent],
  posts: [{ id: '30', title: 'Host class update', body: 'See you at the next event.', publishedAt: null, imageUrl: null, authorName: null, pinned: false }],
}

export const adminCampaign: AdminHostCampaign = {
  ...campaign, tournamentId: tournament.id, classCohortId: '1', goalCents: 3_000_000,
  hafapassOrganizerSlug: null, hafapassTournamentOrganizerSlug: null, hafapassDistributionCode: null,
  fdaaUpfrontCents: 0, fdaaTicketShareBps: 0, publicMeterEnabled: true, includeFdaaInPublicMeter: false,
}

export const adminEvent: AdminCampaignEvent = {
  ...upcomingEvent, id: '21', title: 'Alumni night', status: 'completed', storedStatus: 'open',
  autoCompleted: true, imageUrl: null, hostCampaignId: campaign.id, publicVisible: true,
  goalCents: null, archivedAt: null,
}
