/**
 * 广告与上传相关路由：后台 CRUD、C 端按位拉取、广告图上传
 * 在 app.js 中通过 registerAds(router, deps) 挂载
 */
function registerAds(router, deps) {
  const {
    logger,
    sequelize,
    Advertisement,
    authRequired,
    uploadAdsImage,
    validate,
    schemas,
    DEFAULT_PAGE,
    MAX_PAGE_SIZE,
  } = deps;

  // 上传广告图片
  router.post(
    "/api/upload/ads-image",
    authRequired,
    uploadAdsImage.single("file"),
    async (ctx) => {
      const file = ctx.file;
      if (!file) {
        ctx.status = 400;
        ctx.body = { code: -1, message: "未获取到上传文件" };
        return;
      }

      try {
        logger.info("Ads image uploaded", {
          traceId: ctx.state && ctx.state.traceId,
          userId: ctx.state && ctx.state.user && ctx.state.user.id,
          username: ctx.state && ctx.state.user && ctx.state.user.username,
          ip: ctx.ip,
          mimetype: file.mimetype,
          size: file.size,
          originalname: file.originalname,
          filename: file.filename,
        });
      } catch (e) {
        // ignore
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
    }
  );

  // 广告列表（后台管理用，默认分页）
  router.get("/api/ads", authRequired, async (ctx) => {
    try {
      const { page, pageSize, position, status } = ctx.query || {};
      const p = page !== undefined ? Number(page) : DEFAULT_PAGE;
      const ps = pageSize !== undefined ? Number(pageSize) : DEFAULT_PAGE_SIZE;

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

      const safePage = Math.max(1, Math.floor(Number.isFinite(p) ? p : DEFAULT_PAGE));
      const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number.isFinite(ps) ? ps : DEFAULT_PAGE_SIZE)));
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
  router.get("/api/ads/:id", authRequired, async (ctx) => {
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
  router.post(
    "/api/ads",
    authRequired,
    validate(schemas.createAd, { source: "body" }),
    async (ctx) => {
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
    }
  );

  // 更新广告
  router.put(
    "/api/ads/:id",
    authRequired,
    validate(schemas.updateAd, { source: "body" }),
    async (ctx) => {
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
        ad.linkUrl = linkUrl !== undefined ? linkUrl || null : ad.linkUrl;
        ad.position = position !== undefined ? position : ad.position;
        ad.displayType = displayType !== undefined ? displayType || "tile" : ad.displayType;
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
    }
  );

  // 删除广告
  router.delete("/api/ads/:id", authRequired, async (ctx) => {
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
}

module.exports = registerAds;
