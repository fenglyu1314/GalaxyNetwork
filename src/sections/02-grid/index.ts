import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER } from './shader';

export const section02: SectionConfig = {
  id: 'sec-02-grid',
  title: '02 · UV 网格化（每格放一颗星）',
  intro: `
    <p>
      第 1 节只能在画面正中画一颗星。要得到漫天星空，最直接的思路是：
      <strong>把画面切成 N×N 个格子，每格画一颗星</strong>。
    </p>
    <p>
      关键技巧是<strong>两个内置函数的组合</strong>：
    </p>
    <p>
      • <code>floor(uv · scale)</code> ——
      取整后得到当前像素所属<strong>格子的整数索引</strong>，
      同一格子里所有像素拿到同一个 ID（这个 ID 是后续节做 hash / 运动 / 闪烁的基础，
      本节先不用，留作铺垫）。<br/>
      • <code>fract(uv · scale)</code> ——
      取小数部分得到当前像素<strong>在格子内的局部 UV</strong>，
      范围依然是 <code>[0, 1]</code>。
    </p>
    <p>
      于是第 1 节那段"在 vUv 上画一颗星"的代码可以<strong>原封不动</strong>地用在
      <code>cellUv</code> 上，瞬间就有了 <code>uScale²</code> 颗整齐排列的星。
    </p>
    <p>
      光晕远端裁切的阈值 <code>smoothstep(0.25, 0.0, d²)</code> 对应距离 <code>0.5</code>，
      正好是格子边长的一半 —— 这保证<strong>光晕最远只会触到格子边界</strong>，
      不会跨格干扰邻居，每格之间互不串扰。
    </p>
    <p>
      你应该能注意到：所有星点都<strong>一模一样、整齐排列</strong>，太规整、不像星空。
      下一节会用<strong>整数 Hash</strong> 给每个 <code>cellId</code> 算一个伪随机扰动，
      把这种规整感打破。
    </p>
  `,
  shaderSource: FRAGMENT_SHADER,
  uniforms: {
    uScale:         { type: 'float', value: 1.0 },
    uStarSize:      { type: 'float', value: 0.05 },
    uGlowStrength:  { type: 'float', value: 1.0 },
    uBaseColor:     { type: 'vec3',  value: [0.6, 0.8, 1.0] },
  },
  controls: [
    { kind: 'range', uniform: 'uScale',        label: 'Scale（网格密度）',        min: 1,    max: 10,  step: 1     },
    { kind: 'range', uniform: 'uStarSize',     label: 'StarSize（星点大小）',     min: 0.01, max: 0.5, step: 0.001 },
    { kind: 'range', uniform: 'uGlowStrength', label: 'GlowStrength（光晕强度）', min: 0.0,  max: 5.0, step: 0.05  },
    { kind: 'color', uniform: 'uBaseColor',    label: 'BaseColor（基础颜色）' },
  ],
};
