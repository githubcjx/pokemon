import {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {bf, ease, prog, rnd, smooth} from './common';
import {PORTAL_C} from './pillar';

/**
 * 第 4 段「来历」（第 22–30 小节）纸两边的东西：
 * 左右两边用排线刻出帝牙卢卡（朝右）、帕路奇亚（朝左），面对面（官方立绘推算，蓝 / 粉线对应纸上那两条线），
 * 纸外一圈慢慢转的洗翠石板线框。第 27 小节"神话只写了时间和空间"时两位变亮；
 * 翻面前（第 29.2–30 小节）全部淡掉，翻面那一下画面和原来一样。
 */

const IN_AT = bf(22);
const OUT_FROM = bf(29, 2);
const OUT_TO = bf(30);
export const DIALGA_AT = bf(22, 1);
export const PALKIA_AT = bf(23);
const BRIGHT_AT = bf(27);

const sidesA = (f: number) => 1 - smooth(prog(f, OUT_FROM, OUT_TO));

/** 一块石板：圆角矩形外框 + 内框 + 中间的纹（菱形加一圈） */
const plateGeometry = () => {
	const pts: number[] = [];
	const seg = (a: [number, number], b: [number, number]) => pts.push(a[0], 0, a[1], b[0], 0, b[1]);
	const rect = (w: number, h: number, r: number) => {
		const N = 6;
		const corner = (cx: number, cz: number, a0: number) =>
			Array.from({length: N + 1}, (_, i) => {
				const a = a0 + (i / N) * (Math.PI / 2);
				return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as [number, number];
			});
		const loop = [...corner(w - r, h - r, 0), ...corner(-w + r, h - r, Math.PI / 2), ...corner(-w + r, -h + r, Math.PI), ...corner(w - r, -h + r, Math.PI * 1.5)];
		loop.forEach((p, i) => seg(p, loop[(i + 1) % loop.length]));
	};
	rect(0.85, 1.15, 0.18);
	rect(0.68, 0.98, 0.1);
	const d: [number, number][] = [
		[0, -0.5],
		[0.32, 0],
		[0, 0.5],
		[-0.32, 0],
	];
	d.forEach((p, i) => seg(p, d[(i + 1) % 4]));
	const R = 0.2;
	for (let i = 0; i < 16; i++) {
		const a0 = (i / 16) * Math.PI * 2;
		const a1 = ((i + 1) / 16) * Math.PI * 2;
		seg([Math.cos(a0) * R, Math.sin(a0) * R], [Math.cos(a1) * R, Math.sin(a1) * R]);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	return g;
};

/** 洗翠的 18 块石板，绕着纸转一圈（纸外，半径 15–19；浮在地面之上，地面会挡住下面的东西） */
const PLATES = Array.from({length: 18}, (_, i) => ({
	a: (i / 18) * Math.PI * 2 + (rnd(i * 3.3) - 0.5) * 0.15,
	r: 15.5 + rnd(i * 7.1) * 3.5,
	y: 0.6 + rnd(i * 2.9) * 2.4,
	tilt: (rnd(i * 5.3) - 0.5) * 0.6,
	spin: (rnd(i * 1.7) - 0.5) * 0.8,
	s: 1.15 + rnd(i * 9.1) * 0.5,
	gold: i % 3 === 0,
}));

export const PlateRing: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(plateGeometry, []);
	const pearl = useMemo(() => new THREE.LineBasicMaterial({color: new THREE.Color(0.8, 0.78, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}), []);
	const gold = useMemo(() => new THREE.LineBasicMaterial({color: new THREE.Color(1.0, 0.72, 0.34), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}), []);
	const a = smooth(prog(f, IN_AT, bf(23, 2))) * sidesA(f);
	if (a <= 0) return null;
	pearl.opacity = 0.55 * a;
	gold.opacity = 0.65 * a;
	const turn = (f - IN_AT) * 0.0016;
	return (
		<group position={[PORTAL_C[0], 0, PORTAL_C[2]]}>
			{PLATES.map((p, i) => {
				const ang = p.a + turn;
				const bob = Math.sin(f * 0.03 + i * 1.3) * 0.25;
				return (
					<lineSegments
						key={i}
						geometry={geo}
						material={p.gold ? gold : pearl}
						position={[Math.cos(ang) * p.r, p.y + bob, Math.sin(ang) * p.r]}
						rotation={[p.tilt + Math.sin(f * 0.012 + i) * 0.15, -ang + p.spin, Math.sin(f * 0.01 + i * 2) * 0.2]}
						scale={[p.s, p.s, p.s]}
					/>
				);
			})}
		</group>
	);
};

/** 一位神：排线刻出的身形，第 27 小节变亮 */
const Engraved: React.FC<{f: number; dir: string; at: number; x: number; flip: boolean; color: [number, number, number]; seed: number}> = ({f, dir, at, x, flip, color, seed}) => {
	const inA = smooth(prog(f, at - 10, at + 14));
	const o = inA * sidesA(f);
	if (o <= 0) return null;
	const bright = ease(prog(f, BRIGHT_AT, BRIGHT_AT + 24));
	const flash = f >= at - 2 ? Math.exp(-(f - at) / 10) * 0.5 : 0;
	return (
		<AbsoluteFill style={{transform: flip ? 'scaleX(-1)' : undefined}}>
			<PokemonArt3D
				dir={dir}
				x={flip ? 1920 - x : x}
				y={548 + Math.sin(f * 0.025 + seed) * 6}
				size={520}
				yaw={Math.sin(f * 0.018 + seed) * 2.5}
				pitch={-1}
				depthScale={0.5}
				ambient={[0.42 + 0.14 * bright, 0.42 + 0.14 * bright, 0.46 + 0.14 * bright]}
				hatch={{amount: 0.55 + 0.45 * bright, body: 0.9, color, freq: 84, time: f / 30}}
				brightness={1 + flash}
				opacity={o}
				resolution={1.4}
			/>
		</AbsoluteFill>
	);
};

export const TimeSpaceSides: React.FC<{f: number}> = ({f}) => {
	if (f < DIALGA_AT - 12 || f > OUT_TO + 2) return null;
	return (
		<>
			<Engraved f={f} dir="pokemon/dialga" at={DIALGA_AT} x={262} flip={false} color={[0.5, 0.68, 1.0]} seed={0} />
			<Engraved f={f} dir="pokemon/palkia" at={PALKIA_AT} x={1690} flip={false} color={[1.0, 0.6, 0.8]} seed={2} />
		</>
	);
};
