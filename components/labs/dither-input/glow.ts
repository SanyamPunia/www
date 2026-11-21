/*
 * The input's glow, as one fragment shader over the whole stage.
 *
 * Every pixel works out how much light falls on it, then dithers between the
 * two nearest stops of a five-stop ramp against its place in an 8x8 Bayer
 * matrix. The ramp runs from the ground through four tones, so a soft edge is
 * the pattern stepping from one flat colour to the next and never a blend.
 *
 * - **The ramp's hue shifts across the field.** Each stop is mixed between a
 *   warm set on the left and a cool set on the right, with a slow drift, so
 *   the glow is a gradient in hue as well as in brightness.
 *
 * - **The light is a halo round the field**, from the field's rounded-rect
 *   distance, and it gathers at the caret: a lamp sits on the caret and the
 *   halo is brightest where the lamp falls on it. Focus raises both, typing
 *   raises them further for a moment, and a pulse is a ring that leaves the
 *   caret.
 * - **The threshold is fixed to the screen, and only the light moves.** Each
 *   cell reads its threshold from its own place on the stage, so the light
 *   slides through a still grid of pixels rather than the pattern crawling
 *   with it.
 * - **A cell is a whole number of device pixels**, so every edge stays sharp.
 * - **The light runs on under the field**, which the DOM input covers, so the
 *   text always sits on a solid ground. Masking the inside to ground left
 *   whole cells of ground poking past the field's rounded corners, since a
 *   cell is lit or not by its centre and the corner curves through cells.
 */

export const PULSES = 6;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 uSize;
uniform float uDpr;
uniform float uFit;
uniform float uCell;
uniform float uTime;
uniform vec4 uRect;
uniform float uRadius;
uniform vec2 uCaret;
uniform float uFocus;
uniform float uEnergy;
uniform vec4 uPulse[${PULSES}];
uniform vec3 uGround;
uniform vec3 uWarm[4];
uniform vec3 uCool[4];

// the Bayer matrix by recursion: each level is the 2x2 pattern applied to the
// level under it, which is the same as the 8x8 table without a table
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float lamp(vec2 p, vec2 at, float r) {
  vec2 d = p - at;
  return exp(-dot(d, d) / (r * r));
}

// distance to a rounded rect, negative inside
float box(vec2 p, vec2 size, float r) {
  vec2 q = abs(p) - size + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  // sampled once per cell, at its centre, in device px with y down
  vec2 c = (cell + 0.5) * uCell;
  vec2 p = vec2(c.x, uSize.y - c.y);
  // every length in here is in css px at the wide stage, scaled down with
  // a smaller stage so a phone is not one flood of light
  float px = uDpr * uFit;

  float d = box(p - uRect.xy, uRect.zw, uRadius);
  float out_ = max(d, 0.0);

  // the halo: tight and faint at rest, wider and brighter with focus, and
  // breathing a little while the field waits
  float fall = mix(12.0, 24.0, uFocus) * px;
  float halo = exp(-out_ / fall);
  float breathe = 0.88 + 0.12 * sin(uTime * 1.7);
  float ambient = (0.08 + 0.28 * uFocus * breathe) * (1.0 + 0.6 * uEnergy);
  float caret = lamp(p, uCaret, 90.0 * px) * (0.2 + 0.8 * uFocus) * (1.0 + 1.2 * uEnergy);
  float light = halo * (ambient + caret * 1.3);
  light += lamp(p, uCaret, 170.0 * px) * uEnergy * 0.25 * exp(-out_ / (90.0 * px));

  float n = noise(p / (38.0 * px) + vec2(uTime * 0.25, -uTime * 0.15));
  light *= 0.75 + 0.5 * n;

  // pulses: a ring leaving the caret, fading with age and with distance from
  // the field, so a keystroke's ring stays near what it came from
  for (int i = 0; i < ${PULSES}; i++) {
    vec4 q = uPulse[i];
    if (q.w <= 0.0) continue;
    float front = q.z * (180.0 + 160.0 * q.w) * px;
    float ring = length(p - q.xy) - front;
    float w = (7.0 + 5.0 * q.w) * px;
    float fade = exp(-q.z * 2.4) * q.w;
    light += exp(-ring * ring / (w * w)) * fade * exp(-out_ / (70.0 * px * (0.6 + q.w)));
  }

  // a toe, so the dim reaches fall to ground rather than to a grey of sparse
  // pixels, and a soft shoulder, so the brightest light still leaves a little
  light = 1.0 - exp(-pow(light, 1.4) * 2.0);

  // warm on the field's left, cool on its right, swaying slowly
  float m = clamp(
    0.5 + (p.x - uRect.x) / (uRect.z * 2.2)
      + 0.18 * sin(uTime * 0.35 + p.y / (120.0 * px)),
    0.0,
    1.0
  );

  // the two stops either side of this light, and the threshold picks one
  float level = light * 4.0;
  float lo = floor(level);
  float pick = min(4.0, lo + step(bayer8(cell) + 0.5 / 64.0, level - lo));

  vec3 col = uGround;
  for (int i = 0; i < 4; i++) {
    if (pick == float(i + 1)) col = mix(uWarm[i], uCool[i], m);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const UNIFORMS = [
  "uSize",
  "uDpr",
  "uFit",
  "uCell",
  "uTime",
  "uRect",
  "uRadius",
  "uCaret",
  "uFocus",
  "uEnergy",
  "uPulse",
  "uGround",
  "uWarm",
  "uCool",
] as const;

export interface Glow {
  gl: WebGLRenderingContext;
  u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
}

function shader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/** compiles the glow onto a context, or null when the context cannot run it */
export function createGlow(gl: WebGLRenderingContext): Glow | null {
  const vs = shader(gl, gl.VERTEX_SHADER, VERT);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call that happens to start with "use", not a React hook
  gl.useProgram(program);

  // one triangle that covers the viewport, as in `voice-orb`
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const at = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);

  const u = {} as Glow["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  return { gl, u };
}

export type Tone = readonly [number, number, number];

/** everything a frame hands the shader, in device pixels where it is a length */
export interface Frame {
  width: number;
  height: number;
  dpr: number;
  /** the glow's scale for the stage's size, 1 on the wide stage */
  fit: number;
  cell: number;
  time: number;
  /** the field's centre and half size */
  rect: readonly [number, number, number, number];
  radius: number;
  caret: readonly [number, number];
  focus: number;
  energy: number;
  pulses: Float32Array;
  ground: Tone;
  /** four stops each, dim to bright, flattened */
  warm: Float32Array;
  cool: Float32Array;
}

export function drawGlow({ gl, u }: Glow, f: Frame): void {
  gl.viewport(0, 0, f.width, f.height);
  gl.uniform2f(u.uSize, f.width, f.height);
  gl.uniform1f(u.uDpr, f.dpr);
  gl.uniform1f(u.uFit, f.fit);
  gl.uniform1f(u.uCell, f.cell);
  gl.uniform1f(u.uTime, f.time);
  gl.uniform4f(u.uRect, f.rect[0], f.rect[1], f.rect[2], f.rect[3]);
  gl.uniform1f(u.uRadius, f.radius);
  gl.uniform2f(u.uCaret, f.caret[0], f.caret[1]);
  gl.uniform1f(u.uFocus, f.focus);
  gl.uniform1f(u.uEnergy, f.energy);
  gl.uniform4fv(u.uPulse, f.pulses);
  gl.uniform3f(u.uGround, f.ground[0], f.ground[1], f.ground[2]);
  gl.uniform3fv(u.uWarm, f.warm);
  gl.uniform3fv(u.uCool, f.cool);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
