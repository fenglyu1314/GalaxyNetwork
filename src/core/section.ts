// 章节工厂：把「标题 + 原理文字 + 代码块 + 实时渲染 canvas + 参数控件」组装为一节
// 关键约束：代码块展示的字符串与渲染器编译用的字符串是同一个引用，保证一致
import GUI from 'lil-gui';
import { createRenderer, type UniformDescriptor } from './renderer';
import { highlightGLSL } from './highlight';

export type ControlSpec =
  | { kind: 'range'; uniform: string; label: string; min: number; max: number; step?: number }
  | { kind: 'color'; uniform: string; label: string };

// 子小节：每个子节有独立的标题、说明、shader、控件
export interface SubsectionConfig {
  id: string;             // 用于 TOC 锚点
  title: string;
  intro?: string;         // 可选：子小节自己的说明
  shaderSource: string;
  uniforms: Record<string, UniformDescriptor>;
  controls: ControlSpec[];
}

export interface SectionConfig {
  id: string;
  title: string;
  intro: string;          // 允许简单 HTML（段落、<code>、<strong>）
  // 顶层 demo（无 children 时必填；有 children 时通常省略）
  shaderSource?: string;
  uniforms?: Record<string, UniformDescriptor>;
  controls?: ControlSpec[];
  // 二级小节（可选）
  children?: SubsectionConfig[];
}

// 颜色工具：vec3 [0..1] 数组 ↔ '#rrggbb' 字符串
function rgbToHex(rgb: [number, number, number]): string {
  const c = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// 渲染一个「品字下半」：左 canvas+控件，右代码块。被顶层 demo 和子小节共用
function mountDemo(
  parent: HTMLElement,
  shaderSource: string,
  uniforms: Record<string, UniformDescriptor>,
  controls: ControlSpec[],
): void {
  const body = document.createElement('div');
  body.className = 'section-body';

  // 左下：演示区（canvas + 控件）
  const demo = document.createElement('div');
  demo.className = 'demo';

  const canvas = document.createElement('canvas');
  demo.appendChild(canvas);

  const controlsBox = document.createElement('div');
  controlsBox.className = 'controls';
  demo.appendChild(controlsBox);

  body.appendChild(demo);

  // 右下：代码块（GLSL 源码 = 实际编译运行的源码）
  const pre = document.createElement('pre');
  pre.className = 'code-block';
  pre.innerHTML = highlightGLSL(shaderSource);
  body.appendChild(pre);

  parent.appendChild(body);

  // 启动渲染（必须在 canvas 进入 DOM 后）
  const handle = createRenderer(canvas, shaderSource, uniforms);

  // 构建 GUI
  const gui = new GUI({ container: controlsBox, title: '参数', width: 240 });
  for (const ctrl of controls) {
    const u = handle.uniforms[ctrl.uniform];
    if (!u) {
      console.warn(`控件引用了不存在的 uniform: ${ctrl.uniform}`);
      continue;
    }
    if (ctrl.kind === 'range') {
      gui.add(u, 'value', ctrl.min, ctrl.max, ctrl.step ?? 0.01).name(ctrl.label);
    } else if (ctrl.kind === 'color') {
      // 用一个代理对象供 lil-gui 操作十六进制色，写回 uniform 数组
      const proxy = { hex: rgbToHex(u.value as [number, number, number]) };
      gui
        .addColor(proxy, 'hex')
        .name(ctrl.label)
        .onChange((v: string) => {
          u.value = hexToRgb(v);
        });
    }
  }
}

export function mountSection(config: SectionConfig, parent: HTMLElement): void {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = config.id;

  // 标题
  const h2 = document.createElement('h2');
  h2.textContent = config.title;
  section.appendChild(h2);

  // 原理文字
  const intro = document.createElement('div');
  intro.className = 'intro';
  intro.innerHTML = config.intro;
  section.appendChild(intro);

  // 顶层 demo（兼容老结构：扁平章节）
  if (config.shaderSource && config.uniforms && config.controls) {
    mountDemo(section, config.shaderSource, config.uniforms, config.controls);
  }

  // 子小节（每个子节有独立的 demo + 代码）
  if (config.children) {
    for (const sub of config.children) {
      const subEl = document.createElement('div');
      subEl.className = 'subsection';
      subEl.id = sub.id;

      const h3 = document.createElement('h3');
      h3.textContent = sub.title;
      subEl.appendChild(h3);

      if (sub.intro) {
        const subIntro = document.createElement('div');
        subIntro.className = 'intro';
        subIntro.innerHTML = sub.intro;
        subEl.appendChild(subIntro);
      }

      mountDemo(subEl, sub.shaderSource, sub.uniforms, sub.controls);
      section.appendChild(subEl);
    }
  }

  parent.appendChild(section);
}
