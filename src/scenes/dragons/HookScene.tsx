import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {Lightning} from '../../components/effects/Lightning';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {HOOK_SCENE_FRAMES, VOID_HANDOFF, globalTime} from './continuity';
import {ACCENT, DragonArt, DragonVoid, ElementBg, EpisodeTitle, Flash, HookName} from './Mono';

export {HOOK_SCENE_FRAMES};

/**
 * 第 1 段《三只龙》（开场钩子 + 标题，12.7 秒）：
 * 白焰、蓝雷、冰雾里三道剪影快切（不显色、不放叫声）→ 三只并排 → 化成光汇到一起，成为一个空洞 →
 * 本期标题《真实与理想》在空洞下方出现（用户 2026-10-04：标题放开头，结尾不放）。
 */

// 三个快切镜头
const SHOTS = [
	{from: 0, to: 44},
	{from: 44, to: 88},
	{from: 88, to: 132},
];
const TRIO = 132; // 三只并排
const MERGE = 186; // 化光汇聚
const VOID_ON = 206;

const push = (frame: number, from: number, to: number) =>
	interpolate(frame, [from, to], [1, 1.07], {...clamp, easing: Easing.out(Easing.quad)});

export const HookScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('hook', frame);

	const shot = SHOTS.findIndex((s) => frame >= s.from && frame < s.to);

	// 三只并排 → 汇聚
	const trioIn = interpolate(frame, [TRIO, TRIO + 8], [0, 1], clamp);
	const merge = interpolate(frame, [MERGE, VOID_ON + 10], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const trioFade = 1 - interpolate(frame, [MERGE + 6, VOID_ON + 4], [0, 1], clamp);
	const voidAmt = interpolate(frame, [VOID_ON - 6, VOID_ON + 12], [0, 1], clamp);
	const voidR = interpolate(frame, [VOID_ON - 6, VOID_ON + 24, HOOK_SCENE_FRAMES], [10, 150, VOID_HANDOFF.r], {
		...clamp,
		easing: Easing.out(Easing.cubic),
	});

	// 三只并排时的位置（汇聚时都往中心收）
	const lerp = (a: number, b: number) => a + (b - a) * merge;
	const trio = [
		{name: 'reshiram', x: lerp(420, 960), y: 520, size: 520, rgb: ACCENT.warm, dir: [0.6, -1] as [number, number]},
		{name: 'kyurem', x: 960, y: lerp(560, 540), size: 560, rgb: ACCENT.ice, dir: [0, -1] as [number, number]},
		{name: 'zekrom', x: lerp(1500, 960), y: 520, size: 520, rgb: ACCENT.blue, dir: [-0.6, -1] as [number, number]},
	];
	const trioScale = 1 - merge * 0.75;

	// 第 2 个镜头（捷克罗姆）的闪电
	const bolts = [48, 61, 76];
	const flick = bolts.reduce((m, b) => Math.max(m, interpolate(frame - b, [0, 1, 7], [0, 1, 0], clamp)), 0);

	const zoom = shot >= 0 ? push(frame, SHOTS[shot].from, SHOTS[shot].to) : 1;
	const zoomed = (child: React.ReactNode) => (
		<AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '50% 52%'}}>{child}</AbsoluteFill>
	);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{/* 镜头 1：白焰中的莱希拉姆 */}
			{shot === 0 &&
				zoomed(
					<>
						<ElementBg
							time={t}
							c={[960, 470]}
							glow={[1, 0.95, 0.88]}
							glowAmt={interpolate(frame, [0, 6], [0, 1.15], clamp)}
							glowR={0.28}
							rays={0.5}
							flame={interpolate(frame, [0, 10], [0.3, 1], clamp)}
						/>
						<DragonArt name="reshiram" x={960} y={540} size={900} reveal={0} rim={{dir: [0.4, -1], color: [2.4, 2.1, 1.8], power: 2}} />
					</>,
				)}
			{/* 镜头 2：蓝雷中的捷克罗姆 */}
			{shot === 1 &&
				zoomed(
					<>
						<ElementBg
							time={t}
							c={[960, 430]}
							glow={ACCENT.blue}
							glowAmt={0.7 + flick * 0.9}
							glowR={0.3}
							rays={0.35}
							storm={1}
							ink={[0.16, 0.18, 0.22]}
							flick={flick}
						/>
						{bolts.map((b, i) => (
							<Lightning key={b} at={b} seed={`hk${i}`} from={[[700, 1250, 980][i], -20]} to={[[820, 1120, 1010][i], 520]} rgb={ACCENT.blueRgb} width={3} />
						))}
						<DragonArt name="zekrom" x={960} y={560} size={900} reveal={0} rim={{dir: [-0.3, -1], color: [0.9, 1.9, 3.2], power: 2}} />
					</>,
				)}
			{/* 镜头 3：冰雾中的酋雷姆 */}
			{shot === 2 &&
				zoomed(
					<>
						<ElementBg time={t} c={[960, 500]} glow={ACCENT.ice} glowAmt={0.9} glowR={0.32} rays={0.25} frost={1} />
						<DragonArt name="kyurem" x={960} y={560} size={1050} reveal={0} rim={{dir: [0, -1], color: [1.7, 2.6, 3.0], power: 2}} />
					</>,
				)}

			{/* 三只并排 → 化成光汇到中心 */}
			{frame >= TRIO && frame < VOID_ON + 6 && (
				<AbsoluteFill style={{opacity: trioIn}}>
					{trio.map((d) => (
						<AbsoluteFill
							key={d.name}
							style={{
								background: `radial-gradient(circle at ${d.x}px ${d.y - 40}px, rgba(${d.rgb.map((v) => Math.round(v * 255)).join(',')},${0.32 * trioFade}) 0%, transparent ${18 + merge * 6}%)`,
							}}
						/>
					))}
					{trio.map((d) => (
						<DragonArt
							key={d.name}
							name={d.name}
							x={d.x}
							y={d.y}
							size={d.size * trioScale}
							reveal={0}
							opacity={trioFade}
							rim={{dir: d.dir, color: d.rgb.map((v) => v * (2.6 + merge * 3)) as [number, number, number], power: 2}}
						/>
					))}
				</AbsoluteFill>
			)}

			{/* 空洞：一条龙 */}
			<DragonVoid time={t} p={[VOID_HANDOFF.x, VOID_HANDOFF.y]} r={voidR} amt={voidAmt} />

			{/* 镜头切换处的短闪 */}
			<Flash at={44} len={5} peak={0.55} rgb={ACCENT.blueRgb} />
			<Flash at={88} len={5} peak={0.55} rgb={ACCENT.iceRgb} />
			<Flash at={TRIO} len={6} peak={0.4} />
			<Flash at={VOID_ON} len={12} peak={0.7} />

			<Vignette strength={0.75} />

			<HookName zh="莱希拉姆" en="RESHIRAM" from={6} to={44} rgb={ACCENT.warmRgb} />
			<HookName zh="捷克罗姆" en="ZEKROM" from={50} to={88} rgb={ACCENT.blueRgb} />
			<HookName zh="酋雷姆" en="KYUREM" from={94} to={132} rgb={ACCENT.iceRgb} />

			<BiSubtitle
				tone="mono"
				zh="传说，它们原本是同一条龙。"
				en="Legend says they were once a single dragon."
				from={TRIO + 8}
				to={VOID_ON + 14}
				source={{zh: '基因之楔（官方说明"原本为一体"）；黑白·夏卡', en: 'DNA Splicers; B/W Drayden'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="一条龙，是怎么变成三只的？"
				en="So how did one dragon become three?"
				from={VOID_ON + 20}
				to={296}
			/>

			{/* 本期标题：放在开场钩子之后（结尾不放） */}
			<EpisodeTitle from={300} to={HOOK_SCENE_FRAMES - 6} />

			<Grain opacity={0.12} frameOffset={0} />
		</AbsoluteFill>
	);
};
