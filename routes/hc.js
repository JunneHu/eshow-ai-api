/**
 * 健康检查路由（P3 拆分示例）
 * 在 app.js 中通过 registerHc(router) 挂载
 */
const config = require("../config/config");

function registerHc(router) {
  router.get("/hc", async (ctx) => {
    try {
      const { getDbState } = require("../config/database");
      const state = getDbState();
      const dbConnected = Boolean(state.ready);
      const base = {
        status: dbConnected ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.environment,
        database: dbConnected ? "connected" : "disconnected",
        version: "1.0.0",
      };

      // 开发环境可查看详细状态，生产环境只返回精简信息
      const isProduction = process.env.NODE_ENV === "production";
      ctx.body = isProduction ? base : { ...base, databaseState: state };
      ctx.status = dbConnected ? 200 : 503;
    } catch (error) {
      ctx.body = {
        status: "error",
        timestamp: new Date().toISOString(),
      };
      ctx.status = 503;
    }
  });
}

module.exports = registerHc;
