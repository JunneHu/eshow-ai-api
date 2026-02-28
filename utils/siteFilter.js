const { Site } = require('../models');

/**
 * 站点过滤工具函数
 * 用于统一处理按站点过滤数据的逻辑
 */

/**
 * 根据 siteId 获取站点的 domain
 * @param {string} siteId - 站点ID
 * @returns {Promise<string|null>} 返回域名，如果站点不存在则返回 null
 */
async function getSiteDomain(siteId) {
  if (!siteId || siteId.trim() === '') {
    return null;
  }
  
  try {
    // 如果是自动发现的站点（site_id 以 auto_ 开头），从 site_id 中提取域名
    if (siteId.startsWith('auto_')) {
      return siteId.replace(/^auto_/, '').replace(/_/g, '.');
    }
    
    // 查询站点配置
    const site = await Site.findOne({
      where: { site_id: siteId },
      attributes: ['domain'],
      raw: true
    });
    
    return site ? site.domain : null;
  } catch (error) {
    console.error('获取站点域名失败:', error);
    return null;
  }
}

/**
 * 为查询条件添加站点过滤
 * @param {Object} whereCondition - Sequelize 查询条件对象
 * @param {string} siteId - 站点ID
 * @returns {Promise<Object>} 返回添加了站点过滤的查询条件
 */
async function addSiteFilter(whereCondition, siteId) {
  if (!siteId) {
    return whereCondition;
  }
  
  const domain = await getSiteDomain(siteId);
  if (domain) {
    whereCondition.page_url = { [require('sequelize').Op.like]: `%${domain}%` };
  }
  
  return whereCondition;
}

/**
 * 为 SQL 查询添加站点过滤条件
 * @param {string} sql - SQL 查询语句
 * @param {Object} replacements - SQL 参数对象
 * @param {string} siteId - 站点ID
 * @returns {Promise<{sql: string, replacements: Object}>} 返回修改后的 SQL 和参数
 */
async function addSiteFilterToSQL(sql, replacements, siteId) {
  if (!siteId) {
    return { sql, replacements };
  }
  
  const domain = await getSiteDomain(siteId);
  if (domain) {
    // 检查 SQL 中是否已有 WHERE 子句
    const hasWhere = /WHERE/i.test(sql);
    const siteFilter = hasWhere 
      ? ` AND page_url LIKE :domain`
      : ` WHERE page_url LIKE :domain`;
    
    return {
      sql: sql + siteFilter,
      replacements: {
        ...replacements,
        domain: `%${domain}%`
      }
    };
  }
  
  return { sql, replacements };
}

module.exports = {
  getSiteDomain,
  addSiteFilter,
  addSiteFilterToSQL
};

