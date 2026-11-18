import {AbsoluteFill} from 'remotion';

// ─── 纸色水墨雾：一条边缘不规则的横向雾带，用来遮住塔脚、让 3D 塔"长"在纸上 ─────────
// SVG 湍流噪声扭曲一条纵向渐变，边缘像宣纸上洇开的淡墨；整体随帧横向缓慢漂移。

export const PaperMist: React.FC<{
	id: string;
	/** 雾带中心的 y（像素） */
	y: number;
	/** 雾带厚度（像素） */
	height: number;
	frame: number;
	/** 漂移速度（像素 / 帧） */
	speed?: number;
	/** 视差位移 */
	dx?: number;
	color?: string;
	/** 雾带下缘是否一直铺到画面底 */
	toBottom?: boolean;
	opacity?: number;
	seed?: number;
}> = ({id, y, height, frame, speed = 0.3, dx = 0, color = '#dccaa3', toBottom = false, opacity = 1, seed = 3}) => {
	const shift = frame * speed + dx;
	return (
		<AbsoluteFill style={{pointerEvents: 'none', opacity}}>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				<defs>
					<linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor={color} stopOpacity={0} />
						<stop offset="0.35" stopColor={color} stopOpacity={0.85} />
						<stop offset="0.6" stopColor={color} stopOpacity={0.95} />
						<stop offset="1" stopColor={color} stopOpacity={toBottom ? 1 : 0} />
					</linearGradient>
					<filter id={`${id}-f`} x="-5%" y="-60%" width="110%" height="220%">
						<feTurbulence type="fractalNoise" baseFrequency="0.0035 0.018" numOctaves={4} seed={seed} result="n" />
						<feDisplacementMap in="SourceGraphic" in2="n" scale={110} xChannelSelector="R" yChannelSelector="G" />
						<feGaussianBlur stdDeviation={6} />
					</filter>
				</defs>
				<g transform={`translate(${-shift} 0)`}>
					<rect
						x={-1600}
						y={y - height / 2}
						width={5200}
						height={toBottom ? 1080 - (y - height / 2) + 200 : height}
						fill={`url(#${id}-g)`}
						filter={`url(#${id}-f)`}
					/>
				</g>
			</svg>
		</AbsoluteFill>
	);
};
