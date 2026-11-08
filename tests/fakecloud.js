// A stand-in for Firebase Authentication and Cloud Firestore, for tests and the browser check.
// It enforces the same rule as firestore.rules: a family can only read and write its own data.
export function fakeCloud() {
  const users = new Map(); // email → { uid, password }
  const tokens = new Map(); // token → uid
  const docs = new Map(); // path → { data, updateTime }
  let clock = 0;
  let n = 0;
  const server = { users, docs, offline: false, calls: 0 };
  const reply = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (status, message, extra = {}) => reply(status, { error: { message, ...extra } });
  const issue = (uid, email) => {
    const idToken = `id-${++n}`;
    tokens.set(idToken, uid);
    return { localId: uid, email, idToken, refreshToken: `rf-${uid}`, expiresIn: '3600' };
  };
  server.fetch = async (url, options = {}) => {
    server.calls++;
    if (server.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    const body = options.body && options.headers?.['Content-Type'] === 'application/json' ? JSON.parse(options.body) : null;
    if (u.hostname === 'identitytoolkit.googleapis.com') {
      const action = u.pathname.split(':').pop();
      if (action === 'signUp') {
        if (!/^\S+@\S+\.\S+$/.test(body.email)) return fail(400, 'INVALID_EMAIL');
        if (users.has(body.email)) return fail(400, 'EMAIL_EXISTS');
        if ((body.password ?? '').length < 6) return fail(400, 'WEAK_PASSWORD : Password should be at least 6 characters');
        const uid = `u${users.size + 1}x${Math.random().toString(36).slice(2, 8)}`;
        users.set(body.email, { uid, password: body.password });
        return reply(200, issue(uid, body.email));
      }
      if (action === 'signInWithPassword') {
        const user = users.get(body.email);
        if (!user || user.password !== body.password) return fail(400, 'INVALID_LOGIN_CREDENTIALS');
        return reply(200, issue(user.uid, body.email));
      }
      if (action === 'sendOobCode') return reply(200, { email: body.email });
      if (action === 'delete') {
        const uid = tokens.get(body.idToken);
        for (const [email, user] of users) if (user.uid === uid) users.delete(email);
        return reply(200, {});
      }
    }
    if (u.hostname === 'securetoken.googleapis.com') {
      const refresh = new URLSearchParams(options.body).get('refresh_token');
      const uid = refresh.slice(3);
      if (![...users.values()].some((x) => x.uid === uid)) return fail(400, 'TOKEN_EXPIRED');
      const t = issue(uid);
      return reply(200, { id_token: t.idToken, refresh_token: t.refreshToken, expires_in: '3600', user_id: uid });
    }
    if (u.hostname === 'firestore.googleapis.com') {
      const path = decodeURIComponent(u.pathname).split('/documents/')[1];
      const uid = tokens.get((options.headers?.Authorization ?? '').replace('Bearer ', ''));
      if (!uid) return fail(401, 'UNAUTHENTICATED');
      if (path.split('/')[1] !== uid) return fail(403, 'PERMISSION_DENIED', { status: 'PERMISSION_DENIED' });
      const method = options.method ?? 'GET';
      const name = (p) => `projects/x/databases/(default)/documents/${p}`;
      const isCollection = path.split('/').length % 2 === 1;
      if (method === 'GET' && isCollection) {
        const documents = [...docs].filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
          .map(([p, d]) => ({ name: name(p), fields: d.data, updateTime: d.updateTime }));
        return reply(200, documents.length ? { documents } : {});
      }
      const d = docs.get(path);
      if (method === 'GET') return d ? reply(200, { name: name(path), fields: d.data, updateTime: d.updateTime }) : fail(404, 'NOT_FOUND', { status: 'NOT_FOUND' });
      if (method === 'DELETE') {
        docs.delete(path);
        return reply(200, {});
      }
      if (method === 'PATCH') {
        const exists = u.searchParams.get('currentDocument.exists');
        const at = u.searchParams.get('currentDocument.updateTime');
        if (exists === 'false' && d) return fail(409, 'ALREADY_EXISTS', { status: 'ALREADY_EXISTS' });
        if (at && (!d || d.updateTime !== at)) return fail(400, 'FAILED_PRECONDITION', { status: 'FAILED_PRECONDITION' });
        if ((body.fields.data.stringValue ?? '').length > 900000) return fail(403, 'PERMISSION_DENIED', { status: 'PERMISSION_DENIED' });
        const updateTime = `2026-01-01T00:00:${String(++clock).padStart(6, '0')}Z`;
        docs.set(path, { data: body.fields, updateTime });
        return reply(200, { name: name(path), fields: body.fields, updateTime });
      }
    }
    return fail(404, 'NOT_FOUND');
  };
  return server;
}
