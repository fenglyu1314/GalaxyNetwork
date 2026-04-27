// 4.4 圆周运动：让每颗星绕「扰动后的位置」做小圆周漂移
//
// starPos = center + radius · (cos(t·speed + φ), sin(t·speed + φ))
//   - center  来自 4.2 的位置扰动（每颗星固定的圆心）
//   - radius  圆周半径（uOrbitRadius，全局统一）
//   - speed   每颗星独立的速度倍率，由 hash 取出
//   - φ       每颗星独立的初相位，由 hash 取出 → 不同步、不会一起转
//
// 框架沿用 4.3 的 3×3 邻域遍历：每像素累加 9 个候选格子的星贡献，
// 这样圆周运动把星甩出原格子时也不会被裁切，光晕也能跨格自然叠加。
// 第二组 hash（输入加偏移常量）取相位/速度，避免与位置扰动用同一对随机数。

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

  float r2 = uStarSize * uStarSize;
  float disk = 0.0;
  float halo = 0.0;

  // 3×3 邻域遍历：每个邻居都算它自己的圆心 + 圆周运动
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 nbId = cellId + vec2(float(ox), float(oy));

      // 静态扰动得到圆心
      vec2 jitter = (hash22(nbId) - 0.5) * uJitter;
      vec2 center = nbId + 0.5 + jitter;

      // 第二组 hash：每颗星独立的相位与速度倍率
      vec2 h2 = hash22(nbId + vec2(127.0, 311.0));
      float phase = h2.x * TAU;
      float speed = mix(0.5, 1.5, h2.y);

      // 圆周运动叠加在圆心上
      float t = uTime * uOrbitSpeed * speed + phase;
      vec2 starPos = center + uOrbitRadius * vec2(cos(t), sin(t));

      vec2 diff = grid - starPos;
      float d2 = dot(diff, diff);

      disk += smoothstep(r2, r2 * 0.85, d2);

      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);
      halo += h;
    }
  }

  fragColor = vec4(uBaseColor * (disk + halo * uGlowStrength), 1.0);

  // 网格线叠加：观察星点圆周轨迹是否跨越格子边界
  if (uShowGrid > 0.5) {
    vec2 f = fract(grid);
    vec2 dg = min(f, 1.0 - f);
    float gridDist = min(dg.x, dg.y);
    float gridLine = smoothstep(0.025, 0.0, gridDist);
    fragColor.rgb = mix(fragColor.rgb, vec3(0.35, 0.4, 0.55), gridLine * 0.55);
  }
}
`;
