require "json"

module DataMigration
  module NextPrismaSnapshot
    class Import
      FORMAT = "fd-alumni-hub-next-prisma-export"

      attr_reader :path, :snapshot, :records, :id_maps

      def self.call(path)
        new(path).call
      end

      def initialize(path)
        @path = path
        @snapshot = JSON.parse(File.read(path))
        @records = snapshot.fetch("records")
        @id_maps = Hash.new { |hash, key| hash[key] = {} }
      end

      def call
        validate_format!

        ActiveRecord::Base.transaction do
          import_tournaments
          import_teams
          import_games
          import_standings
          import_article_links
          import_media_assets
          import_sponsors
          import_content_ingest_items
          import_admin_whitelists
          import_users
        end

        result
      end

      private

      def validate_format!
        return if snapshot["format"] == FORMAT && snapshot["version"].to_i == 1

        raise ArgumentError, "Unsupported snapshot format/version"
      end

      def result
        {
          path: path,
          importedAt: Time.current.iso8601,
          sourceExportedAt: snapshot["exportedAt"],
          counts: records.transform_values(&:length)
        }
      end

      def import_tournaments
        each_record("tournaments") do |source|
          tournament = find_by_legacy(Tournament, source) || Tournament.find_or_initialize_by(year: source.fetch("year"), name: source.fetch("name"))
          persist!(tournament, source, {
            legacy_id: source.fetch("id"),
            name: source.fetch("name"),
            year: source.fetch("year"),
            start_date: parse_date(source.fetch("startDate")),
            end_date: parse_date(source.fetch("endDate")),
            status: source.fetch("status")
          })
          id_maps[:tournaments][source.fetch("id")] = tournament.id
        end
      end

      def import_teams
        each_record("teams") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "team", source.fetch("id"))
          team = find_by_legacy(Team, source) || Team.find_or_initialize_by(tournament_id: tournament_id, display_name: source.fetch("displayName"))
          persist!(team, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            class_year_label: source.fetch("classYearLabel"),
            display_name: source.fetch("displayName"),
            division: blank_to_nil(source["division"])
          })
          id_maps[:teams][source.fetch("id")] = team.id
        end
      end

      def import_games
        each_record("games") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "game", source.fetch("id"))
          home_team_id = mapped_id!(:teams, source.fetch("homeTeamId"), "game", source.fetch("id"))
          away_team_id = mapped_id!(:teams, source.fetch("awayTeamId"), "game", source.fetch("id"))
          game = find_by_legacy(Game, source) || Game.find_or_initialize_by(
            tournament_id: tournament_id,
            home_team_id: home_team_id,
            away_team_id: away_team_id,
            start_time: parse_time(source.fetch("startTime"))
          )

          persist!(game, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            home_team_id: home_team_id,
            away_team_id: away_team_id,
            start_time: parse_time(source.fetch("startTime")),
            venue: blank_to_nil(source["venue"]),
            status: source.fetch("status"),
            home_score: source["homeScore"],
            away_score: source["awayScore"],
            stream_url: blank_to_nil(source["streamUrl"]),
            ticket_url: blank_to_nil(source["ticketUrl"]),
            notes: blank_to_nil(source["notes"]),
            division: blank_to_nil(source["division"]),
            bracket_code: blank_to_nil(source["bracketCode"])
          })
          id_maps[:games][source.fetch("id")] = game.id
        end
      end

      def import_standings
        each_record("standings") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "standing", source.fetch("id"))
          team_id = mapped_id!(:teams, source.fetch("teamId"), "standing", source.fetch("id"))
          standing = find_by_legacy(Standing, source) || Standing.find_or_initialize_by(tournament_id: tournament_id, team_id: team_id)
          persist!(standing, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            team_id: team_id,
            wins: source.fetch("wins"),
            losses: source.fetch("losses"),
            points_for: source.fetch("pointsFor"),
            points_against: source.fetch("pointsAgainst")
          })
          id_maps[:standings][source.fetch("id")] = standing.id
        end
      end

      def import_article_links
        each_record("articleLinks") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "article", source.fetch("id"))
          article = find_by_legacy(ArticleLink, source) || ArticleLink.find_or_initialize_by(tournament_id: tournament_id, url: source.fetch("url"))
          persist!(article, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            title: source.fetch("title"),
            source: source.fetch("source"),
            url: source.fetch("url"),
            published_at: parse_time(source["publishedAt"]),
            image_url: blank_to_nil(source["imageUrl"]),
            excerpt: blank_to_nil(source["excerpt"])
          })
          id_maps[:article_links][source.fetch("id")] = article.id
        end
      end

      def import_media_assets
        each_record("mediaAssets") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "media", source.fetch("id"))
          media = find_by_legacy(MediaAsset, source) || MediaAsset.new
          persist!(media, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            source: source.fetch("source"),
            title: source.fetch("title"),
            image_url: source.fetch("imageUrl"),
            article_url: blank_to_nil(source["articleUrl"]),
            caption: blank_to_nil(source["caption"]),
            tags: blank_to_nil(source["tags"]),
            taken_at: parse_time(source["takenAt"])
          })
          id_maps[:media_assets][source.fetch("id")] = media.id
        end
      end

      def import_sponsors
        each_record("sponsors") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "sponsor", source.fetch("id"))
          sponsor = find_by_legacy(Sponsor, source) || Sponsor.find_or_initialize_by(tournament_id: tournament_id, name: source.fetch("name"))
          persist!(sponsor, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            name: source.fetch("name"),
            logo_url: blank_to_nil(source["logoUrl"]),
            target_url: blank_to_nil(source["targetUrl"]),
            tier: blank_to_nil(source["tier"]),
            active: source.fetch("active"),
            position: source.fetch("position")
          })
          id_maps[:sponsors][source.fetch("id")] = sponsor.id
        end
      end

      def import_content_ingest_items
        each_record("contentIngestItems") do |source|
          tournament_id = mapped_id!(:tournaments, source.fetch("tournamentId"), "ingest item", source.fetch("id"))
          item = find_by_legacy(ContentIngestItem, source) || ContentIngestItem.find_or_initialize_by(tournament_id: tournament_id, url: source.fetch("url"))
          imported_to_id = mapped_imported_to_id(source, tournament_id)
          persist!(item, source, {
            legacy_id: source.fetch("id"),
            tournament_id: tournament_id,
            kind: source.fetch("kind"),
            status: migrated_ingest_status(source, imported_to_id),
            source: source.fetch("source"),
            title: source.fetch("title"),
            url: source.fetch("url"),
            image_url: blank_to_nil(source["imageUrl"]),
            excerpt: blank_to_nil(source["excerpt"]),
            confidence: blank_to_nil(source["confidence"]),
            notes: migrated_ingest_notes(source, imported_to_id),
            imported_to_id: imported_to_id
          })
          id_maps[:content_ingest_items][source.fetch("id")] = item.id
        end
      end

      def import_admin_whitelists
        each_record("adminWhitelists") do |source|
          whitelist = find_by_legacy(AdminWhitelist, source) || AdminWhitelist.find_or_initialize_by(email: source.fetch("email").to_s.downcase)
          persist!(whitelist, source, {
            legacy_id: source.fetch("id"),
            email: source.fetch("email"),
            role: source.fetch("role"),
            active: source.fetch("isActive"),
            notes: blank_to_nil(source["notes"])
          })
          id_maps[:admin_whitelists][source.fetch("id")] = whitelist.id
        end
      end

      def import_users
        each_record("appUsers") do |source|
          user = find_by_legacy(User, source) || User.find_or_initialize_by(email: source.fetch("email").to_s.downcase)
          persist!(user, source, {
            legacy_id: source.fetch("id"),
            clerk_id: blank_to_nil(source["clerkId"]),
            email: source.fetch("email"),
            role: source.fetch("role"),
            active: source.fetch("isActive")
          })
          id_maps[:users][source.fetch("id")] = user.id
        end
      end

      def migrated_ingest_status(source, imported_to_id)
        return "pending" if source["status"] == "approved" && imported_to_id.blank?

        source.fetch("status")
      end

      def migrated_ingest_notes(source, imported_to_id)
        notes = blank_to_nil(source["notes"])
        return notes unless source["status"] == "approved" && imported_to_id.blank?

        [ notes, "Migration note: source snapshot marked this item approved without an imported record; reset to pending for review." ].compact.join("\n")
      end

      def mapped_imported_to_id(source, tournament_id)
        legacy_imported_id = blank_to_nil(source["importedToId"])
        mapped_id = if source["kind"] == "article"
          id_maps[:article_links][legacy_imported_id]
        else
          id_maps[:media_assets][legacy_imported_id]
        end
        return mapped_id.to_s if mapped_id
        return nil unless source["status"] == "approved"

        inferred_import_for(source, tournament_id)&.id&.to_s
      end

      def inferred_import_for(source, tournament_id)
        if source["kind"] == "article"
          ArticleLink.find_by(tournament_id: tournament_id, url: source["url"])
        else
          MediaAsset.find_by(tournament_id: tournament_id, image_url: source["imageUrl"])
        end
      end

      def each_record(key, &block)
        records.fetch(key, []).each(&block)
      end

      def find_by_legacy(model, source)
        model.find_by(legacy_id: source.fetch("id"))
      end

      def mapped_id!(map_key, legacy_id, record_type, record_id)
        id_maps[map_key][legacy_id] || raise(ArgumentError, "Missing #{map_key.to_s.singularize} #{legacy_id} for #{record_type} #{record_id}")
      end

      def persist!(record, source, attrs)
        created_at = parse_time(source["createdAt"])
        updated_at = parse_time(source["updatedAt"]) || created_at

        record.assign_attributes(attrs.compact)
        record.created_at = created_at if created_at && record.new_record?
        record.save!

        timestamps = {}
        timestamps[:created_at] = created_at if created_at
        timestamps[:updated_at] = updated_at if updated_at
        record.update_columns(timestamps) if timestamps.any? && record.persisted?

        record
      end

      def parse_date(value)
        return if value.blank?

        Date.iso8601(value.to_s[0, 10])
      end

      def parse_time(value)
        return if value.blank?

        Time.zone.parse(value.to_s)
      end

      def blank_to_nil(value)
        value.presence
      end
    end
  end
end
