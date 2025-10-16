FROM node:18-alpine

WORKDIR /app
RUN apk add --no-cache python3 make g++ # for bcrypt/native deps
COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
