FROM node:latest

ENV ENV prod

WORKDIR /app/back

COPY . /app
RUN cd /app/back && npm install --unsafe-perm=true --allow-root
RUN cd /app && npm install --unsafe-perm=true --allow-root && npm run build
RUN cd /app/back && mkdir views/ && mv ./public/hand-write-receipt/index.html ./views/

EXPOSE 4000

CMD [ "npm", "run", "start:prod" ]

# docker build -t hand-write-receipt .
# docker run --rm -p 127.0.0.1:5000:4000 --network server-package_databases -d hand-write-receipt
