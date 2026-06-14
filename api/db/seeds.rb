# Idempotent local seed helpers for the Rails migration API.
# Production data migration remains an explicit operator-run import/cutover step.

Division::DEFAULT_NAMES.each.with_index(1) do |name, position|
  Division.find_or_create_by!(name: name) do |division|
    division.position = position
    division.starts_year = nil
    division.active = true
  end
end

if ENV["FD_ADMIN_EMAIL"].present?
  AdminWhitelist.find_or_create_by!(email: ENV["FD_ADMIN_EMAIL"].downcase) do |admin|
    admin.role = "admin"
    admin.notes = "Seeded from FD_ADMIN_EMAIL"
  end
end

if ENV["FD_SEED_DEMO"] == "1"
  tournament = Tournament.find_or_create_by!(year: 2026, name: "FD Alumni Basketball Tournament") do |record|
    record.start_date = Date.new(2026, 7, 3)
    record.end_date = Date.new(2026, 7, 24)
    record.status = "upcoming"
  end

  maroon_division = Division.find_by!(name: "Maroon")

  maroon = tournament.teams.find_or_create_by!(display_name: "Class of 2016") do |team|
    team.class_year_label = "2016"
    team.division_record = maroon_division
  end

  gold = tournament.teams.find_or_create_by!(display_name: "Class of 2017") do |team|
    team.class_year_label = "2017"
    team.division_record = maroon_division
  end

  tournament.games.find_or_create_by!(home_team: maroon, away_team: gold, start_time: Time.zone.local(2026, 7, 3, 18, 0, 0)) do |game|
    game.venue = "The Jungle"
    game.status = "scheduled"
    game.division_record = maroon_division
    game.notes = "phase=pool"
  end

  Standings::Recompute.call(tournament)
end
