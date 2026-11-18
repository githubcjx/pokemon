import {Img, staticFile} from 'remotion';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {COLORS} from '../../theme';
import {BEAT, bf, easeInQuad, easeOutCubic, lerp, prog, sat, smooth} from './common';
import {draw, GOLD, gold, GRID, GRID_SHIFT, HisuiBall, Label, StoneIcon} from './Part1Layers';

// ════════════════════════════════════════════════════════════════════════
// 第 5 段：洗翠顽皮雷弹——长得像当时的球
// ════════════════════════════════════════════════════════════════════════

const E = {x: 1330, y: 430, size: 380};
const T_E = bf(20);
/** 一颗洗翠精灵球从九宫格"精灵球"那一格飞出、放大，在这里变成顽皮雷弹的剪影 */
const T_MORPH = bf(20, 1.5);
/** 显色完成（放叫声） */
export const T_E_COLOR = bf(21);
const T_E_DEX = bf(21, 2);
/** 顽皮雷弹缩回画面中央，变回部族段中间那颗球 */
const T_E_BACK = bf(22, 2);
const T_CLANS = bf(23);
/** 九宫格左移前 / 后"精灵球"那一格的位置 */
const CELL0 = {x: GRID.cx - GRID.step, y: GRID.cy - GRID.step - 12};
const CELL = {x: GRID.cx + GRID_SHIFT - GRID.step, y: GRID.cy - GRID.step - 12};
/** 部族段中间那颗洗翠精灵球 */
export const CLAN_BALL = {x: 960, y: 450, s: 230};

export const ElectrodeLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_E || f > T_CLANS + 4) return null;
	// 飞出的球：从格子里浮起，沿弧线飞到右侧并放大
	const fly = smooth(prog(f, T_E, T_MORPH + 6));
	const flyP = {x: lerp(CELL0.x, E.x, fly), y: lerp(CELL0.y, E.y, fly) - 90 * Math.sin(Math.PI * fly)};
	const flyS = lerp(GRID.sprite, E.size, fly);
	const flyO = smooth(prog(f, T_E - 1, T_E + 4)) * (1 - smooth(prog(f, T_MORPH, T_MORPH + 12)));
	// 顽皮雷弹：先是剪影，再显色
	const appear = smooth(prog(f, T_MORPH - 2, T_MORPH + 10));
	const dark = 1 - smooth(prog(f, T_MORPH + 8, T_E_COLOR));
	// 回到中间：缩成部族段那颗球
	const back = smooth(prog(f, T_E_BACK, T_CLANS));
	const eP = {x: lerp(E.x, CLAN_BALL.x, back), y: lerp(E.y, CLAN_BALL.y, back)};
	const eScale = lerp(1, CLAN_BALL.s / E.size, back);
	const eO = appear * (1 - smooth(prog(f, T_E_BACK + 6, T_CLANS)));
	const bob = Math.sin((f - T_E) / 28) * 5 * (1 - back);
	const link = prog(f, T_E_DEX, T_E_DEX + 26);
	const linkO = (link > 0 ? 1 : 0) * (1 - smooth(prog(f, T_E_BACK - 8, T_E_BACK + 6)));
	const tagO = 1 - smooth(prog(f, T_E_BACK - 8, T_E_BACK + 8));
	const flash = Math.exp(-Math.max(0, f - T_E_COLOR) / 10) * (f >= T_E_COLOR ? 1 : 0);
	const mask = `url(${staticFile('pokemon/electrode/art-hisui.png')})`;
	return (
		<>
			{flyO > 0.003 && <HisuiBall x={flyP.x} y={flyP.y} scale={flyS} rot={-25 * fly} glow={0.4 * Math.sin(Math.PI * fly)} o={flyO} />}
			{eO > 0.003 && (
				<div style={{position: 'absolute', left: eP.x - E.size / 2, top: eP.y + bob - E.size / 2, width: E.size, height: E.size, opacity: eO, transform: `scale(${eScale})`}}>
					<PokemonArt3D
						dir="pokemon/electrode"
						variant="-hisui"
						x={E.size / 2}
						y={E.size / 2}
						size={E.size}
						depthScale={0.5}
						yaw={-6 + 4 * Math.sin((f - T_E) / 60)}
						ambient={[0.4, 0.35, 0.3]}
						dirLights={[
							{dir: [-0.6, -0.65, 0.5], color: [1.15 + 0.6 * flash, 0.98 + 0.5 * flash, 0.75 + 0.3 * flash], wrap: 0.3},
							{dir: [0.7, 0.3, 0.3], color: [0.3, 0.2, 0.1], wrap: 0.4},
						]}
						rim={{dir: [0.7, -0.6], color: [1.0, 0.72, 0.38], power: 2.2}}
					/>
					{dark > 0.003 && (
						<div
							style={{
								position: 'absolute',
								inset: 0,
								opacity: dark,
								background: 'radial-gradient(circle at 45% 38%, #4a3520 0%, #22180d 60%, #100a05 100%)',
								WebkitMaskImage: mask,
								maskImage: mask,
								WebkitMaskSize: 'contain',
								maskSize: 'contain',
								filter: `drop-shadow(0 0 3px rgba(255,200,120,${0.55 * dark})) drop-shadow(0 0 18px rgba(255,180,90,${0.3 * dark}))`,
							}}
						/>
					)}
				</div>
			)}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: linkO}}>
				<circle cx={E.x} cy={E.y} r={212} fill="none" stroke={gold(0.6)} strokeWidth={1.4} strokeDasharray="5 8" pathLength={1000} strokeDashoffset={1000 * (1 - link) - f * 0.5} />
				<circle cx={CELL.x} cy={CELL.y} r={76} fill="none" stroke={gold(0.75)} strokeWidth={1.4} strokeDasharray="5 8" pathLength={1000} strokeDashoffset={1000 * (1 - link) - f * 0.5} />
				<path d={`M ${E.x - 214} ${E.y - 10} C ${E.x - 420} ${E.y - 120} ${CELL.x + 260} ${CELL.y - 120} ${CELL.x + 78} ${CELL.y - 6}`} fill="none" stroke={gold(0.6)} strokeWidth={1.2} strokeDasharray="4 6" {...draw(link * 1.3 - 0.2)} />
			</svg>
			<NameTag from={bf(20, 3)} x={E.x} y={E.y + 222} align="center" no="No.0101" category="丸宝可梦" categoryEn="SPHERE POKÉMON" zh="顽皮雷弹" en="HISUIAN ELECTRODE" opacity={tagO} />
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 6–7 段：两个部族 → 起源球
// ════════════════════════════════════════════════════════════════════════

const C = {x: CLAN_BALL.x, y: CLAN_BALL.y};
const DIAMOND = {x: 470, y: 450};
const PEARL = {x: 1450, y: 450};
/** 第 14 句：见过主角之后，断开的连线合上 */
const T_IRIDA = bf(24);
/** 第 15 句：帕路奇亚狂暴，三样东西依次出现 */
const T_RAGE = bf(26);
const T_VESSEL = bf(27);
const T_FORGE = bf(29, 2);
const T_ORIGIN = bf(30);
const T_SETTLE = bf(32);
const T_MUSEUM = bf(34);

const Emblem: React.FC<{src: string; p: {x: number; y: number}; o: number; s: number}> = ({src, p, o, s}) => (
	<div
		style={{
			position: 'absolute',
			left: p.x - 105,
			top: p.y - 105,
			width: 210,
			height: 210,
			opacity: o,
			transform: `scale(${s})`,
			filter: `sepia(1) saturate(1.6) hue-rotate(-12deg) brightness(0.92) contrast(1.1) drop-shadow(0 0 14px rgba(${COLORS.glowRgb},0.3))`,
		}}
	>
		<Img src={staticFile(src)} style={{width: 210, height: 210}} />
	</div>
);

/** 断开的红色锁链：四节散开的链环 */
const BrokenChain: React.FC<{t: number}> = ({t}) => {
	const links = [
		{x: -70, y: -10, r: -30},
		{x: -18, y: 22, r: 40},
		{x: 30, y: -18, r: -10},
		{x: 76, y: 16, r: 55},
	];
	return (
		<svg width={260} height={220} viewBox="-130 -110 260 220" style={{overflow: 'visible'}}>
			{links.map((l, i) => (
				<g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.r})`} fill="none">
					<rect x={-28} y={-16} width={56} height={32} rx={16} stroke="#a3241e" strokeWidth={8} {...(draw(t * 1.6 - i * 0.15) as object)} />
					<rect x={-28} y={-16} width={56} height={32} rx={16} stroke={gold(0.8)} strokeWidth={1.3} {...(draw(t * 1.6 - i * 0.15) as object)} />
				</g>
			))}
		</svg>
	);
};

export const ClansOriginLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_E_BACK || f > T_MUSEUM + BEAT * 3) return null;
	// ── 部族 ──
	const dIn = smooth(prog(f, T_CLANS, T_CLANS + 14));
	const pIn = smooth(prog(f, bf(23, 2), bf(23, 2) + 14));
	// 帕路奇亚狂暴时，部族徽记退场，位置让给三样东西
	const clansOut = smooth(prog(f, T_RAGE + BEAT, bf(27)));
	// 顽皮雷弹缩回到这里时，接成这颗球
	const ballIn = smooth(prog(f, T_E_BACK + 6, T_CLANS));
	// 连线：先断开（各留一段空隙），第 14 句起空隙慢慢合上
	const lineDraw = prog(f, bf(23, 3), bf(23, 3) + 22);
	const close = smooth(prog(f, T_IRIDA + 6, bf(25, 2)));
	const gap = lerp(120, 0, close);
	const bond = smooth(prog(f, bf(25), bf(25, 2))) * (1 - 0.6 * smooth(prog(f, T_RAGE, T_RAGE + BEAT)));

	// ── 三样东西（与开场同构） ──
	const stoneT = prog(f, T_VESSEL, T_VESSEL + 24);
	const chainT = prog(f, bf(27, 2), bf(27, 2) + 24);
	const ringT = prog(f, bf(28), bf(28) + 18);
	const forge = easeInQuad(prog(f, T_FORGE, T_ORIGIN));
	const flash = f >= T_ORIGIN ? Math.exp(-(f - T_ORIGIN) / 9) : 0;
	const thingsO = (1 - forge) * (1 - smooth(prog(f, T_ORIGIN - 4, T_ORIGIN)));
	const stoneP = {x: lerp(DIAMOND.x, C.x, forge), y: lerp(DIAMOND.y, C.y, forge)};
	const chainP = {x: lerp(PEARL.x, C.x, forge), y: lerp(PEARL.y, C.y, forge)};

	// ── 起源帕路奇亚：先是暗影，强拍显色，再化光缩进球里 ──
	const PALKIA = {x: 960, y: 455, size: 860};
	// 第 15 句起暗影慢慢浮现（一个半小节）
	const shadowIn = smooth(prog(f, T_RAGE, bf(27, 2)));
	const colorPeak = f >= T_ORIGIN ? Math.min(1, (f - T_ORIGIN) / 3) * Math.exp(-Math.max(0, f - T_ORIGIN - 3) / 16) : 0;
	const silhouette = smooth(prog(f, T_ORIGIN + 8, T_ORIGIN + 20));
	const shrink = easeInQuad(prog(f, T_ORIGIN + 20, bf(31, 2)));
	const palkiaO = shadowIn * (f < bf(31, 2) + 2 ? 1 : 0);

	// ── 球：洗翠精灵球 → 起源球（强拍替换）→ 摇三下 → 收服 ──
	const hisuiO = ballIn * (f < T_ORIGIN ? 1 : 0);
	const shakes = [bf(31, 2), bf(31, 3), bf(32)].reduce((acc, t) => acc + (f >= t ? Math.exp(-(f - t) / 4) * Math.sin((f - t) * 1.1) * 12 : 0), 0);
	const caught = f >= T_SETTLE + BEAT ? Math.exp(-(f - T_SETTLE - BEAT) / 12) : 0;
	// 进美术馆：起源球留在原位，用一小节慢慢放大、下移到展柜里那颗球的位置，同时淡成普通的洗翠精灵球
	const toCase = smooth(prog(f, bf(33), bf(34, 2)));
	const originO = (f >= T_ORIGIN ? 1 : 0) * (1 - smooth(prog(f, bf(33, 2), bf(34, 2))));
	const oP = {x: C.x, y: lerp(C.y, CASE_BALL.y, toCase), s: lerp(180, CASE_BALL.s, toCase)};
	const originGlow = 0.35 + 0.65 * flash + 0.5 * Math.sin(Math.PI * prog(f, T_ORIGIN + 20, bf(31, 2))) + caught;

	return (
		<>
			{/* 起源帕路奇亚（在最后面） */}
			{palkiaO > 0.002 && (
				<div
					style={{
						position: 'absolute',
						left: lerp(PALKIA.x, C.x, shrink) - PALKIA.size / 2,
						top: lerp(PALKIA.y, C.y, shrink) - PALKIA.size / 2,
						width: PALKIA.size,
						height: PALKIA.size,
						opacity: palkiaO,
						transform: `scale(${lerp(1, 0.02, shrink)})`,
					}}
				>
					<div style={{position: 'absolute', inset: 0, opacity: 1 - 0.8 * silhouette}}>
						<PokemonArt3D
							dir="pokemon/palkia"
							variant="-origin"
							x={PALKIA.size / 2}
							y={PALKIA.size / 2}
							size={PALKIA.size}
							depthScale={0.45}
							yaw={-4 + 3 * Math.sin(f / 40)}
							ambient={[lerp(0.16, 0.72, colorPeak), lerp(0.13, 0.68, colorPeak), lerp(0.2, 0.7, colorPeak)]}
							dirLights={[{dir: [-0.5, -0.7, 0.5], color: [lerp(0.12, 0.45, colorPeak), lerp(0.1, 0.4, colorPeak), lerp(0.18, 0.36, colorPeak)], wrap: 0.3}]}
							rim={{dir: [0.6, -0.7], color: [0.75, 0.45, 0.95], power: 2.2}}
							brightness={lerp(0.55, 1, colorPeak)}
						/>
					</div>
					<div
						style={{
							position: 'absolute',
							inset: 0,
							opacity: silhouette * 0.9,
							background: 'radial-gradient(circle at 50% 42%, #ffe7b0 0%, #e8b05a 40%, #a8601e 85%, #7a3e12 100%)',
							WebkitMaskImage: `url(${staticFile('pokemon/palkia/art-origin.png')})`,
							maskImage: `url(${staticFile('pokemon/palkia/art-origin.png')})`,
							WebkitMaskSize: 'contain',
							maskSize: 'contain',
							filter: 'drop-shadow(0 0 24px rgba(255,190,100,0.6))',
						}}
					/>
				</div>
			)}

			{/* 部族徽记与连线 */}
			{clansOut < 1 && (
				<div style={{position: 'absolute', inset: 0, opacity: 1 - clansOut}}>
					<Emblem src="items/clan/diamond.png" p={DIAMOND} o={dIn} s={lerp(1.15, 1, dIn)} />
					<Emblem src="items/clan/pearl.png" p={PEARL} o={pIn} s={lerp(1.15, 1, pIn)} />
					<Label x={DIAMOND.x} y={DIAMOND.y + 128} zh="金刚队" en="DIAMOND CLAN" o={dIn} />
					<Label x={PEARL.x} y={PEARL.y + 128} zh="珍珠队" en="PEARL CLAN" o={pIn} />
					<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
						{[
							{a: DIAMOND.x + 118, b: C.x - 132},
							{a: PEARL.x - 118, b: C.x + 132},
						].map((l, i) => {
							const mid = (l.a + l.b) / 2;
							const dir = Math.sign(l.b - l.a);
							const end1 = lerp(l.a, mid - (dir * gap) / 2, sat(lineDraw));
							const end2 = lerp(l.b, mid + (dir * gap) / 2, sat(lineDraw));
							const col = `rgba(${COLORS.goldRgb},${0.55 + 0.45 * bond})`;
							return (
								<g key={i} style={{filter: `drop-shadow(0 0 ${8 * bond}px rgba(${COLORS.glowRgb},${0.8 * bond}))`}}>
									<line x1={l.a} y1={C.y} x2={end1} y2={C.y} stroke={col} strokeWidth={1.4 + bond} strokeDasharray={bond > 0.5 ? undefined : '6 6'} />
									<line x1={l.b} y1={C.y} x2={end2} y2={C.y} stroke={col} strokeWidth={1.4 + bond} strokeDasharray={bond > 0.5 ? undefined : '6 6'} />
								</g>
							);
						})}
					</svg>
				</div>
			)}

			{/* 三样东西：宇宙起始之石、红色锁链的碎片、人造容器 */}
			{f >= T_VESSEL && thingsO > 0.002 && (
				<div style={{position: 'absolute', inset: 0, opacity: thingsO}}>
					<div style={{position: 'absolute', left: stoneP.x - 110, top: stoneP.y - 110, transform: `scale(${lerp(1, 0.3, forge)})`}}>
						<StoneIcon t={stoneT} />
					</div>
					<Label x={DIAMOND.x} y={DIAMOND.y + 128} zh="宇宙起始之石" o={smooth(prog(f, T_VESSEL + 10, T_VESSEL + 26)) * (1 - forge)} />
					<div style={{position: 'absolute', left: chainP.x - 130, top: chainP.y - 110, transform: `scale(${lerp(1, 0.3, forge)})`, opacity: chainT > 0 ? 1 : 0}}>
						<BrokenChain t={chainT} />
					</div>
					<Label x={PEARL.x} y={PEARL.y + 128} zh="红色锁链的碎片" o={smooth(prog(f, bf(27, 2) + 10, bf(27, 2) + 26)) * (1 - forge)} />
					<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: ringT > 0 ? 1 : 0}}>
						<circle cx={C.x} cy={C.y} r={lerp(178, 130, forge)} fill="none" stroke={gold(0.85)} strokeWidth={1.8} strokeDasharray="6 9" pathLength={1000} strokeDashoffset={1000 * (1 - ringT) + f * 0.8} style={{filter: `drop-shadow(0 0 10px rgba(${COLORS.glowRgb},0.5))`}} />
						{/* 汇聚的光线 */}
						{forge > 0 &&
							[stoneP, chainP].map((p, i) => <line key={i} x1={p.x} y1={p.y} x2={C.x} y2={C.y} stroke={`rgba(255,226,170,${0.6 * Math.sin(Math.PI * forge)})`} strokeWidth={3} strokeLinecap="round" />)}
					</svg>
					<Label x={C.x} y={C.y + 190} zh="人造容器" o={smooth(prog(f, bf(28) + 10, bf(28) + 26)) * (1 - forge)} />
				</div>
			)}

			{/* 洗翠精灵球 */}
			{hisuiO > 0.002 && <HisuiBall x={C.x} y={C.y} scale={230} glow={0.3 * bond + 1.2 * forge} o={hisuiO} />}

			{/* 强拍：闪光 + 起源球 */}
			{flash > 0.01 && (
				<div
					style={{
						position: 'absolute',
						left: C.x - 600,
						top: C.y - 600,
						width: 1200,
						height: 1200,
						borderRadius: '50%',
						background: `radial-gradient(circle, rgba(255,240,210,${0.9 * flash}) 0%, rgba(255,200,120,${0.45 * flash}) 22%, rgba(0,0,0,0) 60%)`,
					}}
				/>
			)}
			{originO > 0.002 && (
				<>
					<div
						style={{
							position: 'absolute',
							left: oP.x - 220,
							top: oP.y - 220,
							width: 440,
							height: 440,
							borderRadius: '50%',
							opacity: originO,
							background: `radial-gradient(circle, rgba(255,150,120,${0.28 * originGlow}) 0%, rgba(255,190,110,${0.16 * originGlow}) 35%, rgba(0,0,0,0) 70%)`,
						}}
					/>
					<div
						style={{
							position: 'absolute',
							left: oP.x - 90,
							top: oP.y - 90,
							width: 180,
							height: 180,
							opacity: originO * smooth(prog(f, T_ORIGIN, T_ORIGIN + 6)),
							transform: `rotate(${shakes}deg) scale(${(1 + 0.15 * flash) * (oP.s / 180)})`,
							filter: `drop-shadow(0 0 ${10 + 20 * originGlow}px rgba(255,170,120,${0.5 + 0.3 * sat(originGlow)})) drop-shadow(0 5px 5px rgba(0,0,0,0.7))`,
						}}
					>
						<Img src={staticFile('items/la/origin.png')} style={{width: 180, height: 180}} />
					</div>
				</>
			)}
			{/* 收服：小火花 */}
			{caught > 0.02 && (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					{Array.from({length: 14}, (_, i) => {
						const a = (i / 14) * Math.PI * 2;
						const t = 1 - caught;
						const r0 = 90 + 60 * t;
						return <line key={i} x1={C.x + Math.cos(a) * r0} y1={C.y + Math.sin(a) * r0} x2={C.x + Math.cos(a) * (r0 + 22)} y2={C.y + Math.sin(a) * (r0 + 22)} stroke={`rgba(255,226,160,${caught})`} strokeWidth={2} strokeLinecap="round" />;
					})}
				</svg>
			)}
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 8 段：展柜里的洗翠（现代 · 密阿雷美术馆）
// ════════════════════════════════════════════════════════════════════════

const T_PHOTO = bf(35, 1);
/** 展柜里那颗球在画面上的位置和大小（展柜整体先放大 1.18 倍，以 y=480 为原点） */
const CASE_BALL = {y: 480 + (300 + 150 + 20 - 480) * 1.18, s: 168 * 1.18};
const T_SOFT = bf(36);
/** 第三部分开头：展柜里的球交给钢铁段（Part3Layers 的 KurtLayer） */
export const T_KURT_HANDOFF = bf(38);
export const MUSEUM_BALL = {x: 640, y: 300 + 150 + 20, s: 168, glow: 0.3};

export const MuseumLayer: React.FC<{f: number}> = ({f}) => {
	if (f < bf(33, 2) || f > bf(38, 3)) return null;
	// 第三部分开头（第 38 小节）才淡出，不改动第二部分的画面
	const leave = 1 - smooth(prog(f, bf(38), bf(38, 1.5)));
	// 球先到位，展柜的线条再一笔一笔画在它周围
	const caseT = prog(f, bf(34, 1), bf(34, 1) + 44);
	const slide = smooth(prog(f, bf(34, 3), T_PHOTO + 14));
	const cx = lerp(960, 640, slide);
	const scale = lerp(1.18, 1, slide);
	const ballO = smooth(prog(f, bf(33, 2), bf(34, 2)));
	const photo = smooth(prog(f, T_PHOTO, T_PHOTO + 22));
	const soft = smooth(prog(f, T_SOFT, T_SOFT + 40));
	const W = 300;
	const H = 300;
	const top = 300;
	const ballY = top + H / 2 + 20;
	return (
		<div style={{position: 'absolute', inset: 0, opacity: leave, transformOrigin: `${cx}px ${ballY}px`, transform: `scale(${1 + 0.14 * (1 - leave)})`}}>
			<div style={{position: 'absolute', inset: 0, transformOrigin: `${cx}px 480px`, transform: `scale(${scale})`}}>
				<HisuiBall x={cx} y={ballY} scale={168} glow={0.15 + 0.15 * soft} o={ballO * (f < T_KURT_HANDOFF ? 1 : 0)} />
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					<g fill="none" stroke={gold(0.8)} strokeWidth={1.4} strokeLinejoin="round">
						{/* 玻璃罩：正面 + 顶面透视 */}
						<path d={`M ${cx - W / 2} ${top + H} L ${cx - W / 2} ${top} L ${cx + W / 2} ${top} L ${cx + W / 2} ${top + H}`} {...draw(caseT * 1.3)} />
						<path d={`M ${cx - W / 2} ${top} L ${cx - W / 2 + 40} ${top - 30} L ${cx + W / 2 + 40} ${top - 30} L ${cx + W / 2} ${top}`} opacity={0.6} {...draw(caseT * 1.3 - 0.2)} />
						<path d={`M ${cx + W / 2 + 40} ${top - 30} L ${cx + W / 2 + 40} ${top + H - 30} L ${cx + W / 2} ${top + H}`} opacity={0.45} {...draw(caseT * 1.3 - 0.3)} />
						{/* 玻璃反光 */}
						<path d={`M ${cx - W / 2 + 26} ${top + 40} L ${cx - W / 2 + 26} ${top + 150}`} stroke={gold(0.35)} strokeWidth={3} {...draw(caseT * 1.3 - 0.4)} />
						{/* 台座与说明牌 */}
						<path d={`M ${cx - W / 2 - 30} ${top + H} L ${cx + W / 2 + 30} ${top + H} L ${cx + W / 2 + 30} ${top + H + 64} L ${cx - W / 2 - 30} ${top + H + 64} Z`} {...draw(caseT * 1.3 - 0.1)} />
						<path d={`M ${cx - 70} ${top + H + 18} L ${cx + 70} ${top + H + 18} L ${cx + 70} ${top + H + 46} L ${cx - 70} ${top + H + 46} Z`} strokeWidth={1} opacity={0.8} {...draw(caseT * 1.3 - 0.35)} />
						{/* 球托 */}
						<path d={`M ${cx - 60} ${top + H} L ${cx - 40} ${ballY + 74} L ${cx + 40} ${ballY + 74} L ${cx + 60} ${top + H}`} opacity={0.7} {...draw(caseT * 1.3 - 0.25)} />
					</g>
					<rect x={cx - W / 2} y={top} width={W} height={H} fill={`rgba(255,230,190,${0.035 * sat(caseT * 2)})`} />
				</svg>
				<div style={{position: 'absolute', left: cx - 70, width: 140, top: top + H + 21, textAlign: 'center', fontFamily: SERIF, fontSize: 13, letterSpacing: 2, color: COLORS.parchmentDim, opacity: smooth(prog(f, bf(34, 1) + 30, bf(34, 1) + 46))}}>
					洗翠地区的精灵球
				</div>
			</div>

			{/* 游戏里的展品照片 */}
			{photo > 0 && (
				<div style={{position: 'absolute', left: 1010 + 40 * (1 - photo), top: 268, width: 660, opacity: photo}}>
					<div style={{padding: 10, background: 'linear-gradient(135deg, rgba(120,88,44,0.9), rgba(60,40,18,0.9))', boxShadow: `0 0 0 1px rgba(${COLORS.goldRgb},0.7), 0 14px 30px rgba(0,0,0,0.7)`}}>
						<Img src={staticFile('items/za/hisui-balls.png')} style={{width: 640, height: 360, display: 'block', filter: `sepia(${0.35 - 0.15 * soft}) saturate(0.85) brightness(0.88) contrast(1.05)`}} />
					</div>
					<div style={{marginTop: 14, textAlign: 'center', fontFamily: SERIF, fontSize: 18, letterSpacing: 5, color: COLORS.parchmentDim}}>密阿雷美术馆 · 大洗翠展</div>
					<div style={{marginTop: 4, textAlign: 'center', fontFamily: CINZEL, fontSize: 12, letterSpacing: 4, color: gold(0.5)}}>LUMIOSE MUSEUM</div>
				</div>
			)}
			{/* 两个画面之间一条细金线 */}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: photo * 0.6}}>
				<line x1={900} y1={300} x2={900} y2={700} stroke={GOLD} strokeWidth={1} opacity={0.4} />
			</svg>
		</div>
	);
};
