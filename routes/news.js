/**
 * 资讯路由：C 端列表/详情 + 后台 CRUD
 * 在 app.js 中通过 registerNews(router, deps) 挂载
 */
function registerNews(router, deps) {
  const { logger, sequelize, Op, News, authRequired, validate, schemas, DEFAULT_PAGE, MAX_PAGE_SIZE } = deps;

  // C 端：资讯列表（分页、关键词、仅已发布）
  router.get("/api/public/news", async (ctx) => {
    try {
      const { page, pageSize, keyword } = ctx.query || {};
      const p = page !== undefined ? Number(page) : DEFAULT_PAGE;
      const ps = pageSize !== undefined ? Number(pageSize) : DEFAULT_PAGE_SIZE;
      const kw = keyword ? String(keyword).trim() : "";

      const publishCondition = {
        [Op.or]: [
          { publishAt: null },
          { publishAt: { [Op.lte]: new Date() } },
        ],
      };
      const where = { status: true };
      if (kw) {
        where[Op.and] = [
          publishCondition,
          {
            [Op.or]: [
              { title: { [Op.like]: `%${kw}%` } },
              { summary: { [Op.like]: `%${kw}%` } },
            ],
          },
        ];
      } else {
        where[Op.and] = [publishCondition];
      }

      const order = [
        [sequelize.literal("publish_at IS NULL"), "ASC"],
        ["publishAt", "DESC"],
        ["id", "DESC"],
      ];

      const safePage = Math.max(1, Math.floor(Number.isFinite(p) ? p : DEFAULT_PAGE));
      const safePageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Math.floor(Number.isFinite(ps) ? ps : DEFAULT_PAGE_SIZE))
      );
      const offset = (safePage - 1) * safePageSize;

      const result = await News.findAndCountAll({
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
      logger.error("List public news failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取资讯失败" };
    }
  });

  // C 端：资讯详情
  router.get("/api/public/news/:id", async (ctx) => {
    const { id } = ctx.params;
    try {
      const row = await News.findByPk(id);
      const notYetPublished =
        row && row.publishAt && new Date(row.publishAt).getTime() > Date.now();
      if (!row || !row.status || notYetPublished) {
        ctx.status = 404;
        ctx.body = { code: -1, message: "资讯不存在" };
        return;
      }
      ctx.body = { code: 0, message: "success", data: row };
    } catch (error) {
      logger.error("Get public news failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取资讯失败" };
    }
  });

  // 后台：资讯列表
  router.get("/api/news", authRequired, async (ctx) => {
    try {
      const { page, pageSize, status, keyword } = ctx.query || {};
      const p = page !== undefined ? Number(page) : 1;
      const ps = pageSize !== undefined ? Number(pageSize) : 10;
      const safePage = Math.max(1, Math.floor(p || 1));
      const safePageSize = Math.min(200, Math.max(1, Math.floor(ps || 10)));
      const offset = (safePage - 1) * safePageSize;

      const where = {};
      if (status !== undefined && status !== "") {
        if (String(status) === "1" || String(status).toLowerCase() === "true") where.status = true;
        if (String(status) === "0" || String(status).toLowerCase() === "false") where.status = false;
      }
      if (keyword) {
        const kw = String(keyword).trim();
        if (kw) {
          where[Op.or] = [
            { title: { [Op.like]: `%${kw}%` } },
            { summary: { [Op.like]: `%${kw}%` } },
          ];
        }
      }

      const order = [
        [sequelize.literal("publish_at IS NULL"), "ASC"],
        ["publishAt", "DESC"],
        ["id", "DESC"],
      ];

      const result = await News.findAndCountAll({
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
      logger.error("List news(admin) failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取资讯列表失败" };
    }
  });

  // 后台：资讯详情
  router.get("/api/news/:id", authRequired, async (ctx) => {
    const { id } = ctx.params;
    try {
      const row = await News.findByPk(id);
      if (!row) {
        ctx.status = 404;
        ctx.body = { code: -1, message: "资讯不存在" };
        return;
      }
      ctx.body = { code: 0, message: "success", data: row };
    } catch (error) {
      logger.error("Get news(admin) failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取资讯失败" };
    }
  });

  // 后台：创建资讯
  router.post(
    "/api/news",
    authRequired,
    validate(schemas.createNews, { source: "body" }),
    async (ctx) => {
      const { title, summary, coverImageUrl, sourceUrl, content, publishAt, status } =
        ctx.request.body || {};
      const finalTitle = title ? String(title).trim() : "";
      if (!finalTitle) {
        ctx.status = 400;
        ctx.body = { code: -1, message: "title 为必填" };
        return;
      }
      try {
        const row = await News.create({
          title: finalTitle,
          summary: summary ? String(summary) : null,
          coverImageUrl: coverImageUrl ? String(coverImageUrl) : null,
          sourceUrl: sourceUrl ? String(sourceUrl) : null,
          content: content ? String(content) : null,
          publishAt: publishAt ? new Date(publishAt) : null,
          status: status === undefined ? true : Boolean(status),
        });
        ctx.status = 201;
        ctx.body = { code: 0, message: "创建成功", data: row };
      } catch (error) {
        logger.error("Create news failed", {
          traceId: ctx.state && ctx.state.traceId,
          error: error.message,
        });
        ctx.status = 500;
        ctx.body = { code: -1, message: "创建资讯失败" };
      }
    }
  );

  // 后台：更新资讯
  router.put(
    "/api/news/:id",
    authRequired,
    validate(schemas.updateNews, { source: "body" }),
    async (ctx) => {
      const { id } = ctx.params;
      const { title, summary, coverImageUrl, sourceUrl, content, publishAt, status } =
        ctx.request.body || {};
      try {
        const row = await News.findByPk(id);
        if (!row) {
          ctx.status = 404;
          ctx.body = { code: -1, message: "资讯不存在" };
          return;
        }

        if (title !== undefined) row.title = String(title).trim();
        if (summary !== undefined) row.summary = summary ? String(summary) : null;
        if (coverImageUrl !== undefined) row.coverImageUrl = coverImageUrl ? String(coverImageUrl) : null;
        if (sourceUrl !== undefined) row.sourceUrl = sourceUrl ? String(sourceUrl) : null;
        if (content !== undefined) row.content = content ? String(content) : null;
        if (publishAt !== undefined) row.publishAt = publishAt ? new Date(publishAt) : null;
        if (status !== undefined) row.status = Boolean(status);

        await row.save();
        ctx.body = { code: 0, message: "更新成功", data: row };
      } catch (error) {
        logger.error("Update news failed", {
          traceId: ctx.state && ctx.state.traceId,
          error: error.message,
        });
        ctx.status = 500;
        ctx.body = { code: -1, message: "更新资讯失败" };
      }
    }
  );

  // 后台：删除资讯
  router.delete("/api/news/:id", authRequired, async (ctx) => {
    const { id } = ctx.params;
    try {
      const row = await News.findByPk(id);
      if (!row) {
        ctx.status = 404;
        ctx.body = { code: -1, message: "资讯不存在" };
        return;
      }
      await row.destroy();
      ctx.body = { code: 0, message: "删除成功" };
    } catch (error) {
      logger.error("Delete news failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "删除资讯失败" };
    }
  });
}

module.exports = registerNews;
