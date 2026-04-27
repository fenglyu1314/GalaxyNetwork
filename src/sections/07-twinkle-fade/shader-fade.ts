// 7.2 连线距离过渡：远端的连线"既细又透"
//
// 6.3 之前的连线只要被"概率筛"放行就以 LineWidth 全宽全亮画出来 ——
// 短线和长线在视觉上一样硬，画面欠缺真实星图的那种渐隐感。
// 这一节用 segLen² 算一个 [0, 1] 的衰减权重，同时缩"宽"和"亮"：
//
//   distFade = smoothstep(uLineFadeFar, uLineFadeNear, segLen²)
//   //         segLen² ≤ Near → 1.0     近 → 全宽全亮
//   //         segLen² ≥ Far  → 0.0     远 → 直接消失
//
//   w2_eff = w2 · distFade            外缘按 sqrt(distFade) 收窄
//   lines += smoothstep(w2_eff, 0, d²) · distFade   亮度再乘一次
//
// 一次 distFade 缩宽、一次缩亮 —— 远端线呈现"尖出去并淡出"的形状，
// 而不是被一刀切断。
//
// 默认 Near = 0.16 / Far = 1.44，对应 .ush 中 LINE_ABS 末尾硬编码的
// smoothstep(1.44, 0.16, _len2)；这里把它暴露成参数方便对比。
//
// 本节不含闪烁，专注让你看清"距离过渡"单独带来的视觉变化。

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

  // 星点：与 6.3 完全一致（本节专注连线变化）
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

  // 连线：在 6.3 概率筛之后，按 segLen² 同时缩宽 + 缩亮
  float lines = 0.0;
  if (starExists(cellId)) {
    vec2 me = starOf(cellId);
    float bMe = starBrightness(cellId);
    float w2 = uLineWidth * uLineWidth;
    vec2 dirs[4] = vec2[4](
      vec2( 1.0,  0.0), vec2(-1.0,  0.0),
      vec2( 0.0,  1.0), vec2( 0.0, -1.0)
    );
    for (int i = 0; i < 4; i++) {
      vec2 nbCell = cellId + dirs[i];
      if (!starExists(nbCell)) continue;
      vec2 nb = starOf(nbCell);
      float bNb = starBrightness(nbCell);
      vec2 seg = nb - me;
      float segLen2 = dot(seg, seg);
      float bw = (bMe + bNb - 1.0) * uBrightnessWeight;
      float dw = smoothstep(1.6, 0.4, segLen2) * uDistanceWeight;
      float threshold = clamp(uLineDensity + bw + dw, 0.05, 0.95);
      if (edgeHash(cellId, nbCell) > threshold) continue;

      // 距离过渡：远 → 既细又透
      float distFade = smoothstep(uLineFadeFar, uLineFadeNear, segLen2);
      if (distFade <= 0.0) continue;
      float w2eff = w2 * distFade;
      lines += smoothstep(w2eff, 0.0, distToSeg2(grid, me, nb)) * distFade;
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
