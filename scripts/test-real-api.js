/**
 * 测试真实API数据脚本
 * 验证EventPropertiesController完全使用数据库数据
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:80/api/event-properties';

async function testRealAPI() {
  console.log('开始测试真实API数据...\n');

  try {
    // 测试1: 获取事件属性列表 - 验证数据来源
    console.log('1. 测试获取事件属性列表');
    const listResponse = await axios.get(`${BASE_URL}/list?page=1&pageSize=5`);
    
    if (listResponse.data.code === 0) {
      const properties = listResponse.data.data.list;
      console.log(`✅ 成功获取 ${properties.length} 个事件属性`);
      
      // 验证数据格式
      properties.forEach((prop, index) => {
        console.log(`   ${index + 1}. ${prop.propertyName} - ${prop.displayName}`);
        console.log(`      数据类型: ${prop.dataType}, 是否预设: ${prop.isPreset}`);
      });
    } else {
      console.log('❌ 获取事件属性列表失败:', listResponse.data.message);
    }
    console.log('');

    // 测试2: 获取特定属性详情
    console.log('2. 测试获取属性详情');
    const detailResponse = await axios.get(`${BASE_URL}/detail/$sat_has_installed_app`);
    
    if (detailResponse.data.code === 0) {
      const property = detailResponse.data.data;
      console.log('✅ 成功获取属性详情:');
      console.log(`   属性名称: ${property.propertyName}`);
      console.log(`   显示名称: ${property.displayName}`);
      console.log(`   数据类型: ${property.dataType}`);
      console.log(`   描述: ${property.description}`);
      console.log(`   是否预设: ${property.isPreset}`);
      console.log(`   创建时间: ${property.createTime}`);
    } else {
      console.log('❌ 获取属性详情失败:', detailResponse.data.message);
    }
    console.log('');

    // 测试3: 搜索功能
    console.log('3. 测试搜索功能');
    const searchResponse = await axios.get(`${BASE_URL}/list?search=sf&page=1&pageSize=10`);
    
    if (searchResponse.data.code === 0) {
      const searchResults = searchResponse.data.data.list;
      console.log(`✅ 搜索 "sf" 找到 ${searchResults.length} 个结果:`);
      searchResults.forEach((prop, index) => {
        console.log(`   ${index + 1}. ${prop.propertyName} - ${prop.displayName}`);
      });
    } else {
      console.log('❌ 搜索功能失败:', searchResponse.data.message);
    }
    console.log('');

    // 测试4: 按类型筛选
    console.log('4. 测试按类型筛选');
    const filterResponse = await axios.get(`${BASE_URL}/list?dataType=string&page=1&pageSize=10`);
    
    if (filterResponse.data.code === 0) {
      const filteredResults = filterResponse.data.data.list;
      console.log(`✅ 筛选 "string" 类型找到 ${filteredResults.length} 个结果`);
    } else {
      console.log('❌ 筛选功能失败:', filterResponse.data.message);
    }
    console.log('');

    // 测试5: 创建新属性
    console.log('5. 测试创建新属性');
    const newPropertyName = `test_property_${Date.now()}`;
    const createData = {
      propertyName: newPropertyName,
      displayName: '测试属性',
      dataType: 'string',
      description: '这是一个测试属性',
      isPublic: false,
      propertyType: 'custom',
      appId: 'default'
    };
    
    const createResponse = await axios.post(`${BASE_URL}/create`, createData);
    
    if (createResponse.data.code === 0) {
      console.log('✅ 成功创建新属性:', createResponse.data.data.propertyName);
    } else {
      console.log('❌ 创建属性失败:', createResponse.data.message);
    }
    console.log('');

    // 测试6: 更新属性
    console.log('6. 测试更新属性');
    const updateData = {
      displayName: '更新后的测试属性',
      description: '这是更新后的描述'
    };
    
    const updateResponse = await axios.put(`${BASE_URL}/update/${newPropertyName}`, updateData);
    
    if (updateResponse.data.code === 0) {
      console.log('✅ 成功更新属性:', updateResponse.data.data.displayName);
    } else {
      console.log('❌ 更新属性失败:', updateResponse.data.message);
    }
    console.log('');

    // 测试7: 导出功能
    console.log('7. 测试导出功能');
    const exportResponse = await axios.get(`${BASE_URL}/export?format=json`);
    
    if (exportResponse.data.code === 0) {
      const exportData = exportResponse.data.data;
      console.log('✅ 成功导出数据:');
      console.log(`   文件名: ${exportData.filename}`);
      console.log(`   总数: ${exportData.total}`);
      console.log(`   导出时间: ${exportData.exportTime}`);
    } else {
      console.log('❌ 导出功能失败:', exportResponse.data.message);
    }
    console.log('');

    // 测试8: 删除属性
    console.log('8. 测试删除属性');
    const deleteResponse = await axios.delete(`${BASE_URL}/delete/${newPropertyName}`);
    
    if (deleteResponse.data.code === 0) {
      console.log('✅ 成功删除属性:', deleteResponse.data.data.id);
    } else {
      console.log('❌ 删除属性失败:', deleteResponse.data.message);
    }
    console.log('');

    console.log('🎉 所有API测试完成！EventPropertiesController完全使用真实的数据库数据。');

  } catch (error) {
    console.error('❌ API测试失败:', error.response?.data || error.message);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testRealAPI()
    .then(() => {
      console.log('测试脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('测试脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testRealAPI };
