-- Allow archive/import workflows to represent tournaments that were cancelled
-- instead of forcing them into completed/upcoming/live.
ALTER TYPE "TournamentStatus" ADD VALUE IF NOT EXISTS 'cancelled';
