-- # Variables

-- 1. date_selected

SELECT DISTINCT 
  TO_CHAR(report_date, 'YYYY-MM-DD') AS __text,
  TO_CHAR(report_date, 'YYYY-MM-DD') AS __value
FROM public.performance_reports
ORDER BY __value DESC;

-- 2. selected_mac

SELECT DISTINCT mac_address FROM public.performance_reports WHERE report_date = '${date_selected}' AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )));

-- 3. tenant

SELECT name from tenants;

-- # Select queries

-- 1. device info

SELECT 
    pr.report_date       AS "Report Date",
    pr.c_code            AS "C Code",
    pr.fridge_serial     AS "Fridge Serial",
    pr.mac_address       AS "MAC Address",
    pr.district          AS "District",
    pr.is_active         AS "Is Active",
    pr.last_active_date  AS "Last Active Date"
FROM performance_reports AS pr
WHERE pr.report_date = '${date_selected}'
  AND pr.mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
;


-- 2. active vs inactive

SELECT 
  CASE
    WHEN is_active = FALSE THEN 'Inactive'
    WHEN powered_pct IS NULL OR powered_pct = 0 THEN 'Active but Powered OFF'
    ELSE 'Active and Powered ON'
  END AS state,
  COUNT(*) AS count
FROM public.performance_reports
WHERE report_date = '${date_selected}'
AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
GROUP BY 1
ORDER BY 1;

-- 3. performance report table

SELECT 
    pr.report_date        AS "Report Date",
    pr.c_code             AS "C Code",
    pr.fridge_serial      AS "Fridge Serial",
    pr.mac_address        AS "MAC Address",
    pr.district           AS "District",
    pr.powered_pct        AS "Powered (%)",
    pr.powered_flag       AS "Powered Flag",
    pr.avg_case_temp_c    AS "Average Case Temp (°C)",
    pr.temp_flag          AS "Temperature Flag",
    pr.door_opens_count   AS "Door Opens Count",
    pr.voltage_avg_day AS "Average Voltage",
    pr.voltage_risk       AS "Voltage Risk",
    pr.latitude           AS "Latitude",
    pr.longitude          AS "Longitude"
FROM 
    performance_reports AS pr
WHERE 
    pr.report_date = '${date_selected}'
    AND pr.mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant ))) 
AND 
    pr.is_active 
AND 
    pr.powered_hours_day > 0;

-- 4. temperature Flag

SELECT 
  temp_flag AS label,
  COUNT(*) AS value
FROM 
  performance_reports 
WHERE 
  report_date = '${date_selected}' 
  AND mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0
AND 
  temp_flag != 'N/A'
GROUP BY
  temp_flag
ORDER BY
  label;

-- 5. voltage risk Flag

SELECT 
  voltage_risk AS label,
  COUNT(*) AS value
FROM 
  performance_reports 
WHERE 
  report_date = '${date_selected}' 
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0
AND 
  voltage_risk != 'N/A'
GROUP BY
  voltage_risk
ORDER BY
  label;

-- 6. door opens count

SELECT 
  powered_flag AS label,
  COUNT(*) AS value
FROM 
  performance_reports 
WHERE 
  report_date = '${date_selected}' 
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0
AND 
  powered_flag != 'N/A'
GROUP BY
  powered_flag
ORDER BY
  label;

-- 7. average cabinet temperature

SELECT AVG(avg_case_temp_c) AS "Average Cabinet Temperature" FROM performance_reports
WHERE 
  report_date = '${date_selected}' 
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 8. average door

SELECT AVG(door_opens_count) AS "Average Voltage" FROM performance_reports
WHERE 
  report_date = '${date_selected}' 
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;

-- 9. average powered %

SELECT AVG(powered_pct) AS "Average Powered On" FROM performance_reports
WHERE 
  report_date = '${date_selected}' 
AND 
  mac_address in (SELECT wi_fi_mac from iot_devices WHERE id in(SELECT UNNEST(iot_device_ids) from tenants WHERE name in ($tenant )))
AND 
  is_active 
AND 
  powered_hours_day > 0;