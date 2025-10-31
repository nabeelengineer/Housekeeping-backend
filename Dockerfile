FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache python3 make g++ # for bcrypt/native deps
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
RUN mkdir -p /app/uploads/market && \
    chown -R node:node /app/uploads && \
    chmod -R 755 /app/uploads
USER node

ENV NODE_ENV=production
EXPOSE 4000
VOLUME /app/uploads

CMD ["node", "src/index.js"]
