import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {Lightning} from '../../components/effects/Lightning';
import {Cam, shake, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {FOUNDING_SCENE_FRAMES, SEG_START, SPLIT_SCENE_FRAMES, globalTime} from './continuity';
import {foundingCam} from './FoundingScene';
import {Faceoff} from './Faceoff';
import {ACCENT, DragonArt, ElementBg, Flash} from './Mono';
import {Stage, voidScreen, VOID_W} from './Stage';

export {SPLIT_SCENE_FRAMES};

/**
 * 第 3 段《分裂》（29 秒）：
 * 兄弟争执（弟弟转身、天空分成暖 / 蓝两半、空洞颤动）→ 空洞一分为二 → 两团光各自飘向兄弟俩（N 的说法）→
 * 暖白的一半化作莱希拉姆（黑底白焰，显色 + 叫声 + 名称卡 + 图鉴）→
 * 蓝色的一半化作捷克罗姆（白底雷云，黑色剪影 → 显色 + 叫声 + 名称卡 + 图鉴）→ 左右对峙（接第 4 段）。
 */

const EASE = Easing.inOut(Easing.cubic);
const SPLIT = 205; // 空洞裂开
const TO_RESHIRAM = 400; // 切到莱希拉姆
const RESHIRAM_REVEAL: [number, number] = [406, 440];
const TO_ZEKROM = 620; // 切到捷克罗姆
const ZEKROM_REVEAL: [number, number] = [640, 674];
const FACEOFF = 846; // 左右对峙

const startCam = foundingCam(FOUNDING_SCENE_FRAMES);

const splitCam = (frame: number): Cam => ({
	x: track(frame, [
		[0, startCam.x],
		[200, 960],
	]),
	y: track(frame, [
		[0, startCam.y],
		[200, 640],
		[370, 600],
	]),
	zoom: track(frame, [
		[0, startCam.zoom],
		[200, 1.7],
		[SPLIT + 4, 1.58, Easing.out(Easing.quad)],
		[370, 1.5],
	]),
	roll: 0,
});

export const SplitScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('split', frame);

	// ── 远古合众：争执与分裂 ──
	const base = splitCam(frame);
	const sk = shake(frame, SPLIT, 16, 28);
	const cam: Cam = {x: base.x + sk.x, y: base.y + sk.y, zoom: base.zoom, roll: sk.roll};
	const youngerFacing = interpolate(frame, [24, 46], [1, -1], {...clamp, easing: EASE});
	const rimIn = interpolate(frame, [40, 120], [0.45, 0.95], clamp);
	const rimTint = interpolate(frame, [40, 120], [0, 1], clamp);
	const mixRgb = (a: string, k: number) => {
		const A = a.split(',').map(Number);
		return A.map((v) => Math.round(255 + (v - 255) * k)).join(',');
	};
	const skySplit = interpolate(frame, [60, 200], [0, 0.85], clamp);
	const strikes = [132, 168, 186];
	const flick = strikes.reduce((m, b) => Math.max(m, interpolate(frame - b, [0, 1, 6], [0, 1, 0], clamp)), 0);
	const jitter = interpolate(frame, [110, 200, SPLIT, SPLIT + 1], [0, 6, 6, 0], clamp);
	const tear = interpolate(frame, [150, SPLIT - 2, SPLIT + 10], [0, 1, 0], clamp);
	const vsplit = interpolate(frame, [SPLIT, SPLIT + 40], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const sep = interpolate(frame, [SPLIT, SPLIT + 40, 280, 380], [0, 150, 160, 430], {...clamp, easing: EASE});
	const dy = interpolate(frame, [280, 390], [0, 90], {...clamp, easing: EASE});

	// 暖白的一团光扩开、吞没画面 → 莱希拉姆
	const vs = voidScreen(cam);
	const sScale = 1 + (cam.zoom - 1) * VOID_W.k;
	const leftOrb = {x: vs.x - sep * sScale, y: vs.y + dy * sScale};
	const flare = interpolate(frame, [TO_RESHIRAM - 20, TO_RESHIRAM], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});

	// ── 莱希拉姆 ──
	const rReveal = interpolate(frame, RESHIRAM_REVEAL, [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const rPush = interpolate(frame, [TO_RESHIRAM, TO_ZEKROM], [1.0, 1.06], clamp);
	// ── 捷克罗姆 ──
	const zReveal = interpolate(frame, ZEKROM_REVEAL, [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const zPush = interpolate(frame, [TO_ZEKROM, FACEOFF], [1.0, 1.06], clamp);
	const zBolts = [TO_ZEKROM - 6, 652, 700, 748, 796];
	const zFlick = zBolts.reduce((m, b) => Math.max(m, interpolate(frame - b, [0, 1, 7], [0, 1, 0], clamp)), 0);
	// ── 对峙 ──
	const face = interpolate(frame, [FACEOFF, FACEOFF + 18], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});

	const phase = frame < TO_RESHIRAM ? 'land' : frame < TO_ZEKROM ? 'reshiram' : frame < FACEOFF ? 'zekrom' : 'faceoff';

	const reshiramWorld = (dx = 0) => (
		<>
			<ElementBg time={t} c={[820 + dx, 470]} glow={[1, 0.95, 0.88]} glowAmt={1.0} glowR={0.3} rays={0.45} flame={1} />
		</>
	);
	const zekromWorld = (flickV: number) => (
		<>
			<ElementBg
				time={t}
				c={[1110, 430]}
				bg={[0.97, 0.975, 0.98]}
				storm={1}
				ink={[0.05, 0.06, 0.07]}
				glow={ACCENT.blue}
				glowAmt={0.15 + flickV * 0.4}
				flick={flickV}
			/>
			{/* 地面：压暗下方，字幕在这里 */}
			<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 11%, rgba(0,0,0,0.7) 21%, transparent 35%)'}} />
		</>
	);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{phase === 'land' && (
				<>
					<Stage
						time={t}
						cam={cam}
						skySplit={skySplit}
						flick={flick}
						town={1}
						lights={1}
						youngerFacing={youngerFacing}
						elderRim={{rgb: mixRgb(ACCENT.warmRgb, rimTint), amt: rimIn}}
						youngerRim={{rgb: mixRgb(ACCENT.blueRgb, rimTint), amt: rimIn}}
						void={{split: vsplit, sep, tear, jitter, dy}}
					/>
					{strikes.map((b, i) => (
						<Lightning key={b} at={b} seed={`sp${i}`} from={[[1500, 1720, 1380][i], -20]} to={[[1560, 1640, 1450][i], 560]} rgb={ACCENT.blueRgb} width={2.5} />
					))}
					<AbsoluteFill
						style={{
							background: `radial-gradient(circle at ${leftOrb.x}px ${leftOrb.y}px, rgba(255,246,232,${flare}) 0%, rgba(255,236,210,${flare}) ${flare * 60}%, rgba(255,230,200,${flare * 0.6}) ${flare * 90 + 5}%, transparent ${flare * 130 + 10}%)`,
						}}
					/>
				</>
			)}

			{phase === 'reshiram' && (
				<AbsoluteFill style={{transform: `scale(${rPush})`, transformOrigin: '45% 50%'}}>
					{reshiramWorld()}
					<DragonArt
						name="reshiram"
						x={820}
						y={560}
						size={980}
						reveal={rReveal}
						yaw={interpolate(frame, [TO_RESHIRAM, TO_ZEKROM], [4, -2], clamp)}
						rim={{dir: [0.5, -1], color: [2.6, 2.3, 1.9], power: 2}}
						rimAfter={0.3}
					/>
					{/* 字幕区压暗（莱希拉姆是白色的，字幕不能直接压在身上） */}
					<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 14%, transparent 30%)'}} />
				</AbsoluteFill>
			)}

			{phase === 'zekrom' && (
				<AbsoluteFill style={{transform: `scale(${zPush})`, transformOrigin: '55% 50%'}}>
					{zekromWorld(zFlick)}
					{zBolts.map((b, i) => (
						<Lightning key={b} at={b} seed={`zk${i}`} from={[[1300, 760, 1560, 900, 1420][i], -30]} to={[[1220, 860, 1480, 980, 1350][i], 600]} rgb={ACCENT.blueRgb} width={3.5} />
					))}
					<DragonArt
						name="zekrom"
						x={1110}
						y={540}
						size={1000}
						reveal={zReveal}
						yaw={interpolate(frame, [TO_ZEKROM, FACEOFF], [-4, 2], clamp)}
						rim={{dir: [-0.4, -1], color: [0.8, 1.8, 3.2], power: 2}}
						rimAfter={0.45}
					/>
				</AbsoluteFill>
			)}

			{phase === 'faceoff' && <Faceoff time={t} slide={face} />}

			<Flash at={SPLIT} len={14} peak={0.85} />
			<Flash at={TO_RESHIRAM} len={12} peak={1} rgb="255,244,228" />
			<Flash at={TO_ZEKROM} len={10} peak={0.9} rgb={ACCENT.blueRgb} />
			<Flash at={FACEOFF} len={8} peak={0.7} />

			<Vignette strength={phase === 'zekrom' ? 0.45 : 0.75} />

			{phase === 'reshiram' && (
				<NameTag
					tone="mono"
					glowRgb={ACCENT.warmRgb}
					from={RESHIRAM_REVEAL[1] + 6}
					x={1290}
					y={300}
					no="No.0643"
					category="白阳宝可梦"
					categoryEn="VAST WHITE POKÉMON"
					zh="莱希拉姆"
					en="RESHIRAM"
				/>
			)}
			{phase === 'zekrom' && (
				<NameTag
					tone="monoDark"
					glowRgb={ACCENT.blueRgb}
					from={ZEKROM_REVEAL[1] + 6}
					x={170}
					y={410}
					no="No.0644"
					category="黑阴宝可梦"
					categoryEn="DEEP BLACK POKÉMON"
					zh="捷克罗姆"
					en="ZEKROM"
				/>
			)}

			<Cry name="reshiram" at={RESHIRAM_REVEAL[1]} fadeOut={[TO_ZEKROM - 20, TO_ZEKROM]} />
			<Cry name="zekrom" at={ZEKROM_REVEAL[1]} fadeOut={[FACEOFF - 20, FACEOFF]} />

			<BiSubtitle tone="mono" zh="后来，兄弟俩起了争执。" en="But then the brothers began to argue." from={6} to={80} source={{zh: '黑白·夏卡', en: 'B/W Drayden'}} />
			<BiSubtitle
				tone="mono"
				zh="哥哥追求真实，弟弟追求理想，要分出谁对谁错。"
				en="The elder sought truth, the younger sought ideals, and each insisted he was right."
				from={86}
				to={194}
				source={{zh: '黑白·夏卡', en: 'B/W Drayden: ...began to argue about how to decide which one of them was right'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="那条龙，把自己的身体分成了两半。"
				en="And the dragon split its body in two."
				from={200}
				to={268}
				source={{zh: '黑白·夏卡', en: 'B/W Drayden: ...split its body into two'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="有一种说法：它是两边都想帮，才把自己分开。"
				en="Some say it split because it wanted to stand by both of them."
				from={274}
				to={370}
				source={{zh: '宝可梦大师 EX·N', en: "Pokémon Masters EX, N: It wanted to support both heroes, and that's what caused it to split"}}
			/>
			<BiSubtitle tone="mono" zh="一半追随了哥哥——" en="One half sided with the elder brother—" from={374} to={TO_RESHIRAM + 22} source={{zh: '黑白·夏卡', en: 'B/W Drayden'}} />
			<BiSubtitle
				tone="mono"
				zh="用火焰让世界燃烧殆尽的传说的宝可梦。会帮助构筑真实世界的人。"
				en="This legendary Pokémon can scorch the world with fire. It helps those who want to build a world of truth."
				from={488}
				to={TO_ZEKROM - 6}
				source={{zh: '图鉴（B2W2 / X / OR 文本，官方中文）', en: 'Pokédex B2W2 / X / OR'}}
			/>
			<BiSubtitle tone="mono" zh="另一半，追随了弟弟。" en="The other, with the younger." from={TO_ZEKROM + 4} to={TO_ZEKROM + 58} source={{zh: '黑白·夏卡', en: 'B/W Drayden'}} />
			<BiSubtitle
				tone="mono"
				zh="用闪电让世界燃烧殆尽的传说的宝可梦。会辅佐创造理想世界的人。"
				en="This legendary Pokémon can scorch the world with lightning. It assists those who want to build an ideal world."
				from={712}
				to={FACEOFF - 6}
				source={{zh: '图鉴（B2W2 / X / OR 文本，官方中文）', en: 'Pokédex B2W2 / X / OR'}}
			/>

			<Grain opacity={phase === 'zekrom' ? 0.08 : 0.12} frameOffset={SEG_START.split} />
		</AbsoluteFill>
	);
};
