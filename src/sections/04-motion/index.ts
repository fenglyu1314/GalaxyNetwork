import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER as SHADER_HASH   } from './shader-hash';
import { FRAGMENT_SHADER as SHADER_JITTER } from './shader-jitter';
import { FRAGMENT_SHADER as SHADER_ORBIT  } from './shader-orbit';

const BLUE: [number, number, number] = [0.6, 0.8, 1.0];

export const section04: SectionConfig = {
  id: 'sec-04-motion',
  title: '04 · 位置扰动与圆周运动',
  intro: `
    <p>
      前面三节得到的还是一个<strong>整齐方阵</strong> —— 星点全在格子中心、一动不动。
      要做出"星空"的感觉，需要两件事：
      <strong>每颗星位置不同</strong>（破规整），<strong>每颗星各自漂移</strong>（动起来）。
    </p>
    <p>
      这两件事都依赖同一个工具：能为每个 <code>cellId</code>
      算出<strong>稳定的伪随机数</strong>的 Hash 函数。本节按三步推进：
      <strong>4.1</strong> 先把 Hash 准备好；
      <strong>4.2</strong> 用它做静态位置扰动；
      <strong>4.3</strong> 再叠一层圆周运动让画面动起来。
    </p>
  `,
  children: [
    {
      id: 'sec-04-1-hash',
      title: '4.1 · 伪随机 Hash',
      intro: `
        <p>
          GPU 上常见的"一行 Hash"是 <code>fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)</code> ——
          短小但有两个硬伤：<strong>跨 GPU 不一致</strong>（不同厂商的
          <code>sin</code> 精度实现不同），且大数乘三角函数容易精度坍缩，
          远处会出现规律性条纹。
        </p>
        <p>
          更稳健的做法是<strong>整数位运算 Hash</strong>。这里用 <strong>PCG 2D</strong>
          （Permuted Congruential Generator 的二维版）：把整数坐标乘以大常数、
          行列交叉混合、再把高 16 位异或下沉到低位。整个过程只有
          整数加/乘/异或/位移，<strong>跨 GPU 结果完全一致</strong>，
          且雪崩效应良好（相邻输入差 1，输出几乎完全不同）。
        </p>
        <p>
          演示把 hash 的两个分量分别送给 R/G 通道，
          每个格子稳定显示一个随机色块。把 <strong>Scale</strong> 拉大能看到密集的
          均匀分布——既不会成行成列出现重复，也不会有明显的色块团簇。
        </p>
      `,
      shaderSource: SHADER_HASH,
      uniforms: {
        uScale:     { type: 'float', value: 16.0 },
        uBaseColor: { type: 'vec3',  value: [1.0, 1.0, 1.0] },
      },
      controls: [
        { kind: 'range', uniform: 'uScale',     label: 'Scale', min: 2, max: 60, step: 1 },
        { kind: 'color', uniform: 'uBaseColor', label: 'Tint' },
      ],
    },
    {
      id: 'sec-04-2-jitter',
      title: '4.2 · 位置扰动（静态）',
      intro: `
        <p>
          有了 Hash，做位置扰动只需<strong>一行</strong>：
          <code>starPos = c + (hash22(cellId) − 0.5) · uJitter</code>。
          <code>hash22</code> 输出 <code>[0, 1]²</code>，减 0.5 后变成
          <code>[−0.5, 0.5]²</code> 的均匀偏移，乘 <code>uJitter</code> 控制最大幅度。
        </p>
        <p>
          一个实现细节：之前在第 2 节用的是 <code>cellUv = fract(grid)</code> 这种
          <strong>格子内局部坐标</strong>，星点必须在格子中心；现在星点会偏离中心，
          继续用局部坐标就算不准距离了。所以这里改在<strong>网格坐标系</strong>下
          直接算 <code>diff = grid − starPos</code>，单位还是"一个格子 = 一个单位"，
          含义直观。
        </p>
        <p>
          把 <strong>Jitter</strong> 从 0 缓慢拉到 1：星点从规整方阵逐渐打散。
          拉到接近 1 时会注意到边角的星<strong>被裁掉</strong>了 ——
          因为它们越过了所属格子的边界，而当前像素只查了"自己格子"的星。
          这个问题留到「邻域查找」一节用 3×3 邻居遍历彻底解决，
          本节先用较小的 Jitter（默认 0.6）规避。
        </p>
      `,
      shaderSource: SHADER_JITTER,
      uniforms: {
        uScale:         { type: 'float', value: 8.0 },
        uStarSize:      { type: 'float', value: 0.05 },
        uJitter:        { type: 'float', value: 0.6 },
        uGlowStrength:  { type: 'float', value: 1.0 },
        uBaseColor:     { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range', uniform: 'uScale',         label: 'Scale',         min: 2,    max: 16,  step: 1     },
        { kind: 'range', uniform: 'uStarSize',      label: 'StarSize',      min: 0.01, max: 0.3, step: 0.001 },
        { kind: 'range', uniform: 'uJitter',        label: 'Jitter',        min: 0.0,  max: 1.0, step: 0.01  },
        { kind: 'range', uniform: 'uGlowStrength',  label: 'GlowStrength',  min: 0.0,  max: 5.0, step: 0.05  },
        { kind: 'color', uniform: 'uBaseColor',     label: 'BaseColor' },
      ],
    },
    {
      id: 'sec-04-3-orbit',
      title: '4.3 · 圆周运动',
      intro: `
        <p>
          最后一步：让每颗星<strong>绕着自己的扰动位置</strong>做小圆周漂移。
          公式是教科书级的圆周参数方程：
          <code>orbit = uOrbitRadius · (cos(t), sin(t))</code>。
          关键不在公式本身，而在于<strong>每颗星的 t 必须不同</strong> ——
          否则所有星会同步转，看起来像整张图在平移。
        </p>
        <p>
          用第二组 hash 取出每颗星独立的<strong>初相位 φ</strong> 和
          <strong>速度倍率 speed</strong>：
          <code>t = uTime · uOrbitSpeed · speed + φ</code>。
          这里给 hash 的输入加一个常量偏移
          （<code>cellId + vec2(127, 311)</code>），就能从同一个
          hash 函数里取到一对全新的随机值，不需要再写一个 hash 函数。
        </p>
        <p>
          把 <strong>OrbitRadius</strong> 调到 0 → 静态扰动；缓慢拉起来 → 每颗星开始独立漂移；
          再调 <strong>OrbitSpeed</strong> 控整体节奏。这就是动态星空的全部秘密 ——
          后面闪烁、连线概率都是同样的"hash 取参数 + uTime 驱动"套路。
        </p>
      `,
      shaderSource: SHADER_ORBIT,
      uniforms: {
        uScale:         { type: 'float', value: 8.0 },
        uStarSize:      { type: 'float', value: 0.05 },
        uJitter:        { type: 'float', value: 0.6 },
        uOrbitRadius:   { type: 'float', value: 0.08 },
        uOrbitSpeed:    { type: 'float', value: 1.0 },
        uGlowStrength:  { type: 'float', value: 1.0 },
        uBaseColor:     { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range', uniform: 'uScale',         label: 'Scale',         min: 2,    max: 16,   step: 1     },
        { kind: 'range', uniform: 'uStarSize',      label: 'StarSize',      min: 0.01, max: 0.3,  step: 0.001 },
        { kind: 'range', uniform: 'uJitter',        label: 'Jitter',        min: 0.0,  max: 1.0,  step: 0.01  },
        { kind: 'range', uniform: 'uOrbitRadius',   label: 'OrbitRadius',   min: 0.0,  max: 0.3,  step: 0.005 },
        { kind: 'range', uniform: 'uOrbitSpeed',    label: 'OrbitSpeed',    min: 0.0,  max: 3.0,  step: 0.05  },
        { kind: 'range', uniform: 'uGlowStrength',  label: 'GlowStrength',  min: 0.0,  max: 5.0,  step: 0.05  },
        { kind: 'color', uniform: 'uBaseColor',     label: 'BaseColor' },
      ],
    },
  ],
};
