/*
 * @Author: JunneyHu
 * @Date: 2025-05-29 16:56:25
 * @LastEditor: ${CURRENT_USER}
 * @LastEditTime: 2026-01-23 17:14:10
 * @FilePath: \big-data\big-data-api\config\database.js
 */
// config/database.js
const { Sequelize } = require('sequelize');
const config = require('./config');

const dbState = {
  ready: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
};

function formatDbError(error) {
  if (!error) return null;
  const original = error.original || error;
  return {
    name: error.name,
    message: error.message,
    code: original && original.code,
    errno: original && original.errno,
    sqlState: original && original.sqlState,
  };
}

// 创建默认数据库连接
const sequelize = new Sequelize(
  config.database.name,
  config.database.user,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: 'mysql',
    logging: config.server.logLevel === 'debug' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      modelName: true
    },
    dialectOptions: {
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: true
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const getDbState = () => ({ ...dbState });
const isDbReady = () => Boolean(dbState.ready);

// 测试数据库连接
const testConnection = async (options = {}) => {
  const { silent = false, updateState = true } = options;
  try {
    if (updateState) dbState.lastAttemptAt = new Date().toISOString();
    await sequelize.authenticate();
    if (updateState) {
      dbState.ready = true;
      dbState.lastSuccessAt = new Date().toISOString();
      dbState.lastError = null;
      dbState.lastErrorAt = null;
    }
    if (!silent) console.log('数据库连接成功');
    return true;
  } catch (error) {
    if (updateState) {
      dbState.ready = false;
      dbState.lastErrorAt = new Date().toISOString();
      dbState.lastError = formatDbError(error);
    }
    if (!silent) console.error('数据库连接失败:', error.message);
    return false;
  }
};

// 初始化数据库
const initDatabase = async (options = {}) => {
  const { silent = false } = options;
  try {
    // 1. 验证数据库连接
    dbState.lastAttemptAt = new Date().toISOString();
    await sequelize.authenticate();
    dbState.ready = true;
    dbState.lastSuccessAt = new Date().toISOString();
    dbState.lastError = null;
    dbState.lastErrorAt = null;
    if (!silent) console.log('✅ 数据库连接成功');

    // 注意：不在此处做 sequelize.sync。
    // 表结构同步与初始化由上层的 models.syncModels() 统一负责，且具备生产环境禁用 alter 的开关。
    return true;
  } catch (error) {
    dbState.ready = false;
    dbState.lastErrorAt = new Date().toISOString();
    dbState.lastError = formatDbError(error);
    if (!silent) {
      console.error('❌ 数据库初始化失败:', error.message);
      if (error.original) {
        console.error('原始错误:', error.original.message);
      }
    }
    return false;
  }
};

module.exports = {
  sequelize,
  getDbState,
  isDbReady,
  testConnection,
  initDatabase
};