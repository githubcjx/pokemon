import {AbsoluteFill} from 'remotion';

export const W = 1920;
export const H = 1080;

export const Dissolve: React.FC<React.PropsWithChildren<{opacity: number}>> = ({opacity, children}) =>
	opacity > 0 ? <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill> : null;

export const ScreenSvg: React.FC<React.PropsWithChildren<{
	style?: React.CSSProperties;
}>> = ({children, style}) => (
	<svg width={W} height={H} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', ...style}}>
		{children}
	</svg>
);

export const LightPool: React.FC<{
	x: number;
	y: number;
	radius: number;
	opacity: number;
	color: string;
}> = ({x, y, radius, opacity, color}) => (
	<div style={{
		position: 'absolute', left: x - radius, top: y - radius, width: radius * 2, height: radius * 2,
		background: `radial-gradient(circle, rgba(${color},.82), rgba(${color},.28) 24%, rgba(${color},.07) 48%, transparent 70%)`,
		opacity, mixBlendMode: 'screen', pointerEvents: 'none',
	}} />
);
