// 4.3 圆周运动：让每颗星绕「扰动后的位置」做小圆周漂移
//
// starPos = center + radius · (cos(t·speed + φ), sin(t·speed + φ))
//   - center  来自 4.2 的位置扰动（每颗星固定的圆心）
//   - radius  圆周半径（uOrbitRadius，全局统一）
//   - speed   每颗星独立的速度倍率，由 hash 取出
//   - φ       每颗星独立的初相位，由 hash 取出 → 不同步、不会一起转
//
// 用第二组 hash（输入加偏移常量）取相位/速度，避免与位置扰动用同一对随机数

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

const float TAU = 6.2831853;

void main() {
  vec2 grid = vUv * uScale;
  vec2 cellId = floor(grid);

  // 圆心：与 4.2 相同的静态扰动
  vec2 c = cellId + 0.5;
  vec2 jitter = (hash22(cellId) - 0.5) * uJitter;
  vec2 center = c + jitter;

  // 第二组 hash 取相位与速度倍率（输入加常量偏移即可得到独立随机源）
  vec2 h2 = hash22(cellId + vec2(127.0, 311.0));
  float phase = h2.x * TAU;
  float speed = mix(0.5, 1.5, h2.y);

  // 圆周运动
  float t = uTime * uOrbitSpeed * speed + phase;
  vec2 starPos = center + uOrbitRadius * vec2(cos(t), sin(t));

  // 像素到星点距离
  vec2 diff = grid - starPos;
  float d2 = dot(diff, diff);

  float r2 = uStarSize * uStarSize;
  float disk = smoothstep(r2, r2 * 0.85, d2);

  float halo = r2 / (d2 + 0.0001);
  halo *= smoothstep(0.25, 0.0, d2);

  fragColor = vec4(uBaseColor * (disk + halo * uGlowStrength), 1.0);
}
`;
