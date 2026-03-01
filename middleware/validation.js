/**
 * 请求参数验证中间件
 */
const Joi = require('joi');

const urlOptional = Joi.string().uri().allow('', null);

// 认证相关验证规则
const authSchemas = {
  register: Joi.object({
    username: Joi.string().min(1).max(64).required(),
    password: Joi.string().min(1).required(),
  }),
  login: Joi.object({
    username: Joi.string().min(1).max(64).required(),
    password: Joi.string().min(1).required(),
  }),
  changePassword: Joi.object({
    oldPassword: Joi.string().min(1).required(),
    newPassword: Joi.string().min(1).required(),
  }),
};

// 通用验证规则
const commonSchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20)
  }),
  
  timeRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    timeRange: Joi.string().valid('1h', '24h', '7d', '30d', '90d').default('7d')
  }),
  
  appId: Joi.object({
    appId: Joi.string().required()
  })
};

// 业务相关验证规则
const bizSchemas = {
  createNews: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    summary: Joi.string().allow('', null).optional(),
    coverImageUrl: urlOptional.optional(),
    sourceUrl: urlOptional.optional(),
    content: Joi.string().allow('', null).optional(),
    publishAt: Joi.alternatives().try(Joi.date().iso(), Joi.string()).allow(null, '').optional(),
    status: Joi.boolean().optional(),
  }),
  updateNews: Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    summary: Joi.string().allow('', null).optional(),
    coverImageUrl: urlOptional.optional(),
    sourceUrl: urlOptional.optional(),
    content: Joi.string().allow('', null).optional(),
    publishAt: Joi.alternatives().try(Joi.date().iso(), Joi.string()).allow(null, '').optional(),
    status: Joi.boolean().optional(),
  }),

  createAd: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    imageUrl: urlOptional.required(),
    linkUrl: urlOptional.optional(),
    sort: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
    position: Joi.string().min(1).max(128).required(),
    displayType: Joi.string().allow('', null).optional(),
    status: Joi.boolean().optional(),
  }),
  updateAd: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    imageUrl: urlOptional.optional(),
    linkUrl: urlOptional.optional(),
    sort: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
    position: Joi.string().min(1).max(128).optional(),
    displayType: Joi.string().allow('', null).optional(),
    status: Joi.boolean().optional(),
  }),

  createTool: Joi.object({
    id: Joi.string().min(1).max(128).required(),
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().allow('', null).optional(),
    websiteUrl: urlOptional.optional(),
    tags: Joi.any().optional(),
    detail: Joi.any().optional(),
    content: Joi.any().optional(),
    sort: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
    categoryIds: Joi.array().items(Joi.number().integer().min(1)).optional(),
  }),
  updateTool: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().allow('', null).optional(),
    websiteUrl: urlOptional.optional(),
    tags: Joi.any().optional(),
    content: Joi.any().optional(),
    sort: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
    categoryIds: Joi.array().items(Joi.number().integer().min(1)).optional(),
  }),

  createCategory: Joi.object({
    id: Joi.string().min(1).max(128).required(),
    title: Joi.string().min(1).max(255).required(),
  }),
  updateCategory: Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    toolIds: Joi.array().items(Joi.number().integer().min(1)).optional(),
  }),

  createPublicComment: Joi.object({
    toolId: Joi.number().integer().min(1).optional(),
    newsId: Joi.number().integer().min(1).optional(),
    parentId: Joi.number().integer().min(1).allow(null).optional(),
    content: Joi.string().min(1).max(2000).required(),
    nickname: Joi.string().min(1).max(64).required(),
    email: Joi.string().email().allow('', null).optional(),
    website: urlOptional.optional(),
  }).or('toolId', 'newsId'),

  updateCommentStatus: Joi.object({
    status: Joi.boolean().required(),
  }),
};

// 事件相关验证规则
const eventSchemas = {
  trackEvent: Joi.object({
    event_type: Joi.string().required(),
    event_name: Joi.string().optional(),
    user_id: Joi.string().optional(),
    distinct_id: Joi.string().required(),
    session_id: Joi.string().optional(),
    properties: Joi.object().optional(),
    user_properties: Joi.object().optional(),
    lib_properties: Joi.object().optional(),
    timestamp: Joi.number().integer().optional()
  }),
  
  metaEvent: Joi.object({
    event_name: Joi.string().required(),
    event_display_name: Joi.string().required(),
    app_id: Joi.string().required(),
    platforms: Joi.array().items(Joi.string().valid('iOS', 'Android', 'JavaScript', '服务端')).optional(),
    trigger_timing: Joi.string().max(500).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    is_mutable: Joi.boolean().default(false),
    remarks: Joi.string().optional()
  }),
  
  eventProperty: Joi.object({
    property_name: Joi.string().required(),
    property_display_name: Joi.string().required(),
    property_type: Joi.string().valid('event', 'user', 'predefined', 'public', 'custom').required(),
    app_id: Joi.string().required(),
    event_name: Joi.string().when('property_type', {
      is: 'event',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    data_type: Joi.string().valid('string', 'number', 'boolean', 'date', 'array', 'object').required(),
    description: Joi.string().optional(),
    is_required: Joi.boolean().default(false),
    enum_values: Joi.array().items(Joi.string()).optional(),
    validation_rules: Joi.object().optional()
  })
};

// 分析相关验证规则
const analyticsSchemas = {
  eventAnalysis: Joi.object({
    appId: Joi.string().required(),
    eventName: Joi.string().optional(),
    timeRange: Joi.string().valid('1h', '24h', '7d', '30d', '90d').default('7d'),
    dimensions: Joi.array().items(Joi.string()).optional(),
    filters: Joi.object().optional()
  }),
  
  funnelAnalysis: Joi.object({
    appId: Joi.string().required(),
    steps: Joi.array().items(Joi.string()).min(2).required(),
    timeRange: Joi.string().valid('1h', '24h', '7d', '30d', '90d').default('7d'),
    filters: Joi.object().optional()
  }),
  
  retentionAnalysis: Joi.object({
    appId: Joi.string().required(),
    timeRange: Joi.string().valid('7d', '30d', '90d').default('30d'),
    cohortType: Joi.string().valid('day', 'week', 'month').default('day'),
    filters: Joi.object().optional()
  })
};

// 验证中间件工厂函数
const validate = (schema, options = {}) => {
  return async (ctx, next) => {
    try {
      const source = options.source || 'body'; // body, query, params
      let data;
      if (source === 'body') data = (ctx.request && ctx.request.body) || {};
      else if (source === 'query') data = ctx.query || {};
      else if (source === 'params') data = ctx.params || {};
      else data = ctx[source];
      
      // 执行验证
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        ...options
      });
      
      if (error) {
        ctx.status = 400;
        ctx.body = {
          code: -1,
          message: '请求参数验证失败',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        };
        return;
      }

      // 将验证后的数据放回原位置
      if (source === 'body') {
        ctx.request.body = value;
      } else if (source === 'query') {
        ctx.query = value;
      } else if (source === 'params') {
        ctx.params = value;
      } else {
        ctx[source] = value;
      }
      await next();
    } catch (err) {
      const logger = require('../services/LoggerService');
      logger.error('Validation middleware error', { error: err && err.message });
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: '参数验证服务异常'
      };
    }
  };
};

// 导出验证中间件
module.exports = {
  validate,
  schemas: {
    ...authSchemas,
    ...commonSchemas,
    ...eventSchemas,
    ...analyticsSchemas,
    ...bizSchemas,
  },
};
