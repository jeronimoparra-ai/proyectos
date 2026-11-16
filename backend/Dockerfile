# Imagen de producción del backend de Productivity App.
# Multi-stage: compila TypeScript y deja solo dependencias de runtime.
FROM node:22-alpine AS build
WORKDIR /app

# Dependencias primero (mejor cache de capas)
COPY package.json package-lock.json ./
RUN npm ci

# Código y compilación
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# El usuario node existe en la imagen oficial; no se ejecuta como root
USER node
EXPOSE 3000

# El puerto lo inyecta la plataforma (Render/Railway/Fly) vía PORT
CMD ["node", "dist/server.js"]
