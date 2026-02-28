const { sequelize } = require('../config/database');

async function checkEvents() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');
    
    // 检查今日事件类型分布
    console.log('📊 今日事件类型分布:');
    const todayEvents = await sequelize.query(`
      SELECT 
        event_type, 
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as users_with_id,
        COUNT(DISTINCT distinct_id) as users_with_distinct_id,
        COUNT(DISTINCT COALESCE(user_id, distinct_id)) as total_unique_users
      FROM events 
      WHERE DATE(created_at) = CURDATE() 
      GROUP BY event_type 
      ORDER BY count DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    todayEvents.forEach(event => {
      console.log(`   ${event.event_type}: ${event.count} 事件, ${event.total_unique_users} 独立用户`);
    });
    
    // 检查最近的事件
    console.log('\n📝 最近10条事件:');
    const recentEvents = await sequelize.query(`
      SELECT 
        event_type,
        event_name,
        user_id,
        distinct_id,
        app_id,
        created_at
      FROM events 
      ORDER BY created_at DESC 
      LIMIT 10
    `, { type: sequelize.QueryTypes.SELECT });
    
    recentEvents.forEach(event => {
      console.log(`   ${event.created_at} | ${event.event_type} | ${event.event_name || 'N/A'} | ${event.app_id} | user:${event.user_id || 'null'} | distinct:${event.distinct_id || 'null'}`);
    });
    
    // 检查page_view事件
    console.log('\n🔍 page_view 事件统计:');
    const pageViewStats = await sequelize.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as pv,
        COUNT(DISTINCT COALESCE(user_id, distinct_id)) as uv
      FROM events 
      WHERE event_type = 'page_view' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (pageViewStats.length === 0) {
      console.log('   ❌ 没有找到 page_view 事件');
    } else {
      pageViewStats.forEach(stat => {
        console.log(`   ${stat.date}: PV=${stat.pv}, UV=${stat.uv}`);
      });
    }
    
    // 检查$pageview事件（神策风格）
    console.log('\n🔍 $pageview 事件统计:');
    const sensorsPageViewStats = await sequelize.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as pv,
        COUNT(DISTINCT COALESCE(user_id, distinct_id)) as uv
      FROM events 
      WHERE event_name = '$pageview' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (sensorsPageViewStats.length === 0) {
      console.log('   ❌ 没有找到 $pageview 事件');
    } else {
      sensorsPageViewStats.forEach(stat => {
        console.log(`   ${stat.date}: PV=${stat.pv}, UV=${stat.uv}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkEvents();