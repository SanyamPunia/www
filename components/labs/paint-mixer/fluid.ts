/*
 * The paint well, as a GPU fluid simulation and one fragment shader that draws
 * it.
 *
 * The simulation is stable fluids at two resolutions. Velocity runs at 128
 * square and paint at 512 square, ping-ponged between half float targets.
 * Each step is curl, vorticity, divergence, a pressure solve, the gradient
 * taken back out, then velocity and paint advected through the result.
 *
 * - **The well is a circle inside the square grid.** A neighbour outside it
 *   counts as a wall: velocity reflects, pressure copies the centre, and
 *   advection pulls a back trace that leaves the circle back onto its rim, so
 *   paint stays in the well.
 * - **A paint texel holds K/S times weight in rgb and the weight in alpha.**
 *   Advection averages both, so the mixture's K/S is rgb over alpha wherever
 *   paint meets paint, and the alpha is how much paint is there. See
 *   `pigments.ts` for the model.
 * - **Paint is viscous**, so velocity dissipates in about a second and paint
 *   never does. Streaks marble, then blur into one colour as the advection
 *   smears them.
 * - **The drawing lights the paint as a wet surface.** Its height is its
 *   alpha, its normal comes from the height's gradient, and a glossy
 *   highlight rides the ridges. The porcelain dish, its rim and its shadow are
 *   in the same shader, from one height profile.
 */

/** the fluid's radius and the dish's outer edge, as shares of the canvas */
export const WELL = 0.355;
export const DISH = 0.43;
/** the radius the readout averages over, round the well's centre */
export const SAMPLE = 0.045;

const SIM = 128;
const DYE = 512;
const ITERATIONS = 22;
const CURL = 4;
/** the fastest the paint may move, in wells a second */
const LIMIT = 0.75;
const VELOCITY_DECAY = 1.1;

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform float uWell;
float inside(vec2 uv) { return step(length(uv - 0.5), uWell); }
`;

const SPLAT = `${HEAD}
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform float uSize;
uniform vec4 uValue;
uniform float uLimit;
uniform float uRadial;
void main() {
  vec2 d = vUv - uPoint;
  float r = dot(d, d) / (uSize * uSize);
  // paint lands as a blob with a shoulder, where a push fades out softly
  float g = uLimit > 0.0 ? exp(-r) : exp(-r * r);
  o = texture(uTarget, vUv) + uValue * g * inside(vUv);
  // a spreading drop pushes straight out from its centre, evenly all round
  o.xy += uRadial * (d / uSize) * exp(-r) * inside(vUv);
  // a velocity is capped, or a hard stir copies one paint over the rest
  float l = length(o.xy);
  if (uLimit > 0.0 && l > uLimit) o.xy *= uLimit / l;
}
`;

const CURL_FS = `${HEAD}
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}
`;

const VORTICITY = `${HEAD}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlK;
uniform float uDt;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uCurlK * C;
  f.y *= -1.0;
  vec2 v = texture(uVel, vUv).xy + f * uDt;
  o = vec4(v * inside(vUv), 0.0, 1.0);
}
`;

const DIVERGENCE = `${HEAD}
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  vec2 C = texture(uVel, vUv).xy;
  vec2 l = vUv - vec2(uTexel.x, 0.0);
  vec2 r = vUv + vec2(uTexel.x, 0.0);
  vec2 t = vUv + vec2(0.0, uTexel.y);
  vec2 b = vUv - vec2(0.0, uTexel.y);
  float L = inside(l) > 0.5 ? texture(uVel, l).x : -C.x;
  float R = inside(r) > 0.5 ? texture(uVel, r).x : -C.x;
  float T = inside(t) > 0.5 ? texture(uVel, t).y : -C.y;
  float B = inside(b) > 0.5 ? texture(uVel, b).y : -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`;

const PRESSURE = `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uDiv;
uniform vec2 uTexel;
float at(vec2 uv, float c) {
  return inside(uv) > 0.5 ? texture(uPressure, uv).x : c;
}
void main() {
  float C = texture(uPressure, vUv).x;
  float L = at(vUv - vec2(uTexel.x, 0.0), C);
  float R = at(vUv + vec2(uTexel.x, 0.0), C);
  float T = at(vUv + vec2(0.0, uTexel.y), C);
  float B = at(vUv - vec2(0.0, uTexel.y), C);
  float div = texture(uDiv, vUv).x;
  o = vec4((L + R + T + B - div) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT = `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uVel;
uniform vec2 uTexel;
float at(vec2 uv, float c) {
  return inside(uv) > 0.5 ? texture(uPressure, uv).x : c;
}
void main() {
  float C = texture(uPressure, vUv).x;
  float L = at(vUv - vec2(uTexel.x, 0.0), C);
  float R = at(vUv + vec2(uTexel.x, 0.0), C);
  float T = at(vUv + vec2(0.0, uTexel.y), C);
  float B = at(vUv - vec2(0.0, uTexel.y), C);
  vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  o = vec4(v * inside(vUv), 0.0, 1.0);
}
`;

const ADVECT = `${HEAD}
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform float uDt;
uniform float uDecay;
void main() {
  vec2 c = vUv - uDt * texture(uVel, vUv).xy;
  vec2 off = c - 0.5;
  float l = length(off);
  float edge = uWell * 0.992;
  if (l > edge) c = 0.5 + off / l * edge;
  o = texture(uSrc, c) / (1.0 + uDecay * uDt) * inside(vUv);
}
`;

const SCALE = `${HEAD}
uniform sampler2D uSrc;
uniform float uScale;
void main() { o = texture(uSrc, vUv) * uScale; }
`;

const KM = `
vec3 km(vec3 k) { return 1.0 + k - sqrt(k * k + 2.0 * k); }
vec3 srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;

const DISPLAY = `${HEAD}
${KM}
uniform sampler2D uDye;
uniform vec2 uDyeTexel;
uniform float uDish;
uniform float uPx;
uniform vec3 uPorcelain;

const vec3 LIGHT = normalize(vec3(-0.45, 0.55, 0.75));
const vec3 EYE = vec3(0.0, 0.0, 1.0);

// the dish's height at a distance from its centre: a shallow bowl, a lip
// that rises out of it, a flat top, and a rounded outer edge
float dish(float d) {
  float bowl = 0.018 * pow(min(d / uWell, 1.0), 2.0);
  float rise = smoothstep(uWell - 0.004, uWell + 0.026, d);
  float fall = smoothstep(uDish - 0.024, uDish, d);
  return bowl + 0.05 * rise * (1.0 - fall);
}

// the circle cuts the paint grid into whole texels, so its edge steps. Every
// read is pulled to a radius a few texels inside the wall, which carries the
// paint's own colour and height out to the edge, and the edge itself is drawn
// in the display at screen resolution
vec2 within(vec2 uv) {
  vec2 off = uv - 0.5;
  float l = length(off);
  float edge = uWell - 3.0 * uDyeTexel.x;
  return l > edge ? 0.5 + off / l * edge : uv;
}

float paint(vec2 uv) {
  return 0.03 * (1.0 - exp(-texture(uDye, within(uv)).a * 1.4));
}
// two texels out, so bilinear filtering smooths the half float's steps,
// which read as speckle in the flat top of a drop
const float SPREAD = 2.0;

void main() {
  vec2 p = vUv - 0.5;
  float d = length(p);
  vec2 dir = d > 1e-5 ? p / d : vec2(0.0);

  // a soft shadow under the dish, cast down and to the right
  float sd = length(vUv - vec2(0.5 + 0.012, 0.5 - 0.022)) - uDish;
  float shadow = 0.2 * exp(-max(sd, 0.0) / 0.022) * smoothstep(0.075, 0.0, sd);
  float cover = smoothstep(uDish, uDish - uPx * 1.5, d);
  if (cover <= 0.0) {
    o = vec4(0.0, 0.0, 0.0, shadow);
    return;
  }

  float e = 0.002;
  float slope = (dish(d + e) - dish(d - e)) / (2.0 * e);
  vec3 n = normalize(vec3(-dir * slope * 2.2, 1.0));
  float diffuse = dot(n, LIGHT);
  float glaze = pow(max(dot(reflect(-LIGHT, n), EYE), 0.0), 70.0);
  float ao = 1.0 - 0.14 * smoothstep(uWell * 0.55, uWell, d) * step(d, uWell + 0.01);
  vec3 col = uPorcelain * (0.8 + 0.24 * diffuse) * ao + glaze * 0.35;

  if (d < uWell) {
    vec4 dye = texture(uDye, within(vUv));
    float a = dye.a;
    // the paint meets the porcelain on a smooth curve a pixel and a half wide
    float rim = smoothstep(uWell, uWell - uPx * 1.5, d);
    float thick = (1.0 - exp(-a * 6.0)) * rim;
    if (thick > 0.002) {
      vec3 k = dye.rgb / max(a, 1e-4);
      vec3 r = srgb(km(max(k, 0.0)));
      vec2 sx = vec2(uDyeTexel.x * SPREAD, 0.0);
      vec2 sy = vec2(0.0, uDyeTexel.y * SPREAD);
      float hx = paint(vUv + sx) - paint(vUv - sx);
      float hy = paint(vUv + sy) - paint(vUv - sy);
      float run = 2.0 * SPREAD * uDyeTexel.x;
      vec3 pn = normalize(vec3(-hx, -hy, run) + vec3(n.xy * run, 0.0));
      float lit = dot(pn, LIGHT);
      float gloss = pow(max(dot(reflect(-LIGHT, pn), EYE), 0.0), 36.0);
      vec3 wet = r * (0.72 + 0.4 * lit) + gloss * 0.5 * smoothstep(0.2, 0.9, thick);
      col = mix(col, wet, thick);
    }
  }

  // premultiplied: the dish over its own shadow
  o = vec4(col * cover, cover + shadow * (1.0 - cover));
}
`;

const SAMPLE_FS = `${HEAD}
${KM}
uniform sampler2D uDye;
uniform float uRadius;
void main() {
  vec4 sum = vec4(0.0);
  float n = 0.0;
  for (int i = -4; i <= 4; i++) {
    for (int j = -4; j <= 4; j++) {
      vec2 q = vec2(float(i), float(j)) / 4.0;
      if (dot(q, q) > 1.0) continue;
      sum += texture(uDye, 0.5 + q * uRadius);
      n += 1.0;
    }
  }
  vec3 k = sum.rgb / max(sum.a, 1e-5);
  float a = sum.a / n;
  o = vec4(srgb(km(max(k, 0.0))), 1.0 - exp(-a * 6.0));
}
`;

interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  size: number;
}

interface Pair {
  read: Target;
  write: Target;
}

export interface Fluid {
  gl: WebGL2RenderingContext;
  prog: Record<
    | "splat"
    | "curl"
    | "vorticity"
    | "divergence"
    | "pressure"
    | "gradient"
    | "advect"
    | "scale"
    | "display"
    | "sample",
    Program
  >;
  velocity: Pair;
  dye: Pair;
  pressure: Pair;
  curl: Target;
  div: Target;
  probe: Target;
  porcelain: readonly [number, number, number];
}

export interface Splat {
  kind: "velocity" | "dye";
  /** an even outward push, in place of `value`'s direction */
  radial?: number;
  x: number;
  y: number;
  size: number;
  value: readonly [number, number, number, number];
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
  const u: Program["u"] = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (info) u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

function target(
  gl: WebGL2RenderingContext,
  size: number,
  float = true,
): Target {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error("target");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    float ? gl.RGBA16F : gl.RGBA8,
    size,
    size,
    0,
    gl.RGBA,
    float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    null,
  );
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
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo, size };
}

function pair(gl: WebGL2RenderingContext, size: number): Pair {
  return { read: target(gl, size), write: target(gl, size) };
}

function swap(pr: Pair) {
  const t = pr.read;
  pr.read = pr.write;
  pr.write = t;
}

function use(f: Fluid, prog: Program) {
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call that happens to start with "use", not a React hook
  f.gl.useProgram(prog.p);
  f.gl.uniform1f(prog.u.uWell ?? null, WELL);
}

function tex(f: Fluid, prog: Program, name: string, unit: number, t: Target) {
  const { gl } = f;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.uniform1i(prog.u[name] ?? null, unit);
}

function blit(f: Fluid, to: Target | null, w?: number, h?: number) {
  const { gl } = f;
  gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fbo : null);
  gl.viewport(0, 0, to ? to.size : (w ?? 1), to ? to.size : (h ?? 1));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** compiles everything onto a WebGL 2 context, or null when it cannot run */
export function createFluid(
  gl: WebGL2RenderingContext,
  porcelain: readonly [number, number, number],
): Fluid | null {
  try {
    if (!gl.getExtension("EXT_color_buffer_float")) return null;
    gl.bindVertexArray(gl.createVertexArray());
    return {
      gl,
      prog: {
        splat: program(gl, SPLAT),
        curl: program(gl, CURL_FS),
        vorticity: program(gl, VORTICITY),
        divergence: program(gl, DIVERGENCE),
        pressure: program(gl, PRESSURE),
        gradient: program(gl, GRADIENT),
        advect: program(gl, ADVECT),
        scale: program(gl, SCALE),
        display: program(gl, DISPLAY),
        sample: program(gl, SAMPLE_FS),
      },
      velocity: pair(gl, SIM),
      dye: pair(gl, DYE),
      pressure: pair(gl, SIM),
      curl: target(gl, SIM),
      div: target(gl, SIM),
      probe: target(gl, 1, false),
      porcelain,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function splat(f: Fluid, s: Splat) {
  const { gl, prog } = f;
  const pr = s.kind === "velocity" ? f.velocity : f.dye;
  use(f, prog.splat);
  tex(f, prog.splat, "uTarget", 0, pr.read);
  gl.uniform2f(prog.splat.u.uPoint ?? null, s.x, s.y);
  gl.uniform1f(prog.splat.u.uSize ?? null, s.size);
  gl.uniform4f(prog.splat.u.uValue ?? null, ...s.value);
  gl.uniform1f(prog.splat.u.uLimit ?? null, s.kind === "velocity" ? LIMIT : 0);
  gl.uniform1f(prog.splat.u.uRadial ?? null, s.radial ?? 0);
  blit(f, pr.write);
  swap(pr);
}

/** one step of the simulation, `dt` in seconds */
export function step(f: Fluid, dt: number) {
  const { gl, prog } = f;
  const texel = 1 / SIM;

  use(f, prog.curl);
  gl.uniform2f(prog.curl.u.uTexel ?? null, texel, texel);
  tex(f, prog.curl, "uVel", 0, f.velocity.read);
  blit(f, f.curl);

  use(f, prog.vorticity);
  gl.uniform2f(prog.vorticity.u.uTexel ?? null, texel, texel);
  gl.uniform1f(prog.vorticity.u.uCurlK ?? null, CURL);
  gl.uniform1f(prog.vorticity.u.uDt ?? null, dt);
  tex(f, prog.vorticity, "uVel", 0, f.velocity.read);
  tex(f, prog.vorticity, "uCurl", 1, f.curl);
  blit(f, f.velocity.write);
  swap(f.velocity);

  use(f, prog.divergence);
  gl.uniform2f(prog.divergence.u.uTexel ?? null, texel, texel);
  tex(f, prog.divergence, "uVel", 0, f.velocity.read);
  blit(f, f.div);

  use(f, prog.pressure);
  gl.uniform2f(prog.pressure.u.uTexel ?? null, texel, texel);
  tex(f, prog.pressure, "uDiv", 1, f.div);
  for (let i = 0; i < ITERATIONS; i++) {
    tex(f, prog.pressure, "uPressure", 0, f.pressure.read);
    blit(f, f.pressure.write);
    swap(f.pressure);
  }

  use(f, prog.gradient);
  gl.uniform2f(prog.gradient.u.uTexel ?? null, texel, texel);
  tex(f, prog.gradient, "uPressure", 0, f.pressure.read);
  tex(f, prog.gradient, "uVel", 1, f.velocity.read);
  blit(f, f.velocity.write);
  swap(f.velocity);

  use(f, prog.advect);
  gl.uniform1f(prog.advect.u.uDt ?? null, dt);
  gl.uniform1f(prog.advect.u.uDecay ?? null, VELOCITY_DECAY);
  tex(f, prog.advect, "uVel", 0, f.velocity.read);
  tex(f, prog.advect, "uSrc", 1, f.velocity.read);
  blit(f, f.velocity.write);
  swap(f.velocity);

  gl.uniform1f(prog.advect.u.uDecay ?? null, 0);
  tex(f, prog.advect, "uVel", 0, f.velocity.read);
  tex(f, prog.advect, "uSrc", 1, f.dye.read);
  blit(f, f.dye.write);
  swap(f.dye);
}

/** multiplies the paint by `k`, which is how the well drains */
export function scaleDye(f: Fluid, k: number) {
  use(f, f.prog.scale);
  f.gl.uniform1f(f.prog.scale.u.uScale ?? null, k);
  tex(f, f.prog.scale, "uSrc", 0, f.dye.read);
  blit(f, f.dye.write);
  swap(f.dye);
}

/** empties the well and stills it */
export function clearWell(f: Fluid) {
  const { gl } = f;
  for (const t of [
    f.dye.read,
    f.dye.write,
    f.velocity.read,
    f.velocity.write,
    f.pressure.read,
    f.pressure.write,
  ]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

export function render(f: Fluid, width: number, height: number) {
  const { gl, prog } = f;
  use(f, prog.display);
  gl.uniform2f(prog.display.u.uDyeTexel ?? null, 1 / DYE, 1 / DYE);
  gl.uniform1f(prog.display.u.uDish ?? null, DISH);
  gl.uniform1f(prog.display.u.uPx ?? null, 1 / width);
  gl.uniform3f(prog.display.u.uPorcelain ?? null, ...f.porcelain);
  tex(f, prog.display, "uDye", 0, f.dye.read);
  blit(f, null, width, height);
}

/**
 * The mixture at the well's centre: sRGB 0..255 and how thickly it covers the
 * porcelain there, 0..1. One pixel is drawn and read back.
 */
export function sample(f: Fluid): [number, number, number, number] {
  const { gl, prog } = f;
  use(f, prog.sample);
  gl.uniform1f(prog.sample.u.uRadius ?? null, SAMPLE);
  tex(f, prog.sample, "uDye", 0, f.dye.read);
  blit(f, f.probe);
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return [px[0], px[1], px[2], px[3] / 255];
}
