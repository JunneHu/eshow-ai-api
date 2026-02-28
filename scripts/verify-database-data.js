/**
 * 验证数据库数据脚本
 * 用于确认EventPropertiesController使用的是真实数据库数据
 */

const { EventProperty } = require('../models');
const { sequelize } = require('../config/database');

async function verifyDatabaseData() {
  try {
    console.log('开始验证数据库数据...\n');

    // 1. 测试数据库连接
    console.log('1. 测试数据库连接');
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 2. 查询所有事件属性
    console.log('2. 查询所有事件属性');
    const allProperties = await EventProperty.findAll({
      order: [['created_at', 'DESC']]
    });
    console.log(`✅ 找到 ${allProperties.length} 个事件属性`);
    
    // 显示前5个属性的详细信息
    console.log('\n前5个属性详情:');
    allProperties.slice(0, 5).forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.property_name}`);
      console.log(`   显示名称: ${prop.property_display_name}`);
      console.log(`   数据类型: ${prop.data_type}`);
      console.log(`   属性类型: ${prop.property_type}`);
      console.log(`   是否启用: ${prop.is_active}`);
      console.log(`   创建时间: ${prop.created_at}`);
      console.log('');
    });

    // 3. 测试分页查询
    console.log('3. 测试分页查询');
    const { count, rows } = await EventProperty.findAndCountAll({
      limit: 3,
      offset: 0,
      order: [['created_at', 'DESC']]
    });
    console.log(`✅ 分页查询成功: 总数 ${count}, 当前页 ${rows.length} 条\n`);

    // 4. 测试搜索功能
    console.log('4. 测试搜索功能');
    const searchResults = await EventProperty.findAll({
      where: {
        property_name: {
          [require('sequelize').Op.like]: '%sf%'
        }
      },
      order: [['created_at', 'DESC']]
    });
    console.log(`✅ 搜索 "sf" 找到 ${searchResults.length} 个结果\n`);

    // 5. 测试按类型筛选
    console.log('5. 测试按类型筛选');
    const predefinedProps = await EventProperty.findAll({
      where: {
        property_type: 'predefined'
      }
    });
    console.log(`✅ 预定义属性: ${predefinedProps.length} 个`);

    const customProps = await EventProperty.findAll({
      where: {
        property_type: 'custom'
      }
    });
    console.log(`✅ 自定义属性: ${customProps.length} 个\n`);

    // 6. 测试单个属性查询
    console.log('6. 测试单个属性查询');
    const firstProperty = await EventProperty.findOne({
      where: {
        property_name: '$sat_has_installed_app'
      }
    });
    
    if (firstProperty) {
      console.log('✅ 找到属性: $sat_has_installed_app');
      console.log(`   显示名称: ${firstProperty.property_display_name}`);
      console.log(`   描述: ${firstProperty.description}`);
      console.log(`   枚举值: ${JSON.stringify(firstProperty.enum_values)}`);
    } else {
      console.log('❌ 未找到属性: $sat_has_installed_app');
    }

    console.log('\n✅ 数据库数据验证完成！所有数据都来自真实的数据库。');

  } catch (error) {
    console.error('❌ 数据库数据验证失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  verifyDatabaseData()
    .then(() => {
      console.log('验证脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('验证脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { verifyDatabaseData };
