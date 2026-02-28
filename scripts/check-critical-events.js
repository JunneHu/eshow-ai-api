/**
 * 关键链路事件核查脚本（用于CI/定时任务）
 *
 * 用法：
 *   node scripts/check-critical-events.js --startDate=2026-02-01 --endDate=2026-02-03 --appId=templatewapversion2
 *
 * 规则（可按需扩展）：
 * - 必须存在 page_view
 * - 必须存在 product_view 或 buy_now（至少一种）
 * - 必须存在 sendOrder（下单）
 * - 必须存在 PayOrder 或 order_pay_success（至少一种）
 *
 * 退出码：
 * - 0：通过
 * - 2：缺少关键事件（或参数错误）
 */

const { Event } = require('../models');
const { Op } = require('sequelize');

function parseArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split('=').slice(1).join('=');
}

async function main() {
  const startDate = parseArg('startDate');
  const endDate = parseArg('endDate');
  const appId = parseArg('appId');

  if (!startDate || !endDate) {
    // eslint-disable-next-line no-console
    console.error('[check-critical-events] missing --startDate/--endDate');
    process.exit(2);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const where = {
    created_at: { [Op.between]: [start, end] },
  };
  if (appId && appId.trim() !== '' && appId !== 'undefined') where.app_id = appId;

  const names = ['page_view', 'product_view', 'buy_now', 'sendOrder', 'PayOrder', 'order_pay_success'];

  const rows = await Event.findAll({
    attributes: ['event_name', [Event.sequelize.fn('COUNT', Event.sequelize.col('id')), 'cnt']],
    where: { ...where, event_name: { [Op.in]: names } },
    group: ['event_name'],
    raw: true,
  });

  const map = rows.reduce((acc, r) => {
    acc[r.event_name] = Number(r.cnt || 0);
    return acc;
  }, {});

  const missing = [];
  const has = (n) => (map[n] || 0) > 0;

  if (!has('page_view')) missing.push('page_view');
  if (!has('product_view') && !has('buy_now')) missing.push('product_view|buy_now');
  if (!has('sendOrder')) missing.push('sendOrder');
  if (!has('PayOrder') && !has('order_pay_success')) missing.push('PayOrder|order_pay_success');

  // eslint-disable-next-line no-console
  console.log('[check-critical-events] params:', { startDate, endDate, appId: appId || null });
  // eslint-disable-next-line no-console
  console.log('[check-critical-events] counts:', map);

  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error('[check-critical-events] missing:', missing);
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log('[check-critical-events] OK');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[check-critical-events] error:', err && err.message ? err.message : err);
  process.exit(2);
});


