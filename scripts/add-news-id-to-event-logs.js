/**
 * 为 event_logs 表添加 news_id 列（资讯埋点用）
 * 用法: node scripts/add-news-id-to-event-logs.js
 */
const { sequelize } = require('../config/database');

async function main() {
  try {
    const dialect = sequelize.getDialect();
    const tableName = 'event_logs';
    const columnName = 'news_id';

    if (dialect === 'mysql') {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        { replacements: [tableName, columnName] }
      );
      if (rows && rows.length > 0) {
        console.log('Column news_id already exists in event_logs, skip.');
        process.exit(0);
        return;
      }
      await sequelize.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` INT UNSIGNED NULL AFTER \`ad_id\``
      );
      console.log('Added column news_id to event_logs.');
    } else {
      await sequelize.query(
        `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" INTEGER NULL`
      );
      console.log('Added column news_id to event_logs.');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
