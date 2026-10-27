/* TeamTrain static demo: a tiny in-browser stand-in for the server.
 *
 * It intercepts the app's /api/... calls and answers them from sample data kept in the visitor's own
 * browser (localStorage). Nothing is sent anywhere, there is no server to put to sleep, and one
 * visitor's changes never affect another's. The logic mirrors server/index.js for the features the
 * public demo allows; things the server demo blocks (uploads, new accounts, live AI) are blocked here too.
 */
(function () {
  const C = window.TT_DEMO_CONTENT;
  const KEY = 'teamtrain-static-demo-v1';
  const SESSION = 'teamtrain-static-demo-session';
  const PASS_MARK = 0.8;
  const BLOCKED_MSG = 'That is turned off in the public demo. The sample modules show what it produces.';

  // ---------- storage ----------
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const stamp = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60000).toISOString().slice(0, 19).replace('T', ' ');

  function seed() {
    const s = { v: 1, seq: { user: 0, module: 0, lesson: 0, question: 0, ann: 0, version: 0 }, users: [], modules: [], progress: {}, attempts: [], announcements: [], versions: {} };
    const next = (k) => ++s.seq[k];
    const addUser = (name, email, role, password) => { const u = { id: next('user'), name, email, role, password, created_at: stamp(60 * 24 * 14) }; s.users.push(u); return u; };
    addUser(C.ownerName, C.logins.owner.email, 'owner', C.logins.owner.password);
    const alex = addUser(C.assistantName, C.logins.staff.email, 'staff', C.logins.staff.password);
    const filler = C.fillerStaff.map((n, i) => addUser(n, `demo-staff${i + 1}@example.com`, 'staff', 'not-used-' + i));

    for (const m of C.modules) {
      const mod = {
        id: next('module'), title: m.title, summary: m.summary, status: 'published', required: m.required ? 1 : 0,
        review_notes: 'Sample content for the demo.', created_at: stamp(60 * 24 * 10), lessons: [], questions: [],
      };
      m.lessons.forEach((l, i) => mod.lessons.push({
        id: next('lesson'), position: i + 1, title: l.title, body: l.body, key_points: [...l.key_points], steps: [...l.steps],
        scenario: l.scenario ? { ...l.scenario } : null, media: [], removed: [], source_id: null,
      }));
      m.questions.forEach((q, i) => mod.questions.push({
        id: next('question'), position: i + 1, prompt: q.prompt, options: [...q.options], answer_index: q.answer,
        explanation: q.explanation, lesson_position: q.lesson, kind: q.kind,
      }));
      s.modules.push(mod);
    }

    C.progress.forEach((p, n) => {
      const uid = p.who === 'assistant' ? alex.id : filler[p.who].id;
      s.progress[uid] = s.progress[uid] || [];
      for (const [mi, li] of p.lessons) s.progress[uid].push(s.modules[mi].lessons[li].id);
      for (const [mi, score, total] of p.attempts) {
        s.attempts.push({ user_id: uid, module_id: s.modules[mi].id, score, total, passed: score / total >= PASS_MARK ? 1 : 0, created_at: stamp(60 * (n + 2)) });
      }
    });
    const owner = s.users[0];
    C.announcements.forEach((a, i) => s.announcements.push({ id: next('ann'), title: a.title, body: a.body, pinned: a.pinned, author_id: owner.id, created_at: stamp(60 * 5 - i * 30) }));
    return s;
  }

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  if (!state || state.v !== 1) state = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: the demo still works until reload */ } };
  const getSession = () => { try { return Number(sessionStorage.getItem(SESSION)) || null; } catch { return null; } };
  const setSession = (id) => { try { if (id) sessionStorage.setItem(SESSION, String(id)); else sessionStorage.removeItem(SESSION); } catch { /* ignore */ } };

  window.TT_RESET_DEMO = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); } catch { /* ignore */ } location.hash = '#/'; location.reload(); };

  // ---------- helpers ported from the server ----------
  const wordCount = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
  const lessonWords = (l) => wordCount(l.title) + wordCount(l.body)
    + (l.steps || []).reduce((n, s) => n + wordCount(s), 0) + (l.key_points || []).reduce((n, s) => n + wordCount(s), 0)
    + (l.scenario ? wordCount(l.scenario.situation) + wordCount(l.scenario.response) + wordCount(l.scenario.why) : 0);
  const minutesFor = (words, checks = 0, finals = 0) => Math.max(1, Math.round(words / 180 + checks * 0.25 + finals * 0.35));
  const kinds = (m, kind) => m.questions.filter((q) => q.kind === kind);
  const moduleMinutes = (m) => minutesFor(m.lessons.reduce((n, l) => n + lessonWords(l), 0), kinds(m, 'check').length, kinds(m, 'final').length);

  function progressFor(userId, m) {
    const done = (state.progress[userId] || []).filter((id) => m.lessons.some((l) => l.id === id)).length;
    const mine = state.attempts.filter((a) => a.user_id === userId && a.module_id === m.id);
    const best = mine.length ? Math.max(...mine.map((a) => a.score / a.total)) : null;
    const passed = mine.some((a) => a.passed);
    return { lessons_done: done, lessons_total: m.lessons.length, best_score: best, passed, complete: passed };
  }

  const strs = (a) => (Array.isArray(a) ? a : []).map((s) => String(s).trim()).filter(Boolean);
  const SECTIONS = ['key_points', 'steps', 'scenario', 'media', 'checks'];

  function snapshot(m) {
    return clone({ title: m.title, summary: m.summary, required: !!m.required, lessons: m.lessons, questions: m.questions });
  }
  function describeChange(prev, cur) {
    if (!prev) return 'First version';
    const parts = [];
    if (prev.title !== cur.title) parts.push('title');
    if (prev.summary !== cur.summary) parts.push('summary');
    if (prev.required !== cur.required) parts.push(cur.required ? 'marked required' : 'no longer required');
    const prevIds = new Set(prev.lessons.map((l) => l.id)); const curIds = new Set(cur.lessons.map((l) => l.id));
    const added = cur.lessons.filter((l) => !prevIds.has(l.id)).length; const removed = prev.lessons.filter((l) => !curIds.has(l.id)).length;
    const old = new Map(prev.lessons.map((l) => [l.id, l]));
    const pick = (x) => JSON.stringify([x.title, x.body, x.key_points, x.steps || [], x.scenario || null, x.media || []]);
    const edited = cur.lessons.filter((l) => old.has(l.id) && pick(old.get(l.id)) !== pick(l)).length;
    if (added) parts.push(`${added} lesson(s) added`);
    if (removed) parts.push(`${removed} lesson(s) removed`);
    if (edited) parts.push(`${edited} lesson(s) edited`);
    if (JSON.stringify(prev.questions) !== JSON.stringify(cur.questions)) parts.push(`quiz (${prev.questions.length} → ${cur.questions.length} questions)`);
    return parts.length ? `Changed: ${parts.join(', ')}` : 'No content changes';
  }
  const versionsOf = (m) => (state.versions[m.id] = state.versions[m.id] || []);
  function addVersion(m, userId, action, label) {
    const list = versionsOf(m);
    const cur = snapshot(m);
    const summary = label || describeChange(list.length ? list[list.length - 1].snapshot : null, cur);
    if (action === 'edited' && summary === 'No content changes') return;
    list.push({ id: ++state.seq.version, action, summary, user_id: userId, created_at: stamp(), snapshot: cur });
  }
  function ensureBaseline(m) {
    const list = versionsOf(m);
    if (!list.length) list.push({ id: ++state.seq.version, action: 'baseline', summary: 'Version before history tracking began', user_id: null, created_at: stamp(), snapshot: snapshot(m) });
  }

  // ---------- "Ask": the same search and quoting logic the demo server uses ----------
  const STOP = new Set('a an and are as at be by do does for from how i if in is it its of on or our should so that the their there this to was we what when where which who why will with you your can my me not'.split(' '));
  const stem = (w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w);
  const tokens = (t) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

  function buildChunks() {
    const out = [];
    for (const m of state.modules.filter((x) => x.status === 'published')) {
      for (const l of m.lessons) {
        const sc = l.scenario;
        out.push({
          label: `Lesson ${l.position} – ${l.title}`, sub: m.title, link: `#/module/${m.id}?lesson=${l.position}`,
          text: [l.title, l.body,
            l.steps.length ? `Steps:\n${l.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
            sc ? `Scenario: ${sc.situation}\nWhat to do: ${sc.response}\nWhy: ${sc.why}` : '',
            l.key_points.map((p) => `- ${p}`).join('\n')].filter(Boolean).join('\n'),
        });
      }
    }
    return out;
  }
  function retrieve(chunks, question, k = 6) {
    const q = tokens(question);
    if (!q.length) return [];
    const docs = chunks.map((c) => tokens(`${c.label} ${c.label} ${c.text}`));
    const df = new Map();
    for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
    const N = docs.length;
    return docs.map((d, i) => {
      const tf = new Map();
      for (const w of d) tf.set(w, (tf.get(w) || 0) + 1);
      let score = 0;
      for (const w of new Set(q)) { if (tf.has(w)) score += (1 + Math.log(tf.get(w))) * Math.log(1 + N / df.get(w)); }
      return { i, score: (score * 1.25) / Math.sqrt(d.length + 20) };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map((s) => chunks[s.i]);
  }
  function quote(question, chunks) {
    if (!chunks.length) return { answer: "I couldn't find anything about that in your training material. Try different words, or ask your manager.", cited: [] };
    const words = (t) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 3);
    const qWords = [...new Set(words(question))];
    const lines = chunks.slice(0, 3).flatMap((c, ci) => c.text.split('\n')
      .flatMap((ln) => ln.split(/(?<=[.!?])\s+/))
      .map((ln) => ln.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim())
      .filter((ln) => ln.length > 30 && ln !== c.text.split('\n')[0].trim() && !/^(why|what to do|scenario|steps)\b/i.test(ln))
      .map((text) => ({ text, ci })));
    const df = (w) => lines.filter((l) => l.text.toLowerCase().includes(w)).length || 1;
    const scored = lines.map((l) => {
      const lw = new Set(words(l.text));
      const n = qWords.filter((w) => lw.has(w)).reduce((sum, w) => sum + Math.log(1 + lines.length / df(w)), 0);
      return { ...l, n: n / (1 + l.text.length / 220) };
    }).filter((l) => l.n > 0).sort((a, b) => b.n - a.n);
    const top = scored.slice(0, 3);
    if (!top.length) return { answer: `Closest lesson: ${chunks[0].text.slice(0, 400)} [1]`, cited: [0] };
    return {
      answer: `Here is what your training material says:\n\n${top.map((p) => `- ${p.text} [${p.ci + 1}]`).join('\n')}\n\n*(Demo: these are quoted straight from the lessons. With the AI switched on, they're written up as a direct answer.)*`,
      cited: [...new Set(top.map((p) => p.ci))],
    };
  }

  // ---------- the routes ----------
  const meOf = () => state.users.find((u) => u.id === getSession()) || null;
  const publicUser = (u) => (u ? { id: u.id, org_id: 1, name: u.name, email: u.email, role: u.role } : null);
  const ok = (data) => [200, data];
  const fail = (code, error) => [code, { error }];
  const userName = (id) => state.users.find((u) => u.id === id)?.name || null;

  function moduleDetail(m, me) {
    const leader = me.role !== 'staff';
    return {
      id: m.id, title: m.title, summary: m.summary, status: m.status, required: m.required, created_at: m.created_at,
      review_notes: leader ? m.review_notes : undefined,
      lessons: m.lessons.map((l) => ({
        ...clone(l), source_type: null, source_url: null, source_file: null,
        est_minutes: minutesFor(lessonWords(l), m.questions.filter((q) => q.kind === 'check' && q.lesson_position === l.position).length),
      })),
      est_minutes: moduleMinutes(m), repeats: leader ? 0 : undefined,
      questions: m.questions.map((q) => ({
        id: q.id, prompt: q.prompt, options: [...q.options], lesson_position: q.lesson_position, kind: q.kind,
        ...(leader ? { answer_index: q.answer_index, explanation: q.explanation } : {}),
      })),
      completed: (state.progress[me.id] || []).filter((id) => m.lessons.some((l) => l.id === id)),
      progress: progressFor(me.id, m),
    };
  }

  function saveModule(m, b, me) {
    if (!b.title || !String(b.title).trim()) return fail(400, 'Give the module a title.');
    const questions = [];
    for (const [n, q] of (b.questions || []).entries()) {
      if (!q.prompt || !String(q.prompt).trim()) continue;
      const kept = (q.options || []).map((o, i) => ({ text: String(o ?? '').trim(), i })).filter((o) => o.text);
      if (kept.length < 2) continue;
      const correct = kept.findIndex((o) => o.i === Number(q.answer_index));
      if (correct < 0) return fail(400, `Question ${n + 1} (${String(q.prompt).slice(0, 40)}): the option marked correct is empty. Pick or fill in the correct answer.`);
      questions.push({ prompt: String(q.prompt), options: kept.map((o) => o.text), answer_index: correct, explanation: String(q.explanation || ''), lesson_position: q.lesson_position ?? null, kind: q.kind === 'check' ? 'check' : 'final' });
    }
    ensureBaseline(m);
    const oldLessons = new Map(m.lessons.map((l) => [l.id, l]));
    m.title = String(b.title); m.summary = String(b.summary || ''); m.required = b.required ? 1 : 0;
    m.lessons = (b.lessons || []).map((l, i) => {
      const keep = l.id && oldLessons.has(l.id);
      const sc = l.scenario && (l.scenario.situation || l.scenario.response)
        ? { situation: String(l.scenario.situation || ''), response: String(l.scenario.response || ''), why: String(l.scenario.why || '') } : null;
      return {
        id: keep ? l.id : ++state.seq.lesson, position: i + 1, title: String(l.title || ''), body: String(l.body || ''),
        key_points: strs(l.key_points), steps: strs(l.steps), scenario: sc, media: [], source_id: null,
        removed: [...new Set((Array.isArray(l.removed) ? l.removed : []).filter((k) => SECTIONS.includes(k)))],
      };
    });
    m.questions = questions.map((q, i) => ({ ...q, id: ++state.seq.question, position: i + 1 }));
    addVersion(m, me.id, 'edited');
    return ok({ ok: true });
  }

  function handle(method, path, body) {
    const me = meOf();
    const isLeader = !!me && me.role !== 'staff';
    const need = () => (!me ? fail(401, 'Please sign in.') : null);
    const needLeader = () => (!me ? fail(401, 'Please sign in.') : (!isLeader ? fail(403, 'Leadership access only.') : null));
    let m;

    if (method === 'GET' && path === '/api/status') {
      return ok({
        needsSetup: false, ai: 'demo', user: publicUser(me), demo: true,
        demoLogins: { owner: C.logins.owner, staff: C.logins.staff },
        demoBanner: 'a fictional dental office with sample data. This version runs entirely in your browser: nothing is sent or stored anywhere else, and your changes stay on this device. Live AI writing is turned off; the sample modules show what it produces. <a href="#" id="resetDemo">Reset demo</a>',
      });
    }
    if (method === 'POST' && path === '/api/login') {
      const u = state.users.find((x) => x.email === String(body.email || '').toLowerCase().trim() && x.password === String(body.password || ''));
      if (!u) return fail(401, 'Wrong email or password.');
      setSession(u.id); return ok({ ok: true });
    }
    if (method === 'POST' && path === '/api/logout') { setSession(null); return ok({ ok: true }); }

    // things the public demo never allows
    if ((method === 'POST' && /^\/api\/(setup|password|users|sources|modules\/generate)$/.test(path))
      || (method === 'POST' && /^\/api\/users\/\d+\/password$/.test(path))
      || (method === 'POST' && /^\/api\/modules\/\d+\/(draft-parts|remove-repeats)$/.test(path))
      || (['PATCH', 'DELETE'].includes(method) && /^\/api\/(sources|users)\//.test(path))
      || (method === 'GET' && path === '/api/backup')) return fail(403, BLOCKED_MSG);

    let g = need(); if (g) return g;

    if (method === 'GET' && path === '/api/modules') {
      const rows = state.modules.filter((x) => isLeader || x.status === 'published')
        .sort((a, b) => (b.required - a.required) || (b.id - a.id))
        .map((x) => ({
          id: x.id, title: x.title, summary: x.summary, status: x.status, required: x.required, created_at: x.created_at,
          lesson_count: x.lessons.length, question_count: kinds(x, 'final').length,
          est_minutes: moduleMinutes(x), progress: progressFor(me.id, x),
        }));
      return ok(rows);
    }
    let r;
    if ((r = path.match(/^\/api\/modules\/(\d+)$/))) {
      m = state.modules.find((x) => x.id === Number(r[1]));
      if (method === 'GET') return (!m || (!isLeader && m.status !== 'published')) ? fail(404, 'Not found.') : ok(moduleDetail(m, me));
      if (method === 'PUT') { g = needLeader(); if (g) return g; return m ? saveModule(m, body, me) : fail(404, 'Not found.'); }
      if (method === 'DELETE') {
        g = needLeader(); if (g) return g;
        state.modules = state.modules.filter((x) => x.id !== Number(r[1])); delete state.versions[r[1]]; save(); return ok({ ok: true });
      }
    }
    if ((r = path.match(/^\/api\/modules\/(\d+)\/(publish|versions|restore|quiz)$/))) {
      m = state.modules.find((x) => x.id === Number(r[1]));
      if (!m) return fail(404, 'Not found.');
      if (r[2] === 'quiz' && method === 'POST') {
        const finals = kinds(m, 'final').sort((a, b) => a.position - b.position);
        const answers = body.answers || {};
        const results = finals.map((q) => ({
          id: q.id, chosen: answers[q.id] ?? null, correct_index: q.answer_index, correct: Number(answers[q.id]) === q.answer_index,
          explanation: q.explanation, lesson_position: q.lesson_position,
        }));
        const score = results.filter((x) => x.correct).length;
        const passed = finals.length > 0 && score / finals.length >= PASS_MARK;
        state.attempts.push({ user_id: me.id, module_id: m.id, score, total: finals.length, passed: passed ? 1 : 0, created_at: stamp() });
        return ok({ score, total: finals.length, passed, pass_mark: PASS_MARK, results });
      }
      g = needLeader(); if (g) return g;
      if (r[2] === 'publish' && method === 'POST') {
        const publish = body.publish !== false;
        if (publish && (!m.lessons.length || !kinds(m, 'final').length)) return fail(400, 'A module needs at least one lesson and one final assessment question to publish.');
        m.status = publish ? 'published' : 'draft';
        addVersion(m, me.id, publish ? 'published' : 'unpublished', publish ? 'Published to staff' : 'Unpublished (hidden from staff)');
        return ok({ ok: true });
      }
      if (r[2] === 'versions' && method === 'GET') {
        return ok([...versionsOf(m)].reverse().map((v) => ({ id: v.id, action: v.action, summary: v.summary, created_at: v.created_at, user_name: v.user_id ? userName(v.user_id) : null })));
      }
      if (r[2] === 'restore' && method === 'POST') {
        const v = versionsOf(m).find((x) => x.id === Number(body.version_id));
        if (!v) return fail(404, 'Version not found.');
        ensureBaseline(m);
        const snap = clone(v.snapshot);
        m.title = snap.title; m.summary = snap.summary; m.required = snap.required ? 1 : 0; m.lessons = snap.lessons; m.questions = snap.questions;
        m.lessons.forEach((l, i) => { l.position = i + 1; });
        addVersion(m, me.id, 'restored', `Restored the version from ${v.created_at} UTC`);
        return ok({ ok: true });
      }
    }
    if (method === 'POST' && (r = path.match(/^\/api\/lessons\/(\d+)\/complete$/))) {
      const id = Number(r[1]);
      if (!state.modules.some((x) => x.lessons.some((l) => l.id === id))) return fail(404, 'Not found.');
      const list = (state.progress[me.id] = state.progress[me.id] || []);
      if (!list.includes(id)) list.push(id);
      return ok({ ok: true });
    }
    if (method === 'POST' && (r = path.match(/^\/api\/questions\/(\d+)\/check$/))) {
      const q = state.modules.flatMap((x) => x.questions.map((y) => ({ ...y, status: x.status }))).find((y) => y.id === Number(r[1]) && y.kind === 'check');
      if (!q || (!isLeader && q.status !== 'published')) return fail(404, 'Not found.');
      const correct = Number(body.choice) === q.answer_index;
      return ok({ correct, ...(correct ? { explanation: q.explanation } : {}) });
    }
    if (path === '/api/announcements') {
      if (method === 'GET') {
        return ok([...state.announcements].sort((a, b) => (b.pinned - a.pinned) || (b.id - a.id)).slice(0, 20)
          .map((a) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned, created_at: a.created_at, author: userName(a.author_id) })));
      }
      if (method === 'POST') {
        g = needLeader(); if (g) return g;
        const text = String(body.body || '').trim().slice(0, 2000);
        if (!text) return fail(400, 'Write the announcement text.');
        state.announcements.push({ id: ++state.seq.ann, title: String(body.title || '').trim().slice(0, 120), body: text, pinned: body.pinned ? 1 : 0, author_id: me.id, created_at: stamp() });
        return ok({ ok: true });
      }
    }
    if (method === 'DELETE' && (r = path.match(/^\/api\/announcements\/(\d+)$/))) {
      g = needLeader(); if (g) return g;
      state.announcements = state.announcements.filter((a) => a.id !== Number(r[1])); return ok({ ok: true });
    }
    if (method === 'GET' && path === '/api/report') {
      g = needLeader(); if (g) return g;
      const mods = state.modules.filter((x) => x.status === 'published').sort((a, b) => a.id - b.id);
      const staff = state.users.filter((u) => u.role === 'staff').sort((a, b) => a.name.localeCompare(b.name));
      return ok({
        modules: mods.map((x) => ({ id: x.id, title: x.title, required: x.required })),
        staff: staff.map((s) => {
          const mine = state.attempts.filter((a) => a.user_id === s.id).map((a) => a.created_at).sort();
          return { id: s.id, name: s.name, email: s.email, last_quiz: mine.length ? mine[mine.length - 1] : null, modules: mods.map((x) => ({ module_id: x.id, ...progressFor(s.id, x) })) };
        }),
      });
    }
    if (method === 'GET' && path === '/api/users') {
      g = needLeader(); if (g) return g;
      return ok([...state.users].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at })));
    }
    if (method === 'GET' && path === '/api/sources') return ok([]);
    if (method === 'GET' && /^\/api\/sources\/\d+$/.test(path)) return fail(404, 'Not found.');
    if (method === 'POST' && path === '/api/ask') {
      const question = String(body.question || '').trim().slice(0, 500);
      if (!question) return fail(400, 'Type a question.');
      const hits = retrieve(buildChunks(), question);
      const { answer, cited } = quote(question, hits);
      return ok({
        answer,
        sources: cited.map((i) => ({ n: i + 1, label: hits[i].label, module: hits[i].sub, link: hits[i].link })),
        related: hits.filter((_, i) => !cited.includes(i)).slice(0, 3).map((h) => ({ label: h.label, module: h.sub, link: h.link })),
      });
    }
    return fail(404, 'Not found.');
  }

  // ---------- intercept the app's network calls ----------
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = ((init && init.method) || 'GET').toUpperCase();
    let body = {};
    try { body = init && typeof init.body === 'string' ? JSON.parse(init.body) : {}; } catch { body = {}; }
    let result;
    try { result = handle(method, url.pathname, body || {}); } catch (e) { console.error(e); result = [500, { error: 'Something went wrong in the demo.' }]; }
    if (method !== 'GET') save();
    return new Response(JSON.stringify(result[1]), { status: result[0], headers: { 'Content-Type': 'application/json' } });
  };
})();
