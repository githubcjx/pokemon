import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {HUSK_SCENE_FRAMES, SEG_START, globalTime} from './continuity';
import {ACCENT, DragonArt, DragonVoid, ElementBg, Flash} from './Mono';
import {FallingStones} from './Stones';

export {HUSK_SCENE_FRAMES};

/**
 * 第 5 段《空壳》（27 秒）：
 * 两团光落地化作两块石头（"据说它在等待着英雄的到来"）→ 寒气漫进来："那么，第三只呢？" →
 * 空洞的残影再裂开一次，两团光飞走，原处留下一圈结冰的空壳 → 空壳缩成一颗陨石坠向远方 →
 * 笼目镇的夜：围墙、寒风、窗灯一盏盏熄灭 → 推向镇外的巨人洞窟 → 冰窟里酋雷姆显色（叫声 + 名称卡 + 图鉴）。
 */

const THIRD = 170;
const HUSK = 230;
const TOWN = 330;
const METEOR: [number, number] = [324, 350];
const CAVE = 540;
const KYUREM_REVEAL: [number, number] = [600, 634];

const MIX = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];

// 笼目镇剪影：围墙后面露出屋顶，二楼的窗亮着灯
const HOUSES = Array.from({length: 13}, (_, i) => {
	const x = 230 + i * 88 + random(`lh${i}`) * 30;
	const w = 54 + random(`lw${i}`) * 34;
	const h = 70 + random(`lhh${i}`) * 70;
	return {x, w, h, roof: 18 + random(`lr${i}`) * 22, off: 452 + random(`lo${i}`) * 58};
});
const GROUND = 822;
const WALL_TOP = GROUND - 58;

export const HuskScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('husk', frame);
	const g = SEG_START.husk + frame;

	// ── 石头 → 寒气 ──
	const dune = interpolate(frame, [18, 50], [0, 1], clamp);
	const cold = interpolate(frame, [THIRD - 10, HUSK], [0, 1], clamp);
	const stonesFade = 1 - interpolate(frame, [HUSK - 20, HUSK + 6], [0, 1], clamp);
	const stonesPush = interpolate(frame, [0, HUSK], [1, 1.08], clamp);

	// ── 空壳 ──
	const vAmt = interpolate(frame, [HUSK - 8, HUSK + 14, METEOR[0] - 4, METEOR[0] + 4], [0, 0.9, 0.9, 0], clamp);
	const vSplit = interpolate(frame, [HUSK + 16, HUSK + 40], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const vSep = interpolate(frame, [HUSK + 16, HUSK + 90], [0, 1100], {...clamp, easing: Easing.in(Easing.quad)});
	const husk = interpolate(frame, [HUSK + 30, HUSK + 70], [0, 1], clamp);
	const huskR = interpolate(frame, [HUSK, METEOR[0] - 8, METEOR[0] + 2], [150, 150, 6], {...clamp, easing: Easing.in(Easing.cubic)});

	// ── 陨石 → 笼目镇 ──
	const mp = interpolate(frame, METEOR, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const meteor = {x: 960 + (1610 - 960) * mp, y: 430 + (770 - 430) * mp};
	const townIn = interpolate(frame, [METEOR[0], METEOR[1] + 4], [0, 1], clamp);
	const crater = interpolate(frame, [METEOR[1], METEOR[1] + 10, METEOR[1] + 60], [0, 1.4, 0.55], clamp);
	const windowsOn = (h: (typeof HOUSES)[number]) => interpolate(frame, [h.off, h.off + 4], [1, 0], clamp);
	const townPush = interpolate(frame, [500, CAVE], [1, 2.6], {...clamp, easing: Easing.in(Easing.cubic)});

	// ── 冰窟 ──
	const kReveal = interpolate(frame, KYUREM_REVEAL, [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const cavePush = interpolate(frame, [CAVE, HUSK_SCENE_FRAMES], [1, 1.06], clamp);

	const phase = frame < TOWN ? 'dark' : frame < CAVE ? 'town' : 'cave';

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{phase === 'dark' && (
				<>
					<ElementBg
						time={t}
						bg={[0, 0, 0]}
						frost={0.35 + cold * 0.55}
						frostCol={MIX([0.55, 0.55, 0.55], ACCENT.ice, cold)}
						glow={ACCENT.ice}
						glowAmt={cold * 0.35}
						c={[960, 430]}
						glowR={0.45}
					/>
					<AbsoluteFill style={{opacity: stonesFade, transform: `scale(${stonesPush})`, transformOrigin: '50% 80%'}}>
						<FallingStones g={g} dune={dune} />
					</AbsoluteFill>
					<DragonVoid time={t} p={[960, 430]} r={huskR} split={vSplit} sep={vSep} amt={vAmt} husk={husk} />
				</>
			)}

			{phase === 'town' && (
				<AbsoluteFill style={{transform: `scale(${townPush})`, transformOrigin: '1610px 770px'}}>
					<ElementBg time={t} bg={[0.012, 0.016, 0.022]} frost={0.55} glow={ACCENT.ice} glowAmt={crater} c={[1610, 770]} glowR={0.16} />
					<svg width={1920} height={1080} style={{position: 'absolute', opacity: townIn}}>
						{/* 远山与陨石坑 */}
						<g transform={`translate(0, -40)`}>
						<path
							d={`M-20,${GROUND - 40} C300,${GROUND - 90} 600,${GROUND - 70} 900,${GROUND - 95} C1200,${GROUND - 120} 1420,${GROUND - 80} 1520,${GROUND - 60} C1570,${GROUND - 20} 1650,${GROUND - 20} 1700,${GROUND - 62} C1780,${GROUND - 100} 1880,${GROUND - 90} 1940,${GROUND - 80} L1940,1100 L-20,1100 Z`}
							fill="#05070a"
							style={{filter: 'drop-shadow(0 -1px 1.5px rgba(168,240,255,0.25))'}}
						/>
						</g>
						{/* 小镇放大一些，压在画面左下 */}
						<g transform={`translate(-170, ${GROUND * -0.4}) scale(1.4)`}>
						{/* 房屋 */}
						{HOUSES.map((h, i) => (
							<path
								key={i}
								d={`M${h.x},${GROUND} L${h.x},${GROUND - h.h} L${h.x + h.w / 2},${GROUND - h.h - h.roof} L${h.x + h.w},${GROUND - h.h} L${h.x + h.w},${GROUND} Z`}
								fill="#020203"
							/>
						))}
						{HOUSES.map((h, i) => {
							const on = windowsOn(h);
							if (on <= 0) return null;
							const tw = 0.85 + 0.15 * Math.sin(t * 2 + i);
							return (
								<g key={`w${i}`} fill={`rgba(255,246,226,${on * tw})`} style={{filter: 'drop-shadow(0 0 5px rgba(255,240,210,0.9))'}}>
									<rect x={h.x + h.w * 0.22} y={GROUND - h.h + 14} width={7} height={10} />
									{h.w > 70 && <rect x={h.x + h.w * 0.62} y={GROUND - h.h + 14} width={7} height={10} />}
								</g>
							);
						})}
						{/* 围墙 */}
						<path
							d={`M150,${GROUND + 40} L150,${WALL_TOP} ${Array.from({length: 30}, (_, i) => {
								const x = 150 + i * 42;
								return `L${x},${WALL_TOP} L${x},${WALL_TOP - 8} L${x + 22},${WALL_TOP - 8} L${x + 22},${WALL_TOP}`;
							}).join(' ')} L1410,${WALL_TOP} L1410,${GROUND + 40} Z`}
							fill="#010101"
							style={{filter: 'drop-shadow(0 -1px 1.2px rgba(168,240,255,0.45))'}}
						/>
						</g>
						<rect x={-20} y={GROUND} width={1960} height={300} fill="#010101" />
					</svg>
					{/* 陨石 */}
					{frame >= METEOR[0] && frame <= METEOR[1] && (
						<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
							<line
								x1={meteor.x - 300 * 0.89}
								y1={meteor.y - 300 * 0.46}
								x2={meteor.x}
								y2={meteor.y}
								stroke={`rgba(${ACCENT.iceRgb},0.9)`}
								strokeWidth={5}
								strokeLinecap="round"
								style={{filter: `drop-shadow(0 0 10px rgba(${ACCENT.iceRgb},1))`}}
							/>
							<circle cx={meteor.x} cy={meteor.y} r={10} fill="#fff" style={{filter: `drop-shadow(0 0 16px rgba(${ACCENT.iceRgb},1))`}} />
						</svg>
					)}
				</AbsoluteFill>
			)}

			{/* 空壳缩成陨石的那一下（画在暗场与小镇之间，盖住切换） */}
			{frame >= METEOR[0] - 6 && frame < TOWN && (
				<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
					<line
						x1={meteor.x - 300 * 0.89 * mp}
						y1={meteor.y - 300 * 0.46 * mp}
						x2={meteor.x}
						y2={meteor.y}
						stroke={`rgba(${ACCENT.iceRgb},0.9)`}
						strokeWidth={5}
						strokeLinecap="round"
						style={{filter: `drop-shadow(0 0 10px rgba(${ACCENT.iceRgb},1))`}}
					/>
					<circle cx={meteor.x} cy={meteor.y} r={10} fill="#fff" style={{filter: `drop-shadow(0 0 16px rgba(${ACCENT.iceRgb},1))`}} />
				</svg>
			)}

			{phase === 'cave' && <IceCave time={t} push={cavePush} reveal={kReveal} yaw={interpolate(frame, [CAVE, HUSK_SCENE_FRAMES], [-4, 2], clamp)} />}

			<Flash at={METEOR[1]} len={10} peak={0.55} rgb={ACCENT.iceRgb} />
			<Flash at={CAVE} len={14} peak={1} rgb="236,250,255" />

			<Vignette strength={0.75} />

			{phase === 'cave' && (
				<NameTag
					tone="mono"
					glowRgb={ACCENT.iceRgb}
					from={KYUREM_REVEAL[1] + 6}
					x={150}
					y={290}
					no="No.0646"
					category="境界宝可梦"
					categoryEn="BOUNDARY POKÉMON"
					zh="酋雷姆"
					en="KYUREM"
				/>
			)}
			<Cry name="kyurem" at={KYUREM_REVEAL[1]} />

			<BiSubtitle tone="mono" zh="双龙的肉体毁灭，化作了两块石头。" en="Their bodies were destroyed and turned to stone." from={26} to={98} source={{zh: '依据光明石 / 黑暗石道具说明', en: 'Light Stone / Dark Stone'}} />
			<BiSubtitle
				tone="mono"
				zh="据说它在等待着英雄的到来。"
				en="It is said to be waiting for the emergence of a hero."
				from={104}
				to={THIRD - 2}
				source={{zh: '光明石 / 黑暗石道具说明（官方中文）', en: 'Light Stone / Dark Stone (B/W)'}}
			/>
			<BiSubtitle tone="mono" zh="那么，第三只呢？" en="Then what of the third?" from={THIRD + 6} to={HUSK - 2} />
			<BiSubtitle
				tone="mono"
				zh="有人说，龙分成两半时，还留下了一具空壳。"
				en="Some say that when the dragon split, an empty husk was left behind."
				from={HUSK + 4}
				to={TOWN - 4}
				source={{zh: '黑2白2·魁奇思', en: 'B2/W2 Ghetsis: Kyurem is an empty being. The remnants of a certain Pokémon...'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="笼目镇流传着一个故事：远古的陨石里藏着怪物，夜里会随寒风进镇。"
				en="In Lacunosa Town, they say a monster hid in an ancient meteorite, and came into town on the cold night wind."
				from={TOWN + 6}
				to={444}
				source={{zh: '黑白 / 黑2白2·笼目镇老人', en: 'B/W, B2/W2 Lacunosa Town elder (JP original)'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="人们筑起围墙，天黑之后，谁也不出门。"
				en="So the people built a wall, and no one goes out after dark."
				from={450}
				to={CAVE - 6}
				source={{zh: '黑白 / 黑2白2·笼目镇老人', en: 'B/W, B2/W2 Lacunosa Town elder (JP original)'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="而在镇外的巨人洞窟深处，真的住着一只冰之龙。"
				en="And deep in the Giant Chasm beyond the town, there truly dwells a dragon of ice."
				from={CAVE + 6}
				to={KYUREM_REVEAL[1] + 2}
				source={{zh: '黑白 / 黑2白2：酋雷姆在巨人洞窟', en: 'Kyurem in the Giant Chasm'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="等待着用真实与理想填补自己失去的身体的英雄，是冰之传说的宝可梦。"
				en="This legendary ice Pokémon waits for a hero to fill in the missing parts of its body with truth or ideals."
				from={668}
				to={HUSK_SCENE_FRAMES - 4}
				source={{zh: '图鉴（B2W2 / X / OR 文本，官方中文）', en: 'Pokédex B2W2 / X / OR'}}
			/>

			<Grain opacity={0.12} frameOffset={SEG_START.husk} />
		</AbsoluteFill>
	);
};

/** 巨人洞窟深处的冰窟与酋雷姆（第 5 段结尾 / 第 6、7 段共用） */
export const IceCave: React.FC<{
	time: number;
	push?: number;
	reveal?: number;
	yaw?: number;
	kyurem?: number;
	brightness?: number;
	glow?: number;
	children?: React.ReactNode;
}> = ({time, push = 1, reveal = 1, yaw = 2, kyurem = 1, brightness = 1, glow = 0.9, children}) => (
	<AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '60% 50%'}}>
		<ElementBg time={time} bg={[0.008, 0.012, 0.018]} frost={1} glow={ACCENT.ice} glowAmt={glow} glowR={0.32} rays={0.3} c={[1150, 430]} />
		{kyurem > 0 && (
			<DragonArt
				name="kyurem"
				x={1150}
				y={580}
				size={1060}
				reveal={reveal}
				yaw={yaw}
				opacity={kyurem}
				brightness={brightness}
				rim={{dir: [0.2, -1], color: [1.7, 2.6, 3.0], power: 2}}
				rimAfter={0.4}
			/>
		)}
		{children}
		<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 14%, transparent 30%)'}} />
	</AbsoluteFill>
);
