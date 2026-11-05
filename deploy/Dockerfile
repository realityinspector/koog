# Runs from a temp build context made by scripts/deploy-fly.sh, so only these files are uploaded:
#   site/ (the built demo)  server/*.ts  src/links/{links.ts,catalog.ts,catalog.data.json}  package.json + package-lock.json (server deps only)
# One container, two processes: nginx on :8080 (static files, rate limits) in front of Node on 127.0.0.1:8787 (API + MCP).
FROM node:24-alpine
RUN apk add --no-cache nginx su-exec && mkdir -p /run/nginx /var/log/nginx
WORKDIR /app
# production dependencies only (the MCP SDK and zod); no scripts run at install
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server/ server/
COPY src/links/ src/links/
COPY src/features/synth-history/emu/aliases.ts src/features/synth-history/emu/aliases.ts
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production PORT=8787 HOST=127.0.0.1 NODE_OPTIONS=--max-old-space-size=96
EXPOSE 8080
CMD ["/entrypoint.sh"]
