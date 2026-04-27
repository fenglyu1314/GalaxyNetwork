// 极简 GLSL 语法高亮：仅按 token 类型上色，不做完整解析
// 输出 HTML 字符串供 innerHTML 使用

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue',
  'in', 'out', 'inout', 'const', 'uniform', 'varying', 'attribute',
  'precision', 'highp', 'mediump', 'lowp', 'void', 'true', 'false',
  'discard', 'switch', 'case', 'default',
]);

const TYPES = new Set([
  'float', 'int', 'uint', 'bool',
  'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4', 'bvec2', 'bvec3', 'bvec4',
  'mat2', 'mat3', 'mat4', 'sampler2D', 'samplerCube',
  // HLSL 向量类型（供第 8 节复用本高亮器渲染 .ush）
  'float2', 'float3', 'float4', 'int2', 'int3', 'int4', 'uint2', 'uint3', 'uint4', 'bool2', 'bool3', 'bool4',
  'half', 'half2', 'half3', 'half4',
]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

export function highlightGLSL(src: string): string {
  // 先按行处理注释（行注释 // 到行尾）
  const lines = src.split('\n').map((line) => {
    const idx = line.indexOf('//');
    let code = line, comment = '';
    if (idx >= 0) {
      code = line.slice(0, idx);
      comment = line.slice(idx);
    }
    // 对 code 部分按 token 切分（标识符 / 数字 / 其他保留原样）
    const out: string[] = [];
    const re = /([A-Za-z_][A-Za-z0-9_]*)|([0-9]+\.?[0-9]*[fFuU]?)|([^A-Za-z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      if (m[1] !== undefined) {
        const word = m[1];
        if (KEYWORDS.has(word)) out.push(`<span class="kw">${word}</span>`);
        else if (TYPES.has(word)) out.push(`<span class="ty">${word}</span>`);
        else out.push(escapeHtml(word));
      } else if (m[2] !== undefined) {
        out.push(`<span class="num">${m[2]}</span>`);
      } else {
        out.push(escapeHtml(m[3]!));
      }
    }
    if (comment) out.push(`<span class="cmt">${escapeHtml(comment)}</span>`);
    return out.join('');
  });
  return lines.join('\n');
}
