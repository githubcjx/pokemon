import {AbsoluteFill, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, CORMORANT, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {bf, ease, env, flowTime, frozenAt, isFrozen, prog, SUB, SUBS, track} from './common';
import {BG_FRAG} from './gl';
import {AXIS_START, BehindDialga, GemGlow, heartAt, HookWorld, Motes, RulerWorld, StillWorld, Title} from './Part1';
import {Part2World} from './Part2';
import {chargeAt, ChargeMotes, HeartCounter, HeartWorld, MOUTH, ROAR, RoarBeam, StarChart} from './Part3';
import {Cam, camAt, DIALGA, GEM, Grid, INK, MetalDefs, ORIGIN, ORIGIN_GEM, toScreen, worldTransform} from './world';

/**
 * 《时间的心跳》整期总时间轴。整期画在一张星图上（world.tsx），镜头连续移动；各段（Segments.tsx）只是窗口。
 * 上篇（第 1–3 段）的内容在 Part1.tsx。
 */

const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

/** 显形：第 16 小节强拍，剪影 → 原色 */
const REVEAL = bf(16);
/** 起源形态：第 30 小节强拍（光明涌来，白闪里换形） */
const ORIGIN_AT = bf(30);
/** 光明涌来：第 28 小节第 3 拍起慢慢变强，第 30 小节强拍最亮 */
const floodAt = (f: number) => (f < ORIGIN_AT ? Math.pow(prog(f, bf(28, 2), ORIGIN_AT), 2.2) : Math.exp(-(f - ORIGIN_AT) / 9));

/** 帝牙卢卡（通常形态，官方立绘）：第 12 句凝成剪影，第 16 小节显形 */
const Dialga: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = env(f, bf(12, 1), ORIGIN_AT + 2, 22, 3);
	if (o <= 0) return null;
	const fl = f < ORIGIN_AT ? floodAt(f) : 0;
	const [x, y] = toScreen(c, DIALGA.x, DIALGA.y);
	const size = DIALGA.size * c.z;
	if (x + size < -200 || x - size > 2120) return null;
	const k = ease(prog(f, REVEAL - 1, REVEAL + 10));
	const hb = heartAt(f);
	const breathe = Math.sin((f - REVEAL) * 0.03);
	return (
		<PokemonArt3D
			dir="pokemon/dialga"
			x={x}
			y={y}
			size={size}
			yaw={k * breathe * 2.2}
			pitch={k * -1.5}
			depthScale={0.5}
			ambient={mix3([0.015, 0.025, 0.06], [0.52, 0.54, 0.64], k)}
			dirLights={[
				{dir: [-0.45, -0.85, 0.6], color: mix3([0, 0, 0], [0.55, 0.58, 0.7], k), wrap: 0.45},
				{dir: [0.85, 0.15, 0.35], color: mix3([0, 0, 0], [0.2, 0.2, 0.42], k), wrap: 0.5},
			]}
			pointLights={[{pos: [0.295, 0.09, 0.3], color: mix3([0.1, 0.2, 0.6], [0.15 + 0.6 * hb, 0.3 + 0.8 * hb, 0.8 + 1.4 * hb], k), radius: 0.28}]}
			rim={{dir: [0.7, -0.6], color: mix3([0.22, 0.4, 0.95], [0.3, 0.45, 0.85], k), power: 3}}
			emissive={(1 - k) * 0.55 + k * (0.1 + 0.35 * hb)}
			emissiveTint={[0.45, 0.85, 1.5]}
			emissiveKey={[0.5, 0.7, 0.18, 0.45]}
			brightness={1 + 1.6 * fl}
			opacity={o}
			resolution={Math.min(1.3, 2600 / (size * 1.12))}
		/>
	);
};

/** 起源形态（官方立绘镜像）：第 30 小节起 */
const DialgaOrigin: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = env(f, ORIGIN_AT - 2, bf(72), 3, 20);
	if (o <= 0) return null;
	const [x, y] = toScreen(c, ORIGIN.x, ORIGIN.y);
	const size = ORIGIN.size * c.z;
	if (x + size < -200 || x - size > 2120) return null;
	const hb = heartAt(f);
	const fl = floodAt(f);
	const breathe = Math.sin((flowTime(f) - flowTime(ORIGIN_AT)) * 0.028);
	const ch = chargeAt(f);
	return (
		<PokemonArt3D
			dir="pokemon/dialga"
			variant="-origin"
			x={x}
			y={y}
			size={size}
			yaw={breathe * 2.2}
			pitch={-1.2 - 4 * Math.min(1, ch)}
			depthScale={0.5}
			ambient={[0.54, 0.56, 0.67]}
			dirLights={[
				{dir: [-0.45, -0.85, 0.6], color: [0.55, 0.58, 0.72], wrap: 0.45},
				{dir: [0.85, 0.1, 0.4], color: [0.32, 0.26, 0.16], wrap: 0.5},
			]}
			pointLights={[{pos: [0.2, -0.23, 0.3], color: [0.12 + 0.5 * hb, 0.25 + 0.75 * hb, 0.7 + 1.3 * hb], radius: 0.26}]}
			rim={{dir: [0.6, -0.75], color: [0.55, 0.52, 0.48], power: 3}}
			emissive={0.12 + 0.35 * hb + 0.7 * ch}
			emissiveTint={[0.45, 0.85, 1.5]}
			emissiveKey={[0.5, 0.72, 0.2, 0.5]}
			brightness={1 + 1.2 * fl + 0.25 * Math.exp(-Math.abs(f - ROAR) / 8)}
			opacity={o}
			resolution={Math.min(1.3, 2600 / (size * 1.12))}
		/>
	);
};

/** 起源形态胸前晶体的光（随心跳） */
const OriginGemGlow: React.FC<{f: number}> = ({f}) => {
	if (f < ORIGIN_AT) return null;
	const hb = heartAt(f);
	const [x, y] = ORIGIN_GEM;
	return <circle cx={x} cy={y} r={70 + 70 * hb} fill="url(#tm-pulse)" opacity={0.45 + 0.55 * hb} />;
};

/** 光明涌来：从帝牙卢卡周围铺开的金白色光 */
const Flood: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = floodAt(f) * env(f, bf(28, 2), ORIGIN_AT + 60, 2, 2);
	if (a <= 0.01) return null;
	const [x, y] = toScreen(c, DIALGA.x, DIALGA.y - 40);
	const R = 260 + 900 * a;
	const rot = f * 0.35;
	const mask = `radial-gradient(circle at ${x}px ${y}px, #000 0px, #000 ${R * 0.25}px, rgba(0,0,0,0.5) ${R * 0.6}px, transparent ${R}px)`;
	return (
		<>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,250,${a}) 0px, rgba(255,246,222,${a * 0.9}) ${R * 0.12}px, rgba(255,216,140,${a * 0.42}) ${R * 0.3}px, rgba(90,130,255,${a * 0.14}) ${R * 0.58}px, rgba(0,0,0,0) ${R}px)`,
				}}
			/>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					opacity: Math.min(1, a * 1.4) * 0.55,
					background: `repeating-conic-gradient(from ${rot}deg at ${x}px ${y}px, rgba(255,236,190,0.9) 0deg, rgba(255,236,190,0) 2.2deg, rgba(255,236,190,0) 11deg, rgba(255,236,190,0.6) 13deg, rgba(255,236,190,0) 15deg, rgba(255,236,190,0) 24deg)`,
					maskImage: mask,
					WebkitMaskImage: mask,
				}}
			/>
		</>
	);
};

/** 起源形态的小标签（右上） */
const FormLine: React.FC<{f: number}> = ({f}) => {
	const a = env(f, ORIGIN_AT + 10, bf(34), 18, 18);
	if (a <= 0) return null;
	return (
		<div style={{position: 'absolute', right: 150, top: 200, opacity: a, textAlign: 'right', whiteSpace: 'nowrap', textShadow: '0 0 16px rgba(0,0,0,0.85)'}}>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 30, letterSpacing: 10, color: 'rgba(244,226,176,0.95)'}}>帝牙卢卡 · 起源形态</div>
			<div style={{fontFamily: CINZEL, fontSize: 18, letterSpacing: 6, marginTop: 8, color: 'rgba(244,226,176,0.7)'}}>DIALGA · ORIGIN FORME</div>
		</div>
	);
};

/** 右上角的读数：静段里是 Δt = ?，第 8 小节起开始计时 */
const Readout: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(6), bf(10, 2), 16, 20);
	if (a <= 0) return null;
	const running = f >= bf(8);
	const blink = running ? 1 : 0.55 + 0.45 * Math.round((Math.sin(f * 0.25) + 1) / 2);
	const sec = Math.max(0, (f - bf(8)) / 30);
	return (
		<div style={{position: 'absolute', right: 130, top: 110, opacity: a, textAlign: 'right', fontFamily: CORMORANT, fontStyle: 'italic', color: 'rgba(220,234,255,0.92)', textShadow: '0 0 14px rgba(80,130,255,0.6)'}}>
			<span style={{fontSize: 46, letterSpacing: 2}}>Δt = </span>
			<span style={{fontSize: 46, opacity: blink, display: 'inline-block', minWidth: 140, textAlign: 'left'}}>{running ? `${sec.toFixed(2)} s` : '?'}</span>
		</div>
	);
};

/** 屏幕上的闪光：第 13 句钻石一闪（小），第 16 小节显形（大） */
const Flash: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const big = Math.exp(-Math.max(0, f - REVEAL) / 7) * prog(f, REVEAL - 3, REVEAL);
	const small = Math.exp(-Math.pow((f - AXIS_START) / 5, 2)) * 0.45;
	const roar = Math.exp(-Math.max(0, f - ROAR) / 6) * prog(f, ROAR - 2, ROAR) * 0.9;
	const a = Math.max(big, small, roar);
	if (a <= 0.01) return null;
	const [x, y] = roar > big ? toScreen(c, MOUTH[0], MOUTH[1]) : toScreen(c, GEM[0], GEM[1]);
	return (
		<AbsoluteFill
			style={{
				mixBlendMode: 'screen',
				background: `radial-gradient(circle at ${x}px ${y}px, rgba(235,245,255,${a}) 0%, rgba(120,170,255,${a * 0.8}) 18%, rgba(40,80,200,${a * 0.35}) 45%, rgba(0,0,0,0) 75%)`,
			}}
		/>
	);
};

export const TimeMaster: React.FC = () => {
	const f = useFrame();
	const c = camAt(f);
	const tau = flowTime(f);
	const hb = heartAt(f);
	const [gx, gy] = f < ORIGIN_AT ? toScreen(c, GEM[0], GEM[1]) : toScreen(c, ORIGIN_GEM[0], ORIGIN_GEM[1]);
	const gemOn = env(f, bf(12, 2), bf(72), 20, 20);
	const gridO = track(f, [
		[0, 0.55],
		[bf(1), 0.9],
		[bf(5), 0.9],
		[bf(6), 0.32],
		[bf(8) - 0.01, 0.32],
		[bf(8, 1), 0.9],
		[bf(15, 3), 1],
		[bf(16), 0.45],
		[bf(17), 0.6],
	]);
	const dim = interpolate(f, [bf(5, 2), bf(6), bf(8) - 1, bf(8)], [0, 0.18, 0.18, 0], clamp);
	return (
		<AbsoluteFill style={{background: '#030814'}}>
			<ShaderCanvas
				frag={BG_FRAG}
				width={1920}
				height={1080}
				scale={0.75}
				uniforms={{
					uCam: [c.cx, c.cy],
					uZoom: c.z,
					uTime: tau / 30,
					uGlow: [gx, gy, 300 * c.z, gemOn * (0.1 + 0.35 * hb + (f >= REVEAL ? 0.18 : 0))],
					uGlowCol: [0.2, 0.38, 1.0],
					uDim: dim,
				}}
			/>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<MetalDefs />
				<g transform={worldTransform(c)}>
					<Grid c={c} opacity={gridO} />
					<BehindDialga f={f} />
					<HookWorld f={f} />
					<StillWorld f={f} />
					<RulerWorld f={f} c={c} />
					<Part2World f={f} c={c} />
					<StarChart f={f} />
					<HeartWorld f={f} />
					<Motes f={f} c={c} />
				</g>
			</svg>
			<Dialga f={f} c={c} />
			<DialgaOrigin f={f} c={c} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<MetalDefs />
				<g transform={worldTransform(c)}>
					<GemGlow f={f} />
					<OriginGemGlow f={f} />
					<ChargeMotes f={f} />
					<RoarBeam f={f} />
				</g>
			</svg>
			<Title f={f} c={c} />
			<Readout f={f} />
			<NameTag
				from={bf(16, 2)}
				x={1770}
				y={230}
				align="right"
				no="No.0483"
				zh="帝牙卢卡"
				en="DIALGA"
				category="时间宝可梦"
				categoryEn="Temporal Pokémon"
				tone="mono"
				glowRgb={INK.cobaltRgb}
				opacity={interpolate(f, [bf(20), bf(20, 3)], [1, 0], clamp)}
			/>
			<Flood f={f} c={c} />
			<Flash f={f} c={c} />
			<FormLine f={f} />
			<HeartCounter f={f} />
			{SUBS.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Cry name="dialga" at={REVEAL} />
			<Cry name="dialga-origin" at={ORIGIN_AT} />
			<Cry name="dialga-origin" at={ROAR} volume={0.9} />
			<Vignette strength={0.45} />
			<AbsoluteFill style={{background: '#030814', opacity: ease(prog(f, bf(71), bf(72) - 2))}} />
			<Grain opacity={0.12} frameOffset={isFrozen(f) ? frozenAt(f) - f : 0} />
		</AbsoluteFill>
	);
};

