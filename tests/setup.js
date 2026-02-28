/**
 * 测试环境设置
 */
const { Sequelize } = require('sequelize');
const path = require('path');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'tracking_analytics_test';
process.env.LOG_LEVEL = 'error';

// 测试数据库配置
const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  name: process.env.DB_NAME || 'tracking_analytics_test',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  dialect: 'mysql',
  logging: false // 测试时不输出 SQL 日志
};

// 创建测试数据库连接
const testSequelize = new Sequelize(
  testDbConfig.name,
  testDbConfig.user,
  testDbConfig.password,
  {
    host: testDbConfig.host,
    port: testDbConfig.port,
    dialect: testDbConfig.dialect,
    logging: testDbConfig.logging,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// 全局测试工具函数
global.testUtils = {
  // 创建测试数据
  createTestData: async (model, data) => {
    return await model.create(data);
  },
  
  // 清理测试数据
  cleanupTestData: async (model, condition = {}) => {
    return await model.destroy({ where: condition, force: true });
  },
  
  // 等待异步操作
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 生成随机字符串
  randomString: (length = 10) => {
    return Math.random().toString(36).substring(2, 2 + length);
  },
  
  // 生成随机数字
  randomNumber: (min = 1, max = 1000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};

// 测试钩子
beforeAll(async () => {
  try {
    // 测试数据库连接
    await testSequelize.authenticate();
    console.log('✅ 测试数据库连接成功');
    
    // 同步数据库表
    await testSequelize.sync({ force: true });
    console.log('✅ 测试数据库表同步成功');
  } catch (error) {
    console.error('❌ 测试数据库设置失败:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    // 关闭数据库连接
    await testSequelize.close();
    console.log('✅ 测试数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭测试数据库连接失败:', error);
  }
});

// 每个测试后清理数据
afterEach(async () => {
  try {
    // 清理所有测试数据
    const { Event, MetaEvent, EventProperty, UserProfile, AnalysisReport, OperatorEvent } = require('../models');
    
    await Event.destroy({ where: {}, force: true });
    await MetaEvent.destroy({ where: {}, force: true });
    await EventProperty.destroy({ where: {}, force: true });
    await UserProfile.destroy({ where: {}, force: true });
    await AnalysisReport.destroy({ where: {}, force: true });
    await OperatorEvent.destroy({ where: {}, force: true });
  } catch (error) {
    console.error('清理测试数据失败:', error);
  }
});

module.exports = {
  testSequelize,
  testDbConfig
};
