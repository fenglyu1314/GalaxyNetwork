// 7.1 星点闪烁：在 6.3 的静态亮度 b 上叠一层时间脉冲
//
// b_dyn(t) = b_static · mix(1 - TwinkleAmount, 1, pulse²)
//   pulse  = sin(t · freq + phase) · 0.5 + 0.5    取值 [0, 1]
//   pulse² —— 让"暗"的时段比"亮"的时段长，更像呼吸
//   freq   = mix(1, 3, h) · uTwinkleSpeed         每颗星独立基频
//   phase  = h · TAU                              每颗星独立起相
//
// 关键：星点存在性 starExists 仍由 b_static 判断 —— 只是亮度脉动，
// 不会让星瞬间消失再出现（那种抖动太丑）。
// 而连线阈值的 bMe / bNb 用 b_dyn —— 闪到亮峰时连线短暂浮现，
// 闪到谷底时连线悄悄淡出，整张图开始"呼吸"。
// 半径 r 也跟 b_dyn 走（沿用 6.1 的 mix(0.45, 1.0, b)）：
// 谷底时星点同时变暗 + 缩小，亮度·体积双重收缩，呼吸感更强。
//
// 频率 hash 复用 starBrightness 的同一组 hash（取 .y 分量），
// 不再调一次 pcg2d，与 .ush 中"复用已有 hash"的思路一致。

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

// 静态亮度（用于"存在性"判定，不闪烁）
float starBrightness(vec2 nbId) {
  return hash22(nbId + vec2(51.0, 89.0)).x;
}

// 时变亮度：在静态 b 上叠时间脉冲；同一组 hash 的 .y 派生频率/相位
float starTwinkle(vec2 nbId) {
  vec2 hb = hash22(nbId + vec2(51.0, 89.0));
  float bStatic = hb.x;
  float twHash  = hb.y;
  float freq  = mix(1.0, 3.0, twHash) * uTwinkleSpeed;
  float phase = twHash * TAU;
  float pulse = sin(uTime * freq + phase) * 0.5 + 0.5;
  pulse *= pulse;     // 暗时段拉长
  return bStatic * mix(1.0 - uTwinkleAmount, 1.0, pulse);
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

  // 星点：亮度 + 半径都跟时变亮度走 —— 暗时段不仅淡，且体积更小（双重呼吸）
  float disk = 0.0;
  float halo = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 nbId = cellId + vec2(float(ox), float(oy));
      if (!starExists(nbId)) continue;
      vec2 starPos = starOf(nbId);
      float bDyn = starTwinkle(nbId);
      float b = mix(0.4, 1.4, bDyn);
      float r = uStarSize * mix(0.45, 1.0, bDyn);
      float r2 = r * r;
      vec2 diff = grid - starPos;
      float d2 = dot(diff, diff);
      disk += smoothstep(r2, r2 * 0.85, d2) * b;
      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);
      halo += h * b;
    }
  }

  // 连线：阈值用时变亮度 —— 亮峰浮现、谷底淡出
  float lines = 0.0;
  if (starExists(cellId)) {
    vec2 me = starOf(cellId);
    float bMe = starTwinkle(cellId);
    float w2 = uLineWidth * uLineWidth;
    vec2 dirs[4] = vec2[4](
      vec2( 1.0,  0.0), vec2(-1.0,  0.0),
      vec2( 0.0,  1.0), vec2( 0.0, -1.0)
    );
    for (int i = 0; i < 4; i++) {
      vec2 nbCell = cellId + dirs[i];
      if (!starExists(nbCell)) continue;
      vec2 nb = starOf(nbCell);
      float bNb = starTwinkle(nbCell);
      vec2 seg = nb - me;
      float segLen2 = dot(seg, seg);
      float bw = (bMe + bNb - 1.0) * uBrightnessWeight;
      float dw = (smoothstep(1.6, 0.4, segLen2) * 2.0 - 1.0) * uDistanceWeight;
      float threshold = clamp(uLineDensity + bw + dw, 0.0, 1.0);
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
