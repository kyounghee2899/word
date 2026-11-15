/* 브레인 루틴 — 화면·루틴·기록·선생님 메뉴 */
(function () {
  'use strict';
  const { list: GAMES, byId: GAME, DOMAINS, h } = window.BR_GAMES;
  const KEY = 'brainRoutine.v1';
  const $app = document.getElementById('app');

  /* ---------- 저장 ---------- */
  const blank = () => ({ v: 1, profiles: [], cur: null, settings: { sound: true, voice: false, pin: '0000', academy: '' } });
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { S = blank(); }
  S.settings = Object.assign(blank().settings, S.settings || {});
  let storageOk = true;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; } }

  /* ---------- 날짜 ---------- */
  const pad2 = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return ymd(x); };
  const WK = ['일', '월', '화', '수', '목', '금', '토'];
  const md = s => { const [y, m, d] = s.split('-').map(Number); return `${m}/${d}(${WK[new Date(y, m - 1, d).getDay()]})`; };

  /* ---------- 학생 ---------- */
  const uid = () => Math.random().toString(36).slice(2, 9);
  const cur = () => S.profiles.find(p => p.id === S.cur) || null;
  function newProfile(name, grade) {
    const p = { id: uid(), name, grade, created: today(), size: 4, exclude: [], games: {}, sessions: [], days: {} };
    S.profiles.push(p); S.cur = p.id; save(); return p;
  }
  const gst = (p, gid) => p.games[gid] || (p.games[gid] = { level: 1 });

  /* ---------- 루틴 짜기 ----------
   * 매일: 처리속도 1 + 작업기억 1 + 실행기능 1 (+ 4·5번째는 실행기능·작업기억에서 추가)
   * 연습한 날 수를 기준으로 돌아가며 골라 일주일이면 모든 활동을 한 번 이상 만납니다. */
  function pool(p, d) { return GAMES.filter(g => g.domain === d && !p.exclude.includes(g.id)).map(g => g.id); }
  function computePlan(p) {
    const n = Object.keys(p.days).filter(k => k !== today() && (p.days[k].done || []).length).length;
    const ps = pool(p, 'ps'), wm = pool(p, 'wm'), ef = pool(p, 'ef');
    const plan = [];
    const take = (arr, i) => { if (!arr.length) return; const pickd = arr.filter(x => !plan.includes(x)); if (pickd.length) plan.push(pickd[i % pickd.length]); };
    take(ps, n); take(wm, n); take(ef, n);
    if (p.size >= 4) take(n % 2 ? wm : ef, n + 2);
    if (p.size >= 5) take(n % 2 ? ef : wm, n + 1);
    if (p.size >= 4 && plan.length < p.size) take(ps, n + 1);
    return plan;
  }
  function todayRec(p) {
    const t = today();
    if (!p.days[t]) p.days[t] = { plan: computePlan(p), done: [] };
    if (!p.days[t].plan || !p.days[t].plan.length) p.days[t].plan = computePlan(p);
    return p.days[t];
  }
  const isComplete = r => r && r.plan && r.plan.length && r.plan.every(g => (r.done || []).includes(g));
  function streak(p) {
    let d = today(), n = 0;
    if (!isComplete(p.days[d])) d = addDays(d, -1);
    while (isComplete(p.days[d])) { n++; d = addDays(d, -1); }
    return n;
  }
  function domainLevel(p, dom) {
    const gs = GAMES.filter(g => g.domain === dom && p.games[g.id] && p.sessions.some(s => s.g === g.id));
    if (!gs.length) return null;
    return Math.round(gs.reduce((a, g) => a + p.games[g.id].level / g.max * 10, 0) / gs.length * 10) / 10;
  }
  function domainLevelAt(p, dom, dateExcl) {
    // dateExcl 이전까지의 기록으로 계산한 수준
    const gs = GAMES.filter(g => g.domain === dom);
    const vals = [];
    gs.forEach(g => {
      const ss = p.sessions.filter(s => s.g === g.id && s.d < dateExcl);
      if (ss.length) vals.push(ss[ss.length - 1].lv / g.max * 10);
    });
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
  }

  /* ---------- 소리 ---------- */
  let AC = null;
  function tone(freq, dur, type, vol, slide) {
    if (!S.settings.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 소리 없이 진행 */ }
  }
  const sfx = {
    ok: () => tone(880, 0.12, 'sine', 0.1, 1320),
    bad: () => tone(220, 0.2, 'triangle', 0.12, 160),
    blip: () => tone(660, 0.07, 'sine', 0.07),
    miss: () => tone(330, 0.12, 'sine', 0.06),
    fan: () => { tone(523, 0.15, 'sine', 0.1); setTimeout(() => tone(659, 0.15, 'sine', 0.1), 120); setTimeout(() => tone(784, 0.3, 'sine', 0.1), 240); }
  };
  function speak(t) {
    if (!S.settings.voice || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { }
  }

  /* ---------- 공용 UI ---------- */
  let view = 'home';
  function nav() {
    const items = [['home', '🏠', '오늘'], ['free', '🧩', '자유 연습'], ['records', '📈', '기록'], ['teacher', '👩‍🏫', '선생님'], ['guide', '📘', '안내']];
    return h('nav', { class: 'tabs' }, items.map(([v, ic, t]) => h('button', { class: view === v ? 'on' : '', onclick: () => go(v) }, h('span', null, ic), t)));
  }
  function shell(...kids) {
    $app.replaceChildren(h('div', { class: 'page' }, ...kids), nav());
    window.scrollTo(0, 0);
  }
  function go(v) {
    if (v === 'teacher' && !teacherOpen) return askPin();
    view = v; ({ home, free, records, teacher, guide })[v]();
  }
  const domChip = d => h('span', { class: 'dchip ' + d }, DOMAINS[d].name);
  function lvBar(val, dom) {
    return h('div', { class: 'lvbar' }, h('i', { class: dom, style: `width:${val == null ? 0 : val * 10}%` }));
  }
  function toast(t) { const el = h('div', { class: 'toast' }, t); document.body.append(el); setTimeout(() => el.classList.add('on'), 10); setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 300); }, 2200); }
  function modal(title, body, actions) {
    const bg = h('div', { class: 'modal-bg' });
    const close = () => bg.remove();
    bg.append(h('div', { class: 'modal' }, h('h3', null, title), body, h('div', { class: 'row end' }, (actions || [['닫기', null]]).map(([t, fn, cls]) => h('button', { class: 'btn ' + (cls || 'ghost'), onclick: () => { if (!fn || fn() !== false) close(); } }, t)))));
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.body.append(bg);
    return bg;
  }

  /* ---------- 처음 화면: 학생 등록 ---------- */
  function onboarding() {
    const name = h('input', { class: 'inp', placeholder: '이름', maxlength: 12 });
    const grade = h('select', { class: 'inp' }, ['7세', '초1', '초2', '초3', '초4', '초5', '초6', '중1 이상'].map(g => h('option', { value: g, ...(g === '초3' ? { selected: '' } : {}) }, g)));
    const add = () => { const n = name.value.trim(); if (!n) { name.focus(); return; } newProfile(n, grade.value); go('home'); };
    name.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    shell(
      h('header', { class: 'hero' }, h('div', { class: 'logo' }, '🧠'), h('h1', null, '브레인 루틴'), h('p', null, '하루 10분, 처리속도 · 작업기억 · 실행기능')),
      h('section', { class: 'card' },
        h('h2', null, '누가 연습하나요?'),
        h('p', { class: 'muted' }, '한 기기에 여러 학생을 등록할 수 있어요. 기록은 이 기기에만 저장됩니다.'),
        h('div', { class: 'form' }, name, grade, h('button', { class: 'btn', onclick: add }, '시작하기'))),
      h('section', { class: 'card three' }, ['ps', 'wm', 'ef'].map(d => h('div', { class: 'mini ' + d }, h('b', null, DOMAINS[d].name), h('span', null, DOMAINS[d].desc)))));
    setTimeout(() => name.focus(), 50);
  }

  /* ---------- 오늘 ---------- */
  function home() {
    view = 'home';
    const p = cur();
    if (!p) return onboarding();
    const r = todayRec(p); save();
    const doneN = r.plan.filter(g => r.done.includes(g)).length, total = r.plan.length;
    const nextG = r.plan.find(g => !r.done.includes(g));
    const st = streak(p);
    const pct = total ? doneN / total : 0;
    const ring = h('div', { class: 'ring', style: `--p:${pct * 360}deg` }, h('div', null, h('b', null, `${doneN}/${total}`), h('small', null, '오늘')));
    const profileBar = h('div', { class: 'who' },
      S.profiles.map(q => h('button', { class: 'who-chip' + (q.id === p.id ? ' on' : ''), onclick: () => { S.cur = q.id; save(); home(); } }, q.name)),
      h('button', { class: 'who-chip add', onclick: addStudentModal }, '+ 학생'));
    const steps = h('ol', { class: 'steps' }, r.plan.map((gid, i) => {
      const g = GAME[gid], done = r.done.includes(gid), lv = gst(p, gid).level;
      return h('li', { class: 'step' + (done ? ' done' : '') + (gid === nextG ? ' next' : ''), onclick: () => intro(gid, true) },
        h('span', { class: 'step-n' }, done ? '✓' : String(i + 1)),
        h('span', { class: 'step-ic' }, g.icon),
        h('span', { class: 'step-tx' }, h('b', null, g.name), h('small', null, g.short)),
        h('span', { class: 'step-side' }, domChip(g.domain), h('small', null, `Lv.${lv}`)));
    }));
    const allDone = isComplete(r);
    shell(
      h('header', { class: 'top' }, h('div', null, h('h1', null, `${p.name}의 브레인 루틴`), h('p', { class: 'muted' }, `${md(today())} · ${p.grade}`)), h('button', { class: 'icon-btn', title: '소리', onclick: () => { S.settings.sound = !S.settings.sound; save(); home(); } }, S.settings.sound ? '🔊' : '🔇')),
      profileBar,
      h('section', { class: 'card today' },
        h('div', { class: 'today-head' }, ring,
          h('div', { class: 'today-info' },
            h('div', { class: 'streak' }, '🔥 ', h('b', null, `${st}일`), ' 연속'),
            h('p', null, allDone ? '오늘 루틴 완료! 내일 또 만나요.' : doneN ? `좋아요! ${total - doneN}개 남았어요.` : `오늘의 활동 ${total}개 · 약 ${Math.max(6, total * 2 + 2)}분`),
            !allDone && nextG ? h('button', { class: 'btn big', onclick: () => intro(nextG, true) }, doneN ? '이어서 하기 ▶' : '오늘 루틴 시작 ▶') : h('button', { class: 'btn ghost', onclick: () => go('free') }, '더 연습하기'))),
        steps),
      week(p),
      h('section', { class: 'card' }, h('h2', null, '나의 두뇌 힘'),
        h('div', { class: 'doms' }, ['ps', 'wm', 'ef'].map(d => { const v = domainLevel(p, d); return h('div', { class: 'dom' }, h('div', { class: 'dom-h' }, domChip(d), h('b', null, v == null ? '—' : v.toFixed(1))), lvBar(v, d), h('small', { class: 'muted' }, DOMAINS[d].desc)); })),
        h('p', { class: 'muted small' }, '10점 만점 · 각 활동의 현재 레벨을 영역별로 평균한 값이에요.')),
      installCard(),
      storageOk ? null : h('p', { class: 'warn' }, '⚠ 이 브라우저에서는 기록이 저장되지 않아요(사생활 보호 모드 등). 일반 창에서 열어 주세요.'));
  }
  function week(p) {
    const t = today(); const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(t, -i));
    return h('section', { class: 'card week' }, days.map(d => {
      const r = p.days[d], c = isComplete(r), part = r && (r.done || []).length && !c;
      const [y, m, dd] = d.split('-').map(Number);
      return h('div', { class: 'wd' + (d === t ? ' today' : '') }, h('small', null, WK[new Date(y, m - 1, dd).getDay()]), h('span', { class: 'dot' + (c ? ' full' : part ? ' half' : '') }, c ? '★' : part ? '·' : ''), h('small', null, String(dd)));
    }));
  }
  function addStudentModal() {
    const name = h('input', { class: 'inp', placeholder: '이름', maxlength: 12 });
    const grade = h('select', { class: 'inp' }, ['7세', '초1', '초2', '초3', '초4', '초5', '초6', '중1 이상'].map(g => h('option', { value: g, ...(g === '초3' ? { selected: '' } : {}) }, g)));
    modal('학생 추가', h('div', { class: 'form' }, name, grade), [['취소', null], ['추가', () => { const n = name.value.trim(); if (!n) return false; newProfile(n, grade.value); view === 'teacher' ? teacher() : home(); }, 'pri']]);
    setTimeout(() => name.focus(), 50);
  }

  /* ---------- 활동 설명 ---------- */
  function intro(gid, fromRoutine) {
    const g = GAME[gid], p = cur(), st = gst(p, gid);
    const last = p.sessions.filter(s => s.g === gid).slice(-1)[0];
    $app.replaceChildren(h('div', { class: 'page intro' },
      h('button', { class: 'back', onclick: () => go(view) }, '← 돌아가기'),
      h('div', { class: 'intro-hero ' + g.domain }, h('div', { class: 'big-ic' }, g.icon), h('h1', null, g.name), h('div', { class: 'row' }, domChip(g.domain), h('span', { class: 'lvchip' }, `Lv.${st.level} / ${g.max}`))),
      h('section', { class: 'card' }, h('h2', null, '이렇게 해요'), h('ol', { class: 'how' }, g.how.map(x => h('li', { html: x }))),
        g.note ? h('p', { class: 'muted small' }, 'ℹ ' + g.note) : null),
      h('section', { class: 'card tip' }, h('b', null, '💡 작전 '), g.tip),
      last ? h('p', { class: 'muted center' }, `지난번 ${md(last.d)}: ${last.label}`) : null,
      h('div', { class: 'sticky-go' }, h('button', { class: 'btn big wide', onclick: () => play(gid, fromRoutine) }, '시작하기'))));
    window.scrollTo(0, 0);
  }

  /* ---------- 활동 실행 ---------- */
  let active = null;
  function play(gid, fromRoutine) {
    const g = GAME[gid], p = cur(), st = gst(p, gid);
    if (st.level > g.max) st.level = g.max;
    const snapshot = JSON.stringify(st);
    let alive = true; const timers = [], ivs = []; let keyFns = [];
    const hudBar = h('i'), hudLbl = h('span', { class: 'hud-l' }), hudScore = h('span', { class: 'hud-s' });
    const stage = h('div', { class: 'stage' });
    const overlay = h('div', { class: 'overlay' });
    const quit = h('button', { class: 'icon-btn', title: '그만하기', onclick: () => { if (confirm('그만할까요? 이번 기록은 저장되지 않아요.')) abort(); } }, '✕');
    const wrap = h('div', { class: 'play ' + g.domain },
      h('div', { class: 'play-top' }, quit, h('div', { class: 'play-title' }, h('b', null, `${g.icon} ${g.name}`), h('small', null, `Lv.${st.level}`)), hudScore),
      h('div', { class: 'hud' }, hudBar, hudLbl),
      stage, overlay);
    $app.replaceChildren(wrap);
    const onKey = e => { if (!alive) return; if (e.key === 'Escape') { quit.click(); return; } keyFns.forEach(f => f(e)); };
    document.addEventListener('keydown', onKey);
    const cleanup = () => { alive = false; timers.forEach(clearTimeout); ivs.forEach(clearInterval); document.removeEventListener('keydown', onKey); keyFns = []; try { speechSynthesis.cancel(); } catch (e) { } active = null; };
    const abort = () => { cleanup(); Object.assign(st, JSON.parse(snapshot)); Object.keys(st).forEach(k => { if (!(k in JSON.parse(snapshot))) delete st[k]; }); go(view); };
    const t0 = Date.now();
    const ctx = {
      stage, st,
      later(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); timers.push(id); return id; },
      cancel(id) { clearTimeout(id); },
      every(fn, ms) { const id = setInterval(() => { if (alive) fn(); }, ms); ivs.push(id); return id; },
      wait(ms) { return new Promise(res => ctx.later(res, ms)); },
      hud(o) {
        if (o.frac != null) hudBar.style.width = Math.max(0, Math.min(1, o.frac)) * 100 + '%';
        if (o.label != null) hudLbl.textContent = o.label;
        if (o.score != null) hudScore.textContent = '⭐ ' + o.score;
      },
      fb(ok) {
        stage.classList.remove('fb-ok', 'fb-bad'); void stage.offsetWidth;
        stage.classList.add(ok ? 'fb-ok' : 'fb-bad');
        ok ? sfx.ok() : sfx.bad();
        if (!ok && navigator.vibrate) try { navigator.vibrate(40); } catch (e) { }
      },
      miss() { stage.classList.remove('fb-miss'); void stage.offsetWidth; stage.classList.add('fb-miss'); sfx.miss(); },
      msg(t, ms) { const el = h('div', { class: 'flash-msg' }, t); stage.append(el); ctx.later(() => el.remove(), ms || 900); },
      say(title, sub, ms) { overlay.replaceChildren(h('div', { class: 'ov-box' }, h('b', null, title), sub ? h('span', null, sub) : null)); overlay.classList.add('on'); sfx.blip(); return ctx.wait(ms || 1500).then(() => { overlay.classList.remove('on'); }); },
      speak, sfx, onKey(fn) { keyFns.push(fn); },
      finish(res) {
        if (!alive) return; cleanup();
        res.delta = res.delta || 0;
        const s = { d: today(), t: Date.now(), g: gid, lv: st.level, delta: res.delta, score: res.score, label: res.label, sub: res.sub, acc: res.acc == null ? null : Math.round(res.acc * 1000) / 1000, rt: res.rt ? Math.round(res.rt) : null, dur: Math.round((Date.now() - t0) / 1000), m: res.metrics || {}, routine: !!fromRoutine };
        const prevSame = p.sessions.filter(x => x.g === gid).slice(-1)[0] || null;
        p.sessions.push(s);
        if (p.sessions.length > 3000) p.sessions = p.sessions.slice(-3000);
        const r = todayRec(p);
        if (r.plan.includes(gid) && !r.done.includes(gid)) r.done.push(gid);
        save();
        resultView(gid, s, prevSame, fromRoutine);
      }
    };
    active = ctx;
    // 3·2·1
    overlay.classList.add('on');
    let n = 3;
    const cd = () => { if (!alive) return; if (n === 0) { overlay.classList.remove('on'); g.play(ctx); return; } overlay.replaceChildren(h('div', { class: 'count' }, String(n))); sfx.blip(); n--; ctx.later(cd, 650); };
    cd();
  }

  /* ---------- 결과 ---------- */
  function resultView(gid, s, prev, fromRoutine) {
    const g = GAME[gid], p = cur(), r = todayRec(p);
    const nextG = r.plan.find(x => !r.done.includes(x));
    const routineDone = isComplete(r) && fromRoutine && !r.celebrated;
    let cmp = null;
    if (prev) {
      if (prev.lv !== s.lv - s.delta) cmp = `지난번은 Lv.${prev.lv}에서 했어요`;
      else if (s.score !== prev.score && s.score !== 999 && prev.score !== 999) {
        const better = g.lowerBetter ? s.score < prev.score : s.score > prev.score;
        cmp = better ? `지난번(${prev.label})보다 좋아졌어요 👍` : `지난번 기록: ${prev.label}`;
      } else cmp = `지난번 기록: ${prev.label}`;
    }
    const lvMsg = s.delta > 0 ? h('div', { class: 'lvup' }, `🎉 레벨 업! Lv.${s.lv - s.delta} → Lv.${s.lv}`) : s.delta < 0 ? h('div', { class: 'lvdn' }, `다음엔 Lv.${s.lv}에서 다지기`) : (s.acc != null && s.acc < 0.75 ? h('div', { class: 'lvsame' }, `Lv.${s.lv} 유지 · 빠르기보다 정확하게가 먼저예요`) : h('div', { class: 'lvsame' }, `Lv.${s.lv} 유지 · 한 번 더 잘하면 올라가요`));
    if (s.delta > 0) sfx.fan();
    const actions = h('div', { class: 'col' });
    if (routineDone) actions.append(h('button', { class: 'btn big wide', onclick: () => doneView() }, '오늘 루틴 완료! 🎁'));
    else if (fromRoutine && nextG) actions.append(h('button', { class: 'btn big wide', onclick: () => intro(nextG, true) }, `다음: ${GAME[nextG].icon} ${GAME[nextG].name} ▶`));
    actions.append(h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => play(gid, fromRoutine) }, '한 번 더'), h('button', { class: 'btn ghost', onclick: () => go(view) }, '처음으로')));
    $app.replaceChildren(h('div', { class: 'page result' },
      h('div', { class: 'res-hero ' + g.domain }, h('div', { class: 'big-ic' }, g.icon), h('h2', null, g.name), h('div', { class: 'res-score' }, s.label), s.sub ? h('div', { class: 'res-sub' }, s.sub) : null),
      lvMsg,
      h('section', { class: 'card stats' },
        s.acc != null ? h('div', null, h('small', null, '정확도'), h('b', null, Math.round(s.acc * 100) + '%')) : null,
        s.rt ? h('div', null, h('small', null, '반응 시간(중앙값)'), h('b', null, (s.rt / 1000).toFixed(2) + '초')) : null,
        h('div', null, h('small', null, '걸린 시간'), h('b', null, s.dur + '초'))),
      cmp ? h('p', { class: 'muted center' }, cmp) : null,
      h('section', { class: 'card tip' }, h('b', null, '💡 다음 작전 '), g.tip),
      actions));
    window.scrollTo(0, 0);
  }
  function doneView() {
    const p = cur(), r = todayRec(p);
    r.celebrated = true; save();
    sfx.fan();
    const ses = p.sessions.filter(s => s.d === today() && r.plan.includes(s.g));
    const ups = ses.filter(s => s.delta > 0).length;
    const moods = [['😄', '쉬웠어요'], ['🙂', '딱 좋았어요'], ['😓', '어려웠어요']];
    const moodBox = h('div', { class: 'moods' }, moods.map(([e, t]) => h('button', { class: 'mood' + (r.mood === t ? ' on' : ''), onclick: ev => { r.mood = t; save(); [...moodBox.children].forEach(c => c.classList.remove('on')); ev.currentTarget.classList.add('on'); } }, h('span', null, e), t)));
    const focus = h('div', { class: 'moods' }, ['끝까지 집중했어요', '중간에 딴생각했어요'].map(t => h('button', { class: 'mood' + (r.focus === t ? ' on' : ''), onclick: ev => { r.focus = t; save(); [...focus.children].forEach(c => c.classList.remove('on')); ev.currentTarget.classList.add('on'); } }, t)));
    $app.replaceChildren(h('div', { class: 'page result' },
      h('div', { class: 'stamp' }, h('div', null, '🏅'), h('b', null, `${md(today())} 완료`), h('small', null, `🔥 ${streak(p)}일 연속`)),
      h('section', { class: 'card' }, h('h2', null, '오늘 한 활동'),
        h('ul', { class: 'done-list' }, ses.map(s => h('li', null, h('span', null, GAME[s.g].icon + ' ' + GAME[s.g].name), h('b', null, s.label), s.delta > 0 ? h('em', { class: 'up' }, '▲') : null))),
        ups ? h('p', { class: 'lvup' }, `레벨 업 ${ups}개!`) : null),
      h('section', { class: 'card' }, h('h2', null, '오늘 루틴은 어땠나요?'), moodBox, h('h3', { class: 'small-h' }, '집중은?'), focus,
        h('p', { class: 'muted small' }, '스스로 돌아보기는 실행기능의 한 부분이에요. 선생님 리포트에 함께 담겨요.')),
      h('button', { class: 'btn big wide', onclick: () => go('home') }, '처음으로')));
    window.scrollTo(0, 0);
  }

  /* ---------- 자유 연습 ---------- */
  function free() {
    view = 'free';
    const p = cur(); if (!p) return onboarding();
    shell(h('header', { class: 'top' }, h('div', null, h('h1', null, '자유 연습'), h('p', { class: 'muted' }, '원하는 활동을 골라 더 연습해요. 오늘 루틴에 있는 활동이면 완료로 표시돼요.'))),
      ['ps', 'wm', 'ef'].map(d => h('section', { class: 'card' }, h('h2', null, domChip(d), ' ', DOMAINS[d].desc),
        h('div', { class: 'game-grid' }, GAMES.filter(g => g.domain === d).map(g => h('button', { class: 'game-card ' + d + (p.exclude.includes(g.id) ? ' dim' : ''), onclick: () => intro(g.id, false) },
          h('span', { class: 'gc-ic' }, g.icon), h('b', null, g.name), h('small', null, g.short), h('span', { class: 'lvchip' }, `Lv.${gst(p, g.id).level}`)))))));
  }

  /* ---------- 기록 ---------- */
  function spark(vals, max, cls) {
    if (vals.length < 2) return h('span', { class: 'muted small' }, vals.length ? '기록 1회' : '기록 없음');
    const W = 120, H = 34, n = vals.length;
    const pts = vals.map((v, i) => `${(i / (n - 1) * (W - 6) + 3).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`).join(' ');
    const last = pts.split(' ').pop().split(',');
    return h('span', { class: 'spark ' + cls, html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.2" fill="currentColor"/></svg>` });
  }
  function calendar(p, ym) {
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(h('span', { class: 'cal-c empty' }));
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${pad2(m)}-${pad2(d)}`, r = p.days[k], c = isComplete(r), part = r && (r.done || []).length && !c;
      cells.push(h('span', { class: 'cal-c' + (c ? ' full' : part ? ' half' : '') + (k === today() ? ' today' : ''), title: k }, String(d)));
    }
    return h('div', { class: 'cal' }, WK.map(w => h('span', { class: 'cal-w' }, w)), cells);
  }
  let calYM = null;
  function records() {
    view = 'records';
    const p = cur(); if (!p) return onboarding();
    calYM = calYM || today().slice(0, 7);
    const completeDays = Object.keys(p.days).filter(k => isComplete(p.days[k])).length;
    const shift = n => { const [y, m] = calYM.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); calYM = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; records(); };
    const recent = p.sessions.slice(-15).reverse();
    shell(
      h('header', { class: 'top' }, h('div', null, h('h1', null, `${p.name}의 기록`), h('p', { class: 'muted' }, `루틴 완료 ${completeDays}일 · 활동 ${p.sessions.length}회 · 🔥 ${streak(p)}일 연속`))),
      h('section', { class: 'card' }, h('div', { class: 'cal-head' }, h('button', { class: 'icon-btn', onclick: () => shift(-1) }, '‹'), h('b', null, calYM.replace('-', '년 ') + '월'), h('button', { class: 'icon-btn', onclick: () => shift(1) }, '›')), calendar(p, calYM),
        h('p', { class: 'muted small center' }, '★ 루틴 완료 · ● 일부만 함')),
      h('section', { class: 'card' }, h('h2', null, '활동별 레벨 변화'), h('p', { class: 'muted small' }, '최근 12회의 레벨입니다. 오른쪽 위로 갈수록 좋아요.'),
        h('div', { class: 'glist' }, GAMES.map(g => {
          const ss = p.sessions.filter(s => s.g === g.id);
          const lv = ss.slice(-12).map(s => s.lv);
          const best = ss.length ? Math.max(...ss.map(s => s.lv)) : null;
          return h('div', { class: 'grow' }, h('span', { class: 'gr-n' }, g.icon + ' ' + g.name), spark(lv, g.max, g.domain), h('span', { class: 'gr-v' }, ss.length ? `Lv.${gst(p, g.id).level}` : '—', h('small', null, best ? ` 최고 ${best}` : '')));
        }))),
      h('section', { class: 'card' }, h('h2', null, '최근 활동'),
        recent.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['날짜', '활동', '결과', '레벨'].map(t => h('th', null, t)))),
          h('tbody', null, recent.map(s => h('tr', null, h('td', null, md(s.d)), h('td', null, GAME[s.g] ? GAME[s.g].name : s.g), h('td', null, s.label), h('td', null, `${s.lv}${s.delta > 0 ? ' ▲' : s.delta < 0 ? ' ▼' : ''}`)))))) : h('p', { class: 'muted' }, '아직 기록이 없어요.')));
  }

  /* ---------- 선생님 ---------- */
  let teacherOpen = false;
  function askPin() {
    const inp = h('input', { class: 'inp', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: '비밀번호' });
    const ok = () => { if (inp.value === S.settings.pin) { teacherOpen = true; bg.remove(); go('teacher'); return; } inp.value = ''; inp.placeholder = '다시 입력해 주세요'; inp.focus(); return false; };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    const bg = modal('선생님 메뉴', h('div', null, h('p', { class: 'muted small' }, `처음 비밀번호는 0000입니다. 설정에서 바꿀 수 있어요.`), inp), [['취소', null], ['열기', ok, 'pri']]);
    setTimeout(() => inp.focus(), 50);
  }
  function weekStats(p) {
    const t = today(), from = addDays(t, -6);
    const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(t, -i));
    const comp = days.filter(d => isComplete(p.days[d])).length, part = days.filter(d => p.days[d] && (p.days[d].done || []).length).length;
    const ses = p.sessions.filter(s => s.d >= from);
    const dom = {};
    ['ps', 'wm', 'ef'].forEach(d => { const now = domainLevel(p, d), before = domainLevelAt(p, d, from); dom[d] = { now, before, diff: now != null && before != null ? Math.round((now - before) * 10) / 10 : null }; });
    return { from, to: t, comp, part, ses, dom, days };
  }
  function report(p) {
    const w = weekStats(p);
    const fmt = v => v == null ? '기록 없음' : v.toFixed(1);
    const diff = d => d == null ? '' : d > 0 ? ` (지난주보다 +${d.toFixed(1)})` : d < 0 ? ` (${d.toFixed(1)})` : ' (유지)';
    const lines = [];
    const ac = S.settings.academy ? `[${S.settings.academy}] ` : '';
    lines.push(`${ac}브레인 루틴 주간 리포트`);
    lines.push(`학생: ${p.name} (${p.grade})`);
    lines.push(`기간: ${md(w.from)} ~ ${md(w.to)}`);
    lines.push('');
    lines.push(`■ 참여: 루틴 완료 ${w.comp}일 / 7일` + (w.part > w.comp ? ` (일부 참여 ${w.part - w.comp}일)` : '') + ` · 연속 ${streak(p)}일 · 활동 ${w.ses.length}회`);
    lines.push('');
    lines.push('■ 영역별 수준 (10점 기준)');
    ['ps', 'wm', 'ef'].forEach(d => lines.push(`- ${DOMAINS[d].name}: ${fmt(w.dom[d].now)}${diff(w.dom[d].diff)}`));
    const dg = p.sessions.filter(s => s.g === 'digits').slice(-1)[0], gr = p.sessions.filter(s => s.g === 'grid').slice(-1)[0];
    const det = [];
    if (dg) det.push(`숫자 기억 순서대로 ${dg.m.fwd || '-'}자리 / 거꾸로 ${dg.m.bwd || '-'}자리`);
    if (gr) det.push(`위치 기억 순서대로 ${gr.m.fwd || '-'}개 / 거꾸로 ${gr.m.bwd || '-'}개`);
    if (det.length) lines.push('  · ' + det.join(' · '));
    const ups = w.ses.filter(s => s.delta > 0).map(s => GAME[s.g].name);
    if (ups.length) lines.push(`- 이번 주 레벨 업: ${[...new Set(ups)].join(', ')}`);
    lines.push('');
    // 강점·보완
    const have = ['ps', 'wm', 'ef'].filter(d => w.dom[d].now != null);
    if (have.length >= 2) {
      const sorted = have.slice().sort((a, b) => w.dom[b].now - w.dom[a].now);
      lines.push(`■ 강점: ${DOMAINS[sorted[0]].name} — ${DOMAINS[sorted[0]].desc}이 안정적입니다.`);
      const weak = sorted[sorted.length - 1];
      lines.push(`■ 보완: ${DOMAINS[weak].name} — ${HOME_TIP[weak]}`);
    }
    const moods = w.days.map(d => p.days[d] && p.days[d].mood).filter(Boolean);
    if (moods.length) {
      const hard = moods.filter(m => m === '어려웠어요').length;
      lines.push(`■ 학생 스스로 평가: ${moods.length}일 중 '어려웠어요' ${hard}일` + (hard >= Math.ceil(moods.length / 2) ? ' — 난이도를 한 단계 낮추어 자신감을 먼저 다지겠습니다.' : ''));
    }
    lines.push('');
    lines.push(w.comp >= 5 ? '꾸준한 참여가 가장 큰 성과입니다. 같은 시간에 루틴을 이어 갈 수 있도록 격려 부탁드립니다.' : '주 5일 이상 같은 시간대 참여를 권장합니다. 하루 10분이면 충분합니다.');
    lines.push('※ 본 리포트는 연습 기록이며 지능·발달 검사 결과가 아닙니다.');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  const HOME_TIP = {
    ps: '가정에서 장보기 목록 빨리 찾기, 숨은그림찾기처럼 “정확하게, 점점 빠르게” 하는 놀이를 권합니다. 속도보다 정확도를 먼저 칭찬해 주세요.',
    wm: '심부름을 2~3단계로 한 번에 말해 주고 순서대로 해 보게 하거나, 전화번호 거꾸로 말하기 놀이를 권합니다.',
    ef: '숙제 전 “무엇부터 할지” 순서를 말로 정하게 하고, 끝난 뒤 계획대로 되었는지 함께 돌아보는 습관을 권합니다.'
  };
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('복사했어요. 카톡에 붙여 넣으세요.'); }
    catch (e) { const ta = h('textarea', { class: 'inp', style: 'height:240px' }); ta.value = t; modal('아래 글을 길게 눌러 복사하세요', ta); ta.select(); }
  }
  function download(name, text, type) {
    const b = new Blob([text], { type: type || 'application/json' });
    const a = h('a', { href: URL.createObjectURL(b), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv() {
    const rows = [['학생', '학년', '날짜', '활동', '영역', '레벨', '레벨변화', '결과', '세부', '정확도', '반응시간ms', '걸린초', '루틴']];
    S.profiles.forEach(p => p.sessions.forEach(s => { const g = GAME[s.g] || {}; rows.push([p.name, p.grade, s.d, g.name || s.g, g.domain ? DOMAINS[g.domain].name : '', s.lv, s.delta, s.label, s.sub || '', s.acc == null ? '' : Math.round(s.acc * 100) + '%', s.rt || '', s.dur, s.routine ? 'O' : '']); }));
    return '﻿' + rows.map(r => r.map(c => { c = String(c); return /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; }).join(',')).join('\n');
  }
  function teacher() {
    view = 'teacher';
    const rows = S.profiles.map(p => {
      const w = weekStats(p); const last = p.sessions.slice(-1)[0];
      return h('tr', null,
        h('td', null, h('b', null, p.name), h('br'), h('small', { class: 'muted' }, p.grade)),
        h('td', null, `${w.comp}/7`, h('br'), h('small', { class: 'muted' }, `🔥${streak(p)}`)),
        ['ps', 'wm', 'ef'].map(d => h('td', { class: 'num' }, w.dom[d].now == null ? '—' : w.dom[d].now.toFixed(1), w.dom[d].diff ? h('small', { class: w.dom[d].diff > 0 ? 'up' : 'dn' }, (w.dom[d].diff > 0 ? ' ▲' : ' ▼')) : null)),
        h('td', null, last ? md(last.d) : '—'),
        h('td', null, h('button', { class: 'btn sm', onclick: () => studentDetail(p) }, '관리')));
    });
    shell(
      h('header', { class: 'top' }, h('div', null, h('h1', null, '선생님 메뉴'), h('p', { class: 'muted' }, '학생 현황 · 주간 리포트 · 루틴 설정 · 백업')), h('button', { class: 'btn ghost sm', onclick: () => { teacherOpen = false; go('home'); } }, '잠그기')),
      h('section', { class: 'card' }, h('div', { class: 'row between' }, h('h2', null, `학생 ${S.profiles.length}명`), h('button', { class: 'btn sm', onclick: addStudentModal }, '+ 학생 추가')),
        S.profiles.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['학생', '이번 주', '처리속도', '작업기억', '실행기능', '최근', ''].map(t => h('th', null, t)))), h('tbody', null, rows))) : h('p', { class: 'muted' }, '등록된 학생이 없어요.'),
        h('p', { class: 'muted small' }, '영역 점수는 10점 기준 · ▲▼는 지난주 대비 변화')),
      h('section', { class: 'card' }, h('h2', null, '기록 내보내기 · 백업'),
        h('p', { class: 'muted small' }, '기록은 이 기기의 브라우저에만 저장됩니다. 일주일에 한 번 백업 파일을 받아 두세요. 다른 기기로 옮길 때도 백업 → 불러오기를 씁니다.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn ghost', onclick: () => download(`브레인루틴_백업_${today()}.json`, JSON.stringify(S)) }, '💾 백업 받기'),
          h('label', { class: 'btn ghost' }, '📂 백업 불러오기', h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: e => restore(e.target.files[0]) })),
          h('button', { class: 'btn ghost', onclick: () => download(`브레인루틴_기록_${today()}.csv`, csv(), 'text/csv;charset=utf-8') }, '📊 엑셀용 CSV'))),
      h('section', { class: 'card' }, h('h2', null, '설정'), settingsForm()));
  }
  function settingsForm() {
    const ac = h('input', { class: 'inp', placeholder: '학원 이름(리포트 머리말)', value: S.settings.academy || '' });
    const pin = h('input', { class: 'inp', placeholder: '새 비밀번호(숫자 4~8자리)', inputmode: 'numeric', maxlength: 8 });
    const voice = h('input', { type: 'checkbox', ...(S.settings.voice ? { checked: '' } : {}) });
    const sound = h('input', { type: 'checkbox', ...(S.settings.sound ? { checked: '' } : {}) });
    return h('div', { class: 'form' }, ac,
      h('label', { class: 'chk' }, sound, ' 효과음 켜기'),
      h('label', { class: 'chk' }, voice, ' 숫자 기억에서 숫자를 소리로도 읽어 주기(기기 음성)'),
      pin,
      h('button', { class: 'btn', onclick: () => { S.settings.academy = ac.value.trim(); S.settings.voice = voice.checked; S.settings.sound = sound.checked; if (pin.value) { if (!/^\d{4,8}$/.test(pin.value)) { toast('비밀번호는 숫자 4~8자리예요.'); return; } S.settings.pin = pin.value; } save(); toast('저장했어요.'); } }, '설정 저장'));
  }
  function restore(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (!d || !Array.isArray(d.profiles)) throw new Error('형식');
        modal('백업 불러오기', h('p', null, `백업 파일에 학생 ${d.profiles.length}명이 있어요. 지금 기기의 기록(${S.profiles.length}명)을 어떻게 할까요?`), [
          ['취소', null],
          ['합치기', () => { d.profiles.forEach(np => { const i = S.profiles.findIndex(q => q.id === np.id); if (i >= 0) { if (np.sessions.length >= S.profiles[i].sessions.length) S.profiles[i] = np; } else S.profiles.push(np); }); save(); teacher(); toast('합쳤어요.'); }],
          ['덮어쓰기', () => { const pin = S.settings.pin; S = Object.assign(blank(), d); S.settings = Object.assign(blank().settings, d.settings || {}, { pin }); save(); teacher(); toast('불러왔어요.'); }, 'pri']]);
      } catch (e) { toast('백업 파일을 읽을 수 없어요.'); }
    };
    fr.readAsText(file);
  }
  function studentDetail(p) {
    const name = h('input', { class: 'inp', value: p.name, maxlength: 12 });
    const grade = h('select', { class: 'inp' }, ['7세', '초1', '초2', '초3', '초4', '초5', '초6', '중1 이상'].map(g => h('option', { value: g, ...(g === p.grade ? { selected: '' } : {}) }, g)));
    const size = h('select', { class: 'inp' }, [[3, '짧게 3개 (약 6분)'], [4, '기본 4개 (약 10분)'], [5, '길게 5개 (약 13분)']].map(([v, t]) => h('option', { value: v, ...(v === p.size ? { selected: '' } : {}) }, t)));
    const ex = GAMES.map(g => { const c = h('input', { type: 'checkbox', value: g.id, ...(!p.exclude.includes(g.id) ? { checked: '' } : {}) }); return [g, c]; });
    const lvInputs = GAMES.map(g => { const s = h('select', { class: 'inp sm' }, [...Array(g.max)].map((_, i) => h('option', { value: i + 1, ...(i + 1 === gst(p, g.id).level ? { selected: '' } : {}) }, `Lv.${i + 1}`))); return [g, s]; });
    const rep = report(p);
    const body = h('div', { class: 'detail' },
      h('h3', { class: 'small-h' }, '주간 리포트 (학부모 안내용)'),
      h('pre', { class: 'report' }, rep),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => copyText(rep) }, '📋 리포트 복사')),
      h('h3', { class: 'small-h' }, '기본 정보 · 루틴 길이'),
      h('div', { class: 'form' }, name, grade, size),
      h('h3', { class: 'small-h' }, '루틴에 넣을 활동'),
      h('p', { class: 'muted small' }, '체크를 끄면 오늘의 루틴에서 빠져요(자유 연습에는 남아요). 영역마다 하나 이상은 켜 두세요.'),
      h('div', { class: 'chk-grid' }, ex.map(([g, c]) => h('label', { class: 'chk' }, c, ` ${g.icon} ${g.name}`))),
      h('h3', { class: 'small-h' }, '레벨 직접 조정'),
      h('p', { class: 'muted small' }, '첫 주에 너무 쉽거나 어려우면 여기서 맞춰 주세요. 이후에는 자동으로 오르내립니다.'),
      h('div', { class: 'lv-grid' }, lvInputs.map(([g, s]) => h('label', null, h('span', null, `${g.icon} ${g.name}`), s))),
      h('h3', { class: 'small-h' }, '위험 구역'),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost sm', onclick: () => { if (confirm(`${p.name}의 오늘 루틴을 다시 짤까요? (오늘 완료 표시가 지워져요)`)) { delete p.days[today()]; save(); toast('오늘 루틴을 다시 짰어요.'); } } }, '오늘 루틴 다시 짜기'),
        h('button', { class: 'btn danger sm', onclick: () => { if (confirm(`${p.name} 학생과 모든 기록을 지울까요? 되돌릴 수 없어요.`)) { S.profiles = S.profiles.filter(q => q.id !== p.id); if (S.cur === p.id) S.cur = S.profiles[0] ? S.profiles[0].id : null; save(); document.querySelector('.modal-bg').remove(); teacher(); } } }, '학생 삭제')));
    modal(`${p.name} 관리`, body, [['닫기', null], ['저장', () => {
      p.name = name.value.trim() || p.name; p.grade = grade.value; p.size = +size.value;
      const exNew = ex.filter(([, c]) => !c.checked).map(([g]) => g.id);
      if (['ps', 'wm', 'ef'].some(d => GAMES.filter(g => g.domain === d).every(g => exNew.includes(g.id)))) { toast('영역마다 활동을 하나 이상 켜 두세요.'); return false; }
      const changedPlan = JSON.stringify(exNew) !== JSON.stringify(p.exclude) || p.size !== +size.value;
      p.exclude = exNew;
      lvInputs.forEach(([g, s]) => { gst(p, g.id).level = +s.value; });
      const tr = p.days[today()];
      if (tr && !(tr.done || []).length) tr.plan = computePlan(p);
      save(); teacher(); toast('저장했어요.');
    }, 'pri']]);
  }

  /* ---------- 안내 ---------- */
  function guide() {
    view = 'guide';
    const dom = d => h('div', { class: 'gd ' + d }, h('h3', null, DOMAINS[d].name), h('p', { class: 'muted small' }, DOMAINS[d].desc),
      h('ul', null, GAMES.filter(g => g.domain === d).map(g => h('li', null, h('b', null, `${g.icon} ${g.name}`), ' — ', g.short))));
    shell(
      h('header', { class: 'top' }, h('div', null, h('h1', null, '안내'), h('p', { class: 'muted' }, '선생님·학부모님이 먼저 읽어 주세요'))),
      h('section', { class: 'card' }, h('h2', null, '하루 루틴은 이렇게 돌아가요'),
        h('div', { class: 'flow' }, ['처리속도 1개', '작업기억 1개', '실행기능 1개', '+1개 (번갈아)'].map((t, i) => h('div', { class: 'flow-s' }, h('b', null, i + 1), t))),
        h('ul', null,
          h('li', null, '활동은 1~3분짜리이고, 하루 4개면 약 10분입니다(선생님 메뉴에서 3~5개로 조절).'),
          h('li', null, '연습한 날 수에 따라 활동이 돌아가며 나와 일주일이면 11가지를 모두 만납니다.'),
          h('li', null, h('b', null, '적응형 난이도'), ': 정확도 90% 이상이면서 속도 기준을 넘으면 한 단계 오르고, 75% 아래면 한 단계 내려갑니다. 늘 “조금 어려운” 수준을 유지하는 것이 목적입니다.'),
          h('li', null, '숫자·위치 기억은 맞히면 한 자리 늘고 틀리면 한 자리 줄어드는 계단식입니다.'))),
      h('section', { class: 'card' }, h('h2', null, '활동 11가지'), h('div', { class: 'gd-wrap' }, dom('ps'), dom('wm'), dom('ef'))),
      h('section', { class: 'card' }, h('h2', null, '잘 쓰는 법'),
        h('ol', null,
          h('li', null, h('b', null, '같은 시간, 같은 자리'), ': 수업 시작 전 10분이나 집에서 숙제 전처럼 고정된 시간에 하면 습관이 됩니다.'),
          h('li', null, h('b', null, '작전 먼저'), ': 활동마다 나오는 💡 작전(묶어 외우기, 속으로 말하기)을 써 보게 하세요. 전략을 스스로 고르는 것 자체가 실행기능 연습입니다.'),
          h('li', null, h('b', null, '칭찬은 정확도와 꾸준함에'), ': 점수보다 “끝까지 집중했다”, “연속 5일”을 칭찬해 주세요.'),
          h('li', null, h('b', null, '첫 주는 맞추는 기간'), ': 레벨이 맞을 때까지 1주 정도 걸립니다. 너무 쉽거나 어려우면 선생님 메뉴에서 레벨을 직접 조정하세요.'),
          h('li', null, h('b', null, '피곤한 날은 3개'), ': 억지로 하면 오히려 기록이 흔들립니다. 짧게라도 매일이 낫습니다.'))),
      h('section', { class: 'card warnbox' }, h('h2', null, '꼭 알아 두세요'),
        h('ul', null,
          h('li', null, '이 앱은 연습 도구이며 ', h('b', null, '지능·발달 검사가 아닙니다'), '. 레벨은 같은 학생의 변화를 보는 용도이고, 다른 학생과 비교하거나 진단에 쓰지 마세요.'),
          h('li', null, '연구 결과를 보면, 이런 훈련으로 ', h('b', null, '연습한 과제 자체와 비슷한 과제'), '의 실력은 꾸준히 오르지만, 학업 성적이나 전반적 지능까지 넓게 오른다는 근거는 아직 엇갈립니다. 수학 수업·독서·운동·수면과 함께 쓰는 보조 루틴으로 생각해 주세요.'),
          h('li', null, '활동 원리는 신경심리 검사와 연구에서 널리 쓰이는 과제 유형(기호 찾기·기호 바꾸기·숫자 따라 말하기·위치 기억·N-back·스트룹·규칙 전환·Go/No-go·선 잇기·하노이의 탑)을 본떠 새로 만든 것으로, 특정 책이나 검사 문항을 옮긴 것이 아닙니다.'),
          h('li', null, '주의집중이나 학습에 지속적인 어려움이 보이면 전문가 상담을 권합니다.'))),
      h('section', { class: 'card' }, h('h2', null, '앱으로 설치하기'),
        h('ul', null,
          h('li', null, h('b', null, '안드로이드·PC(크롬·엣지·삼성 인터넷)'), ': 오늘 화면의 “설치” 버튼, 또는 브라우저 메뉴 ⋮ → “앱 설치 / 홈 화면에 추가”.'),
          h('li', null, h('b', null, '아이폰·아이패드'), ': Safari로 열고 공유 ⬆︎ → “홈 화면에 추가”. ', h('button', { class: 'btn ghost sm', onclick: iosHelp }, '자세히')),
          h('li', null, '설치하면 주소창 없이 앱처럼 열리고, 한 번 연 뒤에는 인터넷이 없어도 동작합니다.'),
          h('li', null, '아이폰에서는 Safari와 설치한 앱의 기록이 따로 저장됩니다. 처음부터 설치한 앱으로 쓰거나, 백업 파일로 옮기세요.'))),
      h('section', { class: 'card' }, h('h2', null, '기기 · 저장'),
        h('ul', null,
          h('li', null, '태블릿·휴대폰·PC 모두 됩니다. PC에서는 ←/→(F/J), 숫자키, 스페이스바로도 할 수 있어요.'),
          h('li', null, '기록은 이 기기의 브라우저에 저장됩니다. 브라우저 기록을 지우면 사라지니 선생님 메뉴에서 백업을 받아 두세요.'),
          h('li', null, '집과 학원에서 각각 하면 기록이 기기마다 따로 쌓입니다. 한 기기를 정해 쓰거나, 백업 파일로 옮겨 합치세요.')))
    );
  }

  /* ---------- 앱으로 설치 (PWA) ---------- */
  let deferredPrompt = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (view === 'home') home(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('설치했어요! 홈 화면의 아이콘으로 여세요.'); if (view === 'home') home(); });
  function installCard() {
    if (standalone() || S.settings.hideInstall || !/^https?:/.test(location.protocol)) return null;
    if (!deferredPrompt && !isIOS()) return null;
    const hide = h('button', { class: 'icon-btn', title: '닫기', onclick: () => { S.settings.hideInstall = true; save(); home(); } }, '✕');
    const act = deferredPrompt
      ? h('button', { class: 'btn sm', onclick: async () => { const e = deferredPrompt; deferredPrompt = null; e.prompt(); try { await e.userChoice; } catch (er) { } home(); } }, '설치')
      : h('button', { class: 'btn sm', onclick: iosHelp }, '방법 보기');
    return h('section', { class: 'card install' }, h('img', { src: 'icons/icon-192.png', alt: '' }), h('div', null, h('b', null, '앱으로 설치하기'), h('small', null, '홈 화면 아이콘으로 바로 열고, 인터넷 없이도 돼요.')), act, hide);
  }
  function iosHelp() {
    modal('아이폰·아이패드에 설치', h('ol', { class: 'how' },
      h('li', { html: '<b>Safari</b>에서 이 페이지를 열어요. (카톡 안 브라우저에서는 안 돼요 → 오른쪽 아래 메뉴에서 “Safari로 열기”)' }),
      h('li', { html: '아래(아이패드는 위) <b>공유 버튼 ⬆︎</b>을 눌러요.' }),
      h('li', { html: '<b>“홈 화면에 추가”</b>를 눌러요.' }),
      h('li', { html: '홈 화면의 <b>브레인 루틴</b> 아이콘으로 열어요.' }),
      h('li', { html: '⚠ Safari에서 하던 기록은 설치한 앱으로 넘어가지 않아요. 기록이 있다면 선생님 메뉴에서 <b>백업 → 앱에서 불러오기</b>를 하세요.' })));
  }

  /* ---------- 시작 ---------- */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
  // 브라우저가 저장 공간이 부족할 때 기록을 지우지 않도록 요청(지원하는 브라우저만)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { }
  if (location.hash === '#teacher') go('teacher'); else go('home');
})();
