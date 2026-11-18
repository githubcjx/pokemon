import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {InkCave, InkClash, InkStream, PaperVignette} from '../../components/ink/InkPaper';
import {Seal} from '../../components/ink/Seal';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 6 段「为战斗而生」（840 帧 = 28 秒）──────────────────────
// 接上段合拢的浓墨：墨从超梦身边退开，露出水墨洞窟（华蓝洞窟）——钟乳石、幽暗的水面，超梦一动不动地待在深处
// → 洞口亮起火光，喷火龙现身（叫声 + 名称卡），身后是训练师赤红模糊的剪影（只用官方立绘的轮廓，不显出样貌）
// → 交战：火墨扑向超梦、被周身的墨云挡下 → 念力的浓墨反卷回去 → 两股力量在中间相持、对撞炸开（超梦第二次叫声）
// → 墨烟慢慢沉下去，火光熄灭，只剩超梦留在黑暗里。不交代胜负（用户决定）。
export const BATTLE_SCENE_FRAMES = 840;

const T = {
	clear: [0, 130] as const, // 墨从超梦身边退开
	mtIn: [10, 110] as const,
	subHide: [30, 128] as const,
	subStill: [134, 236] as const,
	light: [226, 300] as const, // 火光从洞口（右侧）照进来
	subTrainer: [244, 340] as const,
	czSil: [272, 300] as const,
	czReveal: [292, 330] as const,
	czCry: 330,
	red: [300, 360] as const,
	name: 345,
	seal: 390,
	nameOut: [452, 470] as const,
	aura: [436, 476] as const, // 超梦周身的墨云翻起
	subBattle: [478, 590] as const,
	fireA: [490, 504, 520, 534] as const, // 火墨：头出发、头到达、尾出发、尾到达
	hitA: 504,
	psyB: [532, 546, 562, 576] as const,
	hitB: 546,
	duel: [596, 612] as const, // 两股力量同时冲向中间
	boom: 640, // 对撞
	cry2: 641,
	subEnd: [668, 760] as const,
	out: [690, 780] as const, // 喷火龙与训练师隐入墨烟
	dark: [770, 840] as const,
};

// 主体层上的位置
const MT = {x: 560, y: 500, size: 720};
const CZ = {x: 1420, y: 520, size: 760};
const RED = {x: 1790, y: 600, size: 540};
// 喷火龙的嘴在立绘 uv (0.366, 0.166)，随喷火龙的位置一起移动（见场景内 mouth）
const MOUTH_UV = {x: 0.366, y: 0.166};
const TAIL = {x: 1761, y: 622}; // 尾巴的火焰（uv 0.9, 0.62）
const MT_FRONT: [number, number] = [720, 330]; // 超梦身前（念力发出处）
const MID: [number, number] = [1000, 345]; // 对撞点

const baseCam = (f: number): Cam => {
	if (f < 460) {
		return {
			x: flow(f, [
				[0, 600],
				[200, 650],
				[300, 1300],
				[460, 1400],
			]),
			y: flow(f, [
				[0, 470],
				[200, 500],
				[300, 520],
				[460, 500],
			]),
			zoom: flow(f, [
				[0, 1.55],
				[200, 1.25],
				[300, 1.18],
				[460, 1.22],
			]),
			roll: flow(f, [
				[0, -1.2],
				[200, 0],
				[460, 0.4],
			]),
		};
	}
	const hit = Easing.out(Easing.exp);
	return {
		x: track(f, [
			[460, 1400],
			[488, 980, Easing.inOut(Easing.cubic)],
			[500, 980],
			[512, 760, hit],
			[540, 790],
			[552, 1180, hit],
			[585, 1160],
			[604, 980, Easing.inOut(Easing.cubic)],
			[640, 985],
			[652, 960, hit],
			[840, 700],
		]),
		y: track(f, [
			[460, 500],
			[488, 480],
			[604, 450],
			[636, 380, Easing.in(Easing.quad)],
			[648, 480, hit],
			[840, 500],
		]),
		zoom: track(f, [
			[460, 1.22],
			[488, 1.0, Easing.inOut(Easing.cubic)],
			[500, 1.0],
			[512, 1.28, hit],
			[540, 1.24],
			[552, 1.3, hit],
			[585, 1.27],
			[604, 1.02, Easing.inOut(Easing.cubic)],
			[636, 1.2, Easing.in(Easing.quad)],
			// 对撞：猛地拉开
			[648, 0.94, hit],
			[720, 1.0],
			[840, 1.2],
		]),
		roll: track(f, [
			[460, 0.4],
			[500, 0],
			[512, -1.5, hit],
			[540, -0.8],
			[552, 1.5, hit],
			[600, 0],
			[636, 0.8],
			[648, -1.6, hit],
			[840, 0.6],
		]),
	};
};

/** 一道气流的显示区间：头 [h0, h1] 从 0 冲到 1，尾 [t0, t1] 再从 0 追到 1 */
const streamT = (f: number, [h0, h1, t0, t1]: readonly number[]) => ({
	head: interpolate(f, [h0, h1], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}),
	tail: interpolate(f, [t0, t1], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}),
});

export const BattleScene: React.FC = () => {
	const frame = useFrame();
	const base = baseCam(frame);
	const tremble = interpolate(frame, [T.duel[1], T.boom], [0, 6], clamp) * (frame < T.boom ? 1 : 0);
	const s1 = shake(frame, T.hitA, 14, 18);
	const s2 = shake(frame, T.hitB, 14, 18);
	const s3 = shake(frame, T.boom, 38, 42);
	const cam: Cam = {
		x: base.x + s1.x + s2.x + s3.x + Math.sin(frame * 2.7) * tremble,
		y: base.y + s1.y + s2.y + s3.y + Math.cos(frame * 3.3) * tremble,
		zoom: base.zoom,
		roll: base.roll + s1.roll + s2.roll + s3.roll,
	};

	// 开场：墨从超梦身边退开
	const clearR = interpolate(frame, [T.clear[0], T.clear[1] - 40, T.clear[1]], [60, 1900, 6000], {...clamp, easing: Easing.inOut(Easing.sin)});
	const covered = frame < T.clear[1];
	const dark = interpolate(frame, [T.dark[0], T.dark[1]], [0, 0.8], {...clamp, easing: Easing.in(Easing.quad)});

	// 超梦：纯墨，开场前一动不动；墨云翻起后才微微浮动
	const mtSil = interpolate(frame, [T.mtIn[0], T.mtIn[0] + 40], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const mtReveal = interpolate(frame, [T.mtIn[0] + 30, T.mtIn[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const aura = interpolate(frame, [T.aura[0], T.aura[1], T.out[1], T.dark[1]], [0, 1, 0.8, 0.35], clamp);
	const awake = interpolate(frame, [T.aura[0], T.aura[1]], [0, 1], clamp);
	const auraFlare = interpolate(frame, [T.hitA, T.hitA + 3, T.hitA + 30], [0, 0.6, 0], clamp);

	// 火光：从洞口（右侧画外）移到喷火龙的尾巴；喷火时更亮、移向火焰
	const fireIn = interpolate(frame, [T.light[0], T.light[1]], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const breath =
		interpolate(frame, [T.fireA[0], T.fireA[1], T.fireA[3]], [0, 1, 0], clamp) +
		interpolate(frame, [T.duel[0], T.duel[1], T.boom, T.boom + 30], [0, 1, 1.2, 0], clamp);
	const boomLight = interpolate(frame, [T.boom, T.boom + 2, T.boom + 50], [0, 2.2, 0], clamp);
	const fireOut = interpolate(frame, [T.out[0], T.out[1] + 30], [1, 0.08], clamp);
	const fireX = interpolate(fireIn, [0, 1], [2400, TAIL.x]) - breath * 320;
	const fireY = TAIL.y - breath * 260;
	const fireStr = (fireIn * (0.9 + breath * 0.6)) * fireOut + boomLight;

	// 喷火龙：墨 + 淡彩（颜色略浓，是这一段唯一的暖色），尾巴的火焰照亮自己
	const czSil = interpolate(frame, [T.czSil[0], T.czSil[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const czReveal = interpolate(frame, [T.czReveal[0], T.czReveal[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const czSettled = interpolate(frame, [T.czReveal[0] + 20, T.czReveal[1] + 20], [0, 1], clamp);
	const czO = interpolate(frame, [T.czSil[0], T.czSil[0] + 20, T.out[0], T.out[1]], [0, 1, 1, 0], clamp);
	const czBack = interpolate(frame, [T.hitB, T.hitB + 10, T.hitB + 50], [0, 34, 10], {...clamp, easing: Easing.out(Easing.cubic)});
	const czIn = interpolate(frame, [T.czSil[0], T.czReveal[1] + 40], [60, 0], {...clamp, easing: Easing.out(Easing.cubic)});

	// 赤红：只有模糊的墨色剪影，被身前的火光勾出一点轮廓
	const redO = interpolate(frame, [T.red[0], T.red[1], T.out[0], T.out[1] - 20], [0, 0.85, 0.85, 0], clamp);

	// 交战
	const fa = streamT(frame, T.fireA);
	const pb = streamT(frame, T.psyB);
	const duel = interpolate(frame, [T.duel[0], T.duel[1]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const duelGone = interpolate(frame, [T.boom, T.boom + 14], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const czX = CZ.x + czBack + czIn;
	const czY = CZ.y + Math.sin(frame / 37) * 5;
	const MOUTH: [number, number] = [czX + (MOUTH_UV.x - 0.5) * CZ.size, czY + (MOUTH_UV.y - 0.5) * CZ.size + 4];
	let fire: InkStream | undefined;
	let psy: InkStream | undefined;
	if (frame >= T.fireA[0] && frame < T.fireA[3]) {
		fire = {from: MOUTH, to: [MT_FRONT[0] + 70, MT_FRONT[1] + 60], tail: fa.tail, head: fa.head, width: 130, strength: 1};
	} else if (frame >= T.duel[0] && duelGone < 1) {
		fire = {from: MOUTH, to: MID, tail: duelGone, head: duel, width: 135, strength: 1};
	}
	if (frame >= T.psyB[0] && frame < T.psyB[3]) {
		psy = {from: MT_FRONT, to: [CZ.x - 120, CZ.y - 100], tail: pb.tail, head: pb.head, width: 115, strength: 1};
	} else if (frame >= T.duel[0] && duelGone < 1) {
		psy = {from: MT_FRONT, to: MID, tail: duelGone, head: duel, width: 120, strength: 1};
	}
	// 念力扭动洞窟：墨云翻起时轻微，对撞时最强
	const psyWarp = awake * 0.06 + interpolate(frame, [T.duel[1], T.boom, T.boom + 40], [0, 0.25, 0], clamp);
	const ember = interpolate(frame, [T.fireA[0], T.fireA[1], T.boom, T.boom + 6, T.dark[1]], [0, 0.6, 0.8, 2.2, 0.4], clamp);
	const flash = interpolate(frame, [T.boom, T.boom + 1, T.boom + 10], [0, 0.4, 0], clamp);
	const nameO = interpolate(frame, [T.nameOut[0], T.nameOut[1]], [1, 0], clamp);
	const fireLight = clampN(fireStr, 0, 2.4);
	const toScreen = (p: {x: number; y: number}) => ({
		x: (p.x - cam.x) * cam.zoom + 960,
		y: (p.y - cam.y) * cam.zoom + 540,
	});
	const mtScreen = toScreen({x: MT.x, y: MT.y - 60});

	return (
		<AbsoluteFill style={{background: '#0f0b08', overflow: 'hidden'}}>
			<InkCave
				cam={cam}
				fire={{x: fireX, y: fireY, strength: fireStr}}
				psy={{x: mtScreen.x, y: mtScreen.y, strength: psyWarp}}
				dark={dark}
				flood={covered ? {x: MT.x, y: MT.y, radius: 4200} : undefined}
				clear={covered ? {x: MT.x, y: MT.y - 40, radius: clearR} : undefined}
			/>
			{redO > 0 && (
				<CamLayer cam={cam} k={0.92}>
					<PokemonArt3D
						dir="trainers/red"
						x={RED.x}
						y={RED.y}
						size={RED.size}
						depthScale={0.4}
						opacity={redO}
						resolution={1}
						ink={{silhouette: 1, reveal: 0, halo: 0.7, time: frame / 30, center: [0.5, 0.5]}}
						style={{filter: `blur(3px) drop-shadow(-6px 0 10px rgba(255,120,40,${0.35 * fireIn * fireOut}))`}}
					/>
				</CamLayer>
			)}
			<CamLayer cam={cam} k={1}>
				{czO > 0 && (
					<PokemonArt3D
						dir="pokemon/charizard"
						x={czX}
						y={czY}
						size={CZ.size}
						yaw={-2 + Math.sin(frame / 70) * 2}
						depthScale={0.5}
						opacity={czO}
						resolution={2}
						rim={{dir: [0.7, 0.6], color: [1.3, 0.6, 0.2], power: 2}}
						ink={{
							silhouette: czSil,
							reveal: czReveal,
							paint: 1,
							color: 0.38,
							line: 0.9 * czSettled,
							halo: czSil * (1 - 0.3 * czSettled),
							wash: 0.7 * czSettled,
							time: frame / 30,
							center: [0.6, 0.55],
						}}
					/>
				)}
				<PokemonArt3D
					dir="pokemon/mewtwo"
					x={MT.x + awake * Math.sin(frame / 61) * 5}
					y={MT.y - awake * (10 + Math.sin(frame / 44) * 6)}
					size={MT.size}
					yaw={2 + awake * Math.sin(frame / 75) * 2.5}
					pitch={-2}
					depthScale={0.5}
					opacity={mtSil}
					resolution={2}
					rim={{dir: [1, -0.25], color: [1.5 * fireLight, 0.66 * fireLight, 0.22 * fireLight], power: 1.6}}
					ink={{
						silhouette: mtSil,
						reveal: mtReveal,
						paint: 1,
						color: 0,
						line: 0.9 * mtReveal,
						halo: mtSil * (0.7 + 0.3 * auraFlare),
						wash: 0.7 * mtReveal,
						time: frame / 30,
						center: [0.5, 0.4],
					}}
				/>
			</CamLayer>
			<InkClash
				cam={cam}
				fire={fire}
				psy={psy}
				aura={{x: MT.x + 20, y: MT.y - 40, radius: 470, strength: aura + auraFlare}}
				boom={{x: MID[0], y: MID[1], at: T.boom, size: 760}}
				ember={ember}
			/>
			{/* 对撞时的一闪 */}
			<AbsoluteFill style={{mixBlendMode: 'screen', opacity: flash, background: 'radial-gradient(circle at 50% 45%, rgba(255,240,215,1) 0%, rgba(255,170,90,0.7) 30%, rgba(120,50,20,0.25) 70%, transparent 100%)'}} />
			<PaperVignette strength={0.9} />

			{/* 旁白（制作者撰写）：依据《水晶》"据说静静地待在尚未被发现的洞窟里"（52poke 中文为站内译文，不引用原文） */}
			<BiSubtitle
				{...SUB}
				from={T.subHide[0]}
				to={T.subHide[1]}
				zh="逃出之后，它藏身于一处无人知晓的洞窟深处。"
				en="After its escape, it hid deep inside a cave no one had ever found."
				source={{zh: '旁白（依据《水晶》图鉴）', en: 'NARRATION'}}
			/>
			{/* 旁白：依据《银》"平时一动不动地保存体力，以便在战斗中释放全部力量" */}
			<BiSubtitle
				{...SUB}
				from={T.subStill[0]}
				to={T.subStill[1]}
				zh="平时一动不动，积蓄力量，只为在战斗中全力爆发。"
				en="It stays motionless, storing its power, only to unleash it all in battle."
				source={{zh: '旁白（依据《银》图鉴）', en: 'NARRATION'}}
			/>
			{/* 旁白：初代游戏中，通关后的训练师可进入华蓝洞窟最深处挑战超梦 */}
			<BiSubtitle
				{...SUB}
				from={T.subTrainer[0]}
				to={T.subTrainer[1]}
				zh="直到有一天，一位训练师带着喷火龙，走进了洞窟深处。"
				en="Until one day, a Trainer and a Charizard ventured into the depths of the cave."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<div style={{opacity: nameO}}>
				<NameTag tone="ink" from={T.name} x={190} y={250} no="No.0006" zh="喷火龙" en="CHARIZARD" category="火焰宝可梦" categoryEn="FLAME POKÉMON" />
				<Seal from={T.seal} x={520} y={348} text="喷火龙" size={78} seed={11} />
			</div>
			{/* 旁白：依据《金》"战斗能力被提升至极限，只想着打倒敌人" */}
			<BiSubtitle
				{...SUB}
				from={T.subBattle[0]}
				to={T.subBattle[1]}
				zh="它的战斗能力被提升到极限，眼中只有面前的敌人。"
				en="Its battle abilities raised to the limit, it sees nothing but the foe before it."
				source={{zh: '旁白（依据《金》图鉴）', en: 'NARRATION'}}
			/>
			{/* 旁白：依据《水晶》"只为战斗而被创造出来"（用户觉得《钻石·珍珠》"最残暴的心"接不上前一句，改为旁白） */}
			<BiSubtitle
				{...SUB}
				from={T.subEnd[0]}
				to={T.subEnd[1]}
				zh="它生来，就只是为了战斗。"
				en="It was created for one purpose alone: battle."
				source={{zh: '旁白（依据《水晶》图鉴）', en: 'NARRATION'}}
			/>
			<Cry name="charizard" at={T.czCry} />
			<Cry name="mewtwo" at={T.cry2} />
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
