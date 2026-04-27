// 第 8 节预览：与 HLSL Custom Node 完全对齐的 GLSL 镜像
//
// 与 7.3 final 的差异只在"参数暴露面"：
//   · HLSL 版只对外开 8 个引脚（UV / Time / BaseColor / Scale / Brightness /
//     StarSize / LineWidth / LineDensity），其余 11 个调试用参数全部固化为常量；
//   · 这里把那 11 个参数同样写成 GLSL 顶部的 const，让网页里能看到 UE 中的真实效果。
// 改这些 const 等价于改 customNode.ts 顶部的 GN_* 常量；两边数值始终一致。

export const FRAGMENT_SHADER = /* glsl */ `
// ----- 与 HLSL Custom Node 同步的 11 个内部常量 -----
const float GN_JITTER            = 0.5;
const float GN_ORBIT_RADIUS      = 0.3;
const float GN_ORBIT_SPEED       = 0.8;
const float GN_GLOW_STRENGTH     = 1.2;
const float GN_LINE_BRIGHTNESS   = 0.7;
const float GN_MIN_BRIGHTNESS    = 0.4;
const float GN_BRIGHTNESS_WEIGHT = 0.4;
const float GN_DISTANCE_WEIGHT   = 0.5;
const float GN_TWINKLE_SPEED     = 1.5;
const float GN_TWINKLE_AMOUNT    = 0.75;
const float GN_LINE_FADE_NEAR    = 0.16;
const float GN_LINE_FADE_FAR     = 1.44;

const float TAU = 6.2831853;

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

float starBrightness(vec2 nbId) {
  return hash22(nbId + vec2(51.0, 89.0)).x;
}

float starTwinkle(vec2 nbId) {
  vec2 hb = hash22(nbId + vec2(51.0, 89.0));
  float bStatic = hb.x;
  float twHash  = hb.y;
  float freq  = mix(1.0, 3.0, twHash) * GN_TWINKLE_SPEED;
  float phase = twHash * TAU;
  float pulse = sin(uTime * freq + phase) * 0.5 + 0.5;
  pulse *= pulse;
  return bStatic * mix(1.0 - GN_TWINKLE_AMOUNT, 1.0, pulse);
}

bool starExists(vec2 nbId) {
  return starBrightness(nbId) >= GN_MIN_BRIGHTNESS;
}

vec2 starOf(vec2 nbId) {
  vec2 jitter = (hash22(nbId) - 0.5) * GN_JITTER;
  vec2 center = nbId + 0.5 + jitter;
  vec2 h2 = hash22(nbId + vec2(127.0, 311.0));
  float phase = h2.x * TAU;
  float speed = mix(0.5, 1.5, h2.y);
  float t = uTime * GN_ORBIT_SPEED * speed + phase;
  return center + GN_ORBIT_RADIUS * vec2(cos(t), sin(t));
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

  // 3×3 邻域：星点 disk + halo
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

  // 十字方向连线：概率筛 + 距离过渡
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
      float bw = (bMe + bNb - 1.0) * GN_BRIGHTNESS_WEIGHT;
      float dw = (smoothstep(1.6, 0.4, segLen2) * 2.0 - 1.0) * GN_DISTANCE_WEIGHT;
      float threshold = clamp(uLineDensity + bw + dw, 0.0, 1.0);
      if (edgeHash(cellId, nbCell) > threshold) continue;

      float distFade = smoothstep(GN_LINE_FADE_FAR, GN_LINE_FADE_NEAR, segLen2);
      if (distFade <= 0.0) continue;
      float w2eff = w2 * distFade;
      lines += smoothstep(w2eff, 0.0, distToSeg2(grid, me, nb)) * distFade;
    }
  }

  vec3 col = uBaseColor * uBrightness * (disk + halo * GN_GLOW_STRENGTH + lines * GN_LINE_BRIGHTNESS);
  fragColor = vec4(col, 1.0);
}
`;
