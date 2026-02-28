/**
 * 测试事件属性API脚本
 * 用于验证重构后的EventPropertiesController功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:80/api/event-properties';

async function testEventPropertiesAPI() {
  console.log('开始测试事件属性API...\n');

  try {
    // 测试1: 获取事件属性列表
    console.log('1. 测试获取事件属性列表');
    const listResponse = await axios.get(`${BASE_URL}/list?page=1&pageSize=10`);
    console.log('状态码:', listResponse.status);
    console.log('返回数据:', JSON.stringify(listResponse.data, null, 2));
    console.log('');

    // 测试2: 获取事件属性详情
    console.log('2. 测试获取事件属性详情');
    const detailResponse = await axios.get(`${BASE_URL}/detail/$sat_has_installed_app`);
    console.log('状态码:', detailResponse.status);
    console.log('返回数据:', JSON.stringify(detailResponse.data, null, 2));
    console.log('');

    // 测试3: 创建新的事件属性
    console.log('3. 测试创建新的事件属性');
    const createData = {
      propertyName: 'test_property_' + Date.now(),
      displayName: '测试属性',
      dataType: 'string',
      description: '这是一个测试属性',
      isPublic: false,
      propertyType: 'custom',
      appId: 'default',
      isRequired: false
    };
    
    const createResponse = await axios.post(`${BASE_URL}/create`, createData);
    console.log('状态码:', createResponse.status);
    console.log('返回数据:', JSON.stringify(createResponse.data, null, 2));
    console.log('');

    const newPropertyId = createResponse.data.data.id;

    // 测试4: 更新事件属性
    console.log('4. 测试更新事件属性');
    const updateData = {
      displayName: '更新后的测试属性',
      description: '这是更新后的描述',
      isRequired: true
    };
    
    const updateResponse = await axios.put(`${BASE_URL}/update/${newPropertyId}`, updateData);
    console.log('状态码:', updateResponse.status);
    console.log('返回数据:', JSON.stringify(updateResponse.data, null, 2));
    console.log('');

    // 测试5: 导出事件属性
    console.log('5. 测试导出事件属性');
    const exportResponse = await axios.get(`${BASE_URL}/export?format=json`);
    console.log('状态码:', exportResponse.status);
    console.log('返回数据:', JSON.stringify(exportResponse.data, null, 2));
    console.log('');

    // 测试6: 删除事件属性
    console.log('6. 测试删除事件属性');
    const deleteResponse = await axios.delete(`${BASE_URL}/delete/${newPropertyId}`);
    console.log('状态码:', deleteResponse.status);
    console.log('返回数据:', JSON.stringify(deleteResponse.data, null, 2));
    console.log('');

    // 测试7: 搜索功能
    console.log('7. 测试搜索功能');
    const searchResponse = await axios.get(`${BASE_URL}/list?search=sf&page=1&pageSize=5`);
    console.log('状态码:', searchResponse.status);
    console.log('返回数据:', JSON.stringify(searchResponse.data, null, 2));
    console.log('');

    // 测试8: 筛选功能
    console.log('8. 测试筛选功能');
    const filterResponse = await axios.get(`${BASE_URL}/list?dataType=string&displayStatus=visible&page=1&pageSize=5`);
    console.log('状态码:', filterResponse.status);
    console.log('返回数据:', JSON.stringify(filterResponse.data, null, 2));
    console.log('');

    console.log('所有API测试完成！');

  } catch (error) {
    console.error('API测试失败:', error.response?.data || error.message);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testEventPropertiesAPI()
    .then(() => {
      console.log('测试脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('测试脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testEventPropertiesAPI };
