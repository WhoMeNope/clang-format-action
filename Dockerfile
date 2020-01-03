FROM node:lts-buster

# install dependencies
RUN apt update -y && apt install -y \
  clang-format \
  git

WORKDIR /action

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

USER node
ENTRYPOINT ["node", "/action/index.js"]
