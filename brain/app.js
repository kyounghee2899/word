/* 브레인 루틴 — 화면·루틴·기록·관리 메뉴 */
(function () {
  'use strict';
  const { list: GAMES, byId: GAME, DOMAINS, h } = window.BR_GAMES;
  const UI = window.BR_UI;
  const KEY = 'brainRoutine.v1';
  const $app = document.getElementById('app');
  const DCOL = { ps: 'var(--ps)', wm: 'var(--wm)', ef: 'var(--ef)' };
  const GRADES = ['7세', '초1', '초2', '초3', '초4', '초5', '초6', '중1+'];
  const COLORS = Object.keys(UI.PALETTE);

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
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
  const WK = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
  const md = s => { const [, m, d] = s.split('-').map(Number); return `${m}/${d}(${WK[dow(s)]})`; };
  const longDate = s => { const [, m, d] = s.split('-').map(Number); return `${m}월 ${d}일 ${WK[dow(s)]}요일`; };

  /* ---------- 학습자 ---------- */
  const uid = () => Math.random().toString(36).slice(2, 9);
  const cur = () => S.profiles.find(p => p.id === S.cur) || null;
  function newProfile(name, grade, color) {
    const p = { id: uid(), name, grade, color: color || 'pink', created: today(), size: 4, exclude: [], games: {}, sessions: [], days: {} };
    S.profiles.push(p); S.cur = p.id; save(); return p;
  }
  const gst = (p, gid) => p.games[gid] || (p.games[gid] = { level: 1 });

  /* ---------- 루틴 짜기 ----------
   * 매일: 처리속도 1 + 작업기억 1 + 실행기능 1 (+ 4·5번째는 실행기능·작업기억에서 번갈아)
   * 연습한 날 수를 기준으로 돌아가며 골라 첫 5일 안에 모든 활동을 만납니다. */
  function pool(p, d) { return GAMES.filter(g => g.domain === d && !p.exclude.includes(g.id)).map(g => g.id); }
  function computePlan(p) {
    const n = Object.keys(p.days).filter(k => k !== today() && (p.days[k].done || []).length).length;
    const ps = pool(p, 'ps'), wm = pool(p, 'wm'), ef = pool(p, 'ef');
    const plan = [];
    const take = (arr, i) => { if (!arr.length) return; const left = arr.filter(x => !plan.includes(x)); if (left.length) plan.push(left[i % left.length]); };
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
  const isComplete = r => !!(r && r.plan && r.plan.length && r.plan.every(g => (r.done || []).includes(g)));
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
    const vals = [];
    GAMES.filter(g => g.domain === dom).forEach(g => {
      const ss = p.sessions.filter(s => s.g === g.id && s.d < dateExcl);
      if (ss.length) vals.push(ss[ss.length - 1].lv / g.max * 10);
    });
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
  }
  function starsOf(s, g) {
    if (s.acc != null) return s.acc >= 0.9 ? 3 : s.acc >= 0.75 ? 2 : 1;
    if (g && g.id === 'hanoi') return !s.m || !s.m.solved ? 1 : s.m.efficiency >= 0.8 ? 3 : 2;
    return s.delta > 0 ? 3 : s.delta < 0 ? 1 : 2;
  }

  /* ---------- 소리 ---------- */
  let AC = null;
  function tone(freq, dur, type, vol, slide, delay) {
    if (!S.settings.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + (delay || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* 소리 없이 진행 */ }
  }
  const sfx = {
    ok: () => { tone(988, 0.09, 'sine', 0.09); tone(1319, 0.14, 'sine', 0.08, null, 0.07); },
    bad: () => tone(196, 0.22, 'triangle', 0.1, 150),
    blip: () => tone(740, 0.06, 'sine', 0.06),
    miss: () => tone(330, 0.12, 'sine', 0.05),
    tap: () => tone(520, 0.04, 'sine', 0.04),
    fan: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.09, null, i * 0.11)); }
  };
  function speak(t) {
    if (!S.settings.voice || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { }
  }

  /* ---------- 공용 UI ---------- */
  const ic = (name, size, cls) => h('span', { class: 'ic' + (cls ? ' ' + cls : ''), html: UI.svg(name, size) });
  const tile = (gid, size) => { const g = GAME[gid]; return h('span', { class: 'tile ' + g.domain, style: size ? `--ts:${size}px` : null, html: UI.svg(gid, size ? Math.round(size * 0.5) : 22) }); };
  const domChip = d => h('span', { class: 'dchip ' + d }, DOMAINS[d].name);
  const mascotEl = (mood, color, size, cls) => h('span', { class: 'mascot-wrap' + (cls ? ' ' + cls : ''), html: UI.mascot(mood, color, size) });

  let view = 'home';
  function nav() {
    const items = [['home', 'home', '오늘'], ['free', 'apps', '연습'], ['records', 'chart', '기록'], ['teacher', 'user', '관리'], ['guide', 'book', '안내']];
    return h('nav', { class: 'tabs' }, h('div', { class: 'tabs-in' }, items.map(([v, icn, t]) => h('button', { class: view === v ? 'on' : '', 'aria-label': t, onclick: () => go(v) }, ic(icn, 22), h('span', null, t)))));
  }
  function shell(...kids) {
    $app.replaceChildren(h('main', { class: 'page enter' }, ...kids), nav());
    window.scrollTo(0, 0);
  }
  function screen(cls, ...kids) {
    $app.replaceChildren(h('main', { class: 'page enter ' + (cls || '') }, ...kids));
    window.scrollTo(0, 0);
  }
  function go(v) {
    if (v === 'teacher' && !teacherOpen) return askPin();
    view = v; ({ home, free, records, teacher, guide })[v]();
  }
  function toast(t) {
    document.querySelectorAll('.toast').forEach(x => x.remove());
    const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 300); }, 2200);
  }
  function modal(title, body, actions) {
    const bg = h('div', { class: 'modal-bg' });
    const close = () => { bg.classList.add('out'); setTimeout(() => bg.remove(), 180); };
    bg.append(h('div', { class: 'modal', role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-grip' }),
      h('div', { class: 'modal-head' }, h('h3', null, title), h('button', { class: 'icon-btn sm', 'aria-label': '닫기', onclick: close }, ic('close', 18))),
      h('div', { class: 'modal-body' }, body),
      actions && actions.length ? h('div', { class: 'modal-foot' }, actions.map(([t, fn, cls]) => h('button', { class: 'btn ' + (cls || 'soft'), onclick: () => { if (!fn || fn() !== false) close(); } }, t))) : null));
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.body.append(bg);
    bg.closeModal = close;
    return bg;
  }
  const section = (title, ...kids) => h('section', { class: 'card' }, title ? h('div', { class: 'card-h' }, typeof title === 'string' ? h('h2', null, title) : title) : null, ...kids);

  /* ---------- 처음 화면 ---------- */
  function onboarding() {
    let grade = '초3', color = 'pink';
    const name = h('input', { class: 'inp lg', placeholder: '이름을 적어 주세요', maxlength: 12, autocomplete: 'off' });
    const hero = mascotEl('happy', color, 150, 'float');
    const gradeRow = h('div', { class: 'chips' }, GRADES.map(g => h('button', { class: 'chip' + (g === grade ? ' on' : ''), onclick: ev => { grade = g; [...gradeRow.children].forEach(c => c.classList.toggle('on', c === ev.currentTarget)); } }, g)));
    const colorRow = h('div', { class: 'swatches' }, COLORS.map(c => h('button', { class: 'sw' + (c === color ? ' on' : ''), 'aria-label': c, style: `--a:${UI.PALETTE[c][0]};--b:${UI.PALETTE[c][1]}`, onclick: ev => { color = c; hero.innerHTML = UI.mascot('cheer', c, 150); [...colorRow.children].forEach(x => x.classList.toggle('on', x === ev.currentTarget)); } })));
    const add = () => { const n = name.value.trim(); if (!n) { name.focus(); name.classList.add('shake'); setTimeout(() => name.classList.remove('shake'), 400); return; } newProfile(n, grade, color); go('home'); };
    name.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    screen('onboard',
      h('div', { class: 'ob-hero' }, hero, h('h1', null, '브레인 루틴'), h('p', null, '하루 10분, 생각하는 힘을 키우는 두뇌 루틴')),
      h('section', { class: 'card ob-form' },
        h('label', { class: 'fld' }, h('span', null, '이름'), name),
        h('div', { class: 'fld' }, h('span', null, '학년'), gradeRow),
        h('div', { class: 'fld' }, h('span', null, '내 브레니 색깔'), colorRow),
        h('button', { class: 'btn pri xl wide', onclick: add }, '시작하기')),
      h('div', { class: 'ob-feats' }, [['ps', 'bolt', '처리속도', '보고 판단하는 속도'], ['wm', 'nback', '작업기억', '머릿속에 담아 두는 힘'], ['ef', 'target', '실행기능', '참기 · 바꾸기 · 계획하기']].map(([d, icn, t, s]) =>
        h('div', { class: 'ob-feat' }, h('span', { class: 'tile ' + d, html: UI.svg(icn, 20) }), h('div', null, h('b', null, t), h('small', null, s))))),
      h('p', { class: 'fine center' }, '기록은 이 기기에만 저장되고 밖으로 보내지 않습니다.'));
    setTimeout(() => name.focus(), 80);
  }

  /* ---------- 오늘 ---------- */
  function home() {
    view = 'home';
    const p = cur();
    if (!p) return onboarding();
    p.color = p.color || 'pink';
    const r = todayRec(p); save();
    const doneN = r.plan.filter(g => r.done.includes(g)).length, total = r.plan.length;
    const nextG = r.plan.find(g => !r.done.includes(g));
    const st = streak(p), allDone = isComplete(r);
    const mood = allDone ? 'cheer' : doneN ? 'happy' : 'calm';
    const hr = new Date().getHours();
    const hello = hr < 11 ? '좋은 아침이에요' : hr < 17 ? '반가워요' : '오늘도 수고했어요';
    const ringHtml = UI.ring(r.plan.map(g => ({ done: r.done.includes(g), color: DCOL[GAME[g].domain] })), 132, UI.mascot(mood, p.color, 86));

    const who = S.profiles.length > 1 ? h('div', { class: 'who' }, S.profiles.map(q => h('button', { class: 'who-chip' + (q.id === p.id ? ' on' : ''), onclick: () => { S.cur = q.id; save(); home(); } }, h('span', { class: 'who-av', html: UI.mascot('happy', q.color || 'pink', 26) }), q.name))) : null;

    const steps = h('ol', { class: 'steps' }, r.plan.map((gid, i) => {
      const g = GAME[gid], done = r.done.includes(gid), lv = gst(p, gid).level;
      return h('li', null, h('button', { class: 'step' + (done ? ' done' : '') + (gid === nextG ? ' next' : ''), onclick: () => intro(gid, true) },
        h('span', { class: 'step-n' }, done ? ic('check', 16) : String(i + 1)),
        tile(gid, 46),
        h('span', { class: 'step-tx' }, h('b', null, g.name), h('small', null, g.short)),
        h('span', { class: 'step-side' }, h('span', { class: 'lv' }, 'Lv.' + lv), ic('next', 18, 'chev'))));
    }));

    const hero = h('section', { class: 'hero-card' + (allDone ? ' done' : '') },
      h('div', { class: 'hero-l' },
        h('span', { class: 'eyebrow' }, allDone ? '오늘 루틴 완료' : '오늘의 루틴'),
        h('h2', null, allDone ? '멋져요! 내일 또 만나요' : doneN ? `${total - doneN}개만 더 하면 끝!` : `${total}개 · 약 ${Math.max(6, total * 2 + 2)}분`),
        h('div', { class: 'pill-row' }, h('span', { class: 'pill flame' }, ic('flame', 15), `${st}일 연속`), h('span', { class: 'pill' }, `${doneN}/${total} 완료`)),
        !allDone && nextG
          ? h('button', { class: 'btn white lg', onclick: () => intro(nextG, true) }, ic('play', 18), doneN ? '이어서 하기' : '루틴 시작')
          : h('button', { class: 'btn white lg', onclick: () => go('free') }, '더 연습하기')),
      h('div', { class: 'hero-r', html: ringHtml }));

    shell(
      h('header', { class: 'top' },
        h('div', null, h('p', { class: 'top-date' }, longDate(today())), h('h1', null, `${hello}, ${p.name}!`)),
        h('button', { class: 'icon-btn', 'aria-label': S.settings.sound ? '소리 끄기' : '소리 켜기', onclick: () => { S.settings.sound = !S.settings.sound; save(); home(); } }, ic(S.settings.sound ? 'sound' : 'mute', 20))),
      who, hero,
      section(h('div', { class: 'row between' }, h('h2', null, '오늘의 활동'), h('span', { class: 'muted small' }, '순서대로 하면 좋아요')), steps),
      week(p),
      section('나의 두뇌 힘', h('div', { class: 'doms' }, ['ps', 'wm', 'ef'].map(d => {
        const v = domainLevel(p, d);
        return h('div', { class: 'dom ' + d }, h('div', { class: 'dom-h' }, h('span', { class: 'dom-n' }, DOMAINS[d].name), h('b', null, v == null ? '—' : v.toFixed(1), h('small', null, ' /10'))),
          h('div', { class: 'bar' }, h('i', { style: `width:${v == null ? 0 : v * 10}%` })), h('small', { class: 'muted' }, DOMAINS[d].desc));
      })), h('p', { class: 'fine' }, '각 활동의 현재 레벨을 영역별로 평균한 값이에요.')),
      installCard(),
      storageOk ? null : h('p', { class: 'warn' }, '이 브라우저에서는 기록이 저장되지 않아요(사생활 보호 모드 등). 일반 창에서 열어 주세요.'));
  }
  function week(p) {
    const t = today(); const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(t, -i));
    const n = days.filter(d => isComplete(p.days[d])).length;
    return section(h('div', { class: 'row between' }, h('h2', null, '이번 주'), h('span', { class: 'muted small' }, `7일 중 ${n}일 완료`)),
      h('div', { class: 'week' }, days.map(d => {
        const r = p.days[d], c = isComplete(r), part = r && (r.done || []).length && !c;
        return h('div', { class: 'wd' + (d === t ? ' today' : '') }, h('small', null, WK[dow(d)]),
          h('span', { class: 'dot' + (c ? ' full' : part ? ' half' : '') }, c ? ic('check', 16) : String(+d.slice(8))));
      })));
  }

  /* ---------- 활동 설명 ---------- */
  function intro(gid, fromRoutine) {
    const g = GAME[gid], p = cur(), st = gst(p, gid);
    const last = p.sessions.filter(s => s.g === gid).slice(-1)[0];
    const dur = g.sec ? `${g.sec}초` : gid === 'hanoi' ? '2~4분' : gid === 'trail' ? '1~2분' : '약 2분';
    const lvDots = h('div', { class: 'lvdots', 'aria-label': `레벨 ${st.level} / ${g.max}` }, [...Array(g.max)].map((_, i) => h('i', { class: i < st.level ? 'on' : '' })));
    screen('intro ' + g.domain,
      h('div', { class: 'bar-top' }, h('button', { class: 'icon-btn', 'aria-label': '돌아가기', onclick: () => go(view) }, ic('back', 20))),
      h('div', { class: 'intro-hero' }, tile(gid, 84), h('h1', null, g.name), h('p', null, g.short),
        h('div', { class: 'pill-row center' }, domChip(g.domain), h('span', { class: 'pill' }, ic('clock', 14), dur)),
        h('div', { class: 'lvbox' }, h('div', { class: 'row between' }, h('b', null, `Lv.${st.level}`), h('small', { class: 'muted' }, `최고 Lv.${g.max}`)), lvDots)),
      section('이렇게 해요', h('ol', { class: 'how' }, g.how.map(x => h('li', { html: x }))), g.note ? h('p', { class: 'fine' }, g.note) : null),
      h('section', { class: 'card tip' }, h('span', { class: 'tip-ic', html: UI.svg('bulb', 20) }), h('div', null, h('b', null, '작전'), h('p', null, g.tip))),
      last ? h('p', { class: 'muted center small' }, `지난번 ${md(last.d)} · ${last.label}`) : null,
      h('div', { class: 'sticky-go' }, h('button', { class: 'btn pri xl wide', onclick: () => play(gid, fromRoutine) }, ic('play', 20), '시작하기')));
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
    const quit = h('button', { class: 'icon-btn', 'aria-label': '그만하기', onclick: () => { if (confirm('그만할까요? 이번 기록은 저장되지 않아요.')) abort(); } }, ic('close', 20));
    const wrap = h('div', { class: 'play ' + g.domain },
      h('div', { class: 'play-top' }, quit,
        h('div', { class: 'play-title' }, h('b', null, g.name), h('small', null, `Lv.${st.level}`)),
        h('div', { class: 'hud-pills' }, hudLbl, hudScore)),
      h('div', { class: 'hud' }, hudBar),
      stage, overlay);
    $app.replaceChildren(wrap);
    const onKey = e => { if (!alive) return; if (e.key === 'Escape') { quit.click(); return; } keyFns.forEach(f => f(e)); };
    document.addEventListener('keydown', onKey);
    const cleanup = () => { alive = false; timers.forEach(clearTimeout); ivs.forEach(clearInterval); document.removeEventListener('keydown', onKey); keyFns = []; try { speechSynthesis.cancel(); } catch (e) { } active = null; };
    const abort = () => { cleanup(); const snap = JSON.parse(snapshot); Object.keys(st).forEach(k => { if (!(k in snap)) delete st[k]; }); Object.assign(st, snap); go(view); };
    const t0 = Date.now();
    let combo = 0;
    const ctx = {
      stage, st,
      later(fn, ms) { const id = setTimeout(() => { if (alive) fn(); }, ms); timers.push(id); return id; },
      cancel(id) { clearTimeout(id); },
      every(fn, ms) { const id = setInterval(() => { if (alive) fn(); }, ms); ivs.push(id); return id; },
      wait(ms) { return new Promise(res => ctx.later(res, ms)); },
      hud(o) {
        if (o.frac != null) { const f = Math.max(0, Math.min(1, o.frac)); hudBar.style.width = f * 100 + '%'; hudBar.classList.toggle('low', !!(g.sec && f < 0.17)); }
        if (o.label != null) hudLbl.textContent = o.label;
        if (o.score != null) { hudScore.textContent = '★ ' + o.score; hudScore.classList.add('on'); }
      },
      fb(ok) {
        stage.classList.remove('fb-ok', 'fb-bad'); void stage.offsetWidth;
        stage.classList.add(ok ? 'fb-ok' : 'fb-bad');
        combo = ok ? combo + 1 : 0;
        if (ok && combo > 0 && combo % 5 === 0) ctx.msg(`${combo}연속 정답!`, 700, 'combo');
        ok ? sfx.ok() : sfx.bad();
        if (!ok && navigator.vibrate) try { navigator.vibrate(35); } catch (e) { }
      },
      miss() { stage.classList.remove('fb-miss'); void stage.offsetWidth; stage.classList.add('fb-miss'); sfx.miss(); combo = 0; },
      msg(t, ms, cls) { const el = h('div', { class: 'flash-msg' + (cls ? ' ' + cls : '') }, t); stage.append(el); ctx.later(() => el.remove(), ms || 900); },
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
    overlay.classList.add('on');
    let n = 3;
    const cd = () => {
      if (!alive) return;
      if (n === 0) { overlay.classList.remove('on'); g.play(ctx); return; }
      overlay.replaceChildren(h('div', { class: 'count' }, h('span', { key: n }, String(n)), h('small', null, n === 3 ? '준비' : n === 2 ? '집중' : '시작!')));
      sfx.blip(); n--; ctx.later(cd, 700);
    };
    cd();
  }

  /* ---------- 결과 ---------- */
  function resultView(gid, s, prev, fromRoutine) {
    const g = GAME[gid], p = cur(), r = todayRec(p);
    const nextG = r.plan.find(x => !r.done.includes(x));
    const routineDone = isComplete(r) && fromRoutine && !r.celebrated;
    const nStars = starsOf(s, g);
    let cmp = null;
    if (prev) {
      if (prev.lv !== s.lv - s.delta) cmp = `지난번은 Lv.${prev.lv}에서 했어요`;
      else if (s.score !== prev.score && s.score !== 999 && prev.score !== 999) {
        const better = g.lowerBetter ? s.score < prev.score : s.score > prev.score;
        cmp = better ? `지난번(${prev.label})보다 좋아졌어요` : `지난번 기록 · ${prev.label}`;
      } else cmp = `지난번 기록 · ${prev.label}`;
    }
    const lvBadge = s.delta > 0
      ? h('div', { class: 'lvmsg up' }, ic('trophy', 20), h('span', null, h('b', null, '레벨 업! '), `Lv.${s.lv - s.delta} → Lv.${s.lv}`))
      : s.delta < 0 ? h('div', { class: 'lvmsg dn' }, h('span', null, `다음엔 Lv.${s.lv}에서 한 번 더 다져요`))
        : h('div', { class: 'lvmsg' }, h('span', null, s.acc != null && s.acc < 0.75 ? `Lv.${s.lv} 유지 · 빠르기보다 정확하게가 먼저예요` : `Lv.${s.lv} 유지 · 한 번 더 잘하면 올라가요`));
    const score = h('div', { class: 'res-score' });
    const actions = h('div', { class: 'res-actions' });
    if (routineDone) actions.append(h('button', { class: 'btn pri xl wide', onclick: () => doneView() }, ic('trophy', 20), '오늘 루틴 완료!'));
    else if (fromRoutine && nextG) actions.append(h('button', { class: 'btn pri xl wide next-btn', onclick: () => intro(nextG, true) }, tile(nextG, 30), h('span', null, h('small', null, '다음 활동'), GAME[nextG].name), ic('next', 20)));
    actions.append(h('div', { class: 'row2' }, h('button', { class: 'btn soft lg', onclick: () => play(gid, fromRoutine) }, '한 번 더'), h('button', { class: 'btn soft lg', onclick: () => go(view) }, '홈으로')));
    const statTile = (icn, label, val) => h('div', { class: 'stat' }, ic(icn, 18), h('small', null, label), h('b', null, val));
    screen('result ' + g.domain,
      h('div', { class: 'res-hero' }, tile(gid, 64), h('p', { class: 'res-name' }, g.name), h('div', { html: UI.stars(nStars) }), score, s.sub ? h('div', { class: 'res-sub' }, s.sub) : null),
      lvBadge,
      h('div', { class: 'stats' },
        s.acc != null ? statTile('target', '정확도', Math.round(s.acc * 100) + '%') : null,
        s.rt ? statTile('bolt', '반응 속도', (s.rt / 1000).toFixed(2) + '초') : null,
        statTile('clock', '걸린 시간', s.dur + '초')),
      cmp ? h('p', { class: 'muted center small' }, cmp) : null,
      h('section', { class: 'card tip' }, h('span', { class: 'tip-ic', html: UI.svg('bulb', 20) }), h('div', null, h('b', null, '다음 작전'), h('p', null, g.tip))),
      actions);
    UI.countUp(score, s.label);
    if (s.delta > 0) { sfx.fan(); UI.confetti(70); }
  }
  function doneView() {
    const p = cur(), r = todayRec(p);
    r.celebrated = true; save();
    sfx.fan(); setTimeout(() => UI.confetti(160), 150);
    const ses = p.sessions.filter(s => s.d === today() && r.plan.includes(s.g));
    const ups = ses.filter(s => s.delta > 0).length;
    const pickRow = (opts, key) => {
      const row = h('div', { class: 'moods' }, opts.map(([mood, t]) => h('button', { class: 'mood' + (r[key] === t ? ' on' : ''), onclick: ev => { r[key] = t; save(); sfx.tap(); [...row.children].forEach(c => c.classList.toggle('on', c === ev.currentTarget)); } }, mood ? h('span', { html: UI.mascot(mood, p.color, 46) }) : null, h('small', null, t))));
      return row;
    };
    screen('done',
      h('div', { class: 'done-hero' }, h('div', { class: 'done-halo' }, mascotEl('cheer', p.color, 150, 'bounce')),
        h('h1', null, '오늘 루틴 완료!'), h('p', null, longDate(today())),
        h('div', { class: 'pill-row center' }, h('span', { class: 'pill flame big' }, ic('flame', 16), `${streak(p)}일 연속`), ups ? h('span', { class: 'pill gold big' }, ic('trophy', 16), `레벨 업 ${ups}개`) : null)),
      section('오늘 한 활동', h('ul', { class: 'done-list' }, ses.map(s => h('li', null, tile(s.g, 36), h('span', { class: 'dl-n' }, GAME[s.g].name), h('b', null, s.label), s.delta > 0 ? h('em', { class: 'up' }, '▲') : null)))),
      section('오늘 루틴은 어땠나요?', pickRow([['happy', '쉬웠어요'], ['calm', '딱 좋았어요'], ['tired', '어려웠어요']], 'mood'),
        h('h3', { class: 'sub-h' }, '집중은 어땠나요?'), pickRow([[null, '끝까지 집중했어요'], [null, '중간에 딴생각했어요']], 'focus'),
        h('p', { class: 'fine' }, '스스로 돌아보는 것도 실행기능 연습이에요. 주간 리포트에 함께 담겨요.')),
      h('button', { class: 'btn pri xl wide', onclick: () => go('home') }, '홈으로'));
  }

  /* ---------- 자유 연습 ---------- */
  function free() {
    view = 'free';
    const p = cur(); if (!p) return onboarding();
    shell(h('header', { class: 'top' }, h('div', null, h('p', { class: 'top-date' }, '활동 11가지'), h('h1', null, '자유 연습'))),
      h('p', { class: 'lead' }, '원하는 활동을 골라 더 연습해요. 오늘 루틴에 있는 활동이면 완료로 표시돼요.'),
      ['ps', 'wm', 'ef'].map(d => h('section', { class: 'grp' },
        h('div', { class: 'grp-h' }, domChip(d), h('span', { class: 'muted small' }, DOMAINS[d].desc)),
        h('div', { class: 'game-grid' }, GAMES.filter(g => g.domain === d).map(g => h('button', { class: 'game-card' + (p.exclude.includes(g.id) ? ' dim' : ''), onclick: () => intro(g.id, false) },
          tile(g.id, 52), h('b', null, g.name), h('small', null, g.short), h('span', { class: 'lv' }, `Lv.${gst(p, g.id).level}`)))))));
  }

  /* ---------- 기록 ---------- */
  function spark(vals, max, dom) {
    if (vals.length < 2) return h('span', { class: 'spark-empty' }, vals.length ? '1회' : '기록 없음');
    const W = 110, H = 34, n = vals.length;
    const pts = vals.map((v, i) => [(i / (n - 1) * (W - 8) + 4), (H - 4 - (v / max) * (H - 8))]);
    const line = pts.map(q => q.map(x => x.toFixed(1)).join(',')).join(' ');
    const area = `M${pts[0][0].toFixed(1)},${H} L${line.replace(/ /g, ' L')} L${pts[n - 1][0].toFixed(1)},${H} Z`;
    const [lx, ly] = pts[n - 1];
    return h('span', { class: 'spark ' + dom, html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${area}" fill="currentColor" opacity=".12"/><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.6" fill="currentColor"/></svg>` });
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
    const kpi = (icn, cls, val, label) => h('div', { class: 'kpi ' + cls }, ic(icn, 18), h('b', null, val), h('small', null, label));
    shell(
      h('header', { class: 'top' }, h('div', null, h('p', { class: 'top-date' }, p.name), h('h1', null, '나의 기록'))),
      h('div', { class: 'kpis' }, kpi('calendar', 'a', completeDays + '일', '루틴 완료'), kpi('flame', 'b', streak(p) + '일', '연속'), kpi('bolt', 'c', p.sessions.length + '회', '전체 활동')),
      section(h('div', { class: 'cal-head' }, h('button', { class: 'icon-btn sm', 'aria-label': '이전 달', onclick: () => shift(-1) }, ic('back', 18)), h('b', null, `${+calYM.slice(0, 4)}년 ${+calYM.slice(5)}월`), h('button', { class: 'icon-btn sm', 'aria-label': '다음 달', onclick: () => shift(1) }, ic('next', 18))),
        calendar(p, calYM), h('div', { class: 'legend' }, h('span', null, h('i', { class: 'full' }), '루틴 완료'), h('span', null, h('i', { class: 'half' }), '일부만 함'))),
      section(h('div', { class: 'row between' }, h('h2', null, '활동별 레벨'), h('span', { class: 'muted small' }, '최근 12회')),
        h('div', { class: 'glist' }, GAMES.map(g => {
          const ss = p.sessions.filter(s => s.g === g.id);
          const best = ss.length ? Math.max(...ss.map(s => s.lv)) : null;
          return h('div', { class: 'grow' }, tile(g.id, 38), h('span', { class: 'gr-n' }, h('b', null, g.name), h('small', null, best ? `최고 Lv.${best}` : '아직 안 했어요')), spark(ss.slice(-12).map(s => s.lv), g.max, g.domain), h('span', { class: 'gr-v' }, ss.length ? `Lv.${gst(p, g.id).level}` : '—'));
        }))),
      section('최근 활동', recent.length ? h('ul', { class: 'recent' }, recent.map(s => {
        const g = GAME[s.g]; if (!g) return null;
        return h('li', null, tile(s.g, 34), h('span', { class: 're-n' }, h('b', null, g.name), h('small', null, md(s.d))), h('span', { class: 're-v' }, h('b', null, s.label), h('small', { class: s.delta > 0 ? 'up' : s.delta < 0 ? 'dn' : '' }, `Lv.${s.lv}${s.delta > 0 ? ' ▲' : s.delta < 0 ? ' ▼' : ''}`)));
      })) : h('div', { class: 'empty' }, mascotEl('calm', p.color, 80), h('p', null, '아직 기록이 없어요. 오늘 루틴부터 시작해요!'))));
  }

  /* ---------- 관리 (보호자·선생님) ---------- */
  let teacherOpen = false;
  function askPin() {
    let val = '';
    const dots = h('div', { class: 'pin-dots' });
    const draw = (bad) => { dots.replaceChildren(...[...Array(4)].map((_, i) => h('i', { class: i < val.length ? 'on' : '' }))); dots.classList.toggle('bad', !!bad); };
    const pinLen = () => S.settings.pin.length;
    const press = d => {
      if (d === 'del') val = val.slice(0, -1); else if (val.length < 8) val += d;
      draw();
      if (val.length >= pinLen()) {
        if (val === S.settings.pin) { teacherOpen = true; bg.closeModal(); setTimeout(() => go('teacher'), 190); }
        else { draw(true); sfx.bad(); setTimeout(() => { val = ''; draw(); }, 450); }
      }
    };
    draw();
    const pad = h('div', { class: 'pin-pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(k => k ? h('button', { class: 'pin-k' + (k === 'del' ? ' del' : ''), onclick: () => press(k) }, k === 'del' ? ic('back', 20) : k) : h('span')));
    const onKey = e => { if (!document.body.contains(bg)) return document.removeEventListener('keydown', onKey); if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
    document.addEventListener('keydown', onKey);
    const bg = modal('관리 메뉴', h('div', { class: 'pin' }, h('span', { class: 'pin-ic', html: UI.svg('lock', 26) }), h('p', { class: 'muted small center' }, '보호자·선생님용 메뉴예요. 비밀번호를 입력해 주세요.'), dots, pad, h('p', { class: 'fine center' }, '처음 비밀번호는 0000이에요. 들어간 뒤 꼭 바꿔 주세요.')));
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
  const HOME_TIP = {
    ps: '장보기 목록 빨리 찾기, 숨은그림찾기처럼 “정확하게, 점점 빠르게” 하는 놀이를 권합니다. 속도보다 정확도를 먼저 칭찬해 주세요.',
    wm: '심부름을 2~3단계로 한 번에 말해 주고 순서대로 해 보게 하거나, 전화번호 거꾸로 말하기 놀이를 권합니다.',
    ef: '숙제 전 “무엇부터 할지” 순서를 말로 정하게 하고, 끝난 뒤 계획대로 되었는지 함께 돌아보는 습관을 권합니다.'
  };
  function report(p) {
    const w = weekStats(p);
    const fmt = v => v == null ? '기록 없음' : v.toFixed(1);
    const diff = d => d == null ? '' : d > 0 ? ` (지난주보다 +${d.toFixed(1)})` : d < 0 ? ` (${d.toFixed(1)})` : ' (유지)';
    const L = [];
    L.push(`${S.settings.academy ? `[${S.settings.academy}] ` : ''}브레인 루틴 주간 리포트`);
    L.push(`이름: ${p.name} (${p.grade})`);
    L.push(`기간: ${md(w.from)} ~ ${md(w.to)}`, '');
    L.push(`■ 참여: 루틴 완료 ${w.comp}일 / 7일` + (w.part > w.comp ? ` (일부 참여 ${w.part - w.comp}일)` : '') + ` · 연속 ${streak(p)}일 · 활동 ${w.ses.length}회`, '');
    L.push('■ 영역별 수준 (10점 기준)');
    ['ps', 'wm', 'ef'].forEach(d => L.push(`- ${DOMAINS[d].name}: ${fmt(w.dom[d].now)}${diff(w.dom[d].diff)}`));
    const dg = p.sessions.filter(s => s.g === 'digits').slice(-1)[0], gr = p.sessions.filter(s => s.g === 'grid').slice(-1)[0];
    const det = [];
    if (dg) det.push(`숫자 기억 순서대로 ${dg.m.fwd || '-'}자리 / 거꾸로 ${dg.m.bwd || '-'}자리`);
    if (gr) det.push(`위치 기억 순서대로 ${gr.m.fwd || '-'}개 / 거꾸로 ${gr.m.bwd || '-'}개`);
    if (det.length) L.push('  · ' + det.join(' · '));
    const ups = w.ses.filter(s => s.delta > 0).map(s => GAME[s.g].name);
    if (ups.length) L.push(`- 이번 주 레벨 업: ${[...new Set(ups)].join(', ')}`);
    L.push('');
    const have = ['ps', 'wm', 'ef'].filter(d => w.dom[d].now != null);
    if (have.length >= 2) {
      const sorted = have.slice().sort((a, b) => w.dom[b].now - w.dom[a].now);
      L.push(`■ 강점: ${DOMAINS[sorted[0]].name} — ${DOMAINS[sorted[0]].desc}이 안정적입니다.`);
      const weak = sorted[sorted.length - 1];
      L.push(`■ 보완: ${DOMAINS[weak].name} — ${HOME_TIP[weak]}`);
    }
    const moods = w.days.map(d => p.days[d] && p.days[d].mood).filter(Boolean);
    if (moods.length) {
      const hard = moods.filter(m => m === '어려웠어요').length;
      L.push(`■ 스스로 평가: ${moods.length}일 중 '어려웠어요' ${hard}일` + (hard >= Math.ceil(moods.length / 2) ? ' — 난이도를 한 단계 낮추어 자신감을 먼저 다지는 것을 권합니다.' : ''));
    }
    L.push('');
    L.push(w.comp >= 5 ? '꾸준한 참여가 가장 큰 성과입니다. 같은 시간에 루틴을 이어 갈 수 있도록 격려해 주세요.' : '주 5일 이상, 같은 시간대 참여를 권장합니다. 하루 10분이면 충분합니다.');
    L.push('※ 본 리포트는 연습 기록이며 지능·발달 검사 결과가 아닙니다.');
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('복사했어요. 카톡에 붙여 넣으세요.'); }
    catch (e) { const ta = h('textarea', { class: 'inp', style: 'height:260px' }); ta.value = t; modal('길게 눌러 복사하세요', ta); ta.select(); }
  }
  function download(name, text, type) {
    const b = new Blob([text], { type: type || 'application/json' });
    const a = h('a', { href: URL.createObjectURL(b), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv() {
    const rows = [['이름', '학년', '날짜', '활동', '영역', '레벨', '레벨변화', '결과', '세부', '정확도', '반응시간ms', '걸린초', '루틴']];
    S.profiles.forEach(p => p.sessions.forEach(s => { const g = GAME[s.g] || {}; rows.push([p.name, p.grade, s.d, g.name || s.g, g.domain ? DOMAINS[g.domain].name : '', s.lv, s.delta, s.label, s.sub || '', s.acc == null ? '' : Math.round(s.acc * 100) + '%', s.rt || '', s.dur, s.routine ? 'O' : '']); }));
    return '﻿' + rows.map(r => r.map(c => { c = String(c); return /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; }).join(',')).join('\n');
  }
  function teacher() {
    view = 'teacher';
    const cards = S.profiles.map(p => {
      const w = weekStats(p), last = p.sessions.slice(-1)[0];
      return h('button', { class: 'pcard', onclick: () => studentDetail(p) },
        h('span', { class: 'pc-av', html: UI.mascot('happy', p.color || 'pink', 44) }),
        h('span', { class: 'pc-main' }, h('b', null, p.name, h('small', null, ' ' + p.grade)), h('small', { class: 'muted' }, `이번 주 ${w.comp}/7일 · 연속 ${streak(p)}일 · 최근 ${last ? md(last.d) : '—'}`),
          h('span', { class: 'pc-doms' }, ['ps', 'wm', 'ef'].map(d => h('span', { class: 'pc-d ' + d }, DOMAINS[d].name.slice(0, 2) + ' ', h('b', null, w.dom[d].now == null ? '—' : w.dom[d].now.toFixed(1)), w.dom[d].diff ? h('em', { class: w.dom[d].diff > 0 ? 'up' : 'dn' }, w.dom[d].diff > 0 ? '▲' : '▼') : null)))),
        ic('next', 18, 'chev'));
    });
    const act = (icn, t, fn) => h('button', { class: 'act', onclick: fn }, h('span', { class: 'act-ic', html: UI.svg(icn, 20) }), t);
    shell(
      h('header', { class: 'top' }, h('div', null, h('p', { class: 'top-date' }, '보호자 · 선생님'), h('h1', null, '관리')), h('button', { class: 'btn soft sm', onclick: () => { teacherOpen = false; go('home'); } }, ic('lock', 16), '잠그기')),
      section(h('div', { class: 'row between' }, h('h2', null, `학습자 ${S.profiles.length}명`), h('button', { class: 'btn pri sm', onclick: addStudentModal }, ic('plus', 16), '추가')),
        S.profiles.length ? h('div', { class: 'plist' }, cards) : h('p', { class: 'muted' }, '등록된 학습자가 없어요.'),
        h('p', { class: 'fine' }, '눌러서 주간 리포트 · 루틴 설정 · 레벨 조정을 할 수 있어요. 점수는 10점 기준, ▲▼는 지난주 대비.')),
      section('기록 보관', h('p', { class: 'muted small' }, '기록은 이 기기에만 저장됩니다. 한 달에 한 번 백업 파일을 받아 두세요. 기기를 바꿀 때도 백업 → 불러오기로 옮깁니다.'),
        h('div', { class: 'acts' },
          act('download', '백업 받기', () => download(`브레인루틴_백업_${today()}.json`, JSON.stringify(S))),
          h('label', { class: 'act' }, h('span', { class: 'act-ic', html: UI.svg('upload', 20) }), '불러오기', h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: e => restore(e.target.files[0]) })),
          act('table', '엑셀 CSV', () => download(`브레인루틴_기록_${today()}.csv`, csv(), 'text/csv;charset=utf-8')))),
      section('설정', settingsForm()));
  }
  function addStudentModal() {
    let grade = '초3', color = COLORS[S.profiles.length % COLORS.length];
    const name = h('input', { class: 'inp', placeholder: '이름', maxlength: 12 });
    const gradeRow = h('div', { class: 'chips' }, GRADES.map(g => h('button', { class: 'chip' + (g === grade ? ' on' : ''), onclick: ev => { grade = g; [...gradeRow.children].forEach(c => c.classList.toggle('on', c === ev.currentTarget)); } }, g)));
    const colorRow = h('div', { class: 'swatches' }, COLORS.map(c => h('button', { class: 'sw' + (c === color ? ' on' : ''), style: `--a:${UI.PALETTE[c][0]};--b:${UI.PALETTE[c][1]}`, onclick: ev => { color = c; [...colorRow.children].forEach(x => x.classList.toggle('on', x === ev.currentTarget)); } })));
    modal('학습자 추가', h('div', { class: 'form' }, h('label', { class: 'fld' }, h('span', null, '이름'), name), h('div', { class: 'fld' }, h('span', null, '학년'), gradeRow), h('div', { class: 'fld' }, h('span', null, '브레니 색깔'), colorRow)),
      [['취소', null], ['추가', () => { const n = name.value.trim(); if (!n) { name.focus(); return false; } newProfile(n, grade, color); view === 'teacher' ? teacher() : home(); toast(`${n} 추가 완료`); }, 'pri']]);
    setTimeout(() => name.focus(), 80);
  }
  function toggle(checked) { const i = h('input', { type: 'checkbox', class: 'tg', ...(checked ? { checked: '' } : {}) }); return i; }
  function settingsForm() {
    const ac = h('input', { class: 'inp', placeholder: '리포트 머리말 (예: 학원 이름, 비워도 됨)', value: S.settings.academy || '' });
    const pin = h('input', { class: 'inp', placeholder: '새 비밀번호 (숫자 4~8자리)', inputmode: 'numeric', maxlength: 8, type: 'password' });
    const voice = toggle(S.settings.voice), sound = toggle(S.settings.sound);
    const row = (t, s, el) => h('label', { class: 'set-row' }, h('span', null, h('b', null, t), s ? h('small', null, s) : null), el);
    return h('div', { class: 'form' },
      row('효과음', '정답·오답 소리', sound),
      row('숫자 읽어 주기', '숫자 기억에서 기기 음성으로 읽기', voice),
      h('label', { class: 'fld' }, h('span', null, '리포트 머리말'), ac),
      h('label', { class: 'fld' }, h('span', null, '관리 비밀번호 바꾸기'), pin),
      h('button', { class: 'btn pri lg', onclick: () => { S.settings.academy = ac.value.trim(); S.settings.voice = voice.checked; S.settings.sound = sound.checked; if (pin.value) { if (!/^\d{4,8}$/.test(pin.value)) { toast('비밀번호는 숫자 4~8자리예요.'); return; } S.settings.pin = pin.value; pin.value = ''; } save(); toast('저장했어요.'); } }, '설정 저장'));
  }
  function restore(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (!d || !Array.isArray(d.profiles)) throw new Error('형식');
        modal('백업 불러오기', h('p', null, `백업 파일에 ${d.profiles.length}명의 기록이 있어요. 지금 기기의 기록(${S.profiles.length}명)을 어떻게 할까요?`), [
          ['취소', null],
          ['합치기', () => { d.profiles.forEach(np => { const i = S.profiles.findIndex(q => q.id === np.id); if (i >= 0) { if (np.sessions.length >= S.profiles[i].sessions.length) S.profiles[i] = np; } else S.profiles.push(np); }); if (!cur() && S.profiles[0]) S.cur = S.profiles[0].id; save(); teacher(); toast('합쳤어요.'); }],
          ['덮어쓰기', () => { const pinKeep = S.settings.pin; S = Object.assign(blank(), d); S.settings = Object.assign(blank().settings, d.settings || {}, { pin: pinKeep }); save(); teacher(); toast('불러왔어요.'); }, 'pri']]);
      } catch (e) { toast('백업 파일을 읽을 수 없어요.'); }
    };
    fr.readAsText(file);
  }
  function studentDetail(p) {
    let grade = p.grade, color = p.color || 'pink', size = p.size;
    const name = h('input', { class: 'inp', value: p.name, maxlength: 12 });
    const gradeRow = h('div', { class: 'chips' }, GRADES.concat(GRADES.includes(p.grade) ? [] : [p.grade]).map(g => h('button', { class: 'chip' + (g === grade ? ' on' : ''), onclick: ev => { grade = g; [...gradeRow.children].forEach(c => c.classList.toggle('on', c === ev.currentTarget)); } }, g)));
    const colorRow = h('div', { class: 'swatches' }, COLORS.map(c => h('button', { class: 'sw' + (c === color ? ' on' : ''), style: `--a:${UI.PALETTE[c][0]};--b:${UI.PALETTE[c][1]}`, onclick: ev => { color = c; [...colorRow.children].forEach(x => x.classList.toggle('on', x === ev.currentTarget)); } })));
    const sizeRow = h('div', { class: 'seg' }, [[3, '짧게 3개', '약 6분'], [4, '기본 4개', '약 10분'], [5, '길게 5개', '약 13분']].map(([v, t, s]) => h('button', { class: 'seg-b' + (v === size ? ' on' : ''), onclick: ev => { size = v; [...sizeRow.children].forEach(c => c.classList.toggle('on', c === ev.currentTarget)); } }, h('b', null, t), h('small', null, s))));
    const ex = GAMES.map(g => [g, toggle(!p.exclude.includes(g.id))]);
    const lvInputs = GAMES.map(g => [g, h('select', { class: 'inp sm' }, [...Array(g.max)].map((_, i) => h('option', { value: i + 1, ...(i + 1 === gst(p, g.id).level ? { selected: '' } : {}) }, `Lv.${i + 1}`)))]);
    const rep = report(p);
    const body = h('div', { class: 'detail' },
      h('div', { class: 'sub-h' }, '주간 리포트'),
      h('pre', { class: 'report' }, rep),
      h('button', { class: 'btn pri lg wide', onclick: () => copyText(rep) }, ic('copy', 18), '리포트 복사 (카톡에 붙여 넣기)'),
      h('div', { class: 'sub-h' }, '기본 정보'),
      h('div', { class: 'form' }, h('label', { class: 'fld' }, h('span', null, '이름'), name), h('div', { class: 'fld' }, h('span', null, '학년'), gradeRow), h('div', { class: 'fld' }, h('span', null, '브레니 색깔'), colorRow)),
      h('div', { class: 'sub-h' }, '하루 루틴 길이'), sizeRow,
      h('div', { class: 'sub-h' }, '루틴에 넣을 활동'),
      h('p', { class: 'fine' }, '끄면 오늘의 루틴에서 빠져요(자유 연습에는 남아요). 영역마다 하나 이상은 켜 두세요.'),
      h('div', { class: 'tg-list' }, ex.map(([g, c]) => h('label', { class: 'set-row' }, h('span', { class: 'tg-n' }, tile(g.id, 30), h('b', null, g.name)), c))),
      h('div', { class: 'sub-h' }, '레벨 직접 조정'),
      h('p', { class: 'fine' }, '첫 주에 너무 쉽거나 어려우면 맞춰 주세요. 이후에는 자동으로 오르내립니다.'),
      h('div', { class: 'lv-grid' }, lvInputs.map(([g, s]) => h('label', null, h('span', { class: 'tg-n' }, tile(g.id, 28), g.name), s))),
      h('div', { class: 'sub-h' }, '기타'),
      h('div', { class: 'row2' },
        h('button', { class: 'btn soft', onclick: () => { if (confirm(`${p.name}의 오늘 루틴을 다시 짤까요? (오늘 완료 표시가 지워져요)`)) { delete p.days[today()]; save(); toast('오늘 루틴을 다시 짰어요.'); } } }, '오늘 루틴 다시 짜기'),
        h('button', { class: 'btn danger', onclick: () => { if (confirm(`${p.name}의 모든 기록을 지울까요? 되돌릴 수 없어요.`)) { S.profiles = S.profiles.filter(q => q.id !== p.id); if (S.cur === p.id) S.cur = S.profiles[0] ? S.profiles[0].id : null; save(); m.closeModal(); teacher(); } } }, '삭제')));
    const m = modal(`${p.name} 관리`, body, [['닫기', null], ['저장', () => {
      const exNew = ex.filter(([, c]) => !c.checked).map(([g]) => g.id);
      if (['ps', 'wm', 'ef'].some(d => GAMES.filter(g => g.domain === d).every(g => exNew.includes(g.id)))) { toast('영역마다 활동을 하나 이상 켜 두세요.'); return false; }
      p.name = name.value.trim() || p.name; p.grade = grade; p.color = color; p.size = size; p.exclude = exNew;
      lvInputs.forEach(([g, s]) => { gst(p, g.id).level = +s.value; });
      const tr = p.days[today()];
      if (tr && !(tr.done || []).length) tr.plan = computePlan(p);
      save(); teacher(); toast('저장했어요.');
    }, 'pri']]);
  }

  /* ---------- 안내 ---------- */
  function guide() {
    view = 'guide';
    const dom = d => h('div', { class: 'gd ' + d }, h('div', { class: 'gd-h' }, domChip(d), h('small', { class: 'muted' }, DOMAINS[d].desc)),
      h('ul', { class: 'gd-list' }, GAMES.filter(g => g.domain === d).map(g => h('li', null, tile(g.id, 34), h('span', null, h('b', null, g.name), h('small', null, g.short))))));
    const li = (b, t) => h('li', null, h('b', null, b), t);
    shell(
      h('header', { class: 'top' }, h('div', null, h('p', { class: 'top-date' }, '보호자 · 선생님이 먼저 읽어 주세요'), h('h1', null, '안내'))),
      section('하루 루틴은 이렇게 돌아가요',
        h('div', { class: 'flow' }, [['ps', '처리속도'], ['wm', '작업기억'], ['ef', '실행기능'], ['mix', '+1 번갈아']].map(([d, t], i) => h('div', { class: 'flow-s ' + d }, h('b', null, i + 1), t))),
        h('ul', { class: 'plain' },
          li('하루 약 10분 · ', '활동 하나는 1~3분이고, 하루 4개가 기본이에요(관리에서 3~5개로 조절).'),
          li('골고루 · ', '연습한 날 수에 따라 활동이 돌아가며 나와 첫 5일 안에 11가지를 모두 만나요.'),
          li('자동 난이도 · ', '정확도 90% 이상이면서 속도 기준을 넘으면 한 단계 오르고, 75% 아래면 내려가요. 늘 “조금 어려운” 수준을 유지해요.'),
          li('계단식 기억 · ', '숫자·위치 기억은 맞히면 한 자리 늘고 틀리면 한 자리 줄어요.'))),
      section('활동 11가지', h('div', { class: 'gd-wrap' }, dom('ps'), dom('wm'), dom('ef'))),
      section('잘 쓰는 법', h('ol', { class: 'plain num' },
        li('같은 시간, 같은 자리 · ', '숙제 전 10분처럼 시간을 정해 두면 습관이 돼요.'),
        li('작전 먼저 · ', '활동마다 나오는 작전(묶어 외우기, 속으로 말하기)을 써 보게 하세요. 전략을 고르는 것 자체가 실행기능 연습이에요.'),
        li('칭찬은 정확도와 꾸준함에 · ', '점수보다 “끝까지 집중했다”, “연속 5일”을 칭찬해 주세요.'),
        li('첫 주는 맞추는 기간 · ', '레벨이 맞을 때까지 1주 정도 걸려요. 너무 쉽거나 어려우면 관리에서 레벨을 조정하세요.'),
        li('피곤한 날은 짧게 · ', '억지로 길게 하기보다 짧게라도 매일이 나아요.'))),
      h('section', { class: 'card warnbox' }, h('div', { class: 'card-h' }, h('h2', null, '꼭 알아 두세요')),
        h('ul', { class: 'plain' },
          h('li', null, '이 앱은 연습 도구이며 ', h('b', null, '지능·발달 검사가 아닙니다'), '. 레벨은 같은 아이의 변화를 보는 용도이고, 다른 아이와 비교하거나 진단에 쓰지 마세요.'),
          h('li', null, '연구 결과를 보면 이런 훈련으로 ', h('b', null, '연습한 과제와 비슷한 과제'), '의 실력은 꾸준히 오르지만, 성적이나 지능까지 넓게 오른다는 근거는 아직 엇갈립니다. 독서·운동·수면과 함께하는 보조 루틴으로 생각해 주세요.'),
          h('li', null, '활동은 신경심리 연구에서 널리 쓰이는 과제 유형(기호 찾기·기호 바꾸기·숫자 따라 말하기·위치 기억·N-back·스트룹·규칙 전환·Go/No-go·선 잇기·하노이의 탑)을 본떠 새로 만든 것으로, 특정 책이나 검사 문항을 옮긴 것이 아닙니다.'),
          h('li', null, '주의집중이나 학습에 지속적인 어려움이 보이면 전문가 상담을 권합니다.'))),
      section('앱으로 설치하기', h('ul', { class: 'plain' },
        li('안드로이드·PC · ', '오늘 화면의 “설치” 버튼, 또는 브라우저 메뉴 ⋮ → “앱 설치”.'),
        h('li', null, h('b', null, '아이폰·아이패드 · '), 'Safari로 열고 공유 → “홈 화면에 추가”. ', h('button', { class: 'link', onclick: iosHelp }, '자세히 보기')),
        li('오프라인 · ', '설치하면 주소창 없이 앱처럼 열리고, 한 번 연 뒤에는 인터넷 없이도 돼요.'),
        li('아이폰 주의 · ', 'Safari와 설치한 앱의 기록은 따로 저장돼요. 처음부터 설치한 앱으로 쓰세요.'))),
      section('기기 · 저장', h('ul', { class: 'plain' },
        li('기기 · ', '태블릿·휴대폰·PC 모두 돼요. PC에서는 ←/→(F/J), 숫자키, 스페이스바로도 할 수 있어요.'),
        li('저장 · ', '기록은 이 기기에만 저장되고 밖으로 보내지 않아요. 브라우저 기록을 지우면 사라지니 관리에서 백업을 받아 두세요.'))),
      h('p', { class: 'fine center' }, '브레인 루틴 · 하루 10분 두뇌 루틴'));
  }

  /* ---------- 앱으로 설치 (PWA) ---------- */
  let deferredPrompt = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (view === 'home' && !active) home(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('설치했어요! 홈 화면의 아이콘으로 여세요.'); if (view === 'home' && !active) home(); });
  function installCard() {
    if (standalone() || S.settings.hideInstall || !/^https?:/.test(location.protocol)) return null;
    if (!deferredPrompt && !isIOS()) return null;
    const act = deferredPrompt
      ? h('button', { class: 'btn pri sm', onclick: async () => { const e = deferredPrompt; deferredPrompt = null; e.prompt(); try { await e.userChoice; } catch (er) { } home(); } }, '설치')
      : h('button', { class: 'btn pri sm', onclick: iosHelp }, '방법');
    return h('section', { class: 'card install' }, h('img', { src: 'icons/icon-192.png', alt: '' }), h('div', null, h('b', null, '앱으로 설치하기'), h('small', null, '홈 화면에서 바로 열고, 인터넷 없이도 돼요.')), act,
      h('button', { class: 'icon-btn sm', 'aria-label': '닫기', onclick: () => { S.settings.hideInstall = true; save(); home(); } }, ic('close', 16)));
  }
  function iosHelp() {
    modal('아이폰·아이패드에 설치', h('div', null, h('ol', { class: 'how' },
      h('li', { html: '<b>Safari</b>에서 이 페이지를 열어요. 카톡에서 열었다면 메뉴에서 “Safari로 열기”를 눌러요.' }),
      h('li', { html: '<b>공유 버튼</b>(네모에서 화살표가 위로 나온 모양)을 눌러요. 아이패드는 주소창 오른쪽에 있어요.' }),
      h('li', { html: '<b>“홈 화면에 추가”</b>를 눌러요.' }),
      h('li', { html: '홈 화면의 <b>브레인 루틴</b> 아이콘으로 열고, 이름을 등록해요.' })),
      h('p', { class: 'fine' }, 'Safari에서 쌓은 기록은 설치한 앱으로 넘어가지 않아요. 기록이 있다면 관리 → 백업 받기 → 앱에서 불러오기를 하세요.')));
  }

  /* ---------- 시작 ---------- */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { }
  if (location.hash === '#teacher') go('teacher'); else go('home');
})();
