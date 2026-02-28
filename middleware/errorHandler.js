/**
 * 统一错误处理中间件
 */
const errorHandler = () => {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      console.error('Error occurred:', err);
      
      // 设置默认错误状态码
      ctx.status = err.status || err.statusCode || 500;
      
      // 根据错误类型返回不同的错误信息
      let errorMessage = '服务器内部错误';
      let errorCode = -1;
      
      if (err.name === 'ValidationError') {
        ctx.status = 400;
        errorMessage = '请求参数验证失败';
        errorCode = 400;
      } else if (err.name === 'SequelizeValidationError') {
        ctx.status = 400;
        errorMessage = '数据验证失败';
        errorCode = 400;
      } else if (err.name === 'SequelizeUniqueConstraintError') {
        ctx.status = 409;
        errorMessage = '数据已存在';
        errorCode = 409;
      } else if (err.name === 'SequelizeForeignKeyConstraintError') {
        ctx.status = 400;
        errorMessage = '关联数据不存在';
        errorCode = 400;
      } else if (err.name === 'JsonWebTokenError') {
        ctx.status = 401;
        errorMessage = '无效的访问令牌';
        errorCode = 401;
      } else if (err.name === 'TokenExpiredError') {
        ctx.status = 401;
        errorMessage = '访问令牌已过期';
        errorCode = 401;
      } else if (err.status === 404) {
        errorMessage = '请求的资源不存在';
        errorCode = 404;
      } else if (err.status === 403) {
        errorMessage = '没有权限访问该资源';
        errorCode = 403;
      } else if (err.status === 429) {
        errorMessage = '请求过于频繁，请稍后再试';
        errorCode = 429;
      }
      
      // 开发环境下返回详细错误信息
      if (process.env.NODE_ENV === 'development') {
        ctx.body = {
          code: errorCode,
          message: errorMessage,
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            details: err.details || null
          },
          timestamp: new Date().toISOString(),
          path: ctx.path,
          method: ctx.method
        };
      } else {
        // 生产环境下只返回基本错误信息
        ctx.body = {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString()
        };
      }
      
      // 记录错误日志
      console.error('Error Response:', {
        status: ctx.status,
        message: errorMessage,
        path: ctx.path,
        method: ctx.method,
        userAgent: ctx.get('User-Agent'),
        ip: ctx.ip,
        error: err.message
      });
    }
  };
};

module.exports = errorHandler;
