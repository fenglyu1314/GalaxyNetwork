// 第 3 节教学图示：3.1 点到线段距离的几何含义、3.2 网格 + 4 方向覆盖示意
// 用 SVG 静态绘制，嵌入到 intro 里直观展示连线算法的关键概念

// ============================================================================
// 3.1：点到线段距离 —— 投影 + clamp 的两种情况
// ============================================================================

const FONT = 'JetBrains Mono, monospace';

function svgDistance(clamped: boolean): string {
  // 共用：水平线段 AB
  const A = { x: 50, y: 95 };
  const B = { x: 175, y: 95 };
  const segment = `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>`;
  const endpoints = `
    <circle cx="${A.x}" cy="${A.y}" r="3.5" fill="#e4e4ec"/>
    <circle cx="${B.x}" cy="${B.y}" r="3.5" fill="#e4e4ec"/>
    <text x="${A.x}" y="${A.y + 18}" fill="#9aa0c7" font-size="11" font-family="${FONT}" text-anchor="middle">A</text>
    <text x="${B.x}" y="${B.y + 18}" fill="#9aa0c7" font-size="11" font-family="${FONT}" text-anchor="middle">B</text>
  `;

  let extras = '';
  if (!clamped) {
    // 情况 1：投影点 H 落在线段内（h ∈ [0,1]）
    const P = { x: 115, y: 35 };
    const H = { x: 115, y: 95 };
    extras = `
      <line x1="${A.x}" y1="${A.y}" x2="${P.x}" y2="${P.y}" stroke="#9aa0c7" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="${(A.x + P.x) / 2 - 14}" y="${(A.y + P.y) / 2 + 4}" fill="#9aa0c7" font-size="11" font-family="${FONT}">PA</text>
      <line x1="${A.x}" y1="${A.y}" x2="${H.x}" y2="${H.y}" stroke="#10b981" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
      <text x="${(A.x + H.x) / 2}" y="${A.y - 7}" fill="#10b981" font-size="11" font-family="${FONT}" text-anchor="middle">h·|BA|</text>
      <path d="M ${H.x - 7} ${H.y} L ${H.x - 7} ${H.y - 7} L ${H.x} ${H.y - 7}" fill="none" stroke="#cdd0e8" stroke-width="0.8"/>
      <line x1="${P.x}" y1="${P.y}" x2="${H.x}" y2="${H.y}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,3"/>
      <circle cx="${H.x}" cy="${H.y}" r="3" fill="#f59e0b"/>
      <circle cx="${P.x}" cy="${P.y}" r="3.5" fill="#f59e0b"/>
      <text x="${P.x + 8}" y="${P.y + 4}" fill="#f59e0b" font-size="11" font-family="${FONT}">P</text>
      <text x="${H.x + 7}" y="${H.y + 14}" fill="#f59e0b" font-size="11" font-family="${FONT}">H</text>
      <text x="${(P.x + H.x) / 2 + 8}" y="${(P.y + H.y) / 2 + 4}" fill="#cdd0e8" font-size="11" font-family="${FONT}">d</text>
    `;
  } else {
    // 情况 2：朴素投影超出 B 端，clamp 把 h 拉回 1，最近点 = B
    const P = { x: 220, y: 50 };
    const Hn = { x: 220, y: 95 };  // 朴素投影位置（在 B 之外）
    extras = `
      <circle cx="${Hn.x}" cy="${Hn.y}" r="2.8" fill="none" stroke="#5a5d80" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="${Hn.x}" y="${Hn.y + 16}" fill="#5a5d80" font-size="10" font-family="${FONT}" text-anchor="middle">H'</text>
      <line x1="${Hn.x - 4}" y1="${Hn.y}" x2="${B.x + 6}" y2="${B.y}" stroke="#5a5d80" stroke-width="1" stroke-dasharray="2,2"/>
      <circle cx="${B.x}" cy="${B.y}" r="5.5" fill="none" stroke="#f59e0b" stroke-width="1.6"/>
      <line x1="${P.x}" y1="${P.y}" x2="${B.x}" y2="${B.y}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,3"/>
      <circle cx="${P.x}" cy="${P.y}" r="3.5" fill="#f59e0b"/>
      <text x="${P.x + 8}" y="${P.y + 4}" fill="#f59e0b" font-size="11" font-family="${FONT}">P</text>
      <text x="${(P.x + B.x) / 2 + 4}" y="${(P.y + B.y) / 2 - 2}" fill="#cdd0e8" font-size="11" font-family="${FONT}">d</text>
    `;
  }

  return `<svg viewBox="0 0 245 130" xmlns="http://www.w3.org/2000/svg">
    ${segment}
    ${endpoints}
    ${extras}
  </svg>`;
}

export const DIAGRAM_DISTANCE_HTML = `
  <figure class="diagram">
    <div class="diagram-row diagram-row-2">
      <div class="diagram-card">
        ${svgDistance(false)}
        <figcaption>
          <strong>① 投影点在线段内（<code>h ∈ [0, 1]</code>）</strong><br/>
          <span style="color:#10b981">绿色段</span> = <code>PA</code> 在 <code>BA</code> 上的投影长度
          = <code>h·|BA|</code>；最近点 <code>H = A + h·BA</code>，<code>d = |PH|</code>
        </figcaption>
      </div>
      <div class="diagram-card">
        ${svgDistance(true)}
        <figcaption>
          <strong>② 投影点在端点外</strong><br/>
          <code>h &gt; 1</code> 被 <code>clamp</code> 拉回 1，最近点 = <code>B</code>，<code>d = |PB|</code>
        </figcaption>
      </div>
    </div>
  </figure>
`;

// ============================================================================
// 3.2：网格连线 + 4 方向覆盖示意
// ============================================================================

const N = 4;       // 演示用 4×4 网格
const C = 50;      // 单元格像素尺寸
const SZ = N * C;  // SVG 视口边长

function gridLines(): string {
  const items: string[] = [];
  for (let i = 1; i < N; i++) {
    items.push(`<line x1="${i * C}" y1="0" x2="${i * C}" y2="${SZ}"/>`);
    items.push(`<line x1="0" y1="${i * C}" x2="${SZ}" y2="${i * C}"/>`);
  }
  return `<g stroke="#2a2c44" stroke-width="0.6" stroke-dasharray="3,3">${items.join('')}</g>`;
}

function lines(): string {
  const half = C / 2;
  const items: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cx = c * C + half;
      const cy = r * C + half;
      if (c < N - 1) items.push(`<line x1="${cx}" y1="${cy}" x2="${cx + C}" y2="${cy}"/>`);
      if (r < N - 1) items.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + C}"/>`);
    }
  }
  return `<g stroke="#818cf8" stroke-width="2" stroke-linecap="round">${items.join('')}</g>`;
}

function stars(): string {
  const items: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      items.push(`<circle cx="${c * C + C / 2}" cy="${r * C + C / 2}" r="3.5"/>`);
    }
  }
  return `<g fill="#e4e4ec">${items.join('')}</g>`;
}

function svgGrid(): string {
  return `<svg viewBox="0 0 ${SZ} ${SZ}" xmlns="http://www.w3.org/2000/svg">
    ${gridLines()}
    ${lines()}
    ${stars()}
  </svg>`;
}

// 高亮像素 P 所在格子，从中心 c 向 4 个方向发出候选线段
function svgCoverage(): string {
  const half = C / 2;
  // 像素 P 选在 cellId=(2,2) 的格子内偏左上的位置
  const pCellC = 2;
  const pCellR = 2;
  const Px = pCellC * C + 14;
  const Py = pCellR * C + 14;

  // 当前格子高亮底色
  const cellFill = `<rect x="${pCellC * C}" y="${pCellR * C}" width="${C}" height="${C}" fill="#f59e0b" fill-opacity="0.10"/>`;

  // 中心 c 与四方向候选线段
  const cx = pCellC * C + half;
  const cy = pCellR * C + half;
  const dirLines = [
    `<line x1="${cx}" y1="${cy}" x2="${cx + C}" y2="${cy}"/>`,  // 右
    `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + C}"/>`,  // 下
    `<line x1="${cx}" y1="${cy}" x2="${cx - C}" y2="${cy}"/>`,  // 左
    `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - C}"/>`,  // 上
  ].join('');

  return `<svg viewBox="0 0 ${SZ} ${SZ}" xmlns="http://www.w3.org/2000/svg">
    ${cellFill}
    ${gridLines()}
    <g stroke="#818cf8" stroke-width="2" stroke-linecap="round">${dirLines}</g>
    ${stars()}
    <circle cx="${Px}" cy="${Py}" r="4" fill="#f59e0b"/>
    <text x="${Px + 7}" y="${Py - 6}" fill="#f59e0b" font-size="11" font-family="${FONT}">P</text>
  </svg>`;
}

// 3.2 用：完整网格 + 4 方向覆盖示意（两图并排）
export const DIAGRAM_GRID_HTML = `
  <figure class="diagram">
    <div class="diagram-row diagram-row-2">
      <div class="diagram-card">
        ${svgGrid()}
        <figcaption><strong>完整网格连线</strong><br/>每格中心向上下左右各发一条线段，所有连线连续完整</figcaption>
      </div>
      <div class="diagram-card">
        ${svgCoverage()}
        <figcaption>
          <strong>4 方向覆盖示意</strong><br/>
          像素 <span class="p-marker">P</span> 从所在格子中心 <code>c</code>
          向上下左右各发一条候选线段，共 4 条
        </figcaption>
      </div>
    </div>
  </figure>
`;
