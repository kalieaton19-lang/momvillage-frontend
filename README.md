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
## Project Structure

- `app/` — Next.js App Router pages and feature folders
	- `components/` — shared UI components
	- `home/`, `login/`, `signup/`, `profile/`, `village/`, etc.
- `lib/` — Supabase clients and user helpers
- `types/` — shared TypeScript domain types
- `utils/` — small helpers (dates, parsing)

## Conventions

- Use shared UI from `app/components/ui` (`Button`, `Input`, `Card`).
- Keep Supabase access via `lib/supabase.ts` (client) and `lib/supabaseAdmin.ts` (server).
- Add new domain types to `types/` and import across features.
- Prefer device-only dev: `HOST=127.0.0.1 PORT=3000 npm run dev`.

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

## Supabase integration (local dev)

This project includes optional Supabase authentication and admin routes. Follow these steps to connect your Supabase project for local development.

1. Create a `.env.local` in the project root (do not commit it).

	Copy the example and fill in values from your Supabase project settings (Project → Settings → API):

	```bash
	cp .env.local.example .env.local
	# then edit .env.local and fill the keys
	```

	Required values:

	- `NEXT_PUBLIC_SUPABASE_URL` — your project URL (e.g. `https://<project-ref>.supabase.co`)
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key (safe for client-side)

	Optional (server-only):

	- `SUPABASE_SERVICE_ROLE_KEY` — service role key (keep secret; do NOT expose to browser)
	- `SUPABASE_URL` — duplicate of the project URL (some server helpers use this)

2. Restart the dev server so Next.js picks up env changes:

	```bash
	npm run dev
	```

3. Quick verification

	- Client-side: open `http://localhost:3000/signup` and `http://localhost:3000/login` and sign up/sign in. Supabase JS stores session client-side by default.

	- Server-side (admin routes require `SUPABASE_SERVICE_ROLE_KEY`):

	  ```bash
	  # create a user via server admin route
	  curl -i -X POST http://localhost:3000/api/supabase/auth/signup \
		 -H 'Content-Type: application/json' \
		 -d '{"email":"you@example.com","password":"YourPass123"}'

	  # login (saves HttpOnly cookies)
	  curl -i -X POST http://localhost:3000/api/supabase/auth/login \
		 -H 'Content-Type: application/json' \
		 -d '{"email":"you@example.com","password":"YourPass123"}' -c /tmp/sb_cookies.txt

	  # check protected route using saved cookies
	  curl -i http://localhost:3000/api/supabase/auth/me -b /tmp/sb_cookies.txt
	  ```

4. Health check

	The repo includes a health endpoint at `/api/supabase/health` that verifies admin access (requires `SUPABASE_SERVICE_ROLE_KEY`). Call it to confirm server-side connectivity:

	```bash
	curl -i http://localhost:3000/api/supabase/health
	```

		Or run the included helper script (make executable first):

		```bash
		chmod +x ./scripts/check_supabase.sh
		./scripts/check_supabase.sh
		```

Security notes

- Never commit `.env.local`. Add it to `.gitignore` if not already present.
- The `SUPABASE_SERVICE_ROLE_KEY` is sensitive — store it only in local env files or your hosting provider's secret store.
- In production, prefer HttpOnly `Secure` cookies for sessions and implement token refresh/revocation logic.

Next steps (optional)

- Implement refresh and logout endpoints to renew/clear server tokens.
- Add middleware to protect server routes and attach authenticated user info.
- Migrate demo users to Supabase (a helper script is included at `scripts/migrate_demo_users.ts`).
