// 第 8 节：UE Custom Node 实现
// 8.1 = 与 Custom Node 完全等效的 GLSL 预览（只开 8 个滑块）
// 8.2 = 纯文档：节点配置步骤、输入引脚表、完整 HLSL 代码、HLSL↔GLSL 对照

import type { SectionConfig } from '../../core/section';
import { highlightGLSL } from '../../core/highlight';
import { HLSL_CUSTOM_NODE } from './customNode';
import { FRAGMENT_SHADER as SHADER_UE_PREVIEW } from './shader-ue-preview';

const BLUE: [number, number, number] = [0.6, 0.8, 1.0];
const hlslHighlighted = highlightGLSL(HLSL_CUSTOM_NODE);

export const section08: SectionConfig = {
  id: 'sec-08-ue-custom-node',
  title: '08 · UE Custom Node 实现',
  intro: `
    <p>
      把第 7 节的最终算法搬进虚幻引擎只需要<strong>一个 Custom Node</strong>：
      新建节点、贴入 HLSL 代码、按表添加 <strong>8 个输入引脚</strong>、再把输出接到
      <strong>Emissive Color</strong> —— 整套效果就直接跑起来，无需任何外部文件或额外资源。
    </p>
    <p>
      引脚精简到 8 个的思路：把"调试 / 测试用"的 11 个参数（<code>Jitter</code>、<code>OrbitRadius</code>、
      <code>TwinkleAmount</code> 等）作为<strong>固定 const 常量</strong>写在 HLSL 代码顶部，
      默认值取 7.3 节实测下来"最像星空"的预设；只把美术日常调色 / 调密度真正会用到的
      <code>Scale / Brightness / StarSize / LineWidth / LineDensity</code> 暴露成材质参数。
      想再调出某个内部参数时，把对应的 <code>const</code> 行替换成同名 Input 即可。
    </p>
    <p>
      下方 <strong>8.1</strong> 是一个与 Custom Node <strong>完全等效</strong>的 GLSL 预览，
      只开 8 个引脚同名滑块；<strong>8.2</strong> 给出节点配置步骤、引脚表与完整 HLSL 代码。
    </p>
  `,
  children: [
    {
      id: 'sec-08-1-preview',
      title: '8.1 · 效果预览',
      intro: `
        <p>
          这一小节的 GLSL 与 8.2 的 HLSL Custom Node <strong>逐行对应</strong>：算法相同、
          11 个内部参数同样写成 <code>const</code>（数值与 HLSL 顶部 <code>GN_*</code> 一致），
          仅暴露与 Custom Node 一致的 8 个输入。
          所以这里看到的画面，就是把 8.2 的代码贴进 UE、按推荐默认值连上 Scalar / Vector Parameter 后会看到的画面。
        </p>
        <p>
          想验证"暴露某个内部参数后是什么效果"，回到 7.3 节的完整版滑块即可 ——
          那里把所有 17 个参数都开放成 uniform，可以独立调节。
        </p>
      `,
      shaderSource: SHADER_UE_PREVIEW,
      uniforms: {
        uScale:       { type: 'float', value: 9.0 },
        uBrightness:  { type: 'float', value: 1.0 },
        uStarSize:    { type: 'float', value: 0.04 },
        uLineWidth:   { type: 'float', value: 0.025 },
        uLineDensity: { type: 'float', value: 0.35 },
        uBaseColor:   { type: 'vec3',  value: BLUE },
      },
      controls: [
        { kind: 'range', uniform: 'uScale',       label: 'Scale（网格密度）',       min: 2,     max: 16,  step: 1     },
        { kind: 'range', uniform: 'uBrightness',  label: 'Brightness（整体亮度）',  min: 0.0,   max: 3.0, step: 0.01  },
        { kind: 'range', uniform: 'uStarSize',    label: 'StarSize（星点大小）',    min: 0.1,  max: 0.3, step: 0.001 },
        { kind: 'range', uniform: 'uLineWidth',   label: 'LineWidth（连线宽度）',   min: 0.002, max: 0.1, step: 0.001 },
        { kind: 'range', uniform: 'uLineDensity', label: 'LineDensity（连线密度）', min: 0.0,   max: 1.0, step: 0.01  },
        { kind: 'color', uniform: 'uBaseColor',   label: 'BaseColor（基础颜色）' },
      ],
    },
    {
      id: 'sec-08-2-custom-node',
      title: '8.2 · Custom Node 实现',
      intro: `
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

        <p><strong>二、输入引脚（共 8 个）</strong></p>
        <table>
          <thead>
            <tr><th style="width:20%">名称</th><th style="width:14%">类型</th><th style="width:18%">推荐默认</th><th>建议来源 / 含义</th></tr>
          </thead>
          <tbody>
            <tr><td><code>UV</code></td><td>Float2</td><td>—</td><td><code>TexCoord[0]</code> 节点</td></tr>
            <tr><td><code>Time</code></td><td>Float</td><td>—</td><td><code>Time</code> 节点（驱动闪烁与轨道运动）</td></tr>
            <tr><td><code>BaseColor</code></td><td>Float3</td><td><code>(0.6, 0.8, 1.0)</code></td><td>Vector Parameter，整体色调</td></tr>
            <tr><td><code>Scale</code></td><td>Float</td><td><code>9.0</code></td><td>网格密度；越大星越多</td></tr>
            <tr><td><code>Brightness</code></td><td>Float</td><td><code>1.0</code></td><td>整体亮度倍率（最终 RGB 同时乘 <code>BaseColor · Brightness</code>）</td></tr>
            <tr><td><code>StarSize</code></td><td>Float</td><td><code>0.04</code></td><td>星点最大半径（按格归一）</td></tr>
            <tr><td><code>LineWidth</code></td><td>Float</td><td><code>0.025</code></td><td>连线宽度</td></tr>
            <tr><td><code>LineDensity</code></td><td>Float</td><td><code>0.35</code></td><td>连线密度基线 [0, 1]，越大连线越多</td></tr>
          </tbody>
        </table>
        <p>
          所有 Float 引脚都建议接 <strong>Scalar Parameter</strong>，<code>BaseColor</code> 接
          <strong>Vector Parameter</strong>，这样在材质实例里就能直接调。
        </p>

        <p><strong>三、完整 HLSL 代码（直接复制到 Custom Node 的 Code 字段）</strong></p>
        <p>
          代码顶部的一组 <code>const float GN_*</code> 就是被收起来的 11 个内部参数 ——
          想暴露任何一个，把对应行删掉、在 Custom Node 里加同名 Input 即可（HLSL 主体不用动，
          因为引用时直接用 <code>GN_*</code> 名字）。
        </p>
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
    },
  ],
};
