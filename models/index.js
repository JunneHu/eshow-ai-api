const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// 工具模型：对应前端 mock-tools.json 中的工具结构
const Tool = sequelize.define(
  "Tool",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    // 来自 mock-tools.json 的工具唯一标识，例如 chat_doubao
    toolKey: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      field: "tool_key",
      comment: "工具唯一标识，对应 mock-tools.json 中的 id",
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "工具名称",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "工具描述",
    },
    websiteUrl: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      field: "website_url",
      comment: "官网地址",
    },
    // 排序字段：数值越小越靠前
    sort: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "排序字段：默认用历史 id 回填，新建可为空",
    },
    // 顶部 tags 字段（数组），例如 ["hot"]
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "工具标签数组",
    },
    // 统一的内容字段：存放工具的详细说明（支持富文本，使用 LONGTEXT）
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      comment:
        "工具的详细内容（可以直接粘贴 mock-tools.json 中的 detail 对象序列化结果等）",
    },
  },
  {
    tableName: "tools",
    underscored: true,
    timestamps: true,
    comment: "AI 工具表，对应前端 mock-tools.json 结构",
  }
);

// AI 资讯：用于 C 端展示与后台管理
const News = sequelize.define(
  "News",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "资讯标题",
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "资讯摘要",
    },
    coverImageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: "cover_image_url",
      comment: "封面图",
    },
    sourceUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: "source_url",
      comment: "来源链接",
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      comment: "正文内容（支持富文本）",
    },
    publishAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "publish_at",
      comment: "发布时间（可空，空表示未发布）",
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "是否启用/展示",
    },
  },
  {
    tableName: "news",
    underscored: true,
    timestamps: true,
    comment: "AI 资讯表",
  }
);

// 资讯评论：支持游客评论 + 回复（树形/一层回复分页模式与工具评论一致）
const NewsComment = sequelize.define(
  "NewsComment",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    newsId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "news_id",
      comment: "所属资讯ID",
    },
    parentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "parent_id",
      comment: "父评论ID（为空表示主评论）",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "评论内容",
    },
    nickname: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "昵称",
    },
    email: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: "邮箱",
    },
    website: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      comment: "网站",
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "是否展示（后台可下线）",
    },
  },
  {
    tableName: "news_comments",
    underscored: true,
    timestamps: true,
    comment: "资讯评论表（游客评论/回复）",
    indexes: [
      { fields: ["newsId", "status"] },
      { fields: ["parentId"] },
      { fields: ["createdAt"] },
    ],
  }
);

// 运营埋点事件日志：用于 PV/点击/曝光/评论等行为统计
const EventLog = sequelize.define(
  "EventLog",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    eventType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "event_type",
      comment: "事件类型（如 tool_view/ad_click/comment_submit 等）",
    },
    distinctId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: "distinct_id",
      comment: "匿名用户标识（localStorage 持久化）",
    },
    toolId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "tool_id",
      comment: "工具ID（可空）",
    },
    adId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "ad_id",
      comment: "广告ID（可空）",
    },
    newsId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "news_id",
      comment: "资讯ID（可空，用于 news_view/news_click/comment_submit 资讯评论）。若 event_logs 表已存在，请执行: ALTER TABLE event_logs ADD COLUMN news_id INT UNSIGNED NULL AFTER ad_id;",
    },
    position: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: "广告位/位置（如 home_top/tool_detail_bottom）",
    },
    path: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: "页面路径/URL（可空）",
    },
    props: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "事件附加属性（JSON）",
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "客户端IP",
    },
    ua: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      comment: "User-Agent",
    },
    referer: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      comment: "Referer",
    },
  },
  {
    tableName: "event_logs",
    underscored: true,
    timestamps: true,
    comment: "运营埋点事件日志表",
    indexes: [
      { fields: ["createdAt", "eventType"] },
      { fields: ["eventType"] },
      { fields: ["toolId"] },
      { fields: ["adId"] },
      { fields: ["newsId"] },
    ],
  }
);

// 工具评论：支持游客评论 + 回复（树形）
const ToolComment = sequelize.define(
  "ToolComment",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    toolId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "tool_id",
      comment: "所属工具ID",
    },
    parentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "parent_id",
      comment: "父评论ID（为空表示主评论）",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "评论内容",
    },
    nickname: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "昵称",
    },
    email: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: "邮箱",
    },
    website: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      comment: "网站",
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "是否展示（后台可下线）",
    },
  },
  {
    tableName: "tool_comments",
    underscored: true,
    timestamps: true,
    comment: "工具评论表（游客评论/回复）",
    indexes: [
      { fields: ["toolId", "status"] },
      { fields: ["parentId"] },
      { fields: ["createdAt"] },
    ],
  }
);

// 用户模型：用于登录/注册/修改密码
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: "登录用户名",
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
      comment: "密码哈希（bcrypt）",
    },
  },
  {
    tableName: "users",
    underscored: true,
    timestamps: true,
    comment: "后台用户表",
  }
);

// 分类模型：对应 mock-tools.json 中的 categories
const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    // mock-tools.json 中的 id，例如 writing/image 等
    categoryKey: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: "category_key",
      comment: "分类唯一标识，对应 mock-tools.json 中的 id",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "分类名称，例如 AI写作工具",
    },
  },
  {
    tableName: "categories",
    underscored: true,
    timestamps: true,
    comment: "AI 工具分类表",
  }
);

// 多对多关联：一个分类对应多个工具，一个工具也可以归属多个分类
const ToolCategory = sequelize.define(
  "ToolCategory",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
  },
  {
    tableName: "tool_categories",
    underscored: true,
    timestamps: true,
    comment: "工具与分类的多对多关联表",
  }
);

// 广告模型：支持按 position 投放 + sort 排序
const Advertisement = sequelize.define(
  "Advertisement",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "广告名称",
    },
    imageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      field: "image_url",
      comment: "广告图片地址",
    },
    linkUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: "link_url",
      comment: "广告跳转链接",
    },
    sort: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "排序：越小越靠前",
    },
    position: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "投放位置，例如 home_top / tool_detail_bottom",
    },
    displayType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: "display_type",
      defaultValue: "tile",
      comment: "展示类型：tile(平铺)/carousel(轮播)",
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "是否启用",
    },
  },
  {
    tableName: "advertisements",
    underscored: true,
    timestamps: true,
    comment: "广告投放表",
  }
);

Tool.belongsToMany(Category, {
  through: ToolCategory,
  foreignKey: "tool_id",
  otherKey: "category_id",
});
Category.belongsToMany(Tool, {
  through: ToolCategory,
  foreignKey: "category_id",
  otherKey: "tool_id",
});

Tool.hasMany(ToolComment, {
  foreignKey: "tool_id",
});
ToolComment.belongsTo(Tool, {
  foreignKey: "tool_id",
});
ToolComment.hasMany(ToolComment, {
  as: "replies",
  foreignKey: "parent_id",
});
ToolComment.belongsTo(ToolComment, {
  as: "parent",
  foreignKey: "parent_id",
});

News.hasMany(NewsComment, {
  foreignKey: "news_id",
});
NewsComment.belongsTo(News, {
  foreignKey: "news_id",
});
NewsComment.hasMany(NewsComment, {
  as: "replies",
  foreignKey: "parent_id",
});
NewsComment.belongsTo(NewsComment, {
  as: "parent",
  foreignKey: "parent_id",
});

// 默认分类（来自 mock-tools.json 中的 categories）
const DEFAULT_CATEGORIES = [
  { categoryKey: "writing", title: "AI写作工具" },
  { categoryKey: "image", title: "AI图像工具" },
  { categoryKey: "video", title: "AI视频工具" },
  { categoryKey: "office", title: "AI办公工具" },
  { categoryKey: "agent", title: "AI智能体" },
  { categoryKey: "chat", title: "AI聊天助手" },
  { categoryKey: "coding", title: "AI编程工具" },
  { categoryKey: "platform", title: "AI开发平台" },
  { categoryKey: "design", title: "AI设计工具" },
  { categoryKey: "audio", title: "AI音频工具" },
  { categoryKey: "search", title: "AI搜索引擎" },
  { categoryKey: "learn", title: "AI学习网站" },
  { categoryKey: "models", title: "AI训练模型" },
  { categoryKey: "eval", title: "AI模型评测" },
  { categoryKey: "content-detect", title: "AI内容检测" },
  { categoryKey: "prompt", title: "AI提示指令" },
];

const syncModels = async () => {
  // 生产环境禁用 alter，仅开发环境可开启；表结构变更请用迁移脚本（如 scripts/add-news-id-to-event-logs.js）
  const isProduction = process.env.NODE_ENV === "production";
  const syncAlter = !isProduction && process.env.DB_SYNC_ALTER !== "false";
  await sequelize.sync({ alter: syncAlter });

  // 为历史工具回填排序值：默认使用数据库 id
  await Tool.update(
    { sort: sequelize.col("id") },
    { where: { sort: null } }
  );

  // 将自增主键起始值提升到至少 10001，方便后续与历史数据区分
  if (sequelize.getDialect && sequelize.getDialect() === "mysql") {
    try {
      await sequelize.query("ALTER TABLE tools AUTO_INCREMENT = 10001");
    } catch (e) {
      // 忽略失败：不影响正常读写
    }
  }

  // 初始化默认分类（如果表为空）
  const count = await Category.count();
  if (count === 0) {
    await Category.bulkCreate(DEFAULT_CATEGORIES);
  }
};

module.exports = {
  Tool,
  User,
  Category,
  ToolCategory,
  Advertisement,
  ToolComment,
  News,
  NewsComment,
  EventLog,
  syncModels,
};
