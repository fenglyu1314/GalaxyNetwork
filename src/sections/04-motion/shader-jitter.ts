// 4.2 位置扰动：把每颗星从格子中心推开一段随机距离
//
// 核心：starPos = c + (hash22(cellId) − 0.5) · uJitter
//   - hash22 输出 [0,1]² → 减 0.5 后得到 [−0.5, 0.5]² 的均匀偏移
//   - uJitter 控制最大偏移幅度（1.0 时星可能撞到格子边界）
//
// 注意：由于现在直接在「网格坐标系」下算像素到星点的距离（grid - starPos），
// 不再使用 cellUv 局部坐标，距离单位与第 2 节一致（一个格子 = 一个单位）。

export const FRAGMENT_SHADER = /* glsl */ `
uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}

vec2 hash22(vec2 p) {
  uvec2 u = pcg2d(uvec2(ivec2(p)));
  return vec2(u) * (1.0 / 4294967295.0);
}

void main() {
  vec2 grid = vUv * uScale;
  vec2 cellId = floor(grid);

  // 每格星点 = 中心 + hash 偏移
  vec2 c = cellId + 0.5;
  vec2 jitter = (hash22(cellId) - 0.5) * uJitter;
  vec2 starPos = c + jitter;

  // 像素到星点的距离（直接在网格坐标系下，单位 = 格子边长）
  vec2 diff = grid - starPos;
  float d2 = dot(diff, diff);

  float r2 = uStarSize * uStarSize;
  float disk = smoothstep(r2, r2 * 0.85, d2);

  // 光晕：远端裁切到 0.5（半个格子），避免大幅扰动后跨格干扰
  float halo = r2 / (d2 + 0.0001);
  halo *= smoothstep(0.25, 0.0, d2);

  fragColor = vec4(uBaseColor * (disk + halo * uGlowStrength), 1.0);

  // 网格线叠加：用于观察星点是否被裁到格子边界外
  if (uShowGrid > 0.5) {
    vec2 f = fract(grid);
    vec2 dg = min(f, 1.0 - f);
    float gridDist = min(dg.x, dg.y);
    float gridLine = smoothstep(0.025, 0.0, gridDist);
    fragColor.rgb = mix(fragColor.rgb, vec3(0.35, 0.4, 0.55), gridLine * 0.55);
  }
}
`;
