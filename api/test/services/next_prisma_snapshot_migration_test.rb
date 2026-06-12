require "test_helper"
require "tmpdir"

class NextPrismaSnapshotMigrationTest < ActiveSupport::TestCase
  test "imports a Next Prisma snapshot idempotently and validates it" do
    path = write_snapshot

    result = DataMigration::NextPrismaSnapshot::Import.call(path)
    assert_equal 1, result[:sourceCounts]["tournaments"]
    assert_equal 1, result[:railsCounts]["tournaments"]
    assert_equal 2, result[:sourceCounts]["teams"]
    assert_equal 2, result[:railsCounts]["teams"]
    assert_equal 2, result[:sourceCounts]["games"]
    assert_equal 2, result[:railsCounts]["games"]
    assert_equal 2, result[:sourceCounts]["mediaAssets"]
    assert_equal 2, result[:railsCounts]["mediaAssets"]

    assert_no_difference -> { Tournament.count } do
      assert_no_difference -> { Team.count } do
        assert_no_difference -> { Game.count } do
          DataMigration::NextPrismaSnapshot::Import.call(path)
        end
      end
    end

    tournament = Tournament.find_by!(legacy_id: "next_tournament_2025")
    assert_equal "completed", tournament.status
    assert_equal Date.new(2025, 6, 27), tournament.start_date

    game = Game.find_by!(legacy_id: "next_game_1")
    assert_equal tournament.id, game.tournament_id
    assert_equal 50, game.home_score
    assert_equal 44, game.away_score
    assert_equal "https://clutch.test/live", game.stream_url

    placeholder_game = Game.find_by!(legacy_id: "next_game_placeholder")
    assert placeholder_game.placeholder?
    assert_equal placeholder_game.home_team_id, placeholder_game.away_team_id

    article = ArticleLink.find_by!(legacy_id: "next_article_1")
    ingest_item = ContentIngestItem.find_by!(legacy_id: "next_ingest_1")
    media_ingest_item = ContentIngestItem.find_by!(legacy_id: "next_ingest_2")
    assert_equal "approved", ingest_item.status
    assert_equal article.id.to_s, ingest_item.imported_to_id
    assert_equal "approved", media_ingest_item.status
    assert_equal MediaAsset.find_by!(legacy_id: "next_media_1").id.to_s, media_ingest_item.imported_to_id
    assert_equal 2, MediaAsset.where(image_url: "https://example.test/media.jpg").count

    report = DataMigration::NextPrismaSnapshot::Validate.call(path)
    assert report[:ok], report[:issues].join("\n")
    assert_equal({ total: 2, scored: 1, percent: 50.0, finalMissingScores: 0 }, report[:scoreCoverage][:rails])
  end

  test "ambiguous media ingest inference resets approved source item to pending" do
    payload = snapshot_payload
    ingest = payload[:records][:contentIngestItems].find { |item| item[:id] == "next_ingest_2" }
    ingest[:title] = "Ambiguous duplicate image"
    path = write_snapshot(payload, "next-prisma-ambiguous-media-ingest-test.json")

    DataMigration::NextPrismaSnapshot::Import.call(path)

    item = ContentIngestItem.find_by!(legacy_id: "next_ingest_2")
    assert_equal "pending", item.status
    assert_nil item.imported_to_id
    assert_includes item.notes, "reset to pending"
  end

  test "validator reports content records that reference missing tournaments" do
    payload = snapshot_payload
    payload[:records][:articleLinks].first[:tournamentId] = "missing_tournament"
    payload[:records][:mediaAssets].first[:tournamentId] = "missing_tournament"
    payload[:records][:sponsors].first[:tournamentId] = "missing_tournament"
    payload[:records][:contentIngestItems].first[:tournamentId] = "missing_tournament"
    path = write_snapshot(payload, "next-prisma-invalid-relationships-test.json")

    report = DataMigration::NextPrismaSnapshot::Validate.call(path)

    assert_not report[:ok]
    assert_includes report[:issues], "article next_article_1 references missing tournament missing_tournament"
    assert_includes report[:issues], "media asset next_media_1 references missing tournament missing_tournament"
    assert_includes report[:issues], "sponsor next_sponsor_1 references missing tournament missing_tournament"
    assert_includes report[:issues], "ingest item next_ingest_1 references missing tournament missing_tournament"
  end

  private

  def write_snapshot(payload = snapshot_payload, filename = "next-prisma-snapshot-test.json")
    path = Rails.root.join("tmp", filename)
    FileUtils.mkdir_p(path.dirname)
    File.write(path, JSON.pretty_generate(payload))
    path.to_s
  end

  def snapshot_payload
    now = "2026-06-11T00:00:00.000Z"

    {
      format: "fd-alumni-hub-next-prisma-export",
      version: 1,
      exportedAt: now,
      source: { app: "apps/web", databaseProvider: "postgresql" },
      counts: {
        tournaments: 1,
        teams: 2,
        games: 2,
        standings: 1,
        articleLinks: 1,
        mediaAssets: 2,
        sponsors: 1,
        contentIngestItems: 2,
        adminWhitelists: 1,
        appUsers: 1
      },
      records: {
        tournaments: [
          {
            id: "next_tournament_2025",
            name: "FD Alumni Basketball Tournament",
            year: 2025,
            startDate: "2025-06-27T00:00:00.000Z",
            endDate: "2025-07-19T00:00:00.000Z",
            status: "completed",
            createdAt: now,
            updatedAt: now
          }
        ],
        teams: [
          {
            id: "next_team_2002_04",
            tournamentId: "next_tournament_2025",
            classYearLabel: "Class of 2002/04",
            displayName: "Class of 2002/04",
            division: "Maroon",
            createdAt: now,
            updatedAt: now
          },
          {
            id: "next_team_2013",
            tournamentId: "next_tournament_2025",
            classYearLabel: "Class of 2013",
            displayName: "Class of 2013",
            division: "Maroon",
            createdAt: now,
            updatedAt: now
          }
        ],
        games: [
          {
            id: "next_game_1",
            tournamentId: "next_tournament_2025",
            homeTeamId: "next_team_2002_04",
            awayTeamId: "next_team_2013",
            startTime: "2025-07-19T10:00:00.000Z",
            venue: "FD Phoenix Center",
            status: "final",
            homeScore: 50,
            awayScore: 44,
            streamUrl: "https://clutch.test/live",
            ticketUrl: "https://guamtime.test/tickets",
            notes: "phase=playoff",
            division: "Maroon",
            bracketCode: "F",
            createdAt: now,
            updatedAt: now
          },
          {
            id: "next_game_placeholder",
            tournamentId: "next_tournament_2025",
            homeTeamId: "next_team_2013",
            awayTeamId: "next_team_2013",
            startTime: "2025-07-20T10:00:00.000Z",
            venue: "FD Phoenix Center",
            status: "scheduled",
            homeScore: nil,
            awayScore: nil,
            streamUrl: nil,
            ticketUrl: nil,
            notes: "phase=playoff | placeholder=TBD",
            division: "Special",
            bracketCode: "TBD",
            createdAt: now,
            updatedAt: now
          }
        ],
        standings: [
          {
            id: "next_standing_1",
            tournamentId: "next_tournament_2025",
            teamId: "next_team_2002_04",
            wins: 1,
            losses: 0,
            pointsFor: 50,
            pointsAgainst: 44,
            updatedAt: now
          }
        ],
        articleLinks: [
          {
            id: "next_article_1",
            tournamentId: "next_tournament_2025",
            title: "Championship recap",
            source: "GSPN",
            url: "https://example.test/championship-recap",
            publishedAt: "2025-07-19T00:00:00.000Z",
            createdAt: now,
            imageUrl: "https://example.test/photo.jpg",
            excerpt: "Tournament recap"
          }
        ],
        mediaAssets: [
          {
            id: "next_media_1",
            tournamentId: "next_tournament_2025",
            source: "GSPN",
            title: "Championship photo",
            imageUrl: "https://example.test/media.jpg",
            articleUrl: "https://example.test/championship-recap",
            caption: "Championship night",
            tags: "championship",
            takenAt: "2025-07-19T00:00:00.000Z",
            createdAt: now,
            updatedAt: now
          },
          {
            id: "next_media_2",
            tournamentId: "next_tournament_2025",
            source: "GSPN",
            title: "Duplicate source image with different caption",
            imageUrl: "https://example.test/media.jpg",
            articleUrl: "https://example.test/championship-recap",
            caption: "Alternate caption",
            tags: "championship,alternate",
            takenAt: "2025-07-19T00:00:00.000Z",
            createdAt: now,
            updatedAt: now
          }
        ],
        sponsors: [
          {
            id: "next_sponsor_1",
            tournamentId: "next_tournament_2025",
            name: "Community Sponsor",
            logoUrl: nil,
            targetUrl: "https://example.test",
            tier: "Community Partner",
            active: true,
            position: 1,
            createdAt: now,
            updatedAt: now
          }
        ],
        contentIngestItems: [
          {
            id: "next_ingest_1",
            tournamentId: "next_tournament_2025",
            kind: "article",
            status: "approved",
            source: "GSPN",
            title: "Championship recap",
            url: "https://example.test/championship-recap",
            imageUrl: "https://example.test/photo.jpg",
            excerpt: "Tournament recap",
            confidence: "high",
            notes: "Imported from Next",
            importedToId: "next_article_1",
            createdAt: now,
            updatedAt: now
          },
          {
            id: "next_ingest_2",
            tournamentId: "next_tournament_2025",
            kind: "media",
            status: "approved",
            source: "GSPN",
            title: "Championship photo",
            url: "https://example.test/media.jpg",
            imageUrl: "https://example.test/media.jpg",
            excerpt: "Tournament photo",
            confidence: "high",
            notes: "Imported from Next without importedToId",
            importedToId: nil,
            createdAt: now,
            updatedAt: now
          }
        ],
        adminWhitelists: [
          {
            id: "next_whitelist_1",
            email: "admin@example.test",
            role: "admin",
            isActive: true,
            notes: "Next import",
            createdAt: now,
            updatedAt: now
          }
        ],
        appUsers: [
          {
            id: "next_user_1",
            clerkId: "clerk_next_user_1",
            email: "admin@example.test",
            role: "admin",
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
        ]
      }
    }
  end
end
