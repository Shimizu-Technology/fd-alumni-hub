module Audit
  module DatabaseTriggers
    RECORD_TYPES = {
      users: "User",
      admin_whitelists: "AdminWhitelist",
      campaign_memberships: "CampaignMembership",
      campaign_invitations: "CampaignInvitation",
      host_campaigns: "HostCampaign",
      games: "Game"
    }.freeze

    def self.install!(connection = ActiveRecord::Base.connection)
      return unless connection.table_exists?(:audit_events)

      connection.transaction do
        connection.execute(REDACT_SQL)
        connection.execute(CAPTURE_SQL)
        connection.execute(<<~SQL)
          CREATE OR REPLACE FUNCTION fd_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            RAISE EXCEPTION 'audit_events is append-only and cannot be modified or deleted';
          END;
          $$;
          DROP TRIGGER IF EXISTS fd_audit_immutable ON audit_events;
          CREATE TRIGGER fd_audit_immutable BEFORE UPDATE OR DELETE ON audit_events
            FOR EACH ROW EXECUTE FUNCTION fd_audit_immutable();
        SQL

        RECORD_TYPES.each do |table, record_type|
          connection.execute(<<~SQL)
            DROP TRIGGER IF EXISTS fd_audit_capture ON #{table};
            CREATE TRIGGER fd_audit_capture AFTER INSERT OR UPDATE OR DELETE ON #{table}
              FOR EACH ROW EXECUTE FUNCTION fd_audit_capture(#{connection.quote(record_type)});
          SQL
        end
      end
    end

    def self.uninstall!(connection)
      RECORD_TYPES.each_key do |table|
        connection.execute("DROP TRIGGER IF EXISTS fd_audit_capture ON #{table}")
      end
      connection.execute(<<~SQL)
        DROP TRIGGER IF EXISTS fd_audit_immutable ON audit_events;
        DROP FUNCTION IF EXISTS fd_audit_immutable();
        DROP FUNCTION IF EXISTS fd_audit_capture();
        DROP FUNCTION IF EXISTS fd_audit_redact(jsonb);
      SQL
    end

    # Both trigger capture and legacy imports use this function, including for
    # nested objects and arrays in legacy ledger changes.
    REDACT_SQL = <<~'SQL'.freeze
      CREATE OR REPLACE FUNCTION fd_audit_redact(payload jsonb) RETURNS jsonb
      LANGUAGE sql IMMUTABLE AS $$
        SELECT CASE jsonb_typeof(payload)
          WHEN 'object' THEN (
            SELECT coalesce(jsonb_object_agg(key, fd_audit_redact(value)), '{}')
            FROM jsonb_each(payload)
            WHERE regexp_replace(lower(key), '[^a-z0-9]', '', 'g') !~
              '(token|secret|password|signedurl|receiptkey|clerkid|lastscoremutationdigest|authorization|apikey|distributioncode)'
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

    CAPTURE_SQL = <<~SQL.freeze
      CREATE OR REPLACE FUNCTION fd_audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        old_data jsonb := '{}';
        new_data jsonb := '{}';
        record_data jsonb;
        audit_area text;
        label text;
        subject text;
        campaign_id bigint;
        season_id bigint;
        actor_name text := nullif(current_setting('app.audit_actor_name', true), '');
        actor_email text := nullif(current_setting('app.audit_actor_email', true), '');
        actor_type text := coalesce(nullif(current_setting('app.audit_actor_type', true), ''), 'system');
        actor_label text := coalesce(actor_name, actor_email, initcap(actor_type));
        audit_action text;
        verb text;
        description text;
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          old_data := fd_audit_redact(to_jsonb(OLD));
        END IF;
        IF TG_OP <> 'DELETE' THEN
          new_data := fd_audit_redact(to_jsonb(NEW));
        END IF;
        IF TG_OP = 'UPDATE' AND
          old_data - ARRAY['updated_at', 'lock_version'] = new_data - ARRAY['updated_at', 'lock_version'] THEN
          RETURN NULL;
        END IF;

        record_data := CASE WHEN TG_OP = 'DELETE' THEN old_data ELSE new_data END;
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
          ELSE
            audit_area := 'access';
            label := record_data->>'email';
            IF TG_TABLE_NAME = 'campaign_memberships' THEN
              SELECT email INTO label FROM users WHERE id = (record_data->>'user_id')::bigint;
            END IF;
            label := coalesce(label, TG_ARGV[0] || ' #' || (record_data->>'id'));
            subject := 'access for ' || label;
        END CASE;

        IF season_id IS NULL AND campaign_id IS NOT NULL THEN
          SELECT tournament_id INTO season_id FROM host_campaigns WHERE id = campaign_id;
        END IF;

        INSERT INTO audit_events (
          operation_id, actor_type, actor_id, actor_name, actor_email, actor_role,
          area, action, record_type, record_id, record_label, tournament_id, host_campaign_id,
          summary, before_json, after_json, reason, request_id, http_method, route_path, ip_address
        ) VALUES (
          coalesce(nullif(current_setting('app.audit_operation_id', true), ''), gen_random_uuid()::text),
          actor_type, nullif(current_setting('app.audit_actor_id', true), '')::bigint,
          actor_name, actor_email, nullif(current_setting('app.audit_actor_role', true), ''),
          audit_area, coalesce(nullif(current_setting('app.audit_action_override', true), ''), audit_action),
          TG_ARGV[0], record_data->>'id', label, season_id, campaign_id,
          coalesce(description, format('%s %s %s', actor_label, verb, subject)),
          old_data, new_data,
          fd_audit_redact(to_jsonb(nullif(current_setting('app.audit_reason', true), ''))) #>> '{}',
          nullif(current_setting('app.audit_request_id', true), ''),
          nullif(current_setting('app.audit_http_method', true), ''),
          fd_audit_redact(to_jsonb(nullif(current_setting('app.audit_route_path', true), ''))) #>> '{}',
          nullif(current_setting('app.audit_ip_address', true), '')
        );
        RETURN NULL;
      END;
      $$;
    SQL
  end
end
