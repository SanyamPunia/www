import { PACK } from "./cards";
import { CRIMP, H, type Point, TEAR, W } from "./pack";
import { CRINKLE, GRAIN } from "./texture";

/*
 * The strip above the tear line, drawn in WebGL 2 so it can peel in three
 * dimensions. Everything else on the pack is DOM. The strip is the one part
 * that has to bend, show its underside and catch the light as it turns, and a
 * clipped box can only turn flat in its own plane.
 *
 * The strip is a mesh of 120 by 10 quads over the pack's top 50px, in the
 * pack's own pixels. The vertex shader peels the part behind the tear front
 * round a cylinder standing on the front, the way a strip of foil comes away
 * from a seam, then turns it up in the pack's plane, tumbles it about its own
 * length once it is free, and carries it off. The fragment shader paints the
 * foil to match the DOM skin it continues, cuts the serrated top and the torn
 * bottom, prints the perforation where the strip still holds, and lights the
 * lot from the pointer. The underside is the silver film.
 *
 * A second program draws the flecks of foil the tear throws off, as points.
 */

/** the eye's distance from the pack, in px, for the strip's perspective */
export const PERSPECTIVE = 2000;

/** how far the canvas reaches past the pack, so a strip in flight stays on it */
export const REACH = 280;

/** the canvas, in pack pixels */
export const FRAME = {
  x: -REACH,
  y: -REACH,
  w: W + REACH * 2,
  h: H + REACH,
} as const;

/** the strip's mesh covers the top of the pack down past the deepest tooth */
const DEPTH = TEAR + 4;
const NX = 120;
const NY = 10;

export interface StripState {
  /** the tear's front, in pack px */
  front: number;
  /** 1 when the tear runs from the left edge, -1 from the right */
  dir: number;
  /** where the torn piece turns in the pack's plane, in pack px */
  pivot: readonly [number, number];
  /** how far round the curl the strip has gone, in radians */
  curl: number;
  /** the curl's radius, in px */
  radius: number;
  /** the turn in the pack's plane, in radians, clockwise */
  turn: number;
  /** the free strip's turn about its own length, in radians */
  tumble: number;
  /** whether the tear has run its length and nothing holds the strip */
  free: boolean;
  fly: readonly [number, number];
  opacity: number;
  /** the pointer, in pack px, which is where the light is */
  light: readonly [number, number];
}

export interface Fleck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  /** 0 is the film's silver and 1 the print's violet */
  hue: number;
}

const VERT = `#version 300 es
in vec2 a_pos;
uniform float u_front, u_dir, u_curl, u_radius, u_turn, u_tumble, u_free;
uniform vec2 u_pivot, u_fly;
uniform vec4 u_frame;
out vec2 v_pos;
out vec3 v_n;
out float v_torn;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

void main() {
  vec3 p = vec3(a_pos, 0.0);
  vec3 n = vec3(0.0, 0.0, 1.0);
  float d = u_dir * (u_front - a_pos.x);
  // once the tear has run its length the whole strip is free. Without this
  // the column on the far edge, where d is exactly 0, stayed on the pack and
  // stretched the strip back to it like a string as it flew
  bool torn = d > 0.0 || u_free > 0.5;
  v_torn = torn ? 1.0 : 0.0;

  if (torn) {
    // round a cylinder standing on the front, then straight on along the
    // tangent once the curl is used up
    float arc = u_curl * u_radius;
    float a = min(d, arc) / u_radius;
    float along, z;
    if (d <= arc) {
      along = u_radius * sin(a);
      z = u_radius * (1.0 - cos(a));
    } else {
      float t = d - arc;
      along = u_radius * sin(u_curl) + t * cos(u_curl);
      z = u_radius * (1.0 - cos(u_curl)) + t * sin(u_curl);
    }
    p.x = u_front - u_dir * along;
    p.z = z;
    n = vec3(u_dir * sin(a), 0.0, cos(a));

    // the turn in the plane comes on over the first 40px behind the front,
    // so the strip bends away from the seam rather than shearing off it
    float k = max(smoothstep(0.0, 40.0, d), u_free);
    mat2 r = rot(u_dir * u_turn * k);
    p.xy = u_pivot + r * (p.xy - u_pivot);
    n.xy = r * n.xy;

    // a free strip tumbles about its own length as it falls
    float ty = p.y - u_pivot.y;
    float c = cos(u_tumble), s = sin(u_tumble);
    p = vec3(p.x, u_pivot.y + ty * c - p.z * s, ty * s + p.z * c);
    n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);

    p.xy += u_fly;
  }

  v_pos = a_pos;
  v_n = n;

  // a weak perspective about the pack's centre, so the near side of the curl
  // is drawn a little larger than the far side
  vec2 centre = vec2(${W / 2}.0, ${H / 2}.0);
  float s = ${PERSPECTIVE}.0 / (${PERSPECTIVE}.0 - p.z);
  vec2 q = centre + (p.xy - centre) * s;
  vec2 ndc = (q - u_frame.xy) / u_frame.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, -p.z / 4000.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_pos;
in vec3 v_n;
in float v_torn;
uniform float u_jag[27];
uniform float u_opacity;
uniform vec2 u_light;
uniform sampler2D u_crinkle;
uniform sampler2D u_grain;
out vec4 o;

const vec3 FROM = vec3(${rgb(PACK.from)});
const vec3 TO = vec3(${rgb(PACK.to)});
const vec3 SILVER = vec3(${rgb(PACK.inside)});
const vec3 SILVER_SHADE = vec3(${rgb(PACK.insideShade)});

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float jagAt(float x) {
  float step = ${W}.0 / 26.0;
  float fi = clamp(floor(x / step), 0.0, 25.0);
  int i = int(fi);
  float y0 = 0.0, y1 = 0.0;
  for (int k = 0; k < 26; k++) {
    if (k == i) { y0 = u_jag[k]; y1 = u_jag[k + 1]; }
  }
  return mix(y0, y1, clamp(x / step - fi, 0.0, 1.0));
}

// the heat seal's teeth along the top: 5px apart, 2.2px deep
float toothAt(float x) {
  float k = x / 5.0;
  float f = fract(k);
  float odd = mod(floor(k), 2.0);
  float y0 = odd > 0.5 ? 0.0 : 2.2;
  float y1 = odd > 0.5 ? 2.2 : 0.0;
  return mix(y0, y1, f);
}

// CSS interpolates gradient stops in premultiplied colour, so these do too,
// or the stops between white and black would pass through grey
vec4 pm(vec4 c) {
  return vec4(c.rgb * c.a, c.a);
}

vec4 stop(vec4 a, vec4 b, float t) {
  return mix(pm(a), pm(b), clamp(t, 0.0, 1.0));
}

vec3 over(vec3 c, vec4 p) {
  return c * (1.0 - p.a) + p.rgb;
}

// the pillow across the pack, the same stops as the DOM skin's gradient
vec4 pillow(float u) {
  vec4 k0 = vec4(0.0, 0.0, 0.0, 0.3), k1 = vec4(1.0, 1.0, 1.0, 0.14);
  vec4 k2 = vec4(1.0, 1.0, 1.0, 0.16), k3 = vec4(1.0, 1.0, 1.0, 0.06);
  vec4 k4 = vec4(0.0, 0.0, 0.0, 0.08), k5 = vec4(0.0, 0.0, 0.0, 0.26);
  vec4 k6 = vec4(0.0, 0.0, 0.0, 0.5);
  if (u < 0.05) return stop(k0, k1, u / 0.05);
  if (u < 0.22) return stop(k1, k2, (u - 0.05) / 0.17);
  if (u < 0.48) return stop(k2, k3, (u - 0.22) / 0.26);
  if (u < 0.72) return stop(k3, k4, (u - 0.48) / 0.24);
  if (u < 0.9) return stop(k4, k5, (u - 0.72) / 0.18);
  return stop(k5, k6, (u - 0.9) / 0.1);
}

// the W3C blend modes the DOM skin uses
vec3 softLight(vec3 d, vec3 s) {
  vec3 dd = mix(sqrt(d), ((16.0 * d - 12.0) * d + 4.0) * d, step(d, vec3(0.25)));
  return mix(d + (2.0 * s - 1.0) * (dd - d), d - (1.0 - 2.0 * s) * d * (1.0 - d), step(s, vec3(0.5)));
}

vec3 overlay(vec3 d, vec3 s) {
  return mix(1.0 - 2.0 * (1.0 - d) * (1.0 - s), 2.0 * d * s, step(d, vec3(0.5)));
}

// the skin's specular streak: two bands across a 100 degree gradient, placed
// by the light's x, in px along the gradient line as CSS measures them
float streak(vec2 p, float gx) {
  vec2 dir = vec2(0.98481, 0.17365);
  float len = ${W}.0 * 0.98481 + ${H}.0 * 0.17365;
  float s = dot(p - vec2(${W / 2}.0, ${H / 2}.0), dir) + len * 0.5 - gx;
  float a = 0.0;
  if (s > -40.0 && s < -14.0) a = mix(0.0, 0.1, (s + 40.0) / 26.0);
  else if (s >= -14.0 && s < -2.0) a = mix(0.1, 0.4, (s + 14.0) / 12.0);
  else if (s >= -2.0 && s <= 2.0) a = 0.4;
  else if (s > 2.0 && s < 12.0) a = mix(0.4, 0.1, (s - 2.0) / 10.0);
  else if (s >= 12.0 && s < 34.0) a = mix(0.1, 0.0, (s - 12.0) / 22.0);
  if (s > 50.0 && s < 58.0) a = max(a, mix(0.0, 0.16, (s - 50.0) / 8.0));
  else if (s >= 58.0 && s < 68.0) a = max(a, mix(0.16, 0.0, (s - 58.0) / 10.0));
  return a;
}

void main() {
  float x = v_pos.x, y = v_pos.y;

  // cut the serrated top and the torn bottom, a pixel soft at each
  float jag = jagAt(x);
  float alpha = clamp(jag - y + 0.5, 0.0, 1.0) * clamp(y - toothAt(x) + 0.5, 0.0, 1.0);
  if (alpha <= 0.0) discard;

  vec3 n = normalize(v_n);
  if (!gl_FrontFacing) n = -n;

  // a point light a little above the pointer, as on the DOM skin
  vec3 l = normalize(vec3(u_light - v_pos, 150.0));
  float diffuse = max(dot(n, l), 0.0);
  float flat_ = max(l.z, 0.001);
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), 40.0);

  vec3 c;
  if (gl_FrontFacing) {
    // the skin's layers, in the skin's order and with its blend modes, so
    // the strip continues the body below it with no seam: the print, the
    // vertical shade, the pillow, the creases and the grain. The creases
    // and grain are the same SVG noise the skin uses, loaded as textures
    vec2 dir = vec2(0.17365, 0.98481);
    float len = ${W}.0 * 0.17365 + ${H}.0 * 0.98481;
    float t = 0.5 + dot(v_pos - vec2(${W / 2}.0, ${H / 2}.0), dir) / len;
    c = mix(FROM, TO, t);
    c = over(c, stop(vec4(1.0, 1.0, 1.0, 0.1), vec4(0.0, 0.0, 0.0, 0.26), y / ${H}.0));
    c = over(c, pillow(x / ${W}.0));
    vec4 crinkle = texture(u_crinkle, v_pos / 320.0);
    c = mix(c, softLight(c, crinkle.rgb), 0.6 * crinkle.a);
    vec4 grain = texture(u_grain, v_pos / 240.0);
    c = mix(c, overlay(c, grain.rgb), 0.3 * grain.a);

    // the seal's ridges, and the pinch below it
    if (y < ${CRIMP}.0) {
      float m = mod(x, 4.0);
      if (m < 1.0) c = over(c, pm(vec4(1.0, 1.0, 1.0, 0.22)));
      else if (m < 2.0) c = over(c, pm(vec4(0.0, 0.0, 0.0, 0.28)));
    } else if (y < ${CRIMP + 3}.0) {
      c = over(c, pm(vec4(0.0, 0.0, 0.0, 0.32 * (1.0 - (y - ${CRIMP}.0) / 3.0))));
    } else if (y < ${CRIMP + 12}.0) {
      c = over(c, pm(vec4(1.0, 1.0, 1.0, 0.06 * (1.0 - (y - ${CRIMP + 3}.0) / 9.0))));
    }

    // the perforation, printed along the line where the strip still holds
    if (v_torn < 0.5 && jag - y < 1.6 && mod(x, 7.0) < 3.0) {
      c = over(c, pm(vec4(1.0, 1.0, 1.0, 0.45)));
    }

    // the skin's light: a soft glow about the pointer and the hard streak
    // 170px circle, white at 0.75 fading out by 70% of it, as the CSS says
    float glow = 0.75 * clamp(1.0 - length(v_pos - u_light) / 119.0, 0.0, 1.0);
    c = mix(c, softLight(c, vec3(1.0)), glow);
    float band = streak(v_pos, u_light.x);
    c = c + band * (1.0 - c);

    // and where the strip bends away from the pack, its own shading on top:
    // by how far the surface has turned from the light, which is 1 on the
    // flat, plus a glint that only a bent surface catches. The ratio is
    // clamped both ways: a face turned from the light went black, and with
    // the light low across the strip a face turned toward it flared blue
    c *= mix(1.0, clamp(diffuse / flat_, 0.5, 1.35), 0.85);
    c += spec * 0.35 * (1.0 - n.z);
  } else {
    // the underside is the bare metallised film
    float g = vnoise(v_pos * 0.6) * 0.5 + hash(floor(v_pos * 1.5)) * 0.5;
    c = mix(SILVER_SHADE, SILVER, 0.6 + diffuse * 0.4);
    c *= 0.94 + g * 0.1;
    c += spec * 0.7;
  }

  // the torn edge shows the film's silver through the print
  float edge = smoothstep(1.8, 0.4, jag - y) * v_torn;
  c = mix(c, SILVER * (0.85 + diffuse * 0.2), edge * 0.85);

  float a = alpha * u_opacity;
  o = vec4(c * a, a);
}`;

const FLECK_VERT = `#version 300 es
in vec4 a_fleck;
in float a_hue;
uniform vec4 u_frame;
uniform float u_px;
out float v_alpha;
out float v_hue;
void main() {
  vec2 ndc = (a_fleck.xy - u_frame.xy) / u_frame.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, -0.9, 1.0);
  gl_PointSize = a_fleck.z * u_px;
  v_alpha = a_fleck.w;
  v_hue = a_hue;
}`;

const FLECK_FRAG = `#version 300 es
precision highp float;
in float v_alpha;
in float v_hue;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  // a fleck is a scrap, not a dot: squared off, and lit on one side
  float box = max(abs(q.x), abs(q.y));
  float a = smoothstep(0.5, 0.36, box) * v_alpha;
  vec3 c = mix(vec3(${rgb(PACK.inside)}), vec3(${rgb(PACK.to)}), v_hue);
  c *= 0.85 + (0.5 - q.y) * 0.4;
  o = vec4(c * a, a);
}`;

function rgb(hex: string): string {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    .map((c) => (c / 255).toFixed(4))
    .join(", ");
}

function compile(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram | null {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vert],
    [gl.FRAGMENT_SHADER, frag],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

export interface Strip {
  draw: (state: StripState, flecks: readonly Fleck[]) => void;
  resize: (pixelsPerPx: number) => void;
  destroy: () => void;
}

/** null where WebGL 2 is not available, and the caller draws a flat strip */
export function createStrip(
  canvas: HTMLCanvasElement,
  jag: readonly Point[],
  onReady: () => void,
): Strip | null {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  });
  if (!gl) return null;
  const strip = compile(gl, VERT, FRAG);
  const fleck = compile(gl, FLECK_VERT, FLECK_FRAG);
  if (!strip || !fleck) return null;

  // the mesh
  const verts = new Float32Array((NX + 1) * (NY + 1) * 2);
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const k = (j * (NX + 1) + i) * 2;
      verts[k] = (i / NX) * W;
      verts[k + 1] = (j / NY) * DEPTH;
    }
  }
  const index = new Uint16Array(NX * NY * 6);
  let n = 0;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      const b = a + 1;
      const c = a + NX + 1;
      const d = c + 1;
      index.set([a, c, b, b, c, d], n);
      n += 6;
    }
  }

  const meshVao = gl.createVertexArray();
  gl.bindVertexArray(meshVao);
  const meshBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(strip, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

  const fleckVao = gl.createVertexArray();
  gl.bindVertexArray(fleckVao);
  const fleckBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fleckBuffer);
  const aFleck = gl.getAttribLocation(fleck, "a_fleck");
  const aHue = gl.getAttribLocation(fleck, "a_hue");
  gl.enableVertexAttribArray(aFleck);
  gl.vertexAttribPointer(aFleck, 4, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(aHue);
  gl.vertexAttribPointer(aHue, 1, gl.FLOAT, false, 20, 16);
  gl.bindVertexArray(null);

  // the skin's noise as textures, rasterised from the same SVG at twice its
  // tile size for a sharp sample. Until one has loaded it is mid grey, which
  // is no change under both blend modes
  const noise = (url: string, tile: number, unit: number) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 128, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = tile * 2;
      c.height = tile * 2;
      c.getContext("2d")?.drawImage(img, 0, 0, tile * 2, tile * 2);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      onReady();
    };
    img.src = url.slice(5, -2);
    return tex;
  };
  const crinkle = noise(CRINKLE, 320, 0);
  const grain = noise(GRAIN, 240, 1);

  const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);
  const su = {
    front: u(strip, "u_front"),
    dir: u(strip, "u_dir"),
    curl: u(strip, "u_curl"),
    radius: u(strip, "u_radius"),
    turn: u(strip, "u_turn"),
    tumble: u(strip, "u_tumble"),
    free: u(strip, "u_free"),
    pivot: u(strip, "u_pivot"),
    fly: u(strip, "u_fly"),
    frame: u(strip, "u_frame"),
    jag: u(strip, "u_jag"),
    opacity: u(strip, "u_opacity"),
    light: u(strip, "u_light"),
    crinkle: u(strip, "u_crinkle"),
    grain: u(strip, "u_grain"),
  };
  const fu = { frame: u(fleck, "u_frame"), px: u(fleck, "u_px") };
  const jagYs = new Float32Array(jag.map(([, y]) => y));
  let scale = 1;

  const resize = (pixelsPerPx: number) => {
    scale = pixelsPerPx;
    canvas.width = Math.round(FRAME.w * scale);
    canvas.height = Math.round(FRAME.h * scale);
  };

  const draw = (s: StripState, flecks: readonly Fleck[]) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.useProgram(strip);
    gl.uniform1f(su.front, s.front);
    gl.uniform1f(su.dir, s.dir);
    gl.uniform1f(su.curl, s.curl);
    gl.uniform1f(su.radius, s.radius);
    gl.uniform1f(su.turn, s.turn);
    gl.uniform1f(su.tumble, s.tumble);
    gl.uniform1f(su.free, s.free ? 1 : 0);
    gl.uniform2f(su.pivot, s.pivot[0], s.pivot[1]);
    gl.uniform2f(su.fly, s.fly[0], s.fly[1]);
    gl.uniform4f(su.frame, FRAME.x, FRAME.y, FRAME.w, FRAME.h);
    gl.uniform1fv(su.jag, jagYs);
    gl.uniform1f(su.opacity, s.opacity);
    gl.uniform2f(su.light, s.light[0], s.light[1]);
    gl.uniform1i(su.crinkle, 0);
    gl.uniform1i(su.grain, 1);
    gl.bindVertexArray(meshVao);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);

    if (flecks.length) {
      gl.disable(gl.DEPTH_TEST);
      // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call, not a React hook
      gl.useProgram(fleck);
      const data = new Float32Array(flecks.length * 5);
      flecks.forEach((f, i) => {
        data.set([f.x, f.y, f.size, Math.min(1, f.life * 2), f.hue], i * 5);
      });
      gl.bindVertexArray(fleckVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, fleckBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.uniform4f(fu.frame, FRAME.x, FRAME.y, FRAME.w, FRAME.h);
      gl.uniform1f(fu.px, scale);
      gl.drawArrays(gl.POINTS, 0, flecks.length);
    }
    gl.bindVertexArray(null);
  };

  // the GL objects go, and not the context: React runs an effect twice in
  // development, and a lost context on the same canvas can never compile again
  const destroy = () => {
    gl.deleteProgram(strip);
    gl.deleteProgram(fleck);
    gl.deleteBuffer(meshBuffer);
    gl.deleteBuffer(indexBuffer);
    gl.deleteBuffer(fleckBuffer);
    gl.deleteVertexArray(meshVao);
    gl.deleteVertexArray(fleckVao);
    gl.deleteTexture(crinkle);
    gl.deleteTexture(grain);
  };

  return { draw, resize, destroy };
}

/** a burst of flecks at the tear's front, thrown up and away from the pack */
export function spray(
  out: Fleck[],
  x: number,
  y: number,
  dir: number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    out.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 3,
      vx: (dir * (20 + Math.random() * 70) + (Math.random() - 0.5) * 60) * 1,
      vy: -(40 + Math.random() * 110),
      size: 1.4 + Math.random() * 2.2,
      life: 0.5 + Math.random() * 0.5,
      hue: Math.random() < 0.6 ? 0 : 1,
    });
  }
}

/** gravity and drag, and the dead ones dropped */
export function stepFlecks(flecks: Fleck[], dt: number): void {
  for (let i = flecks.length - 1; i >= 0; i--) {
    const f = flecks[i];
    f.vy += 520 * dt;
    f.vx *= 1 - 1.6 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    if (f.life <= 0) flecks.splice(i, 1);
  }
}
