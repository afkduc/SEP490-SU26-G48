# Next.js can chay bang Node (SSR de co SEO that), khac FE (nginx serve
# static thuan). "npm run build" doc NEXT_PUBLIC_* tu .env.production ngay
# trong buoc build nay (bien duoc "nuong" vao client bundle), giong cach
# Vite doc FE/.env.production - xem giai thich trong FE/Dockerfile.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime: chi copy output "standalone" (da duoc Next trace san cac
# file node_modules can thiet), khong can "npm install" lai o day ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
