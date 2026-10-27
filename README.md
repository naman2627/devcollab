# DevCollab

Developers post side projects and recruit collaborators. Others browse, upvote,
comment and apply to open roles. Owners accept or reject. Accepted
collaborators get a real-time chat. Gemini can draft the project description.

MERN end-term project — MongoDB, Express, React, Node, Socket.io.

---

## 1. Problem statement

Side projects die alone.

A developer with an idea usually needs two or three other people with
complementary skills — someone for the frontend, someone who has deployed a
model before, someone who will actually finish the mobile build. There is no
good place to find them:

- **GitHub** shows finished code, not projects that are looking for people.
- **Twitter / Discord** posts scroll away within hours, and nobody can search
  them later.
- **LinkedIn** is built around paid jobs, not unpaid side projects.
- **College groups** reach whoever happens to be in that group.

So the match never happens. Ideas stay solo and quietly die, while the people
who would have joined them — students who want real collaborative experience
instead of another tutorial clone — have nowhere to look.

The gap is not a lack of ideas or a lack of willing developers. It is that
nothing connects the two and then gets the team talking.

---

## 2. Target users

**Project owners** — developers and students who have a side project and need
collaborators with named skills. They want to describe the project once, say
which roles are open, and then judge who applies instead of cold-messaging
strangers.

**Collaborators** — students and junior developers who want to work on
something real with other people, for portfolio evidence and experience. They
want to filter by the stack they actually know and send a short pitch rather
than hope a tweet is seen.

Both sides are the same population at different moments: today's applicant is
next month's owner, which is why every account can do both and there is no
separate "recruiter" role.

---

## 3. Solution

DevCollab is a recruitment pipeline for side projects, not a project
directory. The product is the full lifecycle:

```
Owner posts a project with open roles and a tech stack
        |
Collaborator discovers it         (search, tech filter, status filter)
        |
Collaborator applies with a pitch (once per project - enforced in the database)
        |
Owner reviews applications        (dashboard of everyone who applied)
        |
Owner accepts or rejects          (the decision that forms the team)
        |
Acceptance unlocks a private real-time chat
        |
The team starts working
```

The design idea that holds it together: **acceptance is the gate that creates
the team.** The chat thread does not exist until an owner accepts somebody.
That single rule is what makes this an application with a workflow rather than
a board of posts — the accept decision changes authorization, creates a
conversation, writes a notification and opens a websocket room, all from one
action.

---

## 4. Key features

Five workflows, each implemented end to end rather than stubbed:

**1. Post and discover projects.** Create a project with a summary, tech stack,
open roles, status and cover image (uploaded to Cloudinary, or a plain URL if
no keys are configured). The feed offers full-text search, filtering by tech and
status, and sorting; every filter lives in the URL, so a filtered feed is a
shareable link. All lists are paginated with a server-side cap on `?limit`.

**2. Apply and decide.** One application per person per project, enforced by a
compound unique index rather than a racy controller check. Owners get a
dashboard of applications to accept or reject; applicants see their own
outgoing applications and current status.

**3. Real-time collaboration.** Acceptance opens a private chat between owner
and collaborator — Socket.io over the same port and the same auth cookie, with
typing indicators, online presence and multi-tab support. Messages are written
to MongoDB before they are emitted, so nothing shown ever disappears on
refresh.

**4. Social signals.** Upvote projects, comment on them, follow other
developers, and get a live notification badge on likes, comments,
applications, decisions and follows. There is a "following" feed built from who
you follow.

**5. AI-assisted drafting.** Gemini drafts a project description from the
title and tech stack, so the blank-page problem does not stop someone posting.
It is strictly optional — with no API key the endpoint returns a clean 503 and
the client hides the button.

Authentication sits under all of it: a 7-day JWT in an httpOnly cookie, bcrypt
at 12 rounds, and ownership checks that return 403 rather than pretending a
resource is missing.

---

## 5. Tech stack

| Layer | Choice | Why this one |
|---|---|---|
| Runtime | **Node 18+** | One language across client and server, and the event loop suits an app whose two heaviest paths are both I/O-bound: database reads and open websockets. |
| Server | **Express 4** | Small enough that the request path stays readable. Middleware composition is exactly the shape the auth/upload/error layers need. |
| Database | **MongoDB + Mongoose** | Projects have ragged, list-shaped fields — `techStack`, `openRoles`, `likes` — that would otherwise be three join tables. Mongoose adds the schema validation and hooks that raw documents lack, so `pre('save')` can own password hashing. |
| Real-time | **Socket.io** | Chat and the notification badge need server-initiated pushes. It shares the HTTP port, so it reuses the same auth cookie and needs no second service. Chosen over raw `ws` for rooms and automatic reconnection. |
| Auth | **jsonwebtoken + bcryptjs** | A stateless 7-day JWT in an httpOnly cookie, so no session store to deploy. bcrypt at 12 rounds for deliberately slow password hashing. |
| Client | **React 18** | The feed, applications dashboard and chat are all component trees over changing state. |
| Build | **Vite 6** | Fast dev server, and its `/api` proxy makes local development single-origin, matching production exactly. |
| Routing | **React Router 6** | Dynamic routes plus `useSearchParams`, which is what lets feed filters live in the URL. |
| State | **Zustand** | Auth and socket state are needed across unrelated pages. Redux's boilerplate is not justified at this size; Context would re-render too broadly. |
| Styling | **Tailwind v4** | Design tokens in one `@theme` block, and no separate stylesheet drifting from the markup. |
| Images | **Cloudinary + multer** | Render's filesystem is ephemeral, so uploads cannot live on disk. `memoryStorage` streams straight through. Optional — absent keys fall back to an image-URL field. |
| AI | **Google Gemini** | Drafts project descriptions. Called over plain `fetch` with an `AbortController` timeout rather than an SDK, since one endpoint does not justify a dependency. Optional. |
| Hosting | **Render** | One web service runs the API and serves the built client, so there is no CORS setup and no cross-site cookie problem. Reads `render.yaml`. |

Deliberately **not** used: TypeScript (the schema layer already validates at
the boundary, and the time was better spent on workflows), Redux, a separate
static host for the frontend, and any component library — the UI is small
enough that Tailwind alone keeps it consistent.

---

## 6. Local setup

```bash
cd devcollab
npm install                 # server dependencies (root package.json)
cp .env.example .env        # then edit .env - see the table below
npm run seed                # 8 users, 12 projects, comments, applications, messages
npm run dev                 # Express on :5000, Vite on :5173
```

Open **http://localhost:5173**. Vite proxies `/api` and `/socket.io` to
Express, so the browser only ever talks to one origin — exactly like production.

Only `MONGO_URI` and `JWT_SECRET` are required. The app runs fully without
Cloudinary or Gemini keys.

### Production mode locally (the thing that breaks on deploy — verified working)

```bash
npm run build                                  # vite build -> client/dist
NODE_ENV=production npm start                  # one port serves API + React app
```

Open **http://localhost:5000**. Express serves `client/dist` and the API from
the same port, and a hard refresh on `/feed` or `/projects/:id` still works
because of the SPA fallback in `server/app.js`.

### Self-test

```bash
npm start           # in one terminal
npm run smoke       # in another
```

`server/utils/smoke.js` is a black-box HTTP client — it starts nothing and
imports no app code. It registers two users, logs in, creates a project, likes,
comments, applies, accepts, messages, checks notifications, pagination, filters,
ownership rules and the `$facet` aggregation, and asserts 401 on a protected
route with no cookie. It prints PASS/FAIL per step and exits non-zero on any
failure.

**Current status: 73 passed, 0 failed, exit 0** — against both the dev server
and a `NODE_ENV=production` server.

---

## 7. Environment variables

| Variable | Required | What it does |
|---|---|---|
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string, including the database name. |
| `JWT_SECRET` | **Yes** | Signs the 7-day auth JWT. Any long random string. Changing it logs everyone out. |
| `NODE_ENV` | No | `production` makes Express serve `client/dist` and marks the cookie `secure`. |
| `PORT` | No | Defaults to 5000. Render injects its own — do not hardcode it. |
| `SMOKE_URL` | No | Where `npm run smoke` sends its requests. Defaults to `http://localhost:5000`. |
| `CLOUDINARY_CLOUD_NAME` | No | Enables image uploads. Absent → the UI offers an image-URL field instead. |
| `CLOUDINARY_API_KEY` | No | With the above. |
| `CLOUDINARY_API_SECRET` | No | With the above. |
| `GEMINI_API_KEY` | No | Enables "Draft with AI". Absent → `/api/ai/describe` returns 503 and the client hides the button. |

---

## 8. Architecture

**One service.** Express serves the built React app and the API on a single
port. No split deploy, no CORS configuration, no `SameSite=None` cookie
problems, one thing to deploy.

```
                    BROWSER
                       |
       same origin (one port, one cookie)
                       |
          +------------+------------+
          |                         |
      HTTP /api/*              WS /socket.io
          |                         |
   +------v-------------------------v------+
   |          Node + Express (app.js)      |
   |                                       |
   |  express.json -> cookieParser ->      |
   |  routes -> controllers -> models      |
   |                                       |
   |  app.js holds ZERO business logic     |
   |  routes are thin, controllers hold    |
   |  the logic, every async controller    |
   |  wrapped in asyncHandler (no          |
   |  try/catch in any controller)         |
   |                                       |
   |  NODE_ENV=production ->               |
   |    express.static(client/dist)        |
   |    app.get('*') -> index.html         |
   +-------------------+-------------------+
                       |
                  Mongoose ODM
                       |
              +--------v--------+
              | MongoDB Atlas   |
              |  users          |
              |  projects       |
              |  comments       |
              |  applications   |
              |  messages       |
              |  notifications  |
              +-----------------+

   Optional, both degrade gracefully if unset:
     Cloudinary (multer memoryStorage -> upload_stream, never touches disk)
     Gemini     (raw fetch, 20s AbortController timeout)
```

### Request lifecycle

```
Request
  -> express.json / urlencoded (10kb cap)
  -> cookieParser
  -> route (thin)
  -> protect / optionalAuth   (verify JWT from httpOnly cookie)
  -> multer singleImage       (only on upload routes, memory only)
  -> controller               (wrapped in asyncHandler, throws ApiError)
  -> model / Mongoose
  -> response  { success, data }   or  next(err)
                                        -> errorHandler  { success:false, message }
```

### Project layout

```
devcollab/
├── package.json          root: dev/build/start/seed/smoke scripts
├── render.yaml           single web service blueprint
├── .env.example
├── server/
│   ├── server.js         http.createServer + socket.io + db connect
│   ├── app.js            middleware + routes + static serve (no logic)
│   ├── config/           db.js  cloudinary.js  gemini.js
│   ├── models/           User Project Comment Application Message Notification
│   ├── controllers/      auth user project comment application message notification ai
│   ├── routes/           thin routers, one per resource
│   ├── middleware/       auth.js  error.js  upload.js
│   ├── sockets/index.js  io.use() JWT auth + Map<userId, Set<socketId>>
│   └── utils/            asyncHandler ApiError pagination seed smoke
└── client/               Vite + React 18
    └── src/{api,store,components,pages}
```

### Design decisions worth defending in a viva

- **One JWT in an httpOnly cookie, 7 days.** Not localStorage: anything
  JavaScript can read, an XSS payload can read. Same-origin means
  `sameSite:'lax'` is enough, and `secure` only in production (localhost has no
  TLS, so a secure cookie would never be stored).
- **bcrypt in a `pre('save')` hook, 12 rounds**, never in a controller — every
  write path goes through `save()`, so hashing cannot be forgotten at a call
  site. `password` is `select:false`.
- **Login returns one identical message** for wrong-email and wrong-password,
  so the form is not an account-enumeration oracle.
- **Duplicate applications are prevented by a compound unique index**
  `{project, applicant}`, not a controller check. A findOne-then-create check is
  racy: two fast clicks interleave as find/find/create/create and both pass.
  The index fails the second write atomically with E11000, which the error
  handler turns into a 409. `smoke.js` asserts this.
- **Atomic update operators** (`$inc`, `$addToSet`, `$pull`) for likes, follows
  and `commentCount` — a read-modify-write would lose one of two concurrent
  updates.
- **Socket.io authenticates in `io.use()`** by verifying the same cookie the
  REST API uses, so an unauthenticated socket can never emit anything. A
  `Map<userId, Set<socketId>>` means several tabs all receive messages, and a
  user only goes offline when the last socket closes.
- **Messages are persisted before they are emitted.** If we emitted first and
  the write failed, the recipient would see a message that vanishes on refresh.
- **Controllers never touch a global `io`** — they call
  `emitToUser(userId, event, payload)`, which is a no-op when sockets are not
  running (seed script, smoke test).
- **Every list endpoint is paginated** and the `?limit` is capped server-side,
  so `?limit=100000` is not a free denial-of-service. No unbounded `find()`.
- **Uploads never touch the disk** — multer `memoryStorage` streams the buffer
  to Cloudinary's `upload_stream`, because Render's filesystem is ephemeral.

### Indexes, and why each exists

| Index | Why |
|---|---|
| `Project {status:1, createdAt:-1}` | The feed matches on status then sorts newest-first. One compound index in that order serves both the filter and the sort — no in-memory sort, no collection scan. |
| `Project {title:'text', summary:'text'}` | `?q=` search. Mongo allows one text index per collection, so both fields share it; weights make a title hit outrank a summary hit. |
| `Project {techStack:1}` | Multikey index over the array, which makes `?tech=react` a lookup rather than a scan. |
| `Application {project:1, applicant:1}` unique | Prevents duplicate applications atomically. The whole point — see above. |
| `Message {conversation:1, createdAt:-1}` | Chat history is always "this thread, newest page first". Matters most here because this collection grows fastest. |
| `Notification {recipient:1, read:1}` | The unread-badge query is literally this shape, so it is answered from the index alone. |
| `User {name:'text', username:'text'}` | User search in one pass instead of two regex scans. |

Thread and conversation queries sort by `{createdAt:-1, _id:-1}` — ObjectIds
increase monotonically, so `_id` is a stable tiebreaker when two messages land
in the same millisecond.

---

## 9. API

Every list endpoint returns
`{ success, page, total, totalPages, hasMore, data }`.
Errors return `{ success:false, message }`.

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account, set cookie. 409 on duplicate email/username. |
| POST | `/api/auth/login` | — | Set cookie. Rate limited, 20 per 15 min. |
| POST | `/api/auth/logout` | — | Clear cookie. |
| GET | `/api/auth/me` | ✅ | Rehydrate session on refresh. |
| GET | `/api/users/search?q=&page=&limit=` | — | Paginated user search. |
| GET | `/api/users/:username` | — | Profile + that user's projects. |
| PATCH | `/api/users/me` | ✅ | Update name, bio, skills, githubUrl, avatarUrl. |
| PATCH | `/api/users/me/avatar` | ✅ | multipart `image`. 503 if Cloudinary unset. |
| POST | `/api/users/:id/follow` | ✅ | Toggle follow. |
| GET | `/api/projects?page&limit&q&tech&status&sort&feed=following` | optional | Feed. `sort` = `new` \| `popular` \| `oldest`. `feed=following` requires auth. |
| GET | `/api/projects/stats` | — | `$facet` aggregation: totals, byStatus, topTech, mostActive — in one round trip. |
| POST | `/api/projects` | ✅ | Create. JSON or multipart (`coverImage`). |
| GET | `/api/projects/:id` | optional | Project + `viewer {hasLiked, isOwner, myApplication}`. Increments views. |
| PATCH | `/api/projects/:id` | ✅ owner | Update. 403 for anyone else. |
| DELETE | `/api/projects/:id` | ✅ owner | Deletes the project and cascades comments, applications, notifications. |
| POST | `/api/projects/:id/like` | ✅ | Toggle upvote. |
| GET | `/api/projects/:id/comments` | — | Paginated. |
| POST | `/api/projects/:id/comments` | ✅ | Add; `$inc` the denormalised counter. |
| DELETE | `/api/projects/:id/comments/:commentId` | ✅ author or project owner | Remove. |
| POST | `/api/applications` | ✅ | Apply. 409 if already applied, 400 on own project or filled role. |
| PATCH | `/api/applications/:id` | ✅ owner | `{status:'accepted'\|'rejected'}`. Accepting adds a collaborator, fills the role, and flips the project to `in-progress` when every role is filled. 409 if already decided. |
| GET | `/api/applications/received` | ✅ | Applications on projects I own. |
| GET | `/api/applications/sent` | ✅ | Applications I made. |
| GET | `/api/messages/conversations` | ✅ | Aggregation: one row per thread with its last message and unread count. |
| GET | `/api/messages/:userId` | ✅ | Paginated thread; marks it read. |
| POST | `/api/messages/:userId` | ✅ | REST fallback for sending (sockets are the normal path). |
| GET | `/api/notifications` | ✅ | Paginated + `unread` count. |
| PATCH | `/api/notifications/read` | ✅ | Mark all mine read. |
| GET | `/api/ai/status` | — | `{enabled}` so the client can hide the AI button. |
| POST | `/api/ai/describe` | ✅ | `{title, techStack, notes}` → description. 503 with no key. Rate limited, 10 per 10 min. |
| GET | `/api/health` | — | Liveness probe for Render. |

### Socket events

| Event | Direction | Notes |
|---|---|---|
| `message:send` | client → server | Persisted to Mongo, then emitted. Acknowledgement callback confirms durability. |
| `message:new` | server → client | Sent to every tab of both participants; deduped by `_id` on the client. |
| `typing` | both | Deliberately not persisted — worthless a second later. |
| `notification:new` | server → client | Pushed on like, comment, application, decision, follow. |

Unauthenticated handshakes are rejected in `io.use()`.

---

## 10. Demo logins

Seeded by `npm run seed`. **Password for every account: `password123`**

| Email | Username | Who |
|---|---|---|
| `aarav@devcollab.dev` | @aarav | Backend engineer — owns projects, has applications to decide |
| `isha@devcollab.dev` | @isha | Frontend developer — has an active chat thread with @aarav |
| `rohan@devcollab.dev` | @rohan | ML student — has pending applications out |
| `meera@devcollab.dev` | @meera | Full-stack |
| `kabir@devcollab.dev` | @kabir | Mobile developer |
| `ananya@devcollab.dev` | @ananya | Backend / DevOps |
| `vikram@devcollab.dev` | @vikram | Game + web developer |
| `zoya@devcollab.dev` | @zoya | Data engineer |

Log in as **@aarav** to see the Applications dashboard with pending applications
to accept, an unread notification, and a live chat thread with @isha.

---

## 11. Engineering breakdown, by area

A map of every significant technical area in the project to the file that
implements it, so a reviewer can jump straight to the code behind a claim.

| # | Area | Where it is in this project |
|---|---|---|
| 1 | Web architecture, client–server | Single-service design: Express serves API + SPA on one port (`server/app.js`). Request lifecycle diagrammed above. |
| 2 | HTML / semantic markup | `client/index.html`, semantic `article` / `aside` / `nav` / `fieldset` throughout the components. |
| 3 | CSS, responsive design | Tailwind v4 with a `@theme` token block (`client/src/index.css`); every grid is mobile-first (`sm:` / `lg:` breakpoints), navbar collapses to a hamburger. |
| 4 | JavaScript ES6+ | Modules everywhere, destructuring, spread, optional chaining, template literals, arrow functions. Plain JS, no TypeScript. |
| 5 | Async JS: promises, async/await | Every controller is `async`; `Promise.all` for independent queries (count + find run concurrently, not in sequence). |
| 6 | Node.js runtime | `server/server.js` — `http.createServer`, `process.env`, `process.on('SIGTERM')` for graceful shutdown. |
| 7 | npm, modules, scripts | Root `package.json` scripts: `dev`, `build`, `start`, `seed`, `smoke`. ES modules (`"type":"module"`). |
| 8 | Express routing | 8 thin routers in `server/routes/`, literal paths declared before `:param` wildcards. |
| 9 | Express middleware | `express.json`, `cookieParser`, `morgan`, custom `protect` / `optionalAuth`, `singleImage`, `notFound`, 4-arg `errorHandler`. |
| 10 | MongoDB, CRUD | All six collections, full CRUD on projects and comments. |
| 11 | Mongoose: schemas, validation, hooks | 6 schemas with validators, enums, `maxlength`, `match`; `pre('save')` bcrypt hook; instance method `comparePassword`; `select:false`. |
| 12 | Relationships, population, indexes | `ref` + `.populate()` (including nested populate in `/applications/sent`); 11 indexes, each justified in the table above; cascade delete done explicitly because Mongo has no foreign keys. |
| 13 | Aggregation pipeline | `$facet` in `/api/projects/stats` (four analyses in one pass); `$group` + `$first` + `$cond` in the conversations aggregation; `$unwind` for top tech tags. |
| 14 | Authentication & authorisation | JWT in an httpOnly cookie, bcrypt 12 rounds, `protect` vs `optionalAuth`, ownership checks (403 not 404), rate limiting on auth and AI routes. |
| 15 | React: components, props, state, hooks | 8 components, 10 pages; `useState`, `useEffect`, `useCallback`, `useRef`; custom guard component `ProtectedRoute`. |
| 16 | React Router + state management | `BrowserRouter`, nested and dynamic routes, `useParams`, `useNavigate`, `useSearchParams` (feed filters live in the URL, so views are shareable); Zustand stores for auth and sockets; `React.lazy` + `Suspense` code-splitting (one chunk per page). |
| 17 | Real-time, file upload, third-party APIs, deployment | Socket.io with cookie-based handshake auth and a multi-tab presence map; multer `memoryStorage` → Cloudinary `upload_stream`; Gemini via raw `fetch` with a 20s `AbortController` timeout; `render.yaml` single-service blueprint. |

---

## 12. Deployment

| | |
|---|---|
| **Live app** | **https://devcollab-zaxt.onrender.com** |
| **Source** | https://github.com/naman2627/devcollab |
| **Health check** | `/api/health` — returns `{"success":true,"status":"ok"}` |

The repository is on GitHub and the `render.yaml` blueprint is committed, so
the build and start commands do not need to be typed in by hand. Remaining
steps, in order:

1. **Create a free MongoDB Atlas cluster** and copy its connection string.
   Add `/devcollab` as the database name before the `?`, so the string ends
   `...mongodb.net/devcollab?retryWrites=true&w=majority`.

2. **Open Atlas → Network Access and allow Render's outbound ranges.**
   Render routes all outbound traffic for a region through a fixed set of
   ranges, shown under the service's **Connect → Outbound** tab. For
   Singapore they are:

   ```
   74.220.52.0/24
   74.220.60.0/24
   ```

   Without these the deployed app cannot reach the database and every request
   hangs, then fails — the single most common reason a working MERN app dies
   on deploy. Allowlisting the two ranges is preferable to `0.0.0.0/0`, which
   opens the cluster to the whole internet and leaves the password as the only
   thing standing between it and the world.

   Add your own public IP too if you want to run `npm run seed` or Compass
   locally. On a mobile connection that address rotates, so expect to re-add
   it.

3. **Render → New → Web Service → connect the repository.** It reads
   `render.yaml`, so the build and start commands are filled in already:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`

4. **Paste the environment variables** in Render → Environment. Required:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas string, e.g. `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/devcollab?retryWrites=true&w=majority` |
   | `JWT_SECRET` | any long random string |
   | `NODE_ENV` | `production` |

   Optional — leave blank and those features degrade gracefully:

   | Key | Effect if set |
   |---|---|
   | `CLOUDINARY_CLOUD_NAME` | enables image uploads |
   | `CLOUDINARY_API_KEY` | " |
   | `CLOUDINARY_API_SECRET` | " |
   | `GEMINI_API_KEY` | shows the "Draft with AI" button |

   Do **not** set `PORT` — Render injects it.

5. **Deploy**, then seed the production database once. Either run
   `npm run seed` locally with `MONGO_URI` pointing at the same Atlas cluster,
   or use Render's Shell tab and run `npm run seed` there.

6. **Check it.** Visit `https://<your-service>.onrender.com/api/health`, then
   the site itself, then log in as `aarav@devcollab.dev` / `password123`.
   The free plan sleeps after inactivity, so the first request after a pause
   takes ~30 seconds.

---

## 13. Future scope (what was cut, and why)

Cut deliberately to fit the time budget. Each is a genuine next step, not a
hidden bug:

- **Comment likes** — the `likes[]` array exists on the `Comment` schema but has
  no endpoint or UI behind it.
- **Infinite scroll** — the feed uses numbered pagination. The API already
  returns `hasMore`, so switching is a client-only change.
- **Notification pagination in the UI** — the endpoint is paginated, but the
  bell only ever renders the newest 20.
- **Read receipts in chat** — `Message.read` is set when a thread is opened,
  but the sender is not shown a tick.
- **Editing and deleting messages** — not implemented.
- **Refresh tokens** — a single 7-day JWT. A refresh/rotation pair would be the
  production answer.
- **Email verification and password reset** — would need an email provider.
- **Automated unit tests** — `smoke.js` is an end-to-end black-box test with 73
  assertions; there is no Jest/Vitest unit layer underneath it.
- **Search relevance tuning** — `?q=` uses Mongo's text index with simple
  weights. Typo tolerance would need Atlas Search.
- **Image optimisation beyond a 1200px cap** — no responsive `srcset`.
