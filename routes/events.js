/**
 * 运营埋点：C 端批量上报
 * 在 app.js 中通过 registerEvents(router, deps) 挂载
 */
function registerEvents(router, deps) {
  const {
    logger,
    getClientIp,
    canReportEvents,
    safeString,
    safeJson,
    EVENT_TYPE_WHITELIST,
    EventLog,
  } = deps;

  router.post("/api/public/events/batch", async (ctx) => {
    const body = ctx.request.body || {};
    const list = Array.isArray(body.list) ? body.list : [];
    if (list.length === 0) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "参数错误：list 不能为空" };
      return;
    }
    if (list.length > 200) {
      ctx.status = 400;
      ctx.body = { code: -1, message: "参数错误：单次上报过多" };
      return;
    }

    const ip = getClientIp(ctx) || "";
    const limitResult = canReportEvents(ip);
    if (!limitResult.ok) {
      ctx.status = 429;
      ctx.body = { code: -1, message: limitResult.message || "操作过于频繁" };
      return;
    }

    const ua = safeString(ctx.headers && ctx.headers["user-agent"], 1024);
    const referer = safeString(ctx.headers && (ctx.headers.referer || ctx.headers.referrer), 1024);

    const rows = [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const eventType = raw.eventType ? String(raw.eventType).trim() : "";
      if (!eventType || !EVENT_TYPE_WHITELIST.has(eventType)) continue;

      const rawNewsId =
        raw.newsId !== undefined && raw.newsId !== null && String(raw.newsId) !== ""
          ? raw.newsId
          : (raw.props && raw.props.newsId !== undefined && raw.props.newsId !== null ? raw.props.newsId : null);
      const newsId = rawNewsId !== null ? Number(rawNewsId) : null;

      rows.push({
        eventType,
        distinctId: raw.distinctId ? safeString(raw.distinctId, 128) : null,
        toolId:
          raw.toolId !== undefined && raw.toolId !== null && String(raw.toolId) !== ""
            ? Number(raw.toolId)
            : null,
        adId:
          raw.adId !== undefined && raw.adId !== null && String(raw.adId) !== "" ? Number(raw.adId) : null,
        newsId: Number.isFinite(newsId) && newsId > 0 ? newsId : null,
        position: raw.position ? safeString(raw.position, 128) : null,
        path: raw.path ? safeString(raw.path, 512) : null,
        props: safeJson(raw.props),
        ip: safeString(ip, 64),
        ua,
        referer,
      });
    }

    if (rows.length === 0) {
      ctx.body = { code: 0, message: "success", data: { inserted: 0 } };
      return;
    }

    try {
      await EventLog.bulkCreate(rows);
      ctx.body = { code: 0, message: "success", data: { inserted: rows.length } };
    } catch (error) {
      logger.error("Report events batch failed", {
        traceId: ctx.state && ctx.state.traceId,
        error: error.message,
      });
      ctx.status = 500;
      ctx.body = { code: -1, message: "上报失败" };
    }
  });
}

module.exports = registerEvents;
