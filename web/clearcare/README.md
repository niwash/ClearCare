This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Data

The site reads centres from the ClearCare API (`api/openapi.yaml`). Set these in `.env.local`, or in Vercel's environment variables:

- `API_URL`: the API's base URL. Production must set it.
- `USE_MOCK_DATA=true`: give centre 34 the sample inspection reports in `lib/sample-reports.ts`, until the API serves reports. Never set it in production.

Without `API_URL`, search and centre pages say the data isn't available.
