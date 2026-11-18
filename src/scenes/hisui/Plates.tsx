import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import * as THREE from 'three';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {agedTexture, rng} from '../../three/pagodaGeometry';
import {CoronetLights, Sky, Snow, Terrain} from '../../three/hisui/coronet';
import {StoneStatue} from '../../three/hisui/statue';
import {CameraRig, V3} from '../../three/stage';
import {TrainerSil} from './Clans';
import {flow, prog, SUB, T} from './common';
import {CogitaShot} from './Gods';
import {PartCard, View} from './Overlays';
import {BoltSvg, REI, ScreenSil} from './Rift';

// ─── 第 6 段「石板与雕像」（下篇开头）────────────────────────────────────────
// 吾思头顶的夜空：地面沉下去、仰到星空，篇章卡 → 十八块石板从夜空深处飞来，围着那点金光排成一圈（"完全之神的碎片"）
// → 拳头石板特写（官方铭文）→ 雷电石板与落雷（回扣第 3 段）→ 雷光一闪，神阖寺院遗址（3D）：帝牙卢卡、帕路奇亚的石像，
// 角落里打碎的骑拉帝纳石像 → 仰望天空 → 望罗的剪影。

const ease = (t: number) => t * t * (3 - 2 * t);
const rnd = (s: number) => {
	const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

// ── 2D：夜空与石板 ──

/** 石板的颜色（各属性的代表色）；第 6 块是拳头石板（格斗），第 3 块是雷电石板（电） */
const PLATE_RGB = [
	'240,128,48',
	'104,144,240',
	'248,208,48',
	'120,200,80',
	'152,216,216',
	'192,48,40',
	'160,64,160',
	'224,192,104',
	'168,144,240',
	'248,88,136',
	'168,184,32',
	'184,160,56',
	'112,88,152',
	'112,56,248',
	'112,88,72',
	'184,184,208',
	'238,153,172',
	'255,236,190',
];
const FIST = 5;
const ZAP = 2;
const N = PLATE_RGB.length;
const RING = {x: 960, y: 420, r: 300};
const GOLD = {x: 960, y: 420};
/** 第 5 段末尾那点金光在画面上的位置（Gods.tsx 的 CogitaShot：star(850, 70)），仰起镜头时它移到画面中间 */
const GOLD_FROM = {x: 843, y: 12};

const SKY_STARS = Array.from({length: 320}, (_, i) => ({x: rnd(i * 3.1) * 1920, y: rnd(i * 5.7) * 1080, r: 0.5 + rnd(i * 7.3) * 1.6, tw: rnd(i * 2.9) * 6}));

const slot = (i: number, f: number) => {
	const a = (i / N) * Math.PI * 2 - Math.PI / 2 + (f - T.ring) * 0.0016;
	return {x: RING.x + Math.cos(a) * RING.r, y: RING.y + Math.sin(a) * RING.r * 0.92};
};

const PlateIcon: React.FC<{x: number; y: number; s: number; rgb: string; a: number; glow: number}> = ({x, y, s, rgb, a, glow}) => {
	if (a <= 0.01) return null;
	const w = 46 * s;
	const h = 62 * s;
	return (
		<div
			style={{
				position: 'absolute',
				left: x - w / 2,
				top: y - h / 2,
				width: w,
				height: h,
				opacity: a,
				borderRadius: 6 * s,
				background: `linear-gradient(160deg, rgba(${rgb},1) 0%, rgba(${rgb},0.75) 55%, rgba(40,30,30,0.9) 100%)`,
				boxShadow: `0 0 ${10 * s * glow}px rgba(${rgb},0.9), 0 0 ${34 * s * glow}px rgba(${rgb},0.5), inset 0 0 ${6 * s}px rgba(255,255,255,0.35)`,
			}}
		>
			<div style={{position: 'absolute', inset: 5 * s, borderRadius: 4 * s, border: `${Math.max(1, 1.2 * s)}px solid rgba(255,255,255,0.35)`}} />
		</div>
	);
};

const NightSky: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.end5, T.end5 + 60, T.celestica - 2, T.celestica + 4], [0, 1, 1, 0], clamp);
	if (f > T.celestica + 4) return null;
	const tilt = ease(prog(f, T.end5, T.end5 + 110));
	const gx = GOLD_FROM.x + (GOLD.x - GOLD_FROM.x) * tilt;
	const gy = GOLD_FROM.y + (GOLD.y - GOLD_FROM.y) * tilt;
	const flare = interpolate(f, [T.l65, T.l65 + 12, T.l65 + 70], [0, 1, 0.35], clamp) * (1 - prog(f, T.fist, T.fist + 30));
	const goldA = 1 - 0.6 * prog(f, T.fist, T.fist + 40);
	const r = (70 + 150 + 120 * flare) * 1.06;
	// 第 5 段那一镜里金光下方的蓝、粉两点（Gods.tsx 的 CogitaShot，按它的缩放换算），跟着金光移动、渐渐隐去
	const twinA = 0.85 * 0.45 * (1 - prog(f, T.end5 + 40, T.plates));
	const twin = (dx: number, dy: number, rgb: string) => (
		<div style={{position: 'absolute', left: gx + dx - 106, top: gy + dy - 106, width: 212, height: 212, borderRadius: '50%', opacity: twinA, background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${rgb},0.85) 10%, rgba(${rgb},0.22) 32%, rgba(${rgb},0) 70%)`, mixBlendMode: 'screen'}} />
	);
	return (
		<AbsoluteFill>
		<AbsoluteFill style={{opacity: o, background: 'linear-gradient(180deg, #03050e 0%, #070b1d 55%, #0b1128 100%)'}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{SKY_STARS.map((s, i) => (
					<circle key={i} cx={s.x} cy={(s.y + 700 * (1 - tilt)) % 1080} r={s.r} fill="rgba(230,236,255,0.85)" opacity={0.45 + 0.55 * Math.sin(f * 0.05 + s.tw)} />
				))}
			</svg>
		</AbsoluteFill>
			{f > T.end5 ? twin(-122, 154, '120,165,255') : null}
			{f > T.end5 ? twin(122, 164, '255,150,205') : null}
			{f > T.end5 ? <div style={{position: 'absolute', left: gx - r, top: gy - r, width: r * 2, height: r * 2, borderRadius: '50%', opacity: goldA * (f < T.celestica ? 1 : 1 - prog(f, T.celestica - 2, T.celestica + 4)), background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,214,140,0.85) 9%, rgba(255,214,140,0.22) 32%, rgba(255,214,140,0) 70%)', mixBlendMode: 'screen'}} /> : null}
		</AbsoluteFill>
	);
};

/** 十八块石板：从夜空深处（小而暗）飞向金光周围的位置，排成一圈慢慢转 */
const PlatesRing: React.FC<{f: number}> = ({f}) => {
	if (f < T.plates || f > T.zap + 20) return null;
	const flare = interpolate(f, [T.l65, T.l65 + 12, T.l65 + 70], [0, 1, 0.3], clamp);
	const leave = prog(f, T.fist, T.fist + 30);
	return (
		<AbsoluteFill>
			{PLATE_RGB.map((rgb, i) => {
				const t0 = T.plates + (i * 7) % (N * 7) * 0.9 + rnd(i * 4.4) * 20;
				const k = ease(prog(f, t0, t0 + 70));
				if (k <= 0) return null;
				const a0 = rnd(i * 9.1) * Math.PI * 2;
				const from = {x: 960 + Math.cos(a0) * (700 + rnd(i) * 400), y: 420 + Math.sin(a0) * (420 + rnd(i * 2) * 200)};
				const to = slot(i, f);
				// 弧线飞来：中段往外鼓一点
				const bulge = Math.sin(Math.PI * k) * 120;
				const x = from.x + (to.x - from.x) * k + Math.cos(a0 + 1.4) * bulge;
				const y = from.y + (to.y - from.y) * k + Math.sin(a0 + 1.4) * bulge;
				const fist = i === FIST;
				if (fist && leave > 0) return null;
				return <PlateIcon key={i} x={x} y={y} s={(0.25 + 0.75 * k) * (1 + 0.15 * flare)} rgb={rgb} a={(0.3 + 0.7 * k) * (1 - leave)} glow={0.6 + 0.4 * k + flare} />;
			})}
		</AbsoluteFill>
	);
};

/** 石板特写：石材、按属性着色、刻着官方铭文，字从左到右亮起 */
const Tablet: React.FC<{name: string; lines: string[]; rgb: string; x: number; y: number; s: number; a: number; reveal: number}> = ({name, lines, rgb, x, y, s, a, reveal}) => {
	if (a <= 0.01) return null;
	const W = 560;
	const H = 720;
	const mask = `linear-gradient(90deg, #000 ${reveal * 120 - 20}%, rgba(0,0,0,0) ${reveal * 120}%)`;
	return (
		<div style={{position: 'absolute', left: x - W / 2, top: y - H / 2, width: W, height: H, opacity: a, transform: `scale(${s})`}}>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					borderRadius: 26,
					background: `radial-gradient(ellipse 70% 60% at 40% 30%, rgba(${rgb},0.95) 0%, rgba(${rgb},0.7) 45%, rgba(30,22,20,0.95) 100%)`,
					boxShadow: `0 0 40px rgba(${rgb},0.55), 0 0 140px rgba(${rgb},0.3), inset 0 0 50px rgba(0,0,0,0.55)`,
				}}
			/>
			{/* 石面的斑点 */}
			<div style={{position: 'absolute', inset: 0, borderRadius: 26, opacity: 0.35, background: 'repeating-radial-gradient(circle at 30% 40%, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0) 3px, rgba(255,255,255,0.06) 6px, rgba(0,0,0,0) 9px)', mixBlendMode: 'multiply'}} />
			<div style={{position: 'absolute', inset: 26, borderRadius: 16, border: '3px solid rgba(255,255,255,0.28)', boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)'}} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontFamily: SERIF, fontSize: 30, letterSpacing: 14, paddingLeft: 14, color: 'rgba(255,248,235,0.75)', textShadow: '0 1px 0 rgba(0,0,0,0.6)'}}>{name}</div>
			<div style={{position: 'absolute', left: 60, right: 60, top: 140, height: 2, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.4), rgba(255,255,255,0))'}} />
			{/* 刻字：暗的刻痕打底，亮的光沿字从左到右亮起 */}
			<div style={{position: 'absolute', left: 40, right: 40, top: 250, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: 38, lineHeight: 1.9, letterSpacing: 3, color: 'rgba(30,18,12,0.7)', textShadow: '0 2px 0 rgba(255,255,255,0.18)'}}>
				{lines.map((l) => (
					<div key={l}>{l}</div>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 40,
					right: 40,
					top: 250,
					textAlign: 'center',
					fontFamily: SERIF,
					fontWeight: 700,
					fontSize: 38,
					lineHeight: 1.9,
					letterSpacing: 3,
					color: '#fff8e8',
					textShadow: `0 0 10px rgba(${rgb},1), 0 0 26px rgba(255,240,210,0.8)`,
					WebkitMaskImage: mask,
					maskImage: mask,
				}}
			>
				{lines.map((l) => (
					<div key={l}>{l}</div>
				))}
			</div>
		</div>
	);
};

/** 落雷的背景：紫红的云，几道雷从上面劈下来 */
const STORM_BOLTS = [
	{t: T.zap + 30, x0: 300, x1: 420, seed: 3},
	{t: T.zap + 58, x0: 1620, x1: 1500, seed: 7},
	{t: T.zap + 84, x0: 1100, x1: 1240, seed: 11},
	{t: T.celestica - 6, x0: 760, x1: 880, seed: 15},
];

const PlateShots: React.FC<{f: number}> = ({f}) => {
	if (f < T.fist || f > T.celestica + 8) return null;
	// 拳头石板：从圈里的位置飞到画面中间、放大
	const s0 = slot(FIST, f);
	const k = ease(prog(f, T.fist, T.fist + 34));
	const fx = s0.x + (960 - s0.x) * k;
	const fy = s0.y + (470 - s0.y) * k;
	const fistA = interpolate(f, [T.fist, T.fist + 6, T.zap, T.zap + 16], [0, 1, 1, 0], clamp);
	const fistS = 0.12 + 0.88 * k + 0.03 * prog(f, T.fist + 34, T.zap);
	// 雷电石板：从右边滑进来
	const z = ease(prog(f, T.zap, T.zap + 26));
	const zapA = interpolate(f, [T.zap, T.zap + 14, T.celestica - 2, T.celestica + 4], [0, 1, 1, 0], clamp);
	const storm = interpolate(f, [T.zap, T.zap + 26], [0, 1], clamp);
	const boltA = STORM_BOLTS.map((b) => (f >= b.t && f < b.t + 14 ? Math.exp(-(f - b.t) / 3.5) : 0));
	const flash = Math.max(...boltA);
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{opacity: storm, background: 'radial-gradient(ellipse 80% 70% at 50% 35%, #4a1840 0%, #2a0e2a 50%, #120610 100%)'}} />
			<AbsoluteFill style={{opacity: storm * 0.5, background: 'radial-gradient(ellipse 30% 18% at 25% 18%, rgba(230,90,120,0.4), rgba(0,0,0,0) 70%), radial-gradient(ellipse 28% 14% at 76% 14%, rgba(240,110,130,0.35), rgba(0,0,0,0) 70%)'}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: storm}}>
				{STORM_BOLTS.map((b, i) => (boltA[i] > 0.01 ? <BoltSvg key={i} x0={b.x0} y0={-20} x1={b.x1} y1={1000} seed={b.seed} a={boltA[i]} width={4} /> : null))}
			</svg>
			<Tablet name="拳头石板" lines={['当世界的背面陷入混乱，', '时空裂缝便会产生。']} rgb={PLATE_RGB[FIST]} x={fx} y={fy} s={fistS} a={fistA} reveal={prog(f, T.l66 + 30, T.l66 + 110)} />
			<Tablet name="雷电石板" lines={['狂暴的分身，', '能降下愤怒之雷。']} rgb={PLATE_RGB[ZAP]} x={960 + 900 * (1 - z)} y={470} s={1} a={zapA} reveal={prog(f, T.l67 + 4, T.l67 + 50)} />
			<AbsoluteFill style={{background: `rgba(255,236,236,${flash * 0.35})`, mixBlendMode: 'screen'}} />
		</AbsoluteFill>
	);
};

// ── 3D：神阖寺院遗址 ──
// 照游戏截图：草地上的石台、断柱和残拱，几棵针叶树；石台上立着帝牙卢卡、帕路奇亚的石像，骑拉帝纳的石像碎在角落里。

const DIALGA_ST: V3 = [-12, 0, -8];
const PALKIA_ST: V3 = [6, 0, -16];
const GIRA_ST: V3 = [23.5, 0, 4.5];
const VOLO: V3 = [19.0, 0, 6.0];
const REI_P: V3 = [14.2, 0, 7.4];

const CAMR: [number, number[]][] = [
	[T.celestica, [-5, 2.5, 34, -2, 3.6, -8, 44]],
	[T.l68 + 100, [7, 2.2, 24, 12, 2.4, -1, 44]],
	[T.l69 + 10, [16, 1.75, 14.6, 22.6, 1.1, 4.4, 42]],
	[T.l69 + 150, [18.4, 1.45, 11.8, 22.8, 0.9, 4.3, 40]],
	[T.l70 + 85, [18.7, 1.55, 12.0, 30, 22, -24, 46]],
	[T.l71 + 25, [16.0, 1.7, 10.9, 19.4, 1.65, 5.6, 40]],
	[T.end6, [16.2, 1.7, 10.6, 19.4, 1.67, 5.6, 38]],
];
const viewR = (f: number): View => {
	const c = flow(f, CAMR);
	return {pos: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]], fov: c[6]};
};

const h2 = (x: number, y: number) => {
	const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return v - Math.floor(v);
};
const vn = (x: number, y: number) => {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx);
	const uy = fy * fy * (3 - 2 * fy);
	return (h2(ix, iy) * (1 - ux) + h2(ix + 1, iy) * ux) * (1 - uy) + (h2(ix, iy + 1) * (1 - ux) + h2(ix + 1, iy + 1) * ux) * uy;
};
const fbm = (x: number, y: number, oct = 4) => {
	let v = 0;
	let a = 0.5;
	for (let i = 0; i < oct; i++) {
		v += a * vn(x, y);
		x *= 2.03;
		y *= 2.03;
		a *= 0.5;
	}
	return v / (1 - Math.pow(0.5, oct));
};
const groundH = (x: number, z: number) => (fbm(x * 0.03 + 3, z * 0.03 - 1) - 0.5) * 1.6;

const useRuinGeo = () =>
	useMemo(() => {
		const r = rng(606);
		// 地面：起伏的草地，雪斑
		const ground = new THREE.PlaneGeometry(700, 700, 160, 160);
		ground.rotateX(-Math.PI / 2);
		const gp = ground.attributes.position as THREE.BufferAttribute;
		const cols = new Float32Array(gp.count * 3);
		const grass = new THREE.Color('#5e6b4e');
		const dry = new THREE.Color('#7b7a5c');
		const snow = new THREE.Color('#d9dde6');
		const c = new THREE.Color();
		for (let i = 0; i < gp.count; i++) {
			const x = gp.getX(i);
			const z = gp.getZ(i);
			const far = Math.max(0, Math.hypot(x, z) - 90);
			gp.setY(i, groundH(x, z) + far * far * 0.0002);
			const n = fbm(x * 0.06 + 11, z * 0.06 - 7, 5);
			const sn = fbm(x * 0.025 - 4, z * 0.025 + 9, 4);
			c.copy(grass).lerp(dry, Math.min(1, n * 1.3)).lerp(snow, Math.max(0, Math.min(1, (sn - 0.56) * 6 + far * 0.006)));
			c.offsetHSL(0, 0, (h2(x * 3.1, z * 2.7) - 0.5) * 0.04);
			cols.set([c.r, c.g, c.b], i * 3);
		}
		ground.setAttribute('color', new THREE.BufferAttribute(cols, 3));
		ground.computeVertexNormals();
		// 针叶树
		const pines = Array.from({length: 26}, (_, i) => {
			const a = r() * Math.PI * 2;
			const d = 32 + r() * 50;
			const x = Math.cos(a) * d + 4;
			const z = Math.sin(a) * d * 0.8 - 6;
			return {x, z, h: 6 + r() * 7};
		}).filter((p) => !(p.z > 20 && Math.abs(p.x) < 30));
		// 断柱、残拱（各自的位置、高度）
		const cols2: {x: number; z: number; h: number; cap: boolean}[] = [];
		const add = (x: number, z: number, h: number, cap = false) => cols2.push({x, z, h, cap});
		add(-3, -4, 5.6, true);
		add(1.5, -4, 5.6, true);
		add(-18, 2, 3.2);
		add(-6, 10, 1.6);
		add(13, -6, 4.4, true);
		add(17, -6, 4.4, true);
		add(9, 6, 2.2);
		add(-22, -14, 5.0, true);
		add(28, -2, 2.6);
		return {ground, pines, cols: cols2};
	}, []);

const RuinWorld: React.FC<{f: number; v: View}> = ({f, v}) => {
	const geo = useRuinGeo();
	const mats = useMemo(
		() => ({
			ground: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95}),
			stone: new THREE.MeshStandardMaterial({map: agedTexture('#cfc8ba', 'rgba(70,64,56,0.2)', {seed: 33, grimeH: 0.1, streaks: 9, mottle: 0.2}), roughness: 0.85}),
			pine: new THREE.MeshStandardMaterial({color: '#24301f', roughness: 0.9}),
			trunk: new THREE.MeshStandardMaterial({color: '#3a2a1e', roughness: 0.9}),
		}),
		[],
	);
	const time = f / 30;
	const gold = interpolate(f, [T.l70, T.l70 + 60, T.l71, T.l71 + 40], [0, 0.6, 0.6, 0.25], clamp);
	const platform = (p: V3, w: number, d: number) => (
		<>
			<mesh material={mats.stone} position={[p[0], 0.4, p[2]]} castShadow receiveShadow>
				<boxGeometry args={[w, 0.8, d]} />
			</mesh>
			<mesh material={mats.stone} position={[p[0], 0.8 + 0.55, p[2]]} castShadow receiveShadow>
				<boxGeometry args={[2.8, 1.1, 2.8]} />
			</mesh>
		</>
	);
	return (
		<ThreeCanvas width={1920} height={1080} shadows gl={{antialias: true}}>
			<CameraRig pos={v.pos} target={v.target} fov={v.fov} far={2200} />
			<CoronetLights dusk={1} gold={gold} fogNear={120} fogFar={1500} />
			<Sky cam={v.pos} s={{dusk: 1, starRot: 0, trail: 0, gold, time}} />
			<mesh geometry={geo.ground} material={mats.ground} receiveShadow />
			{/* 远处的天冠山（同一座山的地形，缩小放在西北方） */}
			<group position={[60, 50, -760]} scale={0.42}>
				<Terrain />
			</group>
			{geo.pines.map((p, i) => (
				<group key={i} position={[p.x, groundH(p.x, p.z), p.z]}>
					<mesh material={mats.trunk} position={[0, 0.6, 0]}>
						<cylinderGeometry args={[0.18, 0.25, 1.2, 8]} />
					</mesh>
					<mesh material={mats.pine} position={[0, 1.2 + p.h * 0.35, 0]} castShadow>
						<coneGeometry args={[p.h * 0.28, p.h * 0.7, 10]} />
					</mesh>
					<mesh material={mats.pine} position={[0, 1.2 + p.h * 0.6, 0]} castShadow>
						<coneGeometry args={[p.h * 0.23, p.h * 0.55, 10]} />
					</mesh>
					<mesh material={mats.pine} position={[0, 1.2 + p.h * 0.85, 0]} castShadow>
						<coneGeometry args={[p.h * 0.15, p.h * 0.4, 10]} />
					</mesh>
				</group>
			))}
			{geo.cols.map((c, i) => (
				<group key={i} position={[c.x, 0, c.z]}>
					<mesh material={mats.stone} position={[0, 0.3, 0]} castShadow receiveShadow>
						<boxGeometry args={[1.5, 0.6, 1.5]} />
					</mesh>
					<mesh material={mats.stone} position={[0, 0.6 + c.h / 2, 0]} castShadow receiveShadow>
						<cylinderGeometry args={[0.5, 0.56, c.h, 20]} />
					</mesh>
					{c.cap ? (
						<mesh material={mats.stone} position={[0, 0.6 + c.h + 0.25, 0]} castShadow receiveShadow>
							<boxGeometry args={[1.4, 0.5, 1.4]} />
						</mesh>
					) : null}
				</group>
			))}
			{/* 残拱的横梁 */}
			<mesh material={mats.stone} position={[-0.75, 0.6 + 5.6 + 0.85, -4]} castShadow receiveShadow>
				<boxGeometry args={[6.2, 0.7, 1.4]} />
			</mesh>
			<mesh material={mats.stone} position={[15, 0.6 + 4.4 + 0.85, -6]} castShadow receiveShadow>
				<boxGeometry args={[5.6, 0.7, 1.4]} />
			</mesh>
			{/* 帝牙卢卡、帕路奇亚的石像（立在石台上） */}
			{platform(DIALGA_ST, 8, 6)}
			{platform(PALKIA_ST, 8, 6)}
			<StoneStatue dir="pokemon/dialga" pos={[DIALGA_ST[0], 1.9, DIALGA_ST[2]]} ry={0.35} height={5} opacity={1} />
			<StoneStatue dir="pokemon/palkia" pos={[PALKIA_ST[0], 1.9, PALKIA_ST[2]]} ry={0.15} height={5} opacity={1} />
			{/* 骑拉帝纳的石像：角落里，碎成几块（基座也歪了） */}
			<mesh material={mats.stone} position={[GIRA_ST[0], 0.5, GIRA_ST[2]]} rotation={[0.06, 0.4, -0.08]} castShadow receiveShadow>
				<boxGeometry args={[3, 1.0, 2.6]} />
			</mesh>
			{/* 倒在地上、裂成几块（碎块只散开一点） */}
			<group position={[GIRA_ST[0] - 1.2, 0.55, GIRA_ST[2] + 1.6]} rotation={[0, -0.5, 1.32]}>
				<StoneStatue dir="pokemon/giratina" pos={[0, 0, 0]} ry={0} height={4.2} opacity={1} shatter={0.32} seed={11} />
			</group>
			<Snow cam={v.pos} time={time} amount={0.25} wind={0.8} />
		</ThreeCanvas>
	);
};

const RuinLayers: React.FC<{f: number; v: View}> = ({f, v}) => {
	const shadow = interpolate(f, [T.l69 + 40, T.l69 + 120, T.l70 + 40, T.l70 + 90], [0, 1, 1, 0.3], clamp);
	const smile = interpolate(f, [T.l71 + 30, T.l71 + 80], [0, 1], clamp);
	return (
		<>
			<TrainerSil v={v} {...REI} foot={REI_P} h={1.65} o={1} from="right" rgb="255,200,160" lift={0.12} />
			<TrainerSil v={v} file="trainers/volo/la.png" aspect={630 / 1600} foot={VOLO} h={1.78} o={1} from="left" rgb="255,190,140" lift={0.13 + 0.07 * smile} />
			{/* 被放逐到世界的背面：碎像周围慢慢暗下去 */}
			<AbsoluteFill style={{opacity: shadow, background: 'radial-gradient(ellipse 55% 60% at 62% 62%, rgba(18,4,26,0) 20%, rgba(18,4,26,0.55) 75%, rgba(10,0,16,0.8) 100%)'}} />
		</>
	);
};

export const RuinShot: React.FC<{f: number}> = ({f}) => {
	if (f < T.celestica - 4) return null;
	const v = viewR(f);
	const o = interpolate(f, [T.celestica - 4, T.celestica + 2], [0, 1], clamp);
	return (
		<AbsoluteFill style={{opacity: o}}>
			<RuinWorld f={f} v={v} />
			<RuinLayers f={f} v={v} />
		</AbsoluteFill>
	);
};

// ── 合在一起 ──

export const PlatesMaster: React.FC<{f: number}> = ({f}) => {
	// 开头：吾思那一镜的地面往下沉、淡出（仰到星空）
	const sink = ease(prog(f, T.end5, T.end5 + 110));
	const flash = interpolate(f, [T.celestica - 8, T.celestica, T.celestica + 26], [0, 1, 0], clamp);
	const lum = f >= T.celestica ? 0.6 : 0.2;
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			<NightSky f={f} />
			{sink < 1 ? (
				<AbsoluteFill style={{opacity: Math.max(0, 1 - sink * 1.5), transform: `translateY(${sink * 640}px)`, WebkitMaskImage: `linear-gradient(180deg, rgba(0,0,0,${1 - Math.min(1, sink * 4)}) 0px, #000 260px)`, maskImage: `linear-gradient(180deg, rgba(0,0,0,${1 - Math.min(1, sink * 4)}) 0px, #000 260px)`}}>
					<CogitaShot f={f} noSky={f > T.end5} />
				</AbsoluteFill>
			) : null}
			<PlatesRing f={f} />
			{f >= T.l64 - 20 && f < T.fist + 40 ? (
				<ScreenSil file="trainers/volo/la.png" aspect={630 / 1600} x={300} y={1080 - 260} h={640} rgb="255,214,150" lift={0.1} from="right" o={interpolate(f, [T.l64 - 20, T.l64 + 20, T.fist, T.fist + 30], [0, 1, 1, 0], clamp)} />
			) : null}
			<PlateShots f={f} />
			<RuinShot f={f} />
			{flash > 0 ? <AbsoluteFill style={{background: `rgba(255,245,240,${flash})`, mixBlendMode: 'screen'}} /> : null}
			<PartCard f={f} from={T.card3} to={T.card3 + 85} zh="下篇 · 枪之柱" en="PART THREE · SPEAR PILLAR" />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.52) 100%)', pointerEvents: 'none'}} />
			{SUBS_PLATES.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Grain opacity={0.12 - 0.05 * lum} />
		</AbsoluteFill>
	);
};

export const SUBS_PLATES: [number, number, string, string, SubtitleSource?][] = [
	[T.l63, T.l63 + 120, '那么，真正的神奥大尊是谁？裂缝又为什么会打开？', 'Then who was the true almighty Sinnoh? And why had the rift opened?'],
	[T.l64, T.l64 + 190, '望罗对这些问题比谁都着迷。他说，散落在洗翠各地的石板，是「完全之神的碎片」。', 'No one was more drawn to these questions than Volo. The plates scattered across Hisui, he said, were "shards of the almighty god."'],
	[T.l65, T.l65 + 80, '石板的主人，才是真正的神奥大尊。', 'The one they came from was the true almighty Sinnoh.'],
	[T.l66, T.l66 + 135, '石板上写着：当世界的背面陷入混乱，时空裂缝就会出现。', 'One plate read: the rift is born of disorder on the other side of this world.'],
	[T.l67, T.l67 + 95, '狂暴的分身，能降下愤怒之雷。', 'The third being raged, raining down bolts of anger.', {zh: '《传说 阿尔宙斯》雷电石板', en: 'Bulbapedia, Plate (Zap Plate, LA)'}],
	[T.l68, T.l68 + 175, '在天冠山的一处寺院遗址，望罗指给你看一座被打碎、扔在角落里的雕像。', 'At temple ruins on Mount Coronet, Volo showed you a shattered statue, left off in a corner.'],
	[T.l69, T.l69 + 165, '它和时间、空间之神地位相同，却因为性格粗暴，被放逐到了世界的背面。', 'It had been the equal of the gods of time and space, but for its violence, it was banished to the reverse side of the world.'],
	[T.l70, T.l70 + 100, '据说，它一直在等机会，反抗那位创造之神。', 'It is said to have waited ever since for a chance to rise against the creator.'],
	[T.l71, T.l71 + 110, '望罗笑着问：「那么，它会在哪里出现呢？」', 'Volo smiled and asked: "So where do you think it would appear?"'],
];
