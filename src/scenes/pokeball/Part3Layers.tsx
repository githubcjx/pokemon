import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {COLORS} from '../../theme';
import {BASE_FPS} from '../../time';
import {BEAT, bf, easeInQuad, easeOutCubic, lerp, prog, sat, smooth, TOTAL_FRAMES} from './common';
import {DOTS_FRAG} from './gl';
import {draw, gold, HisuiBall, Label, P} from './Part1Layers';
import {MUSEUM_BALL} from './Part2Layers';
import {ModernBall} from './ui';

const Sprite: React.FC<{src: string; x: number; y: number; size: number; o?: number; s?: number; rot?: number; glow?: number; style?: React.CSSProperties}> = ({src, x, y, size, o = 1, s = 1, rot = 0, glow = 0, style}) => (
	<div
		style={{
			position: 'absolute',
			left: x - size / 2,
			top: y - size / 2,
			width: size,
			height: size,
			opacity: o,
			transform: `scale(${s}) rotate(${rot}deg)`,
			filter: `drop-shadow(0 0 ${4 + 18 * glow}px rgba(${COLORS.glowRgb},${0.2 + 0.6 * glow})) drop-shadow(0 5px 5px rgba(0,0,0,0.7))`,
			...style,
		}}
	>
		<Img src={staticFile(src)} style={{width: size, height: size}} />
	</div>
);

const Dots: React.FC<{f: number; src: [P, P, P]; progress: number; dim: number; o?: number; topFade?: number}> = ({f, src, progress, dim, o = 1, topFade = 0}) => (
	<AbsoluteFill style={{opacity: o}}>
		<ShaderCanvas
			frag={DOTS_FRAG}
			width={1920}
			height={1080}
			uniforms={{
				uTime: f / BASE_FPS,
				uSrc0: [src[0].x, src[0].y],
				uSrc1: [src[1].x, src[1].y],
				uSrc2: [src[2].x, src[2].y],
				uProg: progress,
				uCell: 40,
				uR: 8.5,
				uTopFade: topFade,
				uDim: dim,
			}}
		/>
	</AbsoluteFill>
);

// ════════════════════════════════════════════════════════════════════════
// 第 9 段：最后的工匠——七种球果 → 七种球
// ════════════════════════════════════════════════════════════════════════

const T_KURT = bf(38);
const T_RING7 = bf(40);
const T_FACTORY = bf(43);
const JOHTO = [
	['red', 'level', '红球果', '等级球'],
	['yellow', 'moon', '黄球果', '月亮球'],
	['blue', 'lure', '蓝球果', '诱饵球'],
	['green', 'friend', '绿球果', '友友球'],
	['pink', 'love', '粉球果', '甜蜜球'],
	['white', 'fast', '白球果', '速度球'],
	['black', 'heavy', '黑球果', '沉重球'],
] as const;

/** 七颗球各自飞向哪个工厂节点（0 关都 / 1 丰缘 / 2 卡洛斯） */
const NODE_OF = [0, 0, 1, 1, 1, 2, 2];
/** 展柜里那颗球飞到第一颗球果的位置，木质外壳淡成红球果 */
const T_CARRY = bf(38, 2);

export const KurtLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_KURT || f > T_FACTORY + BEAT * 3) return null;
	// 球果、标签、箭头在第 42 小节末淡出；七颗球留下来，缩成光点飞向工厂
	const out = 1 - smooth(prog(f, bf(42, 2), bf(43)));
	const xs = (i: number) => 960 + (i - 3) * 205;
	const yA = 340;
	const yB = 610;
	const carry = smooth(prog(f, T_KURT, T_CARRY));
	const cP = {x: lerp(MUSEUM_BALL.x, xs(0), carry), y: lerp(MUSEUM_BALL.y, yA, carry) - 50 * Math.sin(Math.PI * carry)};
	const cS = lerp(MUSEUM_BALL.s, 128, carry);
	const toApri = smooth(prog(f, T_KURT + BEAT, T_CARRY));
	return (
		<>
		{f < T_CARRY + 2 && (
			<>
				<HisuiBall x={cP.x} y={cP.y} scale={cS} glow={MUSEUM_BALL.glow} o={1 - toApri} />
				<Sprite src="items/johto/apricorn-red.png" x={cP.x} y={cP.y} size={128} s={cS / 128} o={toApri} />
			</>
		)}
		{JOHTO.map(([, ball], i) => {
			// 七颗球：第 42 小节第 4 拍起缩成光点，飞向各自的工厂节点
			const tb = T_RING7 + i * BEAT + BEAT * 0.9;
			const kb = prog(f, tb, tb + 10);
			if (kb <= 0) return null;
			const n = NODES[NODE_OF[i]];
			const t0 = bf(42, 3) + i * 2;
			const t1 = bf(43, 1 + NODE_OF[i]);
			const go = smooth(prog(f, t0, t1));
			if (go >= 1) return null;
			const x = lerp(xs(i), n.x, go);
			const y = lerp(yB, n.y, go) - 60 * Math.sin(Math.PI * go);
			const flashB = f >= tb ? Math.exp(-(f - tb) / 8) : 0;
			const size = lerp(1, 0.14, easeInQuad(go));
			return <Sprite key={i} src={`items/johto/${ball}.png`} x={x} y={y} size={120} o={smooth(kb) * (1 - smooth(prog(go, 0.85, 1)))} s={size * (1 + 0.2 * Math.sin(Math.PI * sat(kb * 1.2)))} glow={flashB + 0.8 * go} />;
		})}
		<div style={{position: 'absolute', inset: 0, opacity: out}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{JOHTO.map((_, i) => {
					const t = prog(f, T_RING7 + i * BEAT, T_RING7 + i * BEAT + BEAT * 0.9);
					return (
						<g key={i}>
							<path d={`M ${xs(i)} ${yA + 92} L ${xs(i)} ${yB - 78}`} stroke={gold(0.7)} strokeWidth={1.3} fill="none" {...draw(t)} />
							<path d={`M ${xs(i) - 7} ${yB - 88} L ${xs(i)} ${yB - 76} L ${xs(i) + 7} ${yB - 88}`} stroke={gold(0.8)} strokeWidth={1.3} fill="none" opacity={smooth(prog(t, 0.8, 1))} />
						</g>
					);
				})}
				<line x1={xs(0) - 110} y1={yA + 150} x2={xs(6) + 110} y2={yA + 150} stroke={gold(0.18)} strokeWidth={1} opacity={smooth(prog(f, T_RING7, T_RING7 + 20))} />
			</svg>
			{JOHTO.map(([ac, , an, bn], i) => {
				// 红球果由展柜里那颗球变成；其余六颗从左边那颗旁边依次滑出来
				const ta = T_CARRY + i * BEAT * 0.75;
				const ka = i === 0 ? (f >= T_CARRY ? 1 : 0) : prog(f, ta, ta + 10);
				const slide = i === 0 ? 1 : easeOutCubic(prog(f, ta, ta + 14));
				const tb = T_RING7 + i * BEAT + BEAT * 0.9;
				const flashA = i > 0 && f >= ta ? Math.exp(-(f - ta) / 8) : 0;
				return (
					<div key={i}>
						{ka > 0 && <Sprite src={`items/johto/apricorn-${ac}.png`} x={lerp(xs(Math.max(0, i - 1)), xs(i), slide)} y={yA} size={128} o={smooth(ka)} s={i === 0 ? 1 : 1 + 0.12 * Math.sin(Math.PI * sat(ka * 1.2))} glow={flashA} />}
						<Label x={xs(i)} y={yA + 64} zh={an} o={smooth(prog(f, ta + 6, ta + 18))} size={18} />
						<Label x={xs(i)} y={yB + 62} zh={bn} o={smooth(prog(f, tb + 6, tb + 18))} size={18} />
					</div>
				);
			})}
		</div>
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 10 段：工厂——三处源头，成千上万颗球；霹雳电球滚进来
// ════════════════════════════════════════════════════════════════════════

const NODES = [
	{x: 470, y: 250, zh: '金黄市 · 西尔佛公司', en: 'KANTO'},
	{x: 960, y: 250, zh: '卡那兹市 · 得文公司', en: 'HOENN'},
	{x: 1450, y: 250, zh: '香薰市 · 精灵球工厂', en: 'KALOS'},
];
const T_VOLT = bf(45);
const T_MASTER = bf(47);
const V = {x: 1180, y: 560, size: 330};

export const FactoryLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_FACTORY - 2 || f > bf(50) + 2) return null;
	// 节点和名称卡在大师球出现前退场；点阵只压暗，留到第 50 小节
	const out = 1 - smooth(prog(f, bf(46, 2), bf(47)));
	const dotsP = lerp(0, 1.15, smooth(prog(f, bf(43, 2), bf(46))));
	const dotsDim = lerp(0.6, 0.3, smooth(prog(f, T_VOLT - 10, T_VOLT + 10))) * lerp(1, 0.45, smooth(prog(f, bf(46, 2), T_MASTER)));
	const dotsO = 1 - smooth(prog(f, bf(49), bf(50)));
	// 霹雳电球：从左边滚进来，第 45 小节强拍停住；第 46 小节第 3 拍起往右滚出画面
	const roll = easeOutCubic(prog(f, bf(44, 2), T_VOLT));
	const exit = easeInQuad(prog(f, bf(46, 2), bf(47, 1)));
	const vx = lerp(-260, V.x, roll) + (2300 - V.x) * exit;
	const spin = ((vx - V.x) / (Math.PI * V.size * 0.5)) * 360;
	const wob = f > T_VOLT ? Math.exp(-(f - T_VOLT) / 10) * Math.sin((f - T_VOLT) * 0.7) * 6 : 0;
	return (
		<>
		<Dots f={f} src={[{x: NODES[0].x, y: NODES[0].y + 40}, {x: NODES[1].x, y: NODES[1].y + 40}, {x: NODES[2].x, y: NODES[2].y + 40}]} progress={dotsP} dim={dotsDim} topFade={380} o={dotsO} />
		<div style={{position: 'absolute', inset: 0, opacity: out}}>
			{NODES.map((n, i) => {
				const t = bf(43, 1 + i);
				const k = smooth(prog(f, t, t + 10));
				const ping = f >= t ? Math.exp(-(f - t) / 10) : 0;
				return (
					<div key={i} style={{opacity: k}}>
						<div style={{position: 'absolute', left: n.x - 9, top: n.y - 9, width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${gold(0.95)}`, background: `rgba(${COLORS.goldRgb},0.35)`, boxShadow: `0 0 ${10 + 30 * ping}px rgba(${COLORS.glowRgb},${0.5 + 0.5 * ping})`}} />
						<div style={{position: 'absolute', left: n.x - 40 - 40 * (1 - ping), top: n.y - 40 - 40 * (1 - ping), width: 80 + 80 * (1 - ping), height: 80 + 80 * (1 - ping), borderRadius: '50%', border: `1px solid rgba(${COLORS.goldRgb},${0.6 * ping})`}} />
						<div style={{position: 'absolute', left: n.x - 200, width: 400, top: n.y - 66, textAlign: 'center', fontFamily: SERIF, fontSize: 21, letterSpacing: 5, color: COLORS.parchment, textShadow: '0 0 12px rgba(0,0,0,0.95)'}}>{n.zh}</div>
						<div style={{position: 'absolute', left: n.x - 200, width: 400, top: n.y - 92, textAlign: 'center', fontFamily: CINZEL, fontSize: 13, letterSpacing: 5, color: gold(0.6)}}>{n.en}</div>
					</div>
				);
			})}
		</div>
			{f >= bf(44, 2) && f < bf(47, 1) + 2 && (
				<>
					<div
						style={{
							position: 'absolute',
							left: vx - V.size / 2,
							top: V.y - V.size / 2,
							width: V.size,
							height: V.size,
							transform: `rotate(${spin + wob}deg)`,
							background: 'radial-gradient(ellipse 45% 45% at 50% 50%, rgba(0,0,0,0.0), rgba(0,0,0,0))',
						}}
					>
						<PokemonArt3D
							dir="pokemon/voltorb"
							x={V.size / 2}
							y={V.size / 2}
							size={V.size}
							depthScale={0.5}
							ambient={[0.42, 0.38, 0.34]}
							dirLights={[
								{dir: [-0.6, -0.65, 0.5], color: [1.1, 0.95, 0.75], wrap: 0.3},
								{dir: [0.7, 0.3, 0.3], color: [0.25, 0.18, 0.1], wrap: 0.4},
							]}
							rim={{dir: [0.7, -0.6], color: [1.0, 0.72, 0.38], power: 2.2}}
						/>
					</div>
					<NameTag from={T_VOLT + 4} x={V.x + V.size / 2 + 50} y={V.y - 110} no="No.0100" category="球宝可梦" categoryEn="BALL POKÉMON" zh="霹雳电球" en="VOLTORB" opacity={1 - smooth(prog(f, bf(46), bf(46, 2)))} />
				</>
			)}
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 11–13 段：大师球 → 赤日不要它、造出锁链 → 球与锁链 → 大师球被撑碎
// ════════════════════════════════════════════════════════════════════════

const T_REJECT = bf(50);
const T_CHAIN = bf(51);
const T_MIRROR = bf(52);
const T_BREAK = bf(54);
const T_END = bf(56);
const MC = {x: 960, y: 445};
/** 点阵里的一颗变成紫色，升起、放大成大师球 */
const T_RISE = bf(46, 3);
const RISE_FROM = {x: 960, y: 760};

const BigChain: React.FC<{t: number; glow: number}> = ({t, glow}) => {
	const links = [-240, -120, 0, 120, 240];
	return (
		<svg width={700} height={240} viewBox="-350 -120 700 240" style={{overflow: 'visible', filter: `drop-shadow(0 0 ${8 + 26 * glow}px rgba(220,60,40,${0.4 + 0.5 * glow}))`}}>
			{links.map((x, i) => (
				<g key={i} transform={`translate(${x} 0)`} fill="none">
					{i % 2 === 0 ? (
						<>
							<rect x={-78} y={-42} width={156} height={84} rx={42} stroke="#a3241e" strokeWidth={17} {...(draw(t * 1.8 - i * 0.18) as object)} />
							<rect x={-78} y={-42} width={156} height={84} rx={42} stroke="rgba(255,190,150,0.7)" strokeWidth={2.2} {...(draw(t * 1.8 - i * 0.18) as object)} />
						</>
					) : (
						<>
							<rect x={-74} y={-9} width={148} height={18} rx={9} stroke="#8e1c16" strokeWidth={15} {...(draw(t * 1.8 - i * 0.18) as object)} />
							<rect x={-74} y={-9} width={148} height={18} rx={9} stroke="rgba(255,190,150,0.6)" strokeWidth={2} {...(draw(t * 1.8 - i * 0.18) as object)} />
						</>
					)}
				</g>
			))}
		</svg>
	);
};

/** 大师球碎片：把图分成几块多边形，各自飞散 */
const SHARDS = [
	{poly: '0% 0%, 55% 0%, 48% 38%, 0% 46%', dx: -1, dy: -1},
	{poly: '55% 0%, 100% 0%, 100% 40%, 48% 38%', dx: 1, dy: -1},
	{poly: '0% 46%, 48% 38%, 40% 70%, 0% 100%', dx: -1.2, dy: 0.4},
	{poly: '48% 38%, 100% 40%, 100% 72%, 60% 64%', dx: 1.2, dy: 0.2},
	{poly: '40% 70%, 48% 38%, 60% 64%, 66% 100%, 0% 100%', dx: -0.3, dy: 1.1},
	{poly: '60% 64%, 100% 72%, 100% 100%, 66% 100%', dx: 0.8, dy: 1.1},
];

export const MasterLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_RISE - 2 || f > T_END + BEAT * 3) return null;
	const ballIn = 1;
	const pop = 1 + 0.06 * Math.sin(Math.PI * sat(prog(f, T_MASTER, T_MASTER + 12)));
	const gauge = easeOutCubic(prog(f, T_MASTER + 4, bf(48)));
	const gaugeO = 1 - smooth(prog(f, bf(48, 2), bf(49)));
	// 赤日：球被推开、压暗
	const reject = easeInQuad(prog(f, T_REJECT, T_REJECT + BEAT * 1.5));
	// 球与锁链：左边洗翠的起源球，右边被丢下的大师球
	const mirror = smooth(prog(f, T_MIRROR + 4, T_MIRROR + 26));
	const mirrorOut = smooth(prog(f, bf(53, 2), bf(53, 3)));
	// 碎裂：大师球回到中央，内里的太晶光越来越亮、出现裂纹，强拍碎开
	const back = smooth(prog(f, bf(53, 2), bf(53, 3) + 4));
	const charge = prog(f, bf(53, 2), T_BREAK);
	const broken = f >= T_BREAK;
	const burst = broken ? easeOutCubic(prog(f, T_BREAK, T_BREAK + 40)) : 0;

	let ball = {x: MC.x, y: MC.y, s: 300 * pop, o: ballIn};
	if (f < T_MASTER) {
		const r = prog(f, T_RISE, T_MASTER);
		ball = {x: MC.x, y: lerp(RISE_FROM.y, MC.y, smooth(r)), s: lerp(18, 300, easeInQuad(r)), o: smooth(prog(f, T_RISE - 2, T_RISE + 4))};
	}
	if (f >= T_REJECT && f < bf(53, 2)) ball = {x: lerp(MC.x, 1520, reject), y: lerp(MC.y, 600, reject), s: lerp(300, 150, reject), o: lerp(1, 0.45, reject) * (1 - 0.0 * mirrorOut)};
	if (f >= bf(53, 2)) ball = {x: lerp(1520, MC.x, back), y: lerp(600, MC.y, back), s: lerp(150, 300, back), o: 0.45 + 0.55 * back};

	const chainT = prog(f, T_CHAIN, T_MIRROR);
	const clamp = f >= T_MIRROR ? Math.exp(-(f - T_MIRROR) / 8) : 0;
	const chainO = (f >= T_CHAIN ? 1 : 0) * (1 - smooth(prog(f, bf(53, 1), bf(53, 2))));

	// 太乐巴戈斯（星晶形态）
	const TP = {x: 960, y: 440, size: 760};
	const tpO = broken ? smooth(prog(f, T_BREAK, T_BREAK + 6)) * (1 - 0.5 * smooth(prog(f, bf(55, 2), T_END))) * (1 - smooth(prog(f, T_END, bf(56, 2)))) : 0;
	const prism = broken ? Math.exp(-(f - T_BREAK) / 14) : 0;

	return (
		<>
			{/* 太乐巴戈斯在最后面 */}
			{tpO > 0.002 && (
				<div style={{position: 'absolute', inset: 0, opacity: tpO}}>
					<div style={{position: 'absolute', left: TP.x - 500, top: TP.y - 500, width: 1000, height: 1000, borderRadius: '50%', background: `radial-gradient(circle, rgba(160,235,255,${0.35 * prism + 0.1}) 0%, rgba(200,160,255,${0.2 * prism + 0.05}) 30%, rgba(0,0,0,0) 62%)`}} />
					<PokemonArt3D
						dir="pokemon/terapagos"
						variant="-stellar"
						x={TP.x}
						y={TP.y - 20 * burst}
						size={TP.size * (0.92 + 0.08 * burst)}
						depthScale={0.4}
						ambient={[0.7 + 0.5 * prism, 0.72 + 0.5 * prism, 0.78 + 0.5 * prism]}
						dirLights={[{dir: [-0.5, -0.7, 0.5], color: [0.4, 0.38, 0.35], wrap: 0.3}]}
						rim={{dir: [0.6, -0.7], color: [0.7, 0.9, 1.1], power: 2.0}}
						emissive={0.4 + 0.8 * prism}
						emissiveTint={[0.8, 0.95, 1.0]}
					/>
				</div>
			)}

			{/* 捕获率：一圈满格 */}
			{gaugeO > 0.002 && f >= T_MASTER && (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: gaugeO * ballIn}}>
					<circle cx={MC.x} cy={MC.y} r={205} fill="none" stroke={gold(0.18)} strokeWidth={6} />
					<circle cx={MC.x} cy={MC.y} r={205} fill="none" stroke={gold(0.95)} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={`${gauge} 1`} transform={`rotate(-90 ${MC.x} ${MC.y})`} style={{filter: `drop-shadow(0 0 8px rgba(${COLORS.glowRgb},0.7))`}} />
				</svg>
			)}
			{gaugeO > 0.002 && f >= T_MASTER && (
				<div style={{position: 'absolute', left: MC.x - 200, width: 400, top: MC.y + 228, textAlign: 'center', opacity: gaugeO * smooth(prog(f, T_MASTER + 6, T_MASTER + 20))}}>
					<div style={{fontFamily: CINZEL, fontSize: 44, fontWeight: 600, letterSpacing: 4, color: COLORS.gold}}>{Math.round(100 * gauge)}%</div>
					<div style={{fontFamily: SERIF, fontSize: 18, letterSpacing: 6, color: COLORS.parchmentDim}}>必定能捉到野生宝可梦</div>
				</div>
			)}

			{/* 左：洗翠——锁链的碎片做成了起源球 */}
			{mirror > 0.002 && mirrorOut < 1 && (
				<div style={{position: 'absolute', inset: 0, opacity: mirror * (1 - mirrorOut)}}>
					<Sprite src="items/la/origin.png" x={400} y={600} size={130} glow={0.6} />
					<Label x={400} y={680} zh="洗翠" en="HISUI" o={1} size={20} />
					<Label x={1520} y={680} zh="赤日" en="CYRUS" o={1} size={20} />
					<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
						<path d={`M 400 520 C 460 420 600 400 700 430`} fill="none" stroke={gold(0.5)} strokeWidth={1.2} strokeDasharray="5 6" />
						<path d={`M 1520 520 C 1460 420 1320 400 1220 430`} fill="none" stroke="rgba(200,70,50,0.6)" strokeWidth={1.2} strokeDasharray="5 6" />
					</svg>
				</div>
			)}

			{/* 赤日的红色锁链 */}
			{chainO > 0.002 && (
				<div style={{position: 'absolute', left: MC.x - 350, top: 330 - 120, opacity: chainO, transform: `scale(${1 + 0.06 * clamp})`}}>
					<BigChain t={chainT} glow={clamp + 0.3} />
				</div>
			)}
			{clamp > 0.02 && <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 40% 30% at 50% 30%, rgba(255,120,90,${0.35 * clamp}), rgba(0,0,0,0) 70%)`}} />}

			{/* 大师球（碎前） */}
			{!broken && ball.o > 0.002 && f >= T_RISE - 2 && (
				<>
					<Sprite src="items/masterball.png" x={ball.x} y={ball.y} size={ball.s} o={ball.o} glow={0.3 + 1.2 * charge * charge} style={{filter: `drop-shadow(0 0 ${10 + 40 * charge}px rgba(150,230,255,${0.3 + 0.6 * charge})) drop-shadow(0 6px 6px rgba(0,0,0,0.7))`}} />
					{charge > 0 && (
						<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
							{[
								`M ${ball.x - 10} ${ball.y - 140} L ${ball.x + 6} ${ball.y - 70} L ${ball.x - 18} ${ball.y - 20} L ${ball.x + 10} ${ball.y + 40}`,
								`M ${ball.x + 140} ${ball.y - 10} L ${ball.x + 70} ${ball.y + 4} L ${ball.x + 30} ${ball.y - 30}`,
								`M ${ball.x - 130} ${ball.y + 50} L ${ball.x - 60} ${ball.y + 30} L ${ball.x - 18} ${ball.y - 20}`,
								`M ${ball.x + 10} ${ball.y + 40} L ${ball.x + 40} ${ball.y + 130}`,
							].map((d, i) => (
								<path key={i} d={d} fill="none" stroke={`rgba(200,245,255,${0.9 * charge})`} strokeWidth={2.4} strokeLinecap="round" style={{filter: 'drop-shadow(0 0 6px rgba(150,230,255,0.9))'}} {...draw(charge * 1.6 - i * 0.2)} />
							))}
						</svg>
					)}
				</>
			)}

			{/* 碎片飞散 */}
			{broken && burst < 1 && (
				<div style={{position: 'absolute', inset: 0, opacity: 1 - smooth(prog(f, T_BREAK + 20, T_BREAK + 44))}}>
					{SHARDS.map((s, i) => (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: MC.x - 150 + s.dx * 260 * burst,
								top: MC.y - 150 + s.dy * 220 * burst + 120 * burst * burst,
								width: 300,
								height: 300,
								clipPath: `polygon(${s.poly})`,
								transform: `rotate(${(i % 2 ? 1 : -1) * 70 * burst}deg)`,
							}}
						>
							<Img src={staticFile('items/masterball.png')} style={{width: 300, height: 300}} />
						</div>
					))}
				</div>
			)}
			{broken && prism > 0.02 && <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, rgba(220,250,255,${0.75 * prism}) 0%, rgba(190,170,255,${0.3 * prism}) 25%, rgba(0,0,0,0) 55%)`}} />}
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 14 段：收尾——画作《精灵球工厂》，回到开场那颗球，淡出
// ════════════════════════════════════════════════════════════════════════

/** 第 31 句：画作说明 */
const T_PAINT_LINE = bf(58);
/** 第 32 句：画作退场，球回到中央 */
const T_LAST = bf(60);
/** 原曲第 62 小节起自然淡出，画面跟着淡到黑 */
const T_FADE = bf(62);
const PAINT = {x: 570, y: 470};

export const EndingLayer: React.FC<{f: number}> = ({f}) => {
	if (f < bf(55, 2)) return null;
	// 画作在太乐巴戈斯淡出的同一小节里淡入
	const paint = smooth(prog(f, bf(55, 3), bf(56, 3))) * (1 - smooth(prog(f, T_LAST - 6, T_LAST + 14)));
	const ballIn = smooth(prog(f, bf(56, 1), bf(56, 3)));
	const center = smooth(prog(f, T_LAST - 4, T_LAST + 30));
	// 第 31 句"不断增多的精灵球"：点阵从球周围长出来
	const dotsP = lerp(0, 1.15, smooth(prog(f, T_PAINT_LINE, T_LAST + BEAT * 2)));
	const dotsO = 0.75 * (1 - 0.6 * smooth(prog(f, T_LAST + 20, bf(61, 2))));
	const caption = smooth(prog(f, T_PAINT_LINE, T_PAINT_LINE + 18));
	const bx = lerp(1340, 960, center);
	const by = lerp(470, 500, center);
	const idle = Math.sin(f / 55) * 7;
	// 太乐巴戈斯的碎光飘落，落进画里
	const fall = prog(f, bf(55, 2), bf(56, 3));
	return (
		<>
			<Dots f={f} src={[{x: bx, y: by}, {x: bx, y: by}, {x: bx, y: by}]} progress={dotsP} dim={0.32} o={dotsO} />
			{fall > 0 && fall < 1 && (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					{Array.from({length: 16}, (_, i) => {
						const d = (i * 0.037) % 0.3;
						const u = smooth(sat((fall - d) / 0.7));
						if (u <= 0 || u >= 1) return null;
						const sx = 960 + Math.cos(i * 2.4) * (120 + (i % 5) * 40);
						const sy = 440 + Math.sin(i * 2.4) * (100 + (i % 4) * 30);
						const tx = PAINT.x + Math.cos(i * 1.7) * 250;
						const ty = PAINT.y + Math.sin(i * 1.3) * 160;
						const x = lerp(sx, tx, u);
						const y = lerp(sy, ty, u) - 60 * Math.sin(Math.PI * u);
						const a = Math.sin(Math.PI * u);
						return <circle key={i} cx={x} cy={y} r={2.2 + (i % 3)} fill={`rgba(${Math.round(lerp(190, 255, u))},${Math.round(lerp(240, 214, u))},${Math.round(lerp(255, 150, u))},${0.85 * a})`} style={{filter: 'drop-shadow(0 0 6px rgba(255,220,160,0.8))'}} />;
					})}
				</svg>
			)}
			{paint > 0.002 && (
				<div style={{position: 'absolute', left: PAINT.x - 320, top: 250, width: 640, opacity: paint}}>
					<div style={{padding: 10, background: 'linear-gradient(135deg, rgba(120,88,44,0.9), rgba(60,40,18,0.9))', boxShadow: `0 0 0 1px rgba(${COLORS.goldRgb},0.7), 0 14px 30px rgba(0,0,0,0.7)`}}>
						<Img src={staticFile('items/za/factory-painting.png')} style={{width: 620, height: 420, display: 'block', objectFit: 'cover', filter: 'saturate(0.85) brightness(0.9)'}} />
					</div>
					{/* 说明牌：第 31 句起放大成一行小标题，交代这是密阿雷美术馆的画 */}
					<div style={{position: 'relative', marginTop: 14, height: 60, textAlign: 'center'}}>
						<div style={{position: 'absolute', inset: 0, fontFamily: SERIF, fontSize: 18, letterSpacing: 5, color: COLORS.parchmentDim, opacity: 1 - caption}}>《精灵球工厂》</div>
						<div style={{position: 'absolute', inset: 0, opacity: caption, transform: `translateY(${6 * (1 - caption)}px)`}}>
							<div style={{fontFamily: SERIF, fontSize: 27, letterSpacing: 6, color: COLORS.parchment, textShadow: `0 0 14px rgba(${COLORS.glowRgb},0.35)`}}>密阿雷美术馆 ·《精灵球工厂》</div>
							<div style={{marginTop: 4, fontFamily: CINZEL, fontSize: 12, letterSpacing: 4, color: gold(0.55)}}>LUMIOSE MUSEUM · POKÉ BALL FACTORY</div>
						</div>
					</div>
				</div>
			)}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: ballIn}}>
				<ellipse cx={bx} cy={by + 150 * 0.98} rx={250} ry={34} fill="none" stroke={gold(0.5)} strokeWidth={1.3} />
				<ellipse cx={bx} cy={by + 150 * 0.98} rx={300} ry={41} fill="none" stroke={gold(0.2)} strokeWidth={1} />
			</svg>
			<ModernBall f={f} p={{x: bx, y: by, r: lerp(120, 150, center), yaw: -16 + idle, pitch: 14, roll: -5, glow: 0.22 + 0.2 * center, opacity: ballIn}} />
		</>
	);
};

/** 原曲第 62 小节起的尾音：整体淡到黑（标签、字幕也一起），与音乐同时结束 */
export const FINAL_FADE_FROM = T_FADE;
export const finalFade = (f: number) => smooth(prog(f, T_FADE, TOTAL_FRAMES - 2));
