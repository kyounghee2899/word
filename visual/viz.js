/* 모범 시각화 풀이 그리기 (SVG). problems.js 의 viz 항목을 그림으로 바꿉니다. */
const VIZ = (() => {
  let W = 640; const K = 1.3; // K: 휴대폰에서도 읽히도록 글자 확대
  const COL = { g: '#8fb069', o: '#ec9a6e', b: '#86b0d6', p: '#e9a0b8', y: '#f2cf6b', gray: '#c4bcb0' };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" font-size="${o.s || 15}" class="vt${o.c ? ' ' + o.c : ''}"${o.b ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
  const tw = (s, size = 15) => [...String(s)].reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.55 : 1) * size * K, 0);
  const svg = (h, body) => `<svg class="vz" viewBox="0 0 ${W} ${h}" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const fill = c => (c && COL[c]) || '';

  function groups(v) {
    let y = 10, out = '';
    const S = 24;
    const place = (n, each, icon) => {
      const cols = each <= 3 ? each : each === 4 ? 2 : Math.min(5, Math.ceil(each / 2));
      const rows = Math.ceil(each / cols);
      const gw = cols * S + 14, gh = rows * S + 14;
      let x = 20, rowH = 0, s = '';
      for (let g = 0; g < n; g++) {
        if (x + gw > W - 10) { x = 20; y += rowH + 10; rowH = 0; }
        s += `<rect x="${x}" y="${y}" width="${gw}" height="${gh}" rx="14" class="vgrp"/>`;
        for (let k = 0; k < each; k++) {
          const cx = x + 7 + (k % cols) * S + S / 2, cy = y + 7 + Math.floor(k / cols) * S + S / 2 + 7;
          s += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="19">${icon}</text>`;
        }
        x += gw + 10; rowH = Math.max(rowH, gh);
      }
      y += rowH + 8;
      return s;
    };
    for (const st of v.sets) {
      out += T(20, y + 16, st.label, { a: 'start', s: 15, b: 1, c: 'vg' }); y += 26;
      out += place(st.n, st.each, st.icon);
    }
    if (v.extra) {
      out += T(20, y + 16, v.extra.label, { a: 'start', s: 15, b: 1, c: 'vo' }); y += 26;
      for (let k = 0; k < v.extra.n; k++) out += `<text x="${34 + k * 28}" y="${y + 20}" text-anchor="middle" font-size="20">${v.extra.icon}</text>`;
      y += 34;
    }
    return svg(y + 6, out);
  }

  function brace(x0, x1, y, label) {
    const m = (x0 + x1) / 2, r = Math.min(8, (x1 - x0) / 4);
    return `<path d="M${x0} ${y} q0 ${r} ${r} ${r} H${m - r} q${r} 0 ${r} ${r} q0 -${r} ${r} -${r} H${x1 - r} q${r} 0 ${r} -${r}" class="vs" fill="none"/>` +
      T(m, y + 2 * r + 17, label, { s: 15, b: 1 });
  }

  function tape(v) {
    const NAME = 96, X0 = NAME + 14, AW = W - X0 - 16;
    const max = Math.max(...v.rows.map(r => (r.off || 0) + r.parts.reduce((a, p) => a + p.w, 0)));
    const sc = AW / max;
    let y = 16, out = '';
    for (const r of v.rows) {
      const H = 40;
      out += T(NAME, y + 25, r.name, { a: 'end', s: 15, b: 1 });
      let x = X0 + (r.off || 0) * sc;
      const start = x;
      for (const p of r.parts) {
        const pw = p.w * sc;
        const f = p.q ? 'none' : (fill(p.c) || '#f6efe0');
        out += `<rect x="${x}" y="${y}" width="${pw}" height="${H}" rx="4" fill="${f}" ${p.q ? 'class="vq"' : 'class="vbox"'} ${!p.q && p.c ? 'fill-opacity=".55"' : ''}/>`;
        if (p.txt) {
          const fs = Math.min(15, Math.max(10, (pw - 6) / Math.max(1, tw(p.txt, 1))));
          if (tw(p.txt, fs) <= pw - 4) out += T(x + pw / 2, y + H / 2 + fs / 3, p.txt, { s: fs, b: p.q ? 1 : 0, c: p.q ? 'vo' : '' });
          else out += T(x + pw / 2, y - 5, p.txt, { s: 12 });
        }
        x += pw;
      }
      y += H;
      if (r.brace) { out += brace(start, x, y + 4, r.brace); y += 48; } else y += 18;
    }
    return svg(y + 2, out);
  }

  function line(v) {
    const X0 = 44, X1 = W - 44;
    const px = val => X0 + (val - v.min) / (v.max - v.min) * (X1 - X0);
    const jumps = v.jumps || [], marks = v.marks || [];
    const maxRow = marks.reduce((m, k) => Math.max(m, k.row || 0), -1);
    const hasIcon = marks.some(k => k.i);
    let base = 30 + (jumps.length ? 70 : 0) + (maxRow >= 0 ? (maxRow + 1) * 22 : 0) + (hasIcon ? 28 : 0);
    let out = `<line x1="${X0 - 18}" y1="${base}" x2="${X1 + 22}" y2="${base}" class="vs" stroke-width="2.5"/>` +
      `<path d="M${X1 + 22} ${base} l-9 -5 v10 z" class="vfill"/>`;
    // ticks with staggering
    let lastEnd = -1e9, lvl = 0, lowest = base + 22;
    (v.ticks || []).forEach(([val, lab]) => {
      const x = px(val), w = tw(lab, 13);
      lvl = x - w / 2 < lastEnd + 4 ? (lvl + 1) % 2 : 0;
      if (!lvl) lastEnd = x + w / 2; else lastEnd = Math.max(lastEnd, x + w / 2);
      const ly = base + 22 + lvl * 18;
      lowest = Math.max(lowest, ly);
      out += `<line x1="${x}" y1="${base - 7}" x2="${x}" y2="${base + 7}" class="vs" stroke-width="2"/>` + T(x, ly, lab, { s: 13 });
    });
    jumps.forEach(([a, b, lab], i) => {
      const x1 = px(a), x2 = px(b), d = Math.abs(x2 - x1);
      const h = Math.min(120, 30 + d * 0.45);
      const m = (x1 + x2) / 2, back = x2 < x1;
      const c = back ? '#d9774a' : '#5e7f3d';
      out += `<path d="M${x1} ${base - 3} Q${m} ${base - h} ${x2} ${base - 3}" fill="none" stroke="${c}" stroke-width="2.4"/>`;
      // arrowhead toward x2
      const dx = x2 - m, dy = (base - 3) - (base - h), L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      out += `<path d="M${x2} ${base - 3} L${x2 - ux * 10 - uy * 5} ${base - 3 - uy * 10 + ux * 5} L${x2 - ux * 10 + uy * 5} ${base - 3 - uy * 10 - ux * 5} z" fill="${c}"/>`;
      out += `<text x="${m}" y="${base - h / 2 - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="${c}">${esc(lab)}</text>`;
    });
    marks.forEach(k => {
      const x = px(k.v);
      if (k.i) out += `<text x="${x}" y="${base - 6}" text-anchor="middle" font-size="22">${k.i}</text>`;
      else {
        const c = fill(k.c) || '#8fb069';
        out += `<circle cx="${x}" cy="${base}" r="7" fill="${c}" stroke="#4a4036" stroke-width="1"/>`;
        if (k.t) out += `<text x="${x}" y="${base - 16 - (k.row || 0) * 22}" text-anchor="middle" font-size="14" font-weight="700" fill="${c}" class="vstroke">${esc(k.t)}</text>`;
      }
    });
    return svg(lowest + 12, out);
  }

  function table(v) {
    const n = Math.max(...v.rows.map(r => r.length));
    const w0 = Math.min(180, Math.max(80, ...v.rows.map(r => tw(r[0], 14) + 24)));
    let cw = (W - 20 - w0) / Math.max(1, n - 1);
    if (n === 2) cw = W - 20 - w0;
    cw = n > 2 ? Math.min(cw, 96) : cw;
    const total = w0 + cw * (n - 1), X = (W - total) / 2, RH = 40;
    let out = '', y = 10;
    v.rows.forEach((r, ri) => {
      for (let ci = 0; ci < n; ci++) {
        const x = ci === 0 ? X : X + w0 + (ci - 1) * cw, w = ci === 0 ? w0 : cw;
        const hl = v.hl === ci && ri > 0;
        const f = ri === 0 || ci === 0 ? 'vhead' : hl ? 'vhl' : 'vcell';
        out += `<rect x="${x}" y="${y}" width="${w}" height="${RH}" class="${f}"/>`;
        const s = r[ci] ?? '';
        const fs = Math.min(15, (w - 8) / Math.max(1, tw(s, 1)));
        out += T(x + w / 2, y + RH / 2 + fs / 3, s, { s: fs, b: ci === 0 || s === '?' ? 1 : 0, c: s === '?' ? 'vo' : '' });
      }
      y += RH;
    });
    if (v.arrow) {
      const [row, labs] = v.arrow;
      const cnt = Array.isArray(labs) ? labs.length : n - 2;
      const cy = 10 + RH * (row + 1);
      for (let i = 0; i < cnt; i++) {
        const xa = X + w0 + i * cw + cw / 2, xb = xa + cw;
        out += `<path d="M${xa} ${cy + 4} Q${(xa + xb) / 2} ${cy + 30} ${xb - 4} ${cy + 6}" fill="none" stroke="#d9774a" stroke-width="2"/>` +
          `<path d="M${xb - 2} ${cy + 4} l-9 1 l5 7 z" fill="#d9774a"/>`;
        out += `<text x="${(xa + xb) / 2}" y="${cy + 44}" text-anchor="middle" font-size="13" font-weight="700" fill="#d9774a">${esc(Array.isArray(labs) ? labs[i] : labs)}</text>`;
      }
      y += 46;
    }
    return svg(y + 8, out);
  }

  function frac(v) {
    const NAME = 110, X0 = NAME + 12, BW = W - X0 - 16, H = 34;
    let y = 10, out = '';
    for (const b of v.bars) {
      const cw = BW / b.n;
      out += T(NAME, y + 22, b.label || '', { a: 'end', s: 14, b: 1 });
      let k = 0;
      for (const [cnt, c] of b.segs || []) for (let i = 0; i < cnt; i++, k++)
        out += `<rect x="${X0 + k * cw}" y="${y}" width="${cw}" height="${H}" fill="${fill(c)}" fill-opacity=".7"/>`;
      for (let i = 0; i < b.n; i++) out += `<rect x="${X0 + i * cw}" y="${y}" width="${cw}" height="${H}" class="vcellb"/>`;
      y += H + 12;
    }
    if (v.legend) {
      let x = X0;
      for (const [c, t] of v.legend) {
        out += `<rect x="${x}" y="${y + 2}" width="16" height="16" rx="3" fill="${fill(c) || '#ffffff'}" fill-opacity="${c ? .7 : 1}" class="vgc"/>`;
        out += T(x + 22, y + 15, t, { a: 'start', s: 13 });
        x += 30 + tw(t, 13);
      }
      y += 26;
    }
    return svg(y + 6, out);
  }

  function grid(v) {
    const s = Math.min(64, (W - 180) / v.c, 210 / v.r);
    const gw = s * v.c, gh = s * v.r, X = (W - gw) / 2 + 20, Y = 34;
    let out = '';
    const fillMap = [];
    let k = 0;
    for (const [cnt, c] of v.segs || []) for (let i = 0; i < cnt; i++) fillMap[k++] = c;
    for (let r = 0; r < v.r; r++) for (let c = 0; c < v.c; c++) {
      const idx = v.byCol ? c * v.r + r : r * v.c + c;
      const f = fillMap[idx];
      out += `<rect x="${X + c * s}" y="${Y + r * s}" width="${s}" height="${s}" fill="${f ? fill(f) : '#fffdf8'}" fill-opacity="${f ? .75 : 1}" class="vgc"/>`;
      if (v.cl) out += T(X + c * s + s / 2, Y + r * s + s / 2 + 5, v.cl, { s: 13 });
    }
    out += `<rect x="${X}" y="${Y}" width="${gw}" height="${gh}" fill="none" class="vs" stroke-width="2"/>`;
    if (v.wl) out += T(X + gw / 2, Y - 10, v.wl, { s: 15, b: 1 });
    if (v.hl) out += T(X - 12, Y + gh / 2 + 5, v.hl, { a: 'end', s: 15, b: 1 });
    return svg(Y + gh + 14, out);
  }

  function flow(v) {
    let y = 8, out = '';
    v.rows.forEach((row, ri) => {
      if (v.labels && v.labels[ri]) { out += T(16, y + 14, v.labels[ri], { a: 'start', s: 13, b: 1, c: 'vg' }); y += 20; }
      const items = row.map((t, i) => {
        const box = i % 2 === 0;
        return { t, box, w: box ? Math.max(64, tw(t, 15) + 22) : Math.max(56, tw(t, 14) + 16) };
      });
      let total = items.reduce((a, b) => a + b.w, 0);
      const sc = total > W - 20 ? (W - 20) / total : 1;
      let x = (W - total * sc) / 2;
      const H = 40;
      for (const it of items) {
        const w = it.w * sc;
        if (it.box) {
          const last = it === items[items.length - 1] && ri === v.rows.length - 1;
          out += `<rect x="${x}" y="${y}" width="${w}" height="${H}" rx="10" fill="#f6efe0" class="${last ? 'vhl vs' : 'vbox'}"/>`;
          out += T(x + w / 2, y + 25, it.t, { s: 15 * Math.min(1, sc + .1), b: 1 });
        } else {
          out += `<line x1="${x + 4}" y1="${y + H / 2}" x2="${x + w - 8}" y2="${y + H / 2}" stroke="#d9774a" stroke-width="2.4"/>` +
            `<path d="M${x + w - 4} ${y + H / 2} l-9 -5 v10 z" fill="#d9774a"/>`;
          out += `<text x="${x + w / 2}" y="${y + H / 2 - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="#d9774a">${esc(it.t)}</text>`;
        }
        x += w;
      }
      y += H + 16;
    });
    return svg(y, out);
  }

  function ribbons(v) {
    const total = v.n * v.len - (v.n - 1) * v.ov;
    const sc = (W - 80) / total, X = 40, H = 26;
    let out = '';
    for (let i = 0; i < v.n; i++) {
      const x = X + i * (v.len - v.ov) * sc, y = 34 + (i % 2) * 14;
      out += `<rect x="${x}" y="${y}" width="${v.len * sc}" height="${H}" rx="4" fill="${COL.b}" fill-opacity=".45" class="vbox"/>`;
      out += T(x + v.len * sc / 2, i % 2 ? y + H + 16 : y - 8, v.len + v.unit, { s: 13 });
    }
    for (let i = 1; i < v.n; i++) {
      const x = X + i * (v.len - v.ov) * sc;
      out += `<rect x="${x}" y="34" width="${v.ov * sc}" height="${H + 14}" fill="${COL.o}" fill-opacity=".75"/>`;
      out += T(x + v.ov * sc / 2, 104, v.ov + v.unit, { s: 13, b: 1, c: 'vo' });
    }
    out += brace(X, X + total * sc, 112, '? ' + v.unit);
    return svg(166, out);
  }

  function circles(v) {
    const d = Math.min(110, (W - 120) / v.n), r = d / 2, X = (W - d * v.n) / 2, Y = 40;
    let out = `<rect x="${X}" y="${Y}" width="${d * v.n}" height="${d}" fill="none" class="vs" stroke-width="2" stroke-dasharray="6 4"/>`;
    for (let i = 0; i < v.n; i++) {
      out += `<circle cx="${X + r + i * d}" cy="${Y + r}" r="${r}" fill="${COL.b}" fill-opacity=".3" class="vbox"/>`;
      out += `<line x1="${X + i * d + 4}" y1="${Y + r}" x2="${X + (i + 1) * d - 4}" y2="${Y + r}" stroke="#d9774a" stroke-width="1.6" stroke-dasharray="3 3"/>`;
    }
    out += `<line x1="${X + r}" y1="${Y + r}" x2="${X + d}" y2="${Y + r}" stroke="#d9774a" stroke-width="2.6"/>`;
    out += T(X + r + r / 2, Y + r - 8, v.txt, { s: 13, b: 1, c: 'vo' });
    out += T(X + d * v.n / 2, Y - 12, v.total || '', { s: 15, b: 1 });
    return svg(Y + d + 16, out);
  }

  function shape(v) {
    const z = W / 640; // 좌표는 가로 640 기준으로 적혀 있음
    let out = `<polygon points="${v.pts.map(p => p.join(',')).join(' ')}" fill="${COL.g}" fill-opacity=".35" class="vs" stroke-width="2.4"/>`;
    for (const [a, b, c, d] of v.dash || []) out += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" class="vs" stroke-width="2" stroke-dasharray="6 5"/>`;
    for (const [x, y, t] of v.labels || []) out += T(x, y, t, { s: 15, b: 1 });
    return svg((v.h || 230) * z, z === 1 ? out : `<g transform="scale(${z})">${out}</g>`);
  }

  const R = { groups, tape, line, table, frac, grid, flow, ribbons, circles, shape };
  const NAMES = { groups: '그림으로 나타내기', tape: '막대 도식으로 나타내기', line: '수직선으로 나타내기', table: '표로 정리하기',
    frac: '분수 막대로 나타내기', grid: '그림으로 나타내기', flow: '화살표 도식으로 나타내기', ribbons: '그림으로 나타내기',
    circles: '그림으로 나타내기', shape: '도형 그림으로 나타내기' };
  const TEMPLATE = { line: 'line', tape: 'tape', table: 'table', frac: 'tape', grid: 'grid', shape: 'grid', flow: 'blank', groups: 'blank', ribbons: 'tape', circles: 'blank' };

  return {
    render: v => (W = (typeof window !== 'undefined' && window.innerWidth < 560) ? 460 : 640, R[v.t] ? R[v.t](v).replace(/font-size="([\d.]+)"/g, (m, n) => `font-size="${(n * K).toFixed(1)}"`) : ''),
    name: v => NAMES[v.t] || '그림으로 나타내기',
    template: p => TEMPLATE[p.viz[0].t] || 'blank',
  };
})();
