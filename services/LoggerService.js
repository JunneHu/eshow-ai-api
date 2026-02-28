const winston = require("winston");

// 基础 Winston 日志器配置
const loggerInstance = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

const logger = {
  info: (...args) => loggerInstance.info(...args),
  warn: (...args) => loggerInstance.warn(...args),
  error: (...args) => loggerInstance.error(...args),

  // 统一 API 请求日志
  logApiRequest(ctx, duration) {
    const traceId = ctx.state && ctx.state.traceId;
    loggerInstance.info("API Request", {
      traceId,
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      duration,
      query: ctx.query,
    });
  },

  // 统一 API 错误日志
  logApiError(ctx, error) {
    const traceId = ctx.state && ctx.state.traceId;
    loggerInstance.error("API Error", {
      traceId,
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      message: error && error.message,
      stack: error && error.stack,
    });
  },

  // 性能/埋点日志
  logPerformance(event, duration, extra = {}) {
    loggerInstance.info("Performance", {
      event,
      duration,
      ...extra,
    });
  },
};

module.exports = logger;

