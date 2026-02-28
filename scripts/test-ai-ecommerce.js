/**
 * 测试电商AI分析功能
 * 
 * 使用方法：
 * 1. 确保API服务器正在运行（npm start）
 * 2. 运行此脚本：node scripts/test-ai-ecommerce.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:80';

// 测试用户ID和商品ID（根据实际数据调整）
const TEST_USER_ID = 'test_user_001';
const TEST_PRODUCT_ID = 'test_product_001';
const TEST_APP_ID = 'templatewapversion2';

/**
 * 测试购买意向分析
 */
async function testPurchaseIntent() {
  console.log('\n=== 测试购买意向分析 ===');
  try {
    const response = await axios.get(`${BASE_URL}/api/ai/ecommerce/purchase-intent`, {
      params: {
        userId: TEST_USER_ID,
        productId: TEST_PRODUCT_ID,
        timeRange: '7d',
        appId: TEST_APP_ID
      }
    });

    console.log('状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试流失风险分析
 */
async function testChurnRisk() {
  console.log('\n=== 测试流失风险分析 ===');
  try {
    const response = await axios.get(`${BASE_URL}/api/ai/ecommerce/churn-risk`, {
      params: {
        userId: TEST_USER_ID,
        timeRange: '30d',
        appId: TEST_APP_ID
      }
    });

    console.log('状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试商品推荐分析
 */
async function testProductRecommendation() {
  console.log('\n=== 测试商品推荐分析 ===');
  try {
    const response = await axios.get(`${BASE_URL}/api/ai/ecommerce/product-recommendation`, {
      params: {
        userId: TEST_USER_ID,
        timeRange: '30d',
        appId: TEST_APP_ID
      }
    });

    console.log('状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试活动优化分析
 */
async function testCampaignOptimization() {
  console.log('\n=== 测试活动优化分析 ===');
  try {
    const campaignData = {
      campaign_name: '双十一大促',
      start_time: '2025-11-01',
      end_time: '2025-11-11',
      discount_rate: 0.2,
      target_audience: '所有用户'
    };

    const campaignResults = {
      total_users: 10000,
      total_gmv: 500000,
      conversion_rate: 0.05,
      roi: 1.5
    };

    const response = await axios.post(`${BASE_URL}/api/ai/ecommerce/campaign-optimization`, {
      campaignData,
      campaignResults,
      historicalData: {}
    });

    console.log('状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试商品销售趋势分析
 */
async function testProductSalesTrend() {
  console.log('\n=== 测试商品销售趋势分析 ===');
  try {
    const response = await axios.get(`${BASE_URL}/api/ai/ecommerce/product-sales-trend`, {
      params: {
        productId: TEST_PRODUCT_ID,
        timeRange: '90d',
        appId: TEST_APP_ID
      }
    });

    console.log('状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('开始测试电商AI分析功能...');
  console.log('请确保API服务器正在运行在', BASE_URL);

  await testPurchaseIntent();
  await testChurnRisk();
  await testProductRecommendation();
  await testCampaignOptimization();
  await testProductSalesTrend();

  console.log('\n所有测试完成！');
}

// 运行测试
runAllTests().catch(console.error);

