This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Central Progress Storage

Memoriq stores progression through `/api/progression`. In production, configure a public Vercel Blob store and connect it to the Vercel project so `BLOB_STORE_ID` is available to server routes. Vercel Blob authentication is handled by Vercel's automatic OIDC flow at runtime.

The app writes one stable JSON blob at `memoriq/progression.json` with overwrite enabled, then reads it with `cache: 'no-store'`. This keeps iPhone and PC progress centralized without user accounts. In local development only, it can fall back to `local-kv-store.json`.

Required Vercel setup:

1. Open the project in Vercel.
2. Go to Storage.
3. Create a Blob store with Public access.
4. Connect it to this project for Production, Preview, and Development as needed.
5. Confirm `BLOB_STORE_ID` is present in the project environment.
6. Redeploy.
