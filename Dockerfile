FROM node:slim

WORKDIR /action

COPY package.json package-lock.json .
RUN npm install --production

COPY . .

ENTRYPOINT ["node", "/action/index.js"]
