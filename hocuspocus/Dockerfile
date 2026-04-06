FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY server.js ./

EXPOSE 4000

CMD ["node", "server.js"]
