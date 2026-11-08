/*
 * The glass, as three WebGL 2 programs.
 *
 * - `BLUR` runs four times at load and turns the photograph into the soft copy
 *   the fog shows. It never runs again.
 * - `FIELD` is the glass's memory. It reads last frame's field and writes this
 *   frame's into the other of two half-resolution targets: red is how fogged
 *   the glass is, green how wet. A wipe is a list of segments stamped into it,
 *   so every stroke stays on the glass until the fog grows back over it.
 * - `COMPOSITE` reads the field and the two copies of the street and draws the
 *   frame: beaded condensation where it is fogged, a wet film with streaks and
 *   a lip where it was wiped, and each running drop as a small inverted lens.
 *
 * Nothing outside these programs knows what fog looks like. The component only
 * hands them the segments, the drops and a few numbers a frame.
 */

export const MAXS = 48;
export const MAXD = 40;

const VERT = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`;

const COMMON = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return noise(p)*.5 + noise(p*2.03+7.1)*.3 + noise(p*4.07+3.3)*.2; }
`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uSize; uniform vec2 uDir;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 c = texture(uTex, uv) * 0.227027;
  c += (texture(uTex, uv + uDir*1.3846) + texture(uTex, uv - uDir*1.3846)) * 0.3162162;
  c += (texture(uTex, uv + uDir*3.2308) + texture(uTex, uv - uDir*3.2308)) * 0.0702703;
  o = c;
}`;

const FIELD = `#version 300 es
precision highp float;
#define MAXS ${MAXS}
uniform sampler2D uPrev; uniform vec2 uFieldRes; uniform vec2 uCss;
uniform vec4 uSeg[MAXS]; uniform vec4 uSegP[MAXS]; uniform int uSegN;
uniform float uRefog; uniform float uDry; uniform vec4 uBreath; uniform float uTime; uniform float uFloor;
out vec4 o;
${COMMON}
void main(){
  vec2 uv = gl_FragCoord.xy / uFieldRes;
  vec4 f = texture(uPrev, uv);
  vec2 p = vec2(uv.x, 1.-uv.y) * uCss;
  float fog = f.r, wet = f.g;
  float n = fbm(p*0.011);
  float m = fbm(p*0.05 + 11.);
  fog = min(1., fog + uRefog * (0.4 + 1.6*n*n) * (0.7 + 0.6*m));
  if (uFloor > 0.) {
    float seed = n*0.75 + m*0.25;
    fog = max(fog, smoothstep(seed - 0.25, seed + 0.05, uFloor*1.35 - 0.3));
  }
  wet = max(0., wet - uDry * (0.5 + n));
  for (int i = 0; i < MAXS; i++) {
    if (i >= uSegN) break;
    vec4 s = uSeg[i]; vec4 sp = uSegP[i];
    vec2 a = s.xy, ab = s.zw - s.xy;
    float L = dot(ab, ab);
    float t = L > 0. ? clamp(dot(p-a, ab)/L, 0., 1.) : 0.;
    float d = length(p - a - ab*t);
    float r = sp.x;
    vec2 dir = L > 0. ? ab*inversesqrt(L) : vec2(1., 0.);
    float across = dot(p - a, vec2(-dir.y, dir.x));
    float ridge = noise(vec2(across*0.32, 3.7));
    float k = 1. - smoothstep(r*0.42, r, d);
    k *= 0.72 + 0.28*ridge;
    fog *= 1. - k*sp.y;
    float ring = smoothstep(r*0.55, r*0.92, d) * (1. - smoothstep(r*0.92, r*1.3, d));
    wet = max(wet, ring * sp.z);
    wet = max(wet, k * sp.w);
  }
  if (uBreath.w > 0.) {
    float d = length(p - uBreath.xy);
    float edge = uBreath.z * (0.7 + 0.6*fbm(p*0.009 + uTime*0.15));
    float b = 1. - smoothstep(edge*0.25, edge, d);
    fog = min(1., fog + b*uBreath.w);
    wet *= 1. - b*uBreath.w*0.6;
  }
  o = vec4(fog, wet, 0., 1.);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
#define MAXD ${MAXD}
uniform sampler2D uSharp, uBlur, uField;
uniform vec2 uRes, uCss, uImgScale; uniform float uTime;
uniform vec4 uDrops[MAXD]; uniform int uDropN;
out vec4 o;
${COMMON}
vec3 beads(vec2 p, float cell, float seed){
  vec2 g = p/cell; vec2 i = floor(g); vec2 f = fract(g);
  vec3 best = vec3(0.);
  for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++) {
    vec2 off = vec2(x, y); vec2 id = i + off + seed;
    vec2 c = off + 0.2 + 0.6*hash2(id) - f;
    float r = 0.2 + 0.32*hash(id + 3.1);
    float d = length(c)/r;
    if (d < 1.) { float h = sqrt(1.-d*d); if (h > best.x) best = vec3(h, -c/r); }
  }
  return best;
}
vec2 img(vec2 s){ return (s - .5) * uImgScale + .5; }
void main(){
  vec2 suv = gl_FragCoord.xy / uRes;
  vec2 pUp = suv * uCss;
  vec2 p = vec2(pUp.x, uCss.y - pUp.y);
  vec2 px = 1. / uCss;
  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));
  vec3 H = normalize(L + vec3(0,0,1));

  vec4 F = texture(uField, suv);
  float fog = F.r, wet = F.g;
  float e = 2.0;
  float fl = texture(uField, suv - vec2(e*px.x, 0.)).r;
  float fr = texture(uField, suv + vec2(e*px.x, 0.)).r;
  float fd = texture(uField, suv - vec2(0., e*px.y)).r;
  float fu = texture(uField, suv + vec2(0., e*px.y)).r;
  vec2 g = vec2(fr - fl, fu - fd) / (2.*e);
  float gm = length(g);
  float fogV = smoothstep(0.03, 0.92, fog);

  vec3 bf = beads(pUp, 3.2, 0.);
  vec3 bm = beads(pUp, 8.5, 17.);
  float thin = smoothstep(0.08, 0.4, fog) * (1. - smoothstep(0.5, 0.95, fog));
  vec2 bn = bf.yz*0.5 + bm.yz*thin*1.4;
  vec2 iuv = img(suv);
  vec3 blur = texture(uBlur, iuv + bn*px*6.).rgb;
  float lum = dot(blur, vec3(.299,.587,.114));
  vec3 haze = vec3(0.80, 0.86, 0.92);
  vec3 fogCol = mix(blur, vec3(lum), 0.22)*0.74 + haze*(0.13 + lum*0.12) + blur*0.1;
  fogCol *= 0.95 + 0.08*bf.x;
  vec3 nb = normalize(vec3(bn*1.6, 1.));
  float bspec = pow(max(dot(nb, H), 0.), 60.) * (bf.x > 0. || bm.x > 0. ? 1. : 0.);
  fogCol += bspec * (0.06 + lum*0.5) * (0.4 + thin);
  fogCol *= 1. - 0.12*thin*smoothstep(0.0, 0.3, bm.x)*(1. - bm.x);

  float wetMask = smoothstep(0.35, 0.85, wet) * (1. - fogV);
  vec3 wb = beads(pUp + vec2(0., noise(pUp*0.02)*6.), 5.5, 31.);
  float streak = fbm(vec2(pUp.x*0.07, pUp.y*0.008)) - 0.5;
  vec2 off = vec2(streak*wet*3.2, 0.) * px;
  off += -g * 55. * px;
  off += wb.yz * wetMask * 4. * px;
  vec3 clear = texture(uSharp, img(suv + off)).rgb;
  clear += haze * (0.018 + wet*0.03);
  vec3 nw = normalize(vec3(wb.yz*1.2, 1.));
  clear += pow(max(dot(nw, H), 0.), 50.) * wetMask * step(0.001, wb.x) * 0.55;
  clear *= 1. - wetMask*0.18*smoothstep(0., .35, wb.x)*(1.-wb.x);

  vec3 col = mix(clear, fogCol, fogV);

  vec3 ln = normalize(vec3(-g*28., 1.));
  float lip = pow(max(dot(ln, H), 0.), 24.) * smoothstep(0.004, 0.03, gm);
  col += lip * (0.10 + 0.22*wet);
  col *= 1. - smoothstep(0.01, 0.05, gm) * 0.06;

  for (int i = 0; i < MAXD; i++) {
    if (i >= uDropN) break;
    vec4 D = uDrops[i];
    vec2 rel = p - D.xy;
    if (rel.y < 0.) rel.y /= (1. + D.w);
    float d = length(rel) / D.z;
    if (d < 1.15) {
      float a = 1. - smoothstep(0.86, 1.0, d);
      vec2 n = rel / D.z;
      vec2 nUp = vec2(n.x, -n.y);
      float h = sqrt(max(0., 1. - d*d));
      vec3 inside = texture(uSharp, img(suv - nUp * D.z * 5. * px)).rgb;
      inside = mix(inside, texture(uBlur, img(suv)).rgb, 0.25);
      inside *= mix(1.0, 0.35, smoothstep(0.55, 1.0, d));
      inside += smoothstep(0.2, 0.9, -nUp.y) * smoothstep(1., .6, d) * 0.12 * haze;
      vec3 n3 = normalize(vec3(nUp, h*0.9));
      inside += pow(max(dot(n3, H), 0.), 70.) * 1.1;
      col = mix(col, inside, a);
    }
  }

  vec2 v = suv - .5;
  col *= 1. - dot(v, v) * 0.55;
  col += (hash(gl_FragCoord.xy + fract(uTime)*100.) - .5) * 0.018;
  o = vec4(col, 1.);
}`;

type Uniforms = Record<string, WebGLUniformLocation | null>;

interface Program {
  p: WebGLProgram;
  u: Uniforms;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

export interface Glass {
  gl: WebGL2RenderingContext;
  blur: Program;
  field: Program;
  comp: Program;
  /** two half-resolution targets, read one and write the other each frame */
  fields: Target[];
  cur: number;
  fieldW: number;
  fieldH: number;
  sharp: WebGLTexture | null;
  soft: WebGLTexture | null;
  imgW: number;
  imgH: number;
  /**
   * Without float targets the field is 8 bits a channel, so a refog smaller
   * than one step rounds to nothing and the glass never fogs back. The
   * component banks the refog until it is worth a step.
   */
  quant: number;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "compile");
  }
  return s;
}

function program(gl: WebGL2RenderingContext, frag: string): Program {
  const p = gl.createProgram();
  if (!p) throw new Error("program");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "link");
  }
  const u: Uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (!info) continue;
    const name = info.name.replace("[0]", "");
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function fieldFormat(g: Glass) {
  const { gl } = g;
  return g.quant === 0
    ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT }
    : { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE };
}

function target(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internal: number,
  type: number,
): Target {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error("target");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );
  return { tex, fbo };
}

/** every program switch, through one place */
function activate(gl: WebGL2RenderingContext, prog: Program) {
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call that happens to start with "use", not a React hook
  gl.useProgram(prog.p);
}

function draw(
  g: Glass,
  prog: Program,
  fbo: WebGLFramebuffer | null,
  w: number,
  h: number,
) {
  const { gl } = g;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, w, h);
  activate(gl, prog);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function bind(
  g: Glass,
  unit: number,
  tex: WebGLTexture | null,
  loc: WebGLUniformLocation | null | undefined,
) {
  const { gl } = g;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc ?? null, unit);
}

/** compiles the three programs, or returns null when the context cannot */
export function createGlass(gl: WebGL2RenderingContext): Glass | null {
  try {
    const hasFloat = !!gl.getExtension("EXT_color_buffer_float");
    const g: Glass = {
      gl,
      blur: program(gl, BLUR),
      field: program(gl, FIELD),
      comp: program(gl, COMPOSITE),
      fields: [],
      cur: 0,
      fieldW: 0,
      fieldH: 0,
      sharp: null,
      soft: null,
      imgW: 1,
      imgH: 1,
      quant: hasFloat ? 0 : 3 / 255,
    };
    gl.bindVertexArray(gl.createVertexArray());
    return g;
  } catch {
    return null;
  }
}

/** uploads the photograph and blurs it once, at a third of its size */
export function loadScene(g: Glass, image: HTMLImageElement) {
  const { gl } = g;
  g.imgW = image.naturalWidth;
  g.imgH = image.naturalHeight;
  const sharp = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sharp);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  g.sharp = sharp;

  const bw = Math.round(g.imgW / 3);
  const bh = Math.round(g.imgH / 3);
  const a = target(gl, bw, bh, gl.RGBA8, gl.UNSIGNED_BYTE);
  const b = target(gl, bw, bh, gl.RGBA8, gl.UNSIGNED_BYTE);
  let src = sharp;
  // four separable passes at a widening step, which is a wide gaussian for
  // the price of sixteen taps, ping-ponging through two targets
  for (const s of [1, 1.6, 2.4, 3.4]) {
    activate(gl, g.blur);
    bind(g, 0, src, g.blur.u.uTex);
    gl.uniform2f(g.blur.u.uSize ?? null, bw, bh);
    gl.uniform2f(g.blur.u.uDir ?? null, s / bw, 0);
    draw(g, g.blur, a.fbo, bw, bh);
    bind(g, 0, a.tex, g.blur.u.uTex);
    gl.uniform2f(g.blur.u.uDir ?? null, 0, s / bh);
    draw(g, g.blur, b.fbo, bw, bh);
    src = b.tex;
  }
  gl.deleteFramebuffer(a.fbo);
  gl.deleteTexture(a.tex);
  gl.deleteFramebuffer(b.fbo);
  g.soft = b.tex;
}

/**
 * Sizes the field to half the stage. With a field already there, its contents
 * are copied across through the field pass with nothing added, which rescales
 * it, so a resize keeps every wipe rather than fogging the glass over.
 */
export function resizeField(g: Glass, cssW: number, cssH: number, fog: number) {
  const { gl } = g;
  const w = Math.max(2, Math.round(cssW * 0.5));
  const h = Math.max(2, Math.round(cssH * 0.5));
  const { internal, type } = fieldFormat(g);
  const next = [
    target(gl, w, h, internal, type),
    target(gl, w, h, internal, type),
  ];
  const prev = g.fields[g.cur];
  if (prev) {
    const F = g.field;
    activate(gl, F);
    bind(g, 0, prev.tex, F.u.uPrev);
    gl.uniform2f(F.u.uFieldRes ?? null, w, h);
    gl.uniform2f(F.u.uCss ?? null, cssW, cssH);
    gl.uniform1i(F.u.uSegN ?? null, 0);
    gl.uniform1f(F.u.uRefog ?? null, 0);
    gl.uniform1f(F.u.uDry ?? null, 0);
    gl.uniform1f(F.u.uFloor ?? null, 0);
    gl.uniform4f(F.u.uBreath ?? null, 0, 0, 0, 0);
    for (const t of next) draw(g, F, t.fbo, w, h);
  } else {
    for (const t of next) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(fog, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }
  for (const t of g.fields) {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  }
  g.fields = next;
  g.cur = 0;
  g.fieldW = w;
  g.fieldH = h;
}

export interface Frame {
  cssW: number;
  cssH: number;
  /** the canvas's backing size, in device pixels */
  width: number;
  height: number;
  /** segments as `ax, ay, bx, by`, and each one's `radius, strength, rim, film` */
  seg: Float32Array;
  segP: Float32Array;
  segN: number;
  /** drops as `x, y, radius, stretch` */
  drops: Float32Array;
  dropN: number;
  refog: number;
  dry: number;
  /** `x, y, radius, strength`, strength 0 when nobody is breathing */
  breath: readonly [number, number, number, number];
  /** the intro's rising fog, 0 once it has finished */
  floor: number;
  /** seconds, for the breath's edge */
  time: number;
  /** seconds, for the grain, held still under reduced motion */
  grain: number;
}

/** one frame: the field pass into the other target, then the composite */
export function drawFrame(g: Glass, f: Frame) {
  const { gl } = g;
  const F = g.field;
  const from = g.fields[g.cur];
  const to = g.fields[1 - g.cur];
  if (!from || !to || !g.sharp || !g.soft) return;

  activate(gl, F);
  bind(g, 0, from.tex, F.u.uPrev);
  gl.uniform2f(F.u.uFieldRes ?? null, g.fieldW, g.fieldH);
  gl.uniform2f(F.u.uCss ?? null, f.cssW, f.cssH);
  gl.uniform4fv(F.u.uSeg ?? null, f.seg);
  gl.uniform4fv(F.u.uSegP ?? null, f.segP);
  gl.uniform1i(F.u.uSegN ?? null, f.segN);
  gl.uniform1f(F.u.uRefog ?? null, f.refog);
  gl.uniform1f(F.u.uDry ?? null, f.dry);
  gl.uniform4f(F.u.uBreath ?? null, ...f.breath);
  gl.uniform1f(F.u.uTime ?? null, f.time);
  gl.uniform1f(F.u.uFloor ?? null, f.floor);
  draw(g, F, to.fbo, g.fieldW, g.fieldH);
  g.cur = 1 - g.cur;

  // the photograph covers the stage at 0.96 of its fit, so a lens near the
  // edge has a little picture past the frame to bend in from
  const sa = f.cssW / f.cssH;
  const ia = g.imgW / g.imgH;
  const zoom = 0.96;
  const sx = (sa > ia ? 1 : sa / ia) * zoom;
  const sy = (sa > ia ? ia / sa : 1) * zoom;

  const C = g.comp;
  activate(gl, C);
  bind(g, 0, g.sharp, C.u.uSharp);
  bind(g, 1, g.soft, C.u.uBlur);
  bind(g, 2, to.tex, C.u.uField);
  gl.uniform2f(C.u.uRes ?? null, f.width, f.height);
  gl.uniform2f(C.u.uCss ?? null, f.cssW, f.cssH);
  gl.uniform2f(C.u.uImgScale ?? null, sx, sy);
  gl.uniform1f(C.u.uTime ?? null, f.grain);
  gl.uniform4fv(C.u.uDrops ?? null, f.drops);
  gl.uniform1i(C.u.uDropN ?? null, f.dropN);
  draw(g, C, null, f.width, f.height);
}
