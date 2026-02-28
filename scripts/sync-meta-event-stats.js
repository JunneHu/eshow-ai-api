/**
 * 同步元事件的统计数据
 * 从 events 表中统计每个事件的数据量，更新到 meta_events 表的 has_data 和 data_count_30d 字段
 */
const { MetaEvent, Event } = require('../models');
const { Op, fn, col } = require('sequelize');

(async () => {
  try {
    console.log('开始同步元事件统计数据...\n');
    
    // 获取所有元事件
    const metaEvents = await MetaEvent.findAll({
      attributes: ['id', 'event_name', 'app_id', 'has_data', 'data_count_30d']
    });
    
    console.log(`找到 ${metaEvents.length} 个元事件\n`);
    
    // 计算30天前的日期
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let updatedCount = 0;
    let noDataCount = 0;
    
    for (const metaEvent of metaEvents) {
      // 统计过去30天的事件数量（不限制 app_id，因为 event_name 是唯一的）
      const eventCount = await Event.count({
        where: {
          event_name: metaEvent.event_name,
          created_at: {
            [Op.gte]: thirtyDaysAgo
          }
        }
      });
      
      // 检查是否有任何数据（不限时间）
      const hasAnyData = await Event.count({
        where: {
          event_name: metaEvent.event_name
        },
        limit: 1
      }) > 0;
      
      const shouldUpdate = 
        metaEvent.has_data !== hasAnyData || 
        metaEvent.data_count_30d !== eventCount;
      
      if (shouldUpdate) {
        await MetaEvent.update(
          {
            has_data: hasAnyData,
            data_count_30d: eventCount
          },
          {
            where: {
              id: metaEvent.id
            }
          }
        );
        
        console.log(`✅ ${metaEvent.event_name}: has_data=${hasAnyData}, data_count_30d=${eventCount}`);
        updatedCount++;
      } else {
        if (hasAnyData) {
          console.log(`ℹ️  ${metaEvent.event_name}: 数据已是最新 (has_data=${hasAnyData}, data_count_30d=${eventCount})`);
        } else {
          noDataCount++;
        }
      }
    }
    
    console.log(`\n同步完成！`);
    console.log(`- 更新了 ${updatedCount} 个元事件的统计数据`);
    console.log(`- ${noDataCount} 个元事件仍无数据`);
    
    process.exit(0);
  } catch (e) {
    console.error('同步失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();

