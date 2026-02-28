const fs = require("fs");
const path = require("path");

const { Tool, syncModels } = require("../models");

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function isSearchPlaceholderUrl(url) {
  if (!url) return false;
  const s = String(url).trim().toLowerCase();
  return s.includes("bing.com/search");
}

function firstUrlFromString(str) {
  if (!str || typeof str !== "string") return "";
  const m = str.match(/https?:\/\/[^\s"'<>]+/i);
  const url = m ? m[0] : "";
  return isSearchPlaceholderUrl(url) ? "" : url;
}

function extractUrlFromDetailObj(obj) {
  if (!obj || typeof obj !== "object") return "";
  if (obj?.website?.label && String(obj.website.label).trim() === "搜索官网") return "";
  const candidates = [
    obj?.website?.url,
    obj?.websiteUrl,
    obj?.url,
    obj?.href,
    obj?.site,
    obj?.homepage,
    obj?.homePage,
    obj?.meta?.url,
    obj?.meta?.website,
    obj?.meta?.site,
    obj?.meta?.href,
    obj?.meta?.homepage,
    obj?.detail?.meta?.url,
    obj?.detail?.meta?.website,
    obj?.detail?.meta?.site,
    obj?.detail?.meta?.href,
  ]
    .map((x) => (x ? String(x).trim() : ""))
    .filter((x) => x && !isSearchPlaceholderUrl(x));
  if (candidates.length) return candidates[0];

  // 兜底：递归扫描字符串 URL
  const str = JSON.stringify(obj);
  return firstUrlFromString(str);
}

function loadMockWebsiteMap() {
  const map = new Map(); // toolKey -> url

  const candidates = [
    path.join(__dirname, "..", "..", "eshow-ai-mini", "src", "mock-tools-lite.json"),
    path.join(__dirname, "..", "..", "eshow-ai-mini", "src", "mock-tools.json"),
  ];

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, "utf8");
    const data = safeJsonParse(raw);
    const tools = Array.isArray(data?.tools) ? data.tools : [];
    for (const t of tools) {
      const toolKey = t?.id ? String(t.id) : "";
      if (!toolKey) continue;
      const url =
        extractUrlFromDetailObj(t) ||
        extractUrlFromDetailObj(t?.detail) ||
        extractUrlFromDetailObj(t?.meta);
      if (url && !map.has(toolKey)) map.set(toolKey, url);
    }
  }

  return map;
}

async function main() {
  console.log("[backfill] Syncing models...");
  await syncModels();

  const mockMap = loadMockWebsiteMap();
  console.log("[backfill] mock website candidates:", mockMap.size);

  const tools = await Tool.findAll({ order: [["id", "ASC"]] });
  console.log("[backfill] tools in db:", tools.length);

  let updated = 0;
  const missing = [];

  for (const t of tools) {
    const current = t.websiteUrl ? String(t.websiteUrl).trim() : "";
    if (current) continue;

    const fromMock = mockMap.get(t.toolKey) || "";
    let url = fromMock;

    if (!url) {
      const contentObj = typeof t.content === "string" ? safeJsonParse(t.content) : null;
      url = extractUrlFromDetailObj(contentObj) || firstUrlFromString(t.content);
    }

    if (isSearchPlaceholderUrl(url)) url = "";

    if (url) {
      await t.update({ websiteUrl: url });
      updated += 1;
    } else {
      missing.push({ id: t.id, toolKey: t.toolKey, name: t.name });
    }
  }

  console.log("[backfill] updated:", updated);
  console.log("[backfill] missing:", missing.length);

  const outPath = path.join(__dirname, "website-missing.json");
  fs.writeFileSync(outPath, JSON.stringify(missing, null, 2), "utf8");
  console.log("[backfill] wrote missing list:", outPath);
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});

