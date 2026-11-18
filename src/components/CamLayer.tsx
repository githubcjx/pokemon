import {AbsoluteFill} from 'remotion';
import {Cam, layerStyle} from '../camera';

/** 景深层：按距离系数 k 跟随摄像机（k=1 主体平面，<1 远景，>1 近景） */
export const CamLayer: React.FC<{cam: Cam; k: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
	cam,
	k,
	children,
	style,
}) => <AbsoluteFill style={{...layerStyle(cam, k), ...style}}>{children}</AbsoluteFill>;

/** 屏幕空间暗角（背景画布做了放大余量，暗角改由这里统一提供） */
export const Vignette: React.FC<{strength?: number}> = ({strength = 0.7}) => (
	<AbsoluteFill
		style={{
			pointerEvents: 'none',
			background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, rgba(0,0,0,${strength}) 100%)`,
		}}
	/>
);
