// 样式图几何自检：越界、同段落文字重叠、颜色越出色板。
// 用途：SVG 是手写坐标，肉眼很难发现 3px 的重叠或 1px 的越界，交给脚本判定。
// 运行：node public/mockups/check-mockups.mjs（项目 package.json 是 "type": "module"，所以用 ESM 写法）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 目录按脚本自身位置推导，换机器、换盘符都不用改
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PALETTE = new Set([
  '#faf3e6', '#f3e9d6', '#e0d5be', '#2b2620', '#6f6353', '#a8502f',
  '#1d1913', '#2a241b', '#423a2d', '#ece3d1', '#b7ab94', '#d2795a',
  '#e8d3c4', // 照片占位用的第三层暖色，样式规格里登记过
]);

// 预算中文宽度：全角 1em，ASCII 数字/字母/空格 0.55em
function advance(text, size) {
  let w = 0;
  for (const ch of text) w += ch.codePointAt(0) > 0x2e80 ? size : size * 0.55;
  return w;
}

function sliceElements(svg) {
  const texts = [];
  const rects = [];
  // 三种写法都要吃到：<text .../>、<text ...></text>、<text ...>内容</text>
  const textRe = /<text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/text>)/g;
  const rectRe = /<rect\b([^>]*?)\/>/g;
  let m;
  while ((m = textRe.exec(svg))) texts.push({ attrs: m[1], body: (m[2] || '').replace(/<[^>]+>/g, '') });
  while ((m = rectRe.exec(svg))) rects.push(m[1]);
  return { texts, rects };
}

const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
};

let failed = false;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(path.join(DIR, file), 'utf8');
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const W = Number(vb[1]);
  const H = Number(vb[2]);
  const { texts, rects } = sliceElements(svg);
  const issues = [];

  // 1) 文本越界（宽度改用实际字形估算：SVG 里禁止用 textLength，它会拉开字距）
  const boxes = [];
  for (const t of texts) {
    const x = Number(attr(t.attrs, 'x'));
    const y = Number(attr(t.attrs, 'y'));
    const size = Number(attr(t.attrs, 'font-size') ?? 14);
    const w = advance(t.body, size);
    const anchor = attr(t.attrs, 'text-anchor') || 'start';
    const [x1, x2] = anchor === 'middle' ? [x - w / 2, x + w / 2] : anchor === 'end' ? [x - w, x] : [x, x + w];
    boxes.push({ x1, x2, y, size, text: t.body });
    if (x1 < -2 || x2 > W + 2) {
      issues.push(`越界 X: "${t.text}" [${x1.toFixed(1)}, ${x2.toFixed(1)}] 画布宽 ${W}`);
    }
    if (y + 6 > H) issues.push(`越界 Y: "${t.text}" y=${y} 画布高 ${H}`);
    if (/\btextLength=/.test(t.attrs)) issues.push(`不该出现 textLength: "${t.text}"`);
  }

  // 2) 同一行文字重叠（y 容差 2px，避免相邻行误报）
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (Math.abs(a.y - b.y) > 2) continue;
      const overlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      if (overlap > 12) issues.push(`文字重叠 ${overlap.toFixed(1)}px: "${a.text}" ↔ "${b.text}" (y=${a.y})`);
    }
  }

  // 3) rect 越界
  for (const r of rects) {
    const x = Number(attr(r, 'x') ?? 0);
    const y = Number(attr(r, 'y') ?? 0);
    const w = Number(attr(r, 'width'));
    const h = Number(attr(r, 'height'));
    if (x < 0 || y < 0 || x + w > W || y + h > H) {
      issues.push(`rect 越界: x=${x} y=${y} w=${w} h=${h}`);
    }
  }

  // 4) 颜色是否越出色板
  for (const hex of svg.match(/#[0-9a-f]{6}/gi) || []) {
    if (!PALETTE.has(hex.toLowerCase())) issues.push(`色板外颜色: ${hex}`);
  }

  console.log(`\n=== ${file} (${W}×${H}) 文本 ${texts.length} / 矩形 ${rects.length} ===`);
  if (issues.length === 0) console.log('  PASS');
  else {
    failed = true;
    for (const i of [...new Set(issues)]) console.log('  ! ' + i);
  }
}
process.exit(failed ? 1 : 0);
