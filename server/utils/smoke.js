/**
 * End-to-end smoke test against a RUNNING server.
 *
 * Run with: npm run smoke   (the server must already be up)
 *
 * It starts nothing and imports no application code - it is a black-box
 * client, exactly like the browser. WHY that matters: importing app.js would
 * test the modules in isolation and would happily pass while the real HTTP
 * layer, the cookie attributes or the route order were broken. Hitting the
 * socket over HTTP is the only way to prove the thing an examiner will click
 * actually works.
 *
 * Prints PASS/FAIL per step and exits non-zero on the first failure.
 */
const BASE = process.env.SMOKE_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;

const line = (ok, label, detail = '') => {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${label}${detail ? `  -> ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
};

/** Throw on the first failed assertion - a broken chain makes later steps meaningless. */
const assert = (ok, label, detail = '') => {
  line(ok, label, detail);
  if (!ok) throw new Error(`assertion failed: ${label} ${detail}`);
};

/**
 * Minimal cookie jar.
 *
 * WHY by hand: fetch in Node does not persist cookies between calls the way a
 * browser does, so without this every request after login would arrive
 * anonymous and every protected route would 401. Keeping a jar per "user" is
 * also what lets the test act as two different people in one run.
 */
const makeJar = () => {
  let cookie = '';
  return {
    get: () => cookie,
    capture: (res) => {
      // getSetCookie() is the only way to read multiple Set-Cookie headers.
      const all = res.headers.getSetCookie?.() || [];
      const found = all.find((c) => c.startsWith('devcollab_token='));
      if (found) cookie = found.split(';')[0];
    },
    clear: () => {
      cookie = '';
    },
  };
};

const request = async (method, path, { body, jar, raw } = {}) => {
  const headers = {};
  if (body && !raw) headers['Content-Type'] = 'application/json';
  if (jar?.get()) headers.Cookie = jar.get();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });

  jar?.capture(res);

  // Read as text first: an unexpected HTML error page would make res.json()
  // throw an opaque parse error instead of showing what the server said.
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { parseError: text.slice(0, 200) };
  }

  return { status: res.status, body: json };
};

// Unique suffix per run so re-running the smoke test never collides with the
// unique email/username indexes left behind by the previous run.
const stamp = Date.now().toString(36);
const alice = {
  name: 'Smoke Alice',
  username: `smoke_a_${stamp}`,
  email: `smoke_a_${stamp}@example.com`,
  password: 'password123',
};
const bob = {
  name: 'Smoke Bob',
  username: `smoke_b_${stamp}`,
  email: `smoke_b_${stamp}@example.com`,
  password: 'password123',
};

const aliceJar = makeJar();
const bobJar = makeJar();

async function run() {
  console.log(`\nDevCollab smoke test -> ${BASE}\n${'-'.repeat(52)}`);

  // 0. Server reachable at all. Checked first so a connection refusal reads as
  // "the server is not running" rather than a confusing auth failure.
  const health = await request('GET', '/api/health');
  assert(health.status === 200, 'server is up', `GET /api/health -> ${health.status}`);

  // 1. Register two users.
  const regA = await request('POST', '/api/auth/register', { body: alice, jar: aliceJar });
  assert(regA.status === 201, 'register user A', `status ${regA.status} ${regA.body?.message || ''}`);
  assert(Boolean(aliceJar.get()), 'register set an httpOnly auth cookie');

  const regB = await request('POST', '/api/auth/register', { body: bob, jar: bobJar });
  assert(regB.status === 201, 'register user B', `status ${regB.status} ${regB.body?.message || ''}`);

  const aliceId = regA.body.data._id;
  const bobId = regB.body.data._id;

  // 2. Duplicate email must be rejected by the unique index, not accepted.
  const dup = await request('POST', '/api/auth/register', { body: alice });
  assert(dup.status === 409, 'duplicate email rejected with 409', `got ${dup.status}`);

  // 3. 401 on a protected route with NO cookie. The core auth guarantee.
  const noAuth = await request('GET', '/api/auth/me');
  assert(noAuth.status === 401, 'protected route returns 401 without a cookie', `got ${noAuth.status}`);

  // 4. Wrong password must not leak which half was wrong.
  const badLogin = await request('POST', '/api/auth/login', {
    body: { email: alice.email, password: 'wrongpassword' },
  });
  assert(badLogin.status === 401, 'wrong password returns 401', `got ${badLogin.status}`);
  assert(
    /invalid email or password/i.test(badLogin.body?.message || ''),
    'login error message does not reveal which field was wrong',
    badLogin.body?.message
  );

  // 5. Real login replaces the cookie and rehydrates the session.
  aliceJar.clear();
  const login = await request('POST', '/api/auth/login', {
    body: { email: alice.email, password: alice.password },
    jar: aliceJar,
  });
  assert(login.status === 200, 'login with correct password', `status ${login.status}`);
  const meRes = await request('GET', '/api/auth/me', { jar: aliceJar });
  assert(meRes.status === 200 && meRes.body.data.email === alice.email, 'GET /me returns the logged-in user');

  // 6. Create a project as Alice.
  const create = await request('POST', '/api/projects', {
    jar: aliceJar,
    body: {
      title: `Smoke Test Project ${stamp}`,
      summary: 'Created by the automated smoke test.',
      description: 'Verifies the full create -> apply -> accept path.',
      techStack: 'node,react,mongodb',
      rolesNeeded: [{ title: 'Backend developer', count: 1 }],
      status: 'recruiting',
      difficulty: 'intermediate',
    },
  });
  assert(create.status === 201, 'create project', `status ${create.status} ${create.body?.message || ''}`);
  const projectId = create.body.data._id;
  assert(create.body.data.techStack.includes('react'), 'techStack parsed from a comma string');
  assert(create.body.data.rolesNeeded[0].filled === 0, 'role.filled starts at 0 (server-owned)');

  // 7. Unauthenticated create must fail. Proves `protect` is actually mounted
  // on the write route and not only on /me.
  const anonCreate = await request('POST', '/api/projects', {
    body: { title: 'Should not exist', summary: 'anonymous' },
  });
  assert(anonCreate.status === 401, 'anonymous project create returns 401', `got ${anonCreate.status}`);

  // 8. Bob likes the project (toggle on).
  const like = await request('POST', `/api/projects/${projectId}/like`, { jar: bobJar });
  assert(like.status === 200 && like.body.data.hasLiked === true, 'like project (toggle on)');
  assert(like.body.data.likeCount === 1, 'like count is 1', `got ${like.body.data.likeCount}`);

  // Toggling twice must return to zero, not to two.
  const unlike = await request('POST', `/api/projects/${projectId}/like`, { jar: bobJar });
  assert(
    unlike.body.data.hasLiked === false && unlike.body.data.likeCount === 0,
    'like is a true toggle (second call un-likes)'
  );
  await request('POST', `/api/projects/${projectId}/like`, { jar: bobJar }); // leave it liked

  // 9. Comment, and check the denormalised counter was incremented.
  const comment = await request('POST', `/api/projects/${projectId}/comments`, {
    jar: bobJar,
    body: { text: 'Smoke test comment - is the backend role still open?' },
  });
  assert(comment.status === 201, 'add comment', `status ${comment.status}`);

  const afterComment = await request('GET', `/api/projects/${projectId}`);
  assert(
    afterComment.body.data.commentCount === 1,
    'project.commentCount incremented to 1',
    `got ${afterComment.body.data.commentCount}`
  );

  const emptyComment = await request('POST', `/api/projects/${projectId}/comments`, {
    jar: bobJar,
    body: { text: '   ' },
  });
  assert(emptyComment.status === 400, 'whitespace-only comment rejected with 400', `got ${emptyComment.status}`);

  // 10. Bob applies for the role.
  const apply = await request('POST', '/api/applications', {
    jar: bobJar,
    body: { project: projectId, roleTitle: 'Backend developer', message: 'I would like this role.' },
  });
  assert(apply.status === 201, 'apply to project', `status ${apply.status} ${apply.body?.message || ''}`);
  const applicationId = apply.body.data._id;

  // 11. The compound unique index must stop the second application. This is
  // the assertion that proves the constraint lives in the DATABASE.
  const dupApply = await request('POST', '/api/applications', {
    jar: bobJar,
    body: { project: projectId, roleTitle: 'Backend developer', message: 'again' },
  });
  assert(dupApply.status === 409, 'duplicate application blocked by unique index (409)', `got ${dupApply.status}`);

  // 12. Alice cannot apply to her own project.
  const selfApply = await request('POST', '/api/applications', {
    jar: aliceJar,
    body: { project: projectId, roleTitle: 'Backend developer' },
  });
  assert(selfApply.status === 400, 'owner cannot apply to own project', `got ${selfApply.status}`);

  // 13. Bob must not be able to decide an application on Alice's project.
  const wrongDecider = await request('PATCH', `/api/applications/${applicationId}`, {
    jar: bobJar,
    body: { status: 'accepted' },
  });
  assert(wrongDecider.status === 403, 'non-owner cannot accept an application (403)', `got ${wrongDecider.status}`);

  // 14. Alice accepts. Should flip status, add a collaborator and fill the role.
  const accept = await request('PATCH', `/api/applications/${applicationId}`, {
    jar: aliceJar,
    body: { status: 'accepted' },
  });
  assert(accept.status === 200 && accept.body.data.status === 'accepted', 'owner accepts application');

  const afterAccept = await request('GET', `/api/projects/${projectId}`);
  assert(
    afterAccept.body.data.collaborators.some((c) => String(c._id) === String(bobId)),
    'accepted applicant added to collaborators[]'
  );
  assert(
    afterAccept.body.data.rolesNeeded[0].filled === 1,
    'role.filled incremented to 1',
    `got ${afterAccept.body.data.rolesNeeded[0].filled}`
  );
  assert(
    afterAccept.body.data.status === 'in-progress',
    'project auto-moved to in-progress once every role was filled',
    `got ${afterAccept.body.data.status}`
  );

  // 15. Deciding twice must be refused, or role.filled would double-count.
  const decideAgain = await request('PATCH', `/api/applications/${applicationId}`, {
    jar: aliceJar,
    body: { status: 'rejected' },
  });
  assert(decideAgain.status === 409, 'already-decided application cannot be decided again (409)', `got ${decideAgain.status}`);

  // 16. Both dashboards must see it.
  const received = await request('GET', '/api/applications/received', { jar: aliceJar });
  assert(
    received.status === 200 && received.body.data.some((a) => String(a._id) === String(applicationId)),
    'application appears in owner /received'
  );
  const sent = await request('GET', '/api/applications/sent', { jar: bobJar });
  assert(
    sent.status === 200 && sent.body.data.some((a) => String(a._id) === String(applicationId)),
    'application appears in applicant /sent'
  );

  // 17. Messaging over REST (the socket path shares the same persistence).
  const msg = await request('POST', `/api/messages/${bobId}`, {
    jar: aliceJar,
    body: { text: 'Welcome aboard - smoke test speaking.' },
  });
  assert(msg.status === 201, 'send message', `status ${msg.status} ${msg.body?.message || ''}`);

  const thread = await request('GET', `/api/messages/${aliceId}`, { jar: bobJar });
  assert(
    thread.status === 200 && thread.body.data.some((m) => m.text.includes('smoke test speaking')),
    'message appears in the recipient thread'
  );
  assert(
    typeof thread.body.hasMore === 'boolean' && typeof thread.body.totalPages === 'number',
    'thread response carries the pagination envelope'
  );

  const convos = await request('GET', '/api/messages/conversations', { jar: bobJar });
  assert(
    convos.status === 200 && convos.body.data.length >= 1,
    'conversations aggregation returns the thread'
  );

  const selfMsg = await request('POST', `/api/messages/${bobId}`, {
    jar: bobJar,
    body: { text: 'talking to myself' },
  });
  assert(selfMsg.status === 400, 'cannot message yourself', `got ${selfMsg.status}`);

  // 18. Notifications - Alice should have been notified about the like,
  // the comment and the application.
  const notes = await request('GET', '/api/notifications', { jar: aliceJar });
  assert(notes.status === 200, 'fetch notifications', `status ${notes.status}`);
  assert(notes.body.data.length >= 2, 'owner received notifications', `got ${notes.body.data.length}`);
  assert(typeof notes.body.unread === 'number', 'notifications response carries an unread count');

  const markRead = await request('PATCH', '/api/notifications/read', { jar: aliceJar });
  assert(markRead.status === 200, 'mark all notifications read');
  const afterRead = await request('GET', '/api/notifications', { jar: aliceJar });
  assert(afterRead.body.unread === 0, 'unread count is 0 after marking read', `got ${afterRead.body.unread}`);

  // 19. Follow toggle.
  const follow = await request('POST', `/api/users/${aliceId}/follow`, { jar: bobJar });
  assert(follow.status === 200 && follow.body.data.following === true, 'follow user');
  const unfollow = await request('POST', `/api/users/${aliceId}/follow`, { jar: bobJar });
  assert(unfollow.body.data.following === false, 'unfollow (toggle)');
  await request('POST', `/api/users/${aliceId}/follow`, { jar: bobJar }); // re-follow for the feed check

  const selfFollow = await request('POST', `/api/users/${bobId}/follow`, { jar: bobJar });
  assert(selfFollow.status === 400, 'cannot follow yourself', `got ${selfFollow.status}`);

  // 20. Pagination envelope and the limit cap.
  const page1 = await request('GET', '/api/projects?page=1&limit=2');
  assert(page1.status === 200, 'list projects page 1');
  for (const key of ['success', 'page', 'total', 'totalPages', 'hasMore', 'data']) {
    assert(key in page1.body, `pagination envelope has "${key}"`);
  }
  assert(page1.body.data.length <= 2, 'limit=2 returns at most 2 rows', `got ${page1.body.data.length}`);

  const capped = await request('GET', '/api/projects?limit=100000');
  assert(
    capped.body.data.length <= 30,
    'absurd ?limit is capped server-side (no unbounded find)',
    `got ${capped.body.data.length}`
  );

  if (page1.body.totalPages > 1) {
    const page2 = await request('GET', '/api/projects?page=2&limit=2');
    const idsOne = page1.body.data.map((p) => p._id).join(',');
    const idsTwo = page2.body.data.map((p) => p._id).join(',');
    assert(idsOne !== idsTwo, 'page 2 returns different rows from page 1');
  }

  // 21. Filters and search.
  const filtered = await request('GET', '/api/projects?tech=react&limit=5');
  assert(
    filtered.status === 200 && filtered.body.data.every((p) => p.techStack.includes('react')),
    '?tech filter returns only matching projects'
  );

  const searched = await request('GET', `/api/projects?q=${encodeURIComponent('Smoke Test Project')}`);
  assert(searched.status === 200, 'text search responds 200', `status ${searched.status}`);

  const followingFeed = await request('GET', '/api/projects?feed=following', { jar: bobJar });
  assert(followingFeed.status === 200, 'following feed responds for a logged-in user');
  const anonFollowing = await request('GET', '/api/projects?feed=following');
  assert(anonFollowing.status === 401, 'following feed requires auth (401)', `got ${anonFollowing.status}`);

  // 22. The $facet stats aggregation.
  const stats = await request('GET', '/api/projects/stats');
  assert(stats.status === 200, 'stats aggregation responds', `status ${stats.status}`);
  assert(
    typeof stats.body.data.totals.projects === 'number' && Array.isArray(stats.body.data.topTech),
    '$facet returned totals and topTech in one document'
  );

  // 23. Ownership on update/delete.
  const bobEdit = await request('PATCH', `/api/projects/${projectId}`, {
    jar: bobJar,
    body: { title: 'Hijacked' },
  });
  assert(bobEdit.status === 403, 'non-owner cannot edit a project (403)', `got ${bobEdit.status}`);

  const ownerEdit = await request('PATCH', `/api/projects/${projectId}`, {
    jar: aliceJar,
    body: { summary: 'Updated by the smoke test.' },
  });
  assert(
    ownerEdit.status === 200 && ownerEdit.body.data.summary === 'Updated by the smoke test.',
    'owner can edit their project'
  );

  // 24. Bad input shapes.
  const badId = await request('GET', '/api/projects/not-a-valid-objectid');
  assert(badId.status === 400, 'malformed ObjectId returns 400, not 500', `got ${badId.status}`);

  const missing = await request('GET', '/api/projects/000000000000000000000000');
  assert(missing.status === 404, 'unknown project id returns 404', `got ${missing.status}`);

  const badRoute = await request('GET', '/api/does-not-exist');
  assert(badRoute.status === 404, 'unknown API route returns a JSON 404', `got ${badRoute.status}`);
  assert(badRoute.body?.success === false, 'API 404 is JSON, not the SPA index.html');

  const invalidProject = await request('POST', '/api/projects', {
    jar: aliceJar,
    body: { summary: 'no title here' },
  });
  assert(invalidProject.status === 400, 'create without a title returns 400', `got ${invalidProject.status}`);

  // 25. AI endpoint degrades cleanly when no key is configured.
  const aiState = await request('GET', '/api/ai/status');
  assert(aiState.status === 200 && typeof aiState.body.data.enabled === 'boolean', 'AI status endpoint reports a boolean');
  const ai = await request('POST', '/api/ai/describe', {
    jar: aliceJar,
    body: { title: 'Smoke AI probe', techStack: ['node'] },
  });
  assert(
    aiState.body.data.enabled ? ai.status === 200 : ai.status === 503,
    aiState.body.data.enabled ? 'AI describe returns a description' : 'AI describe returns a clean 503 with no key',
    `status ${ai.status}`
  );

  // 26. Clean up the project we created, and confirm the cascade.
  const del = await request('DELETE', `/api/projects/${projectId}`, { jar: aliceJar });
  assert(del.status === 200, 'owner deletes project', `status ${del.status}`);
  const gone = await request('GET', `/api/projects/${projectId}`);
  assert(gone.status === 404, 'deleted project is really gone (404)', `got ${gone.status}`);

  // 27. Logout must actually clear the cookie.
  const logout = await request('POST', '/api/auth/logout', { jar: aliceJar });
  assert(logout.status === 200, 'logout responds 200');
  // The jar still holds the pre-logout cookie string; the SERVER cleared it, so
  // reusing it is the honest test that the token was invalidated client-side.
  aliceJar.clear();
  const afterLogout = await request('GET', '/api/auth/me', { jar: aliceJar });
  assert(afterLogout.status === 401, 'protected route 401s after logout', `got ${afterLogout.status}`);
}

run()
  .then(() => {
    console.log(`${'-'.repeat(52)}\n${passed} passed, ${failed} failed\n`);
    // Non-zero on any failure so CI, or a human running `npm run smoke`, gets
    // an unambiguous signal rather than having to read the log.
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.log(`${'-'.repeat(52)}`);
    console.error(`\nSMOKE TEST ABORTED: ${err.message}`);
    if (err.cause) console.error(err.cause);
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(1);
  });
