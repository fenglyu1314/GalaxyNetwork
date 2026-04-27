// 第 1 节：基于 UV 绘制单个点 + 光晕
//
// 两层叠加：
//   1. 圆盘 disk：距离小于半径则亮
//   2. 光晕 halo：反比函数 1 / (d² + ε)，向外柔和衰减
//   3. 最终亮度 = disk + halo * GlowStrength

export const FRAGMENT_SHADER = /* glsl */ `
void main() {
  // 像素到星点（画面中心）的向量与距离平方
  vec2 diff = vUv - vec2(0.5);
  float d2 = dot(diff, diff);

  // 圆盘：smoothstep 让边缘抗锯齿
  float r2 = uStarSize * uStarSize;
  float disk = smoothstep(r2, r2 * 0.85, d2);

  // 光晕：反比函数 + 远端 smoothstep 收敛到 0
  float halo = r2 / (d2 + 0.0001);
  halo *= smoothstep(0.25, 0.0, d2);

  fragColor = vec4(uBaseColor * (disk + halo * uGlowStrength), 1.0);
}
`;
