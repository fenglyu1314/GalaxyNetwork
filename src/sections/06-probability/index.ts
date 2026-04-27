import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER as SHADER_SPARSE } from './shader-sparse';
import { FRAGMENT_SHADER as SHADER_EDGE   } from './shader-edge';
import { FRAGMENT_SHADER as SHADER_WEIGHT } from './shader-weight';

const BLUE: [number, number, number] = [0.6, 0.8, 1.0];

export const section06: SectionConfig = {
  id: 'sec-06-probability',
  title: '06 · 概率筛',
  intro: `
    <p>
      第 5 节得到的网络是<strong>规则鱼网</strong> —— 每个格子都有星，每对相邻星都连。
      真正的星座不是这样：它<strong>稀疏、有强弱、有选择性</strong>。
      本节把"画 / 不画"交给三个独立的概率判定，叠加起来就能让画面从鱼网变成有机星座。
    </p>
    <p>
      三步推进：
      <strong>6.1</strong> 给每颗星一个随机<strong>亮度</strong>，太暗的直接看不见 ——
      画面立刻有了亮星暗星和"空洞"；
      <strong>6.2</strong> 给每条边一个独立 hash，配合全局阈值 <code>LineDensity</code> 决定是否绘制；
      <strong>6.3</strong> 在阈值上叠加<strong>亮度偏移</strong>和<strong>距离权重</strong>，
      让"亮的、近的"邻居更容易连，画面出现层次。
    </p>
  `,
  children: [
    {
      id: 'sec-06-1-sparse',
      title: '6.1 · 星点亮度与剔除',
      intro: `
        <p>
          引入"星座感"的最自然方式：把"<strong>每颗星都一样亮、人人都在</strong>"换成
          "<strong>每颗星亮度不同，太暗的看不见</strong>"。
          只需要再取一组 hash 作为亮度 <code>b ∈ [0, 1]</code>：
        </p>
        <pre><code>// 第 3 组 hash：亮度（与位置 / 相位都正交）
float starBrightness(vec2 nbId) {
  return hash22(nbId + vec2(51.0, 89.0)).x;
}

bool starExists(vec2 nbId) {
  return starBrightness(nbId) &gt;= uMinBrightness;
}</code></pre>
        <p>
          星点遍历的 9 个邻居都做"亮度阈值剔除"，保留的星按 <code>b</code> 加权
          （<code>w = mix(0.4, 1.4, b)</code>） —— 同一帧里亮星和暗星视觉差异立刻显出来。
          连线的两个端点也用同样的判定：端点缺失则该边直接跳过。
        </p>
        <p>
          把 <strong>MinBrightness</strong> 从 0 → 0.3 → 0.6 滑动：阵列从全员均匀，到出现
          "空洞 + 亮暗对比"，再到只剩零星的亮星孤悬 —— 已经很像真实星空了。
          这同时也是后续闪烁节的基础：闪烁就是给 <code>b</code> 再叠一层时间脉冲。
        </p>
      `,
      shaderSource: SHADER_SPARSE,
      uniforms: {
        uScale:          { type: 'float', value: 8.0 },
        uStarSize:       { type: 'float', value: 0.05 },
        uJitter:         { type: 'float', value: 0.4 },
        uOrbitRadius:    { type: 'float', value: 0.06 },
        uOrbitSpeed:     { type: 'float', value: 1.0 },
        uLineWidth:      { type: 'float', value: 0.02 },
        uLineBrightness: { type: 'float', value: 0.6 },
        uGlowStrength:   { type: 'float', value: 1.0 },
        uMinBrightness:  { type: 'float', value: 0.3 },
        uShowGrid:       { type: 'float', value: 0.0 },
        uBaseColor:      { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uMinBrightness',  label: 'MinBrightness',  min: 0.0,   max: 1.0, step: 0.01  },
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
    },
    {
      id: 'sec-06-2-edge',
      title: '6.2 · 边 Hash + 全局密度',
      intro: `
        <p>
          6.1 的稀疏只来自端点缺失（亮度太低看不见）。这一节直接给"边"本身加一道概率门：
          每条边算一个独立 hash 值，<strong>只有 <code>edgeHash &lt; uLineDensity</code> 才画</strong>。
        </p>
        <p>
          关键是<strong>双向一致性</strong> —— 同一条边从两端视角看，必须算出相同的 hash，
          否则两侧像素得到不同结论会闪烁。做法是把两端 cellId 规范化：
        </p>
        <pre><code>float edgeHash(vec2 cA, vec2 cB) {
  vec2 lo = min(cA, cB);
  vec2 d  = abs(cB - cA);  // (1,0) 或 (0,1)
  return hash22(lo * 2.0 + d + vec2(257.0, 491.0)).x;
}</code></pre>
        <p>
          <code>lo*2 + d</code> 给每条边一个唯一的整数对编码 ——
          换端点顺序结果不变，每条边都有自己稳定的 hash。
        </p>
        <p>
          <strong>LineDensity</strong> 从 1.0 → 0.5 → 0.2 滑动：
          边逐渐稀疏，星座骨架的感觉越来越明显。注意星点本身不变 ——
          只是连线在按概率消失。
        </p>
      `,
      shaderSource: SHADER_EDGE,
      uniforms: {
        uScale:          { type: 'float', value: 8.0 },
        uStarSize:       { type: 'float', value: 0.05 },
        uJitter:         { type: 'float', value: 0.4 },
        uOrbitRadius:    { type: 'float', value: 0.06 },
        uOrbitSpeed:     { type: 'float', value: 1.0 },
        uLineWidth:      { type: 'float', value: 0.02 },
        uLineBrightness: { type: 'float', value: 0.8 },
        uGlowStrength:   { type: 'float', value: 1.0 },
        uMinBrightness:  { type: 'float', value: 0.3 },
        uLineDensity:    { type: 'float', value: 0.5 },
        uShowGrid:       { type: 'float', value: 0.0 },
        uBaseColor:      { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uLineDensity',    label: 'LineDensity',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uMinBrightness',  label: 'MinBrightness',  min: 0.0,   max: 1.0, step: 0.01  },
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
    },
    {
      id: 'sec-06-3-weight',
      title: '6.3 · 亮度·距离权重',
      intro: `
        <p>
          6.2 的连线是<strong>均匀稀疏</strong>——所有边一视同仁。真实星座里
          肉眼能看出的连接都集中在<strong>亮的、近的</strong>邻居之间。
          做法是把固定阈值 <code>uLineDensity</code> 换成一个<strong>动态阈值</strong>：
        </p>
        <pre><code>threshold = clamp(
  uLineDensity
  + (bA + bB - 1.0) · uBrightnessWeight       // 亮度偏移：[-1, +1] · w
  + smoothstep(1.6, 0.4, segLen²) · uDistanceWeight,  // 距离权重：近 → 大
  0.05, 0.95
);</code></pre>
        <p>
          <strong>距离权重的 smoothstep 范围</strong>需要按实际端点抖动幅度调整：
          相邻两星的 <code>segLen²</code> 在默认 <code>Jitter = 0.4 / OrbitRadius = 0.06</code>
          下集中在 <strong>[0.7, 1.4]</strong>，所以 <code>smoothstep(1.6, 0.4)</code> 刚好
          覆盖这个分布——把"很近 vs 很远"映射到 [1, 0] 全程。
          如果像原 <code>.ush</code> 那样写成 <code>smoothstep(2, 0)</code>，
          实际差异会被压缩到只剩 ±0.18 左右，肉眼几乎看不出。
        </p>
        <p>
          这里的亮度 <code>bA / bB</code> 就是 6.1 引入的 <code>starBrightness()</code>
          ——同一组 hash 既决定"剔除与否"也决定"易连与否"，自然对齐。
          两端都暗 → <code>(bA + bB - 1)</code> 接近 −1，阈值被压低，连线被砍掉；
          两端都亮 → 阈值升高，连线必然出现。距离权重同理：
          越近的邻居 <code>segLen²</code> 越小，权重越大。
        </p>
        <p>
          星点 disk + halo 的亮度加权在 6.1 已经做过了；
          这一节只是让"亮"这件事进一步影响"是否被连接" ——
          连线主干自然向亮星集中，画面有了真正的层次。
          第 7 节再给 <code>b</code> 叠一层时间脉冲，就是"闪烁"。
        </p>
        <p>
          <strong>BrightnessWeight = 0、DistanceWeight = 0</strong> → 等效 6.2 的均匀概率；
          <strong>把权重慢慢拉起来</strong> → 连线开始向亮星和近邻聚拢；
          <strong>都拉到 0.5</strong> → 主干清晰、稀疏区只剩亮星孤悬，最像真实星座。
        </p>
      `,
      shaderSource: SHADER_WEIGHT,
      uniforms: {
        uScale:             { type: 'float', value: 8.0 },
        uStarSize:          { type: 'float', value: 0.05 },
        uJitter:            { type: 'float', value: 0.4 },
        uOrbitRadius:       { type: 'float', value: 0.06 },
        uOrbitSpeed:        { type: 'float', value: 1.0 },
        uLineWidth:         { type: 'float', value: 0.02 },
        uLineBrightness:    { type: 'float', value: 0.8 },
        uGlowStrength:      { type: 'float', value: 1.0 },
        uMinBrightness:     { type: 'float', value: 0.3 },
        uLineDensity:       { type: 'float', value: 0.4 },
        uBrightnessWeight:  { type: 'float', value: 0.3 },
        uDistanceWeight:    { type: 'float', value: 0.4 },
        uShowGrid:          { type: 'float', value: 0.0 },
        uBaseColor:         { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uLineDensity',       label: 'LineDensity',       min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uBrightnessWeight',  label: 'BrightnessWeight',  min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uDistanceWeight',    label: 'DistanceWeight',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uMinBrightness',     label: 'MinBrightness',     min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uScale',             label: 'Scale',             min: 2,     max: 16,  step: 1     },
        { kind: 'range',  uniform: 'uStarSize',          label: 'StarSize',          min: 0.01,  max: 0.3, step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',            label: 'Jitter',            min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uOrbitRadius',       label: 'OrbitRadius',       min: 0.0,   max: 0.3, step: 0.005 },
        { kind: 'range',  uniform: 'uOrbitSpeed',        label: 'OrbitSpeed',        min: 0.0,   max: 3.0, step: 0.05  },
        { kind: 'range',  uniform: 'uLineWidth',         label: 'LineWidth',         min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'range',  uniform: 'uLineBrightness',    label: 'LineBrightness',    min: 0.0,   max: 1.5, step: 0.01  },
        { kind: 'range',  uniform: 'uGlowStrength',      label: 'GlowStrength',      min: 0.0,   max: 5.0, step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',          label: 'ShowGrid' },
        { kind: 'color',  uniform: 'uBaseColor',         label: 'BaseColor' },
      ],
    },
  ],
};
