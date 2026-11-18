import {AbsoluteFill} from 'remotion';
import {CINZEL, SERIF} from '../../fonts';
import {Faceoff} from './Faceoff';
import {ACCENT, DragonArt, DragonVoid, ElementBg} from './Mono';

/**
 * 《真实与理想》视频封面（静帧）：横屏 1920×1080、竖屏 1080×1920。
 * 沿用片中的黑白剪影·三色：左 / 上是黑底白焰的莱希拉姆，右 / 下是白底雷云的捷克罗姆，分界上是一条龙的空洞。
 * 宝可梦用官方原色立绘（只做构图与打光）。
 */

const T = 12.4; // 着色器取的时间（选一个火焰、雷云形状好看的瞬间）

const titleShadow = `0 0 30px rgba(${ACCENT.warmRgb},0.6), 0 0 70px rgba(${ACCENT.blueRgb},0.5), 0 6px 10px rgba(0,0,0,0.95)`;

const Title: React.FC<{size: number; hookSize: number; enSize: number}> = ({size, hookSize, enSize}) => (
	<div style={{textAlign: 'center'}}>
		<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: hookSize, letterSpacing: hookSize * 0.18, color: 'rgba(240,242,244,0.95)', textShadow: '0 0 12px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.9)'}}>
			一条龙，是怎么变成三只的？
		</div>
		<div style={{fontFamily: SERIF, fontWeight: 900, fontSize: size, letterSpacing: size * 0.18, lineHeight: 1.15, color: '#fff', textShadow: titleShadow, marginTop: size * 0.08}}>
			真实与理想
		</div>
		<div style={{fontFamily: CINZEL, fontSize: enSize, letterSpacing: enSize * 0.7, color: 'rgba(240,240,238,0.88)', marginTop: enSize * 0.3}}>TRUTH AND IDEALS</div>
	</div>
);

/** 把 1920×1080 的画面裁进一个窗口（竖屏用） */
const Crop: React.FC<{x: number; y: number; w: number; h: number; ox: number; oy: number; scale?: number; children: React.ReactNode}> = ({x, y, w, h, ox, oy, scale = 1, children}) => (
	<div style={{position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden'}}>
		<div style={{position: 'absolute', left: -ox, top: -oy, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: '0 0'}}>{children}</div>
	</div>
);

export const CoverLandscape: React.FC = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Faceoff time={T} />
		{/* 下方压暗，放标题 */}
		<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 22%, transparent 48%)'}} />
		<DragonVoid time={T} p={[960, 210]} r={120} />
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 46}}>
			<Title size={150} hookSize={44} enSize={30} />
		</AbsoluteFill>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)'}} />
	</AbsoluteFill>
);

export const CoverPortrait: React.FC = () => (
	<AbsoluteFill style={{background: '#000'}}>
		{/* 上：黑底白焰的莱希拉姆 */}
		<Crop x={0} y={0} w={1080} h={1200} ox={0} oy={0} scale={1.12}>
			<ElementBg time={T} c={[520, 560]} glow={[1, 0.95, 0.88]} glowAmt={1.1} glowR={0.34} rays={0.55} flame={1} />
		</Crop>
		<DragonArt name="reshiram" x={470} y={820} size={820} reveal={1} rim={{dir: [0.5, -1], color: [0.9, 0.8, 0.65], power: 2}} rimAfter={1} />
		{/* 下：白底雷云的捷克罗姆（斜向接缝） */}
		<div style={{position: 'absolute', inset: 0, clipPath: 'polygon(0 65.1%, 100% 59.4%, 100% 100%, 0 100%)'}}>
			<Crop x={0} y={1080} w={1080} h={840} ox={420} oy={160}>
				<ElementBg time={T} c={[960, 300]} bg={[0.97, 0.975, 0.98]} storm={1} ink={[0.05, 0.06, 0.07]} glow={ACCENT.blue} glowAmt={0.25} />
			</Crop>
			<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 520, background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.75) 40%, transparent 100%)'}} />
			<DragonArt name="zekrom" x={500} y={1560} size={820} reveal={1} rim={{dir: [-0.4, -1], color: [0.4, 0.9, 1.6], power: 2}} rimAfter={1} />
		</div>
		{/* 接缝上的电光 */}
		<svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
			<polyline
				points="0,1250 300,1215 520,1240 760,1180 1080,1140"
				fill="none"
				stroke="#fff"
				strokeWidth={4}
				style={{filter: `drop-shadow(0 0 8px rgba(${ACCENT.blueRgb},1)) drop-shadow(0 0 20px rgba(${ACCENT.warmRgb},0.8))`}}
			/>
		</svg>
		{/* 分界上的空洞：那条龙 */}
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: -100, top: 630, width: 1920, height: 1080}}>
				<DragonVoid time={T} p={[960, 540]} r={100} />
			</div>
		</div>
		{/* 上方压暗，放标题 */}
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 470, background: 'linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 50%, transparent 100%)'}} />
		<div style={{position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center'}}>
			<Title size={156} hookSize={46} enSize={30} />
		</div>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 60%, rgba(0,0,0,0.55) 100%)'}} />
	</AbsoluteFill>
);
