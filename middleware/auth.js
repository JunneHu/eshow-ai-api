const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * JWT token验证中间件
 */
const verifyToken = async (ctx, next) => {
  try {
    const token = ctx.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      ctx.status = 401;
      ctx.body = {
        code: -1,
        message: '缺少访问令牌'
      };
      return;
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    ctx.state.user = decoded;
    
    await next();
  } catch (error) {
    // 明确区分 token 过期和其他错误
    if (error.name === 'TokenExpiredError') {
      ctx.status = 401;
      ctx.body = {
        code: -1,
        message: '访问令牌已过期，请重新登录'
      };
    } else if (error.name === 'JsonWebTokenError') {
      ctx.status = 401;
      ctx.body = {
        code: -1,
        message: '无效的访问令牌'
      };
    } else {
      ctx.status = 401;
      ctx.body = {
        code: -1,
        message: '令牌验证失败: ' + error.message
      };
    }
  }
};

/**
 * 生成JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

module.exports = {
  verifyToken,
  generateToken
};