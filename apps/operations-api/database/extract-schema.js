#!/usr/bin/env node
require("../env");
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "schema");

async function extractSchema() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log("[schema] Connected to database");

    // Extract types/enums
    const types = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      LEFT JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typnamespace = 'frostlink'::regnamespace
      ORDER BY t.typname, e.enumlabel
    `);

    // Extract tables
    const tables = await client.query(`
      SELECT
        t.tablename,
        obj_description(pgc.oid, 'pg_class') as comment
      FROM pg_tables t
      LEFT JOIN pg_class pgc ON pgc.relname = t.tablename
      WHERE t.schemaname = 'frostlink'
      ORDER BY t.tablename
    `);

    // Extract columns with constraints
    const columns = await client.query(`
      SELECT
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        col_description(pgc.oid, c.ordinal_position) as comment
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
      WHERE t.table_schema = 'frostlink'
      ORDER BY t.table_name, c.ordinal_position
    `);

    // Extract constraints
    const constraints = await client.query(`
      SELECT
        t.table_name,
        c.constraint_name,
        c.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints c
      JOIN information_schema.tables t ON c.table_name = t.table_name
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.constraint_name = kcu.constraint_name
        AND c.table_schema = kcu.table_schema
      WHERE c.table_schema = 'frostlink'
      ORDER BY t.table_name, c.constraint_name
    `);

    // Extract indexes
    const indexes = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'frostlink'
      ORDER BY tablename, indexname
    `);

    // Extract triggers
    const triggers = await client.query(`
      SELECT
        event_object_table,
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'frostlink'
      ORDER BY event_object_table, trigger_name
    `);

    // Extract functions
    const functions = await client.query(`
      SELECT
        proname,
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE pronamespace = 'frostlink'::regnamespace
      ORDER BY proname
    `);

    // Organize data
    const schema = {
      timestamp: new Date().toISOString(),
      types: groupBy(types.rows, "typname"),
      tables: tables.rows,
      columns: groupBy(columns.rows, "table_name"),
      constraints: groupBy(constraints.rows, "table_name"),
      indexes: groupBy(indexes.rows, "tablename"),
      triggers: groupBy(triggers.rows, "event_object_table"),
      functions: functions.rows,
    };

    // Save JSON
    const jsonPath = path.join(OUTPUT_DIR, "schema.json");
    fs.writeFileSync(jsonPath, JSON.stringify(schema, null, 2));
    console.log(`[schema] Saved: ${jsonPath}`);

    // Generate Markdown
    const mdPath = path.join(OUTPUT_DIR, "SCHEMA.md");
    const md = generateMarkdown(schema);
    fs.writeFileSync(mdPath, md);
    console.log(`[schema] Saved: ${mdPath}`);

    console.log("[schema] Schema extraction complete");
  } finally {
    await client.end();
  }
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function generateMarkdown(schema) {
  let md = `# frostlink Schema

**Generated:** ${new Date(schema.timestamp).toLocaleString()}

## Tables

`;

  Object.entries(schema.columns).forEach(([tableName, cols]) => {
    md += `### ${tableName}\n\n`;
    md += "| Column | Type | Nullable | Default | Comment |\n";
    md += "|--------|------|----------|---------|----------|\n";
    cols.forEach((col) => {
      const nullable = col.is_nullable === "YES" ? "Yes" : "No";
      const defaultVal = col.column_default || "";
      const comment = col.comment || "";
      md += `| ${col.column_name} | ${col.data_type} | ${nullable} | ${defaultVal} | ${comment} |\n`;
    });
    md += "\n";
  });

  if (Object.keys(schema.indexes).length > 0) {
    md += "## Indexes\n\n";
    Object.entries(schema.indexes).forEach(([table, idxs]) => {
      md += `### ${table}\n\n`;
      idxs.forEach((idx) => {
        md += `- **${idx.indexname}**: ${idx.indexdef}\n`;
      });
      md += "\n";
    });
  }

  if (Object.keys(schema.types).length > 0) {
    md += "## Types/Enums\n\n";
    Object.entries(schema.types).forEach(([type, values]) => {
      const enums = values.filter((v) => v.enumlabel).map((v) => v.enumlabel);
      if (enums.length > 0) {
        md += `### ${type}\n\n`;
        md += enums.map((e) => `- ${e}`).join("\n") + "\n\n";
      }
    });
  }

  if (Object.keys(schema.triggers).length > 0) {
    md += "## Triggers\n\n";
    Object.entries(schema.triggers).forEach(([table, trgs]) => {
      md += `### ${table}\n\n`;
      trgs.forEach((trg) => {
        md += `- **${trg.trigger_name}** (${trg.action_timing} ${trg.event_manipulation})\n`;
      });
      md += "\n";
    });
  }

  if (schema.functions.length > 0) {
    md += "## Functions\n\n";
    schema.functions.forEach((fn) => {
      md += `### ${fn.proname}\n\n\`\`\`sql\n${fn.definition}\n\`\`\`\n\n`;
    });
  }

  return md;
}

extractSchema().catch((err) => {
  console.error("[schema] Error:", err.message);
  process.exit(1);
});
