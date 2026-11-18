import {Easing, interpolate, random} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

const SHARDS = Array.from({length: 46}, (_, i) => {
	// 偏向上方与两侧飞散
	const a = -Math.PI / 2 + (random(`ia${i}`) - 0.5) * Math.PI * 1.5;
	const sp = 14 + random(`is${i}`) * 34;
	const size = 8 + random(`iz${i}`) ** 2 * 46;
	const pts = Array.from({length: 5}, (_, k) => {
		const ang = (k / 5) * Math.PI * 2 + random(`ip${i}-${k}`) * 0.9;
		const r = size * (0.55 + random(`ir${i}-${k}`) * 0.5);
		return `${(Math.cos(ang) * r).toFixed(1)},${(Math.sin(ang) * r).toFixed(1)}`;
	}).join(' ');
	return {vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: (random(`iw${i}`) - 0.5) * 30, pts, water: random(`it${i}`) > 0.5};
});

const DROPS = Array.from({length: 90}, (_, i) => {
	const a = -Math.PI / 2 + (random(`da${i}`) - 0.5) * Math.PI * 1.3;
	const sp = 18 + random(`ds${i}`) * 40;
	return {vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.5 + random(`dr${i}`) * 3.5};
});

const GRAVITY = 1.3;

/**
 * 撞击：at 帧在 (x, y) 处炸开。
 * 冲击波环按透视压扁（squash = 纵横比），碎岩带熔岩色边缘，水花为白色细点。
 * 坐标为所在景深层的局部坐标。
 */
export const Impact: React.FC<{at: number; x: number; y: number; squash?: number; scale?: number}> = ({
	at,
	x,
	y,
	squash = 0.32,
	scale = 1,
}) => {
	const frame = useFrame();
	const t = frame - at;
	if (t < 0 || t > 70) return null;

	const ring = (delay: number, speed: number, width: number) => {
		const tt = Math.max(0, t - delay);
		const rx = interpolate(tt, [0, 40], [30, speed], {...clamp, easing: Easing.out(Easing.cubic)}) * scale;
		const o = interpolate(tt, [0, 4, 40], [0, 0.95, 0], clamp);
		return <ellipse cx={x} cy={y} rx={rx} ry={rx * squash} fill="none" stroke={`rgba(255,240,220,${o})`} strokeWidth={width * (1 - tt / 50)} />;
	};

	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			<g style={{filter: 'blur(3px)'}}>
				{ring(0, 1300, 26)}
				{ring(5, 900, 14)}
			</g>
			{SHARDS.map((s, i) => {
				const px = x + s.vx * t * scale;
				const py = y + (s.vy * t + 0.5 * GRAVITY * t * t) * scale;
				const o = interpolate(t, [0, 2, 50, 70], [0, 1, 1, 0], clamp);
				return (
					<polygon
						key={i}
						points={s.pts}
						transform={`translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${(s.spin * t).toFixed(1)}) scale(${scale})`}
						fill={s.water ? 'rgba(200,225,245,0.55)' : '#1a0f0a'}
						stroke={s.water ? 'rgba(235,245,255,0.8)' : 'rgba(255,120,40,0.9)'}
						strokeWidth={2}
						opacity={o}
					/>
				);
			})}
			{DROPS.map((d, i) => {
				const px = x + d.vx * t * scale;
				const py = y + (d.vy * t + 0.5 * GRAVITY * t * t) * scale;
				const o = interpolate(t, [0, 2, 35, 55], [0, 0.9, 0.7, 0], clamp);
				return <circle key={i} cx={px} cy={py} r={d.r * scale} fill={`rgba(235,245,255,${o})`} />;
			})}
		</svg>
	);
};
