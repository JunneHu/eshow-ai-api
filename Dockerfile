# 使用国内镜像源的 Node.js 镜像，如果直接拉取失败可以使用第三方加速
# 这里使用官方镜像，但在构建时配置 npm 和 apk 镜像
FROM mirror-store-registry.cn-hangzhou.cr.aliyuncs.com/ich-erp/node:20.17.0-alpine

# 配置 apk 使用阿里云国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装构建依赖（bcrypt等原生模块需要编译环境）
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 配置 npm 使用淘宝国内镜像源并安装依赖
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci --only=production

# 复制应用代码
COPY . .

# 处理权限，并且创建 logs 目录以防挂载失败时 node 无法写入
RUN mkdir -p logs && chown -R node:node /app
USER node

# 环境变量默认值
ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "app.js"]
