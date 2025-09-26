# multi-stage: build React/Vite app and serve with nginx
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# optional: eigene nginx.conf copy here
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]