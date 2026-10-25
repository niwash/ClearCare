This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Data

The site reads centres from the ClearCare API (`api/openapi.yaml`). Set these in `.env.local`, or in Vercel's environment variables:

- `API_URL`: the API's base URL. Production must set it.
Without `API_URL`, search and centre pages say the data isn't available.

For local work, run the API with `docker compose up -d` from the repository root (see `CONTRIBUTING.md`) and set `API_URL=http://127.0.0.1:8080`.
