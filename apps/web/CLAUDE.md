# Frontend — Next.js App Router

## Commands
```bash
npm install
npm run dev    # Dev server (port 3000)
npm run build  # Production build
npm test       # Jest tests (or: make frontend-test from repo root)
```

## Architecture

### Provider Chain
`layout.tsx` → `Providers.tsx` → `AppShell.tsx` → page content

- `Providers.tsx`: wraps `ClerkProvider` + `GoogleReCaptchaProvider`
- `AppShell.tsx`: navigation bar, shared layout chrome
- All pages using state/effects/hooks must have `'use client'` at the top
- Static pages (rules, info) are Server Components

### Services Layer
```
services/
├── index.ts              # Re-exports for convenience
├── core/base.ts          # Shared fetch wrapper — reads NEXT_PUBLIC_API_URL
├── admin/league.ts       # Admin API calls
└── public/
    ├── contact.ts
    └── invitations.ts
```
New API calls go in `admin/` or `public/` depending on auth requirements. All use the base fetch wrapper from `core/base.ts`.

### Components
```
components/
├── Providers.tsx               # Top-level provider wrapper
├── AppShell.tsx                # Nav + layout shell
├── layout/BaseLayout.tsx       # Page-level layout wrapper
├── modals/                     # RegistrationModal, ProfileCompletionModal
│   └── registration/           # Multi-step registration flow components
└── common/                     # Button, Input, Select, ConfirmDialog, InlineTable, InlineEditableField
```

### Hooks
- `useAuthenticatedApi()` — standard way to make authenticated API requests (attaches Clerk JWT)
- `useAdmin()` — checks admin status via backend
- `useMyTeam()` — fetches current user's team assignment
- `useLeagues()` — fetches league list

### Auth
- `@clerk/nextjs` provides `ClerkProvider` (in `Providers.tsx`) and `middleware.ts` (protects `/admin(.*)`)
- `useAuthenticatedApi()` attaches the Clerk session token to API requests
- Navigation: `next/link` (`<Link href="">`) and `next/navigation` (`useRouter`, `useParams`)

### Testing
```
__mocks__/
├── handlers.ts          # MSW handlers for all API endpoints
├── server.ts            # MSW Node server
└── @clerk/nextjs.ts     # Jest manual mock for Clerk hooks/components
setupTests.ts            # MSW lifecycle (beforeAll/afterEach/afterAll)
test-utils.tsx           # Custom render wrapper with providers
```
- Add `__tests__/` directories next to source files
- Add new API endpoints to `__mocks__/handlers.ts`
- Clerk is mocked via manual mock at `__mocks__/@clerk/nextjs.ts`
