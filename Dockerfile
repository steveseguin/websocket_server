FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY vdoninja.js server.js vdoninja_advanced.js ./

ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "vdoninja.js"]
