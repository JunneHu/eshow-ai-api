/**
 * 批量更新历史事件的IP地理位置信息
 * 用于补充历史数据中缺失的地理位置信息
 * 
 * 使用方法：
 * node scripts/update-geo-data.js [appId] [limit]
 * 
 * 示例：
 * node scripts/update-geo-data.js templatewapversion2 1000
 */

const { Event } = require('../models');
const geoIPService = require('../services/GeoIPService');
const { Op } = require('sequelize');

async function updateGeoData(appId = 'templatewapversion2', limit = 1000) {
  console.log(`开始更新地理位置数据，appId: ${appId}, 限制: ${limit} 条`);
  
  try {
    // 查询有IP地址但没有地理位置信息的事件
    const events = await Event.findAll({
      where: {
        app_id: appId,
        ip_address: {
          [Op.ne]: null,
          [Op.ne]: ''
        },
        [Op.or]: [
          { country: null },
          { country: '未知' },
          { province: null },
          { province: '未知' },
          { city: null },
          { city: '未知' }
        ]
      },
      limit: limit,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'ip_address', 'country', 'province', 'city']
    });

    console.log(`找到 ${events.length} 条需要更新的记录`);

    if (events.length === 0) {
      console.log('没有需要更新的记录');
      return;
    }

    // 收集所有唯一的IP地址
    const uniqueIPs = [...new Set(events.map(e => e.ip_address).filter(ip => ip))];
    console.log(`需要解析的IP地址数量: ${uniqueIPs.length}`);

    // 批量解析IP地址
    const geoResults = await geoIPService.parseIPs(uniqueIPs);

    // 更新数据库
    let updatedCount = 0;
    let skippedCount = 0;

    for (const event of events) {
      if (!event.ip_address) {
        skippedCount++;
        continue;
      }

      const geo = geoResults.get(event.ip_address);
      if (geo && (geo.country !== '未知' || geo.province !== '未知' || geo.city !== '未知')) {
        await Event.update(
          {
            country: geo.country,
            province: geo.province,
            city: geo.city
          },
          {
            where: { id: event.id }
          }
        );
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n更新完成:`);
    console.log(`- 成功更新: ${updatedCount} 条`);
    console.log(`- 跳过: ${skippedCount} 条`);
    console.log(`- 总计: ${events.length} 条`);

  } catch (error) {
    console.error('更新地理位置数据失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取参数
const appId = process.argv[2] || 'templatewapversion2';
const limit = parseInt(process.argv[3]) || 1000;

updateGeoData(appId, limit)
  .then(() => {
    console.log('\n脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

