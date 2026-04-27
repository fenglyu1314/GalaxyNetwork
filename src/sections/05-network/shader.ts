// 05 星座网络（动态连线）：在 4.4 圆周运动星点之上，复用第 3 节的 4 方向连线
//
// 关键变化：线段端点不再是「格子中心」，而是 starOf(cellId) —— 4.4 节得出的
// 真实星点位置（扰动 + 圆周运动）。把那段算式抽成一个函数，后续四条连线
// （上下左右邻居）共用，星点的 3×3 邻域遍历也共用。
//
// 简化：依然只画轴向 4 条候选连线（沿用第 3 节"星点居中"前提下的最小集）。
// 当扰动较大、邻居星越过自己格子时，少量斜向连接会缺失 —— 把 Jitter / OrbitRadius
// 控制在 0.5 / 0.1 以内时几乎察觉不到，下一节会用"亮度·距离·密度"概率筛
// 进一步治理这种情况。

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

// 任意格子的真实星点位置 = 扰动圆心 + 独立相位/速度的圆周漂移
vec2 starOf(vec2 nbId) {
  vec2 jitter = (hash22(nbId) - 0.5) * uJitter;
  vec2 center = nbId + 0.5 + jitter;
  vec2 h2 = hash22(nbId + vec2(127.0, 311.0));
  float phase = h2.x * TAU;
  float speed = mix(0.5, 1.5, h2.y);
  float t = uTime * uOrbitSpeed * speed + phase;
  return center + uOrbitRadius * vec2(cos(t), sin(t));
}

// 像素 p 到线段 ab 的距离平方（投影 + clamp，第 3.1 节）
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

  // 星点：3×3 邻域遍历（沿用 4.4），保证扰动/漂移跨格不被裁
  float r2 = uStarSize * uStarSize;
  float disk = 0.0;
  float halo = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 nbId = cellId + vec2(float(ox), float(oy));
      vec2 starPos = starOf(nbId);
      vec2 diff = grid - starPos;
      float d2 = dot(diff, diff);
      disk += smoothstep(r2, r2 * 0.85, d2);
      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);
      halo += h;
    }
  }

  // 连线：当前格子的星 ↔ 上下左右 4 个邻居的星（端点全是动态的）
  vec2 me = starOf(cellId);
  vec2 nR = starOf(cellId + vec2( 1.0,  0.0));
  vec2 nL = starOf(cellId + vec2(-1.0,  0.0));
  vec2 nU = starOf(cellId + vec2( 0.0, -1.0));
  vec2 nD = starOf(cellId + vec2( 0.0,  1.0));
  float w2 = uLineWidth * uLineWidth;
  float lines =
      smoothstep(w2, 0.0, distToSeg2(grid, me, nR))
    + smoothstep(w2, 0.0, distToSeg2(grid, me, nL))
    + smoothstep(w2, 0.0, distToSeg2(grid, me, nU))
    + smoothstep(w2, 0.0, distToSeg2(grid, me, nD));

  vec3 col = uBaseColor * (disk + halo * uGlowStrength + lines * uLineBrightness);
  fragColor = vec4(col, 1.0);

  // 网格线叠加：观察连线端点是否真的脱离格子中心
  if (uShowGrid > 0.5) {
    vec2 f = fract(grid);
    vec2 dg = min(f, 1.0 - f);
    float gridDist = min(dg.x, dg.y);
    float gridLine = smoothstep(0.025, 0.0, gridDist);
    fragColor.rgb = mix(fragColor.rgb, vec3(0.35, 0.4, 0.55), gridLine * 0.55);
  }
}
`;
