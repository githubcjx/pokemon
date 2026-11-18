import {Img, interpolate, staticFile} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {BASE_FPS} from '../../time';
import {H, T, W} from './common';
import {DOORS_FRAG} from './gl4';
import {GLView} from './GLView';

/**
 * 第 6 段 · 各地的门。
 * 合众地底遗迹：石壁着色器（石门着色器去掉门）+ 三个巨人的浮雕 + 刻字（黑2白2 的英文原文，Bulbapedia「Underground Ruins」）。
 * 王冠雪原：皮欧尼（《剑／盾》官方立绘）和传说笔记２（官方简体中文，52poke「传说笔记２（道具）」里不带 {{tt}} 标记的部分，
 * 门上的字本来就是残缺的）。
 */

// ── 合众地底遗迹 ──
export const unovaOpacity = (f: number) => interpolate(f, [T.unova + 6, T.unova + 70, T.honor + 100, T.peony + 14], [0, 1, 1, 0], clamp);
const FAR = [100, 104, 108, 112, 116].flatMap((x) => [x, 0, 0, 0]);
const ZERO5 = Array.from({length: 20}, () => 0);
const NO_MARKS = Array.from({length: 80}, () => 0);

export const UnovaView: React.FC<{f: number}> = ({f}) => {
	const o = unovaOpacity(f);
	if (o <= 0) return null;
	const drift = (f - T.unova) * 0.0006;
	return (
		<GLView
			frag={DOORS_FRAG}
			style={{opacity: o}}
			uniforms={{uTime: f / BASE_FPS, uView: [-0.3 + drift, 1.6, 4.6 - drift * 2], uLayer: 0, 'uDoor[]': FAR, 'uGlow[]': ZERO5, 'uMarks[]': NO_MARKS, uExposure: 2.2, uFade: 0}}
		/>
	);
};

/** 刻在石壁上的字：暗色凹槽 + 下缘一道受光的边；highlight 时描金 */
const Carved: React.FC<{x: number; y: number; size: number; text: string; o: number; lit: number; spacing?: number}> = ({x, y, size, text, o, lit, spacing = 4}) => (
	<div style={{position: 'absolute', left: x - 900, width: 1800, top: y, textAlign: 'center', opacity: o, fontFamily: CINZEL, fontWeight: 600, fontSize: size, letterSpacing: spacing}}>
		<span
			style={{
				color: `rgba(${20 + 235 * lit},${16 + 196 * lit},${12 + 138 * lit},${0.85})`,
				textShadow: `0 1px 0 rgba(200,180,150,${0.25 * (1 - lit)}), 0 -1px 1px rgba(0,0,0,0.8), 0 0 ${14 * lit}px rgba(255,180,80,${0.8 * lit})`,
			}}
		>
			{text}
		</span>
	</div>
);

const RELIEFS = [
	{dir: 'regirock', x: 600, size: 300, foot: 0.988},
	{dir: 'regice', x: 960, size: 300, foot: 0.987},
	{dir: 'registeel', x: 1320, size: 330, foot: 0.867},
];

export const UnovaFx: React.FC<{f: number}> = ({f}) => {
	const o = unovaOpacity(f);
	if (o <= 0) return null;
	const flick = 0.85 + 0.1 * Math.sin(f * 0.37) + 0.05 * Math.sin(f * 1.13);
	const relief = interpolate(f, [T.unova + 40, T.unova + 90], [0, 1], clamp);
	const gold = interpolate(f, [T.protect + 20, T.protect + 60], [0, 1], clamp) * interpolate(f, [T.moon, T.moon + 30, T.honor, T.honor + 30], [1, 0.4, 0.4, 1], clamp);
	const sun = interpolate(f, [T.moon + 6, T.moon + 40], [0, 1], clamp);
	const moon = interpolate(f, [T.moon + 110, T.moon + 150], [0, 1], clamp);
	const textA = interpolate(f, [T.protect - 10, T.protect + 20], [0, 1], clamp);
	const textB = interpolate(f, [T.moon - 6, T.moon + 20], [0, 1], clamp);
	const textC = interpolate(f, [T.moon + 100, T.moon + 126], [0, 1], clamp);
	const label = interpolate(f, [T.unovaWall, T.unovaWall + 24, T.protect - 10, T.protect + 10], [0, 1, 1, 0], clamp);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			{/* 两侧的火把光 */}
			<div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: flick, background: 'radial-gradient(ellipse 40% 60% at 0% 70%, rgba(255,140,60,0.28), rgba(0,0,0,0) 70%), radial-gradient(ellipse 40% 60% at 100% 70%, rgba(255,140,60,0.28), rgba(0,0,0,0) 70%)'}} />
			{/* 日与月：左半边暖、右半边冷 */}
			<div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: sun, background: 'linear-gradient(90deg, rgba(255,190,110,0.22) 0%, rgba(255,190,110,0.06) 48%, rgba(0,0,0,0) 52%)'}} />
			<div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: moon, background: 'linear-gradient(270deg, rgba(120,160,255,0.24) 0%, rgba(120,160,255,0.06) 48%, rgba(0,0,0,0) 52%)'}} />
			<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
				<g opacity={sun} stroke="#ffd68f" strokeWidth={3} fill="none" style={{filter: 'drop-shadow(0 0 8px rgba(255,180,80,0.9))'}}>
					<circle cx={250} cy={560} r={46} />
					{Array.from({length: 12}, (_, i) => {
						const a = (i / 12) * Math.PI * 2;
						return <line key={i} x1={250 + Math.cos(a) * 60} y1={560 + Math.sin(a) * 60} x2={250 + Math.cos(a) * 82} y2={560 + Math.sin(a) * 82} />;
					})}
				</g>
				<g opacity={moon} fill="none" stroke="#cfe0ff" strokeWidth={3} style={{filter: 'drop-shadow(0 0 8px rgba(150,190,255,0.9))'}}>
					<path d="M 1700 506 A 56 56 0 1 0 1700 614 A 44 44 0 1 1 1700 506 Z" />
				</g>
			</svg>
			{/* 三个巨人的浮雕（立绘去色、只打火把光） */}
			{RELIEFS.map((r) => (
				<div key={r.dir} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: relief, filter: `grayscale(1) sepia(${0.35 + 0.4 * gold}) contrast(1.1)`}}>
					<PokemonArt3D
						dir={`pokemon/${r.dir}`}
						x={r.x}
						y={850 - (r.foot - 0.5) * r.size}
						size={r.size}
						depthScale={0.5}
						ambient={[0.16, 0.15, 0.14]}
						dirLights={[
							{dir: [-0.8, -0.3, 0.5], color: [0.9 * flick, 0.6 * flick, 0.35 * flick], wrap: 0.3},
							{dir: [0.8, -0.3, 0.5], color: [0.7 * flick, 0.47 * flick, 0.28 * flick], wrap: 0.3},
						]}
						rim={{dir: [0, -1], color: [1.0 + gold, 0.75 + gold * 0.6, 0.4], power: 2.6}}
						brightness={0.75}
					/>
				</div>
			))}
			<Carved x={960} y={236} size={32} text="THE PROTECTORS WERE BORN OUT OF ROCK, ICE, AND MAGMA..." o={textA} lit={gold} />
			<Carved x={960} y={308} size={24} text="COURAGEOUS ONE, LET ME TELL YOU THE ANSWER I KNOW." o={textB} lit={interpolate(f, [T.moon + 10, T.moon + 40, T.moon + 100, T.moon + 130], [0, 0.8, 0.8, 0.2], clamp)} spacing={3} />
			<Carved x={960} y={350} size={24} text="THE OTHER ANSWER CAN ONLY BE FOUND WHEN THE MOON IS IN THE SKY." o={textC} lit={interpolate(f, [T.moon + 110, T.moon + 140], [0, 0.8], clamp)} spacing={3} />
			<RegionLabel x={110} y={130} zh="合众 · 地底遗迹" en="UNOVA · UNDERGROUND RUINS" o={label} />
		</div>
	);
};

export const RegionLabel: React.FC<{x: number; y: number; zh: string; en: string; o: number; align?: 'left' | 'center'}> = ({x, y, zh, en, o, align = 'left'}) =>
	o > 0 ? (
		<div style={{position: 'absolute', left: align === 'left' ? x : x - 400, width: align === 'left' ? undefined : 800, top: y, textAlign: align, opacity: o}}>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 34, letterSpacing: 8, color: 'rgba(240,222,186,0.92)', textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>{zh}</div>
			<div style={{fontFamily: CINZEL, fontSize: 17, letterSpacing: 6, color: 'rgba(220,200,160,0.7)', marginTop: 4}}>{en}</div>
		</div>
	) : null;

/**
 * 人物不直接露出：官方立绘压成黑色剪影，只留一点微光（侧面一层按轮廓遮罩的弱光 + 一圈细细的轮廓光），隐约看得出样子。
 * from：微光来自哪一侧；rgb：光色
 */
export const TrainerSilhouette: React.FC<{file: string; x: number; top: number; h: number; aspect: number; o: number; from: 'left' | 'right'; rgb: string; lift?: number}> = ({file, x, top, h, aspect, o, from, rgb, lift = 0.13}) => {
	if (o <= 0) return null;
	const w = h * aspect;
	const url = `url(${staticFile(file)})`;
	const dx = from === 'left' ? -2 : 2;
	return (
		<div style={{position: 'absolute', left: x - w / 2, top, width: w, height: h, opacity: o}}>
			<Img
				src={staticFile(file)}
				style={{position: 'absolute', left: 0, top: 0, width: w, height: h, filter: `brightness(${lift}) saturate(0.18) contrast(1.15) drop-shadow(${dx}px -1px 1.5px rgba(${rgb},0.55)) drop-shadow(0 0 14px rgba(0,0,0,0.65))`}}
			/>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: w,
					height: h,
					WebkitMaskImage: url,
					WebkitMaskSize: '100% 100%',
					maskImage: url,
					maskSize: '100% 100%',
					mixBlendMode: 'screen',
					background: `linear-gradient(${from === 'left' ? 100 : 260}deg, rgba(${rgb},${0.2 + lift * 0.5}) 0%, rgba(${rgb},0.06) 32%, rgba(0,0,0,0) 58%), linear-gradient(180deg, rgba(${rgb},0.05) 0%, rgba(0,0,0,0) 40%)`,
				}}
			/>
		</div>
	);
};

// ── 王冠雪原：皮欧尼 ──
export const peonyOpacity = (f: number) => interpolate(f, [T.peony - 14, T.peony + 26, T.solve - 20, T.solve + 14], [0, 1, 1, 0], clamp);
export const tundraAgain = (f: number) => interpolate(f, [T.honor + 96, T.peony + 14, T.solve - 20, T.solve + 20], [0, 1, 1, 0], clamp);

export const Peony: React.FC<{f: number}> = ({f}) => {
	const o = peonyOpacity(f);
	if (o <= 0) return null;
	// 打开笔记时往左让一点
	const shift = interpolate(f, [T.notes - 10, T.notes + 30], [0, -70], clamp);
	const h = 960;
	const w = (h * 684) / 1600;
	return (
		<>
			{/* 雪原的冷光从左边来 */}
			<TrainerSilhouette file="trainers/peony/swsh.png" x={400 + shift} top={1080 - h + 30} h={h} aspect={w / h} o={o} from="left" rgb="185,210,245" lift={0.18} />
			<RegionLabel x={110} y={130} zh="皮欧尼" en="PEONY" o={o * interpolate(f, [T.peony + 10, T.peony + 30, T.notes - 10, T.notes + 10], [0, 1, 1, 0], clamp)} />
		</>
	);
};

// ── 传说笔记２ ──
type Page = {head: string; lines: string[]; quote: string[]};
/** 官方简体中文（门上的字本来就是残缺的，原样照录） */
const PAGES: Page[] = [
	{head: '第一页', lines: ['巨人睡榻的深处，', '有岩石巨人所沉睡的遗迹。'], quote: ['“……给第一……', '……可梦携……不……头”']},
	{head: '第二页', lines: ['雪中溪谷的肚脐，', '有冰之巨人所沉睡的遗迹。'], quote: ['“汝当……有生……', '雪…结…同行”']},
	{head: '第三页', lines: ['巨人睡榻的白绿交界处，', '有钢之巨人所沉睡的遗迹。'], quote: ['“……响……唤……', '钢……人……音……”']},
	{head: '第四页', lines: ['遥远的三岔平原，', '有双子巨人所沉睡的遗迹。'], quote: ['“三个巨……集……时，', '命运之……开……”']},
];
const TAIL = ['记载着神秘信息的门', '紧紧地关闭着。'];

export const notebookOpacity = (f: number) =>
	interpolate(f, [T.notes - 4, T.notes + 26, T.solve - 14, T.solve + 14], [0, 1, 1, 0], clamp) + interpolate(f, [T.pass - 10, T.pass + 20, T.gather + 6, T.gather + 34], [0, 1, 1, 0], clamp);

export const Notebook: React.FC<{f: number}> = ({f}) => {
	const o = notebookOpacity(f);
	if (o <= 0) return null;
	const rise = (1 - Math.min(o * 1.4, 1)) * 40;
	const hl = [
		interpolate(f, [T.note1, T.note1 + 16, T.note2 - 8, T.note2 + 8], [0, 1, 1, 0], clamp),
		interpolate(f, [T.note2, T.note2 + 16, T.note3 - 8, T.note3 + 8], [0, 1, 1, 0], clamp),
		interpolate(f, [T.note3, T.note3 + 16, T.solve - 20, T.solve], [0, 1, 1, 0], clamp),
		interpolate(f, [T.pass + 20, T.pass + 40, T.gather + 6, T.gather + 30], [0, 1, 1, 0], clamp),
	];
	const page = (p: Page, k: number) => (
		<div key={k} style={{marginBottom: 26}}>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 21, letterSpacing: 3, color: 'rgba(90,60,30,0.75)', marginBottom: 6}}>{p.head}</div>
			{p.lines.map((l) => (
				<div key={l} style={{fontFamily: SERIF, fontSize: 25, lineHeight: 1.45, color: '#3b2914'}}>
					{l}
				</div>
			))}
			<div style={{position: 'relative', display: 'inline-block', margin: '4px 0', padding: '2px 10px', marginLeft: -10, borderRadius: 4, background: `rgba(255,196,90,${0.35 * hl[k]})`, boxShadow: `0 0 ${18 * hl[k]}px rgba(255,170,60,${0.6 * hl[k]})`}}>
				{p.quote.map((l) => (
					<div key={l} style={{fontFamily: SERIF, fontWeight: 600, fontSize: 27, lineHeight: 1.45, color: `rgb(${59 + 60 * hl[k]},${30 + 10 * hl[k]},${12})`}}>
						{l}
					</div>
				))}
			</div>
			{TAIL.map((l) => (
				<div key={l} style={{fontFamily: SERIF, fontSize: 25, lineHeight: 1.45, color: '#3b2914'}}>
					{l}
				</div>
			))}
		</div>
	);
	const sheet = (pages: Page[], ks: number[], left: boolean) => (
		<div
			style={{
				position: 'absolute',
				top: 0,
				left: left ? 0 : 540,
				width: 530,
				height: 760,
				padding: '46px 44px',
				boxSizing: 'border-box',
				background: `linear-gradient(${left ? 90 : 270}deg, #d9cba8 0%, #ece2c8 12%, #efe6cf 60%, #e3d6b6 100%)`,
				boxShadow: 'inset 0 0 40px rgba(120,90,50,0.25)',
				borderRadius: left ? '10px 2px 2px 10px' : '2px 10px 10px 2px',
			}}
		>
			{pages.map((p, i) => page(p, ks[i]))}
		</div>
	);
	return (
		<div style={{position: 'absolute', left: 760, top: 110 + rise, width: 1070, height: 760, opacity: Math.min(o, 1), filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.7))'}}>
			<div style={{position: 'absolute', left: 0, top: -54, width: 1070, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 30, letterSpacing: 10, color: 'rgba(240,222,186,0.9)', textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>
				传说笔记２
			</div>
			{sheet(PAGES.slice(0, 2), [0, 1], true)}
			{sheet(PAGES.slice(2, 4), [2, 3], false)}
			{/* 中缝 */}
			<div style={{position: 'absolute', left: 528, top: 0, width: 14, height: 760, background: 'linear-gradient(90deg, rgba(90,60,30,0.35), rgba(90,60,30,0) 50%, rgba(90,60,30,0.35))'}} />
		</div>
	);
};
