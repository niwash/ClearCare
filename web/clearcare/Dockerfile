# The site's image for AWS (infra/aws). Vercel builds the site from source and
# does not use this file.

# Both stages name node by the digest of its multi-platform index, so a rebuild
# uses the same bytes.
FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
# The lock file first, so the installed packages stay cached until it changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# NEXT_OUTPUT=standalone makes next.config.ts put the server and only the
# packages it needs in .next/standalone. It leaves out the static files, which
# are copied next to it.
FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
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
# Pages that read the API render on each request (lib/search.ts) and read
# API_URL then, so the same image serves any API.
CMD ["node", "server.js"]
