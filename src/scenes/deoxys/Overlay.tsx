import {loadFont as loadOpenSans} from '@remotion/google-fonts/OpenSans';
import {AbsoluteFill, continueRender, delayRender, interpolate, staticFile} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {clamp} from '../../theme';

// 标题 / 问句用无衬线（思源黑体 + Open Sans），旁白字幕用衬线（BiSubtitle 的思源宋体 + Cormorant）
export const SANS = 'DeoxysSans';
export const OPEN = loadOpenSans('normal', {weights: ['300', '400'], subsets: ['latin']}).fontFamily;
const sansHandle = delayRender('Noto Sans SC');
const sansFace = new FontFace(SANS, `url('${staticFile('fonts/NotoSansSC-VF.ttf')}') format('truetype')`, {weight: '100 900'});
sansFace
	.load()
	.then(() => {
		document.fonts.add(sansFace);
		continueRender(sansHandle);
	})
	.catch(() => continueRender(sansHandle));

const TEXT = '#bec5cf';
const TEXT_DIM = 'rgba(190,197,207,0.68)';
const AMBER = '#cbb084';
const BAND_TOP = 138;

/** 打字机光标：暖色母题，闪烁的竖线 */
const Cursor: React.FC<{f: number; h: number; on: boolean}> = ({f, h, on}) => (
	<span
		style={{
			display: 'inline-block',
			width: Math.max(2, h * 0.06),
			height: h * 0.95,
			marginLeft: h * 0.18,
			verticalAlign: 'middle',
			background: AMBER,
			boxShadow: `0 0 ${h * 0.35}px rgba(203,176,132,0.75), 0 0 ${h * 0.9}px rgba(203,176,132,0.35)`,
			opacity: on ? (Math.floor(f / 16) % 2 === 0 ? 1 : 0.15) : 0,
		}}
	/>
);

const Typed: React.FC<{text: string; f: number; start: number; rate: number; style: React.CSSProperties; cursor?: boolean; h: number}> = ({text, f, start, rate, style, cursor, h}) => {
	const n = Math.max(0, Math.min(text.length, Math.floor((f - start) / rate)));
	return (
		<div style={{...style, whiteSpace: 'nowrap'}}>
			{text.split('').map((ch, i) => (
				<span key={i} style={{opacity: i < n ? 1 : 0}}>
					{ch}
				</span>
			))}
			{cursor && <Cursor f={f} h={h} on={f >= start} />}
		</div>
	);
};

const Hook: React.FC<{f: number}> = ({f}) => {
	if (f < 12 || f > 164) return null;
	const o = interpolate(f, [140, 162], [1, 0], clamp);
	const zh = '有些陨石落下时，带来的不只是石头。';
	const zhDone = 20 + zh.length * 3;
	return (
		<AbsoluteFill style={{alignItems: 'center', top: BAND_TOP + 190, opacity: o}}>
			<Typed text={zh} f={f} start={20} rate={3} h={50} cursor={f < zhDone + 10} style={{fontFamily: SANS, fontWeight: 300, fontSize: 50, letterSpacing: '0.14em', color: TEXT, textShadow: '0 0 18px rgba(190,197,207,0.18)'}} />
			<div style={{height: 18}} />
			<Typed text="Some meteorites bring more than stone when they fall." f={f} start={zhDone + 4} rate={0.9} h={22} cursor={f >= zhDone + 10} style={{fontFamily: OPEN, fontWeight: 300, fontSize: 22, letterSpacing: '0.2em', color: TEXT_DIM}} />
		</AbsoluteFill>
	);
};

const Title: React.FC<{f: number}> = ({f}) => {
	if (f < 160 || f > 296) return null;
	const o = interpolate(f, [272, 294], [1, 0], clamp);
	const name = '坠落的序列';
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: o, top: -70}}>
			<div style={{fontFamily: SANS, fontWeight: 400, fontSize: 16, letterSpacing: '0.9em', color: TEXT_DIM, opacity: interpolate(f, [165, 190], [0, 1], clamp), marginBottom: 26, paddingLeft: '0.9em'}}>宝可梦志异</div>
			<div style={{display: 'flex', alignItems: 'center'}}>
				{name.split('').map((ch, i) => {
					const s = 172 + i * 8;
					const k = interpolate(f, [s, s + 24], [0, 1], clamp);
					return (
						<span key={i} style={{fontFamily: SANS, fontWeight: 200, fontSize: 86, letterSpacing: '0.38em', color: TEXT, opacity: k, filter: `blur(${(1 - k) * 8}px)`, textShadow: '0 0 26px rgba(190,197,207,0.22)'}}>
							{ch}
						</span>
					);
				})}
				<Cursor f={f} h={70} on={f > 172 && f < 250} />
			</div>
			<div style={{fontFamily: OPEN, fontWeight: 300, fontSize: 19, letterSpacing: '0.78em', color: TEXT_DIM, marginTop: 30, paddingLeft: '0.78em', opacity: interpolate(f, [215, 240], [0, 1], clamp)}}>THE FALLEN SEQUENCE</div>
		</AbsoluteFill>
	);
};

const NameCard: React.FC<{f: number}> = ({f}) => {
	const from = 1020;
	const to = 1166;
	if (f < from || f > to) return null;
	const o = interpolate(f, [to - 22, to], [1, 0], clamp);
	const line = interpolate(f, [from, from + 40], [0, 360], {...clamp});
	const name = '代欧奇希斯';
	return (
		<div style={{position: 'absolute', left: 168, top: BAND_TOP + 430, opacity: o}}>
			<div style={{fontFamily: SANS, fontWeight: 300, fontSize: 19, letterSpacing: '0.24em', color: TEXT_DIM, opacity: interpolate(f, [from, from + 20], [0, 1], clamp)}}>
				No.0386 · ＤＮＡ宝可梦 · <span style={{fontFamily: OPEN}}>DNA Pokémon</span>
			</div>
			<div style={{width: line, height: 1, background: 'linear-gradient(90deg, rgba(190,197,207,0.55), rgba(190,197,207,0))', margin: '16px 0 14px'}} />
			<div style={{display: 'flex'}}>
				{name.split('').map((ch, i) => {
					const s = from + 18 + i * 8;
					const k = interpolate(f, [s, s + 22], [0, 1], clamp);
					return (
						<span key={i} style={{fontFamily: SANS, fontWeight: 300, fontSize: 64, letterSpacing: '0.24em', color: TEXT, opacity: k, filter: `blur(${(1 - k) * 6}px)`, textShadow: '0 0 22px rgba(190,197,207,0.2)'}}>
							{ch}
						</span>
					);
				})}
			</div>
			<div style={{fontFamily: OPEN, fontWeight: 300, fontSize: 21, letterSpacing: '0.85em', color: TEXT_DIM, marginTop: 10, opacity: interpolate(f, [from + 60, from + 90], [0, 1], clamp)}}>DEOXYS</div>
		</div>
	);
};

type Sub = {zh: string; en: string; from: number; to: number; source?: {zh: string; en: string}};
const OR = {zh: '图鉴 · 欧米伽红宝石', en: 'Pokédex · Omega Ruby'};
const AS = {zh: '图鉴 · 阿尔法蓝宝石', en: 'Pokédex · Alpha Sapphire'};
export const SUBS: Sub[] = [
	// 1–3 陨石、螺旋、诞生
	{zh: '这颗陨石上，附着着一种来自宇宙的病毒。', en: 'Clinging to this one was a virus from space.', from: 300, to: 398},
	{zh: '病毒的ＤＮＡ，受到了一束激光的照射。', en: "Then a laser beam struck the virus's DNA.", from: 440, to: 565},
	{zh: '碱基被一个个改写，ＤＮＡ发生了突变。', en: 'Base by base it was rewritten, and the DNA mutated.', from: 600, to: 720},
	{zh: '突变后的病毒，变成了一只宝可梦。', en: 'The mutated virus became a Pokémon.', from: 770, to: 890},
	{zh: '它的名字，取自ＤＮＡ的全称——脱氧核糖核酸。', en: "Its name comes from DNA's full name: deoxyribonucleic acid.", from: 1045, to: 1162, source: {zh: '旁白（名字来源）', en: 'Narration (name origin)'}},
	{zh: '胸部的水晶体好像是它的大脑。', en: "The crystalline organ on this Pokémon's chest appears to be its brain.", from: 1170, to: 1270, source: OR},
	{zh: '智商很高，会操控超能力。', en: 'It is highly intelligent and wields psychokinetic powers.', from: 1280, to: 1380, source: AS},
	// 4 形态
	{zh: '而它最特别的地方，是能改写自己的身体。', en: 'But its most remarkable trait: it can rewrite its own body.', from: 1405, to: 1505},
	{zh: '攻击形态，能变换外形来迷惑对手。', en: 'Attack Forme: it can fool enemies by altering its appearance.', from: 1540, to: 1650, source: {zh: '旁白（依据火红图鉴）', en: 'Pokédex · FireRed'}},
	{zh: '防御形态，能改变细胞结构来吸收攻击。', en: 'Defense Forme: it absorbs attacks by altering its cellular structure.', from: 1690, to: 1800, source: {zh: '旁白（依据叶绿图鉴）', en: 'Pokédex · LeafGreen'}},
	{zh: '速度形态，身体的构造适合高速移动。', en: 'Speed Forme: its body is configured for superior agility and speed.', from: 1840, to: 1950, source: {zh: '旁白（依据绿宝石图鉴）', en: 'Pokédex · Emerald'}},
	{zh: '每次变换形态，都会出现极光。', en: 'Whenever it changes form, an aurora appears.', from: 1960, to: 2055, source: {zh: '旁白（依据叶绿图鉴）', en: 'Pokédex · LeafGreen'}},
	// 5 各地的陨石
	{zh: '而这颗星球上，散落着许多陨石。', en: 'And meteorites lie scattered across this world.', from: 2070, to: 2160},
	{zh: '带着代欧奇希斯去调查它们，它就会变换形态。', en: 'Examine one with Deoxys at your side, and its form will change.', from: 2170, to: 2290},
	{zh: '从宇宙中坠落到地面上的石头。摸上去隐约有点暖暖的。可以改变特定宝可梦的样子。', en: "A rock that fell to earth from space. It's slightly warm to the touch. It allows a certain species of Pokémon to change forms.", from: 2305, to: 2462, source: {zh: '道具 · 陨石（朱紫）', en: 'Item · Meteorite (Scarlet / Violet)'}},
	{zh: '它与陨石的缘分，还不止于此。', en: 'And its bond with meteorites runs deeper still.', from: 2480, to: 2580},
	// 6 远海的小岛
	{zh: '远海上有一座小岛，地图上找不到它。', en: 'Far out at sea lies Birth Island, found on no map.', from: 2680, to: 2790},
	{zh: '只有一张名字里带着“极光”的船票，能去到那里。', en: 'Only the AuroraTicket can take you there.', from: 2800, to: 2905},
	{zh: '岛上只有一块黑色的三角形石头。', en: 'On it lies nothing but a black, triangular rock.', from: 2915, to: 3000},
	{zh: '每调查一次，它就会移到别的地方。', en: 'Each time you examine it, it moves somewhere else.', from: 3008, to: 3098},
	{zh: '只有走最短的路追上它，它才会渐渐变红。', en: 'Only by following it along the shortest path does it slowly turn red.', from: 3106, to: 3225},
	{zh: '最后，石头碎裂，代欧奇希斯出现了。', en: 'At last the rock shatters, and Deoxys appears.', from: 3240, to: 3340},
	// 7 像活的一样
	{zh: '另一边，一颗巨大的陨石正朝着丰缘飞来。', en: 'Elsewhere, a gigantic meteoroid was hurtling toward Hoenn.', from: 3395, to: 3490},
	{zh: '绿岭宇宙中心最先发现了它：直径超过十公里。', en: 'The Mossdeep Space Center spotted it first: more than six miles across.', from: 3500, to: 3610},
	{zh: '它在半路改变了轨道，直冲这颗星球而来。', en: 'Midflight, it had changed course—straight for the planet.', from: 3618, to: 3720},
	{zh: '“飞到一半改变轨道……简直就像是活的一样。”', en: '“But changing trajectories midflight... It\'s almost like it\'s alive.”', from: 3730, to: 3855, source: {zh: '研究员对白（欧米伽红宝石／阿尔法蓝宝石；中文为转述）', en: 'Scientist · Omega Ruby / Alpha Sapphire'}},
	// 8 丰缘上空
	{zh: '流星之民早有预言：它大到足以毁灭世界。', en: 'The Draconids had foretold it: big enough to break the world.', from: 3885, to: 3995},
	{zh: '主角乘着烈空坐冲上宇宙，将它击碎。', en: 'Riding Rayquaza, the Trainer soared into space and shattered it.', from: 4060, to: 4195},
	// 9 藏在陨石里
	{zh: '碎石之中，飞出一个三角形的东西——', en: 'From the debris flew a triangular object—', from: 4230, to: 4320},
	{zh: '就像那座小岛上的三角形石头。', en: 'just like the triangular rock on that island.', from: 4325, to: 4408},
	{zh: '它伸出触手，猛然爆开。', en: 'Tendrils snaked out, and it burst apart.', from: 4413, to: 4477},
	{zh: '这颗“像活的一样”的陨石里，一直藏着代欧奇希斯。', en: 'Inside the meteoroid that seemed alive, Deoxys had been hiding all along.', from: 4485, to: 4598},
	// 10 宇宙之战
	{zh: '它一现身，就向烈空坐和主角发起了战斗。', en: 'The moment it emerged, it attacked Rayquaza and the Trainer.', from: 4610, to: 4715},
	{zh: '从胸部的水晶体发射出激光。', en: 'This Pokémon shoots lasers from the crystalline organ on its chest.', from: 4725, to: 4815, source: AS},
	{zh: '它会汲取宇宙中神秘的力量，也能让细胞再生。', en: 'It can draw on the mysterious power of space, and regenerate its cells.', from: 4835, to: 4950, source: {zh: '旁白（依据宇宙力量、自我再生的招式说明）', en: 'Moves · Cosmic Power, Recover'}},
	{zh: '战斗结束，这颗星球终于安全了。', en: 'When the battle ended, the planet was safe at last.', from: 5065, to: 5160},
	// 11 流星雨
	{zh: '宇宙中心的人们欢呼起来：“我们成功了！”', en: 'At the Space Center, cheers rang out: “We did it!”', from: 5245, to: 5345},
	{zh: '恰好在那几天，丰缘的夜空本就会有一场流星雨。', en: 'As it happened, a meteor shower was due over Hoenn in those very days.', from: 5360, to: 5472},
	{zh: '危机过去，人们终于在宇宙中心的天体展览上看到了它。', en: "With the danger past, people finally watched it at the Space Center's star show.", from: 5485, to: 5610},
	{zh: '陨石带来了代欧奇希斯，也一次次改变着它。', en: 'Meteorites brought Deoxys here, and meteorites change it still.', from: 5625, to: 5735},
	// 12 极光
	{zh: '图鉴上说，它会出现在极光的附近。', en: 'The Pokédex says it appears where auroras are seen.', from: 5830, to: 5940, source: {zh: '旁白（依据心金／魂银、Y 图鉴）', en: 'Pokédex · HeartGold / SoulSilver, Y'}},
	{zh: '下次夜空亮起极光时，不妨抬头看看。', en: 'Next time auroras light up the night, look up.', from: 5955, to: 6082},
];

export const Overlay: React.FC<{f: number}> = ({f}) => (
	<AbsoluteFill style={{pointerEvents: 'none'}}>
		<Hook f={f} />
		<Title f={f} />
		<NameCard f={f} />
		{/* 字幕放在下遮幅里 */}
		<AbsoluteFill style={{transform: 'translateY(52px)'}}>
			{SUBS.map((s) => (
				<BiSubtitle key={s.from} zh={s.zh} en={s.en} from={s.from} to={s.to} source={s.source} tone="frost" scale={0.8} />
			))}
		</AbsoluteFill>
	</AbsoluteFill>
);
