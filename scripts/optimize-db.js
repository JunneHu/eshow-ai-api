/**
 * 数据库优化脚本 - 第一阶段完善版
 * 功能：索引优化、数据清理、性能监控
 */

const { sequelize } = require('../config/database');
const { Event, OperatorEvent, UserProfile } = require('../models');

class DatabaseOptimizer {
  
  /**
   * 创建优化索引
   */
  static async createOptimizedIndexes() {
    console.log('🔧 开始创建优化索引...');
    
    try {
      // 复合索引优化查询性能
      const indexes = [
        // 时间范围查询优化
        'CREATE INDEX IF NOT EXISTS idx_events_time_app ON events(created_at, app_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_time_user ON events(created_at, user_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_time_type ON events(created_at, event_type)',
        
        // 用户行为分析优化
        'CREATE INDEX IF NOT EXISTS idx_events_user_time_type ON events(user_id, created_at, event_type)',
        'CREATE INDEX IF NOT EXISTS idx_events_session_time ON events(session_id, created_at)',
        
        // 页面分析优化
        'CREATE INDEX IF NOT EXISTS idx_events_url_time ON events(page_url(100), created_at)',
        'CREATE INDEX IF NOT EXISTS idx_events_app_url_time ON events(app_id, page_url(100), created_at)',
        
        // 运营事件优化
        'CREATE INDEX IF NOT EXISTS idx_operator_events_time_type ON operator_events(created_at, event_type)',
        'CREATE INDEX IF NOT EXISTS idx_operator_events_operator_time ON operator_events(operator_id, created_at)',
        
        // 用户画像优化
        'CREATE INDEX IF NOT EXISTS idx_user_profiles_app_updated ON user_profiles(app_id, updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_user_profiles_visit_time ON user_profiles(last_visit_time)'
      ];
      
      for (const indexSql of indexes) {
        try {
          await sequelize.query(indexSql);
          console.log('✅ 索引创建成功:', indexSql.split(' ON ')[1]);
        } catch (error) {
          console.log('⚠️  索引创建跳过:', error.message);
        }
      }
      
      console.log('✅ 索引优化完成');
    } catch (error) {
      console.error('❌ 索引创建失败:', error);
    }
  }
  
  /**
   * 数据清理 - 删除过期数据
   */
  static async cleanupOldData(retentionDays = 90) {
    console.log(`🧹 开始清理 ${retentionDays} 天前的数据...`);
    
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // 清理过期事件数据
      const deletedEvents = await Event.destroy({
        where: {
          created_at: {
            [sequelize.Sequelize.Op.lt]: cutoffDate
          }
        }
      });
      
      // 清理过期运营事件
      const deletedOperatorEvents = await OperatorEvent.destroy({
        where: {
          created_at: {
            [sequelize.Sequelize.Op.lt]: cutoffDate
          }
        }
      });
      
      console.log(`✅ 数据清理完成:`);
      console.log(`   - 删除事件记录: ${deletedEvents} 条`);
      console.log(`   - 删除运营记录: ${deletedOperatorEvents} 条`);
      
      // 优化表空间
      await this.optimizeTableSpace();
      
    } catch (error) {
      console.error('❌ 数据清理失败:', error);
    }
  }
  
  /**
   * 优化表空间
   */
  static async optimizeTableSpace() {
    console.log('🔧 开始优化表空间...');
    
    try {
      const tables = ['events', 'operator_events', 'user_profiles'];
      
      for (const table of tables) {
        await sequelize.query(`OPTIMIZE TABLE ${table}`);
        console.log(`✅ 表 ${table} 优化完成`);
      }
    } catch (error) {
      console.error('❌ 表空间优化失败:', error);
    }
  }
  
  /**
   * 数据库性能监控
   */
  static async performanceMonitor() {
    console.log('📊 开始性能监控...');
    
    try {
      // 检查表大小
      const tableSizes = await sequelize.query(`
        SELECT 
          table_name,
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
          table_rows
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        AND table_name IN ('events', 'operator_events', 'user_profiles')
        ORDER BY (data_length + index_length) DESC
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.log('📊 表大小统计:');
      tableSizes.forEach(table => {
        console.log(`   ${table.table_name}: ${table.size_mb}MB (${table.table_rows} 行)`);
      });
      
      // 检查慢查询
      const slowQueries = await sequelize.query(`
        SELECT 
          query_time,
          lock_time,
          rows_sent,
          rows_examined,
          sql_text
        FROM mysql.slow_log 
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ORDER BY query_time DESC 
        LIMIT 10
      `, { type: sequelize.QueryTypes.SELECT });
      
      if (slowQueries.length > 0) {
        console.log('⚠️  发现慢查询:');
        slowQueries.forEach((query, index) => {
          console.log(`   ${index + 1}. 执行时间: ${query.query_time}s`);
          console.log(`      SQL: ${query.sql_text.substring(0, 100)}...`);
        });
      } else {
        console.log('✅ 未发现慢查询');
      }
      
      // 检查索引使用情况
      const indexUsage = await sequelize.query(`
        SELECT 
          table_name,
          index_name,
          cardinality,
          CASE 
            WHEN cardinality = 0 THEN '未使用'
            WHEN cardinality < 100 THEN '低效'
            ELSE '正常'
          END as status
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE()
        AND table_name IN ('events', 'operator_events', 'user_profiles')
        ORDER BY table_name, cardinality DESC
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.log('📊 索引使用情况:');
      indexUsage.forEach(index => {
        console.log(`   ${index.table_name}.${index.index_name}: ${index.status} (基数: ${index.cardinality})`);
      });
      
    } catch (error) {
      console.error('❌ 性能监控失败:', error);
    }
  }
  
  /**
   * 数据统计报告
   */
  static async generateDataReport() {
    console.log('📈 生成数据统计报告...');
    
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // 今日数据统计
      const todayStats = await Event.findAll({
        attributes: [
          'app_id',
          [sequelize.fn('COUNT', '*'), 'total_events'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.literal('COALESCE(user_id, distinct_id)'))), 'unique_users'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN event_type = "page_view" THEN 1 END')), 'page_views']
        ],
        where: {
          created_at: { [sequelize.Sequelize.Op.gte]: today }
        },
        group: ['app_id']
      });
      
      // 昨日数据统计
      const yesterdayStats = await Event.findAll({
        attributes: [
          'app_id',
          [sequelize.fn('COUNT', '*'), 'total_events'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.literal('COALESCE(user_id, distinct_id)'))), 'unique_users']
        ],
        where: {
          created_at: { 
            [sequelize.Sequelize.Op.gte]: yesterday,
            [sequelize.Sequelize.Op.lt]: today
          }
        },
        group: ['app_id']
      });
      
      // 本周数据统计
      const weekStats = await Event.findAll({
        attributes: [
          'app_id',
          [sequelize.fn('COUNT', '*'), 'total_events'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.literal('COALESCE(user_id, distinct_id)'))), 'unique_users']
        ],
        where: {
          created_at: { [sequelize.Sequelize.Op.gte]: weekAgo }
        },
        group: ['app_id']
      });
      
      console.log('📈 数据统计报告:');
      console.log('==========================================');
      
      // 按应用展示统计
      const allApps = [...new Set([
        ...todayStats.map(s => s.app_id),
        ...yesterdayStats.map(s => s.app_id),
        ...weekStats.map(s => s.app_id)
      ])];
      
      allApps.forEach(appId => {
        const todayData = todayStats.find(s => s.app_id === appId);
        const yesterdayData = yesterdayStats.find(s => s.app_id === appId);
        const weekData = weekStats.find(s => s.app_id === appId);
        
        console.log(`\n📱 应用: ${appId}`);
        console.log(`   今日: ${todayData ? todayData.dataValues.total_events : 0} 事件, ${todayData ? todayData.dataValues.unique_users : 0} 用户`);
        console.log(`   昨日: ${yesterdayData ? yesterdayData.dataValues.total_events : 0} 事件, ${yesterdayData ? yesterdayData.dataValues.unique_users : 0} 用户`);
        console.log(`   本周: ${weekData ? weekData.dataValues.total_events : 0} 事件, ${weekData ? weekData.dataValues.unique_users : 0} 用户`);
      });
      
      console.log('\n==========================================');
      
    } catch (error) {
      console.error('❌ 数据报告生成失败:', error);
    }
  }
  
  /**
   * 执行完整优化流程
   */
  static async runFullOptimization() {
    console.log('🚀 开始数据库完整优化流程...\n');
    
    await this.createOptimizedIndexes();
    console.log('');
    
    await this.performanceMonitor();
    console.log('');
    
    await this.generateDataReport();
    console.log('');
    
    console.log('✅ 数据库优化完成！');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ 数据库连接成功\n');
      
      switch (command) {
        case 'indexes':
          await DatabaseOptimizer.createOptimizedIndexes();
          break;
        case 'cleanup':
          const days = parseInt(args[1]) || 90;
          await DatabaseOptimizer.cleanupOldData(days);
          break;
        case 'monitor':
          await DatabaseOptimizer.performanceMonitor();
          break;
        case 'report':
          await DatabaseOptimizer.generateDataReport();
          break;
        case 'full':
        default:
          await DatabaseOptimizer.runFullOptimization();
          break;
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ 优化过程出错:', error);
      process.exit(1);
    }
  })();
}

module.exports = DatabaseOptimizer;