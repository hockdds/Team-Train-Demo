// TeamTrain front end: plain JavaScript, no build step.
const $app = document.getElementById('app');
let status = null; // { needsSetup, ai, user }

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isLeader = () => status?.user && status.user.role !== 'staff';
const pct = (n) => `${Math.round((n || 0) * 100)}%`;

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { await boot(); }
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500);
}

// Runs an async action on a button, showing a spinner and surfacing errors.
async function busy(btn, label, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${label}`;
  try { return await fn(); } catch (e) { toast(e.message); } finally { btn.disabled = false; btn.innerHTML = old; }
}

// Minimal, safe markdown: ## headings, - bullets, **bold**, *italic*. Input is escaped first.
function md(src = '') {
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const out = []; let list = false;
  for (const raw of esc(src).split('\n')) {
    const line = raw.trim();
    const li = /^[-*]\s+(.*)/.exec(line);
    if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (!line) continue;
    const h = /^#{1,4}\s+(.*)/.exec(line);
    out.push(h ? `<h4>${inline(h[1])}</h4>` : `<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('');
}

function videoEmbed(url, file) {
  if (file) return `<video class="video" controls src="/files/${esc(file)}"></video>`;
  if (!url) return '';
  try {
    const u = new URL(url); const h = u.hostname.replace(/^www\./, '');
    let src = '';
    if (h === 'youtu.be') src = `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    else if (h.endsWith('youtube.com')) src = `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v') || u.pathname.split('/').pop()}`;
    else if (h === 'vimeo.com') src = `https://player.vimeo.com/video/${u.pathname.split('/').pop()}`;
    else if (h === 'loom.com') src = `https://www.loom.com/embed/${u.pathname.split('/').pop()}`;
    if (src) return `<iframe class="video" src="${esc(src)}" allowfullscreen></iframe>`;
  } catch { /* fall through */ }
  return `<p><a href="${esc(url)}" target="_blank" rel="noopener">Open video</a></p>`;
}

// ---------- layout ----------
function shell(content, active = '') {
  const u = status.user;
  const link = (href, text, key) => `<a href="${href}" class="${active === key ? 'on' : ''}">${text}</a>`;
  $app.innerHTML = `
    <header class="top"><div class="in">
      <a class="brand" href="#/">TeamTrain</a>
      <nav>
        ${link('#/', isLeader() ? 'Dashboard' : 'My training', 'home')}
        ${link('#/library', 'Library', 'library')}
        ${isLeader() ? link('#/manage/modules', 'Modules', 'modules') + link('#/manage/sources', 'Sources', 'sources') + link('#/manage/team', 'Team', 'team') : ''}
      </nav>
      <form class="search" id="topSearch"><input type="text" name="q" placeholder="Ask a question…" aria-label="Ask a question"><button class="btn">Ask</button></form>
      <span class="small muted">${esc(u.name)} · <a href="#/account">Account</a> · <a href="#" id="logout">Sign out</a></span>
    </div></header>
    <main class="wrap">${status.demo
      ? `<div class="notice"><b>Public demo:</b> ${status.demoBanner || 'a fictional dental office with sample data. Nothing here is real, and it resets every few hours. Live AI writing is turned off; the sample modules show what it produces.'}</div>`
      : (status.ai === 'demo' && isLeader() ? '<div class="notice"><b>Demo mode:</b> AI output is placeholder text. Add a free Groq key to <code>.env</code> (see README) for real lessons, quizzes and answers.</div>' : '')}${content}</main>`;
  document.getElementById('topSearch').onsubmit = (e) => {
    e.preventDefault(); const q = new FormData(e.target).get('q').trim();
    if (q) location.hash = `#/ask?q=${encodeURIComponent(q)}`;
  };
  document.getElementById('logout').onclick = async (e) => { e.preventDefault(); await api('POST', '/api/logout'); await boot(); };
  const reset = document.getElementById('resetDemo');
  if (reset && window.TT_RESET_DEMO) reset.onclick = (e) => { e.preventDefault(); if (confirm('Reset the demo to its original sample data?')) window.TT_RESET_DEMO(); };
}

// ---------- auth screens ----------
function authScreen() {
  const setup = status.needsSetup;
  $app.innerHTML = `<div class="auth"><div class="card">
    <h1>${setup ? 'Set up TeamTrain' : 'Sign in'}</h1>
    <p class="muted">${setup ? 'Create your business and the owner account.' : 'Welcome back.'}</p>
    <form id="authForm">
      ${setup ? `<label>Business name</label><input type="text" name="business" required placeholder="Smile Dental">
      <label>Type of business</label><input type="text" name="industry" placeholder="Dental office">
      <label>Your name</label><input type="text" name="name" required>` : ''}
      <label>Email</label><input type="email" name="email" required autocomplete="username">
      <label>Password ${setup ? '(8+ characters)' : ''}</label><input type="password" name="password" required minlength="${setup ? 8 : 1}" autocomplete="${setup ? 'new-password' : 'current-password'}">
      <p><button class="btn" style="width:100%">${setup ? 'Create account' : 'Sign in'}</button></p>
    </form></div>
    ${status.demo && status.demoLogins ? `<div class="card"><h3>Try the demo</h3>
      <p class="muted small" style="margin:.25rem 0 .6rem">A fictional dental office. Pick a view:</p>
      <div class="row">${Object.entries(status.demoLogins).map(([k, v]) => `<button class="btn alt" data-demo="${k}">${esc(v.label)}</button>`).join('')}</div></div>` : ''}
    </div>`;
  document.querySelectorAll('[data-demo]').forEach((b) => b.onclick = () => busy(b, 'Signing in…', async () => {
    const v = status.demoLogins[b.dataset.demo];
    await api('POST', '/api/login', { email: v.email, password: v.password });
    location.hash = '#/'; await boot();
  }));
  document.getElementById('authForm').onsubmit = (e) => {
    e.preventDefault();
    busy(e.target.querySelector('button'), 'Working…', async () => {
      await api('POST', setup ? '/api/setup' : '/api/login', Object.fromEntries(new FormData(e.target)));
      location.hash = '#/'; await boot();
    });
  };
}

// ---------- shared pieces ----------
// Shown wherever leaders add material or edit lessons, because everything typed here is sent to an outside AI service.
function aiWarning(compact = false) {
  if (compact) {
    return `<div class="privacy-warning compact"><b>⚠️ No sensitive info.</b> Don't add patient information, employee records, passwords or financial/confidential data. It's sent to an outside AI service.</div>`;
  }
  return `<div class="privacy-warning" role="alert"><div class="pw-title">⚠️ Do not upload sensitive, confidential or classified information</div>
    <p>Everything you add here is sent to an outside AI service to write the lessons, and that service may keep or learn from it. Never include:</p>
    <ul><li>Patient information: names, charts, photos, X-rays, insurance or contact details</li>
      <li>Employee records, passwords, Social Security or financial account numbers</li>
      <li>Anything private, classified or legally protected</li></ul>
    <p style="margin-bottom:0">Use general policies and procedures only. The AI also makes mistakes, so review every lesson and answer before publishing.</p></div>`;
}

function announcementsHtml(list, manage = false) {
  const when = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (!list.length) return manage ? '<p class="muted small">No announcements yet.</p>' : '';
  return `<div class="announcements">${list.map((a) => `<div class="announce ${a.pinned ? 'pinned' : ''}">
      <div class="row between"><b>${a.pinned ? '📌 ' : '📣 '}${esc(a.title || 'Announcement')}</b>
        <span class="small muted">${esc(when(a.created_at))}${a.author ? ` · ${esc(a.author)}` : ''}${manage ? ` · <a href="#" data-delann="${a.id}">Delete</a>` : ''}</span></div>
      <p style="margin:.35rem 0 0;white-space:pre-wrap">${esc(a.body)}</p></div>`).join('')}</div>`;
}

// ---------- pages ----------
async function homePage() {
  const [mods, anns] = await Promise.all([api('GET', '/api/modules'), api('GET', '/api/announcements')]);
  if (isLeader()) return dashboardPage(mods, anns);
  const published = mods.filter((m) => m.status === 'published');
  const todo = published.filter((m) => !m.progress.complete);
  shell(`
    <div class="hero"><h1>Hi ${esc(status.user.name.split(' ')[0])} 👋</h1>
      <p class="muted">Quick lessons, quick answers.</p>
      <form class="search" id="heroSearch"><input type="text" name="q" placeholder="Ask anything, e.g. “How do I sterilize a handpiece?”"><button class="btn">Ask</button></form></div>
    ${announcementsHtml(anns)}
    <h2>${todo.length ? 'To do' : 'All caught up 🎉'}</h2>
    <div class="grid">${todo.map(moduleCard).join('') || '<p class="muted">Nothing assigned right now.</p>'}</div>
    ${published.length > todo.length ? `<h2>Completed</h2><div class="grid">${published.filter((m) => m.progress.complete).map(moduleCard).join('')}</div>` : ''}`, 'home');
  document.getElementById('heroSearch').onsubmit = (e) => {
    e.preventDefault(); const q = new FormData(e.target).get('q').trim();
    if (q) location.hash = `#/ask?q=${encodeURIComponent(q)}`;
  };
}

function moduleCard(m) {
  const p = m.progress; const frac = p.lessons_total ? p.lessons_done / p.lessons_total : 0;
  const badge = p.passed ? '<span class="pill ok">Passed</span>' : p.lessons_done ? '<span class="pill warn">In progress</span>' : '<span class="pill">New</span>';
  return `<div class="card"><div class="row between"><h3>${esc(m.title)}</h3>${badge}</div>
    ${m.required ? '<span class="pill bad" style="align-self:flex-start">Required</span>' : ''}
    <p class="muted small" style="margin:0">${esc(m.summary)}</p>
    <div class="bar"><i style="width:${frac * 100}%"></i></div>
    <div class="row between small muted"><span>${p.lessons_done}/${p.lessons_total} lessons · about ${m.est_minutes} min</span>${p.best_score != null ? `<span>Best ${pct(p.best_score)}</span>` : ''}</div>
    <a class="btn" href="#/module/${m.id}">${p.passed ? 'Review' : p.lessons_done ? 'Continue' : 'Start'}</a></div>`;
}

async function dashboardPage(mods, anns) {
  const rep = await api('GET', '/api/report');
  const drafts = mods.filter((m) => m.status === 'draft');
  shell(`
    <h1>Dashboard</h1><p class="muted">See who has completed training.</p>
    <div class="card"><h3>Announcements to your team</h3>
      <p class="muted small" style="margin:.2rem 0 .6rem">These appear at the top of every employee's welcome screen.</p>
      <form id="annForm"><input type="text" name="title" placeholder="Title (optional), e.g. Schedule change" maxlength="120">
        <textarea name="body" placeholder="Write your announcement…" required maxlength="2000" style="min-height:5rem;margin-top:.4rem"></textarea>
        <div class="row between" style="margin-top:.4rem"><label class="inline"><input type="checkbox" name="pinned"> Pin to the top</label><button class="btn">Post announcement</button></div></form>
      ${announcementsHtml(anns, true)}</div>
    ${!mods.length ? `<div class="card"><h3>Get started</h3><ol><li><a href="#/manage/sources">Add your documents, links, screenshots or videos</a></li><li>Pick them and let the AI draft a module</li><li>Review, edit and publish</li><li><a href="#/manage/team">Add your team</a></li></ol></div>` : ''}
    ${drafts.length ? `<div class="notice">${drafts.length} draft module(s) waiting for your review: ${drafts.map((d) => `<a href="#/manage/module/${d.id}">${esc(d.title)}</a>`).join(', ')}</div>` : ''}
    <div class="card scroll">${rep.staff.length && rep.modules.length ? `<table>
      <tr><th>Team member</th>${rep.modules.map((m) => `<th>${esc(m.title)}${m.required ? ' *' : ''}</th>`).join('')}<th>Last quiz</th></tr>
      ${rep.staff.map((s) => `<tr><td><b>${esc(s.name)}</b></td>${s.modules.map((p) => `<td>${p.passed ? `<span class="pill ok">Passed ${pct(p.best_score)}</span>` : p.lessons_done ? `<span class="pill warn">${p.lessons_done}/${p.lessons_total} lessons${p.best_score != null ? ` · ${pct(p.best_score)}` : ''}</span>` : '<span class="pill">Not started</span>'}</td>`).join('')}<td class="muted">${s.last_quiz ? esc(s.last_quiz.slice(0, 10)) : '—'}</td></tr>`).join('')}
    </table><p class="small muted">* required · pass mark 80%</p>` : '<p class="muted">Progress appears here once you have published modules and added team members.</p>'}</div>`, 'home');
  document.getElementById('annForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    busy(e.target.querySelector('button'), 'Posting…', async () => {
      await api('POST', '/api/announcements', { title: fd.get('title'), body: fd.get('body'), pinned: fd.get('pinned') === 'on' });
      toast('Announcement posted.'); dashboardPage(mods, await api('GET', '/api/announcements'));
    });
  };
  document.querySelectorAll('[data-delann]').forEach((a) => a.onclick = async (e) => {
    e.preventDefault();
    if (!confirm('Delete this announcement?')) return;
    await api('DELETE', `/api/announcements/${a.dataset.delann}`); dashboardPage(mods, await api('GET', '/api/announcements'));
  });
}

async function libraryPage() {
  const mods = (await api('GET', '/api/modules')).filter((m) => m.status === 'published');
  const full = await Promise.all(mods.map((m) => api('GET', `/api/modules/${m.id}`)));
  shell(`<h1>Library</h1><p class="muted">Every lesson, whenever you need a refresher.</p>
    ${full.map((m) => `<div class="card"><h3>${esc(m.title)}</h3><p class="muted small">${esc(m.summary)}</p>
      ${m.lessons.map((l) => `<a class="row" style="padding:.25rem 0" href="#/module/${m.id}?lesson=${l.position}">Lesson ${l.position} – ${esc(l.title)}</a>`).join('')}</div>`).join('') || '<p class="muted">No published modules yet.</p>'}`, 'library');
}

async function askPage(query) {
  const q = new URLSearchParams(query).get('q') || '';
  shell(`<h1>Ask</h1>
    <form class="row" id="askForm"><input type="text" name="q" value="${esc(q)}" placeholder="Type your question…" style="flex:1" autofocus><button class="btn">Ask</button></form>
    <div class="privacy-warning compact"><b>⚠️ Don't type patient names or other private details.</b> Questions are sent to an outside AI service. Ask about the procedure, not the person.</div>
    <div id="result"></div>`);
  const form = document.getElementById('askForm');
  const run = async () => {
    const question = form.q.value.trim(); if (!question) return;
    const box = document.getElementById('result');
    box.innerHTML = '<div class="card"><span class="spinner"></span> Looking through your training material…</div>';
    try {
      const r = await api('POST', '/api/ask', { question });
      const answer = md(r.answer).replace(/\[(\d+)\]/g, (m, n) => {
        const s = r.sources.find((x) => x.n === Number(n));
        return s ? `<a class="cite" href="${esc(s.link)}" title="${esc(s.label)}">${n}</a>` : '';
      });
      box.innerHTML = `<div class="card answer">${answer}</div>
        ${r.sources.length ? `<h2>Sources</h2><div class="srcs">${r.sources.map((s) => `<a href="${esc(s.link)}"><b>[${s.n}] ${esc(s.label)}</b><br><span class="muted small">${esc(s.module)}</span></a>`).join('')}</div>` : ''}
        ${r.related.length ? `<h2>Related</h2><div class="srcs">${r.related.map((s) => `<a href="${esc(s.link)}">${esc(s.label)} <span class="muted small">· ${esc(s.module)}</span></a>`).join('')}</div>` : ''}`;
    } catch (e) { box.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  };
  form.onsubmit = (e) => { e.preventDefault(); run(); };
  if (q) run();
}

// ----- module player -----
function mediaHtml(l) {
  const items = (l.media || []).map((m) => {
    const cap = m.caption ? `<figcaption class="small muted">${esc(m.caption)}</figcaption>` : '';
    if (m.type === 'image' && m.file_name) return `<figure class="media"><img src="/files/${esc(m.file_name)}" alt="${esc(m.caption || m.title)}">${cap}</figure>`;
    if (m.type === 'video') return `<figure class="media">${videoEmbed(m.url, m.file_name)}${cap}</figure>`;
    return '';
  });
  // older lessons embedded their source video directly
  if (l.source_type === 'video' && !(l.media || []).some((m) => m.source_id === l.source_id)) items.push(videoEmbed(l.source_url, l.source_file));
  return items.join('');
}

function scenarioHtml(sc) {
  if (!sc) return '';
  return `<div class="scenario"><span class="pill warn">Scenario</span>
    <p>${esc(sc.situation)}</p>
    <details><summary>What would you do?</summary>
      <p><b>Do this:</b> ${esc(sc.response)}</p>${sc.why ? `<p class="muted"><b>Why:</b> ${esc(sc.why)}</p>` : ''}</details></div>`;
}

async function modulePage(id, query) {
  const m = await api('GET', `/api/modules/${id}`);
  const finals = m.questions.filter((q) => q.kind !== 'check');
  const checksFor = (pos) => m.questions.filter((q) => q.kind === 'check' && q.lesson_position === pos);
  const startLesson = Number(new URLSearchParams(query).get('lesson'));
  let step = startLesson ? Math.min(startLesson, m.lessons.length) - 1
    : m.progress.lessons_done >= m.lessons.length ? 'quiz' : Math.min(m.progress.lessons_done, m.lessons.length - 1);
  const done = new Set(m.completed);
  const solved = new Set(); // knowledge checks answered correctly in this visit
  const lessonReady = (l) => done.has(l.id) || checksFor(l.position).every((q) => solved.has(q.id));

  const draw = (quizResult) => {
    const lessonStep = typeof step === 'number';
    const dots = `<div class="steps">${m.lessons.map((l, i) => `<button data-step="${i}" title="${esc(l.title)}" class="${i === step ? 'cur' : done.has(l.id) ? 'done' : ''}"></button>`).join('')}
      <button data-step="quiz" title="Final assessment" class="${step === 'quiz' ? 'cur' : m.progress.passed ? 'done' : ''}"></button></div>`;
    let body;
    if (lessonStep) {
      const l = m.lessons[step];
      const checks = checksFor(l.position);
      body = `<div class="card lesson"><span class="pill">Lesson ${l.position} of ${m.lessons.length} · about ${l.est_minutes} min</span><h2 style="margin-top:.5rem">${esc(l.title)}</h2>
        ${mediaHtml(l)}
        ${l.key_points.length && !l.steps.length ? `<div class="points"><b>Key points</b><ul>${l.key_points.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}
        ${md(l.body)}
        ${l.steps.length ? `<h3 class="proc-h">Step by step</h3><ol class="proc">${l.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
        ${scenarioHtml(l.scenario)}
        ${checks.length ? `<div class="checks"><h3>Quick check</h3>${checks.map((q, qi) => `<div class="q chk" data-q="${q.id}"><b>${qi + 1}. ${esc(q.prompt)}</b>
          ${q.options.map((o, oi) => `<button type="button" class="opt btnopt ${solved.has(q.id) ? 'locked' : ''}" data-o="${oi}">${esc(o)}</button>`).join('')}
          <div class="expl" aria-live="polite"></div></div>`).join('')}</div>` : ''}
        <div class="row between" style="margin-top:1rem"><button class="btn alt" id="prev" ${step === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn" id="next" ${lessonReady(l) ? '' : 'disabled'}>${step === m.lessons.length - 1 ? 'Got it – go to the final assessment' : 'Got it – next'}</button></div>
        ${lessonReady(l) ? '' : '<p class="small muted" id="gate" style="text-align:right">Answer the quick check to continue.</p>'}</div>`;
    } else if (quizResult) {
      const r = quizResult;
      body = `<div class="card"><h2>${r.passed ? '🎉 Passed' : 'Not quite yet'} — ${r.score}/${r.total} (${pct(r.score / r.total)})</h2>
        <p class="muted">${r.passed ? 'Nice work. You can review any lesson from the Library at any time.' : `You need ${pct(r.pass_mark)} to pass. Review the lessons flagged below, then try again.`}</p>        ${finals.map((q, i) => { const x = r.results[i]; return `<div class="q"><b>${i + 1}. ${esc(q.prompt)}</b>
          ${q.options.map((o, oi) => `<div class="opt ${oi === x.correct_index ? 'right' : oi === x.chosen ? 'wrong' : ''}">${oi === x.correct_index ? '✓' : oi === x.chosen ? '✗' : '&nbsp;'} ${esc(o)}</div>`).join('')}
          <div class="expl">${esc(x.explanation)} ${!x.correct && x.lesson_position ? `<a href="#/module/${m.id}?lesson=${x.lesson_position}">Review Lesson ${x.lesson_position}</a>` : ''}</div></div>`; }).join('')}
        <div class="row"><button class="btn" id="retry">${r.passed ? 'Retake assessment' : 'Try again'}</button>
          <a class="btn alt" href="#/">Back to my training</a></div></div>`;
    } else {
      body = `<div class="card"><h2>Final assessment</h2><p class="muted">${finals.length} questions · pass mark 80%</p>
        <form id="quiz">${finals.map((q, i) => `<div class="q"><b>${i + 1}. ${esc(q.prompt)}</b>
          ${q.options.map((o, oi) => `<label class="opt"><input type="radio" name="q${q.id}" value="${oi}" required> <span>${esc(o)}</span></label>`).join('')}</div>`).join('')}
        <button class="btn">Submit answers</button></form></div>`;
    }
    shell(`<a href="#/" class="small">← Back</a><h1>${esc(m.title)}</h1><p class="muted small" style="margin:0">About ${m.est_minutes} min in total</p>${m.status === 'draft' ? '<div class="notice">Draft preview – not visible to staff yet.</div>' : ''}${dots}${body}`, '');

    document.querySelectorAll('.steps button').forEach((b) => b.onclick = () => {
      step = b.dataset.step === 'quiz' ? 'quiz' : Number(b.dataset.step); draw(); window.scrollTo(0, 0);
    });
    const next = document.getElementById('next');
    if (next) next.onclick = () => busy(next, 'Saving…', async () => {
      await api('POST', `/api/lessons/${m.lessons[step].id}/complete`); done.add(m.lessons[step].id);
      step = step === m.lessons.length - 1 ? 'quiz' : step + 1; draw(); window.scrollTo(0, 0);
    });
    const prev = document.getElementById('prev'); if (prev) prev.onclick = () => { step--; draw(); };
    const retry = document.getElementById('retry'); if (retry) retry.onclick = () => { step = 'quiz'; draw(); window.scrollTo(0, 0); };

    // inline knowledge checks: retry until correct, explanation appears once right
    document.querySelectorAll('.chk').forEach((box) => {
      const qid = Number(box.dataset.q);
      box.querySelectorAll('.btnopt').forEach((btn) => btn.onclick = async () => {
        if (solved.has(qid)) return;
        const expl = box.querySelector('.expl');
        try {
          const r = await api('POST', `/api/questions/${qid}/check`, { choice: Number(btn.dataset.o) });
          if (r.correct) {
            solved.add(qid); btn.classList.add('right');
            box.querySelectorAll('.btnopt').forEach((b) => b.classList.add('locked'));
            expl.innerHTML = `✓ Correct. ${esc(r.explanation)}`;
            if (lessonReady(m.lessons[step])) { document.getElementById('next').disabled = false; document.getElementById('gate')?.remove(); }
          } else {
            btn.classList.add('wrong');
            expl.textContent = 'Not quite. Look back at the lesson above and try again.';
          }
        } catch (e) { toast(e.message); }
      });
    });

    const quiz = document.getElementById('quiz');
    if (quiz) quiz.onsubmit = (e) => {
      e.preventDefault();
      const answers = {}; finals.forEach((q) => { answers[q.id] = Number(new FormData(quiz).get(`q${q.id}`)); });
      busy(quiz.querySelector('button'), 'Grading…', async () => {
        const r = await api('POST', `/api/modules/${m.id}/quiz`, { answers });
        if (r.passed) { m.progress.passed = true; }
        draw(r); window.scrollTo(0, 0);
      });
    };
  };
  draw();
}

async function sourceViewPage(id) {
  const s = await api('GET', `/api/sources/${id}`);
  shell(`<a href="#/library" class="small">← Back</a><h1>${esc(s.title)}</h1>
    <p class="muted small">Original document · ${esc(s.type)}${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">open link</a>` : ''}</p>
    ${s.type === 'video' ? videoEmbed(s.url, s.file_name) : ''}${s.type === 'image' && s.file_name ? `<img src="/files/${esc(s.file_name)}" alt="" style="max-width:100%;border-radius:10px">` : ''}
    <div class="card lesson">${md(s.content) || '<p class="muted">No text.</p>'}</div>`);
}

// ----- leadership: sources -----
async function sourcesPage() {
  const list = await api('GET', '/api/sources');
  shell(`<h1>Sources</h1><p class="muted">Add anything you want your team trained on. The AI reads it; you review the result before staff see it.</p>
    ${status.demo ? '<div class="notice"><b>Turned off in the public demo:</b> uploading material and live AI writing. In the real app you add documents, links, screenshots or videos here and the AI drafts a module. See the sample modules for the result.</div>' : ''}
    ${aiWarning()}
    <div class="card"><h3>Add material</h3>
      <div class="tabs" id="kindTabs"><button data-k="text" class="on">Text</button><button data-k="file">File / image / video</button><button data-k="link">Link</button></div>
      <form id="srcForm">
        <label>Title</label><input type="text" name="title" placeholder="e.g. Guide to Handpieces">
        <div data-k="text"><label>Text</label><textarea name="text" placeholder="Paste procedures, policies, notes, an article…"></textarea></div>
        <div data-k="file" hidden><label>File (PDF, Word, text, screenshot, or video)</label><input type="file" name="file" accept=".pdf,.docx,.txt,.md,.csv,image/*,video/*"></div>
        <div data-k="link" hidden><label>Web address</label><input type="url" name="url" placeholder="https://…"></div>
        <div data-k="vid" hidden><label>Video transcript (paste it so the AI can learn from the video)</label><textarea name="transcript" placeholder="Paste the transcript or write a summary of what the video covers."></textarea>
          <p class="small muted">Tip: YouTube shows a transcript under “…more”. Free tools can transcribe other videos.</p></div>
        <p><button class="btn">Add source</button></p>
      </form></div>
    <h2>Your sources</h2>
    ${list.length ? `<div class="card"><label>What should the module focus on? <span class="muted">(optional)</span></label>
      <input type="text" id="guidance" placeholder="e.g. For new dental assistants; focus on sterilization steps; 3 lessons">
      ${aiWarning(true)}
      <p class="small muted">Tick one or more sources, then:</p>
      <button class="btn" id="gen">✨ Create module draft with AI</button></div>` : ''}
    ${list.map((s) => `<div class="card row between"><label class="inline"><input type="checkbox" class="pick" value="${s.id}"> <span><b>${esc(s.title)}</b><br><span class="small muted">${esc(s.type)} · ${s.chars ? `${s.chars.toLocaleString()} characters` : '<span style="color:var(--bad)">no text yet – edit to add</span>'}${s.staff_visible ? '' : ' · hidden from staff'}</span></span></label>
      <span class="row"><a class="btn alt sm" href="#/manage/source/${s.id}">View / edit</a><button class="btn danger sm" data-del="${s.id}">Delete</button></span></div>`).join('') || '<p class="muted">Nothing yet.</p>'}`, 'sources');

  const form = document.getElementById('srcForm');
  const show = (k) => {
    document.querySelectorAll('#kindTabs button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    form.dataset.kind = k;
    form.querySelectorAll('[data-k]').forEach((d) => { d.hidden = d.dataset.k !== k; });
    syncVideo();
  };
  const syncVideo = () => {
    const f = form.file.files[0]; const isVid = (f && f.type.startsWith('video/')) || (form.dataset.kind === 'link' && /youtu|vimeo|loom/i.test(form.url.value));
    form.querySelector('[data-k=vid]').hidden = !isVid;
  };
  document.querySelectorAll('#kindTabs button').forEach((b) => b.onclick = () => show(b.dataset.k));
  form.file.onchange = syncVideo; form.url.oninput = syncVideo;
  show('text');
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form); const kind = form.dataset.kind;
    if (kind !== 'file') fd.delete('file'); else fd.delete('url');
    fd.set('kind', kind);
    busy(form.querySelector('button'), 'Reading it…', async () => {
      const r = await api('POST', '/api/sources', fd);
      toast(r.empty ? 'Added. Open it to add text/transcript before generating.' : 'Source added.'); sourcesPage();
    });
  };
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (confirm('Delete this source? Existing lessons keep their text.')) { await api('DELETE', `/api/sources/${b.dataset.del}`); sourcesPage(); }
  });
  const gen = document.getElementById('gen');
  if (gen) gen.onclick = () => {
    const ids = [...document.querySelectorAll('.pick:checked')].map((c) => Number(c.value));
    if (!ids.length) return toast('Tick at least one source.');
    busy(gen, 'AI is writing every lesson & quiz. Long documents take several minutes, keep this tab open…', async () => {
      const r = await api('POST', '/api/modules/generate', { source_ids: ids, guidance: document.getElementById('guidance').value });
      location.hash = `#/manage/module/${r.id}`;
    });
  };
}

async function sourceEditPage(id) {
  const s = await api('GET', `/api/sources/${id}`);
  shell(`<a href="#/manage/sources" class="small">← Sources</a><h1>Edit source</h1>
    <div class="card"><label>Title</label><input type="text" id="t" value="${esc(s.title)}">
      ${s.type === 'video' ? videoEmbed(s.url, s.file_name) : ''}${s.type === 'image' && s.file_name ? `<img src="/files/${esc(s.file_name)}" alt="" style="max-width:300px;border-radius:10px;margin-top:.5rem">` : ''}
      <label>Text the AI works from ${s.type === 'image' ? '(AI-read from the image – fix anything it got wrong)' : s.type === 'video' ? '(transcript)' : ''}</label>
      <textarea id="c" style="min-height:18rem">${esc(s.content)}</textarea>
      <label class="inline" style="margin-top:.75rem"><input type="checkbox" id="v" ${s.staff_visible ? 'checked' : ''}> Staff can search and read this original document</label>
      <p><button class="btn" id="save">Save</button></p></div>`, 'sources');
  const save = document.getElementById('save');
  save.onclick = () => busy(save, 'Saving…', async () => {
    await api('PATCH', `/api/sources/${id}`, { title: document.getElementById('t').value, content: document.getElementById('c').value, staff_visible: document.getElementById('v').checked });
    toast('Saved.');
  });
}

// ----- leadership: modules -----
async function modulesPage() {
  const mods = await api('GET', '/api/modules');
  shell(`<div class="row between"><h1>Modules</h1><a class="btn" href="#/manage/sources">+ New from sources</a></div>
    ${mods.map((m) => `<div class="card row between"><div><b>${esc(m.title)}</b> <span class="pill ${m.status === 'published' ? 'ok' : 'warn'}">${m.status}</span>${m.required ? ' <span class="pill bad">Required</span>' : ''}<br><span class="small muted">${m.lesson_count} lessons · ${m.question_count} questions</span></div>
      <span class="row"><a class="btn alt sm" href="#/manage/module/${m.id}">Review / edit</a></span></div>`).join('') || '<p class="muted">No modules yet. Add sources, then generate one.</p>'}`, 'modules');
}

async function moduleEditPage(id) {
  const [m, allSources] = await Promise.all([api('GET', `/api/modules/${id}`), api('GET', '/api/sources')]);
  const mediaSources = allSources.filter((s) => s.type === 'image' || s.type === 'video');
  const srcTitle = (sid) => allSources.find((s) => s.id === sid)?.title || `Source ${sid}`;
  let d = {
    title: m.title, summary: m.summary, required: !!m.required,
    lessons: m.lessons.map((l) => ({
      ...l, scenario: l.scenario || { situation: '', response: '', why: '' },
      media: (l.media || []).map((x) => ({ source_id: x.source_id, caption: x.caption || '' })),
    })),
    questions: m.questions.map((q) => ({ ...q, kind: q.kind || 'final' })),
  };
  const $ = (s) => document.querySelector(s);

  const sync = () => { // copy the form's current values back into `d`
    d.title = $('#mt').value; d.summary = $('#ms').value; d.required = $('#mr').checked;
    const val = (sel) => document.querySelector(sel)?.value ?? ''; // removed sections have no field on the page
    d.lessons.forEach((l, i) => {
      l.title = val(`#lt${i}`); l.body = val(`#lb${i}`);
      l.key_points = val(`#lk${i}`).split('\n').map((s) => s.trim()).filter(Boolean);
      l.steps = val(`#ls${i}`).split('\n').map((s) => s.trim().replace(/^\d+[.)]\s*/, '')).filter(Boolean);
      l.scenario = { situation: val(`#ss${i}`), response: val(`#sr${i}`), why: val(`#sw${i}`) };
      l.media.forEach((x, k) => { x.caption = val(`#mc${i}_${k}`); });
    });
    d.questions.forEach((q, i) => {
      q.prompt = $(`#qp${i}`).value; q.explanation = $(`#qe${i}`).value; q.kind = $(`#qk${i}`).value;
      q.options = q.options.map((_, oi) => $(`#qo${i}_${oi}`).value);
      const c = document.querySelector(`input[name=qa${i}]:checked`); if (c) q.answer_index = Number(c.value);
      q.lesson_position = Number($(`#ql${i}`).value) || null;
    });
  };

  // An optional part of a lesson. Removing it hides it for learners and tells the AI not to add it back.
  const sec = (l, i, key, title, hint, inner) => ((l.removed || []).includes(key)
    ? `<div class="row between sec-row"><span class="muted"><b>${title}</b> removed</span><button class="btn alt sm" data-addsec="${i},${key}">+ Add ${title.toLowerCase()}</button></div>`
    : `<div class="sec"><div class="row between"><label style="margin:.9rem 0 .25rem">${title} <span class="muted">${hint}</span></label>
        <button class="btn danger sm" data-rmsec="${i},${key}">Remove section</button></div>${inner}</div>`);

  const questionBox = (q, i) => `<div class="editor-box"><div class="row between"><b>Question ${i + 1}</b><button class="btn danger sm" data-dq="${i}">Remove</button></div>
    <div class="row"><div style="flex:1;min-width:180px"><label>Where it appears</label>
      <select id="qk${i}"><option value="check" ${q.kind === 'check' ? 'selected' : ''}>Quick check (inside the lesson)</option><option value="final" ${q.kind !== 'check' ? 'selected' : ''}>Final assessment</option></select></div>
      <div><label>Tests lesson #</label><input type="text" id="ql${i}" value="${q.lesson_position ?? ''}" style="width:5rem"></div></div>
    <label>Question</label><input type="text" id="qp${i}" value="${esc(q.prompt)}">
    <label>Answers (select the correct one; use as many as you need, from 2 to 6)</label>
    ${q.options.map((o, oi) => `<div class="opt-edit"><input type="radio" name="qa${i}" value="${oi}" ${q.answer_index === oi ? 'checked' : ''} aria-label="Correct answer">
      <input type="text" id="qo${i}_${oi}" value="${esc(o)}" placeholder="Answer ${oi + 1}">
      <button class="btn danger sm" data-rmo="${i},${oi}" ${q.options.length <= 2 ? 'disabled title="A question needs at least 2 answers"' : 'title="Delete this answer"'} aria-label="Delete answer ${oi + 1}">✕</button></div>`).join('')}
    <div class="row" style="margin:.35rem 0">
      <button class="btn alt sm" data-addo="${i}" ${q.options.length >= 6 ? 'disabled' : ''}>+ Add answer</button>
      <button class="btn alt sm" data-tf="${i}" title="Replace the answers with True / False">Make True / False</button></div>
    <label>Why it's right</label><input type="text" id="qe${i}" value="${esc(q.explanation || '')}"></div>`;

  const draw = () => {
    const finalCount = d.questions.filter((q) => q.kind !== 'check').length;
    shell(`<a href="#/manage/modules" class="small">← Modules</a>
      <div class="row between"><h1>Review module</h1><span class="pill ${m.status === 'published' ? 'ok' : 'warn'}">${m.status}</span></div>
      ${m.review_notes ? `<div class="notice"><b>AI notes for you to verify:</b> ${esc(m.review_notes).replace(/\n/g, '<br>')}</div>` : ''}
      <p class="muted">Check everything for accuracy before publishing. Staff only see published modules.</p>
      ${aiWarning(true)}
      ${(() => {
        const gone = (l, k) => (l.removed || []).includes(k); // sections you removed on purpose aren't "missing"
        const noScenario = d.lessons.filter((l) => !gone(l, 'scenario') && !(l.scenario.situation || l.scenario.response)).length;
        const noChecks = d.lessons.filter((l, i) => !gone(l, 'checks') && !d.questions.some((q) => q.kind === 'check' && q.lesson_position === i + 1)).length;
        const noSteps = d.lessons.filter((l) => !gone(l, 'steps') && !(l.steps || []).length).length;
        if (!noScenario && !noChecks && !noSteps) return '';
        return `<div class="card"><h3>Missing parts</h3>
          <p class="muted small" style="margin:.25rem 0 .75rem">${noScenario} lesson(s) without a scenario · ${noChecks} without quick checks · ${noSteps} without a step list.
          The AI can draft these from your lessons. It won't rewrite the lesson text you've already reviewed, and step lists are only added to lessons that are procedures.</p>
          <button class="btn" id="draftParts">✨ Draft missing parts with AI</button></div>`;
      })()}
      ${m.repeats ? `<div class="card"><h3>Repeated content</h3>
        <p class="muted small" style="margin:.25rem 0 .75rem">${m.repeats} lesson(s) repeat information that's already in their step list or scenario. The tool removes the repeated lines from the lesson text and rewrites scenarios so they apply the steps instead of re-listing them. Nothing is removed unless it's already shown elsewhere in the lesson.</p>
        <button class="btn alt" id="dedupe">Remove repeats</button></div>` : ''}
      <div class="card"><label>Title</label><input type="text" id="mt" value="${esc(d.title)}">
        <label>One-line summary</label><input type="text" id="ms" value="${esc(d.summary)}">
        <label class="inline" style="margin-top:.75rem"><input type="checkbox" id="mr" ${d.required ? 'checked' : ''}> Required training</label></div>
      <h2>Lessons</h2>
      ${d.lessons.map((l, i) => `<div class="editor-box"><div class="row between"><b>Lesson ${i + 1}</b><span class="row">
          <button class="btn alt sm" data-mv="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn alt sm" data-mv="${i}" data-dir="1" ${i === d.lessons.length - 1 ? 'disabled' : ''}>↓</button><button class="btn danger sm" data-dl="${i}">Remove</button></span></div>
        <label>Title</label><input type="text" id="lt${i}" value="${esc(l.title)}">
        <label>Lesson text (use "- " for bullets, **bold** for key terms)</label><textarea id="lb${i}" style="min-height:9rem">${esc(l.body)}</textarea>
        ${sec(l, i, 'key_points', 'Key points', '(one per line)', `<textarea id="lk${i}" style="min-height:4rem">${esc(l.key_points.join('\n'))}</textarea>`)}
        ${sec(l, i, 'steps', 'Step-by-step procedure', '(one step per line, in order)', `<textarea id="ls${i}" style="min-height:6rem">${esc((l.steps || []).join('\n'))}</textarea>`)}
        ${sec(l, i, 'scenario', 'Realistic scenario', '', `
          <textarea id="ss${i}" placeholder="The situation, e.g. A patient arrives and …" style="min-height:4rem">${esc(l.scenario.situation)}</textarea>
          <textarea id="sr${i}" placeholder="What the employee should do" style="min-height:4rem;margin-top:.4rem">${esc(l.scenario.response)}</textarea>
          <input type="text" id="sw${i}" placeholder="Why (optional)" value="${esc(l.scenario.why)}" style="margin-top:.4rem">`)}
        ${sec(l, i, 'media', 'Photos &amp; videos', '', `
          ${l.media.map((x, k) => `<div class="opt-edit"><span class="pill">${esc(srcTitle(x.source_id))}</span>
            <input type="text" id="mc${i}_${k}" value="${esc(x.caption)}" placeholder="Caption (optional)">
            <button class="btn danger sm" data-rmm="${i},${k}">Remove</button></div>`).join('') || '<p class="small muted" style="margin:0">None attached.</p>'}
          ${mediaSources.length ? `<div class="opt-edit"><select id="ma${i}">${mediaSources.map((s) => `<option value="${s.id}">${esc(s.title)} (${s.type})</option>`).join('')}</select>
            <button class="btn alt sm" data-addm="${i}">Attach</button></div>`
            : '<p class="small muted">Add photos or videos on the <a href="#/manage/sources">Sources</a> page, then attach them here.</p>'}`)}
        <div class="row between sec-row"><span><b>Quick checks</b> <span class="muted small">${d.questions.filter((q) => q.kind === 'check' && q.lesson_position === i + 1).length} question(s), edited under Questions below</span></span>
          ${(l.removed || []).includes('checks')
            ? `<button class="btn alt sm" data-addsec="${i},checks">+ Add quick check</button>`
            : `<button class="btn danger sm" data-rmsec="${i},checks">Remove section</button>`}</div></div>`).join('')}
      <button class="btn alt" id="addL">+ Add lesson</button>
      <h2>Questions</h2>
      <p class="muted small">Quick checks appear inside each lesson (learners retry until correct). Final assessment questions make up the graded test (${finalCount} now, pass mark 80%).</p>
      ${d.questions.map(questionBox).join('')}
      <button class="btn alt" id="addQ">+ Add question</button>
      <div class="row" style="margin-top:1.5rem"><button class="btn" id="save">Save changes</button>
        <button class="btn alt" id="pub">${m.status === 'published' ? 'Unpublish' : 'Save & publish to staff'}</button>
        <a class="btn alt" href="#/module/${m.id}">Preview as learner</a>
        <button class="btn danger" id="del">Delete module</button></div>
      <h2>Edit history</h2><div class="card" id="hist"><span class="spinner"></span></div>`, 'modules');

    document.querySelectorAll('[data-dl]').forEach((b) => b.onclick = () => { sync(); d.lessons.splice(Number(b.dataset.dl), 1); draw(); });
    document.querySelectorAll('[data-dq]').forEach((b) => b.onclick = () => { sync(); d.questions.splice(Number(b.dataset.dq), 1); draw(); });
    document.querySelectorAll('[data-mv]').forEach((b) => b.onclick = () => {
      sync(); const i = Number(b.dataset.mv), j = i + Number(b.dataset.dir); [d.lessons[i], d.lessons[j]] = [d.lessons[j], d.lessons[i]]; draw();
    });
    document.querySelectorAll('[data-rmm]').forEach((b) => b.onclick = () => {
      sync(); const [i, k] = b.dataset.rmm.split(',').map(Number); d.lessons[i].media.splice(k, 1); draw();
    });
    document.querySelectorAll('[data-addm]').forEach((b) => b.onclick = () => {
      sync(); const i = Number(b.dataset.addm); d.lessons[i].media.push({ source_id: Number($(`#ma${i}`).value), caption: '' }); draw();
    });
    // remove / re-add an optional lesson section
    document.querySelectorAll('[data-rmsec]').forEach((b) => b.onclick = () => {
      sync();
      const [i, key] = b.dataset.rmsec.split(','); const l = d.lessons[Number(i)];
      const checks = d.questions.filter((q) => q.kind === 'check' && q.lesson_position === Number(i) + 1);
      const hasContent = { key_points: l.key_points.length, steps: l.steps.length, media: l.media.length,
        scenario: l.scenario.situation || l.scenario.response || l.scenario.why, checks: checks.length }[key];
      if (hasContent && !confirm('Remove this section from the lesson? Learners will no longer see it. (You can undo this from Edit history.)')) return;
      if (key === 'key_points') l.key_points = [];
      if (key === 'steps') l.steps = [];
      if (key === 'media') l.media = [];
      if (key === 'scenario') l.scenario = { situation: '', response: '', why: '' };
      if (key === 'checks') d.questions = d.questions.filter((q) => !checks.includes(q));
      l.removed = [...new Set([...(l.removed || []), key])];
      draw();
    });
    document.querySelectorAll('[data-addsec]').forEach((b) => b.onclick = () => {
      sync();
      const [i, key] = b.dataset.addsec.split(','); const l = d.lessons[Number(i)];
      l.removed = (l.removed || []).filter((k) => k !== key);
      if (key === 'checks') d.questions.push({ kind: 'check', prompt: '', options: ['', ''], answer_index: 0, explanation: '', lesson_position: Number(i) + 1 });
      draw();
    });
    // flexible answer options (2 to 6)
    document.querySelectorAll('[data-rmo]').forEach((b) => b.onclick = () => {
      sync();
      const [i, oi] = b.dataset.rmo.split(',').map(Number); const q = d.questions[i];
      if (q.options.length <= 2) return;
      q.options.splice(oi, 1);
      if (q.answer_index === oi) { q.answer_index = 0; toast('You removed the correct answer. Pick the right one again.'); }
      else if (q.answer_index > oi) q.answer_index -= 1;
      draw();
    });
    document.querySelectorAll('[data-addo]').forEach((b) => b.onclick = () => {
      sync(); const q = d.questions[Number(b.dataset.addo)];
      if (q.options.length < 6) q.options.push('');
      draw();
    });
    document.querySelectorAll('[data-tf]').forEach((b) => b.onclick = () => {
      sync(); const q = d.questions[Number(b.dataset.tf)];
      q.options = ['True', 'False']; q.answer_index = 0; draw();
    });
    $('#addL').onclick = () => {
      sync(); d.lessons.push({ title: 'New lesson', body: '', key_points: [], steps: [], scenario: { situation: '', response: '', why: '' }, media: [], source_id: null }); draw();
    };
    $('#addQ').onclick = () => {
      sync(); d.questions.push({ kind: 'final', prompt: '', options: ['', '', ''], answer_index: 0, explanation: '', lesson_position: 1 }); draw();
    };
    const persist = async () => { sync(); await api('PUT', `/api/modules/${m.id}`, d); };
    $('#save').onclick = (e) => busy(e.currentTarget, 'Saving…', async () => { await persist(); toast('Saved.'); moduleEditPage(id); });
    $('#pub').onclick = (e) => busy(e.currentTarget, 'Working…', async () => {
      await persist();
      await api('POST', `/api/modules/${m.id}/publish`, { publish: m.status !== 'published' });
      toast(m.status === 'published' ? 'Unpublished.' : 'Published – your team can see it now.'); moduleEditPage(id);
    });
    const dedupeBtn = $('#dedupe');
    if (dedupeBtn) dedupeBtn.onclick = () => busy(dedupeBtn, 'Removing repeats…', async () => {
      await persist();
      const r = await api('POST', `/api/modules/${m.id}/remove-repeats`);
      toast(`Tidied ${r.lessons_cleaned} lesson(s), rewrote ${r.scenarios_rewritten} scenario(s).${r.notes.length ? ` ${r.notes.join(' ')}` : ''}`);
      moduleEditPage(id);
    });
    const draftBtn = $('#draftParts');
    if (draftBtn) draftBtn.onclick = () => busy(draftBtn, 'AI is drafting (a few minutes, keep this tab open)…', async () => {
      await persist(); // keep any edits you've made
      const r = await api('POST', `/api/modules/${m.id}/draft-parts`);
      const a = r.added;
      toast(`Added ${a.steps} step list(s), ${a.scenarios} scenario(s), ${a.checks} quick check(s), ${a.finals} final question(s). Review them below.`);
      moduleEditPage(id);
    });
    $('#del').onclick = async () => { if (confirm('Delete this module and all progress on it?')) { await api('DELETE', `/api/modules/${m.id}`); location.hash = '#/manage/modules'; } };

    api('GET', `/api/modules/${m.id}/versions`).then((vs) => {
      const when = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString();
      $('#hist').innerHTML = vs.length ? `<table>${vs.map((v, i) => `<tr><td><b>${esc(v.action)}</b><br><span class="small muted">${esc(when(v.created_at))}</span></td>
        <td>${esc(v.summary)}<br><span class="small muted">${v.user_name ? `by ${esc(v.user_name)}` : ''}</span></td>
        <td>${i === 0 ? '<span class="pill">Current</span>' : `<button class="btn alt sm" data-rs="${v.id}">Restore</button>`}</td></tr>`).join('')}</table>
        <p class="small muted">Restoring brings back the lessons and quiz from that point (your current version is saved in history first, so nothing is lost).</p>`
        : '<p class="muted">No history yet. Versions are saved each time you save, publish or restore.</p>';
      document.querySelectorAll('[data-rs]').forEach((b) => b.onclick = async () => {
        if (!confirm('Restore this version? Staff will see it immediately if the module is published.')) return;
        try { await api('POST', `/api/modules/${m.id}/restore`, { version_id: Number(b.dataset.rs) }); toast('Restored.'); moduleEditPage(id); } catch (e) { toast(e.message); }
      });
    }).catch(() => { $('#hist').textContent = 'Could not load history.'; });
  };
  draw();
}

// ----- leadership: team -----
async function teamPage() {
  const users = await api('GET', '/api/users');
  shell(`<h1>Team</h1><p class="muted">Create an account for each team member and give them their temporary password.</p>
    <div class="card"><h3>Add team member</h3><form id="uForm">
      <div class="grid" style="gap:.5rem"><div><label>Name</label><input type="text" name="name" required></div><div><label>Email</label><input type="email" name="email" required></div>
      <div><label>Temporary password (8+)</label><input type="text" name="password" required minlength="8"></div>
      ${status.user.role === 'owner' ? '<div><label>Role</label><select name="role"><option value="staff">Staff (takes training)</option><option value="manager">Manager (builds training, adds staff)</option><option value="owner">Co-owner (same as owner, can also add managers)</option></select></div>' : ''}</div>
      <p><button class="btn">Add</button></p></form></div>
    <div class="card scroll"><table><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
      ${users.map((u) => {
        const canManage = u.id !== status.user.id && (u.role === 'staff' || status.user.role === 'owner');
        return `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${canManage
          ? `<button class="btn alt sm" data-reset="${u.id}" data-name="${esc(u.name)}">Reset password</button> <button class="btn danger sm" data-rm="${u.id}">Remove</button>` : ''}</td></tr>`;
      }).join('')}</table></div>
    ${status.user.role === 'owner' && !status.demo ? `<div class="card"><h3>Backup</h3>
      <p class="muted small" style="margin:.25rem 0 .6rem">Download a copy of all accounts, modules and progress. Keep it somewhere safe. (Uploaded photos and videos are not included.)</p>
      <a class="btn alt" href="/api/backup" download>Download backup</a></div>` : ''}`, 'team');
  document.querySelectorAll('[data-reset]').forEach((b) => b.onclick = async () => {
    const pw = prompt(`Type a new temporary password for ${b.dataset.name} (8+ characters). They'll be signed out everywhere and can change it under Account.`);
    if (!pw) return;
    try { await api('POST', `/api/users/${b.dataset.reset}/password`, { password: pw }); toast('Password reset. Give them the new one.'); } catch (e) { toast(e.message); }
  });
  document.getElementById('uForm').onsubmit = (e) => {
    e.preventDefault();
    busy(e.target.querySelector('button'), 'Adding…', async () => { await api('POST', '/api/users', Object.fromEntries(new FormData(e.target))); toast('Added.'); teamPage(); });
  };
  document.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    if (confirm('Remove this person and their progress?')) { try { await api('DELETE', `/api/users/${b.dataset.rm}`); teamPage(); } catch (e) { toast(e.message); } }
  });
}

// ----- account (change own password) -----
async function accountPage() {
  shell(`<h1>Your account</h1><p class="muted">${esc(status.user.name)} · ${esc(status.user.email)}</p>
    <div class="card"><h3>Change password</h3>
      ${status.demo ? '<p class="muted">Password changes are turned off in the public demo.</p>' : `<form id="pwForm">
        <label>Current password</label><input type="password" name="current" required autocomplete="current-password">
        <label>New password (8+ characters)</label><input type="password" name="next" required minlength="8" autocomplete="new-password">
        <label>Type the new password again</label><input type="password" name="again" required minlength="8" autocomplete="new-password">
        <p><button class="btn">Change password</button></p>
        <p class="small muted">You'll stay signed in here and be signed out on other devices.</p></form>`}</div>`);
  const f = document.getElementById('pwForm');
  if (f) f.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    if (fd.get('next') !== fd.get('again')) return toast("The new passwords don't match.");
    busy(f.querySelector('button'), 'Saving…', async () => {
      await api('POST', '/api/password', { current: fd.get('current'), next: fd.get('next') });
      f.reset(); toast('Password changed.');
    });
  };
}

// ---------- router ----------
async function route() {
  if (!status.user) return authScreen();
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  const seg = path.split('/').filter(Boolean);
  try {
    if (!seg.length) return await homePage();
    if (seg[0] === 'library') return await libraryPage();
    if (seg[0] === 'account') return await accountPage();
    if (seg[0] === 'ask') return await askPage(query);
    if (seg[0] === 'module') return await modulePage(seg[1], query);
    if (seg[0] === 'source') return await sourceViewPage(seg[1]);
    if (seg[0] === 'manage' && isLeader()) {
      if (seg[1] === 'sources') return await sourcesPage();
      if (seg[1] === 'source') return await sourceEditPage(seg[2]);
      if (seg[1] === 'modules') return await modulesPage();
      if (seg[1] === 'module') return await moduleEditPage(seg[2]);
      if (seg[1] === 'team') return await teamPage();
    }
    location.hash = '#/';
  } catch (e) {
    shell(`<div class="notice">${esc(e.message)}</div><p><a href="#/">Go home</a></p>`);
  }
}

async function boot() {
  status = await fetch('/api/status').then((r) => r.json());
  await route();
}
window.addEventListener('hashchange', () => status && route());
boot();

// Lets phones and desktops "install" the site like an app (Add to Home Screen / Install).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
