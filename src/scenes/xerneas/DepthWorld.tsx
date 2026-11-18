import type {V3} from '../../three/stage';
import {groundOf, OPENING_END_POSE, smooth, XerneasPose} from './OpeningArt';

export type CameraShot = {at: number; eye: V3; aim: V3; fov: number; roll: number};
type Projection = {x: number; y: number; depth: number};
export type View = {project: (point: V3) => Projection | null; focal: number};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const along = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
	const len = Math.hypot(...a);
	return [a[0] / len, a[1] / len, a[2] / len];
};

export const cameraAt = (frame: number, shots: readonly CameraShot[]): CameraShot => {
	const end = shots.findIndex(({at}) => at >= frame);
	if (end < 0) return shots[shots.length - 1];
	if (end === 0) return shots[0];
	const a = shots[end - 1];
	const b = shots[end];
	const t = smooth(frame, a.at, b.at);
	return {at: frame, eye: along(a.eye, b.eye, t), aim: along(a.aim, b.aim, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll, b.roll, t)};
};

/** 一次求出镜头基底，整片树林都用同一个带俯仰和横滚的透视投影。 */
export const perspective = ({eye, aim, fov, roll}: CameraShot): View => {
	const fwd = unit(sub(aim, eye));
	const right = unit(cross([0, 1, 0], fwd));
	const up = cross(fwd, right);
	const r = roll * Math.PI / 180;
	const cos = Math.cos(r);
	const sin = Math.sin(r);
	const focal = 540 / Math.tan(fov * Math.PI / 360);
	return {focal, project: (p) => {
		const offset = sub(p, eye);
		const depth = dot(offset, fwd);
		if (depth < 0.75) return null;
		const x = dot(offset, right) * focal / depth;
		const y = -dot(offset, up) * focal / depth;
		return {x: 960 + x * cos - y * sin, y: 540 + x * sin + y * cos, depth};
	}};
};

export const terrain = (x: number, z: number) => Math.sin(x * 0.125) * Math.sin(z * 0.116) * 1.55 + 0.42 * Math.sin(z * 0.22);
export const figurePose = (view: View, x = 0, z = 0, height = 12.5): XerneasPose => {
	const foot = view.project([x, terrain(x, z), z]);
	if (!foot) return OPENING_END_POSE;
	const scale = view.focal * height / (720 * foot.depth);
	return {x: foot.x - scale * 48, y: foot.y - scale * groundOf({x: 0, y: 0, scale: 1}), scale};
};

const coord = (p: Projection) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const path = (view: View, points: readonly V3[]) => {
	let d = '';
	let pen = false;
	for (const p of points) {
		const s = view.project(p);
		if (!s) { pen = false; continue; }
		d += `${pen ? 'L' : 'M'}${coord(s)}`;
		pen = true;
	}
	return d;
};
const polygon = (view: View, points: readonly V3[]) => {
	const projected = points.map(view.project);
	if (projected.some((p) => !p)) return '';
	return `M${projected.map((p) => coord(p!)).join('L')}Z`;
};
const growPath = (view: View, points: readonly V3[], amount: number) => {
	if (amount >= 1) return path(view, points);
	if (amount <= 0) return '';
	const at = amount * (points.length - 1);
	const i = Math.floor(at);
	return path(view, [...points.slice(0, i + 1), along(points[i], points[i + 1], at - i)]);
};

const rand = (seed: number) => {
	const v = Math.sin(seed * 77.927 + 19.3) * 43758.5453;
	return v - Math.floor(v);
};
const sample = (n: number, fn: (t: number, i: number) => V3) => Array.from({length: n}, (_, i) => fn(i / (n - 1), i));
const bend = (a: V3, b: V3, c: V3, t: number) => along(along(a, b, t), along(b, c, t), t);

const makeTree = (x: number, z: number, h: number, seed: number, thick = false) => {
	const y = terrain(x, z);
	const base: V3 = [x, y, z];
	const elbow: V3 = [x + (rand(seed + 1) - 0.5) * h * 0.29, y + h * 0.48, z - h * 0.02];
	const top: V3 = [x + (rand(seed + 7) - 0.5) * h * 0.22, y + h, z + h * 0.06];
	const trunk = sample(7, (t) => bend(base, elbow, top, t));
	const radius = h * (thick ? 0.078 : 0.045);
	const bark = [
		...trunk.map(([tx, ty, tz], i): V3 => [tx - radius * (1 - i / 7), ty, tz]),
		...trunk.map(([tx, ty, tz], i): V3 => [tx + radius * (1 - i / 7), ty, tz]).reverse(),
	];
	const twigs = Array.from({length: 6}, (_, j) => {
		const a = j * 2.39996 + seed;
		const fork = 0.36 + 0.09 * j + rand(seed + j + 15) * 0.08;
		const start = bend(base, elbow, top, fork);
		const reach = h * (0.15 + rand(seed + j + 19) * 0.2) * (1 - fork * 0.4);
		const tip: V3 = [start[0] + Math.cos(a) * reach, start[1] + h * (0.14 + rand(seed + j * 5) * 0.16), start[2] + Math.sin(a) * reach];
		const mid = along(start, tip, 0.53);
		mid[1] -= h * 0.09;
		const split = bend(start, mid, tip, 0.64);
		const twig: V3 = [split[0] + Math.cos(a + 0.6) * h * 0.08, split[1] + h * 0.15, split[2] + Math.sin(a + 0.6) * h * 0.08];
		const leaf: V3[] = [tip, [tip[0] + 0.24, tip[1] + 0.36, tip[2]], [tip[0] + 0.55, tip[1] + 0.47, tip[2] + 0.08], [tip[0] + 0.36, tip[1] + 0.15, tip[2]], tip];
		return {fork, limb: sample(5, (t) => bend(start, mid, tip, t)), twig: [split, along(split, twig, 0.55), twig], leaf};
	});
	return {base, trunk, bark, twigs, delay: Math.min(0.57, 0.03 + Math.hypot(x, z) / 112 + rand(seed + 23) * 0.11), thick};
};

const WOODS = [
	...[5, 13, 22, 34, 52, 73].flatMap((z, row) => Array.from({length: 11}, (_, i) => {
		const seed = 29 * row + i;
		const x = (i - 5) * (5.2 + row * 0.72) + (rand(seed + 5) - 0.5) * 5.1;
		return makeTree(x, z + 4 * rand(seed + 4), 5.4 + 7 * rand(seed + 11), seed);
	})),
	...[[-9, -7], [11, -8], [-14, -13], [8, -13], [-8.4, -14], [15, -16], [-19, -18], [6, -19], [-11, -22], [12, -25], [-3, -21], [20, -24]]
		.map(([x, z], i) => makeTree(x, z, 11.5 + 6 * rand(i + 220), i + 220, true)),
];

const ROWS = [-26, -20, -15, -11, -7, -3, 1, 6, 12, 20, 30, 43, 62, 82].map((z) => sample(27, (t) => {
	const x = -67 + t * 134;
	return [x, terrain(x, z) - 0.05, z];
}));
const TRAILS = [-22, -11, 12, 23].map((x0) => sample(24, (t) => {
	const z = -26 + 103 * t;
	const x = x0 + 2.4 * Math.sin(z * 0.15 + x0);
	return [x, terrain(x, z), z];
}));
const RIDGES = [115, 90, 74].map((z, i) => sample(43, (t) => {
	const x = (t - 0.5) * 265;
	const h = 5 + i * 2.4 + Math.sin(t * 24 + i * 2) * 4.4 + Math.cos(t * 47 + i) * 2.2 + (rand(t * 33 + i) - 0.5) * 2.7;
	return [x, h, z];
}));
const STARS = Array.from({length: 55}, (_, i): V3 => [(rand(i + 320) - 0.5) * 240, 17 + 79 * rand(i + 78), 142 + rand(i + 35) * 64]);
const SKY_BANDS = [40, 67, 102].map((z, i) => sample(34, (t) => [(t - 0.5) * 205, 11 + i * 4 + Math.sin(t * 14 + i * 1.6) * (0.8 + i * 0.47), z]));
const airColor = (a: V3, b: V3, t: number) => `rgb(${along(a, b, t).map(Math.round).join(',')})`;

export const DepthForest: React.FC<{view: View; growth: number; light?: number; sky?: number; front?: boolean}> = ({view, growth, light = 0, sky = 0, front = false}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} aria-hidden="true">
		{!front && <>
			<defs>
				<radialGradient id="kalos-depth-air" cx="50%" cy="56%" r="75%">
					<stop offset={0} stopColor={sky > 0 ? airColor([37, 59, 73], [49, 36, 62], sky) : '#253B49'} />
					<stop offset={0.55} stopColor={sky > 0 ? airColor([20, 37, 53], [32, 29, 52], sky) : '#142535'} />
					<stop offset={1} stopColor="#090E1A" />
				</radialGradient>
			</defs>
			<rect width={1920} height={1080} fill="url(#kalos-depth-air)" />
			{STARS.map((p, i) => {const s = view.project(p); return s && <circle key={i} cx={s.x} cy={s.y} r={i % 8 === 0 ? 1.9 : 1.1} fill="#C9E0F2" opacity={0.06 + sky * (0.19 + 0.18 * rand(i))} />;})}
			{sky > 0 && <g stroke="#AB91B1" strokeWidth={1.5} fill="none" opacity={sky * 0.19}>{SKY_BANDS.map((band, i) => <path key={i} d={path(view, band)} />)}</g>}
			{RIDGES.map((ridge, i) => {
				const d = path(view, ridge);
				if (!d) return null;
				return <path key={i} d={`${d} L2600 1180 H-700Z`} fill={['#172333', '#152435', '#142531'][i]} stroke="#819CB1" strokeWidth={1.35} strokeOpacity={0.15 + sky * 0.12} />;
			})}
			<g fill="none" stroke={light > 0.3 ? '#DCC28E' : '#7597A7'} strokeWidth={1.45} opacity={0.22 + light * 0.27}>
				{ROWS.map((row, i) => <path key={i} d={path(view, row)} opacity={0.95 - i * 0.044} />)}
				{TRAILS.map((row, i) => <path key={i} d={path(view, row)} opacity={0.49} />)}
			</g>
		</>}
		{WOODS.filter((t) => t.thick === front).map((t) => {
			const root = view.project(t.base);
			if (!root || root.depth < 1.9) return null;
			const growthAt = smooth(growth, t.delay, t.delay + 0.36);
			if (growthAt <= 0) return null;
			const near = 1 - smooth(root.depth, 10, 64);
			const fog = (front ? 0.37 : 0.14) + near * (front ? 0.29 : 0.31) + light * 0.19;
			const alpha = fog * smooth(root.depth, 1.9, 4.8);
			const silhouette = polygon(view, t.bark);
			const d = t.twigs.map(({fork, limb, twig, leaf}) => {
				const start = t.delay + fork * 0.31;
				return growPath(view, limb, smooth(growth, start, start + 0.23)) + growPath(view, twig, smooth(growth, start + 0.1, start + 0.34)) + (near > 0.22 ? growPath(view, leaf, smooth(growth, start + 0.21, start + 0.38)) : '');
			}).join('');
			return (
				<g key={`${t.base[0]}-${t.base[2]}`} style={front && root.depth < 6 ? {filter: `blur(${(6 - root.depth) * 0.55}px)`} : undefined}>
					{silhouette && <path d={silhouette} fill="#0B1621" opacity={smooth(growthAt, 0.42, 1) * (front ? 0.94 : 0.52) * smooth(root.depth, 1.9, 4.7)} />}
					<g stroke={front ? '#83ADBA' : '#9BB7AD'} fill="none" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" opacity={alpha}>
						<path d={growthAt < 1 ? growPath(view, t.trunk, growthAt) : silhouette || path(view, t.trunk)} />
						<path d={d} />
					</g>
				</g>
			);
		})}
	</svg>
);

const ARCHES = [1, 5, 11, 19, 28, 39, 53].map((z, i) => [
	[-14, -1, z], [-12.5, 3.6, z], [-11, 7.3, z], [-7.6, 11.9, z], [-3.2, 13.2, z],
	[0, 12.9, z], [4.5, 14.2, z], [8.3, 11.8, z], [10.8, 8.2, z], [11.9, 4.7, z], [13.6, -1.2, z],
].map(([x, y, z], j): V3 => [x + 2.2 * (rand(i * 13 + j + 44) - 0.5), y + (rand(i * 17 + j + 81) - 0.5) * 2.6, z]));
const FACETS = ARCHES.slice(1).flatMap((far, i) => [0, 1, 2, 7, 8, 9].map((j) => [far[j], far[j + 1], ARCHES[i][j + 1], ARCHES[i][j]])).reverse();
const STALACTITES: V3[][] = [
	[[-8.7, 11.9, 8], [-6.8, 7.4, 9.7], [-6.2, 12.5, 8.1]],
	[[-1, 13.3, 14.3], [-0.7, 10.4, 15.4], [1, 13.2, 15.3]],
	[[5.8, 13.1, 14], [5.3, 8.8, 14.5], [8.3, 12.1, 15.6]],
	[[9.2, 10.2, 21], [8.4, 7.1, 22], [11.3, 10.7, 23.2]],
];

export const DepthCave: React.FC<{view: View; light: number}> = ({view, light}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
		<defs>
			<radialGradient id="kalos-cave-air" cx="55%" cy="60%" r="72%">
				<stop offset={0} stopColor="#3D2837" />
				<stop offset={0.58} stopColor="#1A1A2A" />
				<stop offset={1} stopColor="#0B0D18" />
			</radialGradient>
		</defs>
		<rect width={1920} height={1080} fill="url(#kalos-cave-air)" />
		{FACETS.map((face, i) => <path key={i} d={polygon(view, face)} fill={['#0E1321', '#312237', '#18182B'][i % 3]} opacity={0.21 + rand(i + 40) * 0.2} />)}
		<g stroke="#AF8998" fill="none" strokeWidth={1.65} strokeLinejoin="round">
			{ARCHES.map((arch, i) => <path key={i} d={path(view, arch)} opacity={0.4 - i * 0.043 + light * 0.2} />)}
			{[0, 1, 2, 4, 6, 8, 9, 10].map((i) => <path key={i} d={path(view, ARCHES.map((arch) => arch[i]))} opacity={0.23 + light * 0.13} />)}
			{ARCHES.map((arch, i) => <path key={`floor-${i}`} d={path(view, [arch[0], [-5, -0.9, arch[0][2]], [3, -1.1, arch[0][2]], arch[10]])} opacity={0.19 - i * 0.018} />)}
		</g>
		{STALACTITES.map((shape, i) => <path key={i} d={polygon(view, shape)} fill="#141524" stroke="#91768C" strokeWidth={1.45} strokeOpacity={0.31} />)}
		{[[0, 1, 2, 3], [7, 8, 9, 10]].map((columns, i) => <path key={i} d={polygon(view, [...columns.map((j) => ARCHES[1][j]), ...columns.map((j) => ARCHES[0][j]).reverse()])} fill="#0B101A" opacity={0.74} />)}
	</svg>
);
