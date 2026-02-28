// 纯净版 Swagger/OpenAPI 定义，只描述当前实际存在的接口

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "eshow AI 工具 API",
    version: "1.0.0",
    description:
      "用于 AI 工具后台录入与健康检查的简洁 API 文档。",
  },
  servers: [
    {
      url: "http://localhost:3099",
      description: "开发环境",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "服务健康检查",
    },
    {
      name: "Tools",
      description: "AI 工具录入与管理",
    },
    {
      name: "Categories",
      description: "AI 工具分类管理",
    },
  ],
  paths: {
    "/hc": {
      get: {
        tags: ["Health"],
        summary: "健康检查",
        description: "返回服务与数据库当前状态。",
        responses: {
          200: {
            description: "服务正常",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
          },
          503: {
            description: "服务或数据库不可用",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/tools": {
      post: {
        tags: ["Tools"],
        summary: "创建工具（录入）",
        description:
          "根据 mock 数据创建一个新的 AI 工具记录。无需登录。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ToolInput",
              },
            },
          },
        },
        responses: {
          201: {
            description: "创建成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/Tool",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "请求参数错误（缺少 id 或 name）",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        tags: ["Tools"],
        summary: "工具列表",
        description: "获取所有已录入的 AI 工具列表。",
        responses: {
          200: {
            description: "获取成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Tool" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tools/{id}": {
      get: {
        tags: ["Tools"],
        summary: "获取单个工具",
        description: "根据数据库自增 id 获取一个工具详情。",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "工具数据库自增 id",
          },
        ],
        responses: {
          200: {
            description: "获取成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/Tool",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "工具不存在",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Tools"],
        summary: "更新工具",
        description: "根据数据库自增 id 更新一个工具。",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ToolUpdateInput",
              },
            },
          },
        },
        responses: {
          200: {
            description: "更新成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/Tool",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "工具不存在",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Tools"],
        summary: "删除工具",
        description: "根据数据库自增 id 删除一个工具。",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "删除成功",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
          404: {
            description: "工具不存在",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/categories": {
      get: {
        tags: ["Categories"],
        summary: "分类列表",
        description: "获取所有 AI 工具分类。",
        responses: {
          200: {
            description: "获取成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Category" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Categories"],
        summary: "创建分类",
        description: "创建一个新的分类，id 对应 mock-tools.json 中的 category id。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CategoryInput",
              },
            },
          },
        },
        responses: {
          201: {
            description: "创建成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/Category",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "请求参数错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/categories/{id}": {
      get: {
        tags: ["Categories"],
        summary: "获取单个分类及其工具",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "分类数据库自增 id",
          },
        ],
        responses: {
          200: {
            description: "获取成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          allOf: [
                            { $ref: "#/components/schemas/Category" },
                            {
                              type: "object",
                              properties: {
                                Tools: {
                                  type: "array",
                                  items: { $ref: "#/components/schemas/Tool" },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "分类不存在",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Categories"],
        summary: "更新分类及其工具关联",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CategoryUpdateInput",
              },
            },
          },
        },
        responses: {
          200: {
            description: "更新成功",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          allOf: [
                            { $ref: "#/components/schemas/Category" },
                            {
                              type: "object",
                              properties: {
                                Tools: {
                                  type: "array",
                                  items: { $ref: "#/components/schemas/Tool" },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "分类不存在",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Categories"],
        summary: "删除分类",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "删除成功",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
          404: {
            description: "分类不存在",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          code: {
            type: "integer",
            description: "业务状态码，0 表示成功",
            example: 0,
          },
          message: {
            type: "string",
            description: "提示信息",
            example: "ok",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          code: {
            type: "integer",
            example: -1,
          },
          message: {
            type: "string",
            example: "服务器内部错误",
          },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "ok",
          },
          timestamp: {
            type: "string",
            format: "date-time",
          },
          uptime: {
            type: "number",
            description: "进程运行时长（秒）",
          },
          environment: {
            type: "string",
            example: "development",
          },
          database: {
            type: "string",
            example: "connected",
          },
          databaseState: {
            type: "object",
            description: "数据库状态详细信息",
          },
          version: {
            type: "string",
            example: "1.0.0",
          },
        },
      },
      // 输入结构
      ToolInput: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: {
            type: "string",
            description: "工具唯一标识，例如 chat_doubao",
            example: "chat_doubao",
          },
          name: {
            type: "string",
            description: "工具名称",
            example: "豆包",
          },
          sort: {
            type: "integer",
            description: "排序字段，新建时默认 1，可修改",
            nullable: true,
            example: 1,
          },
          description: {
            type: "string",
            description: "工具简要描述",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "标签数组，例如 ['hot']",
          },
          content: {
            type: "string",
            description:
              "工具的详细内容，可以是富文本，也可以直接粘贴 mock-tools.json 中的 detail 对象（JSON 字符串）。",
          },
        },
      },
      // 更新输入结构
      ToolUpdateInput: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          sort: {
            type: "integer",
            description: "排序字段，可选；数值越小越靠前",
            nullable: true,
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
          content: {
            type: "string",
          },
        },
      },
      // 返回的 Tool 结构（包含数据库生成的字段）
      Tool: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "数据库自增主键",
            example: 1,
          },
          sort: {
            type: "integer",
            description: "排序字段，数值越小越靠前；历史数据默认为 id，新建可为空",
            nullable: true,
          },
          toolKey: {
            type: "string",
            description: "对应请求中的 id",
            example: "chat_doubao",
          },
          name: {
            type: "string",
          },
          description: {
            type: "string",
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
          content: {
            type: "string",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      CategoryInput: {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: {
            type: "string",
            description: "分类 key，对应 mock-tools.json 中的 id，例如 writing",
          },
          title: {
            type: "string",
            description: "分类名称，例如 AI写作工具",
          },
        },
      },
      CategoryUpdateInput: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "新的分类名称",
          },
          toolIds: {
            type: "array",
            items: { type: "integer" },
            description: "要关联到该分类下的工具数据库 id 列表",
          },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "分类数据库自增主键",
          },
          categoryKey: {
            type: "string",
            description: "分类 key（mock-tools.json 中的 id）",
          },
          title: {
            type: "string",
            description: "分类名称",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
    },
  },
};

module.exports = swaggerSpec;
