// 第 8 节使用的 HLSL Custom Node 代码
//
// 算法 1:1 对应 7.3 final 的 GLSL 实现。Custom Node 的 Code 字段会被
// UE 自动包成一个 MaterialFloat3 函数，因此：
//   · 不能在 Body 里直接声明嵌套函数；
//   · 但可以用 #define 宏把"小函数"展开成局部变量赋值（与原始项目宏写法一致）。
// 所有宏命名遵循"全大写 + 输出参数末位"的约定，避免与材质引脚撞名。

export const HLSL_CUSTOM_NODE = `// ===== Galaxy Network Custom Node (HLSL) =====
// Inputs (顺序需与 Custom Node 引脚一致):
//   UV(float2), Time(float), BaseColor(float3),
//   Scale, StarSize, Jitter, OrbitRadius, OrbitSpeed,
//   LineWidth, LineBrightness, GlowStrength,
//   MinBrightness, LineDensity, BrightnessWeight, DistanceWeight,
//   TwinkleSpeed, TwinkleAmount, LineFadeNear, LineFadeFar
// Output Type: CMOT Float 3 (RGB)，建议接到 Emissive Color。

#define GN_TAU 6.2831853

// pcg2d: 2D 整数 hash，写入 _OUT_U (uint2)
#define GN_PCG2D(_IN_U, _OUT_U) { \\
    uint2 _v = _IN_U; \\
    _v = _v * 1664525u + 1013904223u; \\
    _v.x += _v.y * 1664525u; _v.y += _v.x * 1664525u; \\
    _v ^= _v >> 16; \\
    _v.x += _v.y * 1664525u; _v.y += _v.x * 1664525u; \\
    _v ^= _v >> 16; \\
    _OUT_U = _v; \\
}

// hash22: float2 → float2 ∈ [0,1]
#define GN_HASH22(_IN_F, _OUT_F) { \\
    uint2 _u; GN_PCG2D(asuint((int2)(_IN_F)), _u); \\
    _OUT_F = float2(_u) * (1.0 / 4294967295.0); \\
}

// 星点静态亮度 b_static
#define GN_STAR_BRIGHTNESS(_NB_ID, _OUT_B) { \\
    float2 _h; GN_HASH22(_NB_ID + float2(51.0, 89.0), _h); \\
    _OUT_B = _h.x; \\
}

// 星点时变亮度 b_dyn (复用 brightness 那组 hash 的 .y 作为频率/相位种子)
#define GN_STAR_TWINKLE(_NB_ID, _OUT_B) { \\
    float2 _h; GN_HASH22(_NB_ID + float2(51.0, 89.0), _h); \\
    float _freq  = lerp(1.0, 3.0, _h.y) * TwinkleSpeed; \\
    float _phase = _h.y * GN_TAU; \\
    float _pulse = sin(Time * _freq + _phase) * 0.5 + 0.5; \\
    _pulse *= _pulse; \\
    _OUT_B = _h.x * lerp(1.0 - TwinkleAmount, 1.0, _pulse); \\
}

// 星点中心位置 (Jitter + 圆周运动)
#define GN_STAR_OF(_NB_ID, _OUT_POS) { \\
    float2 _j;  GN_HASH22(_NB_ID, _j); \\
    float2 _h2; GN_HASH22(_NB_ID + float2(127.0, 311.0), _h2); \\
    float2 _center = _NB_ID + 0.5 + (_j - 0.5) * Jitter; \\
    float _phase = _h2.x * GN_TAU; \\
    float _speed = lerp(0.5, 1.5, _h2.y); \\
    float _t = Time * OrbitSpeed * _speed + _phase; \\
    float _s, _c; sincos(_t, _s, _c); \\
    _OUT_POS = _center + OrbitRadius * float2(_c, _s); \\
}

// 边 hash (与方向无关：取 min/abs 让 (A,B) 与 (B,A) 一致)
#define GN_EDGE_HASH(_CA, _CB, _OUT_E) { \\
    float2 _lo = min(_CA, _CB); \\
    float2 _d  = abs(_CB - _CA); \\
    float2 _h;  GN_HASH22(_lo * 2.0 + _d + float2(257.0, 491.0), _h); \\
    _OUT_E = _h.x; \\
}

// 点到线段距离的平方
#define GN_DIST_TO_SEG2(_P, _A, _B, _OUT) { \\
    float2 _pa = _P - _A; \\
    float2 _ba = _B - _A; \\
    float  _hh = saturate(dot(_pa, _ba) / dot(_ba, _ba)); \\
    float2 _miss = _pa - _ba * _hh; \\
    _OUT = dot(_miss, _miss); \\
}

// ===== 主体 =====
float2 grid   = UV * Scale;
float2 cellId = floor(grid);

// 3x3 邻域：星点 disk + halo
float disk = 0.0;
float halo = 0.0;
[unroll] for (int oy = -1; oy <= 1; oy++)
[unroll] for (int ox = -1; ox <= 1; ox++) {
    float2 nbId = cellId + float2(ox, oy);
    float bs;   GN_STAR_BRIGHTNESS(nbId, bs);
    if (bs < MinBrightness) continue;
    float bDyn; GN_STAR_TWINKLE(nbId, bDyn);
    float2 sp;  GN_STAR_OF(nbId, sp);
    float b  = lerp(0.4, 1.4, bDyn);
    float r  = StarSize * lerp(0.45, 1.0, bDyn);
    float r2 = r * r;
    float2 diff = grid - sp;
    float  d2   = dot(diff, diff);
    disk += smoothstep(r2, r2 * 0.85, d2) * b;
    float hh = r2 / (d2 + 0.0001);
    hh *= smoothstep(0.25, 0.0, d2);
    halo += hh * b;
}

// 十字方向连线：概率筛 + 距离过渡
float lines = 0.0;
float bsMe; GN_STAR_BRIGHTNESS(cellId, bsMe);
if (bsMe >= MinBrightness) {
    float2 me;  GN_STAR_OF(cellId, me);
    float  bMe; GN_STAR_TWINKLE(cellId, bMe);
    float  w2   = LineWidth * LineWidth;
    float2 dirs[4] = { float2(1,0), float2(-1,0), float2(0,1), float2(0,-1) };
    [unroll] for (int i = 0; i < 4; i++) {
        float2 nbCell = cellId + dirs[i];
        float bsNb; GN_STAR_BRIGHTNESS(nbCell, bsNb);
        if (bsNb < MinBrightness) continue;
        float2 nb;  GN_STAR_OF(nbCell, nb);
        float  bNb; GN_STAR_TWINKLE(nbCell, bNb);
        float2 seg = nb - me;
        float segLen2 = dot(seg, seg);
        float bw = (bMe + bNb - 1.0) * BrightnessWeight;
        float dw = (smoothstep(1.6, 0.4, segLen2) * 2.0 - 1.0) * DistanceWeight;
        float threshold = saturate(LineDensity + bw + dw);
        float eh; GN_EDGE_HASH(cellId, nbCell, eh);
        if (eh > threshold) continue;
        float distFade = smoothstep(LineFadeFar, LineFadeNear, segLen2);
        if (distFade <= 0.0) continue;
        float w2eff = w2 * distFade;
        float dseg; GN_DIST_TO_SEG2(grid, me, nb, dseg);
        lines += smoothstep(w2eff, 0.0, dseg) * distFade;
    }
}

return BaseColor * (disk + halo * GlowStrength + lines * LineBrightness);
`;
