FROM node:latest

ENV ENV prod

WORKDIR /app/backend

COPY . /app
RUN cd /app/backend && npm install --unsafe-perm=true --allow-root
RUN cd /app && npm install --unsafe-perm=true --allow-root && npm run build
RUN cd /app/backend && mkdir views/ && mv ./public/schedule-patrols-sys/index.html ./views/

EXPOSE 4000

CMD [ "npm", "run", "start:prod" ]

# docker build -t schedule-patrols-sys .
# docker run --rm -p 127.0.0.1:4000:4000 --network server-package_databases -d schedule-patrols-sys
