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


## EduNext 10.2.41: server-owned credentials

This release replaces client-embedded provider keys with signed, revocable `FPT1` licenses.
Do not deploy until the environment and migration steps below are complete.

1. Rotate the provider key previously embedded in public JavaScript/bookmarklets. Removing it from the current tree cannot revoke copies or Git history.
2. Set `GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_ACCESS_TOKEN` and `LICENSE_SIGNING_SECRET` in server environment variables. Use two distinct random secrets of at least 32 characters. See `.env.example`; no credentials are bundled in source.
3. Configure a private Upstash Redis instance using `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Production fails closed without this storage. Development uses `.data/orders-v2.json` (ignored by Git).
4. Old public demo-store records are NOT imported automatically. Export/reconcile those records privately, then use the authenticated admin's manual license issuance to replace active legacy licenses. Existing `ENC_AI_` licenses are intentionally rejected. Customers must replace their old bookmarklets/userscripts.
5. Log into `/admin` with the admin access token. It remains in page memory and is cleared on reload/logout. Provider API keys are configured only in the server environment, never in the admin page.
6. After a renewal, the old license stops working: deliver the replacement license/bookmarklet to the customer. Revocation is checked against private storage on every AI request.

Build the shared client with `node scripts/build-edunext.cjs` after changing `scripts/edunext-client.js` or `scripts/turn-tracker.js`. All three distribution paths import `src/lib/edunextBundle.ts`. The historical `assistant_tools` scripts and `extension` directory are legacy and must not be published as the current client.

Verification: `node --test tests/security.test.cjs`, `node tests/tracker-browser.cjs`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build`.
Tests use stubbed AI and Redis responses, not customer data or paid API calls. The tracker browser test uses local HTML fixtures; verify real EduNext selectors before claiming production reliability.
