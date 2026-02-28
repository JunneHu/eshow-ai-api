/**
 * 全埋点数据分析平台配置文件
 */
module.exports = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3099,
        host: process.env.HOST || '0.0.0.0',
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            credentials: true
        }
    },
    
    // 数据库配置
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'analytics_db',
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000
    },
    
    // 数据采集配置
    tracking: {
        // 批量处理大小
        batchSize: 100,
        // 数据保留天数
        dataRetentionDays: 90,
        // 采样率 (0-1)
        sampleRate: 1.0,
        // 是否启用IP地理位置解析
        enableGeoIP: true,
        // 是否启用用户代理解析
        enableUserAgentParsing: true
    },
    
    // 性能监控配置
    performance: {
        // 是否启用性能监控
        enabled: true,
        // 性能数据采样率
        sampleRate: 0.1,
        // 慢查询阈值(毫秒)
        slowQueryThreshold: 1000,
        // 内存使用警告阈值(MB)
        memoryWarningThreshold: 512
    },
    
    // 实时监控配置
    realtime: {
        // 是否启用实时监控
        enabled: true,
        // 实时数据更新间隔(秒)
        updateInterval: 5,
        // 在线用户超时时间(分钟)
        userTimeoutMinutes: 30,
        // 实时事件缓存大小
        eventCacheSize: 1000
    },
    
    // 数据导出配置
    export: {
        // 单次导出最大记录数
        maxRecords: 100000,
        // 导出文件临时目录
        tempDir: './temp/exports',
        // 支持的导出格式
        supportedFormats: ['csv', 'json', 'xlsx'],
        // 导出文件保留时间(小时)
        fileRetentionHours: 24
    },
    
    // 安全配置
    security: {
        // API请求频率限制
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 1000 // 最大请求数
        },
        // 是否启用HTTPS
        enableHTTPS: process.env.ENABLE_HTTPS === 'true',
        // JWT密钥
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        // 会话超时时间(小时)
        sessionTimeoutHours: 24
    },
    
    // 日志配置
    logging: {
        // 日志级别: error, warn, info, debug
        level: process.env.LOG_LEVEL || 'info',
        // 日志文件路径
        file: './logs/analytics.log',
        // 是否启用控制台输出
        console: true,
        // 日志文件最大大小(MB)
        maxFileSize: 10,
        // 保留的日志文件数量
        maxFiles: 5
    },
    
    // 缓存配置
    cache: {
        // 是否启用Redis缓存
        enableRedis: process.env.ENABLE_REDIS === 'true',
        // Redis连接配置
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0
        },
        // 缓存过期时间(秒)
        defaultTTL: 300,
        // 热点数据缓存时间(秒)
        hotDataTTL: 60
    },
    
    // 通知配置
    notifications: {
        // 是否启用邮件通知
        enableEmail: process.env.ENABLE_EMAIL === 'true',
        // 邮件配置
        email: {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER || '',
                pass: process.env.EMAIL_PASS || ''
            }
        },
        // 是否启用Webhook通知
        enableWebhook: process.env.ENABLE_WEBHOOK === 'true',
        // Webhook URL
        webhookUrl: process.env.WEBHOOK_URL || ''
    },
    
    // 数据处理配置
    processing: {
        // 是否启用异步处理
        enableAsync: true,
        // 队列配置
        queue: {
            // 队列最大长度
            maxLength: 10000,
            // 处理批次大小
            batchSize: 50,
            // 处理间隔(毫秒)
            processInterval: 1000
        }
    },
    
    // 监控告警配置
    alerts: {
        // 是否启用告警
        enabled: true,
        // 错误率告警阈值(%)
        errorRateThreshold: 5,
        // 响应时间告警阈值(毫秒)
        responseTimeThreshold: 2000,
        // 内存使用告警阈值(%)
        memoryUsageThreshold: 80,
        // CPU使用告警阈值(%)
        cpuUsageThreshold: 80
    }
};