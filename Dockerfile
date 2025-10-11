FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
