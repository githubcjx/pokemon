import {
	AbsoluteFill,
	Easing,
	interpolate,
	random,
	spring,
	staticFile,
} from 'remotion';
import {Cam, project, shake, track, unproject} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {FlyThroughDust} from '../../components/effects/FlyThroughDust';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {Nebula} from '../../components/Nebula';
import {PokemonArt} from '../../components/PokemonArt';
import {SacredRings} from '../../components/SacredRings';
import {CINZEL, SERIF} from '../../fonts';
import {clamp, COLORS} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {Cry} from '../../components/Cry';

// ─── 时间轴（30fps，785 帧 ≈ 26 秒）──────────────────────────────
export const ARCEUS_SCENE_FRAMES = 785;

const T = {
	eggIn: 205, // 光蛋在漩涡中心凝成
	dropStart: 345, // 蛋从漩涡坠落
	dropEnd: 377,
	crackStart: 388,
	burst: 440, // 破壳
	revealStart: 497, // 剪影开始显色
	revealPeak: 527,
	revealEnd: 553,
	shiftStart: 570, // 镜头右移，阿尔宙斯滑向左侧，名称卡
	shiftEnd: 625,
	nameIn: 583,
	fadeOut: 742, // 文字淡出
	whiteOut: 752, // 推进光中、白闪转场到下一段
};

const W = 1920;
const H = 1080;
const VORTEX_Y = 430;
const ARCEUS_SIZE = 860;
const ARCEUS_ART = staticFile('pokemon/arceus/art.png');

const SOURCE_MYTH = {zh: '神奥传说《起始的故事》', en: 'THE ORIGINAL STORY · SINNOH MYTH'};
const SOURCE_DEX = {zh: '阿尔宙斯图鉴《晶灿钻石》', en: 'POKÉDEX · BRILLIANT DIAMOND'};

// 世界中的焦点：漩涡中心 → 蛋坠落到画面中心（阿尔宙斯诞生处）
const getFocus = (frame: number) => {
	const drop = interpolate(frame, [T.dropStart, T.dropEnd], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	return {x: W / 2, y: VORTEX_Y + (H / 2 - VORTEX_Y) * drop};
};

// ─── 镜头：整体克制，破壳时猛烈 ──────────────────────────────────
const getCam = (frame: number): Cam => {
	const x = track(frame, [
		[0, 960],
		[205, 960],
		[300, 948],
		[440, 960],
		[T.shiftStart, 960],
		[T.shiftEnd, 1360, Easing.inOut(Easing.cubic)], // 右移：阿尔宙斯滑向画面左侧
		[ARCEUS_SCENE_FRAMES, 1380],
	]);
	const y = track(frame, [
		[0, 540],
		[200, 470], // 上摇对准漩涡中心
		[T.dropStart, 440],
		[T.dropStart + 8, 440],
		[T.dropEnd + 14, 545, Easing.inOut(Easing.quad)], // 略带滞后地跟随坠落
		[T.burst, 540],
		[T.burst + 12, 700, Easing.out(Easing.exp)], // 破壳白闪中压低机位
		[480, 690],
		[560, 420], // 从蹄部仰摇到头部
		[T.shiftEnd, 540],
		[ARCEUS_SCENE_FRAMES, 540],
	]);
	const zoom = track(frame, [
		[0, 1],
		[110, 1],
		[205, 1.04],
		[T.dropStart, 1.1],
		[T.crackStart, 1.14],
		[T.burst, 1.32, Easing.in(Easing.quad)], // 裂纹时越推越近
		[T.burst + 12, 0.95, Easing.out(Easing.exp)], // 破壳：猛拉远
		[480, 1.18],
		[560, 1.1],
		[T.shiftEnd, 0.98],
		[T.whiteOut - 10, 1.03],
		[ARCEUS_SCENE_FRAMES, 1.3, Easing.in(Easing.cubic)], // 推进光中
	]);
	const roll = track(frame, [
		[0, 0],
		[205, -1.2],
		[T.dropStart, 1.2],
		[T.burst, 0],
	]);
	const s = shake(frame, T.burst, 24, 30);
	return {x: x + s.x, y: y + s.y, zoom, roll: roll + s.roll};
};

// 开场穿越：镜头沿纵深前进，逐渐减速停下
const FLY_END = 115;
const flyTravel = (frame: number) => track(frame, [[0, 0], [FLY_END, 3.2, Easing.out(Easing.cubic)]]);

// ─── 背景：WebGL 远古星云 ─────────────────────────────────────
const BG_K = 0.3;
const Background: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	// 漩涡中心要始终对准主体：先投影到屏幕，再换算回背景层的局部坐标
	const focus = unproject(cam, BG_K, project(cam, 1, getFocus(frame)));

	const converge =
		interpolate(frame, [0, T.dropStart - 20], [0.15, 1], {...clamp, easing: Easing.inOut(Easing.sin)}) -
		interpolate(frame, [T.burst, T.burst + 80], [0, 0.75], {...clamp, easing: Easing.out(Easing.cubic)});
	const warm = interpolate(
		frame,
		[0, T.eggIn, T.burst - 5, T.burst, T.burst + 60, T.shiftEnd],
		[0.08, 0.25, 0.7, 1.6, 0.8, 0.65],
		clamp,
	);
	const rays = interpolate(frame, [T.burst, T.burst + 70], [0, 1], clamp);
	const bright = interpolate(frame, [0, 25], [0, 1], clamp);
	// 穿越时星云纹理向外扩张
	const zoom = flyTravel(frame) * 0.16;

	return (
		<CamLayer cam={cam} k={BG_K}>
			<Nebula center={focus} converge={converge} warm={warm} rays={rays} bright={bright} zoom={zoom} overscan={1.3} />
		</CamLayer>
	);
};

const FlyThrough: React.FC = () => {
	const frame = useFrame();
	const travel = flyTravel(frame);
	const speed = travel - flyTravel(frame - 1);
	const opacity = interpolate(frame, [0, 10, FLY_END - 10, FLY_END + 20], [0, 1, 0.8, 0], clamp);
	return <FlyThroughDust travel={travel} speed={speed} opacity={opacity} />;
};

// ─── 光蛋：凝成 → 心跳光环 → 坠落 → 颤动 → 裂纹 ───────────────────
const CRACKS = [
	'M100 26 L88 70 L110 104 L92 148 L114 190 L100 236',
	'M110 104 L140 116 L150 150',
	'M92 148 L62 160 L54 196',
	'M88 70 L64 86 L58 110',
	'M114 190 L140 200',
	'M100 26 L118 46',
];

const Egg: React.FC = () => {
	const frame = useFrame();
	if (frame < T.eggIn || frame >= T.burst) return null;

	const focus = getFocus(frame);
	const appear = spring({frame: frame - T.eggIn, fps: BASE_FPS, config: {damping: 200}, durationInFrames: 50});
	const breathe = 1 + Math.sin(frame * 0.18) * 0.015;
	// 落地时的轻微压扁回弹
	const land = frame >= T.dropEnd ? spring({frame: frame - T.dropEnd, fps: BASE_FPS, config: {damping: 9, stiffness: 180}}) : 0;
	const squash = frame >= T.dropEnd ? 1 - (1 - land) * 0.08 : 1;
	const shakeAmp = interpolate(frame, [T.crackStart - 5, T.burst - 1], [0, 9], clamp);
	const shakeX = Math.sin(frame * 2.7) * shakeAmp;
	const rot = Math.sin(frame * 1.9) * shakeAmp * 0.4;
	const glow = interpolate(frame, [T.eggIn, T.burst - 1], [30, 150], clamp);
	const inner = interpolate(frame, [T.crackStart, T.burst - 1], [0, 1], clamp);

	// 心跳光环：每 36 帧从蛋身扩散一圈
	const pulses = [0, 1, 2].map((k) => {
		const local = (frame - T.eggIn + k * 12) % 36;
		return {size: 260 + local * 9, opacity: (1 - local / 36) * 0.45 * appear};
	});

	return (
		<AbsoluteFill>
			{pulses.map((p, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: focus.x - (p.size * 0.78) / 2,
						top: focus.y - p.size / 2,
						width: p.size * 0.78,
						height: p.size,
						borderRadius: '50%',
						border: `1.5px solid rgba(${COLORS.goldRgb},${p.opacity})`,
						boxShadow: `0 0 18px rgba(${COLORS.glowRgb},${p.opacity * 0.6})`,
					}}
				/>
			))}
			<div
				style={{
					position: 'absolute',
					left: focus.x - 100,
					top: focus.y - 130,
					width: 200,
					height: 260,
					opacity: appear,
					transformOrigin: '50% 100%',
					transform: `translateX(${shakeX}px) rotate(${rot}deg) scale(${appear * breathe}) scaleY(${squash}) scaleX(${2 - squash})`,
				}}
			>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
						background: `radial-gradient(circle at 38% 28%, #fffdf5 0%, #fbe7b4 22%, #e2b25a 55%, #a86f25 82%, #6e4312 100%)`,
						boxShadow: `0 0 ${glow}px ${glow / 4}px rgba(${COLORS.glowRgb},0.7), 0 0 ${glow * 2}px ${glow / 2}px rgba(255,160,60,0.22), inset 0 -18px 40px rgba(90,50,10,0.55)`,
					}}
				/>
				{/* 裂纹将出现时，内部透出的光 */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
						background: 'radial-gradient(circle at 50% 50%, rgba(255,250,230,0.95), rgba(255,220,150,0.4) 45%, transparent 70%)',
						opacity: inner,
						mixBlendMode: 'screen',
					}}
				/>
				<svg viewBox="0 0 200 260" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
					{CRACKS.map((d, i) => {
						const start = T.crackStart + i * 5;
						const offset = interpolate(frame, [start, start + 20], [1, 0], clamp);
						return (
							<path
								key={i}
								d={d}
								fill="none"
								stroke="#fffaf0"
								strokeWidth={i === 0 ? 4 : 2.6}
								strokeLinecap="round"
								strokeLinejoin="round"
								pathLength={1}
								strokeDasharray={1}
								strokeDashoffset={offset}
								style={{filter: 'drop-shadow(0 0 5px #fff) drop-shadow(0 0 14px #ffd98a)'}}
							/>
						);
					})}
				</svg>
			</div>
		</AbsoluteFill>
	);
};

// ─── 破壳：闪光、冲击波、蛋壳碎片、流光火花 ──────────────────────
const SHARDS = Array.from({length: 14}, (_, i) => {
	const pts = Array.from({length: 3}, (__, k) => {
		const a = (k / 3) * Math.PI * 2 + random(`sha${i}${k}`) * 1.2;
		return `${50 + Math.cos(a) * 50}% ${50 + Math.sin(a) * 50}%`;
	});
	return {
		angle: (i / 14) * Math.PI * 2 + random(`sa${i}`) * 0.3,
		dist: 380 + random(`sd${i}`) * 520,
		size: 12 + random(`sz${i}`) * 22,
		spin: (random(`sr${i}`) - 0.5) * 720,
		clip: `polygon(${pts.join(', ')})`,
	};
});

const STREAKS = Array.from({length: 64}, (_, i) => ({
	angle: random(`ka${i}`) * Math.PI * 2,
	dist: 500 + random(`kd${i}`) * 900,
	len: 30 + random(`kl${i}`) * 90,
	width: 1.5 + random(`kw${i}`) * 2,
}));

const Burst: React.FC = () => {
	const frame = useFrame();
	if (frame < T.burst || frame > T.burst + 65) return null;

	const focus = getFocus(frame);
	const t = interpolate(frame, [T.burst, T.burst + 55], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const ring = 140 + t * 2600;
	const ring2 = 80 + t * 1600;

	return (
		<AbsoluteFill>
			{[
				{d: ring, w: 5, o: 1 - t},
				{d: ring2, w: 2, o: (1 - t) * 0.7},
			].map((r, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: focus.x - r.d / 2,
						top: focus.y - r.d / 2,
						width: r.d,
						height: r.d,
						borderRadius: '50%',
						border: `${r.w * (1 - t) + 1}px solid rgba(255,232,180,${r.o})`,
						boxShadow: `0 0 50px rgba(${COLORS.glowRgb},${0.7 * r.o}), inset 0 0 40px rgba(${COLORS.glowRgb},${0.4 * r.o})`,
					}}
				/>
			))}
			{SHARDS.map((s, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: focus.x + Math.cos(s.angle) * s.dist * t - s.size / 2,
						top: focus.y + Math.sin(s.angle) * s.dist * t * 0.8 - s.size / 2,
						width: s.size,
						height: s.size,
						clipPath: s.clip,
						background: 'linear-gradient(135deg, #fff8e6, #e2b25a 60%, #8a5518)',
						opacity: 1 - t,
						transform: `rotate(${s.spin * t}deg)`,
					}}
				/>
			))}
			{STREAKS.map((s, i) => {
				const d = s.dist * t;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: focus.x + Math.cos(s.angle) * d,
							top: focus.y + Math.sin(s.angle) * d * 0.75,
							width: s.len * (1 - t * 0.6),
							height: s.width,
							borderRadius: s.width,
							background: `linear-gradient(90deg, transparent, rgba(255,240,205,${1 - t}))`,
							transformOrigin: '100% 50%',
							transform: `translate(-100%, -50%) rotate(${(Math.atan2(Math.sin(s.angle) * 0.75, Math.cos(s.angle)) * 180) / Math.PI}deg)`,
							boxShadow: `0 0 8px rgba(${COLORS.glowRgb},${1 - t})`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

const Flash: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [T.burst - 4, T.burst + 1, T.burst + 30], [0, 0.95, 0], clamp);
	if (opacity <= 0) return null;
	return (
		<AbsoluteFill
			style={{
				opacity,
				background: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #fff3d2 40%, #f0cf8a 100%)',
			}}
		/>
	);
};

// ─── 阿尔宙斯：只用官方立绘，不做任何形变 ────────────────────────
const Arceus: React.FC = () => {
	const frame = useFrame();
	const focus = getFocus(frame);
	return (
		<PokemonArt
			src={ARCEUS_ART}
			x={focus.x}
			y={focus.y}
			size={ARCEUS_SIZE}
			appear={T.burst + 8}
			reveal={[T.revealStart, T.revealPeak, T.revealEnd]}
		/>
	);
};

const Rings: React.FC = () => {
	const frame = useFrame();
	const focus = getFocus(frame);
	return <SacredRings x={focus.x} y={focus.y} size={1000} revealFrom={T.revealStart - 20} revealFrames={90} opacity={0.5} />;
};

// ─── 名称卡 ─────────────────────────────────────────────────
const NAME = '阿尔宙斯';

const NameCard: React.FC = () => {
	const frame = useFrame();
	if (frame < T.nameIn) return null;

	const fade = (start: number, len = 20) => interpolate(frame, [start, start + len], [0, 1], clamp);
	const lineWidth = interpolate(frame, [T.nameIn + 30, T.nameIn + 65], [0, 560], {
		...clamp,
		easing: Easing.out(Easing.cubic),
	});
	const out = interpolate(frame, [T.fadeOut, T.fadeOut + 12], [1, 0], clamp);

	return (
		<div style={{position: 'absolute', left: 1030, top: 250, opacity: out}}>
			<div style={{display: 'flex', alignItems: 'baseline', gap: 18, opacity: fade(T.nameIn)}}>
				<span style={{fontFamily: CINZEL, fontSize: 26, letterSpacing: 6, color: COLORS.gold}}>No.0493</span>
				<span style={{fontFamily: SERIF, fontSize: 24, letterSpacing: 8, color: `rgba(${COLORS.goldRgb},0.85)`}}>
					幻之宝可梦
				</span>
				<span style={{fontFamily: CINZEL, fontSize: 16, letterSpacing: 4, color: `rgba(${COLORS.goldRgb},0.6)`}}>
					MYTHICAL POKÉMON
				</span>
			</div>
			<div style={{display: 'flex', marginTop: 6}}>
				{NAME.split('').map((ch, i) => {
					const local = frame - (T.nameIn + 8 + i * 6);
					const o = interpolate(local, [0, 14], [0, 1], clamp);
					const y = interpolate(local, [0, 18], [30, 0], {...clamp, easing: Easing.out(Easing.cubic)});
					const blur = interpolate(local, [0, 14], [12, 0], clamp);
					return (
						<span
							key={i}
							style={{
								fontFamily: SERIF,
								fontSize: 150,
								fontWeight: 900,
								lineHeight: 1.15,
								letterSpacing: 8,
								opacity: o,
								transform: `translateY(${y}px)`,
								filter: `blur(${blur}px) drop-shadow(0 0 22px rgba(${COLORS.glowRgb},0.45)) drop-shadow(0 3px 2px rgba(40,20,0,0.8))`,
								background: 'linear-gradient(180deg, #fff6dc 0%, #f1cb72 48%, #b78330 78%, #e9c57a 100%)',
								WebkitBackgroundClip: 'text',
								backgroundClip: 'text',
								color: 'transparent',
							}}
						>
							{ch}
						</span>
					);
				})}
			</div>
			<div
				style={{
					width: lineWidth,
					height: 2,
					marginTop: 6,
					background: `linear-gradient(90deg, rgba(${COLORS.goldRgb},0.95), transparent)`,
				}}
			/>
			<div style={{display: 'flex', alignItems: 'baseline', gap: 26, marginTop: 20, opacity: fade(T.nameIn + 40)}}>
				<span style={{fontFamily: CINZEL, fontSize: 40, fontWeight: 600, letterSpacing: 22, color: COLORS.parchment}}>
					ARCEUS
				</span>
			</div>
			<div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 16, opacity: fade(T.nameIn + 55)}}>
				<span style={{fontFamily: SERIF, fontSize: 26, letterSpacing: 8, color: `rgba(${COLORS.goldRgb},0.9)`}}>
					起始之物
				</span>
				<span style={{fontFamily: CINZEL, fontSize: 17, letterSpacing: 4, color: `rgba(${COLORS.goldRgb},0.6)`}}>
					THE ORIGINAL ONE
				</span>
			</div>
		</div>
	);
};

// 结尾：推进阿尔宙斯的光里，白闪转场（下一段从白光中淡入）
const WhiteOut: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [T.whiteOut, ARCEUS_SCENE_FRAMES - 1], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	if (opacity <= 0) return null;
	return (
		<AbsoluteFill
			style={{opacity, background: 'radial-gradient(circle at 30% 50%, #fffdf6 0%, #fff4dc 45%, #f6e2b8 100%)'}}
		/>
	);
};

export const ArceusScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const dustOpacity = interpolate(frame, [FLY_END - 30, FLY_END + 10], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: COLORS.void, overflow: 'hidden'}}>
			<Background cam={cam} />
			<CamLayer cam={cam} k={0.7}>
				<DustMotes opacity={dustOpacity * 0.6} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				<Rings />
				<Egg />
				<Arceus />
				<Burst />
			</CamLayer>
			{/* 近景浮尘：移动与缩放都比主体更大，拉开纵深 */}
			<CamLayer cam={cam} k={1.6} style={{filter: 'blur(1.5px)'}}>
				<DustMotes opacity={dustOpacity * 0.8} />
			</CamLayer>
			<FlyThrough />
			<Flash />
			<Vignette />
			<NameCard />
			<SubtitleBackdrop />

			<BiSubtitle
				variant="center"
				from={8}
				to={92}
				zh="宇宙诞生之前，就已经有一只宝可梦存在了。"
				en="Before the universe was born, a Pokémon already existed."
			/>
			<BiSubtitle
				from={98}
				to={198}
				zh="起初存在的，只有混沌的波澜。"
				en="In the beginning, there was only a churning turmoil of chaos."
				source={SOURCE_MYTH}
			/>
			<BiSubtitle
				from={204}
				to={336}
				zh="一切都混杂在一起，在那中心出现了一颗蛋。"
				en="At the heart of chaos, where all things became one, appeared an Egg."
				source={SOURCE_MYTH}
			/>
			<BiSubtitle
				from={342}
				to={432}
				zh="这颗蛋掉落后，从中诞生了起始之物。"
				en="Having tumbled from the vortex, the Egg gave rise to the Original One."
				source={SOURCE_MYTH}
			/>
			<BiSubtitle
				from={628}
				to={T.fadeOut + 10}
				zh="神话里将它描述为用１０００只手创造了宇宙的宝可梦。"
				en="It is described in mythology as the Pokémon that shaped the universe with its 1,000 arms."
				source={SOURCE_DEX}
			/>

			{/* 叫声：显色的峰值 */}
			<Cry name="arceus" at={T.revealPeak} />
			<Grain />
			<WhiteOut />
		</AbsoluteFill>
	);
};
