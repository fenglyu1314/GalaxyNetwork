import type { SectionConfig } from '../../core/section';
import { FRAGMENT_SHADER } from './shader';

export const section01: SectionConfig = {
  id: 'sec-01-uv-point',
  title: '01 · 基于 UV 绘制单个点（光晕）',
  intro: `
    <p>
      所有星空效果的起点：把当前像素的 <code>UV</code> 坐标和某个"星点位置"
      做差，得到距离，再把距离映射成亮度。最朴素的做法是<strong>硬边圆盘</strong>
      （距离小于半径就亮，否则就黑），但这样的"星星"非常生硬。
    </p>
    <p>
      真正的光晕用一个<strong>反比函数</strong> <code>1 / (d² + ε)</code>：
      中心极亮、向外柔和衰减，再乘 <code>smoothstep</code> 把远端拉到 0，
      防止光晕拖尾到整个画面。
    </p>
    <p>
      本节把"星星"拆成两层，最朴素地叠加：<strong>核心圆盘</strong> +
      <strong>扩散光晕</strong>，最终亮度 <code>s = disk + halo · GlowStrength</code>。
      <code>GlowStrength = 0</code> 时只剩纯圆；增大时圆外出现光晕，
      但因为光晕中心峰值远大于 1，圆心也会被光晕显著加亮。
      <code>StarSize</code> 直接就是 UV 空间下的圆盘半径（画面边长为 1）。
    </p>
    <p>
      性能技巧：用 <code>dot(diff, diff)</code> 替代 <code>length(diff)</code>，
      整段计算都在 <code>d²</code> 域完成，省掉了一次 <code>sqrt</code>。
    </p>
  `,
  shaderSource: FRAGMENT_SHADER,
  uniforms: {
    uStarSize:      { type: 'float', value: 0.05 },
    uGlowStrength:  { type: 'float', value: 0.0 },
    uBaseColor:     { type: 'vec3',  value: [0.6, 0.8, 1.0] },
  },
  controls: [
    { kind: 'range', uniform: 'uStarSize',     label: 'StarSize（星点大小）',     min: 0.01, max: 0.5, step: 0.001 },
    { kind: 'range', uniform: 'uGlowStrength', label: 'GlowStrength（光晕强度）', min: 0.0,  max: 5.0, step: 0.05 },
    { kind: 'color', uniform: 'uBaseColor',    label: 'BaseColor（基础颜色）' },
  ],
};
