/**
 * 运营埋点：后台统计接口（概览、Top、趋势、广告位 CTR）
 * 在 app.js 中通过 registerAnalytics(router, deps) 挂载
 */
function registerAnalytics(router, deps) {
  const { logger, sequelize, Op, EventLog, Tool, News, authRequired } = deps;

  router.get("/api/analytics/overview", authRequired, async (ctx) => {
    const { days } = ctx.query || {};
    const d = days !== undefined ? Number(days) : 7;
    const safeDays = Number.isFinite(d) ? Math.min(90, Math.max(1, Math.floor(d))) : 7;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    try {
      const baseWhere = { createdAt: { [Op.gte]: since } };

      const [
        toolViewPV,
        toolViewUV,
        adView,
        adClick,
        commentSubmit,
        officialClick,
        newsViewPV,
        newsViewUV,
        newsClick,
        commentSubmitNews,
      ] = await Promise.all([
        EventLog.count({ where: { ...baseWhere, eventType: "tool_view" } }),
        EventLog.count({
          where: { ...baseWhere, eventType: "tool_view" },
          distinct: true,
          col: "distinct_id",
        }),
        EventLog.count({ where: { ...baseWhere, eventType: "ad_view" } }),
        EventLog.count({ where: { ...baseWhere, eventType: "ad_click" } }),
        EventLog.count({ where: { ...baseWhere, eventType: "comment_submit" } }),
        EventLog.count({ where: { ...baseWhere, eventType: "tool_click_official" } }),
        EventLog.count({ where: { ...baseWhere, eventType: "news_view" } }),
        EventLog.count({
          where: { ...baseWhere, eventType: "news_view" },
          distinct: true,
          col: "distinct_id",
        }),
        EventLog.count({ where: { ...baseWhere, eventType: "news_click" } }),
        EventLog.count({
          where: { ...baseWhere, eventType: "comment_submit", newsId: { [Op.ne]: null } },
        }),
      ]);

      ctx.body = {
        code: 0,
        message: "success",
        data: {
          days: safeDays,
          toolViewPV,
          toolViewUV,
          adView,
          adClick,
          officialClick,
          commentSubmit,
          newsViewPV,
          newsViewUV,
          newsClick,
          commentSubmitNews,
        },
      };
    } catch (error) {
      logger.error("Analytics overview failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取统计失败" };
    }
  });

  router.get("/api/analytics/top-tools", authRequired, async (ctx) => {
    const { days, limit } = ctx.query || {};
    const d = days !== undefined ? Number(days) : 7;
    const safeDays = Number.isFinite(d) ? Math.min(90, Math.max(1, Math.floor(d))) : 7;
    const l = limit !== undefined ? Number(limit) : 10;
    const safeLimit = Number.isFinite(l) ? Math.min(50, Math.max(1, Math.floor(l))) : 10;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    try {
      const rows = await EventLog.findAll({
        attributes: ["toolId", [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
        where: {
          eventType: "tool_view",
          toolId: { [Op.ne]: null },
          createdAt: { [Op.gte]: since },
        },
        group: ["tool_id"],
        order: [[sequelize.literal("cnt"), "DESC"]],
        limit: safeLimit,
        raw: true,
      });

      const toolIds = rows.map((r) => Number(r.toolId)).filter((v) => Number.isFinite(v));
      const tools = toolIds.length
        ? await Tool.findAll({ where: { id: toolIds }, attributes: ["id", "name", "toolKey"] })
        : [];
      const toolMap = new Map(tools.map((t) => [Number(t.id), t]));

      ctx.body = {
        code: 0,
        message: "success",
        data: rows.map((r) => {
          const id = Number(r.toolId);
          const t = toolMap.get(id);
          return {
            toolId: id,
            toolName: t ? t.name : "",
            toolKey: t ? t.toolKey : "",
            count: Number(r.cnt) || 0,
          };
        }),
      };
    } catch (error) {
      logger.error("Analytics top tools failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取统计失败" };
    }
  });

  router.get("/api/analytics/top-ads", authRequired, async (ctx) => {
    const { days, limit } = ctx.query || {};
    const d = days !== undefined ? Number(days) : 7;
    const safeDays = Number.isFinite(d) ? Math.min(90, Math.max(1, Math.floor(d))) : 7;
    const l = limit !== undefined ? Number(limit) : 10;
    const safeLimit = Number.isFinite(l) ? Math.min(50, Math.max(1, Math.floor(l))) : 10;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    try {
      const rows = await EventLog.findAll({
        attributes: ["adId", "position", [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
        where: {
          eventType: "ad_click",
          adId: { [Op.ne]: null },
          createdAt: { [Op.gte]: since },
        },
        group: ["ad_id", "position"],
        order: [[sequelize.literal("cnt"), "DESC"]],
        limit: safeLimit,
        raw: true,
      });

      ctx.body = {
        code: 0,
        message: "success",
        data: rows.map((r) => ({
          adId: Number(r.adId),
          position: r.position ? String(r.position) : "",
          count: Number(r.cnt) || 0,
        })),
      };
    } catch (error) {
      logger.error("Analytics top ads failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取统计失败" };
    }
  });

  router.get("/api/analytics/top-news", authRequired, async (ctx) => {
    const { days, limit } = ctx.query || {};
    const d = days !== undefined ? Number(days) : 7;
    const safeDays = Number.isFinite(d) ? Math.min(90, Math.max(1, Math.floor(d))) : 7;
    const l = limit !== undefined ? Number(limit) : 10;
    const safeLimit = Number.isFinite(l) ? Math.min(50, Math.max(1, Math.floor(l))) : 10;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    try {
      const rows = await EventLog.findAll({
        attributes: ["newsId", [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
        where: {
          eventType: "news_view",
          newsId: { [Op.ne]: null },
          createdAt: { [Op.gte]: since },
        },
        group: ["news_id"],
        order: [[sequelize.literal("cnt"), "DESC"]],
        limit: safeLimit,
        raw: true,
      });

      const newsIds = rows.map((r) => Number(r.newsId ?? r.news_id)).filter((v) => Number.isFinite(v));
      const newsList = newsIds.length
        ? await News.findAll({ where: { id: newsIds }, attributes: ["id", "title"] })
        : [];
      const newsMap = new Map(newsList.map((n) => [Number(n.id), n]));

      ctx.body = {
        code: 0,
        message: "success",
        data: rows.map((r) => {
          const id = Number(r.newsId ?? r.news_id);
          const n = newsMap.get(id);
          return {
            newsId: id,
            newsTitle: n ? n.title : "",
            count: Number(r.cnt) || 0,
          };
        }),
      };
    } catch (error) {
      logger.error("Analytics top news failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取统计失败" };
    }
  });

  router.get("/api/analytics/trend", authRequired, async (ctx) => {
    const { days } = ctx.query || {};
    const d = days !== undefined ? Number(days) : 7;
    const safeDays = Number.isFinite(d) ? Math.min(90, Math.max(1, Math.floor(d))) : 7;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    try {
      const baseWhere = { createdAt: { [Op.gte]: since } };
      const groupDate = sequelize.fn("DATE", sequelize.col("created_at"));

      const buildMap = (rows) => {
        const m = new Map();
        (rows || []).forEach((r) => {
          const day = r.day ? String(r.day) : "";
          if (!day) return;
          m.set(day, Number(r.cnt) || 0);
        });
        return m;
      };

      const buildUvMap = (rows) => {
        const m = new Map();
        (rows || []).forEach((r) => {
          const day = r.day ? String(r.day) : "";
          if (!day) return;
          m.set(day, Number(r.uv) || 0);
        });
        return m;
      };

      const [
        toolViewPVRows,
        toolViewUVRows,
        adViewRows,
        adClickRows,
        commentRows,
        newsViewPVRows,
        newsClickRows,
        commentNewsRows,
      ] = await Promise.all([
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "tool_view" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [
            [groupDate, "day"],
            [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("distinct_id"))), "uv"],
          ],
          where: { ...baseWhere, eventType: "tool_view" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "ad_view" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "ad_click" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "comment_submit" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "news_view" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "news_click" },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
        EventLog.findAll({
          attributes: [[groupDate, "day"], [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "comment_submit", newsId: { [Op.ne]: null } },
          group: [groupDate],
          order: [[sequelize.literal("day"), "ASC"]],
          raw: true,
        }),
      ]);

      const pvMap = buildMap(toolViewPVRows);
      const uvMap = buildUvMap(toolViewUVRows);
      const adViewMap = buildMap(adViewRows);
      const adClickMap = buildMap(adClickRows);
      const commentMap = buildMap(commentRows);
      const newsViewPVMap = buildMap(newsViewPVRows);
      const newsClickMap = buildMap(newsClickRows);
      const commentNewsMap = buildMap(commentNewsRows);

      const result = [];
      for (let i = safeDays - 1; i >= 0; i -= 1) {
        const dt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        const day = `${yyyy}-${mm}-${dd}`;
        result.push({
          day,
          toolViewPV: pvMap.get(day) || 0,
          toolViewUV: uvMap.get(day) || 0,
          adView: adViewMap.get(day) || 0,
          adClick: adClickMap.get(day) || 0,
          commentSubmit: commentMap.get(day) || 0,
          newsViewPV: newsViewPVMap.get(day) || 0,
          newsClick: newsClickMap.get(day) || 0,
          commentSubmitNews: commentNewsMap.get(day) || 0,
        });
      }

      ctx.body = { code: 0, message: "success", data: { days: safeDays, list: result } };
    } catch (error) {
      logger.error("Analytics trend failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取统计失败" };
    }
  });

  router.get("/api/analytics/ad-ctr-by-position", authRequired, async (ctx) => {
    const { days } = ctx.query || {};
    const d = days !== undefined ? Number(days) : 7;
    const safeDays = Number.isFinite(d) ? Math.min(90, Math.max(1, Math.floor(d))) : 7;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    try {
      const baseWhere = { createdAt: { [Op.gte]: since } };

      const [viewRows, clickRows] = await Promise.all([
        EventLog.findAll({
          attributes: ["position", [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "ad_view", position: { [Op.ne]: null } },
          group: ["position"],
          raw: true,
        }),
        EventLog.findAll({
          attributes: ["position", [sequelize.fn("COUNT", sequelize.col("id")), "cnt"]],
          where: { ...baseWhere, eventType: "ad_click", position: { [Op.ne]: null } },
          group: ["position"],
          raw: true,
        }),
      ]);

      const viewMap = new Map((viewRows || []).map((r) => [String(r.position), Number(r.cnt) || 0]));
      const clickMap = new Map((clickRows || []).map((r) => [String(r.position), Number(r.cnt) || 0]));

      const positions = Array.from(
        new Set([...Array.from(viewMap.keys()), ...Array.from(clickMap.keys())])
      );
      const list = positions
        .map((p) => {
          const view = viewMap.get(p) || 0;
          const click = clickMap.get(p) || 0;
          return {
            position: p,
            adView: view,
            adClick: click,
            ctr: view > 0 ? click / view : 0,
          };
        })
        .sort((a, b) => b.ctr - a.ctr);

      ctx.body = { code: 0, message: "success", data: { days: safeDays, list } };
    } catch (error) {
      logger.error("Analytics ad ctr by position failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "获取统计失败" };
    }
  });
}

module.exports = registerAnalytics;
