import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, project, shake, track} from '../../camera';
import {CamLayer} from '../../components/CamLayer';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {add, CITY_DARK, DARKEN, DM_PEAK, DW_PEAK, FUSE, FX_OFF, LUN_PEAK, LUNGE, LUSA, NEC_OUT, P, riftUniforms, SOL_PEAK, WARP} from './common';
import {Backdrop, Crystal, fadeIn, fadeOut, LightStream, Motes, TrainerArt} from './fx';
import {FX_FRAG} from './gl';
import {ALTAR_FRAG, SNOW_FRAG} from './glAlola';
import {WARP_FRAG} from './glWarp';

/**
 * 阿罗拉与究极空间：
 *   3930–4075 露莎米奈闯进究极空间（白色的空间，一道究极之洞）
 *   4058–4745 左右对称分屏：日轮祭坛 / 月轮祭坛。太阳之兽、月亮之兽降临 → 背后撕开究极之洞，奈克洛兹玛冲出来、扑上去、吸收
 *             → 黄昏之鬃 / 拂晓之翼 → 阿罗拉的光被吸走，分界线消失，天上各处撕开究极之洞，它们逃进去
 *   4740–4895 究极空间跳跃骑行：左边年轻人骑露奈雅拉、右边骑索尔迦雷欧，在光的隧道里追
 *   5515–5660 黎明（光回到阿罗拉）
 *   5760–6520 拉纳基拉山顶的雪夜
 */

const KA = 0.85; // 祭坛与宝可梦所在层（与 ALTAR_FRAG 一致）
const A0 = 4058;

/** 一半画面：裁到左 / 右半边，里面以 x = 960 为这一半的中心 */
const Half: React.FC<{right: boolean; children: React.ReactNode}> = ({right, children}) => (
	<div style={{position: 'absolute', left: right ? 960 : 0, top: 0, width: 960, height: 1080, overflow: 'hidden'}}>
		<div style={{position: 'absolute', left: -480, top: 0, width: 1920, height: 1080}}>{children}</div>
	</div>
);

/** 镜像包一层：绕 (x, y) 水平翻转（只用于宝可梦） */
const Mirror: React.FC<{on: boolean; x: number; y: number; children: React.ReactNode}> = ({on, x, y, children}) => (
	<AbsoluteFill style={{transform: on ? 'scaleX(-1)' : undefined, transformOrigin: `${x}px ${y}px`}}>{children}</AbsoluteFill>
);

// ════════════════════════════════════════════════════════════════════════
// 露莎米奈闯进究极空间（3930–4075）
// ════════════════════════════════════════════════════════════════════════

export const ShotLusamine: React.FC<{f: number}> = ({f}) => {
	if (f < LUSA - 8 || f > 4078) return null;
	const white = Math.max(interpolate(f, [LUSA - 8, LUSA + 22], [1, 0], {...clamp, easing: Easing.out(Easing.quad)}), interpolate(f, [4040, 4072], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}));
	const zoom = interpolate(f, [LUSA, 4072], [1, 1.25], {...clamp, easing: Easing.in(Easing.quad)});
	// 她走进洞里：变小、往洞口移、淡去
	const walk = interpolate(f, [3998, 4045], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const h = interpolate(walk, [0, 1], [520, 150]);
	const y = interpolate(walk, [0, 1], [930, 640]);
	const riftO = interpolate(f, [LUSA, LUSA + 20], [0.6, 1], clamp);
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '960px 520px'}}>
				{/* 冷白色的空间（以太乐园的色调压暗，让究极之洞的光透出来） */}
				<AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 60% at 50% 44%, #8a93a8 0%, #4a5164 55%, #1c2030 100%)'}} />
				<div style={{position: 'absolute', left: 0, right: 0, top: 820, height: 260, background: 'linear-gradient(180deg, rgba(10,12,20,0), rgba(10,12,20,0.6))'}} />
				<Backdrop
					frag={FX_FRAG}
					f={f}
					cam={{x: 960, y: 540, zoom: 1, roll: 0}}
					blend="screen"
					uniforms={{...riftUniforms([{x: 960, y: 470, h: 700, a: 0, open: riftO}]), ...FX_OFF}}
				/>
				<TrainerArt who="lusamine" x={960} y={y} h={h} rimRgb="220,232,255" rim={1} opacity={1 - walk * 0.9} shade={0.16} />
				<Motes f={f} opacity={0.5} dir={-1} rainbow={0.6} rgb="230,236,255" />
			</AbsoluteFill>
			{white > 0.001 && <AbsoluteFill style={{background: `rgba(255,253,248,${white})`}} />}
		</AbsoluteFill>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 日轮祭坛 / 月轮祭坛（4058–4745）
// ════════════════════════════════════════════════════════════════════════

const altarCam = (f: number): Cam => {
	const s1 = shake(f, LUNGE, 14, 40);
	const s2 = shake(f, FUSE, 18, 36);
	const s3 = shake(f, NEC_OUT, 10, 30);
	return add(
		{
			x: 960,
			y: track(f, [
				[A0, 520],
				[LUNGE, 540],
				[DARKEN, 560],
				[4745, 470, Easing.in(Easing.cubic)],
			]),
			zoom: track(f, [
				[A0, 1.12],
				[4095, 1.0],
				[LUNGE, 1.04],
				[FUSE, 1.1],
				[DARKEN, 1.04],
				[4690, 0.98],
				[4745, 1.6, Easing.in(Easing.cubic)],
			]),
			roll: 0,
		},
		{x: s1.x + s2.x + s3.x, y: s1.y + s2.y + s3.y, roll: s1.roll + s2.roll},
	);
};

// 各半边里的位置（以 960 为中心）
const BEAST = {x: 960, y: 600};
const RIFT_L = {x: 690, y: 300}; // 左半边的究极之洞；右半边镜像到 1230

const necPos = (f: number): {x: number; y: number; size: number; o: number} => {
	const em = interpolate(f, [NEC_OUT + 8, NEC_OUT + 50], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const lunge = interpolate(f, [LUNGE, LUNGE + 16], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const x = interpolate(em, [0, 1], [RIFT_L.x, 760]) + (BEAST.x - 30 - 760) * lunge;
	const y = interpolate(em, [0, 1], [RIFT_L.y, 380]) + (BEAST.y - 60 - 380) * lunge;
	const size = interpolate(em, [0, 1], [90, 430]);
	const o = fadeIn(f, NEC_OUT + 8, NEC_OUT + 20) * interpolate(f, [LUNGE + 60, FUSE - 6], [1, 0], clamp);
	return {x, y, size, o};
};

const AltarHalf: React.FC<{f: number; cam: Cam; right: boolean; dark: number}> = ({f, cam, right, dark}) => {
	const peak = right ? LUN_PEAK : SOL_PEAK;
	const fpeak = right ? DW_PEAK : DM_PEAK;
	const beastO = interpolate(f, [peak - 36, peak - 10], [0, 1], clamp) * interpolate(f, [LUNGE + 75, FUSE], [1, 0], clamp);
	const beastB = interpolate(f, [peak - 30, peak, peak + 40], [2.6, 1.5, 1], clamp) * interpolate(f, [LUNGE + 50, FUSE - 10], [1, 0.5], clamp);
	const struggle = interpolate(f, [LUNGE, LUNGE + 8, LUNGE + 50, LUNGE + 75], [0, 1, 1, 0], clamp);
	const jit = struggle * Math.sin(f * 2.3) * 8;
	// 合体后：天空被吸黑，它们升起、钻进天上的究极之洞
	const flee = interpolate(f, [4660, 4725], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const fuseO = fadeIn(f, FUSE, FUSE + 6) * (1 - flee);
	const fuseB = interpolate(f, [FUSE, fpeak, fpeak + 50], [2.4, 1.5, 1], clamp);
	const fy = (right ? 590 + Math.sin(f * 0.05) * 6 : 600) - flee * 420;
	const n = necPos(f);
	const day = !right;
	const amb: [number, number, number] = day ? [1.0, 0.95, 0.86] : [0.6, 0.6, 0.8];
	const ambD: [number, number, number] = [amb[0] * (1 - 0.8 * dark), amb[1] * (1 - 0.8 * dark), amb[2] * (1 - 0.8 * dark)];
	return (
		<CamLayer cam={cam} k={KA}>
			{beastO > 0.01 && (
				<PokemonArt3D
					dir={right ? 'pokemon/lunala' : 'pokemon/solgaleo'}
					x={BEAST.x + jit}
					y={right ? BEAST.y - 40 + Math.sin(f * 0.05) * 8 : BEAST.y}
					size={right ? 620 : 560}
					depthScale={0.5}
					yaw={right ? Math.sin(f * 0.03) * 3 : -3}
					resolution={1.4}
					opacity={beastO}
					brightness={beastB}
					ambient={ambD}
					dirLights={day ? [{dir: [0.6, -0.7, 0.4], color: [0.45, 0.38, 0.25], wrap: 0.3}] : [{dir: [-0.5, -0.7, 0.4], color: [0.3, 0.3, 0.45], wrap: 0.3}]}
					rim={day ? {dir: [0.7, -0.7], color: [1.0, 0.85, 0.5], power: 2.4} : {dir: [-0.6, -0.8], color: [0.75, 0.7, 1.1], power: 2.4}}
					emissive={interpolate(f, [peak - 30, peak, peak + 60], [0.4, 1.2, 0.3], clamp)}
					emissiveTint={day ? [1.2, 1.0, 0.6] : [0.9, 0.85, 1.3]}
				/>
			)}
			{n.o > 0.01 && (
				<Mirror on={right} x={960} y={540}>
					<PokemonArt3D
						dir="pokemon/necrozma"
						x={n.x - jit}
						y={n.y}
						size={n.size}
						depthScale={0.5}
						resolution={1.4}
						opacity={n.o}
						ambient={[0.12, 0.12, 0.14]}
						rim={{dir: [0.3, 1], color: day ? [1.0, 0.85, 0.55] : [0.75, 0.7, 1.1], power: 2.2}}
						emissive={0.6 + 1.2 * struggle}
						emissiveTint={[1.1, 1.2, 1.4]}
						emissiveKey={[0.3, 0.75, 0.2, 0.6]}
					/>
				</Mirror>
			)}
			{fuseO > 0.01 && (
				<Mirror on={!right} x={BEAST.x} y={600}>
					<PokemonArt3D
						dir="pokemon/necrozma"
						variant={right ? '-dawn' : '-dusk'}
						x={BEAST.x}
						y={fy}
						size={(right ? 720 : 700) * (1 - 0.65 * flee)}
						depthScale={0.5}
						yaw={Math.sin(f * 0.03) * 3}
						resolution={1.4}
						opacity={fuseO}
						brightness={fuseB}
						ambient={[0.32 * (1 - 0.6 * dark) + 0.1, 0.3 * (1 - 0.6 * dark) + 0.1, 0.36 * (1 - 0.6 * dark) + 0.12]}
						rim={{dir: [0.4, -0.9], color: day ? [1.3, 1.0, 0.55] : [0.9, 0.75, 1.4], power: 2.0}}
						emissive={0.8 + 0.6 * dark}
						emissiveTint={day ? [1.3, 1.05, 0.6] : [1.0, 0.85, 1.4]}
					/>
				</Mirror>
			)}
			{/* 祭坛前的年轻人：左边小陽（究极之日）、右边美月（究极之月），站在外侧前景 */}
			<TrainerArt
				who={right ? 'selene' : 'elio'}
				x={right ? 1330 : 590}
				y={1050}
				h={320}
				rimRgb={day ? '255,222,160' : '210,195,255'}
				rim={0.85 * (1 - 0.5 * dark)}
				shade={0.05}
				opacity={fadeIn(f, A0, A0 + 30)}
			/>
		</CamLayer>
	);
};

// 合体时绕上去的晶体碎片（每半边）
const FuseShards: React.FC<{f: number; c: P}> = ({f, c}) => {
	if (f < LUNGE + 50 || f > FUSE + 4) return null;
	const u = interpolate(f, [LUNGE + 50, FUSE], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))'}}>
			{Array.from({length: 16}, (_, i) => {
				const a = (i / 16) * Math.PI * 2 + f * 0.12;
				const r = (330 - 280 * u) * (0.8 + (0.4 * ((i * 37) % 10)) / 10);
				return <Crystal key={i} x={c.x + Math.cos(a) * r} y={c.y + Math.sin(a) * r * 0.5} size={18 + (i % 4) * 8} rot={a * 57} seed={`fs${i}`} glint={u} edge="240,240,255" />;
			})}
		</svg>
	);
};

// 阿罗拉的天上各处撕开的究极之洞（屏幕坐标）
const SKY_RIFTS = [
	{x: 300, y: 210, h: 260, a: 0.25, t: DARKEN + 30},
	{x: 760, y: 120, h: 220, a: -0.1, t: DARKEN + 44},
	{x: 1180, y: 160, h: 300, a: 0.12, t: DARKEN + 36},
	{x: 1640, y: 230, h: 260, a: -0.22, t: DARKEN + 50},
	{x: 520, y: 420, h: 180, a: 0.35, t: DARKEN + 60},
	{x: 1420, y: 400, h: 200, a: -0.3, t: DARKEN + 66},
];

export const ShotAltar: React.FC<{f: number}> = ({f}) => {
	if (f < A0 - 2 || f > 4747) return null;
	const cam = altarCam(f);
	const dark = interpolate(f, [DARKEN, DARKEN + 90], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const pillar = (peak: number) => interpolate(f, [peak - 46, peak - 6, peak + 60], [0, 1.2, 0.25], clamp) * fadeOut(f, NEC_OUT - 10, NEC_OUT + 20);
	const flash = interpolate(f, [FUSE - 2, FUSE, FUSE + 30], [0, 1, 0], clamp);
	const white = Math.max(interpolate(f, [A0, A0 + 34], [1, 0], {...clamp, easing: Easing.out(Easing.quad)}), interpolate(f, [4718, 4745], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}));
	// 祭坛背后：左右各一个究极之洞（屏幕坐标）
	const rl = project(cam, KA, RIFT_L);
	const riftO = interpolate(f, [NEC_OUT - 6, NEC_OUT + 16, LUNGE + 30, LUNGE + 80], [0, 1, 1, 0], clamp);
	const skyRifts = SKY_RIFTS.map((r) => ({x: r.x, y: r.y, h: r.h, a: r.a, open: interpolate(f, [r.t, r.t + 24], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})}));
	const rifts = f < DARKEN ? [
		{x: rl.x - 480, y: rl.y, h: 300, a: 0.2, open: riftO},
		{x: 1920 - (rl.x - 480), y: rl.y, h: 300, a: -0.2, open: riftO},
	] : skyRifts;
	const beastS = project(cam, KA, BEAST);
	const necL = necPos(f);
	const necS = project(cam, KA, {x: necL.x, y: necL.y});
	const line = interpolate(f, [DARKEN + 10, DARKEN + 70], [1, 0], clamp);
	return (
		<AbsoluteFill>
			<Backdrop
				frag={ALTAR_FRAG}
				f={f}
				cam={cam}
				uniforms={{
					uSplit: 1,
					uDarkL: dark,
					uDarkR: dark,
					uPillarL: pillar(SOL_PEAK),
					uPillarR: pillar(LUN_PEAK),
					uFlash: flash * 0.6,
					uCrackLine: 0,
					uLine: line,
					uDawnLight: 0,
				}}
			/>
			<Half right={false}>
				<AltarHalf f={f} cam={cam} right={false} dark={dark} />
				<FuseShards f={f} c={beastS} />
				<LightStream f={f} from={beastS} to={necS} start={LUNGE + 50} end={FUSE - 8} n={50} rgb="255,220,150" seed="drainL" spread={90} width={1.5} />
			</Half>
			<Half right>
				<AltarHalf f={f} cam={cam} right dark={dark} />
				<FuseShards f={f} c={beastS} />
				<LightStream f={f} from={beastS} to={{x: 1920 - necS.x, y: necS.y}} start={LUNGE + 50} end={FUSE - 8} n={50} rgb="210,190,255" seed="drainR" spread={90} width={1.5} />
			</Half>
			<Backdrop frag={FX_FRAG} f={f} cam={cam} blend="screen" uniforms={{...riftUniforms(rifts), ...FX_OFF}} />
			{/* 阿罗拉的光被吸进合体后的身体 */}
			<LightStream f={f} from={{x: 300, y: 80}} to={{x: 480, y: 560}} start={DARKEN} end={DARKEN + 80} n={44} rgb="255,220,150" seed="skyL" spread={160} />
			<LightStream f={f} from={{x: 1620, y: 80}} to={{x: 1440, y: 540}} start={DARKEN} end={DARKEN + 80} n={44} rgb="210,190,255" seed="skyR" spread={160} />
			{flash > 0.01 && <AbsoluteFill style={{background: `rgba(255,255,255,${flash * 0.7})`}} />}
			{white > 0.001 && <AbsoluteFill style={{background: `rgba(255,253,248,${white})`}} />}
		</AbsoluteFill>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 究极空间跳跃骑行（4740–4895）
// ════════════════════════════════════════════════════════════════════════

export const ShotWarp: React.FC<{f: number}> = ({f}) => {
	if (f < WARP - 6 || f > 4897) return null;
	const white = Math.max(interpolate(f, [WARP - 6, WARP + 20], [1, 0], {...clamp, easing: Easing.out(Easing.quad)}), interpolate(f, [4868, 4895], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}));
	// 冲刺：先从远处飞近，再一直往前冲
	const near = interpolate(f, [WARP, WARP + 50, 4895], [0.75, 1, 1.12], {...clamp, easing: Easing.out(Easing.cubic)});
	const jx = Math.sin(f * 1.9) * 4;
	const jy = Math.cos(f * 2.3) * 3;
	const bob = Math.sin(f * 0.12) * 10;
	const cam: Cam = {x: 960, y: 540, zoom: 1, roll: 0};
	return (
		<AbsoluteFill>
			<Backdrop frag={WARP_FRAG} f={f} cam={cam} uniforms={{uSplit: 1, uSpeed: interpolate(f, [WARP, WARP + 40], [0.8, 1.6], clamp), uFlash: 0, uLine: 1}} />
			{/* 左：究极之日，年轻人骑着露奈雅拉 */}
			<Half right={false}>
				<AbsoluteFill style={{transform: `translate(${jx}px, ${jy + bob}px) scale(${near})`, transformOrigin: '960px 560px'}}>
					{/* 坐在露奈雅拉背上（画在它后面，下半身被身体挡住） */}
					<TrainerArt who="elio" x={962} y={728} h={280} crop={0.5} rimRgb="255,224,160" rim={0.9} shade={0.06} />
					<PokemonArt3D
						dir="pokemon/lunala"
						x={960}
						y={580}
						size={560}
						depthScale={0.5}
						yaw={Math.sin(f * 0.07) * 4}
						pitch={-4}
						resolution={1.3}
						ambient={[0.5, 0.48, 0.62]}
						rim={{dir: [0, -1], color: [1.0, 0.86, 0.6], power: 2.2}}
						emissive={0.6}
						emissiveTint={[1.0, 0.9, 1.3]}
					/>
				</AbsoluteFill>
			</Half>
			{/* 右：究极之月，年轻人骑着索尔迦雷欧 */}
			<Half right>
				<AbsoluteFill style={{transform: `translate(${-jx}px, ${jy - bob}px) scale(${near})`, transformOrigin: '960px 560px'}}>
					<PokemonArt3D
						dir="pokemon/solgaleo"
						x={960}
						y={600}
						size={540}
						depthScale={0.5}
						yaw={-4 + Math.sin(f * 0.07) * 3}
						resolution={1.3}
						ambient={[0.62, 0.58, 0.66]}
						rim={{dir: [0.8, -0.6], color: [0.9, 0.8, 1.2], power: 2.2}}
						emissive={0.5}
						emissiveTint={[1.2, 1.0, 0.7]}
					/>
					{/* 骑在索尔迦雷欧背上（画在前面，只露出腰部以上，腰线落在背上） */}
					<TrainerArt who="selene" x={886} y={722} h={280} crop={0.5} rimRgb="225,210,255" rim={0.9} shade={0.06} />
				</AbsoluteFill>
			</Half>
			<Motes f={f * 3} opacity={0.6} dir={1} rainbow={0.7} rgb="240,240,255" />
			{white > 0.001 && <AbsoluteFill style={{background: `rgba(255,253,248,${white})`}} />}
		</AbsoluteFill>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 黎明（5515–5660）
// ════════════════════════════════════════════════════════════════════════

const dawnCam = (f: number): Cam => ({
	x: 960,
	y: track(f, [
		[5515, 560],
		[5600, 540],
		[5660, 300, Easing.inOut(Easing.cubic)],
	]),
	zoom: track(f, [
		[5515, 1.06],
		[5600, 1.0],
	]),
	roll: 0,
});

export const ShotDawn: React.FC<{f: number}> = ({f}) => {
	if (f < 5513 || f > CITY_DARK + 22) return null;
	const cam = dawnCam(f);
	const white = interpolate(f, [5520, 5575], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	return (
		<AbsoluteFill style={{opacity: fadeOut(f, CITY_DARK - 12, CITY_DARK + 20)}}>
			<Backdrop frag={ALTAR_FRAG} f={f} cam={cam} uniforms={{uSplit: 0, uDarkL: 0, uDarkR: 0, uPillarL: 0, uPillarR: 0, uFlash: 0, uCrackLine: 0, uLine: 0, uDawnLight: interpolate(f, [5520, 5620], [0.3, 1], clamp)}} />
			{/* 光点像雨一样落回阿罗拉 */}
			<Motes f={f} opacity={interpolate(f, [5520, 5550, 5620, 5660], [0, 1, 0.8, 0.3], clamp)} dir={1} rainbow={0.8} rgb="255,236,210" />
			{white > 0.001 && <AbsoluteFill style={{background: `rgba(255,253,248,${white})`}} />}
		</AbsoluteFill>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 拉纳基拉山顶的雪夜（5760–6520）
// ════════════════════════════════════════════════════════════════════════

const KG = 0.85;
const CRATER = {x: 980, y: 805, rx: 330, ry: 72};
const NEC = {x: 980, y: 690, size: 400};
const LIGHTS_AT = 6040;
const S0 = 5760;

const snowCam = (f: number): Cam => ({
	x: track(f, [
		[S0, 960],
		[5800, 960],
		[5900, 980],
	]),
	y: track(f, [
		[S0, -480],
		[5800, -480],
		[5900, 560],
		[6300, 545],
		[6520, 420],
	]),
	zoom: track(f, [
		[S0, 1.0],
		[5900, 1.0],
		[6330, 1.1],
		[6520, 1.04],
	]),
	roll: 0,
});

export const ShotSnow: React.FC<{f: number}> = ({f}) => {
	if (f < S0) return null;
	const cam = snowCam(f);
	const glow = interpolate(f, [LIGHTS_AT + 50, LIGHTS_AT + 130], [0, 1], clamp);
	const calm = interpolate(f, [LIGHTS_AT + 70, LIGHTS_AT + 170], [0, 1], clamp);
	const tremble = (1 - calm) * Math.sin(f * 1.1) * 2.2;
	const lightPos = (i: number) => {
		const u = interpolate(f, [LIGHTS_AT, LIGHTS_AT + 100], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
		const x = i === 0 ? interpolate(u, [0, 1], [760, 840]) : interpolate(u, [0, 1], [1220, 1120]);
		const y = interpolate(u, [0, 1], [-260, 610]) + Math.sin(f * 0.05 + i * 2) * 8 * u;
		return {x, y};
	};
	const necS = project(cam, KG, {x: NEC.x, y: NEC.y - 60});
	const fanI = interpolate(f, [LIGHTS_AT + 90, LIGHTS_AT + 150, 6420, 6500], [0, 0.22, 0.22, 0], clamp);
	return (
		<AbsoluteFill style={{opacity: fadeIn(f, S0, S0 + 32)}}>
			<Backdrop frag={SNOW_FRAG} f={f} cam={cam} uniforms={{uCrater: [CRATER.x, CRATER.y, CRATER.rx, CRATER.ry], uGlow: glow, uDawnMix: 0}} />
			<CamLayer cam={cam} k={KG}>
				<PokemonArt3D
					dir="pokemon/necrozma"
					x={NEC.x + tremble}
					y={NEC.y}
					size={NEC.size}
					depthScale={0.5}
					yaw={-4 + tremble}
					resolution={1.6}
					ambient={[0.09 + 0.08 * glow, 0.1 + 0.07 * glow, 0.16 + 0.04 * glow]}
					dirLights={[
						{dir: [-0.6, -0.6, 0.5], color: [0.3, 0.36, 0.55], wrap: 0.4},
						{dir: [0, -0.2, 1], color: [0.25 * glow, 0.22 * glow, 0.15 * glow], wrap: 0.5},
					]}
					rim={{dir: [-0.7, -0.7], color: [0.6, 0.7, 1.0], power: 2.4}}
					emissive={0.35 + 0.25 * Math.sin(f * 0.07) * (1 - calm) + 0.3 * glow}
					emissiveTint={[1.0, 1.1, 1.3]}
					emissiveKey={[0.3, 0.75, 0.2, 0.6]}
				/>
				{[0, 1].map((i) => {
					const p = lightPos(i);
					const c = i === 0 ? '255,214,140' : '210,200,255';
					const o = fadeIn(f, LIGHTS_AT, LIGHTS_AT + 20);
					return (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: p.x - 70,
								top: p.y - 70,
								width: 140,
								height: 140,
								borderRadius: '50%',
								opacity: o,
								mixBlendMode: 'screen',
								background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${c},0.9) 12%, rgba(${c},0.35) 35%, rgba(${c},0) 70%)`,
							}}
						/>
					);
				})}
			</CamLayer>
			<Backdrop frag={FX_FRAG} f={f} cam={cam} blend="screen" uniforms={{...riftUniforms([]), ...FX_OFF, uFan: [necS.x, necS.y, -1.57, 0.7], uFanL: [520, fanI * 0.7]}} />
			{/* 年轻人从Ｚ手环分给它的光（从画面下方、镜头这一侧飘过去） */}
			<LightStream f={f} from={{x: 960, y: 1060}} to={necS} start={5932} end={6030} n={80} rgb="245,240,255" seed="zring" spread={170} width={2.6} />
			{/* 雪 */}
			<Motes f={f} opacity={0.5} dir={1} rgb="230,238,255" />
		</AbsoluteFill>
	);
};
