// 第 2 节：UV 网格化（每格放一颗星）
//
// 关键两步：
//   floor(uv * scale)  → 当前像素属于哪个格子（整数索引）
//   fract(uv * scale)  → 在格子内的局部 UV [0, 1]
// 在 cellUv 上复用第 1 节的画星代码，即可一次得到 scale × scale 颗星

export const FRAGMENT_SHADER = /* glsl */ `
void main() {
  // 把画面切成 uScale × uScale 个格子
  vec2 grid = vUv * uScale;
  vec2 cellUv = fract(grid);   // 格子内局部 UV [0, 1]
  // cellId = floor(grid) → 留给后续节做 hash / 运动 / 邻域查找

  // 以下逻辑与第 1 节完全相同，只是把 vUv 换成 cellUv
  vec2 diff = cellUv - vec2(0.5);
  float d2 = dot(diff, diff);

  float r2 = uStarSize * uStarSize;
  float disk = smoothstep(r2, r2 * 0.85, d2);

  float halo = r2 / (d2 + 0.0001);
  halo *= smoothstep(0.25, 0.0, d2);

  fragColor = vec4(uBaseColor * (disk + halo * uGlowStrength), 1.0);
}
`;
