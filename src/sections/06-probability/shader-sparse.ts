// 6.1 星点亮度与剔除：给每颗星一个随机亮度，太暗的直接看不见
//
// 把"星点存在 / 不存在"和"星点亮度"合并成同一件事：
//   b = starBrightness(nbId)  ∈ [0, 1]   独立第 3 组 hash（偏移 (51, 89)）
//   b < uMinBrightness  → 剔除（视为不存在）
//   否则 disk + halo 按 b 加权 → 亮星更亮、暗星更暗；
//   同时 r = uStarSize · mix(0.45, 1.0, b) → 暗星半径也更小（相对 .ush 的视觉增强）
//
// uMinBrightness = 0.0 → 全部保留（等效第 5 节）
// uMinBrightness = 0.3 → 约 70% 保留（默认）
// uMinBrightness = 1.0 → 全部剔除
//
// 连线端点同样按 b > uMinBrightness 判断：端点不存在则该边不画。

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

// 第 3 组 hash：星点亮度（与位置 / 相位 / 速度完全独立）
float starBrightness(vec2 nbId) {
  return hash22(nbId + vec2(51.0, 89.0)).x;
}

// 亮度低于阈值 = 看不见 = 视为不存在
bool starExists(vec2 nbId) {
  return starBrightness(nbId) >= uMinBrightness;
}

vec2 starOf(vec2 nbId) {
  vec2 jitter = (hash22(nbId) - 0.5) * uJitter;
  vec2 center = nbId + 0.5 + jitter;
  vec2 h2 = hash22(nbId + vec2(127.0, 311.0));
  float phase = h2.x * TAU;
  float speed = mix(0.5, 1.5, h2.y);
  float t = uTime * uOrbitSpeed * speed + phase;
  return center + uOrbitRadius * vec2(cos(t), sin(t));
}

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

  // 星点：3×3 邻域，跳过太暗的星；保留的星按亮度加权 + 半径同步缩放
  float disk = 0.0;
  float halo = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 nbId = cellId + vec2(float(ox), float(oy));
      float b = starBrightness(nbId);
      if (b < uMinBrightness) continue;
      vec2 starPos = starOf(nbId);
      vec2 diff = grid - starPos;
      float d2 = dot(diff, diff);
      float w = mix(0.4, 1.4, b);                    // 亮度 → 视觉强度
      float r = uStarSize * mix(0.45, 1.0, b);       // 亮度 → 半径（暗星 ≈ 45%）
      float r2 = r * r;
      disk += smoothstep(r2, r2 * 0.85, d2) * w;
      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);
      halo += h * w;
    }
  }

  // 4 方向连线：me 自己不存在则全部跳过；任一端点不存在则该边跳过
  float lines = 0.0;
  if (starExists(cellId)) {
    vec2 me = starOf(cellId);
    float w2 = uLineWidth * uLineWidth;
    vec2 dirs[4] = vec2[4](
      vec2( 1.0,  0.0),
      vec2(-1.0,  0.0),
      vec2( 0.0,  1.0),
      vec2( 0.0, -1.0)
    );
    for (int i = 0; i < 4; i++) {
      vec2 nbCell = cellId + dirs[i];
      if (!starExists(nbCell)) continue;
      vec2 nb = starOf(nbCell);
      lines += smoothstep(w2, 0.0, distToSeg2(grid, me, nb));
    }
  }

  vec3 col = uBaseColor * (disk + halo * uGlowStrength + lines * uLineBrightness);
  fragColor = vec4(col, 1.0);

  if (uShowGrid > 0.5) {
    vec2 f = fract(grid);
    vec2 dg = min(f, 1.0 - f);
    float gridDist = min(dg.x, dg.y);
    float gridLine = smoothstep(0.025, 0.0, gridDist);
    fragColor.rgb = mix(fragColor.rgb, vec3(0.35, 0.4, 0.55), gridLine * 0.55);
  }
}
`;
