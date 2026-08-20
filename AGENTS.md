<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## E2E Testing

### Running the full test suite

The Playwright suite has 146 tests across 4 projects (admin, owner, manager, sales).
The full suite takes ~13 minutes and can exhaust memory on machines with <16GB RAM.

**Recommended: start the server manually first, then run tests:**

```bash
npm run build
npm run start &
sleep 5
PLAYWRIGHT_BROWSERS_PATH=/home/asif/.pw-browsers npx playwright test --reporter=list
```

**Running specific test files:**

```bash
PLAYWRIGHT_BROWSERS_PATH=/home/asif/.pw-browsers npx playwright test tests/e2e/user-management.spec.ts
```

### Test architecture

- `app.spec.ts` — admin (mohamed) smoke tests: auth, page render, sidebar, console health
- `rbac.spec.ts` — role-based access control for all 3 roles
- `user-management.spec.ts` — CRUD: create, edit, deactivate, reactivate users
- `interactions.spec.ts` — comprehensive click-through tests: KPIs, charts, search,
  detail pages, creation dialogs, sidebar nav, theme toggle
- `*-detail.spec.ts` — customer/quote/broadcast/conversation detail page tests
- `*.spec.ts` (others) — per-page functional smoke tests

### Known issues

- The `webServer` config in `playwright.config.ts` starts `npm run start` automatically,
  but if port 3000 is already in use, the server fails to start and all tests fail with
  "This page couldn't load". Always ensure port 3000 is free or a healthy server is
  running before starting tests.
- The logout test in `interactions.spec.ts` was removed because it invalidates the
  session token in the storage state, causing all subsequent tests to fail. The logout
  flow is tested in `app.spec.ts` under the admin project instead.
- E2E test users (email starting with `e2e-`) are created during test runs and should
  be cleaned up afterwards via the Supabase Admin API.
