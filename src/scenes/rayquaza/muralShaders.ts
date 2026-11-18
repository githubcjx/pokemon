const mineral = `
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
}

float pigment(vec2 p) {
  return .52 * noise(p) + .27 * noise(p * 2.11 + 17.0)
       + .14 * noise(p * 4.43 - 9.0) + .07 * noise(p * 9.17 + 23.0);
}

float dryBrush(vec2 p) {
  return mix(noise(p * vec2(32, 285)), noise(p * vec2(100, 690)), .53);
}

vec2 screen(vec2 xy, vec2 res) {
  return vec2(xy.x, res.y - xy.y) / res;
}
`;

export const MURAL_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTravel;
out vec4 color;

${mineral}

vec3 wall(vec2 p) {
  float stone = pigment(p * vec2(10, 13));
  float grain = noise(p * 360.0);
  float cleavage = (p.y + .21 * p.x + .061 * pigment(p * 7.0)) * 22.0;
  float vein = 1.0 - smoothstep(.014, .092, abs(fract(cleavage) - .5));
  vein *= smoothstep(.36, .62, pigment(p * 19.0 + 8.0));
  vec3 slate = mix(vec3(.04, .059, .057), vec3(.181, .212, .191), stone);
  slate += .047 * (grain - .5) + .036 * (dryBrush(p) - .5);
  return slate + vein * vec3(.15, .141, .099);
}

vec3 orbit(vec2 uv, vec3 slate) {
  vec2 p = uv + vec2(-.009 * uTime, .007 * uTime);
  vec2 cell = p * vec2(147, 91);
  float seed = hash(floor(cell));
  float star = smoothstep(.995, 1.0, seed)
    * (1.0 - smoothstep(.035, .31, length(fract(cell) - vec2(.47, .57))));
  vec3 sky = slate * .82 + star * vec3(.66, .57, .37);

  float horizon = .656 + .28 * pow(uv.x + .055, 2.0) - .012 * uTime;
  float d = uv.y - horizon;
  float ground = smoothstep(-.003, .006, d);
  vec2 land = vec2(p.x * 6.0, (p.y - horizon) * 10.0);
  float deposits = pigment(land + .55 * pigment(land * .9));
  float shore = 1.0 - smoothstep(.006, .029, abs(deposits - .52));
  vec3 sea = slate * .76 + vec3(.019, .097, .085);
  sea += smoothstep(.51, .65, deposits) * vec3(.061, .089, .061);
  sea += shore * vec3(.17, .20, .138);
  float haze = exp(-abs(d) * 46.0);
  float crest = 1.0 - smoothstep(.001, .006, abs(d));
  vec3 wash = haze * vec3(.078, .17, .142) + crest * vec3(.29, .38, .277);
  return mix(sky, sea, ground) + wash * (.48 + .52 * dryBrush(uv));
}

vec3 coast(vec2 uv, vec3 slate) {
  float drift = uTime * .006;
  float chalk = pigment(vec2(uv.x * 5.1 - drift, uv.y * 11.0 + drift));
  float strokes = dryBrush(uv + vec2(-drift * .032, drift * .052));
  float mist = smoothstep(.46, .66, chalk + .092 * sin(uv.y * 27.0 - uv.x * 3.1));
  mist *= .43 + .57 * smoothstep(.06, .9, uv.x);
  vec2 light = (uv - vec2(.63, .37)) * vec2(1.13, 1.6);
  float backlight = exp(-dot(light, light) * 3.9);
  vec3 sky = slate + backlight * vec3(.062, .108, .087);
  vec3 chalkPigment = vec3(.48, .54, .476) * (.72 + .52 * strokes);
  sky = mix(sky, chalkPigment, mist * .56);
  float d = uv.y - (.689 + .006 * noise(vec2(uv.x * 7.0, 4.0)));
  float water = smoothstep(-.007, .008, d);
  float grain = pigment(vec2(uv.x * 11.0 + drift, d * 28.0));
  float waves = sin(125.0 * sqrt(max(d, 0.0)) + 4.0 * grain + uTime * .26);
  waves = smoothstep(.66, .98, waves) * smoothstep(.36, .67, grain);
  vec3 ocean = slate * .75 + vec3(.025, .060, .061);
  ocean += waves * vec3(.29, .33, .28);
  float horizonLight = exp(-max(d, 0.0) * 22.0) * (.65 + .35 * strokes);
  ocean += horizonLight * vec3(.13, .16, .13);
  return mix(sky, ocean, water);
}

void main() {
  vec2 uv = screen(gl_FragCoord.xy, uRes);
  vec3 slate = wall(uv);
  float sweep = uv.x * .58 + uv.y * .42 + .22 * (pigment(uv * 8.0) - .5);
  float edge = mix(-.28, 1.28, uTravel);
  float reveal = 1.0 - smoothstep(edge - .11, edge + .11, sweep);
  vec3 view;
  if (reveal <= .001) {
    view = orbit(uv, slate);
  } else if (reveal >= .999) {
    view = coast(uv, slate);
  } else {
    view = mix(orbit(uv, slate), coast(uv, slate), reveal);
  }
  float powder = exp(-abs(sweep - edge) * 15.0) * dryBrush(uv);
  view += powder * vec3(.33, .29, .203);
  vec2 c = (uv - .5) * vec2(1.13, 1.0);
  float vignette = 1.0 - .51 * smoothstep(.11, .63, dot(c, c));
  color = vec4(view * vignette, 1);
}
`;

export const MIST_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uOpacity;
uniform float uReveal;
out vec4 color;

${mineral}

void main() {
  vec2 uv = screen(gl_FragCoord.xy, uRes);
  vec2 flow = vec2(uv.x * 5.4 - uTime * .064, uv.y * 12.1);
  float blot = pigment(flow);
  float fiber = dryBrush(vec2(uv.x - uTime * .0018, uv.y));
  float spine = .52 + .048 * sin(uv.x * 8.0) + .036 * sin(uv.x * 19.0 - uTime * .39);
  spine += .12 * (blot - .5) + uReveal * .05;
  float body = (1.0 - smoothstep(.011, .13, abs(uv.y - spine)))
    * smoothstep(.29, .67, blot + .16 * fiber);
  float low = (1.0 - smoothstep(.031, .14, abs(uv.y - .798 + .023 * sin(uv.x * 14.0))))
    * smoothstep(.39, .73, pigment(flow + 9.0));
  float crown = .202 + .06 * sin(uv.x * 11.0 - uTime * .25) + .105 * (blot - .5);
  float high = (1.0 - smoothstep(.008, .102, abs(uv.y - crown)))
    * smoothstep(.31, .73, pigment(flow + 4.0)) * smoothstep(.23, .72, uv.x);
  float bank = min(1.0, body * .89 + low * .88 + high * .56);
  vec3 chalk = mix(vec3(.275, .323, .281), vec3(.67, .67, .552), fiber);
  float erosion = smoothstep(.095, .39, fiber + body * .24);
  color = vec4(chalk, bank * erosion * uOpacity);
}
`;
