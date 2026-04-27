// 3.2 网格连线：每像素从所在格子中心向上下左右 4 个方向各发一条候选线段
// 在"只画水平/垂直连线 + 星点居中"的前提下，这是覆盖所有可能命中线段的最小集

export const FRAGMENT_SHADER = /* glsl */ `
float distToSeg2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 miss = pa - ba * h;
  return dot(miss, miss);
}

void main() {
  vec2 grid = vUv * uScale;
  vec2 cellId = floor(grid);
  vec2 cellUv = fract(grid);

  // 从当前格子中心 c，向四个方向延伸到邻居中心
  vec2 c = cellId + 0.5;
  float w2 = uLineWidth * uLineWidth;
  float lines =
      smoothstep(w2, 0.0, distToSeg2(grid, c, c + vec2( 1.0,  0.0)))   // 右
    + smoothstep(w2, 0.0, distToSeg2(grid, c, c + vec2( 0.0,  1.0)))   // 下
    + smoothstep(w2, 0.0, distToSeg2(grid, c, c + vec2(-1.0,  0.0)))   // 左
    + smoothstep(w2, 0.0, distToSeg2(grid, c, c + vec2( 0.0, -1.0)));  // 上

  // 星点（与第 2 节相同：在 cellUv 中心画硬边圆盘）
  vec2 diff = cellUv - vec2(0.5);
  float d2 = dot(diff, diff);
  float r2 = uStarSize * uStarSize;
  float disk = smoothstep(r2, r2 * 0.85, d2);

  fragColor = vec4(uBaseColor * (disk + lines * uLineBrightness), 1.0);
}
`;
