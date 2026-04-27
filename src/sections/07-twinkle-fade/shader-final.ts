// 7.3 完整合成：6.3 概率筛 + 7.1 闪烁 + 7.2 距离过渡
//
// 完整算法链：
//   · 整数 hash（pcg2d）生成稳定的随机量
//   · 每格一颗星 + 圆周运动 + 独立相位 / 速度
//   · 亮度剔除 + 边 hash + 亮度·距离双向权重的概率筛
//   · 时间脉冲闪烁（亮度与半径同步呼吸）
//   · 连线远端的"距离过渡"（线宽 + 亮度同步收窄）
//
// 默认参数取"最像星空"的预设：稀疏星 + 暗淡基底 + 强亮峰闪烁。
// 第 8 节会把这套算法翻译成 HLSL，作为 UE Custom Node 直接使用。

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

float starTwinkle(vec2 nbId) {
  vec2 hb = hash22(nbId + vec2(51.0, 89.0));
  float bStatic = hb.x;
  float twHash  = hb.y;
  float freq  = mix(1.0, 3.0, twHash) * uTwinkleSpeed;
  float phase = twHash * TAU;
  float pulse = sin(uTime * freq + phase) * 0.5 + 0.5;
  pulse *= pulse;
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

  // 星点：3×3 邻域，亮度 + 半径都跟时变亮度走
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

  // 连线：概率筛 + 距离过渡（线宽 + 亮度同步收窄）
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
