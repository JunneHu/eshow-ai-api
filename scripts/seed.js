const fs = require("fs");
const path = require("path");

const { Tool, Category, syncModels } = require("../models");
const { sequelize } = require("../config/database");

async function seed() {
  try {
    console.log("[seed] Syncing models...");
    await syncModels();

    const mockPath = path.join(
      __dirname,
      "..",
      "..",
      "eshow-ai-mini",
      "src",
      "mock-tools.json"
    );

    console.log("[seed] Reading mock data from:", mockPath);
    const raw = fs.readFileSync(mockPath, "utf8");
    const data = JSON.parse(raw);

    const categories = Array.isArray(data.categories) ? data.categories : [];
    const tools = Array.isArray(data.tools) ? data.tools : [];

    // 先确保所有分类存在于数据库中，并建立映射
    const categoryKeyMap = new Map(); // key: categoryKey (mock id) -> Category instance
    const categoryTitleMap = new Map(); // key: title (中文名称) -> Category instance

    console.log(`[seed] Ensuring ${categories.length} categories...`);
    for (const c of categories) {
      if (!c || !c.id || !c.title) continue;

      const [category] = await Category.findOrCreate({
        where: { categoryKey: c.id },
        defaults: { title: c.title },
      });

      // 如果标题有变化，顺便更新一下
      if (category.title !== c.title) {
        await category.update({ title: c.title });
      }

      categoryKeyMap.set(c.id, category);
      categoryTitleMap.set(c.title, category);
    }

    console.log(`[seed] Seeding ${tools.length} tools...`);

    for (const tool of tools) {
      if (!tool || !tool.id) continue;

      const toolKey = tool.id;

      // 统一整理 tags：
      // 1) 优先使用顶层 tool.tags（数组）
      // 2) 如果没有，再使用 detail.meta.tags（字符串或数组），转成数组
      let finalTags = [];
      if (Array.isArray(tool.tags) && tool.tags.length > 0) {
        finalTags = tool.tags;
      } else if (
        tool.detail &&
        tool.detail.meta &&
        tool.detail.meta.tags !== undefined &&
        tool.detail.meta.tags !== null &&
        tool.detail.meta.tags !== ""
      ) {
        if (Array.isArray(tool.detail.meta.tags)) {
          finalTags = tool.detail.meta.tags;
        } else {
          finalTags = [tool.detail.meta.tags];
        }
      }

      const payload = {
        toolKey,
        name: tool.name || toolKey,
        description: tool.description || "",
        tags: finalTags,
        content: tool.detail ? JSON.stringify(tool.detail) : null,
      };

      const [toolRecord, created] = await Tool.findOrCreate({
        where: { toolKey },
        defaults: payload,
      });

      if (!created) {
        await toolRecord.update(payload);
      }

      // 根据现有规则，优先使用工具 id 前缀作为分类 key，例如：
      // image_huiwa -> image
      let categoryInstance = null;
      const prefixKey = String(toolKey).split("_")[0];

      if (prefixKey && categoryKeyMap.has(prefixKey)) {
        categoryInstance = categoryKeyMap.get(prefixKey);
      } else if (
        tool.detail &&
        tool.detail.meta &&
        typeof tool.detail.meta.category === "string"
      ) {
        // 兜底：使用 meta.category（中文名称）匹配分类 title
        const title = tool.detail.meta.category.trim();
        if (categoryTitleMap.has(title)) {
          categoryInstance = categoryTitleMap.get(title);
        }
      }

      if (categoryInstance) {
        // 使用 addCategory 避免覆盖已有关联
        await toolRecord.addCategory(categoryInstance);
        console.log(
          `[seed] Tool ${toolKey} -> category ${categoryInstance.categoryKey}`
        );
      } else {
        console.warn(
          `[seed] Tool ${toolKey} has no matched category (id prefix: ${prefixKey})`
        );
      }
    }

    console.log("[seed] Seeding completed successfully.");
  } catch (err) {
    console.error("[seed] Seeding failed:", err);
    throw err;
  } finally {
    try {
      await sequelize.close();
      console.log("[seed] Database connection closed.");
    } catch (e) {
      // ignore
    }
  }
}

if (require.main === module) {
  seed().catch(() => {
    process.exit(1);
  });
}

