// 6.2 边 Hash + 全局密度：每条边由独立 hash 决定是否绘制
//
// 思路：把"边"当作独立实体，给每条边算一个 [0,1] 的 hash 值，
//   只在 edgeHash < uLineDensity 时才画。
//
// 关键：同一条边从两个端点视角看必须得到相同 hash 值——
//   否则两端发起的连线会闪烁不一致。做法是把两端 cellId 规范化：
//   lo = min(cA, cB)，d = abs(cB - cA)（必为 (1,0) 或 (0,1)），
//   用 (lo*2 + d) 作为 hash 输入 —— 每条边都有唯一的整数对编码。
//
// uLineDensity = 1.0 → 全部画（等效 6.1）
// uLineDensity = 0.5 → 约一半的边出现 → 已经有星座骨架感
// uLineDensity = 0.0 → 全部不画

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

float starBrightness(vec2 nbId) {
  return hash22(nbId + vec2(51.0, 89.0)).x;
}

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

// 边的规范化 hash：双向一致
float edgeHash(vec2 cA, vec2 cB) {
  vec2 lo = min(cA, cB);
  vec2 d  = abs(cB - cA);
  return hash22(lo * 2.0 + d + vec2(257.0, 491.0)).x;
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

  float r2 = uStarSize * uStarSize;
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
      float w = mix(0.4, 1.4, b);
      disk += smoothstep(r2, r2 * 0.85, d2) * w;
      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);
      halo += h * w;
    }
  }

  // 4 方向连线：在 6.1 基础上再加边 hash 阈值判断
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
      if (edgeHash(cellId, nbCell) > uLineDensity) continue;
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
