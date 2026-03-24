# Select for maintanence

-- 1. units measured

SELECT
  CASE
    WHEN severity IS NULL OR severity = '' or severity = 'No Data' or severity = 'Insufficient Data' or severity = 'NaN' or diffCon IS NULL
  or calculated_diff_con = 0 THEN 'Units Not Measured'
    ELSE 'Units Measured'
  END AS measurement_status,
  COUNT(DISTINCT mac_address) AS unit_count
FROM maintenance_report
WHERE report_date = '${date_selected}'
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
GROUP BY
  CASE
    WHEN severity IS NULL OR severity = '' or severity = 'No Data' or severity = 'Insufficient Data' or severity = 'NaN' or diffCon IS NULL or calculated_diff_con = 0 THEN 'Units Not Measured'
    ELSE 'Units Measured'
  END;


-- 2. severity pie chart

SELECT 
  severity,
  COUNT(DISTINCT mac_address) AS unit_count
FROM maintenance_report
WHERE report_date = '${date_selected}'
  AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
  AND severity IS NOT NULL
  AND severity <> ''
  AND severity <> 'NaN'
  AND severity <> 'No Data'
  AND diffCon > 0
  AND calculated_diff_con > 0
GROUP BY severity
ORDER BY
  CASE
    WHEN severity ILIKE '%Gas%' THEN 1
    WHEN severity ILIKE '%Blocked%' THEN 2
    WHEN severity ILIKE '%Power%' THEN 3
    WHEN severity ILIKE '%Not meeting%' THEN 4
    WHEN severity ILIKE '%Normal%' THEN 5
    ELSE 99
  END,
  severity ASC;

-- 3. maintenace report table

SELECT 
  pr.report_date AS "Report Date",
  pr.mac_address AS "Mac Address",
  pr.c_code AS "C Code",
  pr.fridge_serial AS "Fridge Serial",
  pr.district AS "District",
  pr.avg_case_temp_c AS "Avg Case Temp",
  mr.avg_cond_temp AS "Avg Cond Temp",
  mr.diffcon AS "DiffCon Temp",
  mr.calculated_diff_con AS "Calc DiffCon Temp",
  mr.trend_cond_max AS "Trend Cond Max",
  mr.trend_cond_min AS "Trend Cond Min",
  mr.smoothed_case_temp AS "Smooth Case Temp",
  mr.severity AS "Severity"
FROM 
  performance_reports AS pr
LEFT JOIN
  maintenance_report AS mr ON mr.report_date = pr.report_date AND mr.mac_address = pr.mac_address
WHERE 
  pr.report_date = '${date_selected}'
  AND 
  pr.mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
  AND
  mr.diffcon > 0
GROUP BY
  pr.report_date::DATE,
  pr.mac_address,
  pr.c_code,
  pr.fridge_serial,
  pr.district,
  pr.avg_case_temp_c,
  mr.avg_cond_temp,
  mr.diffcon,
  mr.calculated_diff_con,
  mr.trend_cond_max,
  mr.trend_cond_min,
  mr.smoothed_case_temp,
  mr.severity;

-- # individual mac address report after selecting mac

-- 1. average cabinet temperature

SELECT
  COALESCE(
    (
      SELECT avg_case_temp_c
      FROM performance_reports
      WHERE
        report_date = '${date_selected}'
        AND ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
        AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
        AND is_active
        AND powered_hours_day > 0
      LIMIT 1
    ),
    0
  ) AS "Average Cabinet Temperature";

-- 2. average condenser temperature

SELECT
  COALESCE(
    (
      SELECT avg_cond_temp
      FROM maintenance_report 
      WHERE
        report_date = '${date_selected}'
        AND ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
        AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))

      LIMIT 1
    ),
    0
  ) AS "Average Condenser Temperature";

-- 3. powered on 

SELECT 
  powered_hours_day AS "Powered On Hours",
  temp_flag 
FROM 
  performance_reports
WHERE 
  report_date = '${date_selected}'
  AND 
  ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
  AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))

AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 4. average voltage

SELECT voltage_avg_day AS "voltage average day" FROM performance_reports
WHERE 
  report_date = '${date_selected}'
  AND 
  ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
  AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 5. temperature flag

SELECT temp_flag AS "Temperature Flag" FROM performance_reports
WHERE 
  report_date = '${date_selected}' 
  AND 
  ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
  AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))

AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 6. door open count

SELECT 
  door_opens_count AS "Door Open Count" 
FROM 
  performance_reports
WHERE 
  report_date = '${date_selected}' 
AND 
  ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;


-- 7. powered flag

SELECT powered_flag AS "Powered On Flag" FROM performance_reports
WHERE 
  report_date = '${date_selected}' 
  AND 
  ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
  AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 8. voltage flag risk

SELECT voltage_risk AS "voltage_risk" FROM performance_reports
WHERE 
  report_date = '${date_selected}' 
  AND 
  ( '${selected_mac}' = '' OR mac_address = '${selected_mac}' )
  AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 9. condenser and cabinet temperature

SELECT
  "timestamp"::timestamptz AS time,

  MAX(value::double precision) FILTER (
    WHERE datasource_id = 79 AND value::double precision < 100 AND value::double precision > -100
  ) AS "Cabinet Average Temperature",

  MAX(value::double precision) FILTER (
    WHERE datasource_id = 80 AND value::double precision < 100 AND value::double precision > -100
  ) AS "Cabinet Maximum Temperature",

  MAX(value::double precision) FILTER (
    WHERE datasource_id = 81 AND value::double precision < 100 AND value::double precision > -100
  ) AS "Cabinet Minimum Temperature",

  MAX(value::double precision) FILTER (
    WHERE datasource_id = 82 AND value::double precision < 100 AND value::double precision > -100
  ) AS "Compressor Average Temperature",

  MAX(value::double precision) FILTER (
    WHERE datasource_id = 83 AND value::double precision < 100 AND value::double precision > -100
  ) AS "Compressor Maximum Temperature",

  MAX(value::double precision) FILTER (
    WHERE datasource_id = 84 AND value::double precision < 100 AND value::double precision > -100
  ) AS "Compressor Minimum Temperature"

FROM iot_telemetry
WHERE
  iot_device_id = (
    SELECT id FROM iot_devices WHERE wi_fi_mac = '${selected_mac}'
  )
  AND datasource_id IN (79, 80, 81, 82, 83, 84)
  AND "timestamp"::timestamptz BETWEEN
      ('${date_selected} 00:00:00'::timestamptz - interval '7 days')
      AND '${date_selected} 23:59:59'::timestamptz
GROUP BY "timestamp"::timestamptz
ORDER BY "timestamp"::timestamptz;

-- 10. telemetry data 

WITH door_events AS (
  SELECT
    t."timestamp",
    t.value::int AS door_state
  FROM public.iot_telemetry t
  WHERE
    t.iot_device_id = (SELECT id FROM public.iot_devices WHERE wi_fi_mac = '${selected_mac}')
    AND t.datasource_id = 48
    AND t."timestamp"::timestamptz BETWEEN
        ('${date_selected} 00:00:00'::timestamptz - interval '7 days')
        AND '${date_selected} 23:59:59'::timestamptz
),

door_state_filled AS (
  SELECT
    "timestamp",
    max(door_state) OVER (
      ORDER BY "timestamp"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS door_open
  FROM door_events
),

timestamps AS (
  SELECT DISTINCT
    t."timestamp"
  FROM public.iot_telemetry t
  WHERE
    t.iot_device_id = (SELECT id FROM public.iot_devices WHERE wi_fi_mac = '${selected_mac}')
    AND t."timestamp"::timestamptz BETWEEN
        ('${date_selected} 00:00:00'::timestamptz - interval '7 days')
        AND '${date_selected} 23:59:59'::timestamptz
),

door_filled AS (
  SELECT
    ts."timestamp",
    COALESCE(dsf.door_open, 0) AS door_open
  FROM timestamps ts
  LEFT JOIN door_state_filled dsf
    ON ts."timestamp" = dsf."timestamp"
)

SELECT
  t."timestamp"::timestamptz AS time,

  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 33 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Condenser Temperature",

  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 32 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Cabinet Temperature",

  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 41 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Evaporator Temperature 1",
  
  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 42 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Evaporator Temperature 2",

  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 31 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Setpoint",

  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 44 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Upper Setpoint",

  MAX(t.value::double precision) FILTER (WHERE t.datasource_id = 45 AND t.value::double precision < 100 AND t.value::double precision > -100)
    AS "Lower Setpoint",

  MAX(df.door_open) AS "Door Open"

FROM public.iot_telemetry t
LEFT JOIN door_filled df
  ON t."timestamp" = df."timestamp"
WHERE
  t.iot_device_id = (SELECT id FROM public.iot_devices WHERE wi_fi_mac = '${selected_mac}')
  AND t.datasource_id IN (32, 33, 41, 42)
  AND t."timestamp"::timestamptz BETWEEN
      ('${date_selected} 00:00:00'::timestamptz - interval '7 days')
      AND '${date_selected} 23:59:59'::timestamptz
GROUP BY t."timestamp"
ORDER BY t."timestamp";
