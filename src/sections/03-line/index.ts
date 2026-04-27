import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER as SHADER_DISTANCE } from './shader-distance';
import { FRAGMENT_SHADER as SHADER_GRID     } from './shader-grid';
import { DIAGRAM_DISTANCE_HTML, DIAGRAM_GRID_HTML } from './diagram';

const BLUE: [number, number, number] = [0.6, 0.8, 1.0];

export const section03: SectionConfig = {
  id: 'sec-03-line',
  title: '03 · 连线算法',
  intro: `
    <p>
      GPU 上没有"画线"指令，连线只能用每个像素自己<strong>计算到线段的最短距离</strong>，
      距离小于阈值就染色。本节按两步推进：
      <strong>3.1</strong> 先把"点到线段距离"这个核心公式讲透；
      <strong>3.2</strong> 把它套进网格，每像素从所在格子中心向上下左右四方向扫描，
      得到完整的网格连线。
    </p>
  `,
  children: [
    {
      id: 'sec-03-1-distance',
      title: '3.1 · 点到线段距离',
      intro: `
        <p>
          先用最小例子讲透公式：画面上固定两颗星 <code>A = (0.25, 0.5)</code>、
          <code>B = (0.75, 0.5)</code>，把它们之间的线段画出来。
          每个像素 <code>P</code> 自己算到线段 <code>AB</code> 的最短距离，距离小于
          <code>LineWidth</code> 就染色。
        </p>
        <p>
          <strong>几何理解</strong>：
          先把 <code>P</code> 朝直线 <code>AB</code> "拍"下去，得到投影点 <code>H</code>，
          再量 <code>P</code> 到 <code>H</code> 的垂直距离 <code>d</code>。
          投影点的位置由系数 <code>h</code> 决定：<code>H = A + h · BA</code>。
          下图绿色段就是 <code>PA</code> 在 <code>BA</code> 方向上的投影 ——
          它的长度通过点积一次算出：
          <code>dot(PA, BA) = |PA|·|BA|·cos(θ)</code>
          等于<strong>投影长度乘以 <code>|BA|</code></strong>，
          所以 <code>h = dot(PA, BA) / dot(BA, BA)</code> 恰好是
          投影长度占整个 <code>|BA|</code> 的比例（即归一化的位置参数）。
        </p>
        <p>
          但这是<strong>无限延长直线</strong>的距离，我们要的是<strong>线段</strong>。
          关键一步是 <code>clamp(h, 0, 1)</code>：投影点超出 <code>B</code> 端
          （<code>h &gt; 1</code>）时，被拉回到 <code>B</code>；
          落在 <code>A</code> 端之前（<code>h &lt; 0</code>）时，被拉回到 <code>A</code>。
          这样最近点永远在线段上。
        </p>
        ${DIAGRAM_DISTANCE_HTML}
        <p>
          代码层面，得到投影点后 <code>miss = PA − BA · h</code> 就是
          <code>P</code> 到投影点的向量，<code>dot(miss, miss)</code> 直接得到
          <strong>距离平方 d²</strong>，全程不需要 <code>sqrt</code>。
          后面所有的"画线"都基于这一个函数。
        </p>
        <p>
          调 <code>LineWidth</code> 看线宽变化（<code>smoothstep(w², 0, d²)</code> 在 d² 域产生抗锯齿边缘）；
          调 <code>StarSize</code> 看端点圆盘大小。
        </p>
      `,
      shaderSource: SHADER_DISTANCE,
      uniforms: {
        uStarSize:  { type: 'float', value: 0.04 },
        uLineWidth: { type: 'float', value: 0.015 },
        uBaseColor: { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range', uniform: 'uStarSize',  label: 'StarSize（星点大小）',  min: 0.01,  max: 0.2, step: 0.001 },
        { kind: 'range', uniform: 'uLineWidth', label: 'LineWidth（连线宽度）', min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'color', uniform: 'uBaseColor', label: 'BaseColor（基础颜色）' },
      ],
    },
    {
      id: 'sec-03-2-grid',
      title: '3.2 · 网格连线（4 方向扫描）',
      intro: `
        <p>
          有了距离函数，把它套进第 2 节的网格里：每个格子中心放一颗星，
          相邻格子的星之间画线。问题转化为：<strong>对当前像素 <code>P</code>，
          哪些线段可能经过它？</strong>
        </p>
        <p>
          答案很简洁 —— 只要把连线限制在水平/垂直方向，就只有 4 条候选：
          从 <code>P</code> 所在格子中心 <code>c = cellId + 0.5</code> 出发，
          向<strong>右、下、左、上</strong>各延伸一格到邻居中心。
          其它方向的线段（比如左上邻居的右出向）整段都在当前格子之外，
          根本不可能命中 <code>P</code>。
        </p>
        ${DIAGRAM_GRID_HTML}
        <p>
          每像素 <strong>4 次 <code>distToSeg2</code></strong> 即可。
          注意相邻两格的视角下"同一条线段"会被算两次（比如格子 <code>(0,0)</code>
          的右出向和 <code>(1,0)</code> 的左出向是同一条），
          但 fragment shader 本来就是每个像素各算各的 ——
          单个像素只跑一次自己的 4 条候选，从结果上看没有任何浪费。
        </p>
        <p>
          把 <strong>LineBrightness</strong> 从 0 拉到 1 演示从星点阵列到完整网格的过渡，
          再调 <strong>LineWidth</strong>、<strong>Scale</strong> 观察效果。
          下一节加入位置扰动和圆周运动，这张规整的方格网就会变成动态的星座网络。
        </p>
      `,
      shaderSource: SHADER_GRID,
      uniforms: {
        uScale:          { type: 'float', value: 6.0 },
        uStarSize:       { type: 'float', value: 0.05 },
        uLineWidth:      { type: 'float', value: 0.02 },
        uLineBrightness: { type: 'float', value: 0.0 },
        uBaseColor:      { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range', uniform: 'uScale',          label: 'Scale（网格密度）',          min: 2,     max: 10,  step: 1     },
        { kind: 'range', uniform: 'uStarSize',       label: 'StarSize（星点大小）',       min: 0.01,  max: 0.5, step: 0.001 },
        { kind: 'range', uniform: 'uLineWidth',      label: 'LineWidth（连线宽度）',      min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'range', uniform: 'uLineBrightness', label: 'LineBrightness（连线亮度）', min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'color', uniform: 'uBaseColor',      label: 'BaseColor（基础颜色）' },
      ],
    },
  ],
};
