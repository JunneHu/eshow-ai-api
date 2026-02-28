const { sequelize } = require('../config/database');
const { syncModels } = require('../models');
const testDatabaseConnection = require('./test-db');

async function setup() {
  try {
    console.log('🚀 开始设置数据库...');
    
    // 首先测试数据库连接
    const connectionSuccess = await testDatabaseConnection();
    if (!connectionSuccess) {
      console.error('❌ 数据库连接测试失败，请检查配置');
      process.exit(1);
    }
    
    // 测试Sequelize连接
    console.log('\n4️⃣ 测试Sequelize连接...');
    await sequelize.authenticate();
    console.log('✅ Sequelize连接成功');
    
    // 同步模型
    console.log('\n5️⃣ 创建数据表...');
    await syncModels();
    console.log('✅ 数据表创建成功');
    
    console.log('\n🎉 数据库设置完成！');
    console.log('\n📝 接下来可以运行:');
    console.log('   npm run dev    # 启动开发服务器');
    console.log('   或访问 http://localhost:80/demo.html 测试SDK');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 数据库设置失败:', error.message);
    
    if (error.name === 'SequelizeConnectionRefusedError') {
      console.log('\n💡 常见解决方案:');
      console.log('1. 启动MySQL服务');
      console.log('2. 检查.env文件中的数据库配置');
      console.log('3. 确保数据库用户有足够权限');
    }
    
    process.exit(1);
  }
}

setup();