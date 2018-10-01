FROM registry.its.txstate.edu/node-api-utils:10

RUN apt-get update -y
RUN apt-get upgrade -y

WORKDIR /usr/src/app

COPY package.json ./

RUN npm --quiet --production install

COPY lib lib
COPY models models
COPY index.js index.js
