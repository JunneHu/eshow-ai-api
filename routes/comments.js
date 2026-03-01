/**
 * 评论路由：工具评论 + 资讯评论（C 端列表/创建 + 后台列表/更新/删除）
 * 在 app.js 中通过 registerComments(router, deps) 挂载
 */
function registerComments(router, deps) {
  const {
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
  } = deps;

  // ---------- 工具评论（C 端） ----------
  router.get("/api/public/tool-comments", async (ctx) => {
    const { toolId, page, pageSize } = ctx.query || {};
    const tid = Number(toolId);
    if (!Number.isFinite(tid) || tid <= 0) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "参数错误：toolId 为必填" };
      return;
    }
    try {
      const p = page !== undefined ? Number(page) : DEFAULT_PAGE;
      const ps = pageSize !== undefined ? Number(pageSize) : DEFAULT_PAGE_SIZE;
      const result = await listCommentsPublic(ToolComment, "toolId", tid, p, ps);
      ctx.body = { code: 0, message: "success", data: result };
    } catch (error) {
      logger.error("List tool comments failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取评论失败" };
    }
  });

  router.post(
    "/api/public/tool-comments",
    validate(schemas.createPublicComment, { source: "body" }),
    async (ctx) => {
      const { toolId } = ctx.request.body || {};
      const tid = Number(toolId);
      if (
        await createCommentPublic(ctx, {
          Model: ToolComment,
          EntityModel: Tool,
          entityIdKey: "toolId",
          entityId: tid,
          notFoundMessage: "工具不存在",
          parentBelongMessage: "父评论不存在或不属于该工具",
          logLabel: "Create tool comment failed",
        })
      )
        return;
    }
  );

  // ---------- 资讯评论（C 端） ----------
  router.get("/api/public/news-comments", async (ctx) => {
    const { newsId, page, pageSize } = ctx.query || {};
    const nid = Number(newsId);
    if (!Number.isFinite(nid) || nid <= 0) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "参数错误：newsId 为必填" };
      return;
    }
    try {
      const p = page !== undefined ? Number(page) : DEFAULT_PAGE;
      const ps = pageSize !== undefined ? Number(pageSize) : DEFAULT_PAGE_SIZE;
      const result = await listCommentsPublic(NewsComment, "newsId", nid, p, ps);
      ctx.body = { code: 0, message: "success", data: result };
    } catch (error) {
      logger.error("List news comments failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取评论失败" };
    }
  });

  router.post(
    "/api/public/news-comments",
    validate(schemas.createPublicComment, { source: "body" }),
    async (ctx) => {
      const { newsId } = ctx.request.body || {};
      const nid = Number(newsId);
      if (
        await createCommentPublic(ctx, {
          Model: NewsComment,
          EntityModel: News,
          entityIdKey: "newsId",
          entityId: nid,
          notFoundMessage: "资讯不存在",
          parentBelongMessage: "父评论不存在或不属于该资讯",
          logLabel: "Create news comment failed",
          checkEntity: (row) => !!row.status,
        })
      )
        return;
    }
  );

  // ---------- 工具评论（后台） ----------
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

  router.put(
    "/api/tool-comments/:id",
    authRequired,
    validate(schemas.updateCommentStatus, { source: "body" }),
    async (ctx) => {
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
    }
  );

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

  // ---------- 资讯评论（后台） ----------
  router.get("/api/news-comments", authRequired, async (ctx) => {
    try {
      const { page, pageSize, newsId, status, keyword } = ctx.query || {};
      const p = page !== undefined ? Number(page) : 1;
      const ps = pageSize !== undefined ? Number(pageSize) : 10;
      const safePage = Math.max(1, Math.floor(p || 1));
      const safePageSize = Math.min(200, Math.max(1, Math.floor(ps || 10)));
      const offset = (safePage - 1) * safePageSize;

      const where = {};
      if (newsId) {
        const nid = Number(newsId);
        if (Number.isFinite(nid) && nid > 0) where.newsId = nid;
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

      const result = await NewsComment.findAndCountAll({
        where,
        include: [{ model: News }],
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
      logger.error("List news comments(admin) failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取评论列表失败" };
    }
  });

  router.put(
    "/api/news-comments/:id",
    authRequired,
    validate(schemas.updateCommentStatus, { source: "body" }),
    async (ctx) => {
      const { id } = ctx.params;
      const { status } = ctx.request.body || {};
      try {
        const row = await NewsComment.findByPk(id);
        if (!row) {
          ctx.status = 404;
          ctx.body = { code: -1, message: "评论不存在" };
          return;
        }
        if (status !== undefined) row.status = Boolean(status);
        await row.save();
        ctx.body = { code: 0, message: "更新成功", data: row };
      } catch (error) {
        logger.error("Update news comment failed", {
          traceId: ctx.state && ctx.state.traceId,
          error: error.message,
        });
        ctx.status = 500;
        ctx.body = { code: -1, message: "更新评论失败" };
      }
    }
  );

  router.delete("/api/news-comments/:id", authRequired, async (ctx) => {
    const { id } = ctx.params;
    try {
      const row = await NewsComment.findByPk(id);
      if (!row) {
        ctx.status = 404;
        ctx.body = { code: -1, message: "评论不存在" };
        return;
      }
      await row.destroy();
      ctx.body = { code: 0, message: "删除成功" };
    } catch (error) {
      logger.error("Delete news comment failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "删除评论失败" };
    }
  });
}

module.exports = registerComments;
