/*
 * The grains, as one point per inked cell of the rasterised passage.
 *
 * The passage is drawn once to an atlas, and every cell of it with any ink in
 * it becomes a point the size of that cell. A point samples its own cell of the
 * atlas through `gl_PointCoord`, so at rest the points tile the atlas exactly
 * and the grains are the text, pixel for pixel. There is no crossfade from a
 * crisp copy to a particle copy, since there is only one copy.
 *
 * A line's trip is one signed number: below 0 it is still scattered below its
 * place and assembling, above 0 it is leaving upward. Each grain starts its own
 * move after a delay that runs across the line, plus some noise, so a line goes
 * from one end to the other rather than all at once.
 *
 * Output is premultiplied alpha over a transparent canvas, so the stage behind
 * the canvas is the page's own.
 */

const VERT = `
attribute vec2 aCell;
attribute vec2 aSeed;

uniform vec2 uStage;
uniform float uShift;
uniform float uTrip;
uniform float uCell;
uniform float uDpr;
uniform float uCalm;

varying vec2 vCell;
varying float vAlpha;
varying float vK;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  float s = abs(uTrip);
  float dir = uTrip >= 0.0 ? 1.0 : -1.0;
  float r1 = aSeed.y;
  float r2 = hash(r1 * 91.7 + 3.1);
  float r3 = hash(r1 * 37.3 + 7.9);

  // leaving goes from the line's start, and assembling settles the start
  // first, so both read in the direction the line is read
  float sweep = dir > 0.0 ? aSeed.x : 1.0 - aSeed.x;
  float delay = sweep * 0.55 + r1 * 0.2;
  float k = clamp((s - delay) / 0.25, 0.0, 1.0);
  float e = k * k;

  // a wind from the left that lifts: up and right on the way out, so the way
  // in comes from below and to the left
  vec2 off = vec2(
    (30.0 + r3 * 80.0) * e + sin(e * 5.0 + r2 * 6.2831) * 16.0 * e,
    -(50.0 + r2 * 140.0) * e
  ) * dir;
  off *= uDpr * (1.0 - uCalm);

  vec2 pos = aCell + uCell * 0.5 + vec2(0.0, uShift) + off;
  gl_Position = vec4(pos.x / uStage.x * 2.0 - 1.0, 1.0 - pos.y / uStage.y * 2.0, 0.0, 1.0);
  gl_PointSize = uCell * (1.0 - 0.45 * k * (1.0 - uCalm));

  vCell = aCell;
  vK = k * (1.0 - uCalm);
  // reduced motion keeps the tone and drops the travel: the line fades as a
  // whole on the same trip
  vAlpha = mix(1.0 - smoothstep(0.3, 1.0, k), 1.0 - s, uCalm);
}
`;

const FRAG = `
precision highp float;

uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform float uCell;
uniform vec3 uInk;
uniform vec3 uDust;

varying vec2 vCell;
varying float vAlpha;
varying float vK;

void main() {
  vec2 t = (vCell + gl_PointCoord * uCell) / uAtlasSize;
  float a = texture2D(uAtlas, t).a * vAlpha;
  if (a < 0.004) discard;
  // a grain cools toward the muted tone as it flies, so dust reads lighter
  // than the ink it came from
  vec3 c = mix(uInk, uDust, vK * 0.7);
  gl_FragColor = vec4(c * a, a);
}
`;

const UNIFORMS = [
  "uStage",
  "uShift",
  "uTrip",
  "uCell",
  "uDpr",
  "uCalm",
  "uAtlas",
  "uAtlasSize",
  "uInk",
  "uDust",
] as const;

export interface Grains {
  gl: WebGLRenderingContext;
  u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  buffer: WebGLBuffer;
  texture: WebGLTexture;
  aCell: number;
  aSeed: number;
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

/** compiles the grains onto a context, or null when the context cannot run them */
export function createGrains(gl: WebGLRenderingContext): Grains | null {
  const vs = shader(gl, gl.VERTEX_SHADER, VERT);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!vs || !fs || !program || !buffer || !texture) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call that happens to start with "use", not a React hook
  gl.useProgram(program);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  // nearest, so a grain at rest lands each texel on one device pixel
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const u = {} as Grains["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  gl.uniform1i(u.uAtlas, 0);
  return {
    gl,
    u,
    buffer,
    texture,
    aCell: gl.getAttribLocation(program, "aCell"),
    aSeed: gl.getAttribLocation(program, "aSeed"),
  };
}

/**
 * Hands the context a new atlas and its cells. `cells` is four floats a grain:
 * the cell's top left in atlas pixels, its place across its line from 0 to 1,
 * and a random number.
 */
export function loadGrains(
  { gl, buffer, texture, aCell, aSeed }: Grains,
  atlas: HTMLCanvasElement,
  cells: Float32Array,
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, cells, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCell);
  gl.vertexAttribPointer(aCell, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aSeed);
  gl.vertexAttribPointer(aSeed, 2, gl.FLOAT, false, 16, 8);
}

export type Tone = readonly [number, number, number];

/** one line's share of a frame */
export interface Run {
  first: number;
  count: number;
  /** atlas y to stage y, in device pixels */
  shift: number;
  trip: number;
}

export interface Frame {
  width: number;
  height: number;
  atlasWidth: number;
  atlasHeight: number;
  cell: number;
  dpr: number;
  calm: boolean;
  ink: Tone;
  dust: Tone;
  runs: readonly Run[];
}

export function drawGrains({ gl, u }: Grains, f: Frame): void {
  gl.viewport(0, 0, f.width, f.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(u.uStage, f.width, f.height);
  gl.uniform2f(u.uAtlasSize, f.atlasWidth, f.atlasHeight);
  gl.uniform1f(u.uCell, f.cell);
  gl.uniform1f(u.uDpr, f.dpr);
  gl.uniform1f(u.uCalm, f.calm ? 1 : 0);
  gl.uniform3f(u.uInk, f.ink[0], f.ink[1], f.ink[2]);
  gl.uniform3f(u.uDust, f.dust[0], f.dust[1], f.dust[2]);
  for (const r of f.runs) {
    gl.uniform1f(u.uShift, r.shift);
    gl.uniform1f(u.uTrip, r.trip);
    gl.drawArrays(gl.POINTS, r.first, r.count);
  }
}
