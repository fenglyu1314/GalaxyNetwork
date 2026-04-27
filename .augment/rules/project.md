---
type: always_apply
description: 项目基础规则 — GalaxyNetwork 技术分享网页
---

# 项目基础规则

## 沟通语言
- 始终使用**中文**与用户交流（包括解释、提问、总结、commit message 提议等）。
- 代码注释保持中文风格，与 `GalaxyNetwork.ush` 现有注释风格一致。

## 项目目标
本项目用于围绕 `GalaxyNetwork.ush` 制作一个**可交互的技术分享网页**。

`GalaxyNetwork.ush` 是一个在 UE 中通过 Custom Node 实现的**星座网络材质**：
基于 UV 网格化绘制星点，星点做圆周运动并独立闪烁，邻近星点之间根据
亮度/距离/密度概率自动连线，形成动态星空网络效果。

## 网页要求
1. **渐进式讲解**，每一节包含：原理说明 + 关键代码片段 + 独立的实时渲染示例。
   建议章节顺序（可调整）：
   - 基础：基于 UV 绘制单个点 / 光晕
   - 网格化：用 `floor(uv*scale)` 划分格子，每格放一颗星
   - 伪随机：整数 Hash 替代 sin Hash
   - 运动：圆周运动 + `sincos`
   - 闪烁：独立频率/相位的脉冲
   - 邻域查找：3×3 光晕 / 十字连线
   - 连线绘制：点到线段距离 + smoothstep
   - 连线概率：亮度 + 距离 + 密度综合判断
   - 完整效果合成
2. 每个示例必须是**实时渲染**（WebGL / WebGL2 / WebGPU 任一，优先 WebGL2 + 原生 GLSL，
   便于直接展示与 UE HLSL 对应的着色器代码）。
3. 每个示例提供 UI 控件（slider / color picker / toggle）实时修改 shader 参数
   （如 `Scale`、`Brightness`、`StarSize`、`LineWidth`、`LineDensity`、`Time` 速度等）。
4. 代码片段与实际运行的 shader **必须保持一致**，不能展示一份、运行另一份。
   优先把 shader 源码作为字符串集中管理，UI 与渲染共用同一份。

## 技术栈倾向（无强制，需变更先与用户确认）
- 前端：原生 HTML + TypeScript + Vite，避免引入重型框架。
- 渲染：直接写 WebGL2 + GLSL，或使用极轻量封装（如 `twgl.js`、`regl`）。
  避免 Three.js 等大型引擎，除非用户明确要求。
- UI 控件：原生 `<input type="range">` 或轻量库（如 `lil-gui`、`tweakpane`）。
- 部署：静态站点，能 `npm run build` 生成纯静态文件。

## 代码与编辑规范
- 修改 shader 时，HLSL（`.ush`）与 GLSL 版本需**同步更新**，并在网页上注明两者差异
  （例如 `asuint` ↔ `floatBitsToUint`、`sincos` ↔ 分别调用 `sin`/`cos`）。
- 新增章节示例时，遵循"一节一文件夹/一组件"的组织方式，便于独立查看。
- 不擅自添加未被要求的文档（`README.md` 等）或测试文件；保持仓库整洁。
- 依赖管理一律使用 `npm` / `pnpm` 命令，禁止手改 `package.json` 的依赖字段。

## 与用户协作
- 任何破坏性操作（删除文件、改动 `.ush` 算法、引入大型依赖、部署）必须先征求用户同意。
- 完成阶段性工作后，主动建议用户在浏览器中查看效果并反馈。
