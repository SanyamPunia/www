/*
 * The orb, as one fragment shader over the whole stage.
 *
 * Every pixel asks three questions: how far it is from the orb's centre, where
 * the orb's rim is in its direction, and, if it is inside, which part of a
 * sphere of moving fluid it is looking at. Nothing outside the shader knows
 * what the orb looks like. The component only hands it a dozen numbers a frame.
 *
 * - **The rim wobbles.** Its radius is two octaves of noise around the circle,
 *   scaled by how loud the orb is, so speaking and listening deform the edge
 *   and idle barely does.
 * - **The inside is a sphere.** A pixel at `q` on the disc sits at
 *   `(q, sqrt(1 - |q|^2))` on the front of a unit sphere, and the fluid is
 *   sampled at that point in 3D. So the flow bunches toward the rim the way a
 *   texture on a ball does, which is most of what makes a flat disc read round.
 * - **The fluid is domain-warped fbm**: two fbm fields displace the input to a
 *   third. That is the technique behind most of paper.design's flowing
 *   gradients, and it is what turns noise into something that looks poured.
 * - **The palette is three tones and a halo**, mixed by the component from the
 *   state the orb is in, so a state change is a colour change with no branch
 *   in here.
 *
 * Output is premultiplied alpha over a transparent canvas, so the stage behind
 * the canvas is the page's own and the halo composites onto it.
 *
 * `snoise` is Ashima Arts' 3D simplex noise by Ian McEwan and Stefan
 * Gustavson, MIT licensed, from github.com/ashima/webgl-noise.
 */

export const RIPPLES = 6;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform float uWobbleClock;
uniform float uWobble;
uniform float uRot;
uniform float uTwist;
uniform float uEnergy;
uniform float uSpeak;
uniform float uHover;
uniform float uClock;
uniform vec2 uPointer;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uHalo;
uniform float uGlow;
uniform vec4 uRipple[${RIPPLES}];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// three octaves at a falling gain: enough for the edges of a cloud, too few
// for the speckle that makes a sphere of noise read as a marble
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    s += a * snoise(p);
    p = p * 1.9 + vec3(1.7, 9.2, 3.1);
    a *= 0.45;
  }
  return s;
}

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uRadius;
  float d = length(p);
  if (d > 2.6) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // the rim, as a radius in this pixel's direction
  vec2 dir = p / max(d, 1e-4);
  float wob = 0.6 * snoise(vec3(dir * 1.1, uWobbleClock * 0.55))
    + 0.4 * snoise(vec3(dir * 2.4 + 4.0, uWobbleClock * 1.3));

  // ripples: a ring of light leaving a point, and a bump where it meets the rim
  float rip = 0.0;
  float ripRim = 0.0;
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 r = uRipple[i];
    if (r.w <= 0.0) continue;
    float front = r.z * 1.9;
    float fall = exp(-r.z * 2.4) * r.w;
    float inside = length(p - r.xy) - front;
    rip += exp(-inside * inside / 0.03) * fall;
    float atRim = length(dir - r.xy) - front;
    ripRim += exp(-atRim * atRim / 0.05) * fall;
  }

  float edge = 1.0 + wob * uWobble + ripRim * 0.045;
  float aa = 1.4 / uRadius;
  float body = 1.0 - smoothstep(edge - aa, edge + aa, d);

  vec3 col = vec3(0.0);
  if (body > 0.0) {
    vec2 q = p / edge;
    float r2 = min(dot(q, q), 1.0);
    float z = sqrt(1.0 - r2);

    // a uniform turn plus a twist that is tightest at the middle: thinking
    // whirls the inside like water round a drain
    float tw = uRot + uTwist * (1.0 - r2);
    float cs = cos(tw);
    float sn = sin(tw);
    vec3 n = vec3(cs * q.x - sn * q.y, sn * q.x + cs * q.y, z);

    // the pointer drags the fluid toward itself, most at the front
    vec3 s = n;
    s.xy -= uPointer * uHover * 0.38 * z;

    vec3 c = s * 0.85 + vec3(0.0, 0.0, uTime * 0.06);
    vec2 w = vec2(
      fbm(c + vec3(0.0, 0.0, uTime * 0.09)),
      fbm(c + vec3(5.2, 1.3, -uTime * 0.07))
    );
    float f = fbm(c + vec3(w * 1.4, uTime * 0.1));
    float t = clamp(f * 1.05 + 0.56 + rip * 0.3, 0.0, 1.0);

    // wide ramps, so one tone pours into the next rather than meeting it
    vec3 base = mix(uDeep, uMid, smoothstep(0.0, 0.6, t));
    base = mix(base, uLight, smoothstep(0.45, 1.0, t));

    // one light from the upper left, so the lower right falls into the deep tone
    vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
    float lam = max(dot(n, L), 0.0);
    base = mix(uDeep * 0.82, base, 0.55 + 0.45 * lam);

    // a bright core that swells as it speaks
    base = mix(base, uLight, (0.16 + 0.42 * uSpeak) * z * z * z);

    // the rim catches the halo, which is what keeps it from reading as a cut
    float fres = pow(1.0 - z, 2.4);
    base = mix(base, uLight, fres * 0.6);

    // a wide soft highlight, never a hard specular, since this is not glass
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 14.0);
    base += vec3(spec * 0.3);

    base += uLight * rip * 0.22;
    col = base;
  }

  // the halo, and the ring that stands off the rim while it listens
  float beyond = max(d - edge, 0.0);
  float halo = exp(-beyond * 5.0) * uGlow;
  float ringR = edge + 0.17 + 0.025 * sin(uClock * 4.5);
  float ringD = d - ringR;
  float ring = exp(-ringD * ringD / 0.0009) * uEnergy * 0.32;
  float glowA = clamp(halo * 0.55 + ring, 0.0, 1.0) * (1.0 - body);

  // A little dither on both, since a soft gradient on 8 bits bands. The halo
  // needs it most: a faint colour at a low alpha has only a few steps to
  // spend, and without it the glow is a set of concentric rings.
  float g = fract(sin(dot(gl_FragCoord.xy + fract(uClock) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += g * (2.0 / 255.0);
  glowA = clamp(glowA + g * (1.5 / 255.0) * step(0.0005, glowA), 0.0, 1.0);

  gl_FragColor = vec4(col * body + uHalo * glowA, body + glowA);
}
`;

export interface Orb {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
}

const UNIFORMS = [
  "uCenter",
  "uRadius",
  "uTime",
  "uWobbleClock",
  "uWobble",
  "uRot",
  "uTwist",
  "uEnergy",
  "uSpeak",
  "uHover",
  "uClock",
  "uPointer",
  "uDeep",
  "uMid",
  "uLight",
  "uHalo",
  "uGlow",
  "uRipple",
] as const;

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

/** compiles the orb onto a context, or null when the context cannot run it */
export function createOrb(gl: WebGLRenderingContext): Orb | null {
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

  // one triangle that covers the viewport, which is two fewer vertices than a
  // quad and no seam down its diagonal
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

  const u = {} as Orb["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  return { gl, program, u };
}

/** everything a frame hands the shader, in device pixels where it is a length */
export interface Frame {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
  time: number;
  wobbleClock: number;
  wobble: number;
  rot: number;
  twist: number;
  energy: number;
  speak: number;
  hover: number;
  clock: number;
  pointer: readonly [number, number];
  deep: readonly number[];
  mid: readonly number[];
  light: readonly number[];
  halo: readonly number[];
  glow: number;
  ripples: Float32Array;
}

export function drawOrb({ gl, u }: Orb, f: Frame): void {
  gl.viewport(0, 0, f.width, f.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // gl's y runs up from the bottom, the page's runs down from the top
  gl.uniform2f(u.uCenter, f.cx, f.height - f.cy);
  gl.uniform1f(u.uRadius, f.radius);
  gl.uniform1f(u.uTime, f.time);
  gl.uniform1f(u.uWobbleClock, f.wobbleClock);
  gl.uniform1f(u.uWobble, f.wobble);
  gl.uniform1f(u.uRot, f.rot);
  gl.uniform1f(u.uTwist, f.twist);
  gl.uniform1f(u.uEnergy, f.energy);
  gl.uniform1f(u.uSpeak, f.speak);
  gl.uniform1f(u.uHover, f.hover);
  gl.uniform1f(u.uClock, f.clock);
  gl.uniform2f(u.uPointer, f.pointer[0], f.pointer[1]);
  gl.uniform3f(u.uDeep, f.deep[0], f.deep[1], f.deep[2]);
  gl.uniform3f(u.uMid, f.mid[0], f.mid[1], f.mid[2]);
  gl.uniform3f(u.uLight, f.light[0], f.light[1], f.light[2]);
  gl.uniform3f(u.uHalo, f.halo[0], f.halo[1], f.halo[2]);
  gl.uniform1f(u.uGlow, f.glow);
  gl.uniform4fv(u.uRipple, f.ripples);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
