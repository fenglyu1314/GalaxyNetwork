// WebGL2 全屏片元着色器渲染器
// 用法：传入一段 fragment shader 源码与 uniform 配置，自动每帧渲染
//   - 自动提供：uTime (秒)、uResolution (vec2 像素)
//   - 用户自定义 uniform：通过 uniforms 对象传入，运行时可修改其值即时生效
//   - 仅在 canvas 进入视口时渲染（IntersectionObserver），节省性能

export type UniformValue = number | [number, number] | [number, number, number] | [number, number, number, number];

export interface UniformDescriptor {
  type: 'float' | 'vec2' | 'vec3' | 'vec4';
  value: UniformValue;
}

export interface RendererHandle {
  uniforms: Record<string, UniformDescriptor>;
  destroy: () => void;
}

// 共用顶点着色器：一个铺满裁剪空间的三角形
const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
const vec2 POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? '';
    gl.deleteShader(sh);
    throw new Error(`Shader 编译失败:\n${log}\n--- 源码 ---\n${src}`);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? '';
    gl.deleteProgram(prog);
    throw new Error(`Program 链接失败:\n${log}`);
  }
  return prog;
}

// 把用户的 GLSL 片元代码包装为完整的 ES 3.00 fragment shader
// 用户编写的 shader 只需实现 mainImage(out vec4 fragColor, in vec2 fragCoord)
function wrapFragment(userSrc: string, uniforms: Record<string, UniformDescriptor>): string {
  const userUniformDecls = Object.entries(uniforms)
    .map(([name, u]) => `uniform ${u.type} ${name};`)
    .join('\n');
  return `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uTime;
uniform vec2 uResolution;
${userUniformDecls}
${userSrc}
`;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  fragmentSrc: string,
  uniforms: Record<string, UniformDescriptor> = {},
): RendererHandle {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('当前浏览器不支持 WebGL2');

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, wrapFragment(fragmentSrc, uniforms));
  const prog = linkProgram(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  // 预解析所有 uniform 位置
  const locTime = gl.getUniformLocation(prog, 'uTime');
  const locRes = gl.getUniformLocation(prog, 'uResolution');
  const userLocs: Record<string, WebGLUniformLocation | null> = {};
  for (const name of Object.keys(uniforms)) {
    userLocs[name] = gl.getUniformLocation(prog, name);
  }

  const vao = gl.createVertexArray();

  // 视口可见性 → 控制是否渲染
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) visible = e.isIntersecting;
  });
  io.observe(canvas);

  // canvas 尺寸自适应（保持像素比，控制最大 1.5 减少压力）
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const startTime = performance.now();
  let rafId = 0;
  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!visible) return;
    resize();
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.useProgram(prog);
    gl!.bindVertexArray(vao);
    gl!.uniform1f(locTime, (performance.now() - startTime) / 1000);
    gl!.uniform2f(locRes, canvas.width, canvas.height);
    for (const [name, u] of Object.entries(uniforms)) {
      const loc = userLocs[name];
      if (!loc) continue;
      const v = u.value;
      switch (u.type) {
        case 'float': gl!.uniform1f(loc, v as number); break;
        case 'vec2': gl!.uniform2fv(loc, v as number[]); break;
        case 'vec3': gl!.uniform3fv(loc, v as number[]); break;
        case 'vec4': gl!.uniform4fv(loc, v as number[]); break;
      }
    }
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
  rafId = requestAnimationFrame(frame);

  return {
    uniforms,
    destroy() {
      cancelAnimationFrame(rafId);
      io.disconnect();
      gl!.deleteProgram(prog);
      gl!.deleteVertexArray(vao);
    },
  };
}
