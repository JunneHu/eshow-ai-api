#!/bin/bash

# big-data-api 备份脚本
# 使用方法: ./scripts/backup.sh

set -e

# 配置
BACKUP_DIR="${BACKUP_DIR:-/backup/big-data-api}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "🚀 开始备份 big-data-api..."

# 1. 备份数据库
echo "📦 备份数据库..."
DB_PASSWORD=${DB_PASSWORD:-$(grep DB_PASSWORD .env | cut -d '=' -f2)}
if [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  警告: 未找到 DB_PASSWORD，跳过数据库备份"
else
    docker-compose exec -T mysql mysqldump -u root -p"$DB_PASSWORD" bigdata > "$BACKUP_DIR/db_$DATE.sql"
    echo "✅ 数据库备份完成: db_$DATE.sql"
fi

# 2. 备份日志文件
echo "📦 备份日志文件..."
if [ -d "logs" ]; then
    tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" logs/ 2>/dev/null || echo "⚠️  日志备份失败（可能没有日志文件）"
    echo "✅ 日志备份完成: logs_$DATE.tar.gz"
else
    echo "⚠️  日志目录不存在，跳过日志备份"
fi

# 3. 备份环境变量（不含敏感信息）
echo "📦 备份配置文件..."
if [ -f ".env" ]; then
    # 创建脱敏版本
    sed 's/=.*/=***/' .env > "$BACKUP_DIR/env_$DATE.txt"
    echo "✅ 配置文件备份完成: env_$DATE.txt"
fi

# 4. 清理旧备份
echo "🧹 清理 $RETENTION_DAYS 天前的备份..."
find "$BACKUP_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.txt" -mtime +$RETENTION_DAYS -delete
echo "✅ 清理完成"

# 5. 显示备份信息
echo ""
echo "📊 备份完成！"
echo "备份目录: $BACKUP_DIR"
echo "备份文件:"
ls -lh "$BACKUP_DIR" | tail -n +2

echo ""
echo "💾 备份大小:"
du -sh "$BACKUP_DIR"

