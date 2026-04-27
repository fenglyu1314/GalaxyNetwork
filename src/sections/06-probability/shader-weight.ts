// 6.3 综合权重：阈值不再是固定的 LineDensity，而是叠加亮度 + 距离两项
//
// 阈值 = clamp(LineDensity + 亮度偏移 + 距离权重, 0.05, 0.95)
//   - 亮度偏移 = (bA + bB - 1) · BrightnessWeight    取值 [-1, +1] · w
//     bA / bB ∈ [0,1] 是两端星的"亮度"，独立第 3 组 hash 取出（与存在性正交）
//     两颗都暗 → 偏移负 → 阈值低 → 不容易连
//     两颗都亮 → 偏移正 → 阈值高 → 容易连
//   - 距离权重 = smoothstep(2, 0, segLen²) · DistanceWeight
//     segLen² 越小（端点越近）→ 权重越大 → 越容易连
//
// 同时把"亮度"也乘进星点 disk + halo，让画面里能看出亮星和暗星 ——
// 视觉上"亮的星 + 它的近邻"自然形成连线主干，整张图开始有层次。

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

// 第 3 组 hash：星点亮度（在 6.1 引入，6.2 / 6.3 一路复用）
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

  // 星点：累加时按亮度加权，让画面有强弱
  float r2 = uStarSize * uStarSize;
  float disk = 0.0;
  float halo = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 nbId = cellId + vec2(float(ox), float(oy));
      if (!starExists(nbId)) continue;
      vec2 starPos = starOf(nbId);
      float b = mix(0.4, 1.4, starBrightness(nbId));
      vec2 diff = grid - starPos;
      float d2 = dot(diff, diff);
      disk += smoothstep(r2, r2 * 0.85, d2) * b;
      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);
      halo += h * b;
    }
  }

  // 连线：阈值 = 全局密度 + 亮度偏移 + 距离权重
  float lines = 0.0;
  if (starExists(cellId)) {
    vec2 me = starOf(cellId);
    float bMe = starBrightness(cellId);
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
      float bNb = starBrightness(nbCell);

      vec2 seg = nb - me;
      float segLen2 = dot(seg, seg);

      float bw = (bMe + bNb - 1.0) * uBrightnessWeight;
      // smoothstep 范围按当前默认 Jitter/OrbitRadius 下 segLen² 的实际分布裁剪，
      // 否则在 [2, 0] 这样的宽范围里，segLen² ≈ 1 附近的变化几乎看不到差异
      float dw = smoothstep(1.6, 0.4, segLen2) * uDistanceWeight;
      float threshold = clamp(uLineDensity + bw + dw, 0.05, 0.95);

      if (edgeHash(cellId, nbCell) > threshold) continue;
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
