import {AbsoluteFill} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {Motes} from './fx';
import {ShotCity} from './ShotsCity';

/**
 * 《夺走的光辉》视频封面（静帧）：横屏 4:3（1440×1080）、竖屏 3:4（1080×1440）。
 * 主题是"两个名字"：一边是金光里的究极奈克洛兹玛（光辉大神，直接取片中第 8 段塔顶的画面），
 * 另一边是漆黑里的通常形态（光之掠夺者），中间一道斜着的光谱裂缝。宝可梦用官方立绘（只做构图与打光）。
 */

const ULTRA_F = 5060; // 片中塔顶、究极爆发之后的一帧（内部帧号）

const SPECTRUM = 'linear-gradient(90deg, #ff5a6a, #ffb347, #fff07a, #6dffb0, #6ad8ff, #9a7bff)';
const CHROMA = '-2px 0 0 rgba(255,80,110,0.55), 2px 0 0 rgba(80,220,255,0.55)';

/** 漆黑里的通常形态奈克洛兹玛：冷白轮廓光，身上的晶体微微透光 */
const DarkNecrozma: React.FC<{x: number; y: number; size: number}> = ({x, y, size}) => (
	<PokemonArt3D
		dir="pokemon/necrozma"
		x={x}
		y={y}
		size={size}
		depthScale={0.5}
		yaw={-4}
		resolution={1.6}
		ambient={[0.07, 0.075, 0.1]}
		dirLights={[
			{dir: [0.5, -0.6, 0.6], color: [0.35, 0.38, 0.5], wrap: 0.3},
			{dir: [-0.8, 0.2, 0.4], color: [0.45, 0.36, 0.22], wrap: 0.2},
		]}
		rim={{dir: [-0.8, -0.5], color: [0.9, 0.95, 1.25], power: 2.2}}
		emissive={0.75}
		emissiveTint={[1.1, 1.2, 1.4]}
		emissiveKey={[0.3, 0.75, 0.2, 0.6]}
	/>
);

/** 漆黑的底：冷蓝黑，靠裂缝一侧透一点金光 */
const DarkSide: React.FC<{glowAt: string}> = ({glowAt}) => (
	<AbsoluteFill style={{background: `radial-gradient(ellipse 60% 55% at ${glowAt}, rgba(120,96,60,0.35) 0%, rgba(20,20,28,0) 70%), radial-gradient(ellipse 80% 80% at 60% 45%, #171a24 0%, #08090d 70%)`}} />
);

/** 斜向的光谱裂缝：白芯 + 两侧色散 */
const Fracture: React.FC<{w: number; h: number; pts: string}> = ({w, h, pts}) => (
	<svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
		<defs>
			<linearGradient id="spec" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#ff5a6a" />
				<stop offset="0.22" stopColor="#ffb347" />
				<stop offset="0.42" stopColor="#fff07a" />
				<stop offset="0.6" stopColor="#6dffb0" />
				<stop offset="0.8" stopColor="#6ad8ff" />
				<stop offset="1" stopColor="#9a7bff" />
			</linearGradient>
		</defs>
		<polyline points={pts} fill="none" stroke="url(#spec)" strokeWidth={14} opacity={0.55} style={{filter: 'blur(6px)'}} />
		<polyline points={pts} fill="none" stroke="url(#spec)" strokeWidth={5} />
		<polyline points={pts} fill="none" stroke="#fff" strokeWidth={1.6} style={{filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))'}} />
	</svg>
);

/** 两个名字的小标签 */
const NameLabel: React.FC<{text: string; size: number; tone: 'gold' | 'cold'}> = ({text, size, tone}) => (
	<div style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'center'}}>
		<div
			style={{
				fontFamily: SERIF,
				fontWeight: 700,
				fontSize: size,
				letterSpacing: size * 0.3,
				paddingLeft: size * 0.3,
				color: tone === 'gold' ? '#fff3d6' : '#e8eeff',
				textShadow: tone === 'gold' ? '0 0 10px rgba(36,20,0,0.95), 0 0 26px rgba(36,20,0,0.8), 0 0 4px rgba(255,210,140,0.9)' : `${CHROMA}, 0 0 16px rgba(150,180,255,0.6), 0 2px 6px rgba(0,0,0,0.95)`,
			}}
		>
			{text}
		</div>
		<div style={{width: '100%', height: 2, marginTop: size * 0.25, background: tone === 'gold' ? 'linear-gradient(90deg, transparent, rgba(255,214,140,0.95), transparent)' : SPECTRUM, opacity: 0.9}} />
	</div>
);

const Title: React.FC<{size: number; hookSize: number; enSize: number}> = ({size, hookSize, enSize}) => (
	<div style={{textAlign: 'center'}}>
		<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: hookSize, letterSpacing: hookSize * 0.16, color: 'rgba(236,240,250,0.95)', textShadow: '0 0 12px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.9)'}}>
			同一只宝可梦，为什么会有两个名字？
		</div>
		<div
			style={{
				fontFamily: SERIF,
				fontWeight: 900,
				fontSize: size,
				letterSpacing: size * 0.16,
				paddingLeft: size * 0.16,
				lineHeight: 1.15,
				marginTop: size * 0.08,
				color: '#fffaf0',
				textShadow: `-3px 0 0 rgba(255,70,100,0.6), 3px 0 0 rgba(70,210,255,0.6), 0 0 34px rgba(255,214,140,0.65), 0 0 80px rgba(160,180,255,0.45), 0 6px 12px rgba(0,0,0,0.95)`,
			}}
		>
			夺走的光辉
		</div>
		<div style={{width: size * 3.2, height: 3, margin: `${enSize * 0.25}px auto 0`, background: SPECTRUM, boxShadow: '0 0 12px rgba(255,255,255,0.5)'}} />
		<div style={{fontFamily: CINZEL, fontSize: enSize, letterSpacing: enSize * 0.6, paddingLeft: enSize * 0.6, color: 'rgba(236,240,250,0.9)', marginTop: enSize * 0.45}}>THE STOLEN RADIANCE</div>
	</div>
);

/** 横屏 4:3（1440×1080） */
export const CoverLandscape: React.FC = () => (
	<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
		{/* 左：光辉大神（片中的塔顶画面，往左挪，让究极奈克洛兹玛落在左半边） */}
		<div style={{position: 'absolute', left: -530, top: -30, width: 1920, height: 1080, transform: 'scale(1.06)', transformOrigin: '960px 300px', filter: 'contrast(1.12) saturate(1.1)'}}>
			<ShotCity f={ULTRA_F} />
		</div>
		{/* 右：光之掠夺者（斜向切开） */}
		<div style={{position: 'absolute', inset: 0, clipPath: 'polygon(880px 0, 1440px 0, 1440px 1080px, 660px 1080px)'}}>
			<DarkSide glowAt="8% 40%" />
			<Motes f={300} opacity={0.35} rgb="200,215,255" rainbow={0.5} />
			<DarkNecrozma x={1110} y={420} size={620} />
		</div>
		<Fracture w={1440} h={1080} pts="880,0 838,190 806,330 766,520 734,690 698,880 660,1080" />
		{/* 两个名字 */}
		<div style={{position: 'absolute', left: 70, top: 60}}>
			<NameLabel text="光辉大神" size={42} tone="gold" />
		</div>
		<div style={{position: 'absolute', right: 60, top: 60}}>
			<NameLabel text="光之掠夺者" size={42} tone="cold" />
		</div>
		{/* 下方压暗，放标题 */}
		<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 26%, transparent 52%)'}} />
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 46}}>
			<Title size={136} hookSize={38} enSize={27} />
		</AbsoluteFill>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
	</AbsoluteFill>
);

/** 竖屏 3:4（1080×1440） */
export const CoverPortrait: React.FC = () => (
	<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
		{/* 上：光辉大神 */}
		<div style={{position: 'absolute', left: -420, top: 185, width: 1920, height: 1080, transform: 'scale(1.02)', transformOrigin: '960px 300px', filter: 'contrast(1.12) saturate(1.1)'}}>
			<ShotCity f={ULTRA_F} />
		</div>
		{/* 上方延伸的金色天空（片中画面上沿以外） */}
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 300, background: 'linear-gradient(to bottom, #120d06 0%, rgba(70,52,26,0.9) 60%, rgba(70,52,26,0) 100%)'}} />
		{/* 下：光之掠夺者（斜向切开） */}
		<div style={{position: 'absolute', inset: 0, clipPath: 'polygon(0 960px, 1080px 830px, 1080px 1440px, 0 1440px)'}}>
			<DarkSide glowAt="50% 0%" />
			<Motes f={300} opacity={0.35} rgb="200,215,255" rainbow={0.5} />
			<DarkNecrozma x={540} y={1170} size={560} />
		</div>
		<Fracture w={1080} h={1440} pts="0,960 270,928 540,895 810,863 1080,830" />
		{/* 两个名字 */}
		<div style={{position: 'absolute', left: 50, top: 770}}>
			<NameLabel text="光辉大神" size={40} tone="gold" />
		</div>
		<div style={{position: 'absolute', right: 50, top: 990}}>
			<NameLabel text="光之掠夺者" size={40} tone="cold" />
		</div>
		{/* 上方压暗，放标题 */}
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 440, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)'}} />
		<div style={{position: 'absolute', left: 0, right: 0, top: 56, display: 'flex', justifyContent: 'center'}}>
			<Title size={132} hookSize={36} enSize={25} />
		</div>
		<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)'}} />
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 60%, rgba(0,0,0,0.5) 100%)'}} />
	</AbsoluteFill>
);
