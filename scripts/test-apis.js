const axios = require('axios');

const API_BASE = configs.host.webapi;

async function testAPIs() {
  console.log('🧪 测试API接口...\n');
  
  try {
    // 测试实时统计
    console.log('📊 测试实时统计接口:');
    const realtimeResponse = await axios.get(`${API_BASE}/api/analytics/realtime`);
    const realtimeData = realtimeResponse.data;
    
    if (realtimeData.code === 0) {
      console.log('✅ 实时统计接口正常');
      console.log(`   今日PV: ${realtimeData.data.today.pv}`);
      console.log(`   今日UV: ${realtimeData.data.today.uv}`);
      console.log(`   在线用户: ${realtimeData.data.online_users}`);
    } else {
      console.log('❌ 实时统计接口异常:', realtimeData.message);
    }
    
    // 测试应用列表
    console.log('\n📱 测试应用列表接口:');
    const appsResponse = await axios.get(`${API_BASE}/api/analytics/apps`);
    const appsData = appsResponse.data;
    
    if (appsData.code === 0) {
      console.log('✅ 应用列表接口正常');
      appsData.data.apps.forEach(app => {
        console.log(`   ${app.app_id}: ${app.total_events} 事件, ${app.total_users} 用户`);
      });
    } else {
      console.log('❌ 应用列表接口异常:', appsData.message);
    }
    
    // 测试应用统计（如果有sensors-demo应用）
    console.log('\n📈 测试应用统计接口 (sensors-demo):');
    const appStatsResponse = await axios.get(`${API_BASE}/api/analytics/app/stats?appId=sensors-demo&timeRange=7d`);
    const appStatsData = appStatsResponse.data;
    
    if (appStatsData.code === 0) {
      console.log('✅ 应用统计接口正常');
      console.log(`   PV: ${appStatsData.data.summary.pv}`);
      console.log(`   UV: ${appStatsData.data.summary.uv}`);
    } else {
      console.log('❌ 应用统计接口异常:', appStatsData.message);
    }
    
    console.log('\n🎉 API测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testAPIs();