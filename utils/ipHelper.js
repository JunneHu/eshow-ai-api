/**
 * IP地址获取工具函数
 * 从请求中提取真实IP地址，支持代理服务器场景
 */

/**
 * 从Koa请求对象中获取真实IP地址
 * 优先级：X-Forwarded-For > X-Real-IP > request.ip > request.socket.remoteAddress
 * 
 * @param {Object} ctx - Koa上下文对象
 * @returns {string} IP地址
 */
function getClientIP(ctx) {
  // 1. 优先从 X-Forwarded-For 获取（代理服务器转发）
  // X-Forwarded-For 格式：client, proxy1, proxy2
  // 取第一个IP（最原始的客户端IP）
  const forwardedFor = ctx.request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    // 过滤掉空值和本地IP
    const validIP = ips.find(ip => ip && !isLocalIP(ip));
    if (validIP) {
      return validIP;
    }
  }

  // 2. 从 X-Real-IP 获取（Nginx等代理服务器）
  const realIP = ctx.request.headers['x-real-ip'];
  if (realIP && !isLocalIP(realIP)) {
    return realIP;
  }

  // 3. 从 Koa 的 request.ip 获取
  if (ctx.request.ip && !isLocalIP(ctx.request.ip)) {
    return ctx.request.ip;
  }

  // 4. 从 socket.remoteAddress 获取（最后备选）
  if (ctx.request.socket && ctx.request.socket.remoteAddress) {
    const remoteIP = ctx.request.socket.remoteAddress;
    // 处理 IPv6 格式 (::ffff:192.168.1.1 -> 192.168.1.1)
    const ipv4 = remoteIP.replace(/^::ffff:/, '');
    if (!isLocalIP(ipv4)) {
      return ipv4;
    }
  }

  // 如果所有方法都失败，返回 request.ip（可能是 ::1 或 127.0.0.1）
  return ctx.request.ip || '127.0.0.1';
}

/**
 * 判断是否为本地IP地址
 * @param {string} ip - IP地址
 * @returns {boolean}
 */
function isLocalIP(ip) {
  if (!ip) return true;
  
  // IPv6 本地地址
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }
  
  // IPv4 本地地址
  if (ip === '127.0.0.1' || ip === 'localhost') {
    return true;
  }
  
  // 私有IP地址段
  if (ip.startsWith('192.168.') || 
      ip.startsWith('10.') || 
      ip.startsWith('172.16.') || 
      ip.startsWith('172.17.') || 
      ip.startsWith('172.18.') || 
      ip.startsWith('172.19.') || 
      ip.startsWith('172.20.') || 
      ip.startsWith('172.21.') || 
      ip.startsWith('172.22.') || 
      ip.startsWith('172.23.') || 
      ip.startsWith('172.24.') || 
      ip.startsWith('172.25.') || 
      ip.startsWith('172.26.') || 
      ip.startsWith('172.27.') || 
      ip.startsWith('172.28.') || 
      ip.startsWith('172.29.') || 
      ip.startsWith('172.30.') || 
      ip.startsWith('172.31.')) {
    return true;
  }
  
  return false;
}

/**
 * 清理IP地址（移除端口号等）
 * @param {string} ip - IP地址
 * @returns {string} 清理后的IP地址
 */
function cleanIP(ip) {
  if (!ip) return '';
  
  // 移除端口号（如果有）
  const parts = ip.split(':');
  if (parts.length > 2) {
    // IPv6 格式，返回完整地址
    return ip;
  } else if (parts.length === 2) {
    // IPv4:端口 格式，返回IP部分
    return parts[0];
  }
  
  return ip;
}

module.exports = {
  getClientIP,
  isLocalIP,
  cleanIP
};

