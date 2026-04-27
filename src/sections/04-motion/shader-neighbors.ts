// 4.3 3×3 邻域遍历：每像素同时检查 9 个候选格子的星
//
// 修复 4.2 的边角裁切：扰动后星可能跑到隔壁格，只查自己格子就漏掉。
// 解法是「视角反转」—— 不再问"我格子里的星在哪"，而是问
// "周围 9 个格子里，哪些星有可能影响到我？"
//
// 实现上把每颗星的 disk + halo 贡献全部累加：
//   - 星点本身互不重叠（disk 累加 = 各画各的）
//   - 光晕自然叠加（两颗近距星之间会出现亮带）
// 光晕远端裁切 0.5（半个格子）保证一颗星最多影响紧邻 9 格内的像素，
// 不会越界干扰更远的格子。

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

void main() {
  vec2 grid = vUv * uScale;
  vec2 cellId = floor(grid);

  float r2 = uStarSize * uStarSize;
  float disk = 0.0;
  float halo = 0.0;

  // 遍历自己 + 8 个邻居，累加每颗星的贡献
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 nbId = cellId + vec2(float(ox), float(oy));
      vec2 jitter = (hash22(nbId) - 0.5) * uJitter;
      vec2 starPos = nbId + 0.5 + jitter;

      vec2 diff = grid - starPos;
      float d2 = dot(diff, diff);

      disk += smoothstep(r2, r2 * 0.85, d2);

      float h = r2 / (d2 + 0.0001);
      h *= smoothstep(0.25, 0.0, d2);  // 光晕只到半个格子远
      halo += h;
    }
  }

  fragColor = vec4(uBaseColor * (disk + halo * uGlowStrength), 1.0);

  // 网格线叠加：直观验证邻域遍历能正确画出跨越格子边界的星
  if (uShowGrid > 0.5) {
    vec2 f = fract(grid);
    vec2 dg = min(f, 1.0 - f);
    float gridDist = min(dg.x, dg.y);
    float gridLine = smoothstep(0.025, 0.0, gridDist);
    fragColor.rgb = mix(fragColor.rgb, vec3(0.35, 0.4, 0.55), gridLine * 0.55);
  }
}
`;
