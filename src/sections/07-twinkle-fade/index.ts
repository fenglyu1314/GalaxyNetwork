import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER as SHADER_TWINKLE } from './shader-twinkle';
import { FRAGMENT_SHADER as SHADER_FADE    } from './shader-fade';
import { FRAGMENT_SHADER as SHADER_FINAL   } from './shader-final';

const BLUE: [number, number, number] = [0.6, 0.8, 1.0];

export const section07: SectionConfig = {
  id: 'sec-07-twinkle-fade',
  title: '07 · 闪烁与连线过渡',
  intro: `
    <p>
      第 6 节的星座已经"稀疏有层次"了，但画面是<strong>静止的网</strong> ——
      星星亮度恒定、连线宽窄一致。真实星空不是这样：星星会<strong>闪</strong>，
      远处的连线在视觉上会<strong>淡出</strong>。
      这一节加这两件事，画面就从"星座骨架"变成"会呼吸的星空"。
    </p>
    <p>
      两步独立推进，最后合成：
      <strong>7.1</strong> 给静态亮度 <code>b</code> 叠一层时间脉冲，每颗星独立频率 / 相位；
      <strong>7.2</strong> 用 <code>segLen²</code> 算一个权重，<strong>同时</strong>缩"线宽"和"亮度"，
      远端连线"既细又透"地隐去；
      <strong>7.3</strong> 二者合成，得到本系列的最终效果，下一节会给出对应的 UE Custom Node 实现。
    </p>
  `,
  children: [
    {
      id: 'sec-07-1-twinkle',
      title: '7.1 · 星点闪烁',
      intro: `
        <p>
          6.1 引入的 <code>starBrightness</code> 是个<strong>静态</strong>的随机数 ——
          每颗星生下来多亮就一直多亮。要让它"闪"，只要在它身上叠一层时间脉冲：
        </p>
        <pre><code>float starTwinkle(vec2 nbId) {
  vec2 hb = hash22(nbId + vec2(51.0, 89.0));
  float bStatic = hb.x;
  float twHash  = hb.y;     // 复用同一组 hash 的另一分量
  float freq  = mix(1.0, 3.0, twHash) * uTwinkleSpeed;
  float phase = twHash * TAU;
  float pulse = sin(uTime * freq + phase) * 0.5 + 0.5;
  pulse *= pulse;           // 让"暗"的时段比"亮"的时段长
  return bStatic * mix(1.0 - uTwinkleAmount, 1.0, pulse);
}</code></pre>
        <p>
          三个细节决定了"像不像在闪"：
        </p>
        <ul>
          <li><strong>独立频率 / 相位</strong>：每颗星 <code>freq</code> 与 <code>phase</code>
            都从 hash 派生，不会整片同步闪 —— 那种是 LED 不是星空。</li>
          <li><strong><code>pulse²</code></strong>：把 <code>[0, 1]</code> 的余弦映射拗成
            "暗久亮短"的曲线，亮峰像短促的火花，更像大气抖动造成的 scintillation。</li>
          <li><strong>静 / 动分离</strong>：<code>starExists</code> 仍然只看
            <code>bStatic</code>，星不会瞬间消失再出现 —— 只是亮度在脉动。</li>
        </ul>
        <p>
          连线阈值的 <code>bMe / bNb</code> 也换成 <code>starTwinkle</code> ——
          闪到亮峰时 <code>(bA + bB - 1)</code> 变正、阈值升高，连线短暂浮现；
          谷底时连线悄悄淡出。整张图开始呈现"亮星先连，再扩散"的呼吸节奏。
        </p>
        <p>
          沿用 6.1 的"亮度同时缩半径"约定，星点的 <code>r</code> 也以 <code>bDyn</code> 驱动 ——
          谷底时星点<strong>同时变暗 + 缩小</strong>，亮度·体积双重收缩，
          闪烁感比"只调亮度"明显得多。
        </p>
      `,
      shaderSource: SHADER_TWINKLE,
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
        uLineDensity:       { type: 'float', value: 0.5 },
        uBrightnessWeight:  { type: 'float', value: 0.3 },
        uDistanceWeight:    { type: 'float', value: 0.4 },
        uTwinkleSpeed:      { type: 'float', value: 1.5 },
        uTwinkleAmount:     { type: 'float', value: 0.7 },
        uShowGrid:          { type: 'float', value: 0.0 },
        uBaseColor:         { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uTwinkleSpeed',     label: 'TwinkleSpeed（闪烁速度）',     min: 0.0,   max: 4.0, step: 0.05  },
        { kind: 'range',  uniform: 'uTwinkleAmount',    label: 'TwinkleAmount（闪烁深度）',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uLineDensity',      label: 'LineDensity（连线密度）',      min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uBrightnessWeight', label: 'BrightnessWeight（亮度权重）', min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uDistanceWeight',   label: 'DistanceWeight（距离权重）',   min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uMinBrightness',    label: 'MinBrightness（亮度阈值）',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uScale',            label: 'Scale（网格密度）',            min: 2,     max: 16,  step: 1     },
        { kind: 'range',  uniform: 'uStarSize',         label: 'StarSize（星点大小）',         min: 0.01,  max: 0.3, step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',           label: 'Jitter（位置扰动）',           min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uOrbitRadius',      label: 'OrbitRadius（轨道半径）',      min: 0.0,   max: 0.3, step: 0.005 },
        { kind: 'range',  uniform: 'uOrbitSpeed',       label: 'OrbitSpeed（轨道速度）',       min: 0.0,   max: 3.0, step: 0.05  },
        { kind: 'range',  uniform: 'uLineWidth',        label: 'LineWidth（连线宽度）',        min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'range',  uniform: 'uLineBrightness',   label: 'LineBrightness（连线亮度）',   min: 0.0,   max: 1.5, step: 0.01  },
        { kind: 'range',  uniform: 'uGlowStrength',     label: 'GlowStrength（光晕强度）',     min: 0.0,   max: 5.0, step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',         label: 'ShowGrid（显示网格）' },
        { kind: 'color',  uniform: 'uBaseColor',        label: 'BaseColor（基础颜色）' },
      ],
    },
    {
      id: 'sec-07-2-fade',
      title: '7.2 · 连线距离过渡',
      intro: `
        <p>
          6.3 之前的连线只要被概率筛放行，就以 <code>LineWidth</code> <strong>全宽全亮</strong>画出来 ——
          短的、长的看起来一样硬，画面欠缺真实星图的渐隐感。
          这一节用 <code>segLen²</code> 算一个 <code>[0, 1]</code> 的衰减权重，
          <strong>同时缩"宽"和"亮"</strong>：
        </p>
        <pre><code>float distFade = smoothstep(uLineFadeFar, uLineFadeNear, segLen2);
//   segLen² ≤ Near → 1.0   近 → 全宽全亮
//   segLen² ≥ Far  → 0.0   远 → 直接消失

float w2eff = w2 * distFade;                              // 一次缩宽
lines += smoothstep(w2eff, 0.0, distToSeg2(grid, me, nb))
       * distFade;                                        // 一次缩亮</code></pre>
        <p>
          一次缩宽、一次缩亮 —— 远端连线不是被一刀切断，而是<strong>"尖出去并淡出"</strong>，
          形状自然得多。
        </p>
        <p>
          默认 <code>Near = 0.16 / Far = 1.44</code> 对应 <code>segLen ∈ [0.4, 1.2]</code> 的过渡带 ——
          网格化后单元尺寸为 1，所以这个范围正好覆盖"邻格 → 跨两格"的距离。
          注意这里的"距离过渡"和 6.3 的"距离权重"不是一回事：
          6.3 改的是<strong>连线是否出现的概率</strong>，而这里改的是<strong>已经出现的连线的"宽度 + 亮度"</strong>，
          作用在两个不同环节，叠加起来才能让远端的连线既稀疏又柔。
        </p>
        <p>
          调小 <code>LineFadeFar</code>（比如 0.8）→ 远的线整批消失、画面更稀疏；
          调大 <code>LineFadeNear</code>（比如 0.6）→ 连"近"线也开始变细，整体更柔。
          本节<strong>不含闪烁</strong>，让你看清"距离过渡"单独带来的视觉变化。
        </p>
      `,
      shaderSource: SHADER_FADE,
      uniforms: {
        uScale:             { type: 'float', value: 8.0 },
        uStarSize:          { type: 'float', value: 0.05 },
        uJitter:            { type: 'float', value: 0.4 },
        uOrbitRadius:       { type: 'float', value: 0.06 },
        uOrbitSpeed:        { type: 'float', value: 1.0 },
        uLineWidth:         { type: 'float', value: 0.03 },
        uLineBrightness:    { type: 'float', value: 0.9 },
        uGlowStrength:      { type: 'float', value: 1.0 },
        uMinBrightness:     { type: 'float', value: 0.3 },
        uLineDensity:       { type: 'float', value: 0.5 },
        uBrightnessWeight:  { type: 'float', value: 0.3 },
        uDistanceWeight:    { type: 'float', value: 0.4 },
        uLineFadeNear:      { type: 'float', value: 0.16 },
        uLineFadeFar:       { type: 'float', value: 1.44 },
        uShowGrid:          { type: 'float', value: 0.0 },
        uBaseColor:         { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uLineFadeNear',     label: 'LineFadeNear（近端阈值）',     min: 0.0,   max: 1.5, step: 0.01  },
        { kind: 'range',  uniform: 'uLineFadeFar',      label: 'LineFadeFar（远端阈值）',      min: 0.2,   max: 3.0, step: 0.01  },
        { kind: 'range',  uniform: 'uLineDensity',      label: 'LineDensity（连线密度）',      min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uBrightnessWeight', label: 'BrightnessWeight（亮度权重）', min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uDistanceWeight',   label: 'DistanceWeight（距离权重）',   min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uMinBrightness',    label: 'MinBrightness（亮度阈值）',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uScale',            label: 'Scale（网格密度）',            min: 2,     max: 16,  step: 1     },
        { kind: 'range',  uniform: 'uStarSize',         label: 'StarSize（星点大小）',         min: 0.01,  max: 0.3, step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',           label: 'Jitter（位置扰动）',           min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uOrbitRadius',      label: 'OrbitRadius（轨道半径）',      min: 0.0,   max: 0.3, step: 0.005 },
        { kind: 'range',  uniform: 'uOrbitSpeed',       label: 'OrbitSpeed（轨道速度）',       min: 0.0,   max: 3.0, step: 0.05  },
        { kind: 'range',  uniform: 'uLineWidth',        label: 'LineWidth（连线宽度）',        min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'range',  uniform: 'uLineBrightness',   label: 'LineBrightness（连线亮度）',   min: 0.0,   max: 1.5, step: 0.01  },
        { kind: 'range',  uniform: 'uGlowStrength',     label: 'GlowStrength（光晕强度）',     min: 0.0,   max: 5.0, step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',         label: 'ShowGrid（显示网格）' },
        { kind: 'color',  uniform: 'uBaseColor',        label: 'BaseColor（基础颜色）' },
      ],
    },
    {
      id: 'sec-07-3-final',
      title: '7.3 · 完整合成',
      intro: `
        <p>
          把 7.1 闪烁和 7.2 距离过渡同时打开，再选一组"最像星空"的预设：
          稀疏星 + 暗淡基底 + 强亮峰闪烁。至此本系列的算法已经完整：
        </p>
        <ul>
          <li>整数 hash 生成<strong>稳定</strong>的随机量（pcg2d）</li>
          <li>每格一颗星 + 圆周运动 + 独立相位 / 速度</li>
          <li>亮度剔除 + 边 hash + 亮度·距离<strong>双向</strong>权重的概率筛</li>
          <li>时间脉冲闪烁（<code>pulse²</code> 呼吸，亮度与半径同步）</li>
          <li>连线远端的距离过渡（线宽 + 亮度同步收窄）</li>
        </ul>
        <p>
          下一节用<strong>一个 UE Custom Node</strong> 把整套算法搬进虚幻 ——
          把这一节的 GLSL 翻译成 HLSL、贴进 Custom Node 的 Code 字段、
          按表配置输入引脚，就能在材质里直接得到同样的效果。
        </p>
      `,
      shaderSource: SHADER_FINAL,
      uniforms: {
        uScale:             { type: 'float', value: 9.0 },
        uStarSize:          { type: 'float', value: 0.04 },
        uJitter:            { type: 'float', value: 0.5 },
        uOrbitRadius:       { type: 'float', value: 0.05 },
        uOrbitSpeed:        { type: 'float', value: 0.8 },
        uLineWidth:         { type: 'float', value: 0.025 },
        uLineBrightness:    { type: 'float', value: 0.7 },
        uGlowStrength:      { type: 'float', value: 1.2 },
        uMinBrightness:     { type: 'float', value: 0.4 },
        uLineDensity:       { type: 'float', value: 0.35 },
        uBrightnessWeight:  { type: 'float', value: 0.4 },
        uDistanceWeight:    { type: 'float', value: 0.5 },
        uTwinkleSpeed:      { type: 'float', value: 1.5 },
        uTwinkleAmount:     { type: 'float', value: 0.75 },
        uLineFadeNear:      { type: 'float', value: 0.16 },
        uLineFadeFar:       { type: 'float', value: 1.44 },
        uShowGrid:          { type: 'float', value: 0.0 },
        uBaseColor:         { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uTwinkleSpeed',     label: 'TwinkleSpeed（闪烁速度）',     min: 0.0,   max: 4.0, step: 0.05  },
        { kind: 'range',  uniform: 'uTwinkleAmount',    label: 'TwinkleAmount（闪烁深度）',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uLineFadeNear',     label: 'LineFadeNear（近端阈值）',     min: 0.0,   max: 1.5, step: 0.01  },
        { kind: 'range',  uniform: 'uLineFadeFar',      label: 'LineFadeFar（远端阈值）',      min: 0.2,   max: 3.0, step: 0.01  },
        { kind: 'range',  uniform: 'uLineDensity',      label: 'LineDensity（连线密度）',      min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uBrightnessWeight', label: 'BrightnessWeight（亮度权重）', min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uDistanceWeight',   label: 'DistanceWeight（距离权重）',   min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uMinBrightness',    label: 'MinBrightness（亮度阈值）',    min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uScale',            label: 'Scale（网格密度）',            min: 2,     max: 16,  step: 1     },
        { kind: 'range',  uniform: 'uStarSize',         label: 'StarSize（星点大小）',         min: 0.01,  max: 0.3, step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',           label: 'Jitter（位置扰动）',           min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uOrbitRadius',      label: 'OrbitRadius（轨道半径）',      min: 0.0,   max: 0.3, step: 0.005 },
        { kind: 'range',  uniform: 'uOrbitSpeed',       label: 'OrbitSpeed（轨道速度）',       min: 0.0,   max: 3.0, step: 0.05  },
        { kind: 'range',  uniform: 'uLineWidth',        label: 'LineWidth（连线宽度）',        min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'range',  uniform: 'uLineBrightness',   label: 'LineBrightness（连线亮度）',   min: 0.0,   max: 1.5, step: 0.01  },
        { kind: 'range',  uniform: 'uGlowStrength',     label: 'GlowStrength（光晕强度）',     min: 0.0,   max: 5.0, step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',         label: 'ShowGrid（显示网格）' },
        { kind: 'color',  uniform: 'uBaseColor',        label: 'BaseColor（基础颜色）' },
      ],
    },
  ],
};
