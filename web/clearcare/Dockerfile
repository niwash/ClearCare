# The site's image for AWS (infra/aws). Vercel builds the site from source and
# does not use this file.

FROM node:24-slim AS build
WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1
# The lock file first, so the installed packages stay cached until it changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# output: "standalone" in next.config.ts puts the server and only the packages
# it needs in .next/standalone. It leaves out the static files, which are
# copied next to it.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# The server writes its cache under .next, so the files belong to the image's
# node user, uid 1000.
COPY --from=build --chown=1000:1000 /build/.next/standalone ./
COPY --from=build --chown=1000:1000 /build/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /build/public ./public
USER 1000:1000
EXPOSE 3000
# API_URL is read when a page is rendered, so the same image serves any API.
CMD ["node", "server.js"]
