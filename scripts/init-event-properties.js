/**
 * 初始化事件属性数据脚本
 * 用于创建一些示例事件属性数据
 */

const { EventProperty } = require('../models');
const { sequelize } = require('../config/database');

async function initEventProperties() {
  try {
    console.log('开始初始化事件属性数据...');

    console.log('事件属性初始化脚本已停用：请在后台页面自行创建/管理事件属性。');
    return;

  } catch (error) {
    console.error('初始化事件属性数据失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initEventProperties()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { initEventProperties };
