const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3099,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    // CORS允许的来源列表
    allowedOrigins: [
      'http://localhost:3011',
      'http://127.0.0.1:3011',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3022',
      'http://127.0.0.1:3022',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:10013',
      'http://127.0.0.1:10013',
      'http://10.19.1.236:10013', // 根据实际前端地址添加
      'https://beta-bigdataadmin2.suuyuu.cn',
      'https://beta-big-data-csite.suuyuu.cn'
    ]
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'bigdata',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'huyuxia63',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'  // 24小时过期
  },

  // AI配置  free
  ai: {
    free: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      model: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
      temperature: 0.7,
      maxTokens: 4000
    },
    paid: {
      apiKey: process.env.AI_GRADING_API_KEY || '',
      apiEndpoint: 'https://cloud.siliconflow.cn/v1/chat/completions',
      model: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
      temperature: 0.7,
      maxTokens: 4000
    }
  },

  // 文件上传配置
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    storagePath: process.env.UPLOAD_PATH || './uploads'
  },

  // API限流配置
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP每15分钟最多100个请求
    message: '请求过于频繁，请稍后再试'
  },
  email: {
    host: process.env.EMAIL_SERVER_HOST,
    port: process.env.EMAIL_SERVER_PORT,
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
    secure: process.env.EMAIL_SERVER_SECURE === 'true',
    from: process.env.EMAIL_FROM,
    debug: process.env.DEBUG_EMAIL === 'true'
  }
}; 