# Payment backend

Express API with modular **controller → service → Drizzle** layers.

## Quick start

```bash
npm install
cp .env.example .env
npm run db:setup    # push schema + seed demo data
npm run dev         # http://localhost:4000
```

Health check: `GET http://localhost:4000/health`

Demo login: `owner@acme.com` / `password123` → 2FA code `123456`

---

## Architecture

```
src/
├── app.ts                 # Express app (helmet, cors, morgan, routes)
├── index.ts               # Server entry
├── config/env.ts          # Zod-validated env
├── db/
│   ├── index.ts           # Drizzle + better-sqlite3
│   ├── schema/index.ts    # Tables (companies, employees, pay_runs, …)
│   └── seed.ts            # Demo seed data
├── common/
│   ├── errors/AppError.ts
│   ├── middleware/
│   │   ├── asyncHandler.ts    # express-async-handler
│   │   ├── validate.ts        # Zod body/query/params
│   │   ├── errorHandler.ts
│   │   └── notFoundHandler.ts
│   └── utils/
│       ├── response.ts        # sendSuccess, sendPaginated, sendCreated
│       ├── pagination.ts
│       └── payroll.ts
└── modules/
    ├── auth/          # login, 2FA, session
    ├── users/         # user CRUD (admin)
    ├── employees/     # validation → service → controller → routes
    ├── payments/
    ├── transactions/
    ├── members/
    └── dashboard/
```

## Layer responsibilities

- **validation** — Zod schemas for `body`, `query`, `params`
- **routes** — Express router + `validate()` + `asyncHandler(controller)`
- **controller** — HTTP in/out, calls service, uses response utils
- **service** — Business logic and database access
- **schema** — Drizzle table definitions in `db/schema/`

## Auth flow

1. `POST /auth/login` — email + password → `{ requires2FA, challengeToken }`
2. `POST /auth/verify-2fa` — `{ challengeToken, code }` → `{ accessToken, session }`
3. `POST /auth/resend-2fa` — refresh challenge TTL
4. `GET /auth/me` — current session (Bearer token)
5. `POST /auth/logout` — invalidate client session

Protected routes require `Authorization: Bearer <accessToken>`.

## API routes (prefix `/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login (step 1) |
| POST | `/auth/verify-2fa` | Verify 2FA (step 2) |
| POST | `/auth/resend-2fa` | Resend 2FA code |
| GET | `/auth/me` | Current session |
| POST | `/auth/logout` | Log out |
| GET/POST/PATCH/DELETE | `/users` | User management (owner/admin) |
| GET | `/employees` | List employees (paginated) |
| POST | `/employees` | Create employee |
| POST | `/employees/import` | CSV import `{ rows: [...] }` |
| GET/PATCH/DELETE | `/employees/:id` | Get / update / deactivate |
| GET/POST | `/payments` | List / create pay run |
| GET | `/payments/:id` | Pay run detail |
| GET | `/payments/:id/transactions` | Transactions for pay run |
| PATCH | `/payments/:id/status` | Update pay run status |
| GET | `/transactions` | All payroll transactions |
| GET/POST | `/members` | List / invite |
| PATCH/DELETE | `/members/:id` | Role / remove |
| GET | `/dashboard/stats` | Dashboard metrics |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express API (watch mode) |
| `npm run db:push` | Sync Drizzle schema to SQLite |
| `npm run db:seed` | Seed demo company & data |
| `npm run db:setup` | Push + seed |
| `npm run db:reset` | Delete SQLite DB and re-seed from scratch |

## Error handling

Throw `AppError` from services:

```ts
throw AppError.notFound("Employee not found")
throw AppError.duplicate("Email already exists")
throw AppError.forbidden("Cannot remove owner")
throw AppError.validation("Invalid input", details)
```

Global `errorHandler` maps these to JSON:

```json
{ "success": false, "message": "...", "code": "NOT_FOUND" }
```

Zod validation errors return `422` with `VALIDATION_ERROR` and flattened details.

## Response helpers

```ts
sendSuccess(res, data)           // 200 + JSON body (matches frontend axios)
sendCreated(res, data)           // 201
sendPaginated(res, { data, meta })
sendNoContent(res)               // 204
```

List endpoints match the existing frontend contract: `{ data: T[], meta: { page, pageSize, total, totalPages } }`.
