/**
 * 为 event_logs、tool_comments、news_comments 添加常用查询索引（P2 性能优化）
 * 用法: node scripts/add-indexes-event-logs-comments.js
 */
const { sequelize } = require("../config/database");

const INDEX_DEFS = [
  { table: "event_logs", name: "idx_el_created_event", columns: ["created_at", "event_type"] },
  { table: "event_logs", name: "idx_el_event_type", columns: ["event_type"] },
  { table: "event_logs", name: "idx_el_tool_id", columns: ["tool_id"] },
  { table: "event_logs", name: "idx_el_ad_id", columns: ["ad_id"] },
  { table: "event_logs", name: "idx_el_news_id", columns: ["news_id"] },
  { table: "tool_comments", name: "idx_tc_tool_status", columns: ["tool_id", "status"] },
  { table: "tool_comments", name: "idx_tc_parent_id", columns: ["parent_id"] },
  { table: "tool_comments", name: "idx_tc_created_at", columns: ["created_at"] },
  { table: "news_comments", name: "idx_nc_news_status", columns: ["news_id", "status"] },
  { table: "news_comments", name: "idx_nc_parent_id", columns: ["parent_id"] },
  { table: "news_comments", name: "idx_nc_created_at", columns: ["created_at"] },
];

async function indexExists(table, indexName) {
  const dialect = sequelize.getDialect();
  if (dialect === "mysql") {
    const [rows] = await sequelize.query(
      `SELECT 1 FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      { replacements: [table, indexName] }
    );
    return rows && rows.length > 0;
  }
  return false;
}

function quoteIdentifier(dialect, name) {
  return dialect === "mysql" ? "`" + name + "`" : '"' + name + '"';
}

async function main() {
  const dialect = sequelize.getDialect();
  for (const { table, name, columns } of INDEX_DEFS) {
    try {
      if (await indexExists(table, name)) {
        console.log(`Skip ${table}.${name} (already exists).`);
        continue;
      }
      const cols = columns.map((c) => quoteIdentifier(dialect, c)).join(", ");
      const q = `CREATE INDEX ${quoteIdentifier(dialect, name)} ON ${quoteIdentifier(dialect, table)} (${cols})`;
      await sequelize.query(q);
      console.log(`Created index ${table}.${name}.`);
    } catch (err) {
      if (err.message && (err.message.includes("Duplicate") || err.message.includes("already exists"))) {
        console.log(`Skip ${table}.${name} (already exists).`);
      } else {
        console.error(`Failed to create ${table}.${name}:`, err.message);
      }
    }
  }
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sequelize.close());
