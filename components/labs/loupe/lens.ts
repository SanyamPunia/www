/*
 * The stage, as one fragment shader: the print, the light falling on it, and
 * the glass over it.
 *
 * - **The print is lit before it is seen.** `paper(x)` is the map at a point
 *   times the light reaching that point: the frame's and the handle's shadow,
 *   the dim disc the lens took light from, and the caustic it focused that
 *   light into. The view through the glass samples `paper()` too, so the
 *   caustic is magnified with the print under it, as it is through a real lens.
 * - **The glass bends the print by radius.** A pixel at distance `rho` of the
 *   rim samples the print at `d / (m * (1 + k * rho^2))`, which is pincushion
 *   distortion: the rim magnifies more than the middle. Red, green and blue each
 *   take a slightly different `m`, so the rim fringes.
 * - **The frame and the handle are lit solids**, a torus and a capsule, shaded
 *   from a normal built across their own profile.
 * - **Every texture read passes its own gradients**, through `textureGrad`. A
 *   read inside the glass is a minified read 1/m the size, and an implicit
 *   derivative across the rim's branch would pick the wrong mip there.
 *
 * Everything is in device pixels, y down, so the component hands it the same
 * numbers it positions the DOM with.
 */

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uMap;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uC;
uniform float uR;
uniform float uRim;
uniform float uMag;
uniform float uDist;
uniform float uCA;
uniform vec2 uShadow;
uniform float uBlur;
uniform float uCaustic;
uniform float uGain;
uniform vec2 uDir;
uniform float uHandle;
uniform float uGrip;
uniform float uHover;

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

// the handle runs from just inside the frame out along uDir
vec2 handleA() { return uDir * (uR + uRim * 0.5); }
vec2 handleB() { return uDir * (uR + uRim + uHandle); }

float sdSegment(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// the solid parts that cast a shadow, as a signed distance from q, which is
// relative to the glass's centre
float solid(vec2 q) {
  float d = length(q);
  float ring = abs(d - (uR + uRim * 0.5)) - uRim * 0.5;
  float h;
  float grip = sdSegment(q, handleA(), handleB(), h) - uGrip;
  return min(ring, grip);
}

// the print at x, under the light that reaches it. s is how much one screen
// pixel covers of the print, 1 outside the glass and 1/m inside it
vec3 paper(vec2 x, float s) {
  vec2 uv = x / uRes;
  vec2 dx = vec2(s / uRes.x, 0.0);
  vec2 dy = vec2(0.0, s / uRes.y);
  vec3 ink = textureGrad(uMap, uv, dx, dy).rgb;

  // grain at a fixed size on the paper, so it magnifies with the print
  vec2 g = x / uDpr;
  float grain = vnoise(g * 1.1) * 0.55 + vnoise(g * 3.7 + 9.0) * 0.45;
  ink *= 0.968 + 0.05 * grain;

  vec2 q = x - uC - uShadow;
  float occ = 1.0 - smoothstep(-uBlur, uBlur, solid(q));
  float dl = length(q);
  float disc = 1.0 - smoothstep(uR - uBlur, uR + uBlur, dl);
  float cb = max(1.5 * uDpr, uBlur * 0.7);
  float core = 1.0 - smoothstep(uCaustic - cb, uCaustic + cb, dl);
  float light = mix(1.0, mix(0.8, uGain, core), disc);
  light *= 1.0 - 0.34 * occ;

  vec3 col = ink * min(light, 1.0);
  // a focused spot is warmer and brighter than the paper, never whiter
  col += vec3(1.0, 0.9, 0.7) * max(light - 1.0, 0.0) * 0.28;
  return col;
}

// one lamp, above and to the upper left, y down
const vec3 L = vec3(-0.5, -0.72, 0.9);

vec3 shade(vec3 n, vec3 base, float gloss) {
  vec3 l = normalize(L);
  float lam = max(dot(n, l), 0.0);
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), gloss);
  return base * (0.38 + 0.8 * lam) + vec3(spec * 0.55);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = p - uC;
  float r = length(d);
  float aa = 1.0;

  vec3 col = paper(p, 1.0);

  // the handle, under the frame where the two meet
  float h;
  vec2 a = handleA();
  vec2 b = handleB();
  float hd = sdSegment(d, a, b, h);
  float handle = 1.0 - smoothstep(uGrip - aa, uGrip, hd);
  if (handle > 0.0) {
    vec2 axis = normalize(b - a);
    vec2 side = vec2(-axis.y, axis.x);
    float t = clamp(dot(d - mix(a, b, h), side) / uGrip, -1.0, 1.0);
    vec3 n = normalize(vec3(side * t, sqrt(max(1.0 - t * t, 0.0)) + 0.1));
    // a brass ferrule where the handle meets the frame, then turned wood
    float ferrule = 1.0 - smoothstep(0.17, 0.19, h);
    vec3 wood = mix(vec3(0.16, 0.1, 0.07), vec3(0.2, 0.13, 0.09), vnoise(vec2(h * 40.0, t * 2.0)));
    vec3 brass = vec3(0.62, 0.48, 0.24);
    vec3 base = mix(wood, brass, ferrule);
    vec3 lit = shade(n, base * (1.0 + uHover * 0.12), mix(18.0, 40.0, ferrule));
    // the end of the handle is rounded, a little darker as it turns away
    lit *= 1.0 - 0.18 * smoothstep(0.9, 1.0, h);
    col = mix(col, lit, handle);
  }

  // the glass
  if (r < uR + aa) {
    float rho = clamp(r / uR, 0.0, 1.0);
    float rho2 = rho * rho;
    float m = uMag * (1.0 + uDist * rho2);
    float ca = uCA * rho2;
    vec3 view = vec3(
      paper(uC + d / (m * (1.0 - ca)), 1.0 / m).r,
      paper(uC + d / m, 1.0 / m).g,
      paper(uC + d / (m * (1.0 + ca)), 1.0 / m).b
    );
    // a faint cool tint, and a darker edge where the glass is thickest
    view *= vec3(0.985, 0.992, 1.0);
    view *= 1.0 - 0.14 * smoothstep(0.62, 1.0, rho);

    // the sky in the glass: a soft crescent along the upper left of the rim
    // and a window's reflection off the upper left of the face
    vec2 n = d / uR;
    float facing = dot(normalize(n + 1e-4), normalize(vec2(-0.55, -0.83)));
    float crescent = smoothstep(0.7, 0.95, rho) * (1.0 - smoothstep(0.95, 1.0, rho))
      * smoothstep(0.1, 0.9, facing);
    vec2 w = (n - vec2(-0.36, -0.4)) * vec2(1.0, 1.6);
    float window = exp(-dot(w, w) / 0.018);
    float sheen = 0.04 * (1.0 - smoothstep(-1.0, 1.0, n.y + n.x));
    view = mix(view, vec3(1.0), crescent * 0.4 + window * 0.22 + sheen);

    float glass = 1.0 - smoothstep(uR - aa, uR, r);
    col = mix(col, view, glass);
  }

  // the frame: a torus, lit across its own profile
  float rd = r - uR;
  float ring = smoothstep(-aa, 0.0, rd) * (1.0 - smoothstep(uRim - aa, uRim, rd));
  if (ring > 0.0) {
    float t = clamp(rd / uRim, 0.0, 1.0) * 2.0 - 1.0;
    vec2 radial = d / max(r, 1e-4);
    vec3 n = normalize(vec3(radial * t, sqrt(max(1.0 - t * t, 0.0)) + 0.12));
    vec3 base = vec3(0.11, 0.105, 0.1) * (1.0 + uHover * 0.35);
    vec3 lit = shade(n, base, 30.0);
    col = mix(col, lit, ring);
  }

  // a little dither, since the caustic's soft edge bands on 8 bits
  float dn = hash(gl_FragCoord.xy) - 0.5;
  col += dn * (1.5 / 255.0);

  outColor = vec4(col, 1.0);
}
`;

const UNIFORMS = [
  "uMap",
  "uRes",
  "uDpr",
  "uC",
  "uR",
  "uRim",
  "uMag",
  "uDist",
  "uCA",
  "uShadow",
  "uBlur",
  "uCaustic",
  "uGain",
  "uDir",
  "uHandle",
  "uGrip",
  "uHover",
] as const;

export interface Lens {
  gl: WebGL2RenderingContext;
  texture: WebGLTexture;
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
export function createLens(gl: WebGL2RenderingContext): Lens | null {
  const vs = shader(gl, gl.VERTEX_SHADER, VERT);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  const texture = gl.createTexture();
  if (!vs || !fs || !program || !texture) return null;
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

  const u = {} as Lens["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  gl.uniform1i(u.uMap, 0);
  return { gl, texture, u };
}

/**
 * Hand the shader a freshly drawn print. Mipmapped, since outside the glass a
 * print several times the stage's size is read at a fraction of it, and
 * a microprint border read without mips shimmers as the glass moves.
 */
export function uploadMap(
  { gl, texture }: Lens,
  source: HTMLCanvasElement,
): void {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** everything a frame hands the shader, in device pixels where it is a length */
export interface Frame {
  width: number;
  height: number;
  dpr: number;
  cx: number;
  cy: number;
  r: number;
  rim: number;
  mag: number;
  distortion: number;
  chroma: number;
  shadowX: number;
  shadowY: number;
  blur: number;
  caustic: number;
  gain: number;
  dirX: number;
  dirY: number;
  handle: number;
  grip: number;
  hover: number;
}

export function drawLens({ gl, u }: Lens, f: Frame): void {
  gl.viewport(0, 0, f.width, f.height);
  gl.uniform2f(u.uRes, f.width, f.height);
  gl.uniform1f(u.uDpr, f.dpr);
  gl.uniform2f(u.uC, f.cx, f.cy);
  gl.uniform1f(u.uR, f.r);
  gl.uniform1f(u.uRim, f.rim);
  gl.uniform1f(u.uMag, f.mag);
  gl.uniform1f(u.uDist, f.distortion);
  gl.uniform1f(u.uCA, f.chroma);
  gl.uniform2f(u.uShadow, f.shadowX, f.shadowY);
  gl.uniform1f(u.uBlur, f.blur);
  gl.uniform1f(u.uCaustic, f.caustic);
  gl.uniform1f(u.uGain, f.gain);
  gl.uniform2f(u.uDir, f.dirX, f.dirY);
  gl.uniform1f(u.uHandle, f.handle);
  gl.uniform1f(u.uGrip, f.grip);
  gl.uniform1f(u.uHover, f.hover);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
