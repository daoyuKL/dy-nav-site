# DY导航站 - 通用 Docker 部署(Dockerfile)
# 适用于支持 Docker 的 PaaS 平台(Render/Railway/Dockfly/SnapDeploy等)
FROM node:20-alpine

WORKDIR /app

# 无第三方依赖,install 仅用于生成锁文件,很快
COPY package.json ./
RUN npm install --omit=dev || true

# 复制全部网站文件
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
