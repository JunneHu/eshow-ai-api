const Koa = require("koa");
const cors = require("@koa/cors");
const bodyParser = require("koa-bodyparser");
const config = require("./config/config");
const logger = require("./services/LoggerService");
// const axios = require("axios"); // 暂时不需要
const { koaSwagger } = require("koa2-swagger-ui");
const swaggerSpec = require("./swagger");
// const { verifyToken } = require("./middleware/auth"); // 已禁用鉴权
const Router = require("koa-router");
const { testConnection, initDatabase, sequelize } = require("./config/database");
const { syncModels, Tool, Category, User, Advertisement, ToolComment } = require("./models");
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

const ensureDirExists = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (e) {
    // ignore
  }
};

// 上传：广告图片
const ADS_UPLOAD_DIR = path.join(__dirname, "public", "uploads", "ads");
ensureDirExists(ADS_UPLOAD_DIR);

const uploadAdsImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ADS_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// 配置CORS - 允许特定来源访问
app.use(
  cors({
    origin: function (ctx) {
      const origin = ctx.request.header.origin;
      // 只在 debug 模式下打印 CORS 日志，避免日志刷屏
      if (config.server.logLevel === "debug") {
        console.log('CORS请求来源:', origin);
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
            console.log('✅ CORS允许来源:', origin);
          }
          return origin;
        }
        // 开发环境下，如果不在列表中，也允许访问（方便调试）
        if (config.server.logLevel === "debug") {
          console.log('⚠️ CORS开发模式允许未知来源:', origin);
        }
        return origin;
      }
      
      // 生产环境只允许配置的域名
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      if (config.server.logLevel === "debug") {
        console.log('❌ CORS拒绝来源:', origin);
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
});

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

// 认证相关接口（登录 / 注册 / 修改密码）
// 注册
router.post("/api/auth/register", async (ctx) => {
  const { username, password } = ctx.request.body || {};

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "用户名和密码为必填项" };
    return;
  }

  try {
    const existed = await User.findOne({ where: { username } });
    if (existed) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "用户名已存在" };
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash: hash,
    });

    const token = generateToken(user);

    ctx.body = {
      code: 0,
      message: "注册成功",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      },
    };
  } catch (error) {
    logger.error("Register failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "注册失败" };
  }
});

// 登录
router.post("/api/auth/login", async (ctx) => {
  const { username, password } = ctx.request.body || {};

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "用户名和密码为必填项" };
    return;
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "用户名或密码错误" };
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "用户名或密码错误" };
      return;
    }

    const token = generateToken(user);
    ctx.body = {
      code: 0,
      message: "登录成功",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      },
    };
  } catch (error) {
    logger.error("Login failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "登录失败" };
  }
});

// 修改密码（需要登录）
router.post("/api/auth/change-password", authRequired, async (ctx) => {
  const { oldPassword, newPassword } = ctx.request.body || {};

  if (!oldPassword || !newPassword) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "旧密码和新密码为必填项" };
    return;
  }

  try {
    const user = await User.findByPk(ctx.state.user.id);
    if (!user) {
      ctx.status = 401;
      ctx.body = { code: -1, message: "用户不存在或已被删除" };
      return;
    }

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "旧密码不正确" };
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hash;
    await user.save();

    ctx.body = { code: 0, message: "密码修改成功" };
  } catch (error) {
    logger.error("Change password failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "修改密码失败" };
  }
});

// 工具相关接口（无需登录）
// 广告相关接口（无需登录）

// 上传广告图片
router.post("/api/upload/ads-image", uploadAdsImage.single("file"), async (ctx) => {
  const file = ctx.file;
  if (!file) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "未获取到上传文件" };
    return;
  }

  const relativePath = `/uploads/ads/${file.filename}`;
  const url = `${ctx.origin}${relativePath}`;
  ctx.body = {
    code: 0,
    message: "success",
    data: {
      path: relativePath,
      url,
    },
  };
});

// 广告列表（后台管理用，可分页）
router.get("/api/ads", async (ctx) => {
  try {
    const { page, pageSize, position, status } = ctx.query || {};
    const p = page !== undefined ? Number(page) : undefined;
    const ps = pageSize !== undefined ? Number(pageSize) : undefined;

    const where = {};
    if (position) where.position = String(position);
    if (status !== undefined && status !== "") {
      if (String(status) === "1" || String(status).toLowerCase() === "true") where.status = true;
      if (String(status) === "0" || String(status).toLowerCase() === "false") where.status = false;
    }

    const order = [
      [sequelize.literal("sort IS NULL"), "ASC"],
      ["sort", "ASC"],
      ["createdAt", "DESC"],
    ];

    if (Number.isFinite(p) && Number.isFinite(ps) && p && ps) {
      const safePage = Math.max(1, Math.floor(p));
      const safePageSize = Math.min(200, Math.max(1, Math.floor(ps)));
      const offset = (safePage - 1) * safePageSize;

      const result = await Advertisement.findAndCountAll({
        where,
        order,
        limit: safePageSize,
        offset,
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
      return;
    }

    const list = await Advertisement.findAll({ where, order });
    ctx.body = { code: 0, message: "success", data: list };
  } catch (error) {
    logger.error("List ads failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "获取广告列表失败" };
  }
});

// 获取单个广告
router.get("/api/ads/:id", async (ctx) => {
  const { id } = ctx.params;
  try {
    const ad = await Advertisement.findByPk(id);
    if (!ad) {
      ctx.status = 404;
      ctx.body = { code: -1, message: "广告不存在" };
      return;
    }
    ctx.body = { code: 0, message: "success", data: ad };
  } catch (error) {
    logger.error("Get ad failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "获取广告失败" };
  }
});

// 创建广告
router.post("/api/ads", async (ctx) => {
  const { name, imageUrl, linkUrl, sort, position, displayType, status } = ctx.request.body || {};
  if (!name || !imageUrl || !position) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "参数错误：name、imageUrl、position 为必填字段" };
    return;
  }
  try {
    const ad = await Advertisement.create({
      name,
      imageUrl,
      linkUrl: linkUrl || null,
      sort: typeof sort === "number" ? sort : sort !== undefined ? Number(sort) : null,
      position,
      displayType: displayType || "tile",
      status: status === undefined ? true : Boolean(status),
    });
    ctx.status = 201;
    ctx.body = { code: 0, message: "创建成功", data: ad };
  } catch (error) {
    logger.error("Create ad failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "创建广告失败" };
  }
});

// 更新广告
router.put("/api/ads/:id", async (ctx) => {
  const { id } = ctx.params;
  const { name, imageUrl, linkUrl, sort, position, displayType, status } = ctx.request.body || {};
  try {
    const ad = await Advertisement.findByPk(id);
    if (!ad) {
      ctx.status = 404;
      ctx.body = { code: -1, message: "广告不存在" };
      return;
    }

    ad.name = name !== undefined ? name : ad.name;
    ad.imageUrl = imageUrl !== undefined ? imageUrl : ad.imageUrl;
    ad.linkUrl = linkUrl !== undefined ? (linkUrl || null) : ad.linkUrl;
    ad.position = position !== undefined ? position : ad.position;
    ad.displayType = displayType !== undefined ? (displayType || "tile") : ad.displayType;
    if (sort !== undefined) {
      const n = typeof sort === "number" ? sort : Number(sort);
      ad.sort = Number.isFinite(n) ? n : ad.sort;
    }
    if (status !== undefined) ad.status = Boolean(status);

    await ad.save();
    ctx.body = { code: 0, message: "更新成功", data: ad };
  } catch (error) {
    logger.error("Update ad failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "更新广告失败" };
  }
});

// 删除广告
router.delete("/api/ads/:id", async (ctx) => {
  const { id } = ctx.params;
  try {
    const ad = await Advertisement.findByPk(id);
    if (!ad) {
      ctx.status = 404;
      ctx.body = { code: -1, message: "广告不存在" };
      return;
    }
    await ad.destroy();
    ctx.body = { code: 0, message: "删除成功" };
  } catch (error) {
    logger.error("Delete ad failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "删除广告失败" };
  }
});

// C 端广告列表：按 position 查询启用广告
router.get("/api/public/ads", async (ctx) => {
  const { position } = ctx.query || {};
  if (!position) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "参数错误：position 为必填" };
    return;
  }
  try {
    const list = await Advertisement.findAll({
      where: { position: String(position), status: true },
      order: [
        [sequelize.literal("sort IS NULL"), "ASC"],
        ["sort", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
    ctx.body = { code: 0, message: "success", data: list };
  } catch (error) {
    logger.error("List public ads failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "获取广告失败" };
  }
});

// 工具评论（无需登录）：列表 + 创建（支持回复）
router.get("/api/public/tool-comments", async (ctx) => {
  const { toolId } = ctx.query || {};
  const tid = Number(toolId);
  if (!Number.isFinite(tid) || tid <= 0) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "参数错误：toolId 为必填" };
    return;
  }
  try {
    const rows = await ToolComment.findAll({
      where: { toolId: tid, status: true },
      order: [
        [sequelize.literal("parent_id IS NOT NULL"), "ASC"],
        ["createdAt", "ASC"],
      ],
    });
    const tree = buildCommentTree(rows);
    ctx.body = { code: 0, message: "success", data: tree };
  } catch (error) {
    logger.error("List tool comments failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "获取评论失败" };
  }
});

router.post("/api/public/tool-comments", async (ctx) => {
  const { toolId, parentId, content, nickname, email, website } = ctx.request.body || {};
  const tid = Number(toolId);
  const pid = parentId !== undefined && parentId !== null && String(parentId) !== "" ? Number(parentId) : null;
  const finalContent = content ? String(content).trim() : "";
  const finalNickname = nickname ? String(nickname).trim() : "";
  const finalEmail = email ? String(email).trim() : "";
  const finalWebsite = sanitizeWebsite(website);

  if (!Number.isFinite(tid) || tid <= 0 || !finalContent || !finalNickname) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "参数错误：toolId、content、nickname 为必填" };
    return;
  }
  if (finalContent.length > 2000) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "评论内容过长" };
    return;
  }
  if (finalNickname.length > 64) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "昵称过长" };
    return;
  }
  if (!isValidEmail(finalEmail)) {
    ctx.status = 400;
    ctx.body = { code: -1, message: "邮箱格式不正确" };
    return;
  }

  try {
    const tool = await Tool.findByPk(tid);
    if (!tool) {
      ctx.status = 404;
      ctx.body = { code: -1, message: "工具不存在" };
      return;
    }

    if (pid) {
      const parent = await ToolComment.findByPk(pid);
      if (!parent || Number(parent.toolId) !== tid) {
        ctx.status = 400;
        ctx.body = { code: -1, message: "父评论不存在或不属于该工具" };
        return;
      }
    }

    const created = await ToolComment.create({
      toolId: tid,
      parentId: pid,
      content: finalContent,
      nickname: finalNickname,
      email: finalEmail || null,
      website: finalWebsite,
      status: true,
    });
    ctx.status = 201;
    ctx.body = { code: 0, message: "创建成功", data: created };
  } catch (error) {
    logger.error("Create tool comment failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "创建评论失败" };
  }
});

// 工具评论（后台管理）：分页列表 / 下线 / 删除
router.get("/api/tool-comments", authRequired, async (ctx) => {
  try {
    const { page, pageSize, toolId, status, keyword } = ctx.query || {};
    const p = page !== undefined ? Number(page) : 1;
    const ps = pageSize !== undefined ? Number(pageSize) : 10;
    const safePage = Math.max(1, Math.floor(p || 1));
    const safePageSize = Math.min(200, Math.max(1, Math.floor(ps || 10)));
    const offset = (safePage - 1) * safePageSize;

    const where = {};
    if (toolId) {
      const tid = Number(toolId);
      if (Number.isFinite(tid) && tid > 0) where.toolId = tid;
    }
    if (status !== undefined && status !== "") {
      if (String(status) === "1" || String(status).toLowerCase() === "true") where.status = true;
      if (String(status) === "0" || String(status).toLowerCase() === "false") where.status = false;
    }
    if (keyword) {
      const kw = String(keyword).trim();
      if (kw) {
        where[Op.or] = [
          { content: { [Op.like]: `%${kw}%` } },
          { nickname: { [Op.like]: `%${kw}%` } },
          { email: { [Op.like]: `%${kw}%` } },
        ];
      }
    }

    const result = await ToolComment.findAndCountAll({
      where,
      include: [{ model: Tool }],
      order: [["createdAt", "DESC"]],
      limit: safePageSize,
      offset,
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
    logger.error("List tool comments(admin) failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "获取评论列表失败" };
  }
});

router.put("/api/tool-comments/:id", authRequired, async (ctx) => {
  const { id } = ctx.params;
  const { status } = ctx.request.body || {};
  try {
    const row = await ToolComment.findByPk(id);
    if (!row) {
      ctx.status = 404;
      ctx.body = { code: -1, message: "评论不存在" };
      return;
    }
    if (status !== undefined) row.status = Boolean(status);
    await row.save();
    ctx.body = { code: 0, message: "更新成功", data: row };
  } catch (error) {
    logger.error("Update tool comment failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "更新评论失败" };
  }
});

router.delete("/api/tool-comments/:id", authRequired, async (ctx) => {
  const { id } = ctx.params;
  try {
    const row = await ToolComment.findByPk(id);
    if (!row) {
      ctx.status = 404;
      ctx.body = { code: -1, message: "评论不存在" };
      return;
    }
    await row.destroy();
    ctx.body = { code: 0, message: "删除成功" };
  } catch (error) {
    logger.error("Delete tool comment failed", {
      traceId: ctx.state && ctx.state.traceId,
      error: error.message,
    });
    ctx.status = 500;
    ctx.body = { code: -1, message: "删除评论失败" };
  }
});

// 创建工具
router.post("/api/tools", async (ctx) => {
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
});

// 工具列表
router.get("/api/tools", async (ctx) => {
  try {
    const pageRaw = ctx.query && ctx.query.page;
    const pageSizeRaw = ctx.query && (ctx.query.pageSize || ctx.query.page_size);
    const page = pageRaw !== undefined ? Number(pageRaw) : undefined;
    const pageSize = pageSizeRaw !== undefined ? Number(pageSizeRaw) : undefined;

    const order = [
      [sequelize.literal("sort IS NULL"), "ASC"], // 先按是否有排序值：有 sort 的在前
      ["sort", "ASC"], // 再按 sort 从小到大
      ["createdAt", "DESC"], // sort 相同时按创建时间倒序
    ];

    // 兼容：不传分页参数时，保持原先返回数组
    if (Number.isFinite(page) && Number.isFinite(pageSize) && page && pageSize) {
      const safePage = Math.max(1, Math.floor(page));
      const safePageSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
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
      return;
    }

    const tools = await Tool.findAll({
      include: [{ model: Category }],
      order,
    });
    ctx.body = {
      code: 0,
      message: "success",
      data: tools,
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
router.put("/api/tools/:id", async (ctx) => {
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
});

// 删除工具
router.delete("/api/tools/:id", async (ctx) => {
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
// 分类列表
router.get("/api/categories", async (ctx) => {
  try {
    const categories = await Category.findAll({
      order: [["id", "ASC"]],
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
router.post("/api/categories", async (ctx) => {
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
});

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
router.put("/api/categories/:id", async (ctx) => {
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
});

// 删除分类（同时删除关联关系）
router.delete("/api/categories/:id", async (ctx) => {
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
    const tryInitDbOnce = async () => {
      const isConnected = await testConnection({ silent: true });
      if (!isConnected) {
        console.warn("⚠️ 数据库连接失败：应用将继续启动（降级模式）");
        return false;
      }

      const isInitialized = await initDatabase({ silent: true });
      if (!isInitialized) {
        console.warn("⚠️ 数据库初始化失败：应用将继续启动（降级模式）");
        return false;
      }

      try {
        await syncModels();
        return true;
      } catch (e) {
        console.warn("⚠️ 数据表同步失败：应用将继续启动（降级模式）", e && e.message);
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

    // 健康检查路由
    router.get('/hc', async (ctx) => {
      try {
        const { getDbState } = require("./config/database");
        const state = getDbState();
        const dbConnected = Boolean(state.ready);
        ctx.body = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.server.environment,
          database: dbConnected ? 'connected' : 'disconnected',
          databaseState: state,
          version: '1.0.0'
        };
        ctx.status = dbConnected ? 200 : 503;
      } catch (error) {
        ctx.body = {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        };
        ctx.status = 503;
      }
    });

    // 挂载路由（工具 / 分类 / 健康检查等）
    app.use(router.routes());
    app.use(router.allowedMethods());

    // 静态文件服务放在最后，避免拦截 API 路由
    app.use(serve(path.join(__dirname, "public")));

    app.listen(config.server.port, () => {
      console.log(`服务器运行在 localhost:${config.server.port} `);
    });
  } catch (error) {
    console.error("应用启动失败:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
