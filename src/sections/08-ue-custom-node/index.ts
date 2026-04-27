// 第 8 节：UE Custom Node 实现 & 整体回顾
// 纯文档章节（无实时演示），包含：
//   · 7 节内容到 .ush 的段落对照
//   · UE Material Editor 中的配置步骤
//   · HLSL ↔ GLSL 主要语法差异
//   · 完整 GalaxyNetwork.ush 源码（通过 ?raw 直接读取，与仓库根文件保持一致）

import type { SectionConfig } from '../../core/section';
import { highlightGLSL } from '../../core/highlight';
import ushSource from '../../../GalaxyNetwork.ush?raw';

const ushHighlighted = highlightGLSL(ushSource);

export const section08: SectionConfig = {
  id: 'sec-08-ue-custom-node',
  title: '08 · UE Custom Node 实现 & 整体回顾',
  intro: `
    <p>
      前 7 节把"星座网络"从最基础的 UV 拆点开始，逐层堆到完整效果；这一节把所有片段
      重新装回 UE Material 的 <strong>Custom Node</strong>，给出网页演示与 .ush 源文件
      的一一对应、UE 内的配置步骤，以及 HLSL ↔ GLSL 几处需要注意的语法差异。
    </p>

    <p><strong>一、网页章节 ↔ .ush 段落对照</strong></p>
    <table>
      <thead>
        <tr><th style="width:18%">网页章节</th><th style="width:30%">.ush 对应段落</th><th>核心知识点</th></tr>
      </thead>
      <tbody>
        <tr><td>1 · UV 像素</td><td>L24（<code>UV * Scale</code>）</td>
            <td>把屏幕坐标投射到任意密度的着色域</td></tr>
        <tr><td>2 · 网格化</td><td>L25（<code>floor(suv)</code>）</td>
            <td><code>cellId</code> 是后续所有"按格分配"逻辑的基石</td></tr>
        <tr><td>3 · 连线</td><td>宏 <code>LINE_ABS</code>（L76–86）</td>
            <td>点到线段距离的平方化形式 + <code>smoothstep</code> 抗锯齿边缘</td></tr>
        <tr><td>4 · 运动</td><td>宏 <code>CALC_ABS_POS</code>（L55–73）</td>
            <td>整数 hash → 相位/速度，<code>sincos</code> 单指令完成圆周运动</td></tr>
        <tr><td>5 · 网络</td><td>主循环 L106–183 的 9 格遍历骨架</td>
            <td>3×3 邻域光晕 + 十字方向（→ ↓）连线，零冗余覆盖每条边</td></tr>
        <tr><td>6 · 概率筛</td><td>L46–52（<code>STAR_EXISTS</code>）+ L165–175（<code>lineThreshold</code>）</td>
            <td>星点稀疏 + 边 hash + 亮度 / 距离权重三层筛选</td></tr>
        <tr><td>7 · 闪烁 & 渐隐</td><td>L128–132（脉冲）+ L85（<code>smoothstep(1.44, 0.16)</code>）</td>
            <td>独立频率/相位的 <code>pulse²</code> 呼吸 + 远端连线距离衰减</td></tr>
      </tbody>
    </table>

    <p><strong>二、在 UE Material 中配置 Custom Node</strong></p>
    <ol>
      <li>在材质编辑器空白处右键 → <code>Custom</code>，新建 Custom Node。</li>
      <li>属性面板设置：
        <ul>
          <li><strong>Output Type</strong> = <code>CMOT Float 3</code>（RGB）</li>
          <li><strong>Description</strong> = <code>GalaxyNetwork</code>（节点显示名）</li>
          <li><strong>Code</strong> = 把 <code>GalaxyNetwork.ush</code> 全文粘贴进去；
            或者把 .ush 放到 <code>Content/Shaders/</code>（需要在
            <em>Project Settings → Rendering → Shader Permutation Reduction</em>
            里允许 <code>Additional Shader Directories</code>），然后只写一行
            <code>#include "/Project/GalaxyNetwork.ush"</code>。</li>
          <li><strong>Additional Defines / Include File Paths</strong>：保持默认即可，
            本节用到的所有内置函数（<code>asuint / sincos / lerp / saturate</code>）
            都来自 UE 的 <code>Common.ush</code>，已隐式包含。</li>
        </ul>
      </li>
      <li>在 <strong>Inputs</strong> 列表里按顺序添加 8 个引脚（顺序与名字必须严格一致，
        Custom Node 内部按"声明顺序 = 局部变量名"绑定）：
        <table>
          <thead><tr><th>名称</th><th>类型</th><th>建议来源 / 默认</th></tr></thead>
          <tbody>
            <tr><td><code>UV</code></td><td>Float2</td><td><code>TexCoord[0]</code></td></tr>
            <tr><td><code>Time</code></td><td>Float1</td><td><code>Time</code> 节点</td></tr>
            <tr><td><code>BaseColor</code></td><td>Float3</td><td>常量 <code>(0.6, 0.8, 1.0)</code> 或 Vector Parameter</td></tr>
            <tr><td><code>Scale</code></td><td>Float1</td><td>Scalar Parameter，建议默认 <code>8</code></td></tr>
            <tr><td><code>Brightness</code></td><td>Float1</td><td>Scalar Parameter，建议默认 <code>1.0</code></td></tr>
            <tr><td><code>StarSize</code></td><td>Float1</td><td>Scalar Parameter，建议默认 <code>1.0</code></td></tr>
            <tr><td><code>LineWidth</code></td><td>Float1</td><td>Scalar Parameter，建议默认 <code>1.0</code></td></tr>
            <tr><td><code>LineDensity</code></td><td>Float1</td><td>Scalar Parameter，建议默认 <code>0.5</code>（范围 0–1）</td></tr>
          </tbody>
        </table>
      </li>
      <li>把 Custom Node 的输出连到材质的 <strong>Emissive Color</strong>。
        如果作为后期或 UI 用途，连 <em>Final Color</em> / <em>Final Image</em>。</li>
      <li>材质属性建议：<strong>Shading Model = Unlit</strong>、<strong>Blend Mode = Translucent</strong>
        （叠加在已有场景上时）或 <strong>Opaque</strong>（独立全屏）。星空一般不需要光照参与。</li>
    </ol>

    <p><strong>三、HLSL ↔ GLSL 主要差异（前面零散提到，集中列一下）</strong></p>
    <table>
      <thead><tr><th style="width:30%">HLSL（.ush）</th><th style="width:30%">GLSL（网页）</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td><code>float2 / float3 / float4</code></td><td><code>vec2 / vec3 / vec4</code></td>
            <td>向量类型命名差异，含义一致</td></tr>
        <tr><td><code>asuint(x)</code></td><td><code>floatBitsToUint(x)</code></td>
            <td>位级重解释；整数 hash 输入时使用</td></tr>
        <tr><td><code>sincos(a, s, c)</code></td><td><code>s = sin(a); c = cos(a);</code></td>
            <td>HLSL 有合并指令；GLSL 无对应内建，分别调用即可</td></tr>
        <tr><td><code>lerp(a, b, t)</code></td><td><code>mix(a, b, t)</code></td>
            <td>线性插值同义函数</td></tr>
        <tr><td><code>saturate(x)</code></td><td><code>clamp(x, 0.0, 1.0)</code></td>
            <td>GLSL 无 saturate；显式 clamp 即可</td></tr>
        <tr><td><code>#define MACRO(...) { ... }</code></td><td>函数 / inline 代码</td>
            <td>GLSL 不允许带语句的多行宏；本项目改写为函数（如 <code>starOf</code>）</td></tr>
        <tr><td><code>[unroll]</code></td><td>—</td>
            <td>HLSL 编译器属性；GLSL 默认编译期就会展开常数循环</td></tr>
        <tr><td><code>(int)nid.x</code></td><td><code>int(nid.x)</code></td>
            <td>类型转换语法；HLSL 兼容 C 风格强制，GLSL 仅函数风格</td></tr>
      </tbody>
    </table>

    <p><strong>四、完整 GalaxyNetwork.ush 源码</strong></p>
    <p>
      下方代码块直接读取仓库根目录的 <code>GalaxyNetwork.ush</code>，与本系列演示
      <strong>始终同步</strong>（不存在"展示一份、运行另一份"的偏差）。
      可以滚动查看完整内容；与前面 7 节的演示 GLSL 对照阅读，能直接看出每个网页章节
      在原始 .ush 中是哪一段、被简化或增强了什么。
    </p>
    <pre class="code-block">${ushHighlighted}</pre>

    <p>
      到此整个分享结束。如果想把这个材质用到自己的项目里，最简单的路径是：
      把 <code>GalaxyNetwork.ush</code> 拷进项目的 Shaders 目录、按上面的步骤接好 8 个输入，
      改 <code>BaseColor</code> 配色、调 <code>Scale / LineDensity</code> 控制密度，
      就能得到一个零纹理、低开销、可参数化的星座背景。
    </p>
  `,
};
