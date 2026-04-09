require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors({
  origin: (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Filters: available dates and tenants ─────────────────────────────────────

app.get("/filters/dates", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT TO_CHAR(report_date, 'YYYY-MM-DD') AS value
       FROM public.performance_reports
       ORDER BY value DESC`,
    );
    res.json(rows.map((r) => r.value));
  } catch (error) {
    console.error("[filters/dates]", error.message);
    res.status(500).json({ error: "Failed to load report dates" });
  }
});

app.get("/filters/tenants", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT name FROM public.tenants WHERE active = true ORDER BY name`,
    );
    res.json(rows.map((r) => r.name));
  } catch (error) {
    console.error("[filters/tenants]", error.message);
    res.status(500).json({ error: "Failed to load tenants" });
  }
});

// ── Tenant MAC filter subquery (shared helper) ──────────────────────────────

function tenantMacFilter(tenantParamIndex) {
  return `($${tenantParamIndex} = 'ALL' OR mac_address IN (
    SELECT wi_fi_mac FROM public.iot_devices
    WHERE id IN (
      SELECT UNNEST(iot_device_ids) FROM public.tenants WHERE name = $${tenantParamIndex}
    )
  ))`;
}

const ACTIVE_POWERED_FILTER = "is_active = true AND powered_hours_day > 0";

// ── Performance report: summary metrics ──────────────────────────────────────

app.get("/performance/summary", async (req, res) => {
  try {
    const { date, tenant } = req.query;
    if (!date || !tenant) {
      return res.status(400).json({ error: "date and tenant are required" });
    }

    const baseWhere = `report_date = $1 AND ${tenantMacFilter(2)}`;
    const activeWhere = `${baseWhere} AND ${ACTIVE_POWERED_FILTER}`;
    const params = [date, tenant];

    const [totalResult, avgResult, healthResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM public.performance_reports WHERE ${baseWhere}`, params),
      pool.query(
        `SELECT
           AVG(avg_case_temp_c) AS avg_case_temp,
           AVG(door_opens_count) AS avg_door_opens,
           AVG(powered_pct) AS avg_powered_pct
         FROM public.performance_reports
         WHERE ${activeWhere}`,
        params,
      ),
      pool.query(
        `SELECT
           CASE
             WHEN is_active = FALSE THEN 'Inactive'
             WHEN powered_pct IS NULL OR powered_pct = 0 THEN 'Active but Powered Off'
             ELSE 'Active and Powered On'
           END AS state,
           COUNT(*) AS count
         FROM public.performance_reports
         WHERE ${baseWhere}
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
    ]);

    const total = Number(totalResult.rows[0]?.total || 0);
    const avgs = avgResult.rows[0] || {};
    const healthMap = {};
    for (const row of healthResult.rows) {
      healthMap[row.state] = Number(row.count);
    }

    const activeOn = healthMap["Active and Powered On"] || 0;
    const activePoweredPct = total > 0 ? ((activeOn / total) * 100).toFixed(1) : "0";

    res.json({
      total_units: total,
      active_powered_pct: Number(activePoweredPct),
      avg_case_temp: avgs.avg_case_temp != null ? Number(Number(avgs.avg_case_temp).toFixed(1)) : null,
      avg_door_opens: avgs.avg_door_opens != null ? Math.round(Number(avgs.avg_door_opens)) : null,
      avg_powered_pct: avgs.avg_powered_pct != null ? Number(Number(avgs.avg_powered_pct).toFixed(1)) : null,
      health_segments: [
        { label: "Active & Powered On", value: healthMap["Active and Powered On"] || 0, color: "#10b981" },
        { label: "Active but Powered Off", value: healthMap["Active but Powered Off"] || 0, color: "#f59e0b" },
        { label: "Inactive", value: healthMap["Inactive"] || 0, color: "#ef4444" },
      ],
    });
  } catch (error) {
    console.error("[performance/summary]", error.message);
    res.status(500).json({ error: "Failed to load performance summary" });
  }
});

// ── Performance report: flag distributions ───────────────────────────────────

app.get("/performance/distributions", async (req, res) => {
  try {
    const { date, tenant } = req.query;
    if (!date || !tenant) {
      return res.status(400).json({ error: "date and tenant are required" });
    }

    const activeWhere = `report_date = $1 AND ${tenantMacFilter(2)} AND ${ACTIVE_POWERED_FILTER}`;
    const params = [date, tenant];

    const [tempResult, voltageResult, poweredResult] = await Promise.all([
      pool.query(
        `SELECT temp_flag AS label, COUNT(*) AS value
         FROM public.performance_reports
         WHERE ${activeWhere} AND temp_flag != 'N/A'
         GROUP BY temp_flag ORDER BY label`,
        params,
      ),
      pool.query(
        `SELECT voltage_risk AS label, COUNT(*) AS value
         FROM public.performance_reports
         WHERE ${activeWhere} AND voltage_risk != 'N/A'
         GROUP BY voltage_risk ORDER BY label`,
        params,
      ),
      pool.query(
        `SELECT powered_flag AS label, COUNT(*) AS value
         FROM public.performance_reports
         WHERE ${activeWhere} AND powered_flag != 'N/A'
         GROUP BY powered_flag ORDER BY label`,
        params,
      ),
    ]);

    const toArr = (rows) => rows.map((r) => ({ label: r.label, value: Number(r.value) }));

    res.json({
      temp_flags: toArr(tempResult.rows),
      voltage_flags: toArr(voltageResult.rows),
      powered_flags: toArr(poweredResult.rows),
    });
  } catch (error) {
    console.error("[performance/distributions]", error.message);
    res.status(500).json({ error: "Failed to load distributions" });
  }
});

// ── Performance report: units table ──────────────────────────────────────────

app.get("/performance/units", async (req, res) => {
  try {
    const { date, tenant } = req.query;
    if (!date || !tenant) {
      return res.status(400).json({ error: "date and tenant are required" });
    }

    const { rows } = await pool.query(
      `SELECT
         pr.mac_address,
         pr.c_code,
         pr.fridge_serial,
         pr.district,
         pr.powered_pct,
         pr.powered_flag,
         pr.avg_case_temp_c,
         pr.temp_flag,
         pr.door_opens_count,
         pr.voltage_avg_day,
         pr.voltage_risk,
         pr.latitude,
         pr.longitude,
         pr.last_active_date
       FROM public.performance_reports AS pr
       WHERE pr.report_date = $1
         AND ${tenantMacFilter(2)}
         AND ${ACTIVE_POWERED_FILTER}
       ORDER BY pr.door_opens_count DESC NULLS LAST`,
      [date, tenant],
    );

    res.json(rows.map((r) => ({
      mac_address: r.mac_address,
      c_code: r.c_code,
      fridge_serial: r.fridge_serial,
      district: r.district,
      powered_pct: r.powered_pct != null ? Number(r.powered_pct) : null,
      powered_flag: r.powered_flag,
      avg_case_temp: r.avg_case_temp_c != null ? Number(r.avg_case_temp_c) : null,
      temp_flag: r.temp_flag,
      door_opens: r.door_opens_count != null ? Number(r.door_opens_count) : null,
      voltage_avg: r.voltage_avg_day != null ? Number(r.voltage_avg_day) : null,
      voltage_risk: r.voltage_risk,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      last_active_date: r.last_active_date,
    })));
  } catch (error) {
    console.error("[performance/units]", error.message);
    res.status(500).json({ error: "Failed to load units" });
  }
});

// ── Unit detail: info + current report ───────────────────────────────────────

app.get("/unit/:mac", async (req, res) => {
  try {
    const { date, tenant } = req.query;
    if (!date || !tenant) {
      return res.status(400).json({ error: "date and tenant are required" });
    }

    const { rows } = await pool.query(
      `SELECT
         pr.report_date,
         pr.mac_address,
         pr.c_code,
         pr.fridge_serial,
         pr.district,
         pr.powered_pct,
         pr.powered_flag,
         pr.avg_case_temp_c,
         pr.temp_flag,
         pr.door_opens_count,
         pr.voltage_avg_day,
         pr.voltage_risk,
         pr.is_active,
         pr.last_active_date,
         pr.latitude,
         pr.longitude
       FROM public.performance_reports AS pr
       WHERE pr.mac_address = $1
         AND pr.report_date = $2
         AND ${tenantMacFilter(3)}`,
      [req.params.mac, date, tenant],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Unit not found for the selected date" });
    }

    const r = rows[0];
    res.json({
      mac_address: r.mac_address,
      c_code: r.c_code,
      fridge_serial: r.fridge_serial,
      district: r.district,
      powered_pct: r.powered_pct != null ? Number(r.powered_pct) : null,
      powered_flag: r.powered_flag,
      avg_case_temp: r.avg_case_temp_c != null ? Number(r.avg_case_temp_c) : null,
      temp_flag: r.temp_flag,
      door_opens: r.door_opens_count != null ? Number(r.door_opens_count) : null,
      voltage_avg: r.voltage_avg_day != null ? Number(r.voltage_avg_day) : null,
      voltage_risk: r.voltage_risk,
      is_active: r.is_active,
      last_active_date: r.last_active_date,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    });
  } catch (error) {
    console.error("[unit/:mac]", error.message);
    res.status(500).json({ error: "Failed to load unit detail" });
  }
});

// ── Unit detail: trend data (multi-date history) ─────────────────────────────

app.get("/unit/:mac/trends", async (req, res) => {
  try {
    const { tenant, days } = req.query;
    if (!tenant) {
      return res.status(400).json({ error: "tenant is required" });
    }

    const limit = Math.min(Number(days) || 30, 90);

    const { rows } = await pool.query(
      `SELECT
         TO_CHAR(pr.report_date, 'YYYY-MM-DD') AS date,
         pr.door_opens_count,
         pr.avg_case_temp_c,
         pr.powered_pct,
         pr.voltage_avg_day
       FROM public.performance_reports AS pr
       WHERE pr.mac_address = $1
         AND ${tenantMacFilter(2)}
         AND ${ACTIVE_POWERED_FILTER}
       ORDER BY pr.report_date DESC
       LIMIT $3`,
      [req.params.mac, tenant, limit],
    );

    const sorted = rows.reverse();

    res.json({
      door_opens: sorted.map((r) => ({ label: r.date, value: r.door_opens_count != null ? Number(r.door_opens_count) : 0 })),
      temperature: sorted.map((r) => ({ label: r.date, value: r.avg_case_temp_c != null ? Number(r.avg_case_temp_c) : 0 })),
      powered: sorted.map((r) => ({ label: r.date, value: r.powered_pct != null ? Number(r.powered_pct) : 0 })),
      voltage: sorted.map((r) => ({ label: r.date, value: r.voltage_avg_day != null ? Number(r.voltage_avg_day) : 0 })),
    });
  } catch (error) {
    console.error("[unit/:mac/trends]", error.message);
    res.status(500).json({ error: "Failed to load unit trends" });
  }
});

// ── Start server ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 5002);
app.listen(PORT, () => {
  console.info(`[analytics-api] Listening on port ${PORT}`);
});
