import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER as SHADER_NETWORK } from './shader';

const BLUE: [number, number, number] = [0.6, 0.8, 1.0];

export const section05: SectionConfig = {
  id: 'sec-05-network',
  title: '05 · 星座网络（动态连线）',
  intro: `
    <p>
      把第 3 节的连线算法搬到第 4 节的动态星点上，画面终于像「星座网络」了。
      算法本身没有任何变化 —— 还是每像素从所在格子出发，向<strong>上下左右 4 个方向</strong>
      的邻居各算一条 <code>distToSeg2</code>，距离小于 <code>LineWidth</code> 就染色。
    </p>
    <p>
      唯一的不同是<strong>线段端点的来源</strong>：第 3 节里端点是固定的格子中心
      <code>cellId + 0.5</code>；这里端点是 4.4 的真实星点位置 ——
      包含扰动和圆周漂移，每帧都在动。把那段算式抽成一个函数：
    </p>
    <pre><code>vec2 starOf(vec2 nbId) {
  vec2 jitter = (hash22(nbId) - 0.5) * uJitter;
  vec2 center = nbId + 0.5 + jitter;
  vec2 h2 = hash22(nbId + vec2(127.0, 311.0));
  float phase = h2.x * TAU;
  float speed = mix(0.5, 1.5, h2.y);
  float t = uTime * uOrbitSpeed * speed + phase;
  return center + uOrbitRadius * vec2(cos(t), sin(t));
}</code></pre>
    <p>
      之后整段着色器就是<strong>两块复用</strong>：星点继续走 4.4 的 3×3 邻域累加；
      连线先取出 <code>me = starOf(cellId)</code> 和上下左右 4 个邻居的
      <code>starOf(...)</code>，再调 4 次 <code>distToSeg2</code>。
    </p>
    <p>
      <strong>关于 4 方向的简化</strong>：第 3 节"4 方向就够"成立的前提是星点居中，
      端点扰动后严格来说会漏掉一些斜向命中（比如左上邻居的星跑到它格子右下角时，
      它和当前星的连线斜穿过 P，但 P 的 4 条候选里没这一条）。
      只要 <strong>Jitter</strong> ≤ 0.5、<strong>OrbitRadius</strong> ≤ 0.1，
      端点偏离不大，肉眼几乎察觉不到；下一节会用「亮度·距离·密度」概率筛
      进一步抑制残留瑕疵。
    </p>
    <p>
      把 <strong>LineBrightness</strong> 从 0 拉起来，从动态星点阵列过渡到完整的星座网络；
      调 <strong>OrbitRadius</strong> 看连线端点跟着星点漂移摇摆；
      <strong>ShowGrid</strong> 打开能直接看到连线已经完全脱离规整方格。
    </p>
  `,
  shaderSource: SHADER_NETWORK,
  uniforms: {
    uScale:          { type: 'float', value: 8.0 },
    uStarSize:       { type: 'float', value: 0.05 },
    uJitter:         { type: 'float', value: 0.4 },
    uOrbitRadius:    { type: 'float', value: 0.06 },
    uOrbitSpeed:     { type: 'float', value: 1.0 },
    uLineWidth:      { type: 'float', value: 0.02 },
    uLineBrightness: { type: 'float', value: 0.6 },
    uGlowStrength:   { type: 'float', value: 1.0 },
    uShowGrid:       { type: 'float', value: 0.0 },
    uBaseColor:      { type: 'vec3',  value: BLUE },
  },
  controls: [
    { kind: 'range',  uniform: 'uScale',          label: 'Scale',          min: 2,     max: 16,  step: 1     },
    { kind: 'range',  uniform: 'uStarSize',       label: 'StarSize',       min: 0.01,  max: 0.3, step: 0.001 },
    { kind: 'range',  uniform: 'uJitter',         label: 'Jitter',         min: 0.0,   max: 1.0, step: 0.01  },
    { kind: 'range',  uniform: 'uOrbitRadius',    label: 'OrbitRadius',    min: 0.0,   max: 0.3, step: 0.005 },
    { kind: 'range',  uniform: 'uOrbitSpeed',     label: 'OrbitSpeed',     min: 0.0,   max: 3.0, step: 0.05  },
    { kind: 'range',  uniform: 'uLineWidth',      label: 'LineWidth',      min: 0.002, max: 0.1, step: 0.001 },
    { kind: 'range',  uniform: 'uLineBrightness', label: 'LineBrightness', min: 0.0,   max: 1.5, step: 0.01  },
    { kind: 'range',  uniform: 'uGlowStrength',   label: 'GlowStrength',   min: 0.0,   max: 5.0, step: 0.05  },
    { kind: 'toggle', uniform: 'uShowGrid',       label: 'ShowGrid' },
    { kind: 'color',  uniform: 'uBaseColor',      label: 'BaseColor' },
  ],
};
