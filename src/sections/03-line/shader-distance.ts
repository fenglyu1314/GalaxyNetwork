// 3.1 点到线段距离：最小例子，画两颗星 + 它们之间的一条线段
// 不涉及网格，单纯演示 distToSeg2 + smoothstep 的距离场染色

export const FRAGMENT_SHADER = /* glsl */ `
// 像素 p 到线段 ab 的距离平方
float distToSeg2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 miss = pa - ba * h;
  return dot(miss, miss);
}

void main() {
  vec2 a = vec2(0.25, 0.5);
  vec2 b = vec2(0.75, 0.5);

  // 两个端点的星
  float r2 = uStarSize * uStarSize;
  vec2 da = vUv - a;
  vec2 db = vUv - b;
  float diskA = smoothstep(r2, r2 * 0.85, dot(da, da));
  float diskB = smoothstep(r2, r2 * 0.85, dot(db, db));

  // 连接 a → b 的线段
  float d2 = distToSeg2(vUv, a, b);
  float w2 = uLineWidth * uLineWidth;
  float line = smoothstep(w2, 0.0, d2);

  fragColor = vec4(uBaseColor * (diskA + diskB + line), 1.0);
}
`;
