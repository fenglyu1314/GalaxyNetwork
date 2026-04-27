// 4.1 伪随机 Hash：把 cellId 打散成 [0,1]² 的稳定随机值
//
// PCG 2D（Permuted Congruential Generator 的二维扩展）：
//   - 输入：uvec2 整数坐标
//   - 步骤：乘大常数 → 行列交叉混合 → 高位异或下沉
//   - 输出：uvec2 均匀分布的 32 位整数，归一化即得 [0,1]²
//
// 相比 fract(sin(...)·43758) 这种 sin Hash：
//   - 不依赖 GPU 厂商的 sin 实现，跨设备结果完全一致
//   - 没有大数 × 三角函数带来的精度坍缩
//   - 输入为整数 → 同一格子永远输出同一对随机值（关键稳定性）

export const FRAGMENT_SHADER = /* glsl */ `
// PCG 2D Hash：uvec2 → uvec2，雪崩效应良好
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

// 包装：vec2（整数值）→ vec2 [0,1]²
vec2 hash22(vec2 p) {
  uvec2 u = pcg2d(uvec2(ivec2(p)));
  return vec2(u) * (1.0 / 4294967295.0);
}

void main() {
  vec2 grid = vUv * uScale;
  vec2 cellId = floor(grid);

  // 同一格子里所有像素拿到同一对 hash 值 —— 这是后续节做稳定扰动/相位的基石
  vec2 h = hash22(cellId);

  // 演示：把 hash 的 R/G 两个分量分别给红绿通道，肉眼看分布是否均匀
  fragColor = vec4(uBaseColor * vec3(h.x, h.y, (h.x + h.y) * 0.5), 1.0);
}
`;
