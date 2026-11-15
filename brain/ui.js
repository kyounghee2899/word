/* 브레인 루틴 — 디자인 요소: 아이콘 세트, 캐릭터 '브레니', 진행 링, 별점, 축하 효과 */
window.BR_UI = (function () {
  'use strict';

  /* ---------- 아이콘 (24×24, 선 2px) ---------- */
  const P = {
    symbol: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20.5 20.5"/><path d="M10.5 7.5l3 3-3 3-3-3z"/>',
    coding: '<circle cx="8" cy="15.5" r="4"/><path d="M11 12.5 19.5 4M16 7.5l2.5 2.5M13.5 10l2 2"/>',
    compare: '<path d="M2.5 12s3.6-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.6 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    digits: '<path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h15M3.5 15h15"/>',
    grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="currentColor" stroke="none"/>',
    nback: '<path d="M12 3.5 21 8.5l-9 5-9-5 9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 16.5l9 5 9-5"/>',
    stroop: '<path d="M5 20 11 4h2l6 16M7.8 14h8.4"/>',
    switch: '<path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/>',
    gonogo: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 11V4.8a1.5 1.5 0 0 1 3 0V11M14 11V6.3a1.5 1.5 0 0 1 3 0v7.4a6.3 6.3 0 0 1-6.3 6.3h-.4a6 6 0 0 1-4.8-2.4l-2.4-3.2a1.5 1.5 0 0 1 2.3-1.9L8 15"/>',
    trail: '<circle cx="5" cy="18" r="2.2"/><circle cx="12" cy="6" r="2.2"/><circle cx="19" cy="15" r="2.2"/><path d="M6.2 16 10.8 8M13.4 7.8l4.3 5.5"/>',
    hanoi: '<path d="M12 3v16.5M3.5 20.5h17M7 16.5h10M8.5 12.5h7M10 8.5h4"/>',
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
    apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2"/>',
    chart: '<path d="M5 19.5v-7M12 19.5V5M19 19.5v-10"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    book: '<path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h6v16H5a1.5 1.5 0 0 1-1.5-1.5zM20.5 5.5A1.5 1.5 0 0 0 19 4h-6v16h6a1.5 1.5 0 0 0 1.5-1.5z"/>',
    flame: '<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.5 2.5-5.6 4-8.6.4 2.1 1.6 3.2 2.7 3.4.4-3.2 1.8-5.6 3.5-6.9.4 3.8 4.8 6.4 4.8 11.4 0 4.2-3.5 7.3-8 7.3z"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    check: '<path d="M5 12.5 9.5 17 19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M9.5 9.5v10"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    trophy: '<path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6.5H4.5a3 3 0 0 0 3 4M16.5 6.5h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7M9.5 17.5h5"/>',
    install: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7.5v6M9.5 11 12 13.5 14.5 11"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'
  };
  function svg(name, size, extra) {
    return `<svg class="ico" viewBox="0 0 24 24" width="${size || 22}" height="${size || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${P[name] || ''}</svg>`;
  }
  const STAR_FILL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor"/></svg>';

  /* ---------- 캐릭터 '브레니' ---------- */
  const PALETTE = {
    pink: ['#FFC2D4', '#FF7FA6'], mint: ['#A8F0DD', '#2FC59F'], sky: ['#B9DEFF', '#4AA3FF'],
    lemon: ['#FFE8A3', '#FFB81F'], violet: ['#D9CCFF', '#9277FF'], peach: ['#FFD3BD', '#FF8B57']
  };
  let mid = 0;
  function mascot(mood, color, size) {
    const [c1, c2] = PALETTE[color] || PALETTE.pink;
    const id = 'bm' + (++mid);
    const ink = '#2A2340';
    const mouths = {
      happy: `<path d="M51 77q9 9 18 0" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      cheer: `<path d="M49 74q11 18 22 0z" fill="${ink}"/><path d="M54 82q6 4 12 0" fill="#FF6B8B"/>`,
      calm: `<path d="M53 78q7 4 14 0" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      tired: `<path d="M53 81q7-5 14 0" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M89 50q4 6 0 9q-4-3 0-9z" fill="#8FD3FF"/>`,
      wow: `<ellipse cx="60" cy="79" rx="5.5" ry="6.5" fill="${ink}"/>`
    };
    const eyes = mood === 'cheer'
      ? `<path d="M41 64q6-7 12 0M67 64q6-7 12 0" stroke="${ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="47" cy="64" rx="5.6" ry="7" fill="${ink}"/><ellipse cx="73" cy="64" rx="5.6" ry="7" fill="${ink}"/><circle cx="49.2" cy="61" r="2.1" fill="#fff"/><circle cx="75.2" cy="61" r="2.1" fill="#fff"/>`;
    const sparkle = mood === 'cheer' ? `<g fill="#FFC93C"><path d="M14 30l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z"/><path d="M104 22l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z"/><path d="M108 84l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z"/></g>` : '';
    return `<svg class="mascot ${mood}" viewBox="0 0 120 120" width="${size || 96}" height="${size || 96}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <ellipse cx="60" cy="110" rx="30" ry="5" fill="#000" opacity=".08"/>
      <path d="M60 18c12 0 20 6 24 13 9 1 17 9 17 19 6 5 8 12 6 19-2 14-13 27-28 31-6 2-13 3-19 3s-13-1-19-3c-15-4-26-17-28-31-2-7 0-14 6-19 0-10 8-18 17-19 4-7 12-13 24-13z" fill="url(#${id})"/>
      <path d="M44 33c4 5 4 10 0 15M76 33c-4 5-4 10 0 15M60 22v12M30 52c5 1 8 4 9 8M90 52c-5 1-8 4-9 8" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${eyes}
      <ellipse cx="37" cy="76" rx="6.5" ry="3.8" fill="#FF5C8A" opacity=".28"/><ellipse cx="83" cy="76" rx="6.5" ry="3.8" fill="#FF5C8A" opacity=".28"/>
      ${mouths[mood] || mouths.happy}${sparkle}
    </svg>`;
  }

  /* ---------- 진행 링 (활동마다 한 칸, 영역 색) ---------- */
  function ring(segs, size, inner) {
    const S = size || 132, r = S / 2 - 9, C = 2 * Math.PI * r, n = segs.length || 1, gap = n > 1 ? 7 : 0;
    const seg = C / n - gap;
    const arcs = segs.map((s, i) => `<circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" style="stroke:${s.done ? s.color : 'var(--ring-track)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${Math.max(0.1, seg).toFixed(2)} ${(C - seg).toFixed(2)}" stroke-dashoffset="${(-i * C / n - gap / 2).toFixed(2)}" class="${s.done ? 'on' : ''}"/>`).join('');
    return `<div class="ring2" style="width:${S}px;height:${S}px"><svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" style="transform:rotate(-90deg)">${arcs}</svg><div class="ring2-in">${inner || ''}</div></div>`;
  }

  /* ---------- 별점 ---------- */
  function stars(n) {
    return `<div class="stars">${[0, 1, 2].map(i => `<span class="st ${i < n ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.18}s">${STAR_FILL}</span>`).join('')}</div>`;
  }

  /* ---------- 숫자 올라가기 ---------- */
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(el, text) {
    const m = String(text).match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
    if (!m || reduce() || /\d/.test(m[3]) || String(text).includes('·')) { el.textContent = text; return; }
    const [, pre, num, post] = m, target = parseFloat(num), dec = (num.split('.')[1] || '').length;
    const t0 = performance.now(), dur = 700;
    const step = () => {
      const k = Math.max(0, Math.min(1, (performance.now() - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + (target * e).toFixed(dec) + post;
      if (k < 1) requestAnimationFrame(step); else el.textContent = text;
    };
    requestAnimationFrame(step);
  }

  /* ---------- 축하 꽃가루 ---------- */
  function confetti(power) {
    if (reduce()) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.append(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const cols = ['#FF7A45', '#2E9BFF', '#9B5CF6', '#FFC93C', '#16B364', '#FF5C8A'];
    const N = power || 140, ps = [];
    for (let i = 0; i < N; i++) {
      const left = i % 2 === 0;
      ps.push({ x: left ? -10 : innerWidth + 10, y: innerHeight * (0.55 + Math.random() * 0.2), vx: (left ? 1 : -1) * (4 + Math.random() * 7), vy: -(9 + Math.random() * 9), w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length] });
    }
    const t0 = performance.now();
    const tick = t => {
      const el = t - t0;
      g.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - el / 2600);
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2); g.restore();
      });
      if (el < 2600) requestAnimationFrame(tick); else cv.remove();
    };
    requestAnimationFrame(tick);
  }

  return { svg, P, mascot, PALETTE, ring, stars, countUp, confetti, reduce };
})();
