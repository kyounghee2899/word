/* 브레인 루틴 — 활동(게임) 11가지
 *
 * 각 활동은 { id, name, domain, icon, max, short, how[], tip, lowerBetter?, play(ctx) } 형태입니다.
 * domain: 'ps' 처리속도 · 'wm' 작업기억 · 'ef' 실행기능
 * play(ctx)는 화면(ctx.stage)에 활동을 그리고, 끝나면 ctx.finish(결과)를 한 번 부릅니다.
 * 레벨(ctx.st.level, 1~max)은 활동 끝에 정확도·속도에 따라 한 칸씩 오르내립니다(적응형 난이도).
 */
window.BR_GAMES = (function () {
  'use strict';

  /* ---------- 공용 도구 ---------- */
  const R = n => Math.floor(Math.random() * n);
  const pick = a => a[R(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const now = () => performance.now();

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
    return e;
  }
  /* 누르는 순간 반응(click보다 빠름). 기본 동작을 막아 더블탭 확대·고스트 클릭을 없앰 */
  const tap = fn => function (ev) { ev.preventDefault(); fn(ev); };

  function adapt(st, max, up, down) {
    const before = st.level;
    if (up) st.level = Math.min(max, st.level + 1);
    else if (down) st.level = Math.max(1, st.level - 1);
    return st.level - before;
  }

  /* 정해진 시간 동안 문제를 계속 내는 활동용 */
  function timed(ctx, seconds, onEnd) {
    const t0 = now();
    const stats = { n: 0, ok: 0, rts: [], log: [] };
    let over = false;
    const upd = () => {
      const left = Math.max(0, seconds - (now() - t0) / 1000);
      ctx.hud({ frac: left / seconds, label: Math.ceil(left) + '초' });
      if (left <= 0 && !over) { over = true; onEnd(stats); }
    };
    ctx.every(upd, 100); upd();
    return {
      record(ok, rt, extra) {
        if (over) return false;
        stats.n++; if (ok) stats.ok++;
        stats.rts.push(rt); stats.log.push(Object.assign({ ok, rt }, extra || {}));
        ctx.hud({ score: stats.ok });
        return true;
      },
      get over() { return over; },
      elapsed: () => (now() - t0) / 1000,
      stats
    };
  }

  /* ---------- 기호(SVG) 36개: 바깥 모양 6 × 안쪽 표시 6 ---------- */
  const SHAPES = [
    '<circle cx="20" cy="20" r="15"/>',
    '<rect x="6" y="6" width="28" height="28" rx="2"/>',
    '<polygon points="20,4 36,34 4,34"/>',
    '<polygon points="20,3 37,20 20,37 3,20"/>',
    '<path d="M5 34 L5 20 A15 15 0 0 1 35 20 L35 34 Z"/>',
    '<polygon points="20,4 35,15 29,34 11,34 5,15"/>'
  ];
  const CY = [20, 20, 25, 20, 24, 21];
  const MARKS = [
    () => '',
    c => `<circle cx="20" cy="${c}" r="3.3" fill="currentColor" stroke="none"/>`,
    c => `<line x1="13" y1="${c}" x2="27" y2="${c}"/>`,
    c => `<line x1="20" y1="${c - 7}" x2="20" y2="${c + 7}"/>`,
    c => `<line x1="13" y1="${c}" x2="27" y2="${c}"/><line x1="20" y1="${c - 7}" x2="20" y2="${c + 7}"/>`,
    c => `<line x1="15" y1="${c - 5}" x2="25" y2="${c + 5}"/><line x1="25" y1="${c - 5}" x2="15" y2="${c + 5}"/>`
  ];
  const NSYM = 36;
  const shapeOf = id => Math.floor(id / 6), markOf = id => id % 6;
  function symSVG(id, size, color) {
    const s = shapeOf(id), m = markOf(id);
    return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" fill="none" stroke="${color || 'currentColor'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHAPES[s]}${MARKS[m](CY[s])}</svg>`;
  }
  const sym = (id, size, color) => h('span', { class: 'sym', html: symSVG(id, size, color) });
  const isSimilar = (a, b) => a !== b && (shapeOf(a) === shapeOf(b) || markOf(a) === markOf(b));
  function distinct(n, from) { return shuffle(from || [...Array(NSYM).keys()]).slice(0, n); }

  /* 결과 묶음 */
  function result(o) { return Object.assign({ acc: null, rt: null, metrics: {} }, o); }

  /* =====================================================================
   * 처리속도 1. 기호 찾기 (Symbol Search 형)
   * ===================================================================== */
  const SS = [null, [1, 3, 0], [1, 4, 0], [1, 5, 1], [2, 3, 0], [2, 4, 1], [2, 5, 1], [2, 5, 2], [3, 4, 1], [3, 5, 2], [3, 6, 2]];
  function genSS(L) {
    const [t, g, sim] = SS[L];
    const targets = distinct(t);
    const present = Math.random() < 0.5;
    const others = [...Array(NSYM).keys()].filter(i => !targets.includes(i));
    const simPool = others.filter(i => targets.some(tg => isSimilar(i, tg)));
    const pSim = sim === 0 ? 0 : sim === 1 ? 0.5 : 0.85;
    const group = [];
    while (group.length < g) {
      const pool = Math.random() < pSim ? simPool : others;
      const c = pick(pool);
      if (!group.includes(c)) group.push(c);
    }
    if (present) group[R(g)] = pick(targets);
    return { targets, group, present };
  }
  const symbol = {
    id: 'symbol', name: '기호 찾기', domain: 'ps', icon: '🔍', max: 10, sec: 60,
    short: '왼쪽 기호가 오른쪽 줄에 있는지 빠르게 판단',
    how: ['위쪽 <b>찾을 기호</b>를 봐요.', '아래 줄에 같은 기호가 <b>하나라도 있으면 “있어요”</b>, 없으면 <b>“없어요”</b>.', '1분 동안 빠르고 정확하게! 틀리면 점수가 1점 빠져요.'],
    tip: '기호를 “세모-점”, “네모-십자”처럼 바깥 모양과 안쪽 표시로 나눠 보면 비슷한 기호에 속지 않아요.',
    play(ctx) {
      const L = ctx.st.level;
      let cur, t0;
      const tBox = h('div', { class: 'ss-targets' }), gBox = h('div', { class: 'ss-group' });
      const answer = yes => {
        if (T.over) return;
        const ok = yes === cur.present;
        T.record(ok, now() - t0); ctx.fb(ok); next();
      };
      ctx.stage.append(h('div', { class: 'g-col' },
        h('div', { class: 'g-label' }, '찾을 기호'), tBox,
        h('div', { class: 'g-label' }, '이 줄에 있나요?'), gBox,
        h('div', { class: 'ans2' },
          h('button', { class: 'ans yes', onpointerdown: tap(() => answer(true)) }, '있어요', h('small', null, '← / F')),
          h('button', { class: 'ans no', onpointerdown: tap(() => answer(false)) }, '없어요', h('small', null, '→ / J')))));
      function next() {
        cur = genSS(L);
        tBox.replaceChildren(...cur.targets.map(id => sym(id, 54)));
        gBox.replaceChildren(...cur.group.map(id => sym(id, 46)));
        t0 = now();
      }
      ctx.onKey(e => { if (e.key === 'ArrowLeft' || e.key === 'f') answer(true); else if (e.key === 'ArrowRight' || e.key === 'j') answer(false); });
      const T = timed(ctx, this.sec, s => {
        const wrong = s.n - s.ok, acc = s.n ? s.ok / s.n : 0;
        const delta = adapt(ctx.st, 10, acc >= 0.9 && s.ok >= 12, acc < 0.75 || s.ok < 5);
        ctx.finish(result({ score: Math.max(0, s.ok - wrong), label: `${Math.max(0, s.ok - wrong)}점`, sub: `정답 ${s.ok} · 오답 ${wrong}`, acc, rt: median(s.rts), delta, metrics: { n: s.n, ok: s.ok } }));
      });
      next();
    }
  };

  /* =====================================================================
   * 처리속도 2. 기호 바꾸기 (Coding 형)
   * ===================================================================== */
  const coding = {
    id: 'coding', name: '기호 암호', domain: 'ps', icon: '🔑', max: 10, sec: 60,
    short: '암호표를 보고 기호에 맞는 숫자를 빠르게 누르기',
    how: ['위쪽 <b>암호표</b>에 숫자마다 기호가 정해져 있어요.', '가운데 기호를 보고 맞는 <b>숫자 버튼</b>을 눌러요.', '높은 레벨에서는 중간에 <b>암호표가 바뀌어요</b>. 다시 확인!'],
    tip: '자주 나온 기호 2~3개는 외워 두고, 헷갈리는 것만 암호표를 보면 훨씬 빨라져요.',
    play(ctx) {
      const L = ctx.st.level;
      const N = L <= 6 ? 3 + L : 9;
      let pool;
      if (L >= 8) { const [a, b] = distinct(2, [0, 1, 2, 3, 4, 5]); pool = shuffle([...Array(6).keys()].map(m => a * 6 + m).concat([...Array(6).keys()].map(m => b * 6 + m))).slice(0, N); }
      else if (L >= 7) { const a = R(6); pool = [...Array(6).keys()].map(m => a * 6 + m).concat(distinct(3, [...Array(NSYM).keys()].filter(i => shapeOf(i) !== a))); pool = shuffle(pool); }
      else pool = distinct(N);
      let key = pool.slice(0, N); // key[d-1] = 기호
      let cur = -1, t0, remapped = false;
      const keyBox = h('div', { class: 'cd-key' }), stim = h('div', { class: 'cd-stim' }), pad = h('div', { class: 'cd-pad', style: `grid-template-columns:repeat(${N <= 5 ? N : Math.ceil(N / 2)},1fr)` });
      const drawKey = () => keyBox.replaceChildren(...key.map((id, i) => h('div', { class: 'cd-cell' }, sym(id, 34), h('b', null, String(i + 1)))));
      for (let d = 1; d <= N; d++) pad.append(h('button', { class: 'pad-btn', onpointerdown: tap(() => answer(d)) }, String(d)));
      ctx.stage.append(h('div', { class: 'g-col' }, h('div', { class: 'g-label' }, '암호표'), keyBox, stim, pad));
      drawKey();
      function next() { let k; do { k = R(N); } while (k === cur && N > 1); cur = k; stim.replaceChildren(sym(key[cur], 84)); t0 = now(); }
      function answer(d) {
        if (T.over) return;
        const ok = d === cur + 1; T.record(ok, now() - t0); ctx.fb(ok);
        if (L >= 9 && !remapped && T.elapsed() > 30) {
          remapped = true; key = shuffle(key); drawKey(); keyBox.classList.add('pulse');
          ctx.msg('암호표가 바뀌었어요!', 1200);
        }
        next();
      }
      ctx.onKey(e => { const d = +e.key; if (d >= 1 && d <= N) answer(d); });
      const T = timed(ctx, this.sec, s => {
        const acc = s.n ? s.ok / s.n : 0;
        const delta = adapt(ctx.st, 10, acc >= 0.9 && s.ok >= 16, acc < 0.75 || s.ok < 6);
        ctx.finish(result({ score: s.ok, label: `${s.ok}개`, sub: `1분에 ${s.ok}개 · 오답 ${s.n - s.ok}`, acc, rt: median(s.rts), delta }));
      });
      next();
    }
  };

  /* =====================================================================
   * 처리속도 3. 같을까 다를까 (빠른 비교)
   * ===================================================================== */
  const CMP = [null, [3, 'd', 'sub'], [4, 'd', 'sub'], [5, 'd', 'sim'], [5, 'd', 'trans'], [6, 'd', 'mix'], [5, 'k', 'sim'], [6, 'm', 'mix'], [7, 'm', 'trans'], [8, 'm', 'mix'], [9, 'm', 'mix']];
  const DIG = '123456789'.split(''), KOR = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('');
  const SIMC = { '1': '7', '7': '1', '3': '8', '8': '3', '6': '9', '9': '6', '5': '6', '2': '5', '4': '9', 'ㄱ': 'ㅋ', 'ㅋ': 'ㄱ', 'ㄷ': 'ㅌ', 'ㅌ': 'ㄷ', 'ㅂ': 'ㅍ', 'ㅍ': 'ㅂ', 'ㅈ': 'ㅊ', 'ㅊ': 'ㅈ', 'ㅇ': 'ㅎ', 'ㅎ': 'ㅇ', 'ㅁ': 'ㅂ', 'ㄴ': 'ㄷ', 'ㄹ': 'ㅌ', 'ㅅ': 'ㅈ' };
  function genCmp(L) {
    const [len, cs, type] = CMP[L];
    const set = cs === 'd' ? DIG : cs === 'k' ? KOR : DIG.concat(KOR);
    const a = []; for (let i = 0; i < len; i++) { let c; do { c = pick(set); } while (c === a[i - 1]); a.push(c); }
    const same = Math.random() < 0.5; const b = a.slice();
    if (!same) {
      const t = type === 'mix' ? pick(['sub', 'sim', 'trans']) : type;
      const i = R(len);
      if (t === 'trans') { let j = i < len - 1 ? i + 1 : i - 1; if (b[i] === b[j]) { b[i] = SIMC[b[i]] || pick(set.filter(x => x !== b[i])); } else [b[i], b[j]] = [b[j], b[i]]; }
      else if (t === 'sim' && SIMC[b[i]]) b[i] = SIMC[b[i]];
      else b[i] = pick(set.filter(x => x !== b[i]));
    }
    return { a: a.join(''), b: b.join(''), same: a.join('') === b.join('') };
  }
  const compare = {
    id: 'compare', name: '같을까 다를까', domain: 'ps', icon: '👀', max: 10, sec: 60,
    short: '두 줄의 숫자·글자가 똑같은지 빠르게 비교',
    how: ['위아래 두 줄을 비교해요.', '한 글자도 안 틀리고 <b>똑같으면 “같아요”</b>, 하나라도 다르면 <b>“달라요”</b>.', '자리가 바뀐 것(12 → 21)도 다른 거예요!'],
    tip: '앞에서부터 2~3글자씩 끊어서 비교하면 빠르고, 자리 바뀜도 잘 잡아요.',
    play(ctx) {
      const L = ctx.st.level; let cur, t0;
      const A = h('div', { class: 'cmp-line' }), B = h('div', { class: 'cmp-line' });
      const answer = same => { if (T.over) return; const ok = same === cur.same; T.record(ok, now() - t0); ctx.fb(ok); next(); };
      ctx.stage.append(h('div', { class: 'g-col' }, h('div', { class: 'cmp-box' }, A, B),
        h('div', { class: 'ans2' },
          h('button', { class: 'ans yes', onpointerdown: tap(() => answer(true)) }, '같아요', h('small', null, '← / F')),
          h('button', { class: 'ans no', onpointerdown: tap(() => answer(false)) }, '달라요', h('small', null, '→ / J')))));
      function next() { cur = genCmp(L); A.textContent = cur.a; B.textContent = cur.b; t0 = now(); }
      ctx.onKey(e => { if (e.key === 'ArrowLeft' || e.key === 'f') answer(true); else if (e.key === 'ArrowRight' || e.key === 'j') answer(false); });
      const T = timed(ctx, this.sec, s => {
        const wrong = s.n - s.ok, acc = s.n ? s.ok / s.n : 0;
        const delta = adapt(ctx.st, 10, acc >= 0.9 && s.ok >= 14, acc < 0.75 || s.ok < 6);
        ctx.finish(result({ score: Math.max(0, s.ok - wrong), label: `${Math.max(0, s.ok - wrong)}점`, sub: `정답 ${s.ok} · 오답 ${wrong}`, acc, rt: median(s.rts), delta }));
      });
      next();
    }
  };

  /* =====================================================================
   * 작업기억 공용: 따라하기 → 거꾸로 순서 (계단식 난이도)
   * ===================================================================== */
  const spanLevel = (f, b) => Math.max(1, Math.min(10, f + b - 4));

  /* 작업기억 1. 숫자 기억 (Digit Span 형) */
  function genDigits(n) {
    const out = [];
    while (out.length < n) {
      const d = 1 + R(9);
      const p = out[out.length - 1];
      if (d === p || (p && Math.abs(d - p) === 1 && Math.random() < 0.7)) continue;
      out.push(d);
    }
    return out;
  }
  const digits = {
    id: 'digits', name: '숫자 기억', domain: 'wm', icon: '🔢', max: 10,
    short: '숫자를 외워 순서대로, 그다음 거꾸로 입력',
    how: ['숫자가 하나씩 나와요. 잘 보고 머릿속에 담아요.', '앞의 5번은 <b>나온 순서대로</b>, 뒤의 5번은 <b>거꾸로(마지막부터)</b> 눌러요.', '맞히면 한 자리 늘고, 틀리면 한 자리 줄어요.'],
    tip: '전화번호처럼 3개씩 묶어 외우고(372 / 95), 거꾸로는 묶음을 뒤에서부터 꺼내요.',
    async play(ctx) {
      const st = ctx.st; st.fwd = st.fwd || 3; st.bwd = st.bwd || 2;
      const span = { f: Math.max(2, st.fwd - 1), b: Math.max(2, st.bwd - 1) }, best = { f: 0, b: 0 };
      const plan = ['f', 'f', 'f', 'f', 'f', 'b', 'b', 'b', 'b', 'b'];
      let okc = 0;
      const mode = h('div', { class: 'wm-mode' }), disp = h('div', { class: 'ds-disp' }), slots = h('div', { class: 'ds-slots' }), pad = h('div', { class: 'num-pad' });
      let onDigit = null;
      for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9]) pad.append(h('button', { class: 'pad-btn', onpointerdown: tap(() => onDigit && onDigit(d)) }, String(d)));
      const back = h('button', { class: 'pad-btn ghost', onpointerdown: tap(() => onDigit && onDigit(-1)) }, '⌫ 지우기');
      pad.append(back);
      ctx.stage.append(h('div', { class: 'g-col' }, mode, disp, slots, pad));
      ctx.onKey(e => { const d = +e.key; if (d >= 1 && d <= 9 && onDigit) onDigit(d); else if (e.key === 'Backspace' && onDigit) onDigit(-1); });
      for (let i = 0; i < plan.length; i++) {
        const m = plan[i], n = span[m];
        ctx.hud({ frac: 1 - i / plan.length, label: `${i + 1}/${plan.length}` });
        if (i === 5) { await ctx.say('이번엔 거꾸로!', '마지막 숫자부터 눌러요', 1800); }
        mode.innerHTML = m === 'f' ? `<b class="tag f">순서대로</b> ${n}자리` : `<b class="tag b">거꾸로</b> ${n}자리`;
        pad.classList.add('off'); slots.replaceChildren(); disp.textContent = '';
        const seq = genDigits(n);
        await ctx.wait(700);
        for (const d of seq) {
          disp.textContent = d; disp.classList.add('show'); ctx.speak(String(d));
          await ctx.wait(850);
          disp.textContent = ''; disp.classList.remove('show');
          await ctx.wait(280);
        }
        disp.textContent = m === 'f' ? '순서대로 눌러요' : '거꾸로 눌러요';
        disp.classList.add('ask');
        const ans = m === 'f' ? seq : seq.slice().reverse();
        slots.replaceChildren(...ans.map(() => h('span', { class: 'slot' })));
        pad.classList.remove('off');
        const input = await new Promise(res => {
          const got = [];
          onDigit = d => {
            if (d === -1) { got.pop(); } else got.push(d);
            [...slots.children].forEach((s, k) => { s.textContent = got[k] || ''; s.classList.toggle('on', k < got.length); });
            if (got.length === ans.length) { onDigit = null; res(got.slice()); }
          };
        });
        disp.classList.remove('ask');
        pad.classList.add('off');
        const ok = input.every((d, k) => d === ans[k]);
        ctx.fb(ok);
        if (ok) { okc++; best[m] = Math.max(best[m], n); span[m] = Math.min(10, n + 1); disp.textContent = '정답!'; }
        else { span[m] = Math.max(2, n - 1); disp.innerHTML = `<span class="small">정답 ${ans.join(' ')}</span>`; }
        await ctx.wait(ok ? 650 : 1500);
        disp.textContent = '';
      }
      const prev = st.level;
      st.fwd = best.f || Math.max(2, st.fwd - 1); st.bwd = best.b || Math.max(2, st.bwd - 1);
      st.level = spanLevel(st.fwd, st.bwd);
      ctx.finish(result({ score: best.f + best.b, label: best.f + best.b ? `순서 ${best.f || '-'} · 거꾸로 ${best.b || '-'}자리` : '다시 도전해요', sub: `10번 중 ${okc}번 성공`, acc: okc / plan.length, delta: st.level - prev, metrics: { fwd: best.f, bwd: best.b } }));
    }
  };

  /* 작업기억 2. 위치 기억 (Corsi 형) */
  const grid = {
    id: 'grid', name: '불빛 순서', domain: 'wm', icon: '💡', max: 10,
    short: '켜지는 칸의 순서를 기억해 똑같이, 그다음 거꾸로',
    how: ['칸에 불이 하나씩 켜져요. 순서를 기억해요.', '앞의 5번은 <b>켜진 순서대로</b>, 뒤의 5번은 <b>거꾸로</b> 눌러요.', '틀린 칸을 누르면 그 문제는 끝나요.'],
    tip: '불빛이 지나간 길을 “ㄱ자, 대각선”처럼 모양으로 기억하면 길게도 외울 수 있어요.',
    async play(ctx) {
      const st = ctx.st; st.fwd = st.fwd || 3; st.bwd = st.bwd || 2;
      const span = { f: Math.max(2, st.fwd - 1), b: Math.max(2, st.bwd - 1) }, best = { f: 0, b: 0 };
      const plan = ['f', 'f', 'f', 'f', 'f', 'b', 'b', 'b', 'b', 'b'];
      let okc = 0;
      const mode = h('div', { class: 'wm-mode' }), board = h('div', { class: 'grid-board' }), msg = h('div', { class: 'grid-msg' });
      ctx.stage.append(h('div', { class: 'g-col' }, mode, board, msg));
      let onCell = null;
      for (let i = 0; i < plan.length; i++) {
        const m = plan[i], n = span[m], size = n <= 4 ? 3 : 4;
        ctx.hud({ frac: 1 - i / plan.length, label: `${i + 1}/${plan.length}` });
        if (i === 5) await ctx.say('이번엔 거꾸로!', '마지막에 켜진 칸부터 눌러요', 1800);
        mode.innerHTML = m === 'f' ? `<b class="tag f">순서대로</b> ${n}개` : `<b class="tag b">거꾸로</b> ${n}개`;
        board.style.gridTemplateColumns = `repeat(${size},1fr)`;
        const cells = [];
        board.replaceChildren();
        for (let c = 0; c < size * size; c++) { const el = h('button', { class: 'cell', onpointerdown: tap(() => onCell && onCell(c)) }); cells.push(el); board.append(el); }
        board.classList.add('off'); msg.textContent = '잘 보세요';
        const seq = distinct(n, [...Array(size * size).keys()]);
        await ctx.wait(800);
        for (const c of seq) { cells[c].classList.add('lit'); ctx.sfx.blip(); await ctx.wait(650); cells[c].classList.remove('lit'); await ctx.wait(260); }
        const ans = m === 'f' ? seq : seq.slice().reverse();
        msg.textContent = m === 'f' ? '켜진 순서대로 눌러요' : '거꾸로 눌러요';
        board.classList.remove('off');
        const ok = await new Promise(res => {
          let k = 0;
          onCell = c => {
            if (c === ans[k]) { cells[c].classList.add('hit'); cells[c].textContent = k + 1; k++; if (k === ans.length) { onCell = null; res(true); } }
            else { cells[c].classList.add('miss'); onCell = null; res(false); }
          };
        });
        board.classList.add('off');
        ctx.fb(ok);
        if (ok) { okc++; best[m] = Math.max(best[m], n); span[m] = Math.min(9, n + 1); msg.textContent = '정답!'; }
        else { span[m] = Math.max(2, n - 1); ans.forEach((c, k) => { cells[c].classList.add('show'); cells[c].textContent = k + 1; }); msg.textContent = '정답 순서를 확인해요'; }
        await ctx.wait(ok ? 650 : 1700);
      }
      const prev = st.level;
      st.fwd = best.f || Math.max(2, st.fwd - 1); st.bwd = best.b || Math.max(2, st.bwd - 1);
      st.level = spanLevel(st.fwd, st.bwd);
      ctx.finish(result({ score: best.f + best.b, label: best.f + best.b ? `순서 ${best.f || '-'} · 거꾸로 ${best.b || '-'}개` : '다시 도전해요', sub: `10번 중 ${okc}번 성공`, acc: okc / plan.length, delta: st.level - prev, metrics: { fwd: best.f, bwd: best.b } }));
    }
  };

  /* 작업기억 3. 몇 개 전 그림? (N-back) */
  const NB = [null, [1, 2600, 20], [1, 2200, 22], [1, 1850, 24], [2, 3000, 22], [2, 2600, 24], [2, 2250, 26], [2, 1950, 28], [3, 3200, 26], [3, 2750, 28], [3, 2350, 30]];
  const NB_ITEMS = [[0, '#e5533d'], [7, '#2f6fde'], [14, '#1f9d55'], [21, '#c98a00'], [28, '#8e44ad'], [30, '#0b9aa8']];
  const nback = {
    id: 'nback', name: '몇 개 전 그림?', domain: 'wm', icon: '🧠', max: 10,
    short: '지금 그림이 N개 전 그림과 같으면 누르기',
    how: ['그림이 하나씩 지나가요.', '<b>지금 그림이 정해진 개수 전 그림과 같을 때만</b> “같아요!”를 눌러요.', '1개 전 → 2개 전 → 3개 전으로 레벨이 올라가요. (스페이스바도 돼요)'],
    tip: '마지막 그림들을 “빨강-파랑”처럼 이름으로 속으로 되뇌면서, 새 그림이 오면 맨 앞을 버리고 뒤에 붙여요.',
    async play(ctx) {
      const L = ctx.st.level, [n, isi, len] = NB[L];
      const showMs = Math.min(1100, isi * 0.5);
      const seq = [];
      for (let k = 0; k < len; k++) {
        if (k >= n && Math.random() < 0.32) seq.push(seq[k - n]);
        else {
          let c, tries = 0;
          do {
            c = (n >= 2 && k >= 1 && Math.random() < 0.18) ? seq[k - 1] : R(NB_ITEMS.length);
            tries++;
          } while (k >= n && c === seq[k - n] && tries < 20);
          if (k >= n && c === seq[k - n]) c = (c + 1) % NB_ITEMS.length;
          seq.push(c);
        }
      }
      const frame = h('div', { class: 'nb-frame' }), hint = h('div', { class: 'wm-mode', html: `<b class="tag f">${n}개 전</b> 그림과 같으면 눌러요` });
      let responded = false, k = -1, hits = 0, miss = 0, fa = 0, cr = 0;
      const press = () => {
        if (k < 0 || responded) return; responded = true;
        const isT = k >= n && seq[k] === seq[k - n];
        btn.classList.add('pressed'); ctx.later(() => btn.classList.remove('pressed'), 150);
        if (k >= n) { if (isT) { hits++; ctx.fb(true); } else { fa++; ctx.fb(false); } }
      };
      const btn = h('button', { class: 'big-tap', onpointerdown: tap(press) }, '같아요!');
      ctx.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } });
      ctx.stage.append(h('div', { class: 'g-col' }, hint, frame, btn));
      await ctx.wait(900);
      for (k = 0; k < seq.length; k++) {
        responded = false;
        ctx.hud({ frac: 1 - k / seq.length, label: `${k + 1}/${seq.length}`, score: hits });
        const [id, col] = NB_ITEMS[seq[k]];
        frame.replaceChildren(sym(id, 120, col));
        await ctx.wait(showMs);
        frame.replaceChildren();
        await ctx.wait(isi - showMs);
        if (k >= n) {
          const isT = seq[k] === seq[k - n];
          if (isT && !responded) { miss++; ctx.miss(); }
          if (!isT && !responded) cr++;
        }
      }
      const targets = hits + miss, total = hits + miss + fa + cr;
      const hitRate = targets ? hits / targets : 0, acc = total ? (hits + cr) / total : 0;
      const delta = adapt(ctx.st, 10, hitRate >= 0.8 && fa <= 2, hitRate < 0.5 || fa >= 5);
      ctx.finish(result({ score: Math.round(acc * 100), label: `${n}개 전 · 정확도 ${Math.round(acc * 100)}%`, sub: `찾음 ${hits}/${targets} · 잘못 누름 ${fa}`, acc, delta, metrics: { n, hits, miss, fa, cr } }));
    }
  };

  /* =====================================================================
   * 실행기능 1. 색깔 글자 (Stroop 형) — 억제
   * ===================================================================== */
  const COLORS = [['빨강', '#e0352b'], ['파랑', '#1f5fd6'], ['초록', '#178a48'], ['노랑', '#e9b100']];
  const STR = [null, [0.5, 0, 0], [0.7, 0, 0], [0.85, 0, 0], [0.85, 3000, 0], [0.85, 2200, 0], [0.75, 0, 0.2], [0.75, 3000, 0.25], [0.75, 2500, 0.35], [0.8, 2000, 0.4], [0.8, 1700, 0.5]];
  const stroop = {
    id: 'stroop', name: '색깔 글자', domain: 'ef', icon: '🎨', max: 10, sec: 45,
    short: '글자 뜻에 속지 않고 글자 색깔 누르기',
    how: ['<b style="color:#1f5fd6">빨강</b>처럼 글자의 뜻과 색이 달라요.', '<b>글자의 색깔</b>을 눌러요. (위 예시는 “파랑”)', '높은 레벨: 카드에 <b>⭐ 뜻 읽기</b>가 나오면 그때만 글자 뜻을 눌러요.'],
    tip: '글자를 “읽지” 말고 그림처럼 “색만 본다”고 생각해요. 서두르기보다 한 박자 멈추는 게 실수를 줄여요.',
    note: '색을 구별하기 어려운 학생은 선생님 메뉴에서 이 활동을 빼 주세요.',
    play(ctx) {
      const L = ctx.st.level, [pInc, limit, pSw] = STR[L];
      let cur, t0, lim = null;
      const card = h('div', { class: 'st-card' }), cue = h('div', { class: 'st-cue' }), word = h('div', { class: 'st-word' });
      card.append(cue, word);
      const btns = h('div', { class: 'st-btns' }, COLORS.map((c, i) => h('button', { class: 'st-btn', style: `--c:${c[1]}`, onpointerdown: tap(() => answer(i)) }, h('i'), c[0], h('small', null, String(i + 1)))));
      ctx.stage.append(h('div', { class: 'g-col' }, card, btns));
      function next() {
        const w = R(4); let c = w;
        if (Math.random() < pInc) { do { c = R(4); } while (c === w); }
        const rule = Math.random() < pSw ? 'word' : 'color';
        cur = { w, c, rule, ans: rule === 'word' ? w : c, inc: w !== c };
        card.className = 'st-card ' + rule;
        cue.textContent = rule === 'word' ? '⭐ 뜻 읽기' : '색깔은?';
        word.textContent = COLORS[w][0]; word.style.color = COLORS[c][1];
        t0 = now();
        if (lim) ctx.cancel(lim);
        if (limit) lim = ctx.later(() => answer(-1), limit);
      }
      function answer(i) {
        if (T.over) return;
        const ok = i === cur.ans; T.record(ok, now() - t0, { inc: cur.inc, rule: cur.rule, timeout: i === -1 }); ctx.fb(ok);
        if (i === -1) ctx.msg('시간 초과', 500);
        next();
      }
      ctx.onKey(e => { const d = +e.key; if (d >= 1 && d <= 4) answer(d - 1); });
      const T = timed(ctx, this.sec, s => {
        if (lim) ctx.cancel(lim);
        const acc = s.n ? s.ok / s.n : 0;
        const inc = s.log.filter(x => x.inc && x.ok && x.rule === 'color'), con = s.log.filter(x => !x.inc && x.ok && x.rule === 'color');
        const interf = inc.length && con.length ? Math.round(median(inc.map(x => x.rt)) - median(con.map(x => x.rt))) : null;
        const delta = adapt(ctx.st, 10, acc >= 0.9 && s.ok >= 15, acc < 0.75 || s.ok < 6);
        ctx.finish(result({ score: s.ok, label: `${s.ok}개 정답`, sub: `정확도 ${Math.round(acc * 100)}%` + (interf != null ? ` · 헷갈림 시간 +${Math.max(0, interf)}ms` : ''), acc, rt: median(s.rts), delta, metrics: { interference: interf } }));
      });
      next();
    }
  };

  /* =====================================================================
   * 실행기능 2. 규칙 바꾸기 (DCCS / 과제 전환) — 인지 유연성
   * ===================================================================== */
  const SW = [null, ['block', 8, 0], ['block', 6, 0], ['block', 4, 0], ['rand', 0.3, 0], ['rand', 0.4, 0], ['rand', 0.5, 0], ['rand', 0.5, 3000], ['rand', 0.5, 2500], ['rand', 0.5, 2000], ['rand', 0.5, 1700]];
  const SWC = { red: '#e0352b', blue: '#1f5fd6' };
  const shapeSVG = (shape, col, size) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${shape === 'circle' ? `<circle cx="20" cy="20" r="16" fill="${col}"/>` : `<polygon points="20,3 37,35 3,35" fill="${col}"/>`}</svg>`;
  const switcher = {
    id: 'switch', name: '규칙 바꾸기', domain: 'ef', icon: '🔄', max: 10, sec: 60,
    short: '색깔 규칙과 모양 규칙을 번갈아 바꿔 가며 분류',
    how: ['카드 위에 <b>규칙</b>이 나와요: <b>🎨 색깔</b> 또는 <b>🔷 모양</b>.', '왼쪽 버튼은 <b>빨간 동그라미</b>, 오른쪽 버튼은 <b>파란 세모</b>예요.', '규칙에 맞는 쪽을 눌러요. 예) 색깔 규칙인데 빨간 세모 → 왼쪽(빨강)'],
    tip: '카드를 보기 전에 규칙 이름을 먼저 속으로 말해요. “색깔!” 하고 나서 카드를 보면 덜 헷갈려요.',
    play(ctx) {
      const L = ctx.st.level, [modeT, param, limit] = SW[L];
      let cur, t0, lim = null, rule = Math.random() < 0.5 ? 'color' : 'shape', blockN = 0, prevRule = null;
      const cue = h('div', { class: 'sw-cue' }), stim = h('div', { class: 'sw-stim' }), card = h('div', { class: 'sw-card' }, cue, stim);
      const left = h('button', { class: 'sw-btn', onpointerdown: tap(() => answer(0)) }, h('span', { html: shapeSVG('circle', SWC.red, 54) }), h('small', null, '빨강 · 동그라미'));
      const right = h('button', { class: 'sw-btn', onpointerdown: tap(() => answer(1)) }, h('span', { html: shapeSVG('tri', SWC.blue, 54) }), h('small', null, '파랑 · 세모'));
      ctx.stage.append(h('div', { class: 'g-col' }, card, h('div', { class: 'ans2' }, left, right)));
      function next() {
        prevRule = rule;
        if (modeT === 'block') { if (blockN >= param) { rule = rule === 'color' ? 'shape' : 'color'; blockN = 0; } blockN++; }
        else if (Math.random() < param) rule = rule === 'color' ? 'shape' : 'color';
        const conflict = Math.random() < 0.7;
        const color = Math.random() < 0.5 ? 'red' : 'blue';
        const shape = conflict ? (color === 'red' ? 'tri' : 'circle') : (color === 'red' ? 'circle' : 'tri');
        const ans = rule === 'color' ? (color === 'red' ? 0 : 1) : (shape === 'circle' ? 0 : 1);
        cur = { ans, rule, sw: prevRule !== rule };
        card.className = 'sw-card ' + rule;
        cue.textContent = rule === 'color' ? '🎨 색깔로!' : '🔷 모양으로!';
        stim.innerHTML = shapeSVG(shape, SWC[color], 110);
        t0 = now();
        if (lim) ctx.cancel(lim);
        if (limit) lim = ctx.later(() => answer(-1), limit);
      }
      function answer(i) {
        if (T.over) return;
        const ok = i === cur.ans; T.record(ok, now() - t0, { sw: cur.sw }); ctx.fb(ok);
        if (i === -1) ctx.msg('시간 초과', 500);
        next();
      }
      ctx.onKey(e => { if (e.key === 'ArrowLeft' || e.key === 'f') answer(0); else if (e.key === 'ArrowRight' || e.key === 'j') answer(1); });
      const T = timed(ctx, this.sec, s => {
        if (lim) ctx.cancel(lim);
        const acc = s.n ? s.ok / s.n : 0;
        const sw = s.log.filter(x => x.sw), rp = s.log.filter(x => !x.sw);
        const swAcc = sw.length ? sw.filter(x => x.ok).length / sw.length : null;
        const swOk = sw.filter(x => x.ok), rpOk = rp.filter(x => x.ok);
        const cost = swOk.length && rpOk.length ? Math.round(median(swOk.map(x => x.rt)) - median(rpOk.map(x => x.rt))) : null;
        const delta = adapt(ctx.st, 10, acc >= 0.9 && s.ok >= 18, acc < 0.75 || s.ok < 7);
        ctx.finish(result({ score: s.ok, label: `${s.ok}개 정답`, sub: `정확도 ${Math.round(acc * 100)}%` + (swAcc != null ? ` · 규칙 바뀔 때 ${Math.round(swAcc * 100)}%` : ''), acc, rt: median(s.rts), delta, metrics: { switchAcc: swAcc, switchCost: cost } }));
      });
      next();
    }
  };

  /* =====================================================================
   * 실행기능 3. 멈춰! (Go/No-go) — 반응 억제
   * ===================================================================== */
  const GNG = [null, [1300, 1000, 0.2, 0, 0], [1150, 900, 0.25, 0, 0], [1000, 800, 0.25, 0, 0], [1000, 750, 0.25, 1, 0], [900, 700, 0.3, 1, 0], [850, 650, 0.3, 1, 0], [850, 650, 0.3, 1, 1], [750, 600, 0.3, 1, 1], [700, 550, 0.3, 1, 1], [620, 500, 0.3, 1, 1]];
  const GO_ITEMS = [['circle', '#1f9d55'], ['tri', '#1f5fd6'], ['diamond', '#8e44ad'], ['circle', '#0b9aa8'], ['tri', '#c98a00']];
  const shapeSVG2 = (shape, col, size) => {
    const inner = shape === 'circle' ? `<circle cx="20" cy="20" r="16" fill="${col}"/>` : shape === 'tri' ? `<polygon points="20,3 37,35 3,35" fill="${col}"/>` : shape === 'square' ? `<rect x="4" y="4" width="32" height="32" rx="3" fill="${col}"/>` : `<polygon points="20,2 38,20 20,38 2,20" fill="${col}"/>`;
    return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
  };
  const gonogo = {
    id: 'gonogo', name: '멈춰!', domain: 'ef', icon: '✋', max: 10,
    short: '모양이 나오면 톡! 단, 멈춤 신호에는 참기',
    how: ['모양이 나올 때마다 화면 아래 <b>“톡!”</b>을 빨리 눌러요.', '단, <b>빨간 네모</b>가 나오면 <b>누르지 말고 참아요</b>.', '높은 레벨에서는 중간에 멈춤 신호가 바뀌어요!'],
    tip: '손가락을 버튼 위에 살짝 띄워 두고, 빨간색이 보이면 “멈춰”라고 속으로 말해요.',
    async play(ctx) {
      const L = ctx.st.level, [soa, showMs, pNo, lure, change] = GNG[L];
      const total = Math.round(52000 / soa);
      let nogo = ['square', '#e0352b'], nogoLabel = '빨간 네모';
      const frame = h('div', { class: 'gng-frame' }), rule = h('div', { class: 'wm-mode' });
      const setRule = () => { rule.innerHTML = `<span class="gng-stop" >${shapeSVG2(nogo[0], nogo[1], 26)}</span> <b>${nogoLabel}</b>에는 참기`; };
      setRule();
      let k = -1, responded = false, cur = null, hits = 0, miss = 0, com = 0, cr = 0, rts = [], t0 = 0;
      const press = () => {
        if (!cur || responded) return; responded = true;
        btn.classList.add('pressed'); ctx.later(() => btn.classList.remove('pressed'), 120);
        if (cur.go) { hits++; rts.push(now() - t0); ctx.sfx.blip(); } else { com++; ctx.fb(false); }
      };
      const btn = h('button', { class: 'big-tap go', onpointerdown: tap(press) }, '톡!');
      ctx.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } });
      ctx.stage.append(h('div', { class: 'g-col' }, rule, frame, btn));
      await ctx.wait(900);
      for (k = 0; k < total; k++) {
        if (change && k === Math.floor(total / 2)) {
          cur = null; frame.replaceChildren();
          nogo = ['tri', '#1f5fd6']; nogoLabel = '파란 세모'; setRule();
          await ctx.say('규칙이 바뀌어요!', '이제는 파란 세모에서 참아요', 2200);
        }
        ctx.hud({ frac: 1 - k / total, label: `${k + 1}/${total}`, score: hits });
        const isNo = Math.random() < pNo;
        let item;
        if (isNo) item = nogo;
        else {
          const pool = GO_ITEMS.filter(x => !(x[0] === nogo[0] && x[1] === nogo[1]));
          if (lure && Math.random() < 0.25) item = nogo[1] === '#e0352b' ? pick([['circle', '#e0352b'], ['square', '#e8731a']]) : pick([['tri', '#0b9aa8'], ['circle', '#1f5fd6']]);
          else item = pick(pool);
        }
        cur = { go: !isNo }; responded = false; t0 = now();
        frame.innerHTML = shapeSVG2(item[0], item[1], 120);
        await ctx.wait(showMs);
        frame.replaceChildren();
        await ctx.wait(soa - showMs);
        if (cur.go && !responded) { miss++; ctx.miss(); }
        if (!cur.go && !responded) { cr++; }
      }
      cur = null;
      const n = hits + miss + com + cr, acc = n ? (hits + cr) / n : 0, noN = com + cr;
      const comRate = noN ? com / noN : 0;
      const delta = adapt(ctx.st, 10, acc >= 0.92 && comRate <= 0.2, acc < 0.8 || comRate > 0.5);
      ctx.finish(result({ score: Math.round(acc * 100), label: `정확도 ${Math.round(acc * 100)}%`, sub: `참기 성공 ${cr}/${noN} · 놓침 ${miss}`, acc, rt: median(rts), delta, metrics: { commission: com, omission: miss, stopRate: noN ? cr / noN : null } }));
    }
  };

  /* =====================================================================
   * 실행기능 4. 순서 잇기 (Trail Making 형) — 전환 + 속도
   * ===================================================================== */
  const TR = [null, { n: 8 }, { n: 12 }, { n: 16 }, { p: 5 }, { p: 6 }, { p: 8 }, { p: 10 }, { p: 12 }, { p: 12, d: 5 }, { p: 14, d: 6 }];
  const SYL = '가나다라마바사아자차카타파하'.split('');
  const trail = {
    id: 'trail', name: '순서 잇기', domain: 'ef', icon: '🧵', max: 10, lowerBetter: true,
    short: '1→2→3… 또는 1→가→2→나… 순서대로 빠르게 잇기',
    how: ['흩어진 동그라미를 <b>순서대로</b> 눌러 이어요.', '낮은 레벨: 1 → 2 → 3 …', '높은 레벨: <b>숫자와 글자를 번갈아</b> 1 → 가 → 2 → 나 → 3 …'],
    tip: '방금 누른 것과 “다음에 올 것” 두 개를 같이 말하면서(2 다음 나!) 찾으면 덜 헤매요.',
    play(ctx) {
      const L = ctx.st.level, cfg = TR[L];
      const order = cfg.n ? [...Array(cfg.n)].map((_, i) => String(i + 1)) : [].concat(...[...Array(cfg.p)].map((_, i) => [String(i + 1), SYL[i]]));
      const decoys = [];
      if (cfg.d) for (let i = 0; i < cfg.d; i++) decoys.push(i % 2 ? SYL[cfg.p + (i >> 1)] || String(cfg.p + 2 + i) : String(cfg.p + 1 + (i >> 1)));
      const labels = order.concat(decoys.filter(x => !order.includes(x)));
      const field = h('div', { class: 'tr-field' });
      const svgNS = 'http://www.w3.org/2000/svg';
      const lines = document.createElementNS(svgNS, 'svg'); lines.setAttribute('class', 'tr-lines');
      field.append(lines);
      const nextLbl = h('div', { class: 'wm-mode', html: `다음: <b class="tag f">${order[0]}</b> 그다음 ${order[1]}` });
      ctx.stage.append(h('div', { class: 'g-col fill' }, nextLbl, field));
      const W = field.clientWidth, H = field.clientHeight;
      lines.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const D = Math.max(40, Math.min(54, Math.floor(Math.sqrt((W * H) / (labels.length * 4.2)))));
      const pos = [];
      for (const _ of labels) {
        let p, tries = 0, minD = D * 1.35;
        do { p = [D / 2 + 4 + Math.random() * (W - D - 8), D / 2 + 4 + Math.random() * (H - D - 8)]; tries++; if (tries % 400 === 0) minD *= 0.9; }
        while (pos.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < minD) && tries < 4000);
        pos.push(p);
      }
      let k = 0, errors = 0, t0 = now(), done = false;
      const nodes = labels.map((lb, i) => {
        const el = h('button', { class: 'tr-node' + (/\d/.test(lb) ? '' : ' kor'), style: `width:${D}px;height:${D}px;left:${pos[i][0] - D / 2}px;top:${pos[i][1] - D / 2}px`, onpointerdown: tap(() => hit(i)) }, lb);
        field.append(el); return el;
      });
      nodes[0].classList.add('start');
      const showNext = () => { nextLbl.innerHTML = k < order.length ? `다음: <b class="tag f">${order[k]}</b>` + (k + 1 < order.length ? ` 그다음 ${order[k + 1]}` : ' (마지막)') : '완료!'; };
      showNext();
      function hit(i) {
        if (done) return;
        if (labels[i] === order[k]) {
          nodes[i].classList.add('done');
          if (k > 0) { const a = pos[labels.indexOf(order[k - 1])], b = pos[i]; const ln = document.createElementNS(svgNS, 'line'); ln.setAttribute('x1', a[0]); ln.setAttribute('y1', a[1]); ln.setAttribute('x2', b[0]); ln.setAttribute('y2', b[1]); lines.append(ln); }
          ctx.sfx.blip(); k++; showNext();
          if (k === order.length) { done = true; finish(); }
        } else if (!nodes[i].classList.contains('done')) {
          errors++; nodes[i].classList.remove('shake'); void nodes[i].offsetWidth; nodes[i].classList.add('shake'); ctx.fb(false);
        }
      }
      const cap = 150;
      ctx.every(() => { const t = (now() - t0) / 1000; ctx.hud({ frac: Math.max(0, 1 - t / cap), label: t.toFixed(0) + '초', score: k }); if (t >= cap && !done) { done = true; finish(true); } }, 200);
      function finish(timeout) {
        const t = Math.round((now() - t0) / 100) / 10, N = order.length;
        const up = !timeout && errors <= 1 && t <= N * 1.6, down = timeout || errors >= 4 || t > N * 3.5;
        const delta = adapt(ctx.st, 10, up, down);
        ctx.later(() => ctx.finish(result({ score: timeout ? cap : t, label: timeout ? '시간 초과' : `${t}초`, sub: `${N}개 잇기 · 실수 ${errors}번`, acc: N / (N + errors), delta, metrics: { n: N, errors, done: k } })), 400);
      }
    }
  };

  /* =====================================================================
   * 실행기능 5. 탑 옮기기 (하노이의 탑) — 계획
   * ===================================================================== */
  const HN = [null, [3, false], [3, true], [4, false], [4, true], [5, false], [5, true]];
  const DISK_COL = ['#e5533d', '#f08c2e', '#e9b100', '#1f9d55', '#1f5fd6'];
  const hanoi = {
    id: 'hanoi', name: '탑 옮기기', domain: 'ef', icon: '🗼', max: 6, lowerBetter: true,
    short: '작은 원판 위에 큰 원판을 올리지 않고 탑 전체 옮기기',
    how: ['왼쪽 기둥의 탑을 <b>오른쪽 기둥</b>으로 모두 옮겨요.', '기둥을 눌러 맨 위 원판을 들고, 다른 기둥을 눌러 내려놓아요.', '<b>작은 원판 위에 큰 원판은 못 올려요.</b> 가장 적은 횟수에 도전!'],
    tip: '움직이기 전에 “맨 아래 큰 원판이 가려면 위의 것들을 어디에 둬야 하지?”를 먼저 생각해요. 원판이 홀수면 가장 작은 원판은 먼저 오른쪽으로!',
    play(ctx) {
      const L = Math.min(ctx.st.level, 6), [D, strict] = HN[L];
      const min = 2 ** D - 1, limit = Math.ceil(min * 1.3);
      const pegs = [[...Array(D)].map((_, i) => D - i), [], []];
      let held = null, moves = 0, errors = 0, t0 = now(), done = false;
      const info = h('div', { class: 'wm-mode' });
      const board = h('div', { class: 'hn-board' });
      const restart = h('button', { class: 'btn ghost sm', onclick: () => { if (done) return; pegs[0] = [...Array(D)].map((_, i) => D - i); pegs[1] = []; pegs[2] = []; held = null; moves = 0; draw(); } }, '처음부터');
      const quit = h('button', { class: 'btn ghost sm', onclick: () => end(false) }, '그만하기');
      ctx.stage.append(h('div', { class: 'g-col' }, info, board, h('div', { class: 'row' }, restart, quit)));
      const pegEls = [0, 1, 2].map(p => { const el = h('button', { class: 'hn-peg', onpointerdown: tap(() => pick(p)) }); board.append(el); return el; });
      function draw() {
        info.innerHTML = `움직인 횟수 <b>${moves}</b> · 최소 ${min}번` + (strict ? ` · <b class="tag b">${limit}번 안에</b>` : '');
        pegEls.forEach((el, p) => {
          el.replaceChildren(h('i', { class: 'hn-pole' }));
          if (p === 2) el.append(h('em', { class: 'hn-goal' }, '도착'));
          el.classList.toggle('sel', held === p);
          const stack = h('div', { class: 'hn-stack' });
          pegs[p].forEach((d, idx) => stack.append(h('div', { class: 'hn-disk' + (held === p && idx === pegs[p].length - 1 ? ' up' : ''), style: `width:${28 + d * (64 / D)}%;background:${DISK_COL[(d - 1) % 5]}` })));
          el.append(stack);
        });
        ctx.hud({ score: moves });
      }
      function pick(p) {
        if (done) return;
        if (held === null) { if (pegs[p].length) { held = p; ctx.sfx.blip(); } }
        else if (held === p) held = null;
        else {
          const d = pegs[held][pegs[held].length - 1], top = pegs[p][pegs[p].length - 1];
          if (top && top < d) { errors++; ctx.fb(false); pegEls[p].classList.remove('shake'); void pegEls[p].offsetWidth; pegEls[p].classList.add('shake'); held = null; }
          else { pegs[p].push(pegs[held].pop()); moves++; held = null; ctx.sfx.blip(); if (pegs[2].length === D) { done = true; draw(); ctx.later(() => end(true), 500); return; } }
        }
        draw();
      }
      const cap = 240;
      ctx.every(() => { const t = (now() - t0) / 1000; ctx.hud({ frac: Math.max(0, 1 - t / cap), label: `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` }); if (t >= cap && !done) { done = true; end(false); } }, 250);
      function end(ok) {
        done = true;
        const good = ok && (strict ? moves <= limit : moves <= Math.ceil(min * 1.6));
        const delta = adapt(ctx.st, 6, good, !ok || moves > min * 2.5);
        const t = Math.round((now() - t0) / 1000);
        ctx.finish(result({ score: ok ? moves : 999, label: ok ? `${moves}번 만에 성공` : '다음에 다시!', sub: `원판 ${D}개 · 최소 ${min}번 · ${t}초`, acc: null, delta, metrics: { disks: D, min, moves, errors, solved: ok, efficiency: ok ? Math.round(min / moves * 100) / 100 : 0 } }));
      }
      draw();
    }
  };

  /* =====================================================================
   * 실행기능 6. 타일 맞추기 (자기 점검형 짝 맞추기 — 뒤집어 무늬로 확인)
   * 문제 타일을 답 칸에 놓고, 다 놓으면 뒤집어 '완성 무늬'와 비교해 스스로 틀린 칸을 찾습니다.
   * ===================================================================== */
  const TL_COLORS = ['#FF7A45', '#2E9BFF', '#9B5CF6', '#12B76A', '#FFB400', '#F0447A'];
  function tlDesigns() {
    const cols = shuffle(TL_COLORS), out = new Array(12);
    let k = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const shape = pick(['q', 't', 'h']);
      const d = { color: cols[k++], shape, corner: shape === 'h' ? R(2) : R(4) };
      out[r * 4 + c] = d; out[r * 4 + (3 - c)] = Object.assign({}, d, { mirror: true });
    }
    return out;
  }
  function tlSVG(d) {
    const M = d.mirror, mc = c => (M ? [1, 0, 3, 2][c] : c);
    let shape;
    if (d.shape === 'q') { const cs = [[0, 0], [100, 0], [100, 100], [0, 100]][mc(d.corner)]; shape = `<circle cx="${cs[0]}" cy="${cs[1]}" r="80" fill="${d.color}"/>`; }
    else if (d.shape === 't') { const tris = ['0,0 100,0 0,100', '0,0 100,0 100,100', '100,0 100,100 0,100', '0,0 100,100 0,100']; shape = `<polygon points="${tris[mc(d.corner)]}" fill="${d.color}"/>`; }
    else { const side = M ? 1 - d.corner : d.corner; shape = `<rect x="${side ? 50 : 0}" y="0" width="50" height="100" fill="${d.color}"/>`; }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="100" fill="${d.color}" fill-opacity=".16"/>${shape}</svg>`;
  }
  function uniqItems(n, make) {
    const out = [], seen = new Set(); let guard = 0;
    while (out.length < n && guard++ < 8000) { const it = make(); if (!seen.has(it.key)) { seen.add(it.key); out.push(it); } }
    return out;
  }
  const between = (a, b) => a + R(b - a + 1);
  function dotsSVG(n) {
    const per = n <= 4 ? n : n <= 8 ? 4 : 4, rows = Math.ceil(n / per), W = 64, H = 16 * rows + 6;
    let c = '';
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), k = i % per, inRow = Math.min(per, n - r * per); const x = W / 2 + (k - (inRow - 1) / 2) * 15; c += `<circle cx="${x}" cy="${11 + r * 16}" r="5.5" fill="currentColor"/>`; }
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${c}</svg>`;
  }
  function clockSVG(hh, mm) {
    const ha = ((hh % 12) + mm / 60) * 30 * Math.PI / 180, ma = mm * 6 * Math.PI / 180;
    let ticks = '';
    for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; ticks += `<line x1="${25 + 17 * Math.sin(a)}" y1="${25 - 17 * Math.cos(a)}" x2="${25 + 20 * Math.sin(a)}" y2="${25 - 20 * Math.cos(a)}" stroke="currentColor" stroke-width="${i % 3 ? 1.2 : 2.2}"/>`; }
    return `<svg viewBox="0 0 50 50" width="46" height="46" aria-hidden="true"><circle cx="25" cy="25" r="23" fill="none" stroke="currentColor" stroke-width="2.4"/>${ticks}<line x1="25" y1="25" x2="${25 + 10 * Math.sin(ha)}" y2="${25 - 10 * Math.cos(ha)}" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><line x1="25" y1="25" x2="${25 + 16 * Math.sin(ma)}" y2="${25 - 16 * Math.cos(ma)}" stroke="#F04438" stroke-width="2.2" stroke-linecap="round"/><circle cx="25" cy="25" r="2.2" fill="currentColor"/></svg>`;
  }
  function pieSVG(n, d) {
    let s = '';
    for (let i = 0; i < d; i++) {
      const a0 = (i / d) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
      const p = `M20 20 L${20 + 17 * Math.cos(a0)} ${20 + 17 * Math.sin(a0)} A17 17 0 0 1 ${20 + 17 * Math.cos(a1)} ${20 + 17 * Math.sin(a1)} Z`;
      s += `<path d="${p}" fill="${i < n ? '#2E9BFF' : 'none'}" stroke="currentColor" stroke-width="1.6"/>`;
    }
    return `<svg viewBox="0 0 40 40" width="42" height="42" aria-hidden="true">${s}</svg>`;
  }
  const frac = (n, d) => `<span class="fr"><i>${n}</i><i>${d}</i></span>`;
  const TL_GEN = [null,
    () => distinct(12).map(id => ({ q: symSVG(id, 32), a: symSVG(id, 28), key: id })),
    () => shuffle([...Array(12)].map((_, i) => i + 1)).map(n => ({ q: dotsSVG(n), a: String(n), key: n })),
    () => uniqItems(12, () => { const s = between(3, 18), a = between(Math.max(1, s - 9), Math.min(9, s - 1)); return { q: `${a}+${s - a}`, a: String(s), key: s }; }),
    () => uniqItems(12, () => { const ans = between(0, 13), b = between(1, 9); return { q: `${ans + b}−${b}`, a: String(ans), key: ans }; }),
    () => uniqItems(12, () => { const hh = between(1, 12), mm = pick([0, 30]); return { q: clockSVG(hh, mm), a: `${hh}:${mm ? '30' : '00'}`, key: hh * 60 + mm }; }),
    () => uniqItems(12, () => { const st = between(1, 12), sp = between(2, 6), ans = st + sp * 3; return { q: `${st}, ${st + sp}, ${st + 2 * sp}, □`, a: String(ans), key: ans }; }),
    () => uniqItems(12, () => { const a = between(2, 9), b = between(2, 9); return { q: `${a}×${b}`, a: String(a * b), key: a * b }; }),
    () => uniqItems(12, () => { const d = between(2, 8), n = between(1, d - 1); return { q: pieSVG(n, d), a: frac(n, d), key: n + '/' + d }; }),
    () => uniqItems(12, () => { const c = between(2, 13), b = between(2, 7); return { q: `${b * c}÷${b}`, a: String(c), key: c }; }),
    () => uniqItems(12, () => {
      const t = R(4), x = between(2, 9), y = between(2, 9), z = between(2, 9);
      const q = [`(${x}+${y})×${z}`, `${x}×${y}−${z}`, `${x * y}÷${y}+${z}`, `${x}+${y}×${z}`][t];
      const a = [(x + y) * z, x * y - z, x + z, x + y * z][t];
      return { q, a: String(a), key: a };
    })
  ];
  const tiles = {
    id: 'tiles', name: '타일 맞추기', domain: 'ef', icon: '🧩', max: 10,
    initLevel: g => ({ '7세': 1, '초1': 2, '초2': 4, '초3': 6, '초4': 8, '초5': 9, '초6': 10, '중1+': 10, '중1 이상': 10 })[g] || 1,
    short: '문제 타일을 답 칸에 놓고, 뒤집어서 무늬로 스스로 확인',
    how: ['위쪽 <b>문제 타일</b>을 누르고, 아래 판에서 <b>그 답이 적힌 칸</b>을 눌러 놓아요.', '12개를 다 놓으면 <b>뒤집어 확인</b>! 다 맞으면 <b>완성 무늬</b>와 똑같은 무늬가 나와요.', '무늬가 다른 칸을 <b>스스로 찾아</b> 누르고, 다시 뒤집어 고쳐요.'],
    tip: '쉬운 문제부터 놓으면 남은 답 칸이 줄어들어 어려운 문제도 쉬워져요. 놓기 전에 답을 속으로 한 번 더 말해요.',
    play(ctx) {
      const L = Math.min(10, Math.max(1, ctx.st.level));
      let items = TL_GEN[L]();
      if (items.length < 12) items = TL_GEN[Math.max(1, L - 1)]().slice(0, 12);
      items = items.slice(0, 12);
      const designs = tlDesigns();
      const slotOf = shuffle([...Array(12).keys()]);        // 문제 i의 정답 칸
      const itemAt = new Array(12); slotOf.forEach((s, i) => { itemAt[s] = i; });
      const placed = new Array(12).fill(null), where = new Array(12).fill(null);
      let sel = null, checks = 0, firstOk = null, found = 0, wrongTotal = 0, phase = 'place', marks = new Set(), wrong = [];
      const t0 = now();
      const info = h('div', { class: 'tl-info' });
      const target = h('div', { class: 'tl-target', 'aria-label': '완성 무늬' }, designs.map(d => h('i', { html: tlSVG(d) })));
      const tray = h('div', { class: 'tl-tray' }), board = h('div', { class: 'tl-board' });
      const btn = h('button', { class: 'btn pri lg wide tl-go', onclick: () => action() }, '뒤집어 확인');
      const big = h('div', { class: 'tl-big' }, h('small', null, '완성 무늬 — 아래 판과 비교해 보세요'), h('div', { class: 'tl-big-grid' }, designs.map(d => h('i', { html: tlSVG(d) }))));
      const wrapEl = h('div', { class: 'g-col fill tl' }, h('div', { class: 'tl-head' }, info, h('div', { class: 'tl-tgt-wrap' }, h('small', null, '완성 무늬'), target)), tray, big, board, btn);
      ctx.stage.append(wrapEl);
      const cards = items.map((it, i) => { const c = h('button', { class: 'tl-card', onpointerdown: tap(() => pickCard(i)) }, h('b', null, String(i + 1)), h('span', { class: 'tl-q', html: it.q })); tray.append(c); return c; });
      const slots = [...Array(12)].map((_, s) => {
        const num = h('span', { class: 'tl-num' });
        const front = h('div', { class: 'tl-front' }, h('span', { class: 'tl-a', html: items[itemAt[s]].a }), num);
        const back = h('div', { class: 'tl-back' });
        const el = h('button', { class: 'tl-slot', onpointerdown: tap(() => pickSlot(s)) }, h('div', { class: 'tl-inner' }, front, back));
        board.append(el); return { el, back, num };
      });
      function update() {
        const n = placed.filter(x => x != null).length;
        cards.forEach((c, i) => { c.classList.toggle('sel', sel === i); c.classList.toggle('used', where[i] != null); });
        slots.forEach((o, s) => { o.el.classList.toggle('filled', placed[s] != null); o.num.textContent = placed[s] != null ? placed[s] + 1 : ''; o.el.classList.toggle('mark', marks.has(s)); });
        if (phase === 'place') info.innerHTML = sel != null ? `<b class="tag f">${sel + 1}번</b> 답이 적힌 칸을 눌러요` : `문제 타일을 고르세요 · <b>${n}</b>/12`;
        btn.disabled = phase === 'place' && n < 12;
        ctx.hud({ score: n });
      }
      function pickCard(i) {
        if (phase !== 'place') return;
        if (where[i] != null) { const s = where[i]; placed[s] = null; where[i] = null; }
        sel = sel === i ? null : i; ctx.sfx.blip(); update();
      }
      function pickSlot(s) {
        if (phase === 'find') { marks.has(s) ? marks.delete(s) : marks.add(s); ctx.sfx.blip(); update(); return; }
        if (phase !== 'place') return;
        if (sel != null) {
          if (placed[s] != null) where[placed[s]] = null;
          placed[s] = sel; where[sel] = s; sel = null; ctx.sfx.blip();
          slots[s].el.classList.remove('drop'); void slots[s].el.offsetWidth; slots[s].el.classList.add('drop');
        } else if (placed[s] != null) { where[placed[s]] = null; placed[s] = null; }
        update();
      }
      function action() {
        if (phase === 'place') {
          if (placed.some(x => x == null)) return;
          checks++;
          slots.forEach((o, s) => { o.back.innerHTML = tlSVG(designs[slotOf[placed[s]]]); o.el.classList.remove('bad', 'got'); });
          wrong = [...Array(12).keys()].filter(s => slotOf[placed[s]] !== s);
          if (firstOk == null) firstOk = 12 - wrong.length;
          board.classList.add('flipped'); wrapEl.classList.add('checking'); ctx.sfx.blip();
          if (!wrong.length) {
            phase = 'done'; info.innerHTML = '<b class="tag ok">완성!</b> 무늬가 똑같아요'; btn.disabled = true; ctx.fb(true);
            ctx.later(finish, 1300);
          } else {
            phase = 'find'; marks = new Set();
            info.innerHTML = '완성 무늬와 <b>다른 칸</b>을 모두 찾아 눌러요';
            btn.textContent = '다 찾았어요'; btn.disabled = false;
          }
        } else if (phase === 'find') {
          const got = wrong.filter(s => marks.has(s)).length;
          found += got; wrongTotal += wrong.length;
          wrong.forEach(s => slots[s].el.classList.add('bad'));
          [...marks].filter(s => !wrong.includes(s)).forEach(s => slots[s].el.classList.add('extra'));
          info.innerHTML = got === wrong.length && marks.size === wrong.length ? `<b class="tag ok">정확해요!</b> 다른 칸 ${wrong.length}개를 다 찾았어요` : `다른 칸 <b>${wrong.length}개</b> 중 <b>${got}개</b>를 찾았어요`;
          ctx.fb(got === wrong.length);
          phase = 'review'; marks = new Set(); btn.textContent = checks >= 4 ? '결과 보기' : '다시 뒤집어 고치기';
          update();
        } else if (phase === 'review') {
          if (checks >= 4) return finish();
          board.classList.remove('flipped'); wrapEl.classList.remove('checking');
          wrong.forEach(s => { const i = placed[s]; where[i] = null; placed[s] = null; slots[s].el.classList.remove('bad'); });
          slots.forEach(o => o.el.classList.remove('extra', 'got'));
          phase = 'place'; btn.textContent = '뒤집어 확인'; update();
        }
      }
      const cap = 480;
      ctx.every(() => { const t = (now() - t0) / 1000; ctx.hud({ frac: Math.max(0, 1 - t / cap), label: `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` }); if (t >= cap && phase !== 'over') finish(); }, 250);
      function finish() {
        if (phase === 'over') return;
        phase = 'over';
        const t = Math.round((now() - t0) / 1000), fo = firstOk == null ? 0 : firstOk;
        const delta = adapt(ctx.st, 10, fo === 12 && t <= 240, fo <= 7);
        ctx.finish(result({ score: fo, label: `${fo}/12 한 번에 정답`, sub: `확인 ${checks}번` + (wrongTotal ? ` · 다른 칸 찾기 ${found}/${wrongTotal}` : '') + ` · ${t}초`, acc: fo / 12, delta, metrics: { firstOk: fo, checks, selfFound: found, selfWrong: wrongTotal } }));
      }
      update();
    }
  };

  const list = [symbol, coding, compare, digits, grid, nback, stroop, switcher, gonogo, trail, hanoi, tiles];
  const byId = {}; list.forEach(g => { byId[g.id] = g; });
  return { list, byId, DOMAINS: { ps: { name: '처리속도', color: 'var(--ps)', desc: '보고 판단하고 손으로 반응하는 속도' }, wm: { name: '작업기억', color: 'var(--wm)', desc: '머릿속에 잠깐 담아 두고 바꾸는 힘' }, ef: { name: '실행기능', color: 'var(--ef)', desc: '참기·규칙 바꾸기·계획하기' } }, symSVG, h };
})();
