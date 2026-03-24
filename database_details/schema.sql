--
-- PostgreSQL database dump
--

\restrict mr9KjPoSbnqRhW7l7bzDpGd4mBc8nsVoT7dspG6BMwX5xu37H8glmUFaRFve9kf

-- Dumped from database version 14.18 (Debian 14.18-1.pgdg120+1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: pg_repack; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_repack WITH SCHEMA public;


--
-- Name: EXTENSION pg_repack; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_repack IS 'Reorganize tables in PostgreSQL databases with minimal locks';


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: tablefunc; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS tablefunc WITH SCHEMA public;


--
-- Name: EXTENSION tablefunc; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION tablefunc IS 'functions that manipulate whole tables, including crosstab';


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS bigint
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('app.tenant_id', true)::bigint;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;


--
-- Name: fn_recompute_continuous_aggregates(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_recompute_continuous_aggregates(p_start_date date, p_end_date date) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_start_month DATE := date_trunc('month', p_start_date);
    v_end_month   DATE := date_trunc('month', p_end_date);
    rows_processed INT;
BEGIN
    RAISE NOTICE 'Starting recomputation from % to %', v_start_month, v_end_month;

    ------------------------------------------------------------------
    -- Disable triggers
    ------------------------------------------------------------------
    RAISE NOTICE 'Disabling triggers on precomputed tables...';
    ALTER TABLE precomputed_door_count_data DISABLE TRIGGER ALL;
    ALTER TABLE precomputed_mains_data DISABLE TRIGGER ALL;
    ALTER TABLE precomputed_temperature_data DISABLE TRIGGER ALL;

    ------------------------------------------------------------------
    -- Clear affected months only
    ------------------------------------------------------------------
    RAISE NOTICE 'Clearing existing aggregates for affected months...';

    DELETE FROM precomputed_door_count_data
     WHERE month BETWEEN v_start_month AND v_end_month;

    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    RAISE NOTICE 'Cleared door count rows: %', rows_processed;

    DELETE FROM precomputed_mains_data
     WHERE month BETWEEN v_start_month AND v_end_month;

    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    RAISE NOTICE 'Cleared mains rows: %', rows_processed;

    DELETE FROM precomputed_temperature_data
     WHERE month BETWEEN v_start_month AND v_end_month;

    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    RAISE NOTICE 'Cleared temperature rows: %', rows_processed;

    ------------------------------------------------------------------
    -- Door count recomputation
    ------------------------------------------------------------------
    RAISE NOTICE 'Recomputing door count aggregates...';

    INSERT INTO precomputed_door_count_data (iot_device_id, door_count, month)
    SELECT
        iot_device_id,
        COUNT(*) AS door_count,
        date_trunc('month', timestamp)::date AS month
    FROM iot_telemetry
    WHERE datasource_id = (
            SELECT id FROM iot_datasources WHERE datasource_key = 'door_switch_state'
          )
      AND value = '1'
      AND timestamp >= p_start_date
      AND timestamp <  p_end_date + INTERVAL '1 day'
    GROUP BY iot_device_id, date_trunc('month', timestamp);

    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    RAISE NOTICE 'Door count rows inserted: %', rows_processed;

    ------------------------------------------------------------------
    -- Mains recomputation
    ------------------------------------------------------------------
    RAISE NOTICE 'Recomputing mains aggregates...';

    INSERT INTO precomputed_mains_data (
        iot_device_id,
        mains_status_count,
        valid_mains_count,
        month
    )
    SELECT
        iot_device_id,
        COUNT(*) AS mains_status_count,
        SUM(CASE WHEN value = '1' THEN 1 ELSE 0 END) AS valid_mains_count,
        date_trunc('month', timestamp)::date AS month
    FROM iot_telemetry
    WHERE datasource_id = (
            SELECT id FROM iot_datasources WHERE datasource_key = 'mains'
          )
      AND timestamp >= p_start_date
      AND timestamp <  p_end_date + INTERVAL '1 day'
    GROUP BY iot_device_id, date_trunc('month', timestamp);

    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    RAISE NOTICE 'Mains rows inserted: %', rows_processed;

    ------------------------------------------------------------------
    -- Temperature recomputation
    ------------------------------------------------------------------
    RAISE NOTICE 'Recomputing temperature aggregates...';

    INSERT INTO precomputed_temperature_data (
        iot_device_id,
        temp_count,
        valid_temp_count,
        month
    )
    SELECT
        iot_device_id,
        COUNT(*) AS temp_count,
        SUM(CASE WHEN value::real < 4 THEN 1 ELSE 0 END) AS valid_temp_count,
        date_trunc('month', timestamp)::date AS month
    FROM iot_telemetry
    WHERE datasource_id = (
            SELECT id FROM iot_datasources WHERE datasource_key = 'cabinet_temperature'
          )
      AND timestamp >= p_start_date
      AND timestamp <  p_end_date + INTERVAL '1 day'
    GROUP BY iot_device_id, date_trunc('month', timestamp);

    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    RAISE NOTICE 'Temperature rows inserted: %', rows_processed;

    ------------------------------------------------------------------
    -- Re-enable triggers
    ------------------------------------------------------------------
    RAISE NOTICE 'Re-enabling triggers...';
    ALTER TABLE precomputed_door_count_data ENABLE TRIGGER ALL;
    ALTER TABLE precomputed_mains_data ENABLE TRIGGER ALL;
    ALTER TABLE precomputed_temperature_data ENABLE TRIGGER ALL;

    RAISE NOTICE 'Recomputation completed successfully.';
END;
$$;


--
-- Name: generate_weekly_warranty_report(timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_weekly_warranty_report(start_date timestamp without time zone, end_date timestamp without time zone) RETURNS TABLE("MAC Address" text, "Serial Number" text, "C Number" text, "District" text, "Maximum voltage" numeric, "Minimum voltage" numeric, "Average voltage" numeric, "Valid voltage count" bigint, "Maximum condenser temperature" numeric, "Minimum condenser temperature" numeric, "Average condenser temperature" numeric, "Valid condenser temperature count" bigint, "Count of condenser temperatures above 52" bigint)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY
    WITH datasource_ids AS (
        SELECT iot_datasources.id,
               iot_datasources.datasource_key
        FROM iot_datasources
        WHERE iot_datasources.datasource_key = ANY (ARRAY['mains_voltage'::text, 'condenser_temperature'::text])
    ),
    voltage_data AS (
        SELECT iot_telemetry.iot_device_id,
               max(iot_telemetry.value::numeric) FILTER (WHERE iot_telemetry.value::numeric <= 600::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS max_voltage,
               min(iot_telemetry.value::numeric) FILTER (WHERE iot_telemetry.value::numeric <= 600::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS min_voltage,
               avg(iot_telemetry.value::numeric) FILTER (WHERE iot_telemetry.value::numeric <= 600::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS avg_voltage,
               count(*) FILTER (WHERE iot_telemetry.value::numeric <= 600::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS valid_voltage_count
        FROM iot_telemetry
        WHERE iot_telemetry.datasource_id = (
            SELECT datasource_ids.id
            FROM datasource_ids
            WHERE datasource_ids.datasource_key = 'mains_voltage'::text
        ) AND iot_telemetry."timestamp" BETWEEN start_date AND end_date
        AND iot_telemetry.value ~ '^\d+(\.\d+)?$'::text
        AND iot_telemetry.value::numeric <> 0::numeric
        GROUP BY iot_telemetry.iot_device_id
    ),
    condenser_temperature_data AS (
        SELECT iot_telemetry.iot_device_id,
               max(iot_telemetry.value::numeric) FILTER (WHERE iot_telemetry.value::numeric <= 326::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS max_condenser_temp,
               min(iot_telemetry.value::numeric) FILTER (WHERE iot_telemetry.value::numeric <= 326::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS min_condenser_temp,
               avg(iot_telemetry.value::numeric) FILTER (WHERE iot_telemetry.value::numeric <= 326::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS avg_condenser_temp,
               count(*) FILTER (WHERE iot_telemetry.value::numeric <= 326::numeric AND iot_telemetry.value::numeric <> 0::numeric) AS valid_condenser_temp_count,
               count(*) FILTER (WHERE iot_telemetry.value::numeric > 52::numeric AND iot_telemetry.value::numeric <> 0::numeric AND iot_telemetry.value::numeric < 326::numeric) AS condenser_temp_above_52_count
        FROM iot_telemetry
        WHERE iot_telemetry.datasource_id = (
            SELECT datasource_ids.id
            FROM datasource_ids
            WHERE datasource_ids.datasource_key = 'condenser_temperature'::text
        ) AND iot_telemetry."timestamp" BETWEEN start_date AND end_date
        AND iot_telemetry.value ~ '^\d+(\.\d+)?$'::text
        AND iot_telemetry.value::numeric <> 0::numeric
        GROUP BY iot_telemetry.iot_device_id
    )
    SELECT device.wi_fi_mac AS "MAC Address",
           device.staycold_serial AS "Serial Number",
           device.signal_hill_c_number AS "C Number",
           device.district AS "District",
           voltage_data.max_voltage AS "Maximum voltage",
           voltage_data.min_voltage AS "Minimum voltage",
           voltage_data.avg_voltage AS "Average voltage",
           voltage_data.valid_voltage_count AS "Valid voltage count",
           condenser_temperature_data.max_condenser_temp AS "Maximum condenser temperature",
           condenser_temperature_data.min_condenser_temp AS "Minimum condenser temperature",
           condenser_temperature_data.avg_condenser_temp AS "Average condenser temperature",
           condenser_temperature_data.valid_condenser_temp_count AS "Valid condenser temperature count",
           condenser_temperature_data.condenser_temp_above_52_count AS "Count of condenser temperatures above 52"
    FROM iot_devices device
    LEFT JOIN voltage_data ON voltage_data.iot_device_id = device.id
    LEFT JOIN condenser_temperature_data ON condenser_temperature_data.iot_device_id = device.id
    WHERE (device.name IS NULL OR "left"(device.name, 3) <> 'DEV'::text)
    AND (device.name IS NULL OR "left"(device.name, 2) <> 'DT'::text);
END;
$_$;


--
-- Name: get_device_counts(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_device_counts(mac_address text) RETURNS TABLE(date date, count_value_datasource_31 integer, count_value_datasource_47 integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(A.date, B.date) AS date,
        A.count_value::INTEGER AS count_value_datasource_31,  -- Cast to INTEGER
        B.count_value::INTEGER AS count_value_datasource_47  -- Cast to INTEGER
    FROM
        (SELECT timestamp::date AS date, COUNT(value) AS count_value
         FROM public.iot_telemetry
         WHERE datasource_id = 31
           AND iot_device_id = (SELECT id FROM iot_devices WHERE wi_fi_mac = mac_address)
         GROUP BY timestamp::date) A
    FULL OUTER JOIN
        (SELECT timestamp::date AS date, COUNT(value) AS count_value
         FROM public.iot_telemetry
         WHERE datasource_id = 47
           AND iot_device_id = (SELECT id FROM iot_devices WHERE wi_fi_mac = mac_address)
         GROUP BY timestamp::date) B
    ON A.date = B.date;
END;
$$;


--
-- Name: get_schema_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_schema_version() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
    DECLARE
        version TEXT;
    BEGIN
        SELECT value INTO version 
        FROM public.schema_metadata 
        WHERE key = 'schema_version';
        
        RETURN version;
    END;
    $$;


--
-- Name: FUNCTION get_schema_version(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_schema_version() IS 'Retrieve current schema version';


--
-- Name: isnumeric(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.isnumeric(text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $_$
DECLARE x NUMERIC;
BEGIN
    x = $1::NUMERIC;
    RETURN TRUE;
EXCEPTION WHEN others THEN
    RETURN FALSE;
END;
$_$;


--
-- Name: refresh_maintenance_report_for_day(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_maintenance_report_for_day(p_day date) RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Ensure bins exist for the 7-day window needed by p_day
      PERFORM public.refresh_telemetry_3h_bins_for_day(p_day);

      WITH pr AS (
        SELECT
          pr.mac_address,
          pr.report_date,
          COALESCE(pr.powered_hours_day, 0) AS powered_hours_day,
          upper(COALESCE(pr.voltage_risk, '')) AS voltage_risk
        FROM public.performance_reports pr
        WHERE pr.report_date = p_day
          AND pr.mac_address IS NOT NULL
          AND pr.mac_address <> ''
      ),
      days AS (
        SELECT generate_series(p_day - 6, p_day, interval '1 day')::date AS day
      ),
      bins_7d AS (
        SELECT b.*
        FROM public.telemetry_3h_bins b
        JOIN pr ON pr.mac_address = b.mac_address
        WHERE b.day BETWEEN (p_day - 6) AND p_day
      ),
      bins_filtered AS (
        SELECT
          mac_address,
          day,
          bin_ts,
          cab_max,
          cab_min,
          LEAST(comp_max, 55)       AS comp_max,
          comp_min,
          LEAST(condenser_temp, 55) AS condenser_temp,
          door_state
        FROM bins_7d
        WHERE cab_max BETWEEN -100 AND 100
          AND cab_min BETWEEN -100 AND 100
          AND comp_max BETWEEN -100 AND 100
          AND comp_min BETWEEN -100 AND 100
          AND condenser_temp BETWEEN -100 AND 100
          AND cab_max IS NOT NULL
          AND cab_min IS NOT NULL
          AND comp_max IS NOT NULL
          AND comp_min IS NOT NULL
          AND condenser_temp IS NOT NULL
      ),
      bins_dedup AS (
        SELECT *
        FROM (
          SELECT
            bf.*,
            lag(comp_min) OVER (PARTITION BY mac_address ORDER BY bin_ts) AS prev_comp_min
          FROM bins_filtered bf
        ) x
        WHERE prev_comp_min IS NULL OR comp_min <> prev_comp_min
      ),
      day_counts AS (
        SELECT
          pr.mac_address,
          d.day,
          COALESCE(c.cnt, 0) AS cnt
        FROM pr
        CROSS JOIN days d
        LEFT JOIN (
          SELECT mac_address, day, count(*) AS cnt
          FROM bins_dedup
          GROUP BY mac_address, day
        ) c
          ON c.mac_address = pr.mac_address
         AND c.day = d.day
      ),
      coverage AS (
        SELECT
          mac_address,
          bool_and(cnt >= 2) AS has_coverage
        FROM day_counts
        GROUP BY mac_address
      ),
      metrics AS (
        SELECT
          mac_address,
          ((comp_max - comp_min) + cab_min) AS diffcon_bin,
          comp_max,
          comp_min,
          condenser_temp,
          ((cab_max + cab_min) / 2.0) AS cab_avg_3h
        FROM bins_dedup
      ),
      trendlines AS (
        SELECT
          mac_address,
          (percentile_cont(0.4) WITHIN GROUP (ORDER BY diffcon_bin)
           + percentile_cont(0.6) WITHIN GROUP (ORDER BY diffcon_bin)) / 2.0 AS trendline_diffcon,
          (percentile_cont(0.4) WITHIN GROUP (ORDER BY comp_max)
           + percentile_cont(0.6) WITHIN GROUP (ORDER BY comp_max)) / 2.0 AS trendline_condmax,
          (percentile_cont(0.4) WITHIN GROUP (ORDER BY comp_min)
           + percentile_cont(0.6) WITHIN GROUP (ORDER BY comp_min)) / 2.0 AS trendline_condmin,
          (percentile_cont(0.4) WITHIN GROUP (ORDER BY condenser_temp)
           + percentile_cont(0.6) WITHIN GROUP (ORDER BY condenser_temp)) / 2.0 AS trendline_condenser_temp,
          (percentile_cont(0.4) WITHIN GROUP (ORDER BY cab_avg_3h)
           + percentile_cont(0.6) WITHIN GROUP (ORDER BY cab_avg_3h)) / 2.0 AS trendline_cab_temp
        FROM metrics
        GROUP BY mac_address
      ),
      avg_cond_day AS (
        SELECT
          mac_address,
          avg(condenser_temp)::double precision AS avg_cond_temp
        FROM bins_dedup
        WHERE day = p_day
        GROUP BY mac_address
      ),
      final_calc AS (
        SELECT
          pr.mac_address,
          pr.report_date,
          pr.powered_hours_day,
          pr.voltage_risk,
          c.has_coverage,
          t.trendline_diffcon,
          t.trendline_condmax,
          t.trendline_condmin,
          (t.trendline_condmax - t.trendline_condmin) AS calculated_diff_con,
          t.trendline_cab_temp AS smoothed_case_temp,
          (t.trendline_condenser_temp - t.trendline_cab_temp) AS temp_gap_trendline_c,
          ac.avg_cond_temp
        FROM pr
        LEFT JOIN coverage c ON c.mac_address = pr.mac_address
        LEFT JOIN trendlines t ON t.mac_address = pr.mac_address
        LEFT JOIN avg_cond_day ac ON ac.mac_address = pr.mac_address
      )
      INSERT INTO public.maintenance_report (
        mac_address,
        report_date,
        diffcon,
        severity,
        trend_cond_max,
        trend_cond_min,
        calculated_diff_con,
        avg_cond_temp,
        smoothed_case_temp,
        updated_at
      )
      SELECT
        f.mac_address,
        f.report_date,
        CASE WHEN f.has_coverage IS TRUE THEN f.trendline_diffcon ELSE NULL END AS diffcon,
        CASE
          WHEN (f.powered_hours_day < 4 OR f.voltage_risk NOT IN ('GREEN', 'OK'))
            THEN 'Power/Voltage Issue'
          WHEN f.has_coverage IS DISTINCT FROM TRUE THEN 'Insufficient Data'
          WHEN f.trendline_diffcon IS NULL THEN 'No Data'
          WHEN f.temp_gap_trendline_c IS NOT NULL AND abs(f.temp_gap_trendline_c) <= 10
            THEN 'Gas Leakage Critical'
          WHEN f.calculated_diff_con IS NOT NULL
            AND f.calculated_diff_con < 10
            AND f.trendline_condmax < 47
            AND f.smoothed_case_temp > 4
            THEN 'Gas Leakage Critical'
          WHEN f.calculated_diff_con IS NOT NULL
            AND f.calculated_diff_con < 10
            AND f.trendline_condmax < 47
            THEN 'Gas Leakage Warning'
          WHEN f.trendline_diffcon > 20 AND f.smoothed_case_temp > 7
            THEN 'Blocked Condenser Critical'
          WHEN f.trendline_diffcon >= 20 AND f.smoothed_case_temp > 4
            THEN 'Blocked Condenser Warning'
          WHEN f.trendline_diffcon < 20 AND f.smoothed_case_temp <= 4
            THEN 'Normal'
          ELSE 'Normal (Not Meeting Temp)'
        END AS severity,
        CASE WHEN f.has_coverage IS TRUE THEN f.trendline_condmax ELSE NULL END AS trend_cond_max,
        CASE WHEN f.has_coverage IS TRUE THEN f.trendline_condmin ELSE NULL END AS trend_cond_min,
        CASE WHEN f.has_coverage IS TRUE THEN f.calculated_diff_con ELSE NULL END AS calculated_diff_con,
        f.avg_cond_temp,
        CASE WHEN f.has_coverage IS TRUE THEN f.smoothed_case_temp ELSE NULL END AS smoothed_case_temp,
        now() AS updated_at
      FROM final_calc f
      ON CONFLICT (mac_address, report_date) DO UPDATE
        SET diffcon             = EXCLUDED.diffcon,
            severity            = EXCLUDED.severity,
            trend_cond_max      = EXCLUDED.trend_cond_max,
            trend_cond_min      = EXCLUDED.trend_cond_min,
            calculated_diff_con = EXCLUDED.calculated_diff_con,
            avg_cond_temp       = EXCLUDED.avg_cond_temp,
            smoothed_case_temp  = EXCLUDED.smoothed_case_temp,
            updated_at          = now();

      -- Keep only the last 7 days in telemetry_3h_bins
      DELETE FROM public.telemetry_3h_bins
      WHERE day < (p_day - 6);
    END;
    $$;


--
-- Name: refresh_telemetry_3h_bins_for_day(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_telemetry_3h_bins_for_day(p_day date) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_start_ts timestamp := (p_day - 6)::timestamp;
      v_end_ts   timestamp := (p_day + 1)::timestamp;
    BEGIN
      WITH macs AS (
        SELECT DISTINCT pr.mac_address
        FROM public.performance_reports pr
        WHERE pr.report_date = p_day
          AND pr.mac_address IS NOT NULL
          AND pr.mac_address <> ''
      ),
      devs AS (
        SELECT m.mac_address, d.id AS iot_device_id
        FROM macs m
        JOIN public.iot_devices d
          ON d.wi_fi_mac = m.mac_address
      ),
      raw AS (
        SELECT
          d.mac_address,
          date_trunc('hour', t."timestamp")
            - make_interval(hours => (extract(hour from t."timestamp")::int % 3)) AS bin_ts,
          (date_trunc('hour', t."timestamp")
            - make_interval(hours => (extract(hour from t."timestamp")::int % 3)))::date AS day,
          t.datasource_id,
          NULLIF(t.value, '')::double precision AS val
        FROM public.iot_telemetry t
        JOIN devs d ON d.iot_device_id = t.iot_device_id
        WHERE t."timestamp" >= v_start_ts
          AND t."timestamp" <  v_end_ts
          AND t.datasource_id IN (80, 81, 83, 84, 33, 48)
      ),
      agg AS (
        SELECT
          mac_address,
          day,
          bin_ts,
          max(val) FILTER (WHERE datasource_id = 80) AS cab_max,
          min(val) FILTER (WHERE datasource_id = 81) AS cab_min,
          max(val) FILTER (WHERE datasource_id = 83) AS comp_max,
          min(val) FILTER (WHERE datasource_id = 84) AS comp_min,
          avg(val) FILTER (WHERE datasource_id = 33) AS condenser_temp,
          CASE
            WHEN max(val) FILTER (WHERE datasource_id = 48) >= 1 THEN 5
            ELSE 0
          END AS door_state
        FROM raw
        GROUP BY mac_address, day, bin_ts
      )
      INSERT INTO public.telemetry_3h_bins (
        mac_address, day, bin_ts,
        cab_max, cab_min, comp_max, comp_min, condenser_temp, door_state,
        updated_at
      )
      SELECT
        mac_address,
        day,
        bin_ts,
        cab_max,
        cab_min,
        LEAST(comp_max, 55)       AS comp_max,
        comp_min,
        LEAST(condenser_temp, 55) AS condenser_temp,
        door_state,
        now()
      FROM agg
      WHERE cab_max BETWEEN -100 AND 100
        AND cab_min BETWEEN -100 AND 100
        AND comp_max BETWEEN -100 AND 100
        AND comp_min BETWEEN -100 AND 100
        AND condenser_temp BETWEEN -100 AND 100
        AND cab_max IS NOT NULL
        AND cab_min IS NOT NULL
        AND comp_max IS NOT NULL
        AND comp_min IS NOT NULL
        AND condenser_temp IS NOT NULL
      ON CONFLICT (mac_address, bin_ts) DO UPDATE
        SET day            = EXCLUDED.day,
            cab_max         = EXCLUDED.cab_max,
            cab_min         = EXCLUDED.cab_min,
            comp_max        = EXCLUDED.comp_max,
            comp_min        = EXCLUDED.comp_min,
            condenser_temp  = EXCLUDED.condenser_temp,
            door_state      = EXCLUDED.door_state,
            updated_at      = now();
    END;
    $$;


--
-- Name: sp_generate_daily_performance_report(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_generate_daily_performance_report(p_report_date date) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
        -- Define variables to force efficient Index Scans
        v_day_start timestamp;
        v_day_end   timestamp;
        v_buf_start timestamp;
    BEGIN
        -- Initialize variables
        v_day_start := p_report_date::timestamp;
        v_day_end   := (p_report_date + INTERVAL '1 day')::timestamp;
        v_buf_start := (p_report_date - INTERVAL '1 day')::timestamp;

        -- 1. Idempotent: Wipe existing rows for this specific report_date
        DELETE FROM public.performance_reports
        WHERE report_date = p_report_date;

        -- 2. Insert New Data
        INSERT INTO public.performance_reports (
            report_date,
            c_code,
            fridge_serial,
            mac_address,
            district,
            last_active_date,
            is_active,
            powered_hours_day,
            powered_pct,
            powered_flag,
            avg_case_temp_c,
            temp_flag,
            door_opens_count,
            voltage_avg_day,
            voltage_risk,
            latitude,
            longitude
        )
        WITH raw_data AS (
            -- SINGLE SCAN: Fetch Raw Data using variables
            -- The Planner sees the variables as constants, allowing a direct Index Scan on "timestamp"
            SELECT
                t.iot_device_id,
                t.datasource_id,
                t."timestamp",
                NULLIF(t.value, '')::numeric AS val
            FROM iot_telemetry t
            WHERE t."timestamp" >= v_buf_start
              AND t."timestamp" <  v_day_end
              AND t.datasource_id IN (32, 40, 48) -- Temp, Volt, Door (GPS Excluded)
        ),

        -- DAILY STATS (Temp, Door, Avg Volt) - TODAY ONLY
        daily_stats AS (
            SELECT
                rd.iot_device_id,
                -- Avg Temp (ID 32)
                AVG(rd.val) FILTER (
                    WHERE rd.datasource_id = 32
                    AND rd."timestamp" >= v_day_start
                    AND rd.val BETWEEN -99 AND 99
                ) AS avg_temp,
                -- Door Count (ID 48)
                SUM(CASE WHEN rd.val = 1 THEN 1 ELSE 0 END) FILTER (
                    WHERE rd.datasource_id = 48
                    AND rd."timestamp" >= v_day_start
                ) AS door_count,
                -- Avg Voltage (ID 40)
                AVG(rd.val) FILTER (
                    WHERE rd.datasource_id = 40
                    AND rd."timestamp" >= v_day_start
                    AND rd.val BETWEEN 1 AND 600
                ) AS avg_voltage
            FROM raw_data rd
            GROUP BY rd.iot_device_id
        ),

        -- POWERED LOGIC (Strict Rules with Stream Method)
        daily_powered AS (
            WITH voltage_stream AS (
                SELECT
                    t.iot_device_id,
                    t."timestamp" AS event_start,
                    t.val AS voltage,
                    -- Look ahead to next timestamp (Default to end of day)
                    LEAD(t."timestamp", 1, v_day_end) OVER (PARTITION BY t.iot_device_id ORDER BY t."timestamp") AS next_event_start,
                    -- Look ahead to next voltage (Crucial for "First Invalid" rule)
                    LEAD(t.val) OVER (PARTITION BY t.iot_device_id ORDER BY t."timestamp") AS next_voltage
                FROM raw_data t
                WHERE t.datasource_id = 40
            )
            SELECT
                vs.iot_device_id,
                SUM(
                    EXTRACT(EPOCH FROM (
                        -- Intersection of Event and Today
                        LEAST(next_event_start, v_day_end) - GREATEST(event_start, v_day_start)
                    )) / 3600.0
                ) AS powered_hours
            FROM voltage_stream vs
            WHERE
              -- 1. Ensure the interval physically overlaps with Today
              vs.event_start < v_day_end
              AND vs.next_event_start > v_day_start

              -- 2. APPLY STRICT LOGIC RULES
              AND (
                  -- Rule A: Standard Interval (Started TODAY)
                  (vs.event_start >= v_day_start AND vs.voltage > 0)

                  OR

                  -- Rule B: Carry-Over Interval (Started YESTERDAY/BEFORE)
                  (
                    vs.event_start < v_day_start
                    -- Must have been ON previously
                    AND vs.voltage > 0
                    -- "if the first voltage point is an invalid voltage point that means it is off"
                    AND vs.next_voltage > 0
                    -- "if there is no voltage point in the current day... powered off"
                    AND vs.next_event_start < v_day_end
                  )
              )
            GROUP BY vs.iot_device_id
        )

        -- FINAL SELECT & INSERT
        SELECT
            p_report_date                                AS report_date,
            d.signal_hill_c_number                       AS c_code,
            d.staycold_serial                            AS fridge_serial,
            d.wi_fi_mac                                  AS mac_address,
            d.district                                   AS district,
            d.last_seen::date                            AS last_active_date,

            -- Is Active Calculation
            (stats.iot_device_id IS NOT NULL OR pwr.iot_device_id IS NOT NULL) AS is_active,

            -- Powered Metrics
            ROUND(COALESCE(pwr.powered_hours, 0), 2)     AS powered_hours_day,
            ROUND(LEAST((COALESCE(pwr.powered_hours, 0) / 24.0) * 100.0, 100), 2) AS powered_pct,

            -- Powered Flag
            CASE
              WHEN (stats.iot_device_id IS NULL AND pwr.iot_device_id IS NULL) THEN 'N/A'
              WHEN COALESCE(pwr.powered_hours, 0) = 0 THEN 'N/A'
              WHEN (COALESCE(pwr.powered_hours, 0) / 24.0) * 100.0 > 95 THEN 'Green'
              WHEN (COALESCE(pwr.powered_hours, 0) / 24.0) * 100.0 >= 80 THEN 'Orange'
              ELSE 'Red'
            END                                          AS powered_flag,

            -- Temp Metrics (Only if Active & Powered > 0)
            CASE WHEN (stats.iot_device_id IS NOT NULL OR pwr.iot_device_id IS NOT NULL) AND COALESCE(pwr.powered_hours, 0) > 0
                 THEN ROUND(stats.avg_temp::numeric, 2)
                 ELSE NULL
            END                                          AS avg_case_temp_c,

            -- Temp Flag
            CASE
              WHEN (stats.iot_device_id IS NULL AND pwr.iot_device_id IS NULL) THEN 'N/A'
              WHEN COALESCE(pwr.powered_hours, 0) = 0 THEN 'N/A'
              WHEN stats.avg_temp <= 4 THEN 'Green'
              WHEN stats.avg_temp IS NULL THEN 'N/A'
              ELSE 'Red'
            END                                          AS temp_flag,

            -- Door Metrics
            CASE WHEN (stats.iot_device_id IS NOT NULL OR pwr.iot_device_id IS NOT NULL) AND COALESCE(pwr.powered_hours, 0) > 0
                 THEN COALESCE(stats.door_count, 0)
                 ELSE NULL
            END                                          AS door_opens_count,

            -- Voltage Metrics
            CASE WHEN (stats.iot_device_id IS NOT NULL OR pwr.iot_device_id IS NOT NULL) AND COALESCE(pwr.powered_hours, 0) > 0
                 THEN ROUND(COALESCE(stats.avg_voltage, 0), 2)
                 ELSE NULL
            END                                          AS voltage_avg_day,

            -- Voltage Risk Flag
            CASE
              WHEN (stats.iot_device_id IS NULL AND pwr.iot_device_id IS NULL) THEN 'N/A'
              WHEN COALESCE(pwr.powered_hours, 0) = 0 THEN 'N/A'
              WHEN ABS(COALESCE(stats.avg_voltage, 0) - 230)/230 >= 0.20 THEN 'High (≥20%)'
              WHEN ABS(COALESCE(stats.avg_voltage, 0) - 230)/230 >= 0.15 THEN 'Medium (≥15%)'
              ELSE 'OK'
            END                                          AS voltage_risk,

            -- GPS (Explicitly NULL)
            NULL                                         AS latitude,
            NULL                                         AS longitude

        FROM iot_devices d
        LEFT JOIN daily_stats stats ON stats.iot_device_id = d.id
        LEFT JOIN daily_powered pwr ON pwr.iot_device_id = d.id
        WHERE d.staycold_serial IS NOT NULL
          AND (d.name IS NULL OR d.name !~* '^(DEV|DT)')
        ORDER BY
            (stats.iot_device_id IS NOT NULL OR pwr.iot_device_id IS NOT NULL) DESC, -- Active first
            stats.avg_temp DESC NULLS LAST,
            d.signal_hill_c_number;

    END;
    $$;


--
-- Name: sp_update_avg_temp_and_flag(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_update_avg_temp_and_flag(p_start_date date, p_end_date date) RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
        -- Safety: if someone swaps the dates, just do nothing
        IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
            RETURN;
        END IF;

        WITH pr_range AS (
            SELECT pr.mac_address, pr.report_date, pr.is_active, pr.powered_hours_day
            FROM public.performance_reports pr
            WHERE pr.report_date BETWEEN p_start_date AND p_end_date
        ),
        temps AS (
            SELECT
                d.wi_fi_mac AS mac_address,
                t."timestamp"::date AS report_date,
                AVG(NULLIF(t.value, '')::numeric) AS avg_temp
            FROM public.iot_telemetry t
            JOIN public.iot_devices d
              ON d.id = t.iot_device_id
            WHERE t.datasource_id = 32
              AND t."timestamp" >= p_start_date::timestamp
              AND t."timestamp" <  (p_end_date::timestamp + INTERVAL '1 day')
              AND NULLIF(t.value, '') IS NOT NULL
              AND (NULLIF(t.value, '')::numeric) BETWEEN -99 AND 99
            GROUP BY
                d.wi_fi_mac,
                t."timestamp"::date
        ),
        base AS (
            SELECT
                pr.mac_address,
                pr.report_date,
                pr.is_active,
                pr.powered_hours_day,
                tm.avg_temp
            FROM pr_range pr
            LEFT JOIN temps tm
              ON tm.mac_address = pr.mac_address
             AND tm.report_date = pr.report_date
        )
        UPDATE public.performance_reports pr
        SET
            avg_case_temp_c = CASE
                WHEN base.is_active AND base.powered_hours_day > 0 THEN base.avg_temp
                ELSE NULL
            END,
            temp_flag = CASE
                WHEN NOT base.is_active OR base.powered_hours_day = 0 THEN 'N/A'
                WHEN base.avg_temp <= 4 THEN 'Green'
                WHEN base.avg_temp IS NULL THEN 'N/A'
                ELSE 'Red'
            END
        FROM base
        WHERE pr.mac_address = base.mac_address
          AND pr.report_date = base.report_date;
    END;
    $$;


--
-- Name: sp_update_gps_coordinates(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_update_gps_coordinates(p_report_date date) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_day_start timestamp;
    v_day_end   timestamp;
BEGIN
    v_day_start := p_report_date::timestamp;
    v_day_end   := (p_report_date + INTERVAL '1 day')::timestamp;

    UPDATE public.performance_reports pr
    SET 
        latitude = final_values.new_lat,
        longitude = final_values.new_lon
    FROM (
        -- 1. CALCULATE NEW GPS (For Powered Units)
        WITH raw_gps AS (
            SELECT
                t.iot_device_id,
                t."timestamp",
                NULLIF(t.value, '')::numeric AS val,
                t.datasource_id
            FROM iot_telemetry t
            WHERE t."timestamp" >= v_day_start
              AND t."timestamp" <  v_day_end
              AND t.datasource_id IN (28, 29)
              -- STRICT RANGE LIMITS ADDED HERE:
              AND (
                  -- Latitude (29) must be -90 to 90
                  (t.datasource_id = 29 AND NULLIF(t.value, '')::numeric BETWEEN -90 AND 90)
                  OR
                  -- Longitude (28) must be -180 to 180
                  (t.datasource_id = 28 AND NULLIF(t.value, '')::numeric BETWEEN -180 AND 180)
              )
        ),
        gps_points AS (
            SELECT
                iot_device_id,
                MAX(CASE WHEN datasource_id = 29 THEN val END) AS lat,
                MAX(CASE WHEN datasource_id = 28 THEN val END) AS lon
            FROM raw_gps
            GROUP BY iot_device_id, "timestamp"
            HAVING MAX(CASE WHEN datasource_id = 29 THEN val END) <> 0 
               AND MAX(CASE WHEN datasource_id = 28 THEN val END) <> 0
        ),
        gps_centers AS (
            SELECT
                *,
                AVG(lat) OVER (PARTITION BY iot_device_id) AS center_lat,
                AVG(lon) OVER (PARTITION BY iot_device_id) AS center_lon
            FROM gps_points
        ),
        today_gps_calc AS (
            SELECT
                iot_device_id,
                AVG(lat) AS calc_lat,
                AVG(lon) AS calc_lon
            FROM gps_centers
            -- Outlier Filter: Drop points > 1km from daily centroid
            WHERE ST_DistanceSphere(
                ST_MakePoint(lon, lat),
                ST_MakePoint(center_lon, center_lat)
            ) <= 1000 
            GROUP BY iot_device_id
        ),

        -- 2. FETCH HISTORY (For Powered Off / Fallback)
        historical_gps AS (
            SELECT DISTINCT ON (mac_address)
                mac_address,
                latitude,
                longitude
            FROM performance_reports
            WHERE report_date < p_report_date
              AND latitude BETWEEN -90 AND 90       -- Ensure history is also valid
              AND longitude BETWEEN -180 AND 180    -- Ensure history is also valid
            ORDER BY mac_address, report_date DESC
        )

        -- 3. DETERMINE FINAL VALUES
        SELECT
            pr.mac_address,
            CASE
                WHEN COALESCE(pr.powered_hours_day, 0) > 0 THEN
                    COALESCE(new_gps.calc_lat, hist_gps.latitude)
                ELSE
                    hist_gps.latitude
            END AS new_lat,
            
            CASE
                WHEN COALESCE(pr.powered_hours_day, 0) > 0 THEN
                    COALESCE(new_gps.calc_lon, hist_gps.longitude)
                ELSE
                    hist_gps.longitude
            END AS new_lon

        FROM performance_reports pr
        LEFT JOIN iot_devices d ON d.wi_fi_mac = pr.mac_address
        LEFT JOIN today_gps_calc new_gps ON new_gps.iot_device_id = d.id
        LEFT JOIN historical_gps hist_gps ON hist_gps.mac_address = pr.mac_address
        WHERE pr.report_date = p_report_date

    ) AS final_values
    
    WHERE pr.report_date = p_report_date
      AND pr.mac_address = final_values.mac_address;

END;
$$;


--
-- Name: trg_update_gps_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_update_gps_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    lat_val numeric;
    lon_val numeric;
    acc_val numeric;
    ts timestamptz;
    alpha numeric := 0.4;  -- EWMA smoothing factor
    prev_ewma_lat numeric;
    prev_ewma_lon numeric;
BEGIN
    -- Only run for GPS datasources
    IF NEW.datasource_id NOT IN (28,29,30) THEN
        RETURN NEW;
    END IF;

    -- Fetch the most recent GPS trio for this device
    SELECT
        MAX(CASE WHEN lv.datasource_id = 29 THEN lv.value::numeric END),
        MAX(CASE WHEN lv.datasource_id = 28 THEN lv.value::numeric END),
        MAX(CASE WHEN lv.datasource_id = 30 THEN lv.value::numeric END),
        MAX(lv.timestamp)
    INTO lat_val, lon_val, acc_val, ts
    FROM latest_values lv
    WHERE lv.iot_device_id = NEW.iot_device_id
      AND lv.datasource_id IN (28,29,30);

    -- Ignore invalid coordinates
    IF lat_val IS NULL OR lon_val IS NULL THEN
        RETURN NEW;
    END IF;

    IF lat_val = 0 OR lon_val = 0 THEN
        RETURN NEW;
    END IF;

    -- Fetch previous EWMA values
    SELECT gh.ewma_lat, gh.ewma_lon
    INTO prev_ewma_lat, prev_ewma_lon
    FROM gps_history gh
    WHERE gh.iot_device_id = NEW.iot_device_id
    ORDER BY gh.timestamp DESC
    LIMIT 1;

    -- Compute new EWMA (smooth location)
    IF prev_ewma_lat IS NULL THEN
        prev_ewma_lat := lat_val;
        prev_ewma_lon := lon_val;
    END IF;

    INSERT INTO public.gps_history (
        iot_device_id,
        timestamp,
        latitude,
        longitude,
        accuracy,
        ewma_lat,
        ewma_lon
    )
    VALUES (
        NEW.iot_device_id,
        ts,
        lat_val,
        lon_val,
        acc_val,
        alpha * lat_val + (1 - alpha) * prev_ewma_lat,
        alpha * lon_val + (1 - alpha) * prev_ewma_lon
    );

    -- Keep only last 10 samples
    DELETE FROM gps_history
    WHERE id IN (
        SELECT id
        FROM gps_history
        WHERE iot_device_id = NEW.iot_device_id
        ORDER BY timestamp DESC
        OFFSET 10
    );

    RETURN NEW;
END;
$$;


--
-- Name: update_door_count_data_monthly(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_door_count_data_monthly() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only increment the door count if the value is '1'
    IF NEW.value = '1' THEN
        IF EXISTS (
            SELECT 1
            FROM precomputed_door_count_data
            WHERE iot_device_id = NEW.iot_device_id
              AND month = date_trunc('month', NEW.timestamp) -- Use message timestamp, not system date
        ) THEN
            UPDATE precomputed_door_count_data
            SET door_count = door_count + 1,
                last_update = NOW()
            WHERE iot_device_id = NEW.iot_device_id
              AND month = date_trunc('month', NEW.timestamp); -- Use message timestamp
        ELSE
            INSERT INTO precomputed_door_count_data (iot_device_id, door_count, month)
            VALUES (NEW.iot_device_id, 1, date_trunc('month', NEW.timestamp)); -- Use message timestamp
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_mains_data_monthly(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mains_data_monthly() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM precomputed_mains_data
        WHERE iot_device_id = NEW.iot_device_id
          AND month = date_trunc('month', NEW.timestamp) -- Use message timestamp
    ) THEN
        UPDATE precomputed_mains_data
        SET mains_status_count = mains_status_count + 1,
            valid_mains_count = valid_mains_count + CASE WHEN NEW.value = '1' THEN 1 ELSE 0 END,
            last_update = NOW()
        WHERE iot_device_id = NEW.iot_device_id
          AND month = date_trunc('month', NEW.timestamp); -- Use message timestamp
    ELSE
        INSERT INTO precomputed_mains_data (iot_device_id, mains_status_count, valid_mains_count, month)
        VALUES (NEW.iot_device_id, 1, CASE WHEN NEW.value = '1' THEN 1 ELSE 0 END, date_trunc('month', NEW.timestamp)); -- Use message timestamp
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_schema_version(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_schema_version(new_version text) RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
        UPDATE public.schema_metadata 
        SET value = new_version, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE key = 'schema_version';
        
        RAISE NOTICE 'Schema version updated to: %', new_version;
    END;
    $$;


--
-- Name: FUNCTION update_schema_version(new_version text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_schema_version(new_version text) IS 'Update schema version in metadata table';


--
-- Name: update_temperature_data_monthly(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_temperature_data_monthly() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM precomputed_temperature_data
        WHERE iot_device_id = NEW.iot_device_id
          AND month = date_trunc('month', NEW.timestamp) -- Use message timestamp
    ) THEN
        UPDATE precomputed_temperature_data
        SET temp_count = temp_count + 1,
            valid_temp_count = valid_temp_count + CASE WHEN NEW.value::real < 4 THEN 1 ELSE 0 END,
            last_update = NOW()
        WHERE iot_device_id = NEW.iot_device_id
          AND month = date_trunc('month', NEW.timestamp); -- Use message timestamp
    ELSE
        INSERT INTO precomputed_temperature_data (iot_device_id, temp_count, valid_temp_count, month)
        VALUES (NEW.iot_device_id, 1, CASE WHEN NEW.value::real < 4 THEN 1 ELSE 0 END, date_trunc('month', NEW.timestamp)); -- Use message timestamp
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: upsert_latest_values(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_latest_values() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
     -- Skip processing if value is NULL to avoid polluting logs
    IF NEW.value IS NULL THEN
        RETURN NEW;
    END IF;
    -- Upsert logic
    INSERT INTO latest_values (iot_device_id, datasource_id, value, timestamp)
    VALUES (NEW.iot_device_id, NEW.datasource_id, NEW.value, NEW.timestamp)
    ON CONFLICT (iot_device_id, datasource_id)
    DO UPDATE
    SET value = EXCLUDED.value,
        timestamp = EXCLUDED.timestamp
    WHERE EXCLUDED.timestamp > latest_values.timestamp; -- Update only if the new timestamp is later

    RETURN NEW;
END;
$$;


--
-- Name: validate_tenant_device_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_tenant_device_ids() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if all device IDs in the array exist in iot_devices table
    IF EXISTS (
        SELECT 1
        FROM unnest(NEW.iot_device_ids) AS device_id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.iot_devices WHERE id = device_id
        )
    ) THEN
        RAISE EXCEPTION 'One or more device IDs in iot_device_ids do not exist in iot_devices table';
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: seq_iot_datasources_id; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_iot_datasources_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: iot_datasources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_datasources (
    id bigint DEFAULT nextval('public.seq_iot_datasources_id'::regclass) NOT NULL,
    datasource_key text NOT NULL,
    display_name text,
    description text,
    modbus_slave_id integer,
    modbus_register_id integer,
    value_shifting_factor double precision,
    value_scaling_factor double precision
);


--
-- Name: seq_iot_devices_id; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_iot_devices_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: iot_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_devices (
    id bigint DEFAULT nextval('public.seq_iot_devices_id'::regclass) NOT NULL,
    name text,
    firmware_version text,
    imei text,
    imsi text,
    apn text,
    wi_fi_mac text,
    create_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen timestamp with time zone,
    iccid text,
    staycold_serial text,
    signal_hill_c_number text,
    sim_provider text,
    in_trade boolean DEFAULT false,
    cell_number text,
    customer_name text,
    district text,
    iot_device_serial text,
    address_1 text,
    address_2 text,
    address_3 text,
    billable boolean,
    staycold_dispatch_date date,
    dt_shipping_date date,
    asset_force_latitude double precision,
    asset_force_longitude double precision
);


--
-- Name: COLUMN iot_devices.iot_device_serial; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.iot_devices.iot_device_serial IS 'The IoT Device''s serial number from the Barcoded sticker on the enclosure';


--
-- Name: latest_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.latest_values (
    iot_device_id bigint NOT NULL,
    datasource_id bigint NOT NULL,
    value text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);


--
-- Name: south_africa_provinces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.south_africa_provinces (
    gid integer NOT NULL,
    shape_leng numeric,
    shape_area numeric,
    name character varying(50),
    adm1_pcode character varying(50),
    adm1_ref character varying(50),
    adm1alt1en character varying(50),
    adm1alt2en character varying(50),
    adm0_en character varying(50),
    adm0_pcode character varying(50),
    date date,
    validon date,
    validto date,
    adm1_id character varying(50),
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: device_location_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.device_location_report AS
 SELECT d.wi_fi_mac,
    d.staycold_serial,
    d.signal_hill_c_number,
    max(
        CASE
            WHEN ((ds.datasource_key = 'latitude'::text) AND (NULLIF(lv.value, ''::text) IS NOT NULL)) THEN (lv.value)::double precision
            ELSE NULL::double precision
        END) AS latitude,
    max(
        CASE
            WHEN ((ds.datasource_key = 'longitude'::text) AND (NULLIF(lv.value, ''::text) IS NOT NULL)) THEN (lv.value)::double precision
            ELSE NULL::double precision
        END) AS longitude,
    max(lv."timestamp") AS last_seen,
    ( SELECT p.name
           FROM public.south_africa_provinces p
          WHERE public.st_within(public.st_setsrid(public.st_makepoint(max(
                CASE
                    WHEN ((ds.datasource_key = 'longitude'::text) AND (NULLIF(lv.value, ''::text) IS NOT NULL)) THEN (lv.value)::double precision
                    ELSE NULL::double precision
                END), max(
                CASE
                    WHEN ((ds.datasource_key = 'latitude'::text) AND (NULLIF(lv.value, ''::text) IS NOT NULL)) THEN (lv.value)::double precision
                    ELSE NULL::double precision
                END)), 4326), p.geom)
         LIMIT 1) AS province
   FROM ((public.latest_values lv
     JOIN public.iot_datasources ds ON ((ds.id = lv.datasource_id)))
     JOIN public.iot_devices d ON ((d.id = lv.iot_device_id)))
  GROUP BY d.wi_fi_mac, d.staycold_serial, d.signal_hill_c_number;


--
-- Name: dispatch_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_reports (
    staycold_serial text,
    iot_serial text
);


--
-- Name: gps_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gps_history (
    id bigint NOT NULL,
    iot_device_id bigint NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    accuracy numeric,
    ewma_lat numeric,
    ewma_lon numeric
);


--
-- Name: gps_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gps_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gps_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gps_history_id_seq OWNED BY public.gps_history.id;


--
-- Name: iot_telemetry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_telemetry (
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    datasource_id bigint NOT NULL,
    iot_device_id bigint NOT NULL,
    value text
);


--
-- Name: iot_device_daily_activity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.iot_device_daily_activity AS
 SELECT DISTINCT t.iot_device_id,
    date_trunc('day'::text, t."timestamp") AS activity_day
   FROM (public.iot_telemetry t
     JOIN public.iot_devices d ON ((t.iot_device_id = d.id)))
  WHERE ((d.name IS NULL) OR ((upper(d.name) !~~ '%DEV%'::text) AND (upper(d.name) !~~ '%DT%'::text)));


--
-- Name: iot_device_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.iot_device_view AS
 WITH battery_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS battery,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'battery'::text)))
        ), latitude_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS latitude,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'latitude'::text))) AND (latest_values.value <> '0'::text))
        ), longitude_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS longitude,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'longitude'::text))) AND (latest_values.value <> '0'::text))
        ), rssi_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS rssi,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'rssi'::text)))
        ), mains_status_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS mains_status,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'mains'::text)))
        ), operator_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS operator,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'operator'::text)))
        ), battery_status_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS battery_status,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'battery-stat'::text)))
        ), modem_temperature_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS modem_temperature,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'modem-temperature'::text)))
        ), spn_data AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS spn,
            latest_values."timestamp"
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'spn'::text)))
        )
 SELECT d.last_seen AS "Last Seen",
    d.wi_fi_mac AS "MAC Address",
    d.name AS "Name",
    d.firmware_version AS "Firmware Version",
    d.iccid AS "ICCID",
    d.imsi AS "IMSI",
    d.imei AS "IMEI",
    d.apn AS "APN",
    rssi_data.rssi AS "RSSI",
    round((battery_data.battery)::numeric, 2) AS "Battery",
    battery_data."timestamp" AS "Battery Timestamp",
    latitude_data.latitude AS "Latitude",
    longitude_data.longitude AS "Longitude",
    longitude_data."timestamp" AS "Location Timestamp",
    mains_status_data.mains_status AS "Mains Status",
    operator_data.operator AS "Operator",
    battery_status_data.battery_status AS "Battery Status",
    modem_temperature_data.modem_temperature AS "Modem Temperature",
    spn_data.spn AS "SPN",
    d.sim_provider AS "SIM Provider",
    d.staycold_serial AS "Staycold Serial",
    d.signal_hill_c_number AS "C Number",
    d.in_trade AS "In Trade",
    d.cell_number AS "Cell Number",
    d.customer_name AS "Customer Name",
    d.dt_shipping_date AS "DT Shipping Date",
    d.staycold_dispatch_date AS "Staycold Dispatch Date"
   FROM (((((((((public.iot_devices d
     LEFT JOIN battery_data ON ((d.id = battery_data.iot_device_id)))
     LEFT JOIN latitude_data ON ((d.id = latitude_data.iot_device_id)))
     LEFT JOIN longitude_data ON ((d.id = longitude_data.iot_device_id)))
     LEFT JOIN rssi_data ON ((d.id = rssi_data.iot_device_id)))
     LEFT JOIN mains_status_data ON ((d.id = mains_status_data.iot_device_id)))
     LEFT JOIN operator_data ON ((d.id = operator_data.iot_device_id)))
     LEFT JOIN battery_status_data ON ((d.id = battery_status_data.iot_device_id)))
     LEFT JOIN modem_temperature_data ON ((d.id = modem_temperature_data.iot_device_id)))
     LEFT JOIN spn_data ON ((d.id = spn_data.iot_device_id)))
  ORDER BY (d.last_seen IS NULL), d.last_seen DESC;


--
-- Name: iot_devices_bak_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.iot_devices_bak_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: iot_devices_bak; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_devices_bak (
    id bigint DEFAULT nextval('public.iot_devices_bak_id_seq'::regclass) NOT NULL,
    name text,
    firmware_version text,
    imei text,
    imsi text,
    apn text,
    wi_fi_mac text,
    create_timestamp timestamp with time zone,
    last_seen timestamp with time zone,
    iccid text,
    staycold_serial text,
    signal_hill_c_number text,
    sim_provider text,
    in_trade boolean,
    cell_number text,
    customer_name text,
    district text,
    iot_device_serial text,
    address_1 text,
    address_2 text,
    address_3 text,
    billable boolean,
    staycold_dispatch_date date,
    dt_shipping_date date
);


--
-- Name: seq_iot_fota_requests_id; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_iot_fota_requests_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: iot_fota_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_fota_requests (
    id bigint DEFAULT nextval('public.seq_iot_fota_requests_id'::regclass) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    iot_device_id bigint NOT NULL,
    old_firmware_version text,
    new_firmware_version text
);


--
-- Name: iot_raw_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_raw_data (
    id bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    mqtt_topic text,
    mqtt_message text
);


--
-- Name: iot_raw_data_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.iot_raw_data ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.iot_raw_data_new_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: maintenance_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_report (
    mac_address text NOT NULL,
    report_date date NOT NULL,
    diffcon double precision,
    severity text,
    trend_cond_max double precision,
    trend_cond_min double precision,
    calculated_diff_con double precision,
    avg_cond_temp double precision,
    smoothed_case_temp double precision,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migration_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_log (
    id bigint NOT NULL,
    migration_name text NOT NULL,
    migration_type text DEFAULT 'up'::text,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    duration_ms bigint,
    executed_by text DEFAULT CURRENT_USER,
    execution_host text,
    environment text,
    status text DEFAULT 'in_progress'::text,
    error_message text,
    notes text,
    CONSTRAINT migration_log_migration_type_check CHECK ((migration_type = ANY (ARRAY['up'::text, 'down'::text]))),
    CONSTRAINT migration_log_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'failed'::text, 'rolled_back'::text])))
);


--
-- Name: TABLE migration_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.migration_log IS 'Audit trail of schema migration deployments';


--
-- Name: COLUMN migration_log.migration_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.migration_log.migration_name IS 'Name of migration file (e.g., 002-add-version-tracking)';


--
-- Name: COLUMN migration_log.migration_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.migration_log.migration_type IS 'Migration direction: up (forward) or down (rollback)';


--
-- Name: COLUMN migration_log.duration_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.migration_log.duration_ms IS 'Migration execution time in milliseconds';


--
-- Name: COLUMN migration_log.execution_host; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.migration_log.execution_host IS 'Hostname/IP where migration was executed';


--
-- Name: COLUMN migration_log.environment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.migration_log.environment IS 'Target environment (local/dev/staging/production)';


--
-- Name: COLUMN migration_log.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.migration_log.status IS 'Migration execution status';


--
-- Name: migration_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migration_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migration_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migration_log_id_seq OWNED BY public.migration_log.id;


--
-- Name: precomputed_door_count_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precomputed_door_count_data (
    iot_device_id bigint NOT NULL,
    door_count integer DEFAULT 0,
    month date DEFAULT date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) NOT NULL,
    last_update timestamp without time zone DEFAULT now()
);


--
-- Name: precomputed_mains_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precomputed_mains_data (
    iot_device_id bigint NOT NULL,
    mains_status_count integer DEFAULT 0,
    valid_mains_count integer DEFAULT 0,
    month date DEFAULT date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) NOT NULL,
    last_update timestamp without time zone DEFAULT now()
);


--
-- Name: precomputed_temperature_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precomputed_temperature_data (
    iot_device_id bigint NOT NULL,
    temp_count integer DEFAULT 0,
    valid_temp_count integer DEFAULT 0,
    month date DEFAULT date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) NOT NULL,
    last_update timestamp without time zone DEFAULT now()
);


--
-- Name: monthly_device_performance_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.monthly_device_performance_report AS
 WITH monthly_temperature AS (
         SELECT precomputed_temperature_data.iot_device_id,
            precomputed_temperature_data.month,
            precomputed_temperature_data.temp_count,
            precomputed_temperature_data.valid_temp_count
           FROM public.precomputed_temperature_data
        ), monthly_mains AS (
         SELECT precomputed_mains_data.iot_device_id,
            precomputed_mains_data.month,
            precomputed_mains_data.mains_status_count,
            precomputed_mains_data.valid_mains_count
           FROM public.precomputed_mains_data
        ), monthly_door_counts AS (
         SELECT precomputed_door_count_data.iot_device_id,
            precomputed_door_count_data.month,
            precomputed_door_count_data.door_count
           FROM public.precomputed_door_count_data
        )
 SELECT device.wi_fi_mac AS "MAC Address",
    device.staycold_serial AS "Fridge Serial Number",
    device.iot_device_serial AS "IOT Barcode",
    device.signal_hill_c_number AS "C Number",
    device.customer_name AS "Customer Name",
    device.district AS "District",
    (date_trunc('month'::text, (temp.month)::timestamp with time zone))::date AS "Report Month",
    temp.temp_count AS "Temperature Readings",
    temp.valid_temp_count AS "Valid Temperature Readings",
    mains.mains_status_count AS "Mains Readings",
    mains.valid_mains_count AS "Valid Mains Readings",
    door_data.door_count AS "Door Count",
        CASE
            WHEN ((temp.temp_count > 0) AND (((temp.valid_temp_count)::real / (NULLIF(temp.temp_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'High'::text
        END AS "Temp Status",
        CASE
            WHEN ((mains.mains_status_count > 0) AND (((mains.valid_mains_count)::real / (NULLIF(mains.mains_status_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'Alarm'::text
        END AS "Mains Status"
   FROM (((public.iot_devices device
     LEFT JOIN monthly_temperature temp ON ((temp.iot_device_id = device.id)))
     LEFT JOIN monthly_mains mains ON ((mains.iot_device_id = device.id)))
     LEFT JOIN monthly_door_counts door_data ON ((door_data.iot_device_id = device.id)))
  WHERE (((device.name IS NULL) OR ("left"(device.name, 3) <> 'DEV'::text)) AND ((device.name IS NULL) OR ("left"(device.name, 2) <> 'DT'::text)))
  ORDER BY ((date_trunc('month'::text, (temp.month)::timestamp with time zone))::date) DESC, device.staycold_serial;


--
-- Name: optimized_iot_data_3; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.optimized_iot_data_3 AS
 WITH datasource_ids AS (
         SELECT iot_datasources.id,
            iot_datasources.datasource_key
           FROM public.iot_datasources
          WHERE (iot_datasources.datasource_key = ANY (ARRAY['cabinet_temperature'::text, 'door_switch_state'::text, 'battery'::text, 'mains'::text, 'accumulated_erc_uptime'::text, 'door_open_counter'::text, 'accumulated_compressor_runtime'::text, 'accumulated_fan_runtime'::text]))
        ), latest_timestamps AS (
         SELECT latest_values.iot_device_id,
            max(latest_values."timestamp") AS max_timestamp
           FROM public.latest_values
          GROUP BY latest_values.iot_device_id
        ), temperature_timestamps AS (
         SELECT latest_values.iot_device_id,
            max(latest_values."timestamp") AS max_temp_timestamp
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'cabinet_temperature'::text))) AND (latest_values.value IS NOT NULL))
          GROUP BY latest_values.iot_device_id
        ), latest_battery AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS last_battery_level
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'battery'::text)))
        ), latest_mains AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS last_mains_status
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'mains'::text)))
        ), online_status AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN (count(*) > 0) THEN 'Online'::text
                    ELSE 'Offline'::text
                END AS fridge_status
           FROM public.latest_values
          WHERE (latest_values."timestamp" >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))
          GROUP BY latest_values.iot_device_id
        ), latest_erc_uptime AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round(((latest_values.value)::real * (100000)::double precision))
                    ELSE (((latest_values.value)::integer * 1000))::double precision
                END AS last_erc_uptime
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_erc_uptime'::text))) AND (latest_values.value IS NOT NULL))
        ), latest_door_count AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round(((latest_values.value)::real * (100)::double precision))
                    ELSE (((latest_values.value)::integer * 100))::double precision
                END AS last_door_count
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'door_open_counter'::text))) AND (latest_values.value IS NOT NULL))
        ), latest_compressor_runtime AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round(((latest_values.value)::real * (100000)::double precision))
                    ELSE (((latest_values.value)::integer * 1000))::double precision
                END AS last_compressor_runtime
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_compressor_runtime'::text))) AND (latest_values.value IS NOT NULL))
        ), latest_fan_runtime AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round(((latest_values.value)::real * (100000)::double precision))
                    ELSE (((latest_values.value)::integer * 1000))::double precision
                END AS last_fan_runtime
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_fan_runtime'::text))) AND (latest_values.value IS NOT NULL))
        )
 SELECT device.wi_fi_mac AS "MAC Address",
    device.staycold_serial AS "Fridge Serial Number",
    device.iot_device_serial AS "IOT Barcode",
    device.signal_hill_c_number AS "C Number",
    device.customer_name AS "Customer Name",
    device.district AS "District",
    device.dt_shipping_date AS "DT Shipping Date",
    (latest_timestamps.max_timestamp)::date AS "Device Last Seen",
    (temperature_timestamps.max_temp_timestamp)::date AS "Last Valid Temperature",
        CASE
            WHEN (temp.temp_count > 0) THEN 'Online'::text
            ELSE 'Offline'::text
        END AS "Fridge Status (By Temperature)",
    online_status.fridge_status AS "Fridge Status",
    door_data.door_count AS "Door Count",
        CASE
            WHEN ((temp.temp_count > 0) AND (((temp.valid_temp_count)::real / (NULLIF(temp.temp_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'High'::text
        END AS "Temp Status",
        CASE
            WHEN ((mains.mains_status_count > 0) AND (((mains.valid_mains_count)::real / (NULLIF(mains.mains_status_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'Alarm'::text
        END AS "Mains Status",
    latest_battery.last_battery_level AS "Last Battery Level",
        CASE
            WHEN (latest_mains.last_mains_status = '1'::text) THEN 'On'::text
            ELSE 'Off'::text
        END AS "Last Mains Status",
    round((latest_erc_uptime.last_erc_uptime / (24.0)::double precision)) AS "ERC Uptime",
    latest_door_count.last_door_count AS "ERC Door Count",
    round((latest_compressor_runtime.last_compressor_runtime / (24.0)::double precision)) AS "ERC Compressor Runtime",
    round((latest_fan_runtime.last_fan_runtime / (24.0)::double precision)) AS "ERC Fan Runtime"
   FROM ((((((((((((public.iot_devices device
     LEFT JOIN latest_timestamps ON ((latest_timestamps.iot_device_id = device.id)))
     LEFT JOIN temperature_timestamps ON ((temperature_timestamps.iot_device_id = device.id)))
     LEFT JOIN public.precomputed_temperature_data temp ON (((temp.iot_device_id = device.id) AND (temp.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN public.precomputed_mains_data mains ON (((mains.iot_device_id = device.id) AND (mains.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN public.precomputed_door_count_data door_data ON (((door_data.iot_device_id = device.id) AND (door_data.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN latest_battery ON ((latest_battery.iot_device_id = device.id)))
     LEFT JOIN latest_mains ON ((latest_mains.iot_device_id = device.id)))
     LEFT JOIN online_status ON ((online_status.iot_device_id = device.id)))
     LEFT JOIN latest_erc_uptime ON ((latest_erc_uptime.iot_device_id = device.id)))
     LEFT JOIN latest_door_count ON ((latest_door_count.iot_device_id = device.id)))
     LEFT JOIN latest_compressor_runtime ON ((latest_compressor_runtime.iot_device_id = device.id)))
     LEFT JOIN latest_fan_runtime ON ((latest_fan_runtime.iot_device_id = device.id)))
  WHERE (((device.name IS NULL) OR ("left"(device.name, 3) <> 'DEV'::text)) AND ((device.name IS NULL) OR ("left"(device.name, 2) <> 'DT'::text)))
  ORDER BY latest_timestamps.max_timestamp DESC NULLS LAST;


--
-- Name: optimized_iot_data_4; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.optimized_iot_data_4 AS
 WITH datasource_ids AS (
         SELECT iot_datasources.id,
            iot_datasources.datasource_key
           FROM public.iot_datasources
          WHERE (iot_datasources.datasource_key = ANY (ARRAY['cabinet_temperature'::text, 'door_switch_state'::text, 'battery'::text, 'mains'::text, 'accumulated_erc_uptime'::text, 'door_open_counter'::text, 'accumulated_compressor_runtime'::text, 'accumulated_fan_runtime'::text]))
        ), latest_timestamps AS (
         SELECT latest_values.iot_device_id,
            max(latest_values."timestamp") AS max_timestamp
           FROM public.latest_values
          GROUP BY latest_values.iot_device_id
        ), temperature_timestamps AS (
         SELECT latest_values.iot_device_id,
            max(latest_values."timestamp") AS max_temp_timestamp
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'cabinet_temperature'::text))) AND (latest_values.value IS NOT NULL))
          GROUP BY latest_values.iot_device_id
        ), latest_battery AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS last_battery_level
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'battery'::text)))
        ), latest_mains AS (
         SELECT latest_values.iot_device_id,
            latest_values.value AS last_mains_status
           FROM public.latest_values
          WHERE (latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'mains'::text)))
        ), online_status AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN (count(*) > 0) THEN 'Online'::text
                    ELSE 'Offline'::text
                END AS fridge_status
           FROM public.latest_values
          WHERE (latest_values."timestamp" >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))
          GROUP BY latest_values.iot_device_id
        ), latest_erc_uptime AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round(((((latest_values.value)::integer + 1))::double precision * (100000)::double precision))
                    ELSE ((((latest_values.value)::integer + 1) * 1000))::double precision
                END AS last_erc_uptime
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_erc_uptime'::text))) AND (latest_values.value IS NOT NULL))
        ), latest_door_count AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round((((latest_values.value)::real + (1)::double precision) * (100)::double precision))
                    ELSE (((latest_values.value)::real + (1)::double precision) * (100)::double precision)
                END AS last_door_count
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'door_open_counter'::text))) AND (latest_values.value IS NOT NULL))
        ), latest_compressor_runtime AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round((((latest_values.value)::real + (1)::double precision) * (100000)::double precision))
                    ELSE (((latest_values.value)::real + (1)::double precision) * (1000)::double precision)
                END AS last_compressor_runtime
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_compressor_runtime'::text))) AND (latest_values.value IS NOT NULL))
        ), latest_fan_runtime AS (
         SELECT latest_values.iot_device_id,
                CASE
                    WHEN ((latest_values.value)::real <> round(((latest_values.value)::real)::double precision)) THEN round((((latest_values.value)::real + (1)::double precision) * (100000)::double precision))
                    ELSE (((latest_values.value)::real + (1)::double precision) * (1000)::double precision)
                END AS last_fan_runtime
           FROM public.latest_values
          WHERE ((latest_values.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_fan_runtime'::text))) AND (latest_values.value IS NOT NULL))
        )
 SELECT device.wi_fi_mac AS "MAC Address",
    device.staycold_serial AS "Fridge Serial Number",
    device.iot_device_serial AS "IOT Barcode",
    device.signal_hill_c_number AS "C Number",
    device.customer_name AS "Customer Name",
    device.district AS "District",
    to_char((device.dt_shipping_date)::timestamp with time zone, 'YYYY-MM-DD'::text) AS "DT Shipping Date",
    to_char(latest_timestamps.max_timestamp, 'YYYY-MM-DD'::text) AS "Device Last Seen",
    to_char(temperature_timestamps.max_temp_timestamp, 'YYYY-MM-DD'::text) AS "Last Valid Temperature",
        CASE
            WHEN (temp.temp_count > 0) THEN 'Online'::text
            ELSE 'Offline'::text
        END AS "Fridge Status (By Temperature)",
    online_status.fridge_status AS "Fridge Status",
    door_data.door_count AS "Door Count",
        CASE
            WHEN ((temp.temp_count > 0) AND (((temp.valid_temp_count)::real / (NULLIF(temp.temp_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'High'::text
        END AS "Temp Status",
        CASE
            WHEN ((mains.mains_status_count > 0) AND (((mains.valid_mains_count)::real / (NULLIF(mains.mains_status_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'Alarm'::text
        END AS "Mains Status",
    latest_battery.last_battery_level AS "Last Battery Level",
        CASE
            WHEN (latest_mains.last_mains_status = '1'::text) THEN 'On'::text
            ELSE 'Off'::text
        END AS "Last Mains Status",
    round((latest_erc_uptime.last_erc_uptime / (24.0)::double precision)) AS "ERC Uptime",
    latest_door_count.last_door_count AS "ERC Door Count",
    round((latest_compressor_runtime.last_compressor_runtime / (24.0)::double precision)) AS "ERC Compressor Runtime",
    round((latest_fan_runtime.last_fan_runtime / (24.0)::double precision)) AS "ERC Fan Runtime"
   FROM ((((((((((((public.iot_devices device
     LEFT JOIN latest_timestamps ON ((latest_timestamps.iot_device_id = device.id)))
     LEFT JOIN temperature_timestamps ON ((temperature_timestamps.iot_device_id = device.id)))
     LEFT JOIN public.precomputed_temperature_data temp ON (((temp.iot_device_id = device.id) AND (temp.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN public.precomputed_mains_data mains ON (((mains.iot_device_id = device.id) AND (mains.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN public.precomputed_door_count_data door_data ON (((door_data.iot_device_id = device.id) AND (door_data.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN latest_battery ON ((latest_battery.iot_device_id = device.id)))
     LEFT JOIN latest_mains ON ((latest_mains.iot_device_id = device.id)))
     LEFT JOIN online_status ON ((online_status.iot_device_id = device.id)))
     LEFT JOIN latest_erc_uptime ON ((latest_erc_uptime.iot_device_id = device.id)))
     LEFT JOIN latest_door_count ON ((latest_door_count.iot_device_id = device.id)))
     LEFT JOIN latest_compressor_runtime ON ((latest_compressor_runtime.iot_device_id = device.id)))
     LEFT JOIN latest_fan_runtime ON ((latest_fan_runtime.iot_device_id = device.id)))
  WHERE (((device.name IS NULL) OR ("left"(device.name, 3) <> 'DEV'::text)) AND ((device.name IS NULL) OR ("left"(device.name, 2) <> 'DT'::text)))
  ORDER BY latest_timestamps.max_timestamp DESC NULLS LAST;


--
-- Name: optimized_iot_data_4_previous_calendar_month; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.optimized_iot_data_4_previous_calendar_month AS
 WITH datasource_ids AS (
         SELECT iot_datasources.id,
            iot_datasources.datasource_key
           FROM public.iot_datasources
          WHERE (iot_datasources.datasource_key = ANY (ARRAY['cabinet_temperature'::text, 'door_switch_state'::text, 'battery'::text, 'mains'::text, 'accumulated_erc_uptime'::text, 'door_open_counter'::text, 'accumulated_compressor_runtime'::text, 'accumulated_fan_runtime'::text]))
        ), latest_timestamps AS (
         SELECT iot_telemetry.iot_device_id,
            max(iot_telemetry."timestamp") AS max_timestamp
           FROM public.iot_telemetry
          WHERE ((iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          GROUP BY iot_telemetry.iot_device_id
        ), temperature_timestamps AS (
         SELECT iot_telemetry.iot_device_id,
            max(iot_telemetry."timestamp") AS max_temp_timestamp
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'cabinet_temperature'::text))) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          GROUP BY iot_telemetry.iot_device_id
        ), latest_battery AS (
         SELECT DISTINCT ON (iot_telemetry.iot_device_id) iot_telemetry.iot_device_id,
            iot_telemetry.value AS last_battery_level
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'battery'::text))) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          ORDER BY iot_telemetry.iot_device_id, iot_telemetry."timestamp" DESC
        ), latest_mains AS (
         SELECT DISTINCT ON (iot_telemetry.iot_device_id) iot_telemetry.iot_device_id,
            iot_telemetry.value AS last_mains_status
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'mains'::text))) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          ORDER BY iot_telemetry.iot_device_id, iot_telemetry."timestamp" DESC
        ), online_status AS (
         SELECT iot_telemetry.iot_device_id,
                CASE
                    WHEN (count(*) > 0) THEN 'Online'::text
                    ELSE 'Offline'::text
                END AS fridge_status
           FROM public.iot_telemetry
          WHERE ((iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          GROUP BY iot_telemetry.iot_device_id
        ), latest_erc_uptime AS (
         SELECT DISTINCT ON (iot_telemetry.iot_device_id) iot_telemetry.iot_device_id,
                CASE
                    WHEN ((iot_telemetry.value)::real <> round(((iot_telemetry.value)::real)::double precision)) THEN round(((((iot_telemetry.value)::integer + 1))::double precision * (100000)::double precision))
                    ELSE ((((iot_telemetry.value)::integer + 1) * 1000))::double precision
                END AS last_erc_uptime
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_erc_uptime'::text))) AND (iot_telemetry.value IS NOT NULL) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          ORDER BY iot_telemetry.iot_device_id, iot_telemetry."timestamp" DESC
        ), latest_door_count AS (
         SELECT DISTINCT ON (iot_telemetry.iot_device_id) iot_telemetry.iot_device_id,
                CASE
                    WHEN ((iot_telemetry.value)::real <> round(((iot_telemetry.value)::real)::double precision)) THEN round((((iot_telemetry.value)::real + (1)::double precision) * (100)::double precision))
                    ELSE (((iot_telemetry.value)::real + (1)::double precision) * (100)::double precision)
                END AS last_door_count
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'door_open_counter'::text))) AND (iot_telemetry.value IS NOT NULL) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          ORDER BY iot_telemetry.iot_device_id, iot_telemetry."timestamp" DESC
        ), latest_compressor_runtime AS (
         SELECT DISTINCT ON (iot_telemetry.iot_device_id) iot_telemetry.iot_device_id,
                CASE
                    WHEN ((iot_telemetry.value)::real <> round(((iot_telemetry.value)::real)::double precision)) THEN round((((iot_telemetry.value)::real + (1)::double precision) * (100000)::double precision))
                    ELSE (((iot_telemetry.value)::real + (1)::double precision) * (1000)::double precision)
                END AS last_compressor_runtime
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_compressor_runtime'::text))) AND (iot_telemetry.value IS NOT NULL) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          ORDER BY iot_telemetry.iot_device_id, iot_telemetry."timestamp" DESC
        ), latest_fan_runtime AS (
         SELECT DISTINCT ON (iot_telemetry.iot_device_id) iot_telemetry.iot_device_id,
                CASE
                    WHEN ((iot_telemetry.value)::real <> round(((iot_telemetry.value)::real)::double precision)) THEN round((((iot_telemetry.value)::real + (1)::double precision) * (100000)::double precision))
                    ELSE (((iot_telemetry.value)::real + (1)::double precision) * (1000)::double precision)
                END AS last_fan_runtime
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT iot_datasources.id
                   FROM public.iot_datasources
                  WHERE (iot_datasources.datasource_key = 'accumulated_fan_runtime'::text))) AND (iot_telemetry.value IS NOT NULL) AND (iot_telemetry."timestamp" >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND (iot_telemetry."timestamp" < date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))
          ORDER BY iot_telemetry.iot_device_id, iot_telemetry."timestamp" DESC
        )
 SELECT device.wi_fi_mac AS "MAC Address",
    device.staycold_serial AS "Fridge Serial Number",
    device.iot_device_serial AS "IOT Barcode",
    device.signal_hill_c_number AS "C Number",
    device.customer_name AS "Customer Name",
    device.district AS "District",
    device.dt_shipping_date AS "DT Shipping Date",
    (latest_timestamps.max_timestamp)::date AS "Device Last Seen",
    (temperature_timestamps.max_temp_timestamp)::date AS "Last Valid Temperature",
        CASE
            WHEN (temp.temp_count > 0) THEN 'Online'::text
            ELSE 'Offline'::text
        END AS "Fridge Status (By Temperature)",
    online_status.fridge_status AS "Fridge Status",
    door_data.door_count AS "Door Count",
        CASE
            WHEN ((temp.temp_count > 0) AND (((temp.valid_temp_count)::real / (NULLIF(temp.temp_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'High'::text
        END AS "Temp Status",
        CASE
            WHEN ((mains.mains_status_count > 0) AND (((mains.valid_mains_count)::real / (NULLIF(mains.mains_status_count, 0))::double precision) > (0.6)::double precision)) THEN 'Normal'::text
            ELSE 'Alarm'::text
        END AS "Mains Status",
    latest_battery.last_battery_level AS "Last Battery Level",
        CASE
            WHEN (latest_mains.last_mains_status = '1'::text) THEN 'On'::text
            ELSE 'Off'::text
        END AS "Last Mains Status",
    round((latest_erc_uptime.last_erc_uptime / (24.0)::double precision)) AS "ERC Uptime",
    latest_door_count.last_door_count AS "ERC Door Count",
    round((latest_compressor_runtime.last_compressor_runtime / (24.0)::double precision)) AS "ERC Compressor Runtime",
    round((latest_fan_runtime.last_fan_runtime / (24.0)::double precision)) AS "ERC Fan Runtime"
   FROM ((((((((((((public.iot_devices device
     LEFT JOIN latest_timestamps ON ((latest_timestamps.iot_device_id = device.id)))
     LEFT JOIN temperature_timestamps ON ((temperature_timestamps.iot_device_id = device.id)))
     LEFT JOIN public.precomputed_temperature_data temp ON (((temp.iot_device_id = device.id) AND (temp.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN public.precomputed_mains_data mains ON (((mains.iot_device_id = device.id) AND (mains.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN public.precomputed_door_count_data door_data ON (((door_data.iot_device_id = device.id) AND (door_data.month = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN latest_battery ON ((latest_battery.iot_device_id = device.id)))
     LEFT JOIN latest_mains ON ((latest_mains.iot_device_id = device.id)))
     LEFT JOIN online_status ON ((online_status.iot_device_id = device.id)))
     LEFT JOIN latest_erc_uptime ON ((latest_erc_uptime.iot_device_id = device.id)))
     LEFT JOIN latest_door_count ON ((latest_door_count.iot_device_id = device.id)))
     LEFT JOIN latest_compressor_runtime ON ((latest_compressor_runtime.iot_device_id = device.id)))
     LEFT JOIN latest_fan_runtime ON ((latest_fan_runtime.iot_device_id = device.id)))
  WHERE (((device.name IS NULL) OR ("left"(device.name, 3) <> 'DEV'::text)) AND ((device.name IS NULL) OR ("left"(device.name, 2) <> 'DT'::text)))
  ORDER BY latest_timestamps.max_timestamp DESC NULLS LAST;


--
-- Name: performance_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_reports (
    report_date date NOT NULL,
    c_code text,
    fridge_serial text NOT NULL,
    mac_address text,
    district text,
    powered_pct numeric(5,2),
    powered_flag text,
    avg_case_temp_c numeric(5,2),
    temp_flag text,
    door_opens_count integer,
    voltage_risk text,
    last_active_date date,
    is_active boolean,
    powered_hours_day numeric(6,2),
    voltage_avg_day numeric(7,2),
    latitude numeric,
    longitude numeric
);


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: schema_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_metadata (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by text DEFAULT CURRENT_USER
);


--
-- Name: TABLE schema_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.schema_metadata IS 'Schema version and configuration metadata';


--
-- Name: COLUMN schema_metadata.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.schema_metadata.key IS 'Metadata key (e.g., schema_version, baseline_date)';


--
-- Name: COLUMN schema_metadata.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.schema_metadata.value IS 'Metadata value';


--
-- Name: COLUMN schema_metadata.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.schema_metadata.description IS 'Human-readable description of this metadata';


--
-- Name: COLUMN schema_metadata.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.schema_metadata.updated_at IS 'Last update timestamp';


--
-- Name: COLUMN schema_metadata.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.schema_metadata.updated_by IS 'Database user who last updated this value';


--
-- Name: schema_info; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.schema_info AS
 SELECT schema_metadata.key,
    schema_metadata.value,
    schema_metadata.description,
    schema_metadata.updated_at,
    schema_metadata.updated_by
   FROM public.schema_metadata
  ORDER BY
        CASE schema_metadata.key
            WHEN 'schema_version'::text THEN 1
            WHEN 'baseline_date'::text THEN 2
            WHEN 'managed_by'::text THEN 3
            ELSE 99
        END, schema_metadata.key;


--
-- Name: VIEW schema_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.schema_info IS 'Summary of schema metadata and configuration';


--
-- Name: seq_iot_raw_message_id; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_iot_raw_message_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_iot_telemetry_id; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_iot_telemetry_id
    START WITH 1
    INCREMENT BY 1
    MINVALUE -2147483648
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_tenants_id; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_tenants_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: south_africa_provinces_gid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.south_africa_provinces_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: south_africa_provinces_gid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.south_africa_provinces_gid_seq OWNED BY public.south_africa_provinces.gid;


--
-- Name: telemetry_3h_bins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetry_3h_bins (
    mac_address text NOT NULL,
    day date NOT NULL,
    bin_ts timestamp without time zone NOT NULL,
    cab_max double precision,
    cab_min double precision,
    comp_max double precision,
    comp_min double precision,
    condenser_temp double precision,
    door_state integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id bigint DEFAULT nextval('public.seq_tenants_id'::regclass) NOT NULL,
    name text NOT NULL,
    description text,
    iot_device_ids bigint[] DEFAULT ARRAY[]::bigint[],
    active boolean DEFAULT true,
    create_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN tenants.iot_device_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.iot_device_ids IS 'Array of IoT device IDs associated with this tenant';


--
-- Name: view_precomputed_door_count; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_precomputed_door_count AS
 WITH device_info AS (
         SELECT iot_devices.id AS iot_device_id,
            iot_devices.iccid,
            iot_devices.wi_fi_mac AS mac_address,
            iot_devices.staycold_serial AS fridge_serial_number
           FROM public.iot_devices
        ), pivot_data AS (
         SELECT d.iccid,
            d.mac_address,
            d.fridge_serial_number,
            to_char((p.month)::timestamp with time zone, 'YYYY-MM'::text) AS month,
            p.door_count
           FROM (public.precomputed_door_count_data p
             JOIN device_info d ON ((p.iot_device_id = d.iot_device_id)))
        )
 SELECT ct.iccid,
    ct.mac_address,
    ct.fridge_serial_number,
    ct."2023-03",
    ct."2023-06",
    ct."2023-07",
    ct."2023-10",
    ct."2023-11",
    ct."2023-12",
    ct."2024-01",
    ct."2024-02",
    ct."2024-03",
    ct."2024-04",
    ct."2024-05",
    ct."2024-06",
    ct."2024-07",
    ct."2024-08",
    ct."2024-09",
    ct."2024-10",
    ct."2024-11",
    ct."2024-12",
    ct."2025-01",
    ct."2025-02",
    ct."2025-03"
   FROM public.crosstab('SELECT iccid, mac_address, fridge_serial_number, month, door_count 
              FROM pivot_data 
              ORDER BY iccid, mac_address, fridge_serial_number, month'::text, 'SELECT DISTINCT TO_CHAR(month, ''YYYY-MM'') FROM public.precomputed_door_count_data ORDER BY month'::text) ct(iccid text, mac_address text, fridge_serial_number text, "2023-03" integer, "2023-06" integer, "2023-07" integer, "2023-10" integer, "2023-11" integer, "2023-12" integer, "2024-01" integer, "2024-02" integer, "2024-03" integer, "2024-04" integer, "2024-05" integer, "2024-06" integer, "2024-07" integer, "2024-08" integer, "2024-09" integer, "2024-10" integer, "2024-11" integer, "2024-12" integer, "2025-01" integer, "2025-02" integer, "2025-03" integer);


--
-- Name: vw_online_device_history; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.vw_online_device_history AS
 WITH date_series AS (
         SELECT (generate_series((CURRENT_DATE - '180 days'::interval), (CURRENT_DATE)::timestamp without time zone, '1 day'::interval))::date AS date
        ), device_activity AS (
         SELECT iot_telemetry.iot_device_id,
            date_trunc('day'::text, iot_telemetry."timestamp") AS activity_date
           FROM public.iot_telemetry
          WHERE (iot_telemetry.iot_device_id IN ( SELECT iot_devices.id
                   FROM public.iot_devices
                  WHERE ((iot_devices.last_seen IS NOT NULL) AND ((iot_devices.name IS NULL) OR ("left"(iot_devices.name, 3) <> 'DEV'::text)) AND ((iot_devices.name IS NULL) OR ("left"(iot_devices.name, 2) <> 'DT'::text)))))
          GROUP BY iot_telemetry.iot_device_id, (date_trunc('day'::text, iot_telemetry."timestamp"))
        ), online_devices AS (
         SELECT ds.date,
            count(DISTINCT da.iot_device_id) AS online_device_count
           FROM (date_series ds
             LEFT JOIN device_activity da ON ((ds.date = da.activity_date)))
          GROUP BY ds.date
        ), offline_tracking AS (
         SELECT eligible_devices.iot_device_id,
            ds.date,
                CASE
                    WHEN (ds.date = CURRENT_DATE) THEN
                    CASE
                        WHEN (max(da.activity_date) = CURRENT_DATE) THEN (0)::numeric
                        ELSE EXTRACT(day FROM ((CURRENT_DATE)::timestamp with time zone - max(da.activity_date)))
                    END
                    ELSE EXTRACT(day FROM ((ds.date)::timestamp with time zone - max(da.activity_date)))
                END AS days_offline
           FROM ((date_series ds
             CROSS JOIN ( SELECT DISTINCT iot_devices.id AS iot_device_id
                   FROM public.iot_devices
                  WHERE ((iot_devices.last_seen IS NOT NULL) AND ((iot_devices.name IS NULL) OR ("left"(iot_devices.name, 3) <> 'DEV'::text)) AND ((iot_devices.name IS NULL) OR ("left"(iot_devices.name, 2) <> 'DT'::text)))) eligible_devices)
             LEFT JOIN device_activity da ON ((eligible_devices.iot_device_id = da.iot_device_id)))
          GROUP BY eligible_devices.iot_device_id, ds.date
        ), offline_counts AS (
         SELECT offline_tracking.date,
            count(NULLIF((offline_tracking.days_offline = (1)::numeric), false)) AS offline_1_day,
            count(NULLIF((offline_tracking.days_offline = (2)::numeric), false)) AS offline_2_days,
            count(NULLIF((offline_tracking.days_offline = (3)::numeric), false)) AS offline_3_days,
            count(NULLIF((offline_tracking.days_offline = (4)::numeric), false)) AS offline_4_days,
            count(NULLIF((offline_tracking.days_offline >= (5)::numeric), false)) AS offline_5_plus_days
           FROM offline_tracking
          GROUP BY offline_tracking.date
        )
 SELECT od.date,
    od.online_device_count AS "Online",
    oc.offline_1_day AS "Offline 1 Day",
    oc.offline_2_days AS "Offline 2 Day",
    oc.offline_3_days AS "Offline 3 Day",
    oc.offline_4_days AS "Offline 4 Day",
    oc.offline_5_plus_days AS "Offline 5+ Day"
   FROM (online_devices od
     JOIN offline_counts oc ON ((od.date = oc.date)))
  ORDER BY od.date
  WITH NO DATA;


--
-- Name: warranty_report_ytd; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.warranty_report_ytd AS
 WITH datasource_ids AS (
         SELECT iot_datasources.id,
            iot_datasources.datasource_key
           FROM public.iot_datasources
          WHERE (iot_datasources.datasource_key = ANY (ARRAY['mains_voltage'::text, 'condenser_temperature'::text]))
        ), voltage_data AS (
         SELECT iot_telemetry.iot_device_id,
            max((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS max_voltage,
            min((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS min_voltage,
            avg((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS avg_voltage,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS valid_voltage_count
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT datasource_ids.id
                   FROM datasource_ids
                  WHERE (datasource_ids.datasource_key = 'mains_voltage'::text))) AND (iot_telemetry."timestamp" >= '2024-01-01 00:00:00+00'::timestamp with time zone) AND (iot_telemetry.value ~ '^\d+(\.\d+)?$'::text) AND ((iot_telemetry.value)::numeric <> (0)::numeric))
          GROUP BY iot_telemetry.iot_device_id
        ), condenser_temperature_data AS (
         SELECT iot_telemetry.iot_device_id,
            max((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS max_condenser_temp,
            min((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS min_condenser_temp,
            avg((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS avg_condenser_temp,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS valid_condenser_temp_count,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric > (52)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric) AND ((iot_telemetry.value)::numeric < (326)::numeric))) AS condenser_temp_above_52_count
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT datasource_ids.id
                   FROM datasource_ids
                  WHERE (datasource_ids.datasource_key = 'condenser_temperature'::text))) AND (iot_telemetry."timestamp" >= '2024-01-01 00:00:00+00'::timestamp with time zone) AND (iot_telemetry.value ~ '^\d+(\.\d+)?$'::text) AND ((iot_telemetry.value)::numeric <> (0)::numeric))
          GROUP BY iot_telemetry.iot_device_id
        )
 SELECT device.wi_fi_mac AS "MAC Address",
    device.staycold_serial AS "Serial Number",
    device.signal_hill_c_number AS "C Number",
    device.district AS "District",
    voltage_data.max_voltage AS "Maximum voltage",
    voltage_data.min_voltage AS "Minimum voltage",
    voltage_data.avg_voltage AS "Average voltage",
    voltage_data.valid_voltage_count AS "Valid voltage count",
    condenser_temperature_data.max_condenser_temp AS "Maximum condenser temperature",
    condenser_temperature_data.min_condenser_temp AS "Minimum condenser temperature",
    condenser_temperature_data.avg_condenser_temp AS "Average condenser temperature",
    condenser_temperature_data.valid_condenser_temp_count AS "Valid condenser temperature count",
    condenser_temperature_data.condenser_temp_above_52_count AS "Count of condenser temperatures above 52"
   FROM ((public.iot_devices device
     LEFT JOIN voltage_data ON ((voltage_data.iot_device_id = device.id)))
     LEFT JOIN condenser_temperature_data ON ((condenser_temperature_data.iot_device_id = device.id)))
  WHERE (((device.name IS NULL) OR ("left"(device.name, 3) <> 'DEV'::text)) AND ((device.name IS NULL) OR ("left"(device.name, 2) <> 'DT'::text)))
  WITH NO DATA;


--
-- Name: weekly_warranty_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.weekly_warranty_report AS
 WITH datasource_ids AS (
         SELECT iot_datasources.id,
            iot_datasources.datasource_key
           FROM public.iot_datasources
          WHERE (iot_datasources.datasource_key = ANY (ARRAY['mains_voltage'::text, 'condenser_temperature'::text]))
        ), voltage_data AS (
         SELECT iot_telemetry.iot_device_id,
            max((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS max_voltage,
            min((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS min_voltage,
            avg((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS avg_voltage,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS valid_voltage_count
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT datasource_ids.id
                   FROM datasource_ids
                  WHERE (datasource_ids.datasource_key = 'mains_voltage'::text))) AND (iot_telemetry."timestamp" >= (now() - '7 days'::interval)) AND (iot_telemetry.value ~ '^\d+(\.\d+)?$'::text) AND ((iot_telemetry.value)::numeric <> (0)::numeric))
          GROUP BY iot_telemetry.iot_device_id
        ), condenser_temperature_data AS (
         SELECT iot_telemetry.iot_device_id,
            max((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS max_condenser_temp,
            min((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS min_condenser_temp,
            avg((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS avg_condenser_temp,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric <= (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS valid_condenser_temp_count,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric > (52)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric) AND ((iot_telemetry.value)::numeric < (326)::numeric))) AS condenser_temp_above_52_count
           FROM public.iot_telemetry
          WHERE ((iot_telemetry.datasource_id = ( SELECT datasource_ids.id
                   FROM datasource_ids
                  WHERE (datasource_ids.datasource_key = 'condenser_temperature'::text))) AND (iot_telemetry."timestamp" >= (now() - '7 days'::interval)) AND (iot_telemetry.value ~ '^\d+(\.\d+)?$'::text) AND ((iot_telemetry.value)::numeric <> (0)::numeric))
          GROUP BY iot_telemetry.iot_device_id
        )
 SELECT device.wi_fi_mac AS "MAC Address",
    device.staycold_serial AS "Serial Number",
    device.signal_hill_c_number AS "C Number",
    device.district AS "District",
    voltage_data.max_voltage AS "Maximum voltage",
    voltage_data.min_voltage AS "Minimum voltage",
    voltage_data.avg_voltage AS "Average voltage",
    voltage_data.valid_voltage_count AS "Valid voltage count",
    condenser_temperature_data.max_condenser_temp AS "Maximum condenser temperature",
    condenser_temperature_data.min_condenser_temp AS "Minimum condenser temperature",
    condenser_temperature_data.avg_condenser_temp AS "Average condenser temperature",
    condenser_temperature_data.valid_condenser_temp_count AS "Valid condenser temperature count",
    condenser_temperature_data.condenser_temp_above_52_count AS "Count of condenser temperatures above 52"
   FROM ((public.iot_devices device
     LEFT JOIN voltage_data ON ((voltage_data.iot_device_id = device.id)))
     LEFT JOIN condenser_temperature_data ON ((condenser_temperature_data.iot_device_id = device.id)))
  WHERE (((device.name IS NULL) OR ("left"(device.name, 3) <> 'DEV'::text)) AND ((device.name IS NULL) OR ("left"(device.name, 2) <> 'DT'::text)));


--
-- Name: weekly_warranty_report_v2; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.weekly_warranty_report_v2 AS
 WITH datasource_ids AS (
         SELECT iot_datasources.id,
            iot_datasources.datasource_key
           FROM public.iot_datasources
          WHERE (iot_datasources.datasource_key = ANY (ARRAY['mains_voltage'::text, 'condenser_temperature'::text]))
        ), voltage_data AS (
         SELECT iot_telemetry.iot_device_id,
            max((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS max_voltage,
            min((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS min_voltage,
            avg((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS avg_voltage,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric <= (600)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS valid_voltage_count
           FROM public.iot_telemetry
          WHERE (iot_telemetry.datasource_id = ( SELECT datasource_ids.id
                   FROM datasource_ids
                  WHERE (datasource_ids.datasource_key = 'mains_voltage'::text)))
          GROUP BY iot_telemetry.iot_device_id
        ), condenser_temperature_data AS (
         SELECT iot_telemetry.iot_device_id,
            max((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric < (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS max_condenser_temp,
            min((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric < (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS min_condenser_temp,
            avg((iot_telemetry.value)::numeric) FILTER (WHERE (((iot_telemetry.value)::numeric < (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS avg_condenser_temp,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric < (326)::numeric) AND ((iot_telemetry.value)::numeric <> (0)::numeric))) AS valid_condenser_temp_count,
            count(*) FILTER (WHERE (((iot_telemetry.value)::numeric >= (273)::numeric) AND ((iot_telemetry.value)::numeric < (326)::numeric))) AS condenser_temp_above_52_count
           FROM public.iot_telemetry
          WHERE (iot_telemetry.datasource_id = ( SELECT datasource_ids.id
                   FROM datasource_ids
                  WHERE (datasource_ids.datasource_key = 'condenser_temperature'::text)))
          GROUP BY iot_telemetry.iot_device_id
        ), base AS (
         SELECT d.wi_fi_mac AS "MAC Address",
            d.staycold_serial AS "Serial Number",
            d.signal_hill_c_number AS "C Number",
            d.district AS "District",
            vd.max_voltage AS "Maximum voltage",
            vd.min_voltage AS "Minimum voltage",
            vd.avg_voltage AS "Average voltage",
            vd.valid_voltage_count AS "Valid voltage count",
            ctd.max_condenser_temp AS "Maximum condenser temperature",
            ctd.min_condenser_temp AS "Minimum condenser temperature",
            ctd.avg_condenser_temp AS "Average condenser temperature",
            ctd.valid_condenser_temp_count AS "Valid condenser temperature count",
            ctd.condenser_temp_above_52_count AS "Count of condenser temperatures above 52",
            vd.iot_device_id,
            vd.max_voltage,
            vd.min_voltage,
            vd.avg_voltage,
            vd.valid_voltage_count,
            ctd.iot_device_id,
            ctd.max_condenser_temp,
            ctd.min_condenser_temp,
            ctd.avg_condenser_temp,
            ctd.valid_condenser_temp_count,
            ctd.condenser_temp_above_52_count
           FROM ((public.iot_devices d
             LEFT JOIN voltage_data vd ON ((vd.iot_device_id = d.id)))
             LEFT JOIN condenser_temperature_data ctd ON ((ctd.iot_device_id = d.id)))
          WHERE ((d.name IS NULL) OR ("left"(d.name, 3) <> 'DEV'::text) OR ("left"(d.name, 2) <> 'DT'::text))
        )
 SELECT s."MAC Address",
    s."Serial Number",
    s."C Number",
    s."District",
    s."Maximum voltage",
    s."Minimum voltage",
    s."Average voltage",
    s."Valid voltage count",
    s."Maximum condenser temperature",
    s."Minimum condenser temperature",
    s."Average condenser temperature",
    s."Valid condenser temperature count",
    s."Count of condenser temperatures above 52",
    s.max_v,
    s.min_v,
    s.avg_v,
    s.max_ct,
    s.avg_ct,
    s.v_cnt,
    s.ct_cnt,
    s.ct_above_52_cnt,
    ((((((((((
        CASE
            WHEN (s.max_v > (252)::numeric) THEN 4
            WHEN (s.max_v > (235)::numeric) THEN 2
            ELSE 0
        END +
        CASE
            WHEN (s.min_v < (185)::numeric) THEN 5
            WHEN (s.min_v < (190)::numeric) THEN 4
            WHEN (s.min_v < (200)::numeric) THEN 3
            WHEN (s.min_v < (215)::numeric) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (s.avg_v < (185)::numeric) THEN 5
            WHEN (s.avg_v < (190)::numeric) THEN 4
            WHEN (s.avg_v < (200)::numeric) THEN 3
            WHEN (s.avg_v < (215)::numeric) THEN 1
            WHEN (s.avg_v > (252)::numeric) THEN 4
            WHEN (s.avg_v > (235)::numeric) THEN 2
            ELSE 0
        END) +
        CASE
            WHEN (s.max_ct < (45)::numeric) THEN 0
            WHEN (s.max_ct < (50)::numeric) THEN 2
            WHEN (s.max_ct > (55)::numeric) THEN 5
            WHEN (s.max_ct > (52)::numeric) THEN 4
            ELSE 3
        END) +
        CASE
            WHEN (s.avg_ct < (45)::numeric) THEN 0
            WHEN (s.avg_ct < (50)::numeric) THEN 2
            WHEN (s.avg_ct > (55)::numeric) THEN 5
            WHEN (s.avg_ct > (52)::numeric) THEN 4
            ELSE 0
        END) + (3 -
        CASE
            WHEN ((((s.ct_cnt + s.v_cnt))::numeric / 2.0) < (100)::numeric) THEN 2
            WHEN ((((s.ct_cnt + s.v_cnt))::numeric / 2.0) < (400)::numeric) THEN 1
            ELSE 3
        END)) +
        CASE
            WHEN (s.ct_above_52_cnt = 0) THEN 0
            WHEN (s.ct_cnt = 0) THEN 0
            WHEN (((s.ct_above_52_cnt)::numeric / (s.ct_cnt)::numeric) < 0.25) THEN 2
            WHEN (((s.ct_above_52_cnt)::numeric / (s.ct_cnt)::numeric) < 0.50) THEN 3
            ELSE 5
        END) *
        CASE
            WHEN ((((s.ct_cnt + s.v_cnt))::numeric / 2.0) < (100)::numeric) THEN 2
            WHEN ((((s.ct_cnt + s.v_cnt))::numeric / 2.0) < (400)::numeric) THEN 1
            ELSE 3
        END))::numeric / (29.0 * (3)::numeric)) * (100)::numeric) AS "Risk Score",
    (((((((
        CASE
            WHEN (s.max_v > (252)::numeric) THEN 4
            WHEN (s.max_v > (235)::numeric) THEN 2
            ELSE 0
        END +
        CASE
            WHEN (s.min_v < (185)::numeric) THEN 5
            WHEN (s.min_v < (190)::numeric) THEN 4
            WHEN (s.min_v < (200)::numeric) THEN 3
            WHEN (s.min_v < (215)::numeric) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (s.avg_v < (185)::numeric) THEN 5
            WHEN (s.avg_v < (190)::numeric) THEN 4
            WHEN (s.avg_v < (200)::numeric) THEN 3
            WHEN (s.avg_v < (215)::numeric) THEN 1
            WHEN (s.avg_v > (252)::numeric) THEN 4
            WHEN (s.avg_v > (235)::numeric) THEN 2
            ELSE 0
        END) + (3 -
        CASE
            WHEN (s.v_cnt < 100) THEN 2
            WHEN (s.v_cnt < 400) THEN 1
            ELSE 3
        END)) *
        CASE
            WHEN (s.v_cnt < 100) THEN 2
            WHEN (s.v_cnt < 400) THEN 1
            ELSE 3
        END))::numeric / (14.0 * (3)::numeric)) * (100)::numeric) AS "Voltage Risk",
    (((((((
        CASE
            WHEN (s.max_ct < (45)::numeric) THEN 0
            WHEN (s.max_ct < (50)::numeric) THEN 2
            WHEN (s.max_ct > (55)::numeric) THEN 5
            WHEN (s.max_ct > (52)::numeric) THEN 4
            ELSE 3
        END +
        CASE
            WHEN (s.avg_ct < (45)::numeric) THEN 0
            WHEN (s.avg_ct < (50)::numeric) THEN 2
            WHEN (s.avg_ct > (55)::numeric) THEN 5
            WHEN (s.avg_ct > (52)::numeric) THEN 4
            ELSE 0
        END) + (3 -
        CASE
            WHEN (s.ct_cnt < 100) THEN 2
            WHEN (s.ct_cnt < 400) THEN 1
            ELSE 3
        END)) +
        CASE
            WHEN (s.ct_above_52_cnt = 0) THEN 0
            WHEN (s.ct_cnt = 0) THEN 0
            WHEN (((s.ct_above_52_cnt)::numeric / (s.ct_cnt)::numeric) < 0.25) THEN 2
            WHEN (((s.ct_above_52_cnt)::numeric / (s.ct_cnt)::numeric) < 0.50) THEN 3
            ELSE 5
        END) *
        CASE
            WHEN (s.ct_cnt < 100) THEN 2
            WHEN (s.ct_cnt < 400) THEN 1
            ELSE 3
        END))::numeric / (15.0 * (3)::numeric)) * (100)::numeric) AS "Condenser Risk"
   FROM ( SELECT base."MAC Address",
            base."Serial Number",
            base."C Number",
            base."District",
            base."Maximum voltage",
            base."Minimum voltage",
            base."Average voltage",
            base."Valid voltage count",
            base."Maximum condenser temperature",
            base."Minimum condenser temperature",
            base."Average condenser temperature",
            base."Valid condenser temperature count",
            base."Count of condenser temperatures above 52",
            base.iot_device_id,
            base.max_voltage,
            base.min_voltage,
            base.avg_voltage,
            base.valid_voltage_count,
            base.iot_device_id_1 AS iot_device_id,
            base.max_condenser_temp,
            base.min_condenser_temp,
            base.avg_condenser_temp,
            base.valid_condenser_temp_count,
            base.condenser_temp_above_52_count,
            base.max_voltage AS max_v,
            base.min_voltage AS min_v,
            base.avg_voltage AS avg_v,
            base.max_condenser_temp AS max_ct,
            base.avg_condenser_temp AS avg_ct,
            base.valid_voltage_count AS v_cnt,
            base.valid_condenser_temp_count AS ct_cnt,
            base.condenser_temp_above_52_count AS ct_above_52_cnt
           FROM base base("MAC Address", "Serial Number", "C Number", "District", "Maximum voltage", "Minimum voltage", "Average voltage", "Valid voltage count", "Maximum condenser temperature", "Minimum condenser temperature", "Average condenser temperature", "Valid condenser temperature count", "Count of condenser temperatures above 52", iot_device_id, max_voltage, min_voltage, avg_voltage, valid_voltage_count, iot_device_id_1, max_condenser_temp, min_condenser_temp, avg_condenser_temp, valid_condenser_temp_count, condenser_temp_above_52_count)) s("MAC Address", "Serial Number", "C Number", "District", "Maximum voltage", "Minimum voltage", "Average voltage", "Valid voltage count", "Maximum condenser temperature", "Minimum condenser temperature", "Average condenser temperature", "Valid condenser temperature count", "Count of condenser temperatures above 52", iot_device_id, max_voltage, min_voltage, avg_voltage, valid_voltage_count, iot_device_id_1, max_condenser_temp, min_condenser_temp, avg_condenser_temp, valid_condenser_temp_count, condenser_temp_above_52_count, max_v, min_v, avg_v, max_ct, avg_ct, v_cnt, ct_cnt, ct_above_52_cnt);


--
-- Name: gps_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_history ALTER COLUMN id SET DEFAULT nextval('public.gps_history_id_seq'::regclass);


--
-- Name: migration_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log ALTER COLUMN id SET DEFAULT nextval('public.migration_log_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: south_africa_provinces gid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.south_africa_provinces ALTER COLUMN gid SET DEFAULT nextval('public.south_africa_provinces_gid_seq'::regclass);


--
-- Name: iot_devices Wi-Fi MAC; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT "Wi-Fi MAC" UNIQUE (wi_fi_mac);


--
-- Name: iot_devices con_un_iot_telemetry_staycold_serial; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT con_un_iot_telemetry_staycold_serial UNIQUE (staycold_serial);


--
-- Name: gps_history gps_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_history
    ADD CONSTRAINT gps_history_pkey PRIMARY KEY (id);


--
-- Name: iot_datasources iot_datasources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_datasources
    ADD CONSTRAINT iot_datasources_pkey PRIMARY KEY (id);


--
-- Name: iot_devices iot_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_pkey PRIMARY KEY (id);


--
-- Name: iot_fota_requests iot_fota_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_fota_requests
    ADD CONSTRAINT iot_fota_requests_pkey PRIMARY KEY (id);


--
-- Name: iot_raw_data iot_raw_data_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_raw_data
    ADD CONSTRAINT iot_raw_data_new_pkey PRIMARY KEY (id);


--
-- Name: latest_values latest_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.latest_values
    ADD CONSTRAINT latest_values_pkey PRIMARY KEY (iot_device_id, datasource_id);


--
-- Name: maintenance_report maintenance_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_report
    ADD CONSTRAINT maintenance_report_pkey PRIMARY KEY (mac_address, report_date);


--
-- Name: migration_log migration_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT migration_log_pkey PRIMARY KEY (id);


--
-- Name: performance_reports performance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_reports
    ADD CONSTRAINT performance_reports_pkey PRIMARY KEY (report_date, fridge_serial);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: iot_devices_bak pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices_bak
    ADD CONSTRAINT pkey PRIMARY KEY (id);


--
-- Name: precomputed_door_count_data precomputed_door_count_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precomputed_door_count_data
    ADD CONSTRAINT precomputed_door_count_data_pkey PRIMARY KEY (iot_device_id, month);


--
-- Name: precomputed_mains_data precomputed_mains_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precomputed_mains_data
    ADD CONSTRAINT precomputed_mains_data_pkey PRIMARY KEY (iot_device_id, month);


--
-- Name: precomputed_temperature_data precomputed_temperature_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precomputed_temperature_data
    ADD CONSTRAINT precomputed_temperature_data_pkey PRIMARY KEY (iot_device_id, month);


--
-- Name: schema_metadata schema_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_metadata
    ADD CONSTRAINT schema_metadata_pkey PRIMARY KEY (key);


--
-- Name: south_africa_provinces south_africa_provinces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.south_africa_provinces
    ADD CONSTRAINT south_africa_provinces_pkey PRIMARY KEY (gid);


--
-- Name: iot_devices_bak staycold_sereial; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices_bak
    ADD CONSTRAINT staycold_sereial UNIQUE (staycold_serial);


--
-- Name: telemetry_3h_bins telemetry_3h_bins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_3h_bins
    ADD CONSTRAINT telemetry_3h_bins_pkey PRIMARY KEY (mac_address, bin_ts);


--
-- Name: iot_telemetry telemetry_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_telemetry
    ADD CONSTRAINT telemetry_data_pkey PRIMARY KEY (iot_device_id, datasource_id, "timestamp");


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: iot_datasources un_datasourcekey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_datasources
    ADD CONSTRAINT un_datasourcekey UNIQUE (datasource_key);


--
-- Name: iot_datasources un_modbus_slave_register; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_datasources
    ADD CONSTRAINT un_modbus_slave_register UNIQUE (modbus_slave_id, modbus_register_id);


--
-- Name: iot_devices_bak wi_fi_mac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices_bak
    ADD CONSTRAINT wi_fi_mac UNIQUE (wi_fi_mac);


--
-- Name: brin_iot_raw_data_new_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brin_iot_raw_data_new_timestamp ON public.iot_raw_data USING brin ("timestamp");


--
-- Name: idx_devices_valid_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_valid_serial ON public.iot_devices USING btree (staycold_serial) WHERE (staycold_serial IS NOT NULL);


--
-- Name: idx_gps_history_device_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gps_history_device_ts ON public.gps_history USING btree (iot_device_id, "timestamp" DESC);


--
-- Name: idx_gps_history_lon_lat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gps_history_lon_lat ON public.gps_history USING gist (public.st_setsrid(public.st_makepoint((longitude)::double precision, (latitude)::double precision), 4326));


--
-- Name: idx_iot_datasources_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_iot_datasources_key_unique ON public.iot_datasources USING btree (datasource_key);


--
-- Name: idx_iot_datasources_modbus_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_datasources_modbus_composite ON public.iot_datasources USING btree (modbus_slave_id, modbus_register_id) WHERE ((modbus_slave_id IS NOT NULL) AND (modbus_register_id IS NOT NULL));


--
-- Name: idx_iot_devices_firmware; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_devices_firmware ON public.iot_devices USING btree (firmware_version) WHERE (firmware_version IS NOT NULL);


--
-- Name: idx_iot_devices_last_seen_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_devices_last_seen_active ON public.iot_devices USING btree (last_seen DESC) WHERE (last_seen IS NOT NULL);


--
-- Name: idx_iot_devices_mac_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_iot_devices_mac_unique ON public.iot_devices USING btree (wi_fi_mac);


--
-- Name: idx_iot_devices_staycold_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_devices_staycold_serial ON public.iot_devices USING btree (staycold_serial) WHERE (staycold_serial IS NOT NULL);


--
-- Name: idx_iot_raw_data_new_mqtt_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_raw_data_new_mqtt_topic ON public.iot_raw_data USING btree (mqtt_topic) WITH (fillfactor='100', deduplicate_items='true');


--
-- Name: idx_iot_telemetry_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_telemetry_device_id ON public.iot_telemetry USING btree (iot_device_id);


--
-- Name: idx_iot_telemetry_device_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_telemetry_device_timestamp ON public.iot_telemetry USING btree (iot_device_id, "timestamp");


--
-- Name: idx_iot_telemetry_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iot_telemetry_timestamp ON public.iot_telemetry USING btree ("timestamp");


--
-- Name: idx_latest_values_device_datasource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_latest_values_device_datasource ON public.latest_values USING btree (iot_device_id, datasource_id);


--
-- Name: idx_migration_log_migration_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migration_log_migration_name ON public.migration_log USING btree (migration_name);


--
-- Name: idx_migration_log_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migration_log_started_at ON public.migration_log USING btree (started_at DESC);


--
-- Name: idx_migration_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migration_log_status ON public.migration_log USING btree (status) WHERE (status <> 'completed'::text);


--
-- Name: idx_perf_reports_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perf_reports_date ON public.performance_reports USING btree (report_date);


--
-- Name: idx_performance_reports_c_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_reports_c_code ON public.performance_reports USING btree (c_code);


--
-- Name: idx_performance_reports_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_reports_date ON public.performance_reports USING btree (report_date);


--
-- Name: idx_provinces_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provinces_geom ON public.south_africa_provinces USING gist (geom);


--
-- Name: idx_telemetry_report_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetry_report_partial ON public.iot_telemetry USING btree (iot_device_id, "timestamp") INCLUDE (value) WHERE (datasource_id = ANY (ARRAY[(28)::bigint, (29)::bigint, (32)::bigint, (40)::bigint, (44)::bigint, (45)::bigint, (48)::bigint]));


--
-- Name: south_africa_provinces_geom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX south_africa_provinces_geom_idx ON public.south_africa_provinces USING gist (geom);


--
-- Name: latest_values trg_latest_values_gps_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_latest_values_gps_history AFTER INSERT OR UPDATE ON public.latest_values FOR EACH ROW EXECUTE FUNCTION public.trg_update_gps_history();


--
-- Name: iot_telemetry trg_update_door_count_data_monthly; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_door_count_data_monthly AFTER INSERT ON public.iot_telemetry FOR EACH ROW WHEN ((new.datasource_id = 48)) EXECUTE FUNCTION public.update_door_count_data_monthly();


--
-- Name: iot_telemetry trg_update_mains_data_monthly; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_mains_data_monthly AFTER INSERT ON public.iot_telemetry FOR EACH ROW WHEN ((new.datasource_id = 12)) EXECUTE FUNCTION public.update_mains_data_monthly();


--
-- Name: iot_telemetry trg_update_temperature_data_monthly; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_temperature_data_monthly AFTER INSERT ON public.iot_telemetry FOR EACH ROW WHEN ((new.datasource_id = 32)) EXECUTE FUNCTION public.update_temperature_data_monthly();


--
-- Name: iot_telemetry trg_upsert_latest_values; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_upsert_latest_values AFTER INSERT ON public.iot_telemetry FOR EACH ROW EXECUTE FUNCTION public.upsert_latest_values();


--
-- Name: tenants trg_validate_tenant_device_ids; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_tenant_device_ids BEFORE INSERT OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_device_ids();


--
-- Name: latest_values fk_datasource; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.latest_values
    ADD CONSTRAINT fk_datasource FOREIGN KEY (datasource_id) REFERENCES public.iot_datasources(id) ON DELETE CASCADE;


--
-- Name: precomputed_door_count_data fk_door_iot_device; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precomputed_door_count_data
    ADD CONSTRAINT fk_door_iot_device FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;


--
-- Name: latest_values fk_iot_device; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.latest_values
    ADD CONSTRAINT fk_iot_device FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;


--
-- Name: iot_fota_requests fk_iot_telemetry_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_fota_requests
    ADD CONSTRAINT fk_iot_telemetry_device_id FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id);


--
-- Name: iot_telemetry fk_iot_telemetry_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_telemetry
    ADD CONSTRAINT fk_iot_telemetry_device_id FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id);


--
-- Name: precomputed_mains_data fk_mains_iot_device; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precomputed_mains_data
    ADD CONSTRAINT fk_mains_iot_device FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;


--
-- Name: precomputed_temperature_data fk_temp_iot_device; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precomputed_temperature_data
    ADD CONSTRAINT fk_temp_iot_device FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;


--
-- Name: iot_telemetry fkey_iot_telemetry_datasource_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_telemetry
    ADD CONSTRAINT fkey_iot_telemetry_datasource_id FOREIGN KEY (datasource_id) REFERENCES public.iot_datasources(id);


--
-- Name: gps_history gps_history_iot_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_history
    ADD CONSTRAINT gps_history_iot_device_id_fkey FOREIGN KEY (iot_device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;


--
-- Name: performance_reports admin_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_access ON public.performance_reports TO signalhill_psql_user, signalhill_powerautomate_user, signalhill_psql_readonly USING (true);


--
-- Name: performance_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: performance_reports tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.performance_reports FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tenants t
     JOIN public.iot_devices d ON ((d.id = ANY (t.iot_device_ids))))
  WHERE ((t.id = public.current_tenant_id()) AND (d.wi_fi_mac = performance_reports.mac_address)))));


--
-- Name: SCHEMA cron; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA cron TO signalhill_psql_readonly;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO anon_user;
GRANT USAGE ON SCHEMA public TO signalhill_powerautomate_user;


--
-- Name: FUNCTION current_tenant_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_tenant_id() TO "signalhill-api-user";


--
-- Name: SEQUENCE jobid_seq; Type: ACL; Schema: cron; Owner: -
--

GRANT SELECT ON SEQUENCE cron.jobid_seq TO signalhill_psql_readonly;


--
-- Name: TABLE job; Type: ACL; Schema: cron; Owner: -
--

GRANT SELECT ON TABLE cron.job TO signalhill_psql_readonly;


--
-- Name: SEQUENCE runid_seq; Type: ACL; Schema: cron; Owner: -
--

GRANT SELECT ON SEQUENCE cron.runid_seq TO signalhill_psql_readonly;


--
-- Name: TABLE job_run_details; Type: ACL; Schema: cron; Owner: -
--

GRANT SELECT ON TABLE cron.job_run_details TO signalhill_psql_readonly;


--
-- Name: SEQUENCE seq_iot_datasources_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON SEQUENCE public.seq_iot_datasources_id TO anon_user;


--
-- Name: TABLE iot_datasources; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_datasources TO anon_user;


--
-- Name: SEQUENCE seq_iot_devices_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON SEQUENCE public.seq_iot_devices_id TO anon_user;


--
-- Name: TABLE iot_devices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_devices TO anon_user;
GRANT UPDATE ON TABLE public.iot_devices TO signalhill_powerautomate_user;
GRANT SELECT ON TABLE public.iot_devices TO "signalhill-api-user";


--
-- Name: TABLE latest_values; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.latest_values TO anon_user;


--
-- Name: TABLE south_africa_provinces; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.south_africa_provinces TO anon_user;


--
-- Name: TABLE device_location_report; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.device_location_report TO anon_user;


--
-- Name: TABLE dispatch_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.dispatch_reports TO anon_user;
GRANT SELECT,INSERT,UPDATE ON TABLE public.dispatch_reports TO signalhill_powerautomate_user;


--
-- Name: TABLE gps_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.gps_history TO anon_user;


--
-- Name: TABLE iot_telemetry; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_telemetry TO anon_user;


--
-- Name: TABLE iot_device_daily_activity; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_device_daily_activity TO anon_user;


--
-- Name: TABLE iot_device_view; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_device_view TO anon_user;


--
-- Name: TABLE iot_devices_bak; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_devices_bak TO anon_user;


--
-- Name: TABLE iot_fota_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_fota_requests TO anon_user;


--
-- Name: TABLE iot_raw_data; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.iot_raw_data TO anon_user;


--
-- Name: TABLE maintenance_report; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.maintenance_report TO anon_user;


--
-- Name: TABLE migration_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.migration_log TO anon_user;


--
-- Name: TABLE precomputed_door_count_data; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.precomputed_door_count_data TO anon_user;


--
-- Name: TABLE precomputed_mains_data; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.precomputed_mains_data TO anon_user;


--
-- Name: TABLE precomputed_temperature_data; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.precomputed_temperature_data TO anon_user;


--
-- Name: TABLE monthly_device_performance_report; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.monthly_device_performance_report TO anon_user;


--
-- Name: TABLE optimized_iot_data_3; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.optimized_iot_data_3 TO anon_user;


--
-- Name: TABLE optimized_iot_data_4; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.optimized_iot_data_4 TO anon_user;


--
-- Name: TABLE optimized_iot_data_4_previous_calendar_month; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.optimized_iot_data_4_previous_calendar_month TO anon_user;


--
-- Name: TABLE performance_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.performance_reports TO anon_user;
GRANT SELECT ON TABLE public.performance_reports TO "signalhill-api-user";


--
-- Name: TABLE pgmigrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.pgmigrations TO anon_user;


--
-- Name: TABLE schema_metadata; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.schema_metadata TO anon_user;


--
-- Name: TABLE schema_info; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.schema_info TO anon_user;


--
-- Name: SEQUENCE seq_iot_raw_message_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON SEQUENCE public.seq_iot_raw_message_id TO anon_user;


--
-- Name: SEQUENCE seq_iot_telemetry_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON SEQUENCE public.seq_iot_telemetry_id TO anon_user;


--
-- Name: TABLE telemetry_3h_bins; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.telemetry_3h_bins TO anon_user;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tenants TO anon_user;
GRANT SELECT ON TABLE public.tenants TO "signalhill-api-user";


--
-- Name: TABLE view_precomputed_door_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.view_precomputed_door_count TO anon_user;


--
-- Name: TABLE vw_online_device_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.vw_online_device_history TO anon_user;


--
-- Name: TABLE warranty_report_ytd; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.warranty_report_ytd TO anon_user;


--
-- Name: TABLE weekly_warranty_report; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.weekly_warranty_report TO anon_user;


--
-- Name: TABLE weekly_warranty_report_v2; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.weekly_warranty_report_v2 TO anon_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE signalhill_psql_user IN SCHEMA public GRANT SELECT ON TABLES TO anon_user;


--
-- PostgreSQL database dump complete
--

\unrestrict mr9KjPoSbnqRhW7l7bzDpGd4mBc8nsVoT7dspG6BMwX5xu37H8glmUFaRFve9kf

