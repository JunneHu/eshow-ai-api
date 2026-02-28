const mysql = require('mysql2/promise');
const config = require('../config/config');

async function testDatabaseConnection() {
  console.log('🔍 测试数据库连接...');
  console.log('配置信息:', {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    database: config.database.name
  });

  try {
    // 首先测试连接到MySQL服务器（不指定数据库）
    console.log('\n1️⃣ 测试MySQL服务器连接...');
    const connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password
    });
    
    console.log('✅ MySQL服务器连接成功');
    
    // 检查数据库是否存在
    console.log('\n2️⃣ 检查数据库是否存在...');
    const [databases] = await connection.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === config.database.name);
    
    if (!dbExists) {
      console.log(`⚠️  数据库 '${config.database.name}' 不存在，正在创建...`);
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.database.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ 数据库 '${config.database.name}' 创建成功`);
    } else {
      console.log(`✅ 数据库 '${config.database.name}' 已存在`);
    }
    
    // 测试连接到指定数据库
    console.log('\n3️⃣ 测试连接到指定数据库...');
    await connection.changeUser({
      database: config.database.name
    });
    console.log('✅ 连接到指定数据库成功');
    
    await connection.end();
    console.log('\n🎉 数据库连接测试完成！');
    return true;
    
  } catch (error) {
    console.error('\n❌ 数据库连接失败:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 解决建议:');
      console.log('1. 确保MySQL服务正在运行');
      console.log('2. 检查端口号是否正确 (默认3306)');
      console.log('3. 检查防火墙设置');
      console.log('4. 验证用户名和密码');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 解决建议:');
      console.log('1. 检查用户名和密码是否正确');
      console.log('2. 确保用户有足够的权限');
    }
    
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testDatabaseConnection().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = testDatabaseConnection;