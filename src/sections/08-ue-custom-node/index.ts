// 第 8 节：UE Custom Node 实现
// 纯文档章节（无实时演示）。把 7.3 final 的算法翻译成 HLSL，
// 给出 UE Material Editor 中的配置步骤、输入引脚表与完整代码。

import type { SectionConfig } from '../../core/section';
import { highlightGLSL } from '../../core/highlight';
import { HLSL_CUSTOM_NODE } from './customNode';

const hlslHighlighted = highlightGLSL(HLSL_CUSTOM_NODE);

export const section08: SectionConfig = {
  id: 'sec-08-ue-custom-node',
  title: '08 · UE Custom Node 实现',
  intro: `
    <p>
      把第 7 节的最终算法搬进虚幻引擎只需要<strong>一个 Custom Node</strong>：
      新建节点、贴入下方 HLSL 代码、按表添加 19 个输入引脚，再把输出接到
      <strong>Emissive Color</strong> —— 整套效果就直接跑起来，无需任何外部文件或额外资源。
    </p>

    <p><strong>一、在 UE Material Editor 中创建节点</strong></p>
    <ol>
      <li>材质图空白处右键 → <code>Custom</code>，新建一个 Custom 节点。</li>
      <li>在细节面板设置：
        <ul>
          <li><strong>Output Type</strong> = <code>CMOT Float 3</code>（RGB）</li>
          <li><strong>Description</strong> = <code>GalaxyNetwork</code>（节点显示名，可改）</li>
          <li><strong>Code</strong> = 把下方第三节的 HLSL 代码<strong>整段</strong>粘贴进去</li>
        </ul>
      </li>
      <li>按下方"输入引脚"表添加 <strong>Inputs</strong>（顺序与名字必须严格一致 ——
        Custom Node 是按"声明顺序 = 局部变量名"绑定输入的）。</li>
      <li>把 Custom Node 的输出连到 <strong>Emissive Color</strong>。</li>
      <li>材质属性建议：<strong>Shading Model = Unlit</strong>；如果作为天空背景，
        <strong>Blend Mode</strong> 用 <code>Opaque</code>；如果想叠在场景上，用 <code>Translucent</code>。</li>
    </ol>

    <p><strong>二、输入引脚（共 19 个，推荐默认值与 7.3 节保持一致）</strong></p>
    <table>
      <thead>
        <tr><th style="width:22%">名称</th><th style="width:14%">类型</th><th style="width:18%">推荐默认</th><th>建议来源 / 含义</th></tr>
      </thead>
      <tbody>
        <tr><td><code>UV</code></td><td>Float2</td><td>—</td><td><code>TexCoord[0]</code> 节点</td></tr>
        <tr><td><code>Time</code></td><td>Float</td><td>—</td><td><code>Time</code> 节点（驱动闪烁与轨道运动）</td></tr>
        <tr><td><code>BaseColor</code></td><td>Float3</td><td><code>(0.6, 0.8, 1.0)</code></td><td>Vector Parameter，整体色调</td></tr>
        <tr><td><code>Scale</code></td><td>Float</td><td><code>9.0</code></td><td>网格密度；越大星越多</td></tr>
        <tr><td><code>StarSize</code></td><td>Float</td><td><code>0.04</code></td><td>星点最大半径（按格归一）</td></tr>
        <tr><td><code>Jitter</code></td><td>Float</td><td><code>0.5</code></td><td>星点在格内的位置扰动 [0, 1]</td></tr>
        <tr><td><code>OrbitRadius</code></td><td>Float</td><td><code>0.05</code></td><td>圆周运动半径</td></tr>
        <tr><td><code>OrbitSpeed</code></td><td>Float</td><td><code>0.8</code></td><td>圆周运动速度倍率</td></tr>
        <tr><td><code>LineWidth</code></td><td>Float</td><td><code>0.025</code></td><td>连线宽度</td></tr>
        <tr><td><code>LineBrightness</code></td><td>Float</td><td><code>0.7</code></td><td>连线亮度倍率</td></tr>
        <tr><td><code>GlowStrength</code></td><td>Float</td><td><code>1.2</code></td><td>星点光晕强度</td></tr>
        <tr><td><code>MinBrightness</code></td><td>Float</td><td><code>0.4</code></td><td>亮度阈值；低于此值的星不显示也不参与连线</td></tr>
        <tr><td><code>LineDensity</code></td><td>Float</td><td><code>0.35</code></td><td>连线密度基线 [0, 1]</td></tr>
        <tr><td><code>BrightnessWeight</code></td><td>Float</td><td><code>0.4</code></td><td>"两端越亮越易连"的权重</td></tr>
        <tr><td><code>DistanceWeight</code></td><td>Float</td><td><code>0.5</code></td><td>"越近越易连、越远越易断"的权重（双向）</td></tr>
        <tr><td><code>TwinkleSpeed</code></td><td>Float</td><td><code>1.5</code></td><td>闪烁速度</td></tr>
        <tr><td><code>TwinkleAmount</code></td><td>Float</td><td><code>0.75</code></td><td>闪烁深度 [0, 1]；0 = 不闪、1 = 谷底归零</td></tr>
        <tr><td><code>LineFadeNear</code></td><td>Float</td><td><code>0.16</code></td><td>距离过渡近端阈值（segLen²）</td></tr>
        <tr><td><code>LineFadeFar</code></td><td>Float</td><td><code>1.44</code></td><td>距离过渡远端阈值（segLen²）</td></tr>
      </tbody>
    </table>
    <p>
      其中 <code>Scale</code> 之后的 17 个 Float 引脚都建议接 <strong>Scalar Parameter</strong>，
      这样在材质实例里就能直接调；<code>BaseColor</code> 接 <strong>Vector Parameter</strong>。
    </p>

    <p><strong>三、完整 HLSL 代码（直接复制到 Custom Node 的 Code 字段）</strong></p>
    <p>
      为避免在 Custom Node 内部嵌套函数（HLSL 不允许在函数体里再定义函数），所有"小函数"都写成
      <code>#define</code> 宏：宏的最后一个参数是<strong>输出变量</strong>，调用方传入接收结果的局部变量。
      这样既保留了清晰的分层结构，也能在 UE 的函数体里直接展开。
    </p>
    <pre class="code-block">${hlslHighlighted}</pre>

    <p><strong>四、HLSL ↔ GLSL 主要差异速查</strong></p>
    <table>
      <thead><tr><th style="width:34%">HLSL（本节）</th><th style="width:34%">GLSL（前 7 节演示）</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td><code>float2 / float3</code></td><td><code>vec2 / vec3</code></td><td>向量类型命名差异</td></tr>
        <tr><td><code>asuint(x)</code></td><td><code>floatBitsToUint(x)</code></td><td>位级重解释（整数 hash 的入口）</td></tr>
        <tr><td><code>sincos(a, s, c)</code></td><td><code>s = sin(a); c = cos(a);</code></td><td>HLSL 单指令；GLSL 分别调用</td></tr>
        <tr><td><code>lerp(a, b, t)</code></td><td><code>mix(a, b, t)</code></td><td>线性插值</td></tr>
        <tr><td><code>saturate(x)</code></td><td><code>clamp(x, 0.0, 1.0)</code></td><td>GLSL 无 saturate</td></tr>
        <tr><td><code>(int2)x</code></td><td><code>ivec2(x)</code></td><td>类型转换；HLSL 兼容 C 风格</td></tr>
        <tr><td><code>#define MACRO(...) { ... }</code></td><td>函数</td><td>Custom Node 不允许嵌套函数，用宏代替</td></tr>
        <tr><td><code>[unroll]</code></td><td>—</td><td>HLSL 编译器属性；GLSL 默认会展开常量循环</td></tr>
      </tbody>
    </table>

    <p>
      到这里整个分享结束。改 <code>BaseColor</code> 配色、调 <code>Scale / LineDensity</code> 控制密度，
      这个零纹理、低开销、可参数化的星座背景就能直接用在自己的项目里。
    </p>
  `,
};
