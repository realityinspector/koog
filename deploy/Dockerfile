# Runs from a copy of dist-web/ (see scripts/deploy-fly.sh), so only the built demo is uploaded.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
