const Koa = require("koa");
const cors = require("@koa/cors");
const bodyParser = require("koa-bodyparser");
const config = require("./config/config");
const logger = require("./services/LoggerService");
const errorHandler = require("./middleware/errorHandler");
const { validate, schemas } = require("./middleware/validation");
const registerHc = require("./routes/hc");
const registerAuth = require("./routes/auth");
const registerAds = require("./routes/ads");
const registerEvents = require("./routes/events");
const registerAnalytics = require("./routes/analytics");
const registerNews = require("./routes/news");
const registerComments = require("./routes/comments");
// const axios = require("axios"); // 暂时不需要
const { koaSwagger } = require("koa2-swagger-ui");
const swaggerSpec = require("./swagger");
// const { verifyToken } = require("./middleware/auth"); // 已禁用鉴权
const Router = require("koa-router");
const { testConnection, initDatabase, sequelize } = require("./config/database");
const { syncModels, Tool, Category, User, Advertisement, ToolComment, News, NewsComment, EventLog } = require("./models");
const serve = require("koa-static");
const path = require("path");
const fs = require("fs");
const multer = require("@koa/multer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const app = new Koa();
const router = new Router();

// 列表分页默认与上限（P1-3）
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

const ensureDirExists = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (e) {
    // ignore
  }
};

// ========================
// 运营埋点：基础工具
// ========================

const EVENT_TYPE_WHITELIST = new Set([
  "tool_view",
  "tool_click_official",
  "ad_view",
  "ad_click",
  "comment_submit",
  "search",
  "news_view",
  "news_click",
]);

const canReportEvents = (() => {
  // 轻量防刷：按 IP 做 60s 窗口限流
  const WINDOW_MS = 60 * 1000;
  const MAX_PER_WINDOW = 240;
  const map = new Map();

  return (ip) => {
    const key = ip || "";
    const now = Date.now();
    const rec = map.get(key) || { ts: now, count: 0 };
    if (now - rec.ts > WINDOW_MS) {
      rec.ts = now;
      rec.count = 0;
    }
    rec.count += 1;
    map.set(key, rec);
    if (rec.count > MAX_PER_WINDOW) {
      return { ok: false, message: "请求过于频繁" };
    }
    return { ok: true };
  };
})();

// 上传：广告图片（仅允许图片 MIME 类型）
const ADS_UPLOAD_DIR = path.join(__dirname, "public", "uploads", "ads");
ensureDirExists(ADS_UPLOAD_DIR);

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const uploadAdsImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ADS_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || ".jpg";
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const mimeOk = ALLOWED_IMAGE_MIMES.includes(file.mimetype);
    const orig = file && file.originalname ? String(file.originalname) : "";
    const ext = orig ? String(path.extname(orig)).toLowerCase() : "";
    const extOk = !ext ? true : ALLOWED_IMAGE_EXTS.has(ext);

    if (mimeOk && extOk) {
      cb(null, true);
      return;
    }

    const err = new Error("仅支持上传图片：JPG/JPEG、PNG、WebP、GIF");
    err.status = 400;
    cb(err);
  },
});

// 配置CORS - 允许特定来源访问
app.use(
  cors({
    origin: function (ctx) {
      const origin = ctx.request.header.origin;
      // 只在 debug 模式下打印 CORS 日志，避免日志刷屏
      if (config.server.logLevel === "debug") {
        logger.info("CORS请求来源:", origin);
      }
      
      // 从配置文件获取允许的来源列表
      const allowedOrigins = config.server.allowedOrigins;
      
      // 开发环境下更宽松的配置
      if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
        // 如果没有origin头（比如Postman等工具），允许访问
        if (!origin) {
          return "*";
        }
        // 如果origin在允许列表中，返回origin
        if (allowedOrigins.includes(origin)) {
          if (config.server.logLevel === "debug") {
            logger.info("CORS允许来源:", origin);
          }
          return origin;
        }
        // 开发环境下，如果不在列表中，也允许访问（方便调试）
        if (config.server.logLevel === "debug") {
          logger.warn("CORS开发模式允许未知来源:", origin);
        }
        return origin;
      }
      
      // 生产环境只允许配置的域名
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      if (config.server.logLevel === "debug") {
        logger.info("CORS拒绝来源:", origin);
      }
      return false;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: [
      "Content-Type",
      "Authorization", 
      "Accept",
      "X-Requested-With",
      "Origin",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
    ],
    exposeHeaders: [
      "WWW-Authenticate",
      "Server-Authorization",
      "Content-Length",
      "Content-Range",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Credentials"
    ],
    maxAge: 86400, // 预检请求缓存24小时
    credentials: true, // 允许发送cookies
    keepHeadersOnError: true, // 发生错误时保留CORS头信息
  })
);

// 使用koa-bodyparser中间件
app.use(bodyParser());

// 统一错误处理（捕获下游中间件与路由抛出的异常）
app.use(errorHandler());

// 生成 TraceId（32位十六进制，形如 5204d8e8d28c8bb058c865394c509db9）
const generateTraceId = () => {
  const now = Date.now().toString();
  const random = Math.random().toString();
  return crypto.createHash("md5").update(now + random).digest("hex");
};

// 生成 JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn || "24h",
    }
  );
};

// 认证中间件：需要登录的接口使用
const authRequired = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.status = 401;
    ctx.body = { code: -1, message: "未登录" };
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    ctx.state.user = payload;
    await next();
  } catch (err) {
    ctx.status = 401;
    ctx.body = { code: -1, message: "登录已失效，请重新登录" };
  }
};

// 认证路由（拆分至 routes/auth.js）
registerAuth(router, {
  logger,
  config,
  User,
  bcrypt,
  jwt,
  generateToken,
  authRequired,
  validate,
  schemas,
});
registerAds(router, {
  logger,
  sequelize,
  Advertisement,
  authRequired,
  uploadAdsImage,
  validate,
  schemas,
  DEFAULT_PAGE,
  MAX_PAGE_SIZE,
});
registerEvents(router, {
  logger,
  getClientIp,
  canReportEvents,
  safeString,
  safeJson,
  EVENT_TYPE_WHITELIST,
  EventLog,
});
registerAnalytics(router, {
  logger,
  sequelize,
  Op,
  EventLog,
  Tool,
  News,
  authRequired,
});
registerNews(router, {
  logger,
  sequelize,
  Op,
  News,
  authRequired,
  validate,
  schemas,
  DEFAULT_PAGE,
  MAX_PAGE_SIZE,
});
registerComments(router, {
  logger,
  Op,
  ToolComment,
  NewsComment,
  Tool,
  News,
  authRequired,
  validate,
  schemas,
  listCommentsPublic,
  createCommentPublic,
  DEFAULT_PAGE,
  MAX_PAGE_SIZE,
});

const isValidEmail = (email) => {
  if (!email) return true;
  const s = String(email).trim();
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

const sanitizeWebsite = (website) => {
  if (!website) return null;
  const s = String(website).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
};

const buildCommentTree = (rows) => {
  const map = new Map();
  const roots = [];
  (rows || []).forEach((r) => {
    const item = r && r.toJSON ? r.toJSON() : r;
    map.set(item.id, { ...item, replies: [] });
  });
  map.forEach((item) => {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).replies.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
};

function getClientIp(ctx) {
  const xff = ctx.headers && (ctx.headers["x-forwarded-for"] || ctx.headers["X-Forwarded-For"]);
  if (xff) return String(xff).split(",")[0].trim();
  return (ctx.ip || (ctx.request && ctx.request.ip) || "").toString();
}

function safeString(v, maxLen) {
  if (v === undefined || v === null) return null;
  const s = String(v);
  if (!maxLen) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeJson(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return { value: String(v) };
  }
}

// 评论防刷：内存级限流（单实例有效）
const COMMENT_POST_MIN_INTERVAL_MS = 15 * 1000;
const COMMENT_POST_MAX_PER_MINUTE_PER_IP = 30;
const commentPostLastAt = new Map(); // key: ip:toolId => lastAt
const commentPostRecentByIp = new Map(); // key: ip => number[] timestamps

const canPostComment = (ip, entityId) => {
  const now = Date.now();

  const key = `${ip}:${entityId}`;
  const lastAt = commentPostLastAt.get(key);
  if (lastAt && now - lastAt < COMMENT_POST_MIN_INTERVAL_MS) {
    const waitMs = COMMENT_POST_MIN_INTERVAL_MS - (now - lastAt);
    return {
      ok: false,
      message: `评论过于频繁，请 ${Math.ceil(waitMs / 1000)} 秒后再试`,
    };
  }

  const windowMs = 60 * 1000;
  const arr = commentPostRecentByIp.get(ip) || [];
  const nextArr = arr.filter((t) => now - t < windowMs);
  if (nextArr.length >= COMMENT_POST_MAX_PER_MINUTE_PER_IP) {
    return { ok: false, message: "操作过于频繁，请稍后再试" };
  }
  nextArr.push(now);
  commentPostRecentByIp.set(ip, nextArr);
  commentPostLastAt.set(key, now);
  return { ok: true };
};

// 公共：C 端评论列表（分页主评 + 一层回复树）
async function listCommentsPublic(Model, entityIdKey, entityId, page, pageSize) {
  const safePage = Math.max(1, Math.floor(Number.isFinite(page) ? page : DEFAULT_PAGE));
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : DEFAULT_PAGE_SIZE)));
  const offset = (safePage - 1) * safePageSize;
  const where = { [entityIdKey]: entityId, status: true, parentId: null };

  const rootsResult = await Model.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: safePageSize,
    offset,
  });

  const roots = (rootsResult.rows || []).map((r) => (r && r.toJSON ? r.toJSON() : r));
  const rootIds = roots.map((r) => r.id).filter(Boolean);

  let replies = [];
  if (rootIds.length > 0) {
    const replyRows = await Model.findAll({
      where: { [entityIdKey]: entityId, status: true, parentId: rootIds },
      order: [["createdAt", "ASC"]],
    });
    replies = (replyRows || []).map((r) => (r && r.toJSON ? r.toJSON() : r));
  }

  const replyMap = new Map();
  replies.forEach((r) => {
    const pid = r.parentId;
    if (!pid) return;
    const arr = replyMap.get(pid) || [];
    arr.push(r);
    replyMap.set(pid, arr);
  });

  const list = roots.map((r) => ({
    ...r,
    replies: replyMap.get(r.id) || [],
  }));

  return {
    list,
    total: rootsResult.count || 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

// 公共：C 端创建评论（校验 + 限流 + 实体/父评论检查 + 创建）
async function createCommentPublic(ctx, opts) {
  const {
    Model,
    EntityModel,
    entityIdKey,
    entityId,
    notFoundMessage,
    parentBelongMessage,
    logLabel,
    checkEntity = () => true,
  } = opts;

  const body = ctx.request.body || {};
  const parentIdRaw = body.parentId;
  const pid =
    parentIdRaw !== undefined && parentIdRaw !== null && String(parentIdRaw) !== ""
      ? Number(parentIdRaw)
      : null;
  const finalContent = (body.content && String(body.content).trim()) || "";
  const finalNickname = (body.nickname && String(body.nickname).trim()) || "";
  const finalEmail = (body.email && String(body.email).trim()) || "";
  const finalWebsite = sanitizeWebsite(body.website);

  const entityIdNum = Number(entityId);
  if (!Number.isFinite(entityIdNum) || entityIdNum <= 0 || !finalContent || !finalNickname) {
    ctx.status = 400;
    ctx.body = {
      code: -1,
      message: entityIdKey === "toolId" ? "参数错误：toolId、content、nickname 为必填" : "参数错误：newsId、content、nickname 为必填",
    };
    return true;
  }
  if (finalContent.length > 2000) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "评论内容过长" };
    return true;
  }
  if (finalNickname.length > 64) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "昵称过长" };
    return true;
  }
  if (!isValidEmail(finalEmail)) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "邮箱格式不正确" };
    return true;
  }

  const ip = getClientIp(ctx) || "";
  const limitResult = canPostComment(ip, entityIdNum);
  if (!limitResult.ok) {
    ctx.status = 429;
    ctx.body = { code: -1, message: limitResult.message || "操作过于频繁" };
    return true;
  }

  try {
    const entityRow = await EntityModel.findByPk(entityIdNum);
    if (!entityRow || !checkEntity(entityRow)) {
      ctx.status = 404;
      ctx.body = { code: -1, message: notFoundMessage };
      return true;
    }

    if (pid) {
      const parent = await Model.findByPk(pid);
      const parentEntityId = parent ? Number(parent[entityIdKey]) : null;
      if (!parent || parentEntityId !== entityIdNum) {
        ctx.status = 400;
        ctx.body = { code: -1, message: parentBelongMessage };
        return true;
      }
    }

    const created = await Model.create({
      [entityIdKey]: entityIdNum,
      parentId: pid,
      content: finalContent,
      nickname: finalNickname,
      email: finalEmail || null,
      website: finalWebsite,
      status: true,
    });
    ctx.status = 201;
    ctx.body = { code: 0, message: "创建成功", data: created };
    return true;
  } catch (error) {
    logger.error(logLabel, {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "创建评论失败" };
    return true;
  }
}

// TraceId & 请求日志中间件
app.use(async (ctx, next) => {
  // 从请求头获取 traceId，如果没有则自动生成一个
  const incomingTraceId = ctx.get("X-Trace-Id");
  const traceId = incomingTraceId || generateTraceId();
  ctx.state.traceId = traceId;
  ctx.set("X-Trace-Id", traceId);

  const start = Date.now();

  // 处理 OPTIONS 预检请求
  if (ctx.method === "OPTIONS") {
    const origin = ctx.request.header.origin;
    const allowedOrigins = config.server.allowedOrigins;
    
    // 开发环境下允许所有来源
    if ((process.env.NODE_ENV === "development" || !process.env.NODE_ENV) && origin) {
      ctx.status = 200;
      ctx.set('Access-Control-Allow-Origin', origin);
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      ctx.set('Access-Control-Allow-Credentials', 'true');
      ctx.set('Access-Control-Max-Age', '86400');
      // 记录预检请求日志（带 traceId）
      logger.logApiRequest(ctx, Date.now() - start);
      return;
    }
    
    // 生产环境只允许配置的来源
    if (origin && allowedOrigins.includes(origin)) {
      ctx.status = 200;
      ctx.set('Access-Control-Allow-Origin', origin);
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      ctx.set('Access-Control-Allow-Credentials', 'true');
      ctx.set('Access-Control-Max-Age', '86400');
      logger.logApiRequest(ctx, Date.now() - start);
      return;
    }
    
    ctx.status = 403;
    return;
  }

  try {
    await next();
    const duration = Date.now() - start;
    // 统一记录 API 请求日志
    logger.logApiRequest(ctx, duration);
  } catch (error) {
    const duration = Date.now() - start;
    // 记录错误日志并继续抛出交给错误处理中间件
    logger.logApiError(ctx, error);
    logger.logPerformance("api_request_error", duration, {
      traceId: ctx.state && ctx.state.traceId,
      path: ctx.path,
      method: ctx.method,
    });
    throw error;
  }
  }
);

// 数据库降级中间件：数据库不可用时，API 统一返回 503（避免启动即崩 / 大量 500）
app.use(async (ctx, next) => {
  const { isDbReady, getDbState } = require("./config/database");

  // 非 API 路由（静态页等）不拦截
  const isApi = ctx.path.startsWith("/api");
  if (!isApi) return await next();

  // 允许在无数据库时仍可用的 API
  const allowlist = new Set(["/api/info"]);
  if (allowlist.has(ctx.path)) return await next();

  if (!isDbReady()) {
    const state = getDbState();
    ctx.set("Retry-After", "10");
    ctx.status = 503;
    ctx.body = {
      code: -1,
      message: "数据库暂不可用，服务已进入降级模式",
      data: {
        database: "disconnected",
        lastAttemptAt: state.lastAttemptAt,
        lastSuccessAt: state.lastSuccessAt,
        lastErrorAt: state.lastErrorAt,
        lastError: state.lastError,
      },
    };
    return;
  }

  await next();
});

// Swagger文档配置
const swaggerOptions = {
  routePrefix: "/api-docs",
  swaggerOptions: {
    url: "/swagger.json",
    explorer: true,
    docExpansion: "list",
  },
};

// Swagger JSON 路由
app.use(async (ctx, next) => {
  if (ctx.path === "/swagger.json") {
    ctx.set("Content-Type", "application/json");
    ctx.body = swaggerSpec;
    return;
  }
  await next();
});

// Swagger UI
app.use(koaSwagger(swaggerOptions));


// 错误处理中间件（兜底返回结构化错误响应）
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // 这里不再重复记录日志，日志已在上游中间件中写入
    logger.error("Unhandled Error", {
      traceId: ctx.state && ctx.state.traceId,
      message: err.message,
    });
    ctx.status = err.status || 500;
    ctx.body = {
      code: -1,
      message: err.message || "服务器内部错误",
    };
  }
});

// 创建工具
router.post(
  "/api/tools",
  authRequired,
  validate(schemas.createTool, { source: "body" }),
  async (ctx) => {
    const { id, name, description, websiteUrl, tags, detail, content, sort, categoryIds } =
      ctx.request.body || {};

    if (!id || !name) {
      ctx.status = 400;
      ctx.body = {
        code: -1,
        message: "参数错误：id 和 name 为必填字段",
      };
      return;
    }

    // 兼容老的 detail 结构：如果传了 detail 就把它序列化进 content
    let finalContent = content || null;
    if (!finalContent && detail) {
      try {
        finalContent = JSON.stringify(detail);
      } catch (e) {
        finalContent = null;
      }
    }

    try {
      const existed = await Tool.findOne({
        where: {
          [Op.or]: [{ toolKey: id }, { name }],
        },
      });
      if (existed) {
        ctx.status = 400;
        ctx.body = {
          code: -1,
          message: existed.toolKey === id ? "工具ID已存在" : "工具名称已存在",
        };
        return;
      }

      const tool = await Tool.create({
        toolKey: id,
        name,
        description,
        websiteUrl,
        tags,
        content: finalContent,
        sort: typeof sort === "number" ? sort : null,
      });

      // 分类关联：允许前端传 categoryIds，写入多对多关联表
      if (Array.isArray(categoryIds)) {
        const categories = await Category.findAll({
          where: {
            id: categoryIds,
          },
        });
        await tool.setCategories(categories);
      }

      const result = await Tool.findByPk(tool.id, {
        include: [{ model: Category }],
      });

      ctx.status = 201;
      ctx.body = {
        code: 0,
        message: "创建成功",
        data: result || tool,
      };
    } catch (error) {
      if (
        error &&
        (error.name === "SequelizeUniqueConstraintError" ||
          error.name === "SequelizeValidationError")
      ) {
        ctx.status = 400;
        ctx.body = {
          code: -1,
          message: "工具ID或名称已存在",
        };
        return;
      }
      logger.error("Create tool failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: "创建工具失败",
      };
    }
  }
);

// 工具列表（默认分页：page=1, pageSize=20，pageSize 上限 200）
router.get("/api/tools", async (ctx) => {
  try {
    const pageRaw = ctx.query && ctx.query.page;
    const pageSizeRaw = ctx.query && (ctx.query.pageSize || ctx.query.page_size);
    const page = pageRaw !== undefined ? Number(pageRaw) : DEFAULT_PAGE;
    const pageSize = pageSizeRaw !== undefined ? Number(pageSizeRaw) : DEFAULT_PAGE_SIZE;

    const order = [
      [sequelize.literal("sort IS NULL"), "ASC"], // 先按是否有排序值：有 sort 的在前
      ["sort", "ASC"], // 再按 sort 从小到大
      ["createdAt", "DESC"], // sort 相同时按创建时间倒序
    ];

    const safePage = Math.max(1, Math.floor(Number.isFinite(page) ? page : DEFAULT_PAGE));
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : DEFAULT_PAGE_SIZE)));
    const offset = (safePage - 1) * safePageSize;

    const result = await Tool.findAndCountAll({
      include: [{ model: Category }],
      order,
      limit: safePageSize,
      offset,
      distinct: true,
    });

    ctx.body = {
      code: 0,
      message: "success",
      data: {
        list: result.rows || [],
        total: result.count || 0,
        page: safePage,
        pageSize: safePageSize,
      },
    };
  } catch (error) {
    logger.error("List tools failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = {
      code: -1,
      message: "获取工具列表失败",
    };
  }
});

// 获取单个工具（按数据库自增 id）
router.get("/api/tools/:id", async (ctx) => {
  const { id } = ctx.params;
  try {
    const tool = await Tool.findByPk(id, {
      include: [{ model: Category }],
    });
    if (!tool) {
      ctx.status = 404;
      ctx.body = {
        code: -1,
        message: "工具不存在",
      };
      return;
    }
    ctx.body = {
      code: 0,
      message: "success",
      data: tool,
    };
  } catch (error) {
    logger.error("Get tool failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = {
      code: -1,
      message: "获取工具失败",
    };
  }
});

// 更新工具
router.put(
  "/api/tools/:id",
  authRequired,
  validate(schemas.updateTool, { source: "body" }),
  async (ctx) => {
    const { id } = ctx.params;
    const { name, description, websiteUrl, tags, content, sort, categoryIds } = ctx.request.body || {};

    try {
      const tool = await Tool.findByPk(id);
      if (!tool) {
        ctx.status = 404;
        ctx.body = {
          code: -1,
          message: "工具不存在",
        };
        return;
      }

      if (name !== undefined) {
        const existedByName = await Tool.findOne({
          where: {
            name,
            id: { [Op.ne]: tool.id },
          },
        });
        if (existedByName) {
          ctx.status = 400;
          ctx.body = {
            code: -1,
            message: "工具名称已存在",
          };
          return;
        }
      }

      tool.name = name !== undefined ? name : tool.name;
      tool.description = description !== undefined ? description : tool.description;
      tool.websiteUrl = websiteUrl !== undefined ? websiteUrl : tool.websiteUrl;
      tool.tags = tags !== undefined ? tags : tool.tags;
      tool.content = content !== undefined ? content : tool.content;
      if (sort !== undefined) {
        tool.sort = typeof sort === "number" ? sort : tool.sort;
      }

      await tool.save();

      // 分类关联：允许更新分类；空数组表示清空
      if (Array.isArray(categoryIds)) {
        const categories = await Category.findAll({
          where: {
            id: categoryIds,
          },
        });
        await tool.setCategories(categories);
      }

      const result = await Tool.findByPk(tool.id, {
        include: [{ model: Category }],
      });

      ctx.body = {
        code: 0,
        message: "更新成功",
        data: result || tool,
      };
    } catch (error) {
      if (
        error &&
        (error.name === "SequelizeUniqueConstraintError" ||
          error.name === "SequelizeValidationError")
      ) {
        ctx.status = 400;
        ctx.body = {
          code: -1,
          message: "工具名称已存在",
        };
        return;
      }
      logger.error("Update tool failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: "更新工具失败",
      };
    }
  }
);

// 删除工具
router.delete("/api/tools/:id", authRequired, async (ctx) => {
  const { id } = ctx.params;
  try {
    const tool = await Tool.findByPk(id);
    if (!tool) {
      ctx.status = 404;
      ctx.body = {
        code: -1,
        message: "工具不存在",
      };
      return;
    }

    await tool.destroy();

    ctx.body = {
      code: 0,
      message: "删除成功",
    };
  } catch (error) {
    logger.error("Delete tool failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = {
      code: -1,
      message: "删除工具失败",
    };
  }
});

// 分类相关接口（无需登录）
// 分类列表（限制最多 200 条，避免无上限）
router.get("/api/categories", async (ctx) => {
  try {
    const categories = await Category.findAll({
      order: [["id", "ASC"]],
      limit: MAX_PAGE_SIZE,
    });
    ctx.body = {
      code: 0,
      message: "success",
      data: categories,
    };
  } catch (error) {
    logger.error("List categories failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = {
      code: -1,
      message: "获取分类列表失败",
    };
  }
});

// 创建分类
router.post(
  "/api/categories",
  authRequired,
  validate(schemas.createCategory, { source: "body" }),
  async (ctx) => {
    const { id, title } = ctx.request.body || {};
    if (!id || !title) {
      ctx.status = 400;
      ctx.body = {
        code: -1,
        message: "参数错误：id（categoryKey）和 title 为必填字段",
      };
      return;
    }

    try {
      const category = await Category.create({
        categoryKey: id,
        title,
      });
      ctx.status = 201;
      ctx.body = {
        code: 0,
        message: "创建成功",
        data: category,
      };
    } catch (error) {
      logger.error("Create category failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: "创建分类失败",
      };
    }
  }
);

// 获取单个分类及关联工具
router.get("/api/categories/:id", async (ctx) => {
  const { id } = ctx.params;
  try {
    const category = await Category.findByPk(id, {
      include: [{ model: Tool }],
    });
    if (!category) {
      ctx.status = 404;
      ctx.body = {
        code: -1,
        message: "分类不存在",
      };
      return;
    }
    ctx.body = {
      code: 0,
      message: "success",
      data: category,
    };
  } catch (error) {
    logger.error("Get category failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = {
      code: -1,
      message: "获取分类失败",
    };
  }
});

// 更新分类（支持重命名和关联工具）
router.put(
  "/api/categories/:id",
  authRequired,
  validate(schemas.updateCategory, { source: "body" }),
  async (ctx) => {
    const { id } = ctx.params;
    const { title, toolIds } = ctx.request.body || {};

    try {
      const category = await Category.findByPk(id);
      if (!category) {
        ctx.status = 404;
        ctx.body = {
          code: -1,
          message: "分类不存在",
        };
        return;
      }

      if (title !== undefined) {
        category.title = title;
        await category.save();
      }

      // 如果传了 toolIds，就重置这个分类下的工具关联
      if (Array.isArray(toolIds)) {
        const tools = await Tool.findAll({
          where: { id: toolIds },
        });
        await category.setTools(tools);
      }

      const result = await Category.findByPk(id, {
        include: [{ model: Tool }],
      });

      ctx.body = {
        code: 0,
        message: "更新成功",
        data: result,
      };
    } catch (error) {
      logger.error("Update category failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: "更新分类失败",
      };
    }
  }
);

// 删除分类（同时删除关联关系）
router.delete("/api/categories/:id", authRequired, async (ctx) => {
  const { id } = ctx.params;
  try {
    const category = await Category.findByPk(id);
    if (!category) {
      ctx.status = 404;
      ctx.body = {
        code: -1,
        message: "分类不存在",
      };
      return;
    }

    await category.setTools([]); // 清理关联
    await category.destroy();

    ctx.body = {
      code: 0,
      message: "删除成功",
    };
  } catch (error) {
    logger.error("Delete category failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = {
      code: -1,
      message: "删除分类失败",
    };
  }
});

// 启动服务器
const startServer = async () => {
  try {
    // 生产环境必须显式配置核心密钥，避免使用默认值
    if (config.server.environment === "production") {
      if (!process.env.JWT_SECRET) {
        logger.error("应用启动失败: 缺少 JWT_SECRET 环境变量（生产环境必须配置）");
        process.exit(1);
      }
      if (!process.env.DB_PASSWORD) {
        logger.error("应用启动失败: 缺少 DB_PASSWORD 环境变量（生产环境必须配置）");
        process.exit(1);
      }
    }

    const tryInitDbOnce = async () => {
      const isConnected = await testConnection({ silent: true });
      if (!isConnected) {
        logger.warn("数据库连接失败：应用将继续启动（降级模式）");
        return false;
      }

      const isInitialized = await initDatabase({ silent: true });
      if (!isInitialized) {
        logger.warn("数据库初始化失败：应用将继续启动（降级模式）");
        return false;
      }

      try {
        await syncModels();
        return true;
      } catch (e) {
        logger.warn("数据表同步失败：应用将继续启动（降级模式）", e && e.message);
        return false;
      }
    };

    // 首次尝试（失败也不退出）
    await tryInitDbOnce();

    // 后台重试数据库（首次不可用时自动恢复）
    const retryMs = Number.parseInt(process.env.DB_RETRY_INTERVAL_MS || "10000", 10);
    setInterval(async () => {
      const { isDbReady } = require("./config/database");
      if (isDbReady()) return;
      await tryInitDbOnce();
    }, Number.isFinite(retryMs) && retryMs > 0 ? retryMs : 10000);

    // 健康检查路由（拆分至 routes/hc.js）
    registerHc(router);

    // 挂载路由（工具 / 分类 / 健康检查等）
    app.use(router.routes());
    app.use(router.allowedMethods());

    // 静态文件服务放在最后，避免拦截 API 路由
    app.use(serve(path.join(__dirname, "public")));

    app.listen(config.server.port, () => {
      logger.info(`服务器运行在 localhost:${config.server.port}`);
    });
  } catch (error) {
    logger.error("应用启动失败", { error: error && error.message, stack: error && error.stack });
    process.exit(1);
  }
};

startServer();

module.exports = app;
