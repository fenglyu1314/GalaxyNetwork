import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER as SHADER_HASH      } from './shader-hash';
import { FRAGMENT_SHADER as SHADER_JITTER    } from './shader-jitter';
import { FRAGMENT_SHADER as SHADER_NEIGHBORS } from './shader-neighbors';
import { FRAGMENT_SHADER as SHADER_ORBIT     } from './shader-orbit';

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
      本节按四步推进：
      <strong>4.1</strong> 先准备好稳定的伪随机 Hash；
      <strong>4.2</strong> 用它做静态位置扰动 —— 同时暴露出"边角裁切"的问题；
      <strong>4.3</strong> 引入 <strong>3×3 邻域遍历</strong>修复裁切，
      这是后续所有章节都要复用的核心技巧；
      <strong>4.4</strong> 在邻域版本上叠一层圆周运动，画面真正动起来。
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
        { kind: 'range', uniform: 'uScale',     label: 'Scale（网格密度）', min: 2, max: 60, step: 1 },
        { kind: 'color', uniform: 'uBaseColor', label: 'Tint（色调）' },
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
          这是个真问题，下一节就来修复它。
        </p>
      `,
      shaderSource: SHADER_JITTER,
      uniforms: {
        uScale:         { type: 'float', value: 8.0 },
        uStarSize:      { type: 'float', value: 0.05 },
        uJitter:        { type: 'float', value: 0.6 },
        uGlowStrength:  { type: 'float', value: 1.0 },
        uShowGrid:      { type: 'float', value: 1.0 },  // 默认开启，方便看裁切
        uBaseColor:     { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uScale',         label: 'Scale（网格密度）',         min: 2,    max: 16,  step: 1     },
        { kind: 'range',  uniform: 'uStarSize',      label: 'StarSize（星点大小）',      min: 0.01, max: 0.3, step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',        label: 'Jitter（位置扰动）',        min: 0.0,  max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uGlowStrength',  label: 'GlowStrength（光晕强度）',  min: 0.0,  max: 5.0, step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',      label: 'ShowGrid（显示网格）' },
        { kind: 'color',  uniform: 'uBaseColor',     label: 'BaseColor（基础颜色）' },
      ],
    },
    {
      id: 'sec-04-3-neighbors',
      title: '4.3 · 3×3 邻域遍历（修复裁切）',
      intro: `
        <p>
          上一节的裁切根因在于<strong>视角错配</strong>：当前像素在
          <code>cellId = floor(grid)</code> 这个格子里，但它要找的星却可能
          因为扰动跑到了隔壁格 —— 而我们只查了自己的格子。
        </p>
        <p>
          解法是把视角反过来：不再问"我格子里的星在哪"，而是问
          "<strong>周围哪些格子里的星可能影响到我？</strong>"。
          一颗星的可见范围最多到半个格子远（光晕远端裁切阈值
          <code>smoothstep(0.25, 0, d²)</code> 对应距离 0.5），
          所以只有<strong>自己 + 8 个相邻格子</strong>这 9 个候选有可能贡献亮度，
          再远的格子可以安全忽略。
        </p>
        <p>
          代码上就是双层 <code>for</code> 遍历 <code>(ox, oy) ∈ {−1, 0, 1}²</code>，
          每个邻居算自己的星点位置，把 disk 和 halo 的贡献<strong>累加</strong>到
          当前像素。这样：
        </p>
        <p>
          • <strong>边角不再裁切</strong>：跑到隔壁的星会被当前像素当作"邻居的星"正确画出。<br/>
          • <strong>光晕自然叠加</strong>：两颗近距星之间会出现亮带，
          这是后续做"连线"的物理基础（不是真画线，是两个光晕叠加成的桥）。<br/>
          • <strong>性能可忽略</strong>：每像素 9 次 hash + 9 次距离计算，
          GPU 上几十万像素也是常数级开销。
        </p>
        <p>
          把 <strong>Jitter</strong> 直接拉到 1.0，对比上一节同样设置下边角的差异。
          再把 <strong>StarSize</strong> 调大或 <strong>GlowStrength</strong> 调高，
          能看到原本"被裁掉"的星完整显现，光晕跨格融合。
        </p>
      `,
      shaderSource: SHADER_NEIGHBORS,
      uniforms: {
        uScale:         { type: 'float', value: 8.0 },
        uStarSize:      { type: 'float', value: 0.05 },
        uJitter:        { type: 'float', value: 1.0 },
        uGlowStrength:  { type: 'float', value: 1.0 },
        uShowGrid:      { type: 'float', value: 1.0 },
        uBaseColor:     { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uScale',         label: 'Scale（网格密度）',         min: 2,    max: 16,  step: 1     },
        { kind: 'range',  uniform: 'uStarSize',      label: 'StarSize（星点大小）',      min: 0.01, max: 0.3, step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',        label: 'Jitter（位置扰动）',        min: 0.0,  max: 1.0, step: 0.01  },
        { kind: 'range',  uniform: 'uGlowStrength',  label: 'GlowStrength（光晕强度）',  min: 0.0,  max: 5.0, step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',      label: 'ShowGrid（显示网格）' },
        { kind: 'color',  uniform: 'uBaseColor',     label: 'BaseColor（基础颜色）' },
      ],
    },
    {
      id: 'sec-04-4-orbit',
      title: '4.4 · 圆周运动',
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
          整个 shader 沿用 4.3 的 <strong>3×3 邻域遍历</strong>框架：
          每个邻居先按自己的扰动得到圆心，再按自己的相位/速度做圆周运动 ——
          所以即便星被甩出原格子，相邻像素照样能正确把它画出来，光晕也能跨格融合。
        </p>
        <p>
          把 <strong>OrbitRadius</strong> 调到 0 → 等效 4.3 的静态扰动；
          缓慢拉起来 → 每颗星开始独立漂移；再调 <strong>OrbitSpeed</strong> 控整体节奏。
          这就是动态星空的全部秘密 —— 后面闪烁、连线概率都是同样的
          "hash 取参数 + uTime 驱动"套路。
        </p>
      `,
      shaderSource: SHADER_ORBIT,
      uniforms: {
        uScale:         { type: 'float', value: 8.0 },
        uStarSize:      { type: 'float', value: 0.05 },
        uJitter:        { type: 'float', value: 1.0 },
        uOrbitRadius:   { type: 'float', value: 0.08 },
        uOrbitSpeed:    { type: 'float', value: 1.0 },
        uGlowStrength:  { type: 'float', value: 1.0 },
        uShowGrid:      { type: 'float', value: 0.0 },  // 默认关闭，不打扰最终效果欣赏
        uBaseColor:     { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range',  uniform: 'uScale',         label: 'Scale（网格密度）',         min: 2,    max: 16,   step: 1     },
        { kind: 'range',  uniform: 'uStarSize',      label: 'StarSize（星点大小）',      min: 0.01, max: 0.3,  step: 0.001 },
        { kind: 'range',  uniform: 'uJitter',        label: 'Jitter（位置扰动）',        min: 0.0,  max: 1.0,  step: 0.01  },
        { kind: 'range',  uniform: 'uOrbitRadius',   label: 'OrbitRadius（轨道半径）',   min: 0.0,  max: 0.3,  step: 0.005 },
        { kind: 'range',  uniform: 'uOrbitSpeed',    label: 'OrbitSpeed（轨道速度）',    min: 0.0,  max: 3.0,  step: 0.05  },
        { kind: 'range',  uniform: 'uGlowStrength',  label: 'GlowStrength（光晕强度）',  min: 0.0,  max: 5.0,  step: 0.05  },
        { kind: 'toggle', uniform: 'uShowGrid',      label: 'ShowGrid（显示网格）' },
        { kind: 'color',  uniform: 'uBaseColor',     label: 'BaseColor（基础颜色）' },
      ],
    },
  ],
};
