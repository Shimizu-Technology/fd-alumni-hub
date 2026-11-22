module Audit
  module DatabaseTriggers
    # Bump when changing trigger SQL. Kept in sync on deploy via db:prepare and db:migrate.
    TRIGGER_VERSION = 3

    RECORD_TYPES = {
      users: "User",
      admin_whitelists: "AdminWhitelist",
      campaign_memberships: "CampaignMembership",
      campaign_invitations: "CampaignInvitation",
      host_campaigns: "HostCampaign",
      games: "Game",
      tournaments: "Tournament",
      divisions: "Division",
      teams: "Team",
      roster_entries: "RosterEntry",
      class_cohorts: "ClassCohort",
      team_class_memberships: "TeamClassMembership",
      standings: "Standing",
      tournament_champions: "TournamentChampion",
      tournament_champion_credits: "TournamentChampionCredit",
      game_day_notes: "GameDayNote",
      tournament_alerts: "TournamentAlert",
      article_links: "ArticleLink",
      media_assets: "MediaAsset",
      sponsors: "Sponsor",
      prediction_polls: "PredictionPoll",
      prediction_votes: "PredictionVote",
      content_ingest_items: "ContentIngestItem",
      budget_lines: "BudgetLine",
      campaign_events: "CampaignEvent",
      campaign_posts: "CampaignPost",
      pledges: "Pledge",
      ledger_entries: "LedgerEntry",
      pending_receipt_uploads: "PendingReceiptUpload",
      hafapass_event_snapshots: "HafapassEventSnapshot"
    }.freeze

    ORIGINAL_TABLES = %i[users admin_whitelists campaign_memberships campaign_invitations host_campaigns games].freeze

    def self.install!(connection = ActiveRecord::Base.connection)
      return unless connection.table_exists?(:audit_events)

      connection.transaction do
        version = connection.table_exists?(:audit_checkpoints) ? TRIGGER_VERSION : 2
        connection.execute(REDACT_SQL)
        connection.execute(REDACT_CHANGES_SQL)
        connection.execute(CAPTURE_SQL)
        # Blocks accidental app-level UPDATE, DELETE, and TRUNCATE.
        # Full tamper resistance against DBA-level DDL requires a non-owner runtime DB role.
        connection.execute(<<~SQL)
          CREATE OR REPLACE FUNCTION fd_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            RAISE EXCEPTION '% is append-only and cannot be modified or deleted', TG_TABLE_NAME;
          END;
          $$;
        SQL

        %i[audit_events audit_checkpoints].each do |table|
          next unless connection.table_exists?(table)

          connection.execute(<<~SQL)
            DROP TRIGGER IF EXISTS fd_audit_immutable ON #{table};
            CREATE TRIGGER fd_audit_immutable BEFORE UPDATE OR DELETE ON #{table}
              FOR EACH ROW EXECUTE FUNCTION fd_audit_immutable();
            DROP TRIGGER IF EXISTS fd_audit_immutable_truncate ON #{table};
            CREATE TRIGGER fd_audit_immutable_truncate BEFORE TRUNCATE ON #{table}
              FOR EACH STATEMENT EXECUTE FUNCTION fd_audit_immutable();
          SQL
        end

        RECORD_TYPES.each do |table, record_type|
          next unless connection.table_exists?(table)

          connection.execute("DROP TRIGGER IF EXISTS fd_audit_capture ON #{table}")
          connection.execute("DROP TRIGGER IF EXISTS fd_audit_capture_delete ON #{table}")
          next if version == 2 && !ORIGINAL_TABLES.include?(table)

          connection.execute(<<~SQL)
            CREATE TRIGGER fd_audit_capture AFTER INSERT OR UPDATE ON #{table}
              FOR EACH ROW EXECUTE FUNCTION fd_audit_capture(#{connection.quote(record_type)});
            CREATE TRIGGER fd_audit_capture_delete BEFORE DELETE ON #{table}
              FOR EACH ROW EXECUTE FUNCTION fd_audit_capture(#{connection.quote(record_type)});
          SQL
        end
      end
    end

    def self.uninstall!(connection)
      RECORD_TYPES.each_key do |table|
        next unless connection.table_exists?(table)

        connection.execute("DROP TRIGGER IF EXISTS fd_audit_capture ON #{table}")
        connection.execute("DROP TRIGGER IF EXISTS fd_audit_capture_delete ON #{table}")
      end
      %i[audit_events audit_checkpoints].each do |table|
        next unless connection.table_exists?(table)

        connection.execute("DROP TRIGGER IF EXISTS fd_audit_immutable ON #{table}")
        connection.execute("DROP TRIGGER IF EXISTS fd_audit_immutable_truncate ON #{table}")
      end
      connection.execute(<<~SQL)
        DROP FUNCTION IF EXISTS fd_audit_immutable();
        DROP FUNCTION IF EXISTS fd_audit_capture();
        DROP FUNCTION IF EXISTS fd_audit_redact_changes(jsonb, jsonb, jsonb, jsonb);
        DROP FUNCTION IF EXISTS fd_audit_redact(jsonb);
      SQL
    end

    # Both trigger capture and legacy imports use this function, including for
    # nested objects and arrays in legacy ledger changes. Sensitive keys keep
    # their key name with "[Redacted]" for non-null values so edits stay visible.
    REDACT_SQL = <<~'SQL'.freeze
      CREATE OR REPLACE FUNCTION fd_audit_redact(payload jsonb) RETURNS jsonb
      LANGUAGE sql IMMUTABLE AS $$
        SELECT CASE jsonb_typeof(payload)
          WHEN 'object' THEN (
            SELECT coalesce(jsonb_object_agg(
              key,
              CASE
                WHEN regexp_replace(lower(key), '[^a-z0-9]', '', 'g') ~
                  '(voter.*(token|hash|key)|iphash|objectkey|storagekey|s3key|token|secret|password|signedurl|receiptkey|clerkid|lastscoremutationdigest|authorization|apikey|distributioncode)'
                THEN CASE WHEN value IN ('null'::jsonb, '"[Redacted · changed]"'::jsonb)
                  THEN value ELSE '"[Redacted]"'::jsonb END
                ELSE fd_audit_redact(value)
              END
            ), '{}')
            FROM jsonb_each(payload)
          )
          WHEN 'array' THEN (
            SELECT coalesce(jsonb_agg(fd_audit_redact(value) ORDER BY ordinal), '[]')
            FROM jsonb_array_elements(payload) WITH ORDINALITY AS entries(value, ordinal)
          )
          WHEN 'string' THEN CASE
            WHEN (payload #>> '{}') ~* '([?&](x-amz-[^=& ]+|x-goog-[^=& ]+|signature|sig|token|access_token|policy|key-pair-id|expires)=|/rails/active_storage/|Bearer [[:alnum:]_.-]+)'
            THEN '"[Redacted]"'::jsonb
            ELSE payload
          END
          ELSE payload
        END
      $$;
    SQL

    # Compare raw values only in PostgreSQL. The ledger receives sanitized values.
    REDACT_CHANGES_SQL = <<~'SQL'.freeze
      CREATE OR REPLACE FUNCTION fd_audit_redact_changes(
        old_raw jsonb, new_raw jsonb, old_clean jsonb, new_clean jsonb
      ) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
        SELECT CASE
          WHEN old_raw IS NOT DISTINCT FROM new_raw THEN new_clean
          WHEN old_clean = '"[Redacted]"'::jsonb AND new_clean = old_clean
            THEN '"[Redacted · changed]"'::jsonb
          WHEN jsonb_typeof(new_clean) = 'object' AND jsonb_typeof(old_clean) = 'object' THEN (
            SELECT coalesce(jsonb_object_agg(key,
              fd_audit_redact_changes(old_raw->key, new_raw->key, old_clean->key, value)), '{}')
            FROM jsonb_each(new_clean)
          )
          WHEN jsonb_typeof(new_clean) = 'array' AND jsonb_typeof(old_clean) = 'array' THEN (
            SELECT coalesce(jsonb_agg(fd_audit_redact_changes(
              old_raw->(ordinal - 1)::int, new_raw->(ordinal - 1)::int,
              old_clean->(ordinal - 1)::int, value) ORDER BY ordinal), '[]')
            FROM jsonb_array_elements(new_clean) WITH ORDINALITY AS entries(value, ordinal)
          )
          ELSE new_clean
        END
      $$;
    SQL

    CAPTURE_SQL = <<~SQL.freeze
      CREATE OR REPLACE FUNCTION fd_audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        old_data jsonb := '{}';
        new_data jsonb := '{}';
        record_data jsonb;
        ignored_columns text[] := ARRAY['updated_at', 'lock_version'];
        operation text := coalesce(nullif(current_setting('app.audit_operation_id', true), ''),
          'tx-' || pg_current_xact_id()::text);
        parent_type text;
        parent_id bigint;
        audit_area text;
        label text;
        subject text;
        campaign_id bigint;
        season_id bigint;
        actor_name text := nullif(current_setting('app.audit_actor_name', true), '');
        actor_email text := nullif(current_setting('app.audit_actor_email', true), '');
        actor_type text := coalesce(nullif(current_setting('app.audit_actor_type', true), ''), 'system');
        actor_label text := coalesce(actor_name, actor_email, initcap(actor_type));
        event_request_id text := nullif(current_setting('app.audit_request_id', true), '');
        event_ip_address text := nullif(current_setting('app.audit_ip_address', true), '');
        audit_action text;
        verb text;
        description text;
      BEGIN
        IF TG_TABLE_NAME = 'hafapass_event_snapshots' THEN
          ignored_columns := ignored_columns || ARRAY['refreshing_until', 'fetched_at', 'last_error_at'];
        END IF;
        IF TG_OP = 'UPDATE' AND to_jsonb(OLD) - ignored_columns = to_jsonb(NEW) - ignored_columns THEN
          RETURN NULL;
        END IF;

        IF TG_OP <> 'INSERT' THEN
          old_data := fd_audit_redact(to_jsonb(OLD));
        END IF;
        IF TG_OP <> 'DELETE' THEN
          new_data := fd_audit_redact(to_jsonb(NEW));
        END IF;

        record_data := CASE WHEN TG_OP = 'DELETE' THEN old_data ELSE new_data END;
        IF TG_TABLE_NAME = 'prediction_votes' AND TG_OP IN ('INSERT', 'UPDATE') AND
          nullif(current_setting('app.audit_actor_id', true), '') IS NULL THEN
          actor_type := 'anonymous';
          actor_label := 'Anonymous';
          event_request_id := NULL;
          event_ip_address := NULL;
        END IF;
        campaign_id := (record_data->>'host_campaign_id')::bigint;
        season_id := (record_data->>'tournament_id')::bigint;
        audit_action := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
        verb := CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END;

        CASE TG_TABLE_NAME
          WHEN 'host_campaigns' THEN
            audit_area := 'campaigns';
            label := record_data->>'title';
            campaign_id := (record_data->>'id')::bigint;
            subject := 'campaign ' || label;
            IF TG_OP = 'UPDATE' AND old_data->>'status' <> 'archived' AND new_data->>'status' = 'archived' THEN
              audit_action := 'campaign_archived';
              verb := 'archived';
            END IF;
          WHEN 'games' THEN
            audit_area := 'results';
            label := 'Game #' || coalesce(record_data->>'game_number', record_data->>'id');
            subject := label;
            IF TG_OP = 'UPDATE' AND (old_data->'home_score', old_data->'away_score')
                IS DISTINCT FROM (new_data->'home_score', new_data->'away_score') THEN
              audit_action := 'score_updated';
              description := format('%s updated %s score from %s-%s to %s-%s', actor_label, label,
                coalesce(old_data->>'home_score', '—'), coalesce(old_data->>'away_score', '—'),
                coalesce(new_data->>'home_score', '—'), coalesce(new_data->>'away_score', '—'));
            ELSIF TG_OP = 'UPDATE' AND old_data->>'status' IS DISTINCT FROM new_data->>'status' THEN
              description := format('%s changed %s status from %s to %s', actor_label, label,
                replace(old_data->>'status', '_', ' '), replace(new_data->>'status', '_', ' '));
            END IF;
          WHEN 'tournaments' THEN
            audit_area := 'schedule';
            label := coalesce(nullif(record_data->>'name', ''), 'Tournament #' || (record_data->>'id'));
          WHEN 'divisions' THEN
            audit_area := 'schedule';
            label := coalesce(nullif(record_data->>'name', ''), 'Division #' || (record_data->>'id'));
          WHEN 'teams' THEN
            audit_area := 'schedule';
            label := coalesce(nullif(record_data->>'display_name', ''), 'Team #' || (record_data->>'id'));
          WHEN 'roster_entries' THEN
            audit_area := 'schedule';
            label := coalesce(nullif(record_data->>'name', ''), 'Roster entry #' || (record_data->>'id'));
          WHEN 'class_cohorts' THEN
            audit_area := 'schedule';
            label := coalesce(nullif(record_data->>'display_name', ''), 'Class cohort #' || (record_data->>'id'));
          WHEN 'team_class_memberships' THEN
            audit_area := 'schedule';
            label := 'Team class membership #' || (record_data->>'id');
          WHEN 'standings' THEN
            audit_area := 'schedule';
            label := 'Standing #' || (record_data->>'id');
          WHEN 'tournament_champions' THEN
            audit_area := 'history';
            label := coalesce(nullif(record_data->>'champion_label', ''), 'Tournament champion #' || (record_data->>'id'));
          WHEN 'tournament_champion_credits' THEN
            audit_area := 'history';
            label := 'Champion credit #' || (record_data->>'id');
          WHEN 'game_day_notes' THEN
            audit_area := 'content';
            label := coalesce('Game-day notes for ' || (record_data->>'date'), 'Game-day notes #' || (record_data->>'id'));
          WHEN 'tournament_alerts' THEN
            audit_area := 'content';
            label := coalesce(nullif(record_data->>'title', ''), 'Tournament alert #' || (record_data->>'id'));
          WHEN 'article_links' THEN
            audit_area := 'content';
            label := coalesce(nullif(record_data->>'title', ''), 'Article #' || (record_data->>'id'));
          WHEN 'media_assets' THEN
            audit_area := 'content';
            label := coalesce(nullif(record_data->>'title', ''), 'Media asset #' || (record_data->>'id'));
          WHEN 'sponsors' THEN
            audit_area := 'content';
            label := coalesce(nullif(record_data->>'name', ''), 'Sponsor #' || (record_data->>'id'));
          WHEN 'prediction_polls' THEN
            audit_area := 'content';
            label := coalesce(nullif(record_data->>'question', ''), 'Prediction poll #' || (record_data->>'id'));
          WHEN 'prediction_votes' THEN
            audit_area := 'content';
            label := 'Prediction vote #' || (record_data->>'id');
          WHEN 'content_ingest_items' THEN
            audit_area := 'content';
            label := coalesce(nullif(record_data->>'title', ''), 'Content ingest item #' || (record_data->>'id'));
          WHEN 'hafapass_event_snapshots' THEN
            audit_area := 'campaigns';
            label := coalesce('HafaPass snapshot for ' || nullif(record_data->>'organizer_slug', ''), 'HafaPass snapshot #' || (record_data->>'id'));
          WHEN 'campaign_events' THEN
            audit_area := 'campaigns';
            label := coalesce(nullif(record_data->>'title', ''), 'Campaign event #' || (record_data->>'id'));
          WHEN 'campaign_posts' THEN
            audit_area := 'campaigns';
            label := coalesce(nullif(record_data->>'title', ''), 'Campaign post #' || (record_data->>'id'));
          WHEN 'budget_lines' THEN
            audit_area := 'finance';
            label := coalesce(nullif(record_data->>'category', ''), 'Budget line #' || (record_data->>'id'));
          WHEN 'pledges' THEN
            audit_area := 'finance';
            label := coalesce(nullif(record_data->>'donor_name', ''), 'Pledge #' || (record_data->>'id'));
          WHEN 'ledger_entries' THEN
            audit_area := 'finance';
            label := 'Ledger entry #' || (record_data->>'id');
          WHEN 'pending_receipt_uploads' THEN
            audit_area := 'finance';
            label := 'Receipt upload #' || (record_data->>'id');
          ELSE
            audit_area := 'access';
            label := record_data->>'email';
            IF TG_TABLE_NAME = 'campaign_memberships' THEN
              SELECT email INTO label FROM users WHERE id = (record_data->>'user_id')::bigint;
            END IF;
            label := coalesce(label, TG_ARGV[0] || ' #' || (record_data->>'id'));
            subject := 'access for ' || label;
        END CASE;

        label := coalesce(nullif(label, ''), TG_ARGV[0] || ' #' || (record_data->>'id'));
        subject := coalesce(subject, label);

        IF TG_TABLE_NAME = 'tournaments' THEN
          season_id := (record_data->>'id')::bigint;
        ELSIF TG_TABLE_NAME IN ('roster_entries', 'team_class_memberships') THEN
          parent_type := 'Team';
          parent_id := (record_data->>'team_id')::bigint;
          SELECT tournament_id INTO season_id FROM teams WHERE id = parent_id;
        ELSIF TG_TABLE_NAME = 'prediction_votes' THEN
          parent_type := 'PredictionPoll';
          parent_id := (record_data->>'prediction_poll_id')::bigint;
          SELECT tournament_id INTO season_id FROM prediction_polls WHERE id = parent_id;
        ELSIF TG_TABLE_NAME = 'tournament_champion_credits' THEN
          parent_type := 'TournamentChampion';
          parent_id := (record_data->>'tournament_champion_id')::bigint;
          SELECT tournament_id INTO season_id FROM tournament_champions WHERE id = parent_id;
        ELSIF TG_TABLE_NAME = 'hafapass_event_snapshots' THEN
          -- A snapshot can serve multiple campaigns. Assign a campaign only when unambiguous.
          SELECT CASE WHEN count(*) = 1 THEN min(id) END,
                 CASE WHEN count(DISTINCT tournament_id) = 1 THEN min(tournament_id) END
          INTO campaign_id, season_id FROM host_campaigns
          WHERE hafapass_organizer_slug = record_data->>'organizer_slug'
             OR hafapass_tournament_organizer_slug = record_data->>'organizer_slug';
        END IF;

        IF season_id IS NULL AND parent_id IS NOT NULL AND TG_OP = 'DELETE' THEN
          -- A cascaded DELETE can run after its parent row has disappeared.
          SELECT tournament_id INTO season_id FROM audit_events
          WHERE operation_id = operation AND after_json = '{}'::jsonb
            AND record_type = parent_type AND record_id = parent_id::text
          ORDER BY id DESC LIMIT 1;
        END IF;

        IF season_id IS NULL AND campaign_id IS NOT NULL THEN
          SELECT tournament_id INTO season_id FROM host_campaigns WHERE id = campaign_id;
        END IF;

        IF TG_OP = 'UPDATE' THEN
          new_data := fd_audit_redact_changes(to_jsonb(OLD), to_jsonb(NEW), old_data, new_data);
        END IF;

        INSERT INTO audit_events (
          operation_id, actor_type, actor_id, actor_name, actor_email, actor_role,
          area, action, record_type, record_id, record_label, tournament_id, host_campaign_id,
          summary, before_json, after_json, reason, request_id, http_method, route_path, ip_address
        ) VALUES (
          operation,
          actor_type, nullif(current_setting('app.audit_actor_id', true), '')::bigint,
          actor_name, actor_email, nullif(current_setting('app.audit_actor_role', true), ''),
          audit_area, coalesce(nullif(current_setting('app.audit_action_override', true), ''), audit_action),
          TG_ARGV[0], record_data->>'id', label, season_id, campaign_id,
          coalesce(description, format('%s %s %s', actor_label, verb, subject)),
          old_data, new_data,
          fd_audit_redact(to_jsonb(nullif(current_setting('app.audit_reason', true), ''))) #>> '{}',
          event_request_id,
          nullif(current_setting('app.audit_http_method', true), ''),
          fd_audit_redact(to_jsonb(nullif(current_setting('app.audit_route_path', true), ''))) #>> '{}',
          event_ip_address
        );
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$;
    SQL
  end
end
