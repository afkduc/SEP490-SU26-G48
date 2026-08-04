# Vite doc bien VITE_* tu file .env ngay trong luc build (npm run build) va
# nhung thang vao JS bundle - vi vay .env PHAI co mat trong build context o
# buoc build nay (khac voi BE: bien moi truong BE duoc nap luc container
# CHAY, khong phai luc build). Xem .dockerignore - KHONG duoc loai tru .env
# o day (khong giong BE) vi Vite can doc no ngay tai day.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime: chi serve static file bang nginx, khong can Node nua ----
# He thong quan ly noi bo dat duoi "/crm" tren production (Landing chiem goc
# domain, xem docker-compose.yml + nginx.conf) - Vite da build asset voi
# base "/crm/" (vite.config.js) nen file tinh phai nam dung o "<root>/crm/"
# de URL khop voi noi dung index.html da build.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/crm
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
