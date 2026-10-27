/*
 * The stage, as one fragment shader: the box, the sheet of film lying on it,
 * and the light falling through both.
 *
 * Every pixel works out the film's height over the box at its own point and at
 * two neighbours, which gives the film's normal, and everything that makes the
 * plastic read as plastic comes off that normal:
 *
 * - **What is under the film is seen through it, bent.** The box is sampled a
 *   little off the pixel's own point, by the film's slope and by how high the
 *   dome is there, so a label under a bubble swells toward its middle and
 *   smears at its rim. Red, green and blue take slightly different offsets.
 * - **The film reflects a room.** Two softboxes and a pale ceiling, mirrored in
 *   the film by the normal and weighted by Fresnel, so a dome's top shows a
 *   crisp window and its walls, seen at a grazing angle, go silvery. That rim
 *   is most of what makes a bubble look like a bubble.
 * - **The walls are hazier than the top**, since a line of sight through film
 *   at a grazing angle passes through more of it, and a burst bubble is hazier
 *   still, since stretched plastic whitens where it gives.
 * - **Each dome throws light on the box.** A clear dome is a weak lens, so the
 *   box under it gets a ring of shadow where the light grazes its wall and a
 *   bright spot where it is focused, both cast away from the light.
 *
 * A finger is a sphere in the same space, and the film's height is the lower
 * of the dome and the fingertip, blended over half a pixel, so the dome wraps
 * round the finger pressing it.
 *
 * Bubble data arrives as one float texture, two texels per bubble: where it is
 * and how big, then how high it stands, how far it has fallen in and how slack
 * it is. The component writes it every frame something moves.
 *
 * Lengths are in stage px, y down, so the component hands the shader the same
 * numbers it positions the DOM with.
 */

import { COLS, PROFILE, RISE, ROW_H, ROWS } from "./sheet";

export const TOUCHES = 4;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uBack;
uniform sampler2D uCells;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uStage;
uniform vec2 uCenter;
uniform vec2 uRot;
uniform vec2 uSize;
uniform float uPitch;
uniform vec2 uGrid;
uniform vec4 uTouch[${TOUCHES}];
uniform int uTouches;
uniform vec4 uFocus;
uniform vec3 uRing;
uniform float uLift;

out vec4 outColor;

const int COLS = ${COLS};
const int ROWS = ${ROWS};
const float RISE = ${RISE};
const float PROFILE = ${PROFILE};
const float ROW_H = ${ROW_H};

// the key light, above and to the upper left, and a dim fill from the right
const vec3 KEY = vec3(-0.5, -0.64, 0.58);
const vec3 FILL = vec3(0.78, 0.22, 0.58);

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// creases: the folds of crumpled film are ridges, not hills
float ridge(vec2 p) { return 1.0 - abs(vnoise(p) * 2.0 - 1.0); }

struct Cell {
  vec2 c;
  float a;
  float seed;
  vec4 st;
  float d;
};

/*
 * The bubble a point belongs to. Rows are a hexagonal lattice, so a point
 * inside any dome is nearer that dome's row than any other, and the row the
 * point falls in and the one below it are the only two worth testing.
 */
Cell nearest(vec2 q) {
  Cell best;
  best.d = 1e9;
  best.c = vec2(-1e4);
  best.a = 1.0;
  best.seed = 0.0;
  best.st = vec4(0.0);
  float rowH = uPitch * ROW_H;
  int r0 = int(floor((q.y - uGrid.y) / rowH));
  for (int k = 0; k < 2; k++) {
    int r = clamp(r0 + k, 0, ROWS - 1);
    float shift = (r % 2 == 1) ? 0.5 * uPitch : 0.0;
    int col = clamp(int(floor((q.x - uGrid.x - shift) / uPitch + 0.5)), 0, COLS - 1);
    vec4 geo = texelFetch(uCells, ivec2(col * 2, r), 0);
    float d = length(q - geo.xy);
    if (d < best.d) {
      best.d = d;
      best.c = geo.xy;
      best.a = geo.z;
      best.seed = geo.w;
      best.st = texelFetch(uCells, ivec2(col * 2 + 1, r), 0);
    }
  }
  return best;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/*
 * A dome, standing, sagging or burst. A sagging dud folds a little where its
 * film has nothing to hold it out, and a burst one is a shallow crumple of
 * ridges, since film that has given way shrinks back unevenly.
 */
float dome(vec2 q, Cell b) {
  float r2 = (b.d * b.d) / (b.a * b.a);
  if (r2 >= 1.0) return 0.0;
  vec2 l = (q - b.c) / b.a;
  float top = b.a * RISE;
  float base = pow(1.0 - r2, PROFILE);
  float h = top * b.st.x * base;
  float slack = b.st.z;
  if (slack > 0.001) {
    h *= 1.0 - slack * 0.9 * ridge(l * 2.7 + b.seed * 37.0) * (1.0 - r2);
  }
  float g = b.st.y;
  if (g > 0.0) {
    // the slit the film tore along, standing up as a lip across the middle
    float t = b.seed * 6.2832;
    float across = dot(l, vec2(-sin(t), cos(t)));
    float along = dot(l, vec2(cos(t), sin(t)));
    float slit = exp(-across * across / 0.006) * (1.0 - smoothstep(0.25, 0.7, abs(along)));
    float crumple = top * pow(1.0 - r2, 0.4) * (
      0.06
      + 0.24 * ridge(l * 2.6 + b.seed * 91.0)
      + 0.1 * ridge(l * 6.1 + b.seed * 13.0)
      + 0.16 * slit
    );
    h = mix(h, crumple, g);
  }
  return h;
}

float height(vec2 q) {
  Cell b = nearest(q);
  float h = b.d < b.a ? dome(q, b) : 0.0;
  // film off a roll is never flat: a long undulation and a fine grain
  h += 0.5 * vnoise(q * 0.035) + 0.05 * vnoise(q * 0.9);
  for (int i = 0; i < ${TOUCHES}; i++) {
    if (i >= uTouches) break;
    vec4 t = uTouch[i];
    float d = length(q - t.xy);
    float f = d < t.w
      ? t.z + t.w - sqrt(t.w * t.w - d * d)
      : t.z + t.w + (d - t.w) * 3.0;
    h = smin(h, f, 0.6);
  }
  return max(h, 0.0);
}

float sheetSdf(vec2 q) {
  vec2 e = abs(q - uSize * 0.5) - (uSize * 0.5 - 2.5);
  float box = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 2.5;
  // the cut edge is a blade's, not a ruler's
  return box + (vnoise(q * 0.13) - 0.5) * 1.1;
}

vec2 toLocal(vec2 v) { return vec2(uRot.x * v.x + uRot.y * v.y, -uRot.y * v.x + uRot.x * v.y); }
vec2 toStage(vec2 v) { return vec2(uRot.x * v.x - uRot.y * v.y, uRot.y * v.x + uRot.x * v.y); }

vec3 back(vec2 p) { return texture(uBack, p / uStage).rgb; }

// a softbox seen in the film: a rectangle round the light's own direction
float softbox(vec3 r, vec3 l, vec2 half_) {
  float c = dot(r, l);
  if (c <= 0.0) return 0.0;
  vec3 t1 = normalize(cross(l, vec3(0.0, 0.0, 1.0)));
  vec3 t2 = cross(t1, l);
  vec2 uv = vec2(dot(r, t1), dot(r, t2)) / c;
  vec2 edge = 1.0 - smoothstep(half_ * 0.8, half_, abs(uv));
  return edge.x * edge.y;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 q = toLocal(p - uCenter) + uSize * 0.5;
  vec3 key = normalize(KEY);
  vec3 fill = normalize(FILL);
  vec2 toLight = toLocal(normalize(key.xy));
  float aa = 0.8 / uDpr;

  // the sheet lies a hair off the box, and further while it is being carried
  float lift = 1.4 + uLift * 12.0;
  float spread = 1.2 + uLift * 7.0;
  float shade = 1.0 - smoothstep(-spread, spread, sheetSdf(q + toLight * lift));
  float sdf = sheetSdf(q);
  float inside = 1.0 - smoothstep(-aa, aa, sdf);
  vec3 bare = back(p) * (1.0 - shade * (0.09 + uLift * 0.07));
  if (inside <= 0.0) {
    outColor = vec4(bare, 1.0);
    return;
  }

  float e = 0.5;
  float h0 = height(q);
  float hx = height(q + vec2(e, 0.0));
  float hy = height(q + vec2(0.0, e));
  vec2 g = toStage(vec2(hx - h0, hy - h0) / e);
  vec3 n = normalize(vec3(-g, 1.0));

  Cell b = nearest(q);
  bool inDome = b.d < b.a;
  float top = b.a * RISE;
  float lens = inDome ? clamp(h0 / top, 0.0, 1.3) : 0.0;
  float popped = inDome ? b.st.y : 0.0;
  float slack = inDome ? b.st.z : 0.0;

  // the box under the film, lit by what the domes do to the light
  // the film itself takes a little of the light
  float light = 0.94;
  vec3 spot = vec3(0.0);
  Cell s = nearest(q + toLight * b.a * 0.4);
  if (s.d < s.a) {
    float r = s.d / s.a;
    float stand = s.st.x * (1.0 - s.st.y);
    float ring = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.04, r));
    light -= 0.11 * ring * stand + 0.04 * s.st.y * vnoise((q - s.c) * 0.7);
    spot = vec3(1.0, 0.94, 0.82) * 0.07 * pow(1.0 - r * r, 3.0) * stand;
  }

  // seen through the film: pulled toward the dome's middle and bent by its slope
  vec2 offset = -g * 1.5 - toStage(q - b.c) * 0.08 * lens;
  vec3 under = vec3(
    back(p + offset * 0.92).r,
    back(p + offset).g,
    back(p + offset * 1.09).b
  ) * light + spot;

  float cosT = clamp(n.z, 0.0, 1.0);
  // two surfaces, front and back of the film
  float fresnel = min(1.0, 1.9 * (0.04 + 0.96 * pow(1.0 - cosT, 5.0)));
  vec3 r = vec3(2.0 * cosT * n.xy, 2.0 * cosT * cosT - 1.0);
  vec3 room = vec3(0.975, 0.98, 0.985) * (0.9 + 0.1 * r.z);
  vec3 env = room
    + vec3(1.0, 0.99, 0.97) * 13.0 * softbox(r, key, vec2(0.34, 0.21))
    + vec3(0.92, 0.96, 1.0) * 4.0 * softbox(r, fill, vec2(0.2, 0.32))
    + vec3(1.0) * 2.2 * pow(max(dot(r, key), 0.0), 24.0);

  float haze = 0.03 + 0.34 * pow(1.0 - cosT, 1.4) + 0.15 * popped + 0.1 * slack;
  vec3 film = mix(under * vec3(0.982, 0.99, 0.995), vec3(0.95, 0.965, 0.975), haze);
  vec3 col = film * (1.0 - fresnel) + env * fresnel;

  // the weld round each dome, where the two layers were sealed
  if (b.d < b.a * 1.12) {
    float w = (b.d - b.a) / 0.9;
    col = mix(col, vec3(0.97, 0.98, 0.985), 0.16 * exp(-w * w));
  }
  // the cut edge catches the light
  col += 0.22 * exp(-sdf * sdf * 1.6);

  if (uFocus.w > 0.0) {
    float ring = abs(length(q - uFocus.xy) - uFocus.z);
    col = mix(col, uRing, (1.0 - smoothstep(0.6, 1.3, ring)) * uFocus.w);
  }

  // a highlight hotter than white rolls off rather than clipping flat
  col = col / (1.0 + max(col - 0.92, 0.0) * 1.4);
  outColor = vec4(mix(bare, col, inside), 1.0);
}
`;

const UNIFORMS = [
  "uBack",
  "uCells",
  "uRes",
  "uDpr",
  "uStage",
  "uCenter",
  "uRot",
  "uSize",
  "uPitch",
  "uGrid",
  "uTouch",
  "uTouches",
  "uFocus",
  "uRing",
  "uLift",
] as const;

export interface Film {
  gl: WebGL2RenderingContext;
  back: WebGLTexture;
  cells: WebGLTexture;
  u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
}

function shader(
  gl: WebGL2RenderingContext,
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

/** compiles the stage onto a context, or null when the context cannot run it */
export function createFilm(gl: WebGL2RenderingContext): Film | null {
  const vs = shader(gl, gl.VERTEX_SHADER, VERT);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  const back = gl.createTexture();
  const cells = gl.createTexture();
  if (!vs || !fs || !program || !back || !cells) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call that happens to start with "use", not a React hook
  gl.useProgram(program);

  // one triangle that covers the viewport
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

  const u = {} as Film["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  gl.uniform1i(u.uBack, 0);
  gl.uniform1i(u.uCells, 1);

  // a float texture is read with texelFetch only, so it wants no filtering
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, cells);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { gl, back, cells, u };
}

/** hand the shader a freshly drawn box */
export function uploadBack(
  { gl, back }: Film,
  source: HTMLCanvasElement,
): void {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, back);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** every bubble's two texels, `[x, y, a, seed]` then `[height, fallen, slack, 0]` */
export const CELLS = new Float32Array(COLS * 2 * ROWS * 4);

export interface Frame {
  width: number;
  height: number;
  dpr: number;
  stageW: number;
  stageH: number;
  cx: number;
  cy: number;
  cos: number;
  sin: number;
  w: number;
  h: number;
  pitch: number;
  x0: number;
  y0: number;
  /** each fingertip as `x, y, z, r` in sheet px */
  touches: Float32Array;
  count: number;
  /** the focused bubble as `x, y, r, on` */
  focus: [number, number, number, number];
  ring: [number, number, number];
  lift: number;
}

export function drawFilm({ gl, u, cells }: Film, f: Frame): void {
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, cells);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    COLS * 2,
    ROWS,
    0,
    gl.RGBA,
    gl.FLOAT,
    CELLS,
  );
  gl.viewport(0, 0, f.width, f.height);
  gl.uniform2f(u.uRes, f.width, f.height);
  gl.uniform1f(u.uDpr, f.dpr);
  gl.uniform2f(u.uStage, f.stageW, f.stageH);
  gl.uniform2f(u.uCenter, f.cx, f.cy);
  gl.uniform2f(u.uRot, f.cos, f.sin);
  gl.uniform2f(u.uSize, f.w, f.h);
  gl.uniform1f(u.uPitch, f.pitch);
  gl.uniform2f(u.uGrid, f.x0, f.y0);
  gl.uniform4fv(u.uTouch, f.touches);
  gl.uniform1i(u.uTouches, f.count);
  gl.uniform4f(u.uFocus, ...f.focus);
  gl.uniform3f(u.uRing, ...f.ring);
  gl.uniform1f(u.uLift, f.lift);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
