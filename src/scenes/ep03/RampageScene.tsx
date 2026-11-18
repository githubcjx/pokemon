import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {DiaryLine, DiaryText} from '../../components/ink/DiaryText';
import {InkFirePage} from '../../components/ink/InkPaper';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 4 段「失控」（500 帧 ≈ 16.7 秒）──────────────────────────
// 接上段的黑场：暗处一张日记页被火光照亮，纸边开始烧焦 → 第四条日记潦草、颤抖地写出 → 镜头压近、画面发颤
// → 墨从纸页中心炸开（猛拉 + 震动），火线迅速向内吞噬纸页 → 烟火中升起超梦逆光的剪影（只有火光勾出轮廓）
// → 剪影短暂停留后隐入烟火，纸页烧尽，余烬与烟在黑暗中上升，接下一段超梦现身。剪影不放叫声（显色登场在下一段）。
export const RAMPAGE_SCENE_FRAMES = 500;

// 日记：中文为 52poke「宝可梦屋」页面的译文（用户决定采用），英文为初代游戏原文（Bulbapedia「Pokémon Mansion journals」）。
const ENTRY: {lines: DiaryLine[]; en: string} = {
	lines: [{text: '日记　9月1日'}, {text: '宝可梦超梦实在太强了。', strong: '超梦'}, {text: '不行……我应付不来！'}],
	en: 'Diary: Sept. 1. Mewtwo is far too powerful. We have failed to curb its vicious tendencies...',
};

const T = {
	light: [0, 50] as const, // 纸页从暗处被火光照亮
	entry: 40,
	tension: [150, 224] as const, // 画面发颤、镜头压近
	burst: 224, // 墨爆
	sil: [234, 274] as const, // 超梦的剪影升起
	sub: [286, 390] as const,
	silOut: [356, 404] as const, // 剪影隐入烟火（用户要求停留短一些）
};

const CENTER = {x: 960, y: 560};

const baseCam = (f: number): Cam => ({
	x: 960,
	y: track(f, [
		[0, 520],
		[40, 380],
		[150, 380],
		[222, 470],
		[300, 540],
		[420, 520],
		[500, 420],
	]),
	zoom: track(f, [
		[0, 1.2],
		[40, 1.4],
		[150, 1.42],
		[222, 1.58, Easing.in(Easing.quad)],
		// 墨爆：猛地拉开
		[236, 1.0, Easing.out(Easing.exp)],
		[420, 1.08],
		[500, 1.22],
	]),
	roll: track(f, [
		[0, -0.5],
		[222, 0.8],
		[236, -1.2, Easing.out(Easing.exp)],
		[500, 0.4],
	]),
});

export const RampageScene: React.FC = () => {
	const frame = useFrame();
	const base = baseCam(frame);
	// 爆发前越来越强的颤动 + 爆发时的强震
	const tremble = interpolate(frame, [T.tension[0], T.tension[1]], [0, 7], clamp) * (frame < T.burst ? 1 : 0);
	const hit = shake(frame, T.burst, 34, 40);
	const cam: Cam = {
		x: base.x + hit.x + Math.sin(frame * 2.7) * tremble,
		y: base.y + hit.y + Math.cos(frame * 3.3) * tremble,
		zoom: base.zoom,
		roll: base.roll + hit.roll,
	};

	const page = interpolate(frame, [T.light[0], T.light[1]], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	// 火线：爆发前缓慢烧进纸边，爆发后迅速吞噬整页
	const burn =
		interpolate(frame, [50, T.burst], [0, 34], clamp) +
		interpolate(frame, [T.burst + 4, 420], [0, 640], {...clamp, easing: Easing.inOut(Easing.quad)});
	const ember = interpolate(frame, [0, T.burst, T.burst + 10, 500], [0.3, 0.8, 2.2, 1.6], clamp);
	const fire = interpolate(frame, [0, 60, T.burst, T.burst + 8], [0.2, 0.5, 0.6, 1.1], clamp);
	const flash = interpolate(frame, [T.burst, T.burst + 1, T.burst + 9], [0, 0.6, 0], clamp);
	// 字迹随纸页一起烧掉
	const textO = page * interpolate(frame, [T.burst + 60, T.burst + 170], [1, 0], clamp);

	// 超梦的剪影：自烟火中升起，只有下方火光勾出的轮廓
	const silIn = interpolate(frame, [T.sil[0], T.sil[1]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const silOut = interpolate(frame, [T.silOut[0], T.silOut[1]], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
	const silO = silIn * silOut;

	return (
		<AbsoluteFill style={{background: '#070504', overflow: 'hidden'}}>
			<InkFirePage cam={cam} burn={burn} splash={{x: CENTER.x, y: CENTER.y, at: T.burst, size: 900}} ember={ember} fire={fire} page={page} />
			<CamLayer cam={cam} k={1}>
				<DiaryText
					frame={frame}
					from={T.entry}
					x={640}
					y={253}
					lines={ENTRY.lines}
					en={ENTRY.en}
					width={660}
					rate={2}
					seed={4}
					jitter={2.4}
					blend="multiply"
					opacity={textO}
				/>
				{silO > 0 && (
					<PokemonArt3D
						dir="pokemon/mewtwo"
						x={CENTER.x}
						y={interpolate(silIn, [0, 1], [700, 520])}
						size={980}
						yaw={Math.sin(frame / 60) * 2.5}
						pitch={-3}
						depthScale={0.5}
						opacity={silO}
						ambient={[0, 0, 0]}
						rim={{dir: [0.15, 1], color: [2.4, 0.95, 0.28], power: 1.4}}
						style={{filter: `drop-shadow(0 0 6px rgba(255,140,50,${0.7 * silO})) drop-shadow(0 0 40px rgba(255,90,20,${0.4 * silO}))`}}
					/>
				)}
			</CamLayer>
			{/* 墨爆时的火光一闪 */}
			<AbsoluteFill style={{mixBlendMode: 'screen', opacity: flash, background: 'radial-gradient(circle at 50% 52%, rgba(255,236,200,1) 0%, rgba(255,150,60,0.8) 30%, rgba(120,40,10,0.3) 70%, transparent 100%)'}} />
			<AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, rgba(0,0,0,0.65) 100%)'}} />

			<BiSubtitle
				{...SUB}
				from={T.entry}
				to={T.burst}
				zh={ENTRY.lines.map(({text}) => text).join('　')}
				en={ENTRY.en}
				source={{zh: '宝可梦屋日记（52poke 译文 / 初代英文）', en: 'Pokémon Mansion journals · Red / Blue'}}
				wipe={30}
			/>
			{/* 旁白（制作者撰写）：依据日记"没能抑制它凶暴的本性" */}
			{/* 暗场上用浅色字幕 */}
			<BiSubtitle
				{...SUB}
				from={T.sub[0]}
				to={T.sub[1]}
				zh="这股力量，终究失去了控制。"
				en="In the end, that power slipped beyond control."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
