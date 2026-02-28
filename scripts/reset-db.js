const { sequelize } = require('../config/database');
const { Event, OperatorEvent, UserProfile } = require('../models');

async function resetDatabase() {
  try {
    console.log('🔄 开始重置数据库...');
    
    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 删除所有表
    console.log('🗑️  删除现有表...');
    await sequelize.drop();
    console.log('✅ 现有表已删除');
    
    // 重新创建表
    console.log('🏗️  创建新表结构...');
    await Event.sync({ force: true });
    await OperatorEvent.sync({ force: true });
    await UserProfile.sync({ force: true });
    console.log('✅ 新表结构创建成功');
    
    console.log('🎉 数据库重置完成！');
    console.log('\n📝 接下来可以运行:');
    console.log('   npm run dev    # 启动开发服务器');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库重置失败:', error.message);
    if (error.original) {
      console.error('原始错误:', error.original.message);
    }
    process.exit(1);
  }
}

resetDatabase();