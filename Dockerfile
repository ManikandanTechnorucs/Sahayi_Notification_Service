# apps/reminder-service/Dockerfile

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3003

CMD ["npx", "ts-node", "src/server.ts"]
