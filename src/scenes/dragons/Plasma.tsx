import {random} from 'remotion';
import {ACCENT} from './Mono';

/**
 * 第 7 段：等离子驱逐舰与双龙市（代码画的纯黑剪影，不画标志、徽记）。
 */

/** 等离子驱逐舰：能在空中航行的大船，船底透出酋雷姆力量的冰青色光。船头朝左。 */
export const Frigate: React.FC<{x: number; y: number; scale: number; glow?: number}> = ({x, y, scale, glow = 0.8}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
		<g transform={`translate(${x}, ${y}) scale(${scale})`}>
			<ellipse cx={0} cy={70} rx={330} ry={46} fill={`rgba(${ACCENT.iceRgb},${0.35 * glow})`} style={{filter: `blur(18px)`}} />
			<g fill="#030303" style={{filter: `drop-shadow(0 0 2px rgba(${ACCENT.iceRgb},0.6))`}}>
				{/* 船身 */}
				<path d="M-380,-6 L-300,-24 L280,-30 L360,-12 L372,10 L320,52 L-250,56 L-330,30 Z" />
				{/* 甲板上的舰桥 */}
				<path d="M-120,-24 L-110,-70 L60,-74 L90,-28 Z" />
				<path d="M-60,-70 L-52,-110 L20,-112 L30,-72 Z" />
				{/* 三根桅杆与斜帆 */}
				{[-230, -10, 200].map((mx, i) => (
					<g key={i}>
						<rect x={mx - 3} y={-230 + i * 20} width={6} height={210 - i * 20} />
						<path d={`M${mx + 4},${-220 + i * 20} L${mx + 120},${-60} L${mx + 4},${-50} Z`} />
					</g>
				))}
			</g>
			{/* 船底的冰冻装置：一排冷光 */}
			{[-200, -100, 0, 100, 200].map((dx) => (
				<rect key={dx} x={dx - 10} y={44} width={20} height={6} fill={`rgba(${ACCENT.iceRgb},${0.6 + 0.4 * glow})`} />
			))}
		</g>
	</svg>
);

// 双龙市的天际线：高低错落的建筑与几座尖塔（世界坐标，底部在 1000）
const BUILDINGS = Array.from({length: 30}, (_, i) => {
	const w = 46 + random(`ow${i}`) * 60;
	const x = -30 + i * 66 + random(`ox${i}`) * 20;
	const tall = random(`ot${i}`);
	const h = 110 + tall * 240 + (i % 7 === 3 ? 160 : 0);
	return {x, w, h, spire: i % 7 === 3 || tall > 0.88, win: random(`owin${i}`)};
});
const BASE = 1000;

/** 双龙市剪影；ice = 0–1：冰从地面往上爬，封住建筑（冰青色的冰棱与轮廓光） */
export const Opelucid: React.FC<{ice: number; time: number; lights?: number}> = ({ice, time, lights = 1}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
		<g fill="#030303" style={{filter: `drop-shadow(0 -1px 2px rgba(${ACCENT.iceRgb},${0.25 + ice * 0.55}))`}}>
			{BUILDINGS.map((b, i) => (
				<path
					key={i}
					d={`M${b.x},${BASE + 100} L${b.x},${BASE - b.h} ${b.spire ? `L${b.x + b.w / 2},${BASE - b.h - b.w * 1.6} ` : ''}L${b.x + b.w},${BASE - b.h} L${b.x + b.w},${BASE + 100} Z`}
				/>
			))}
		</g>
		{/* 窗灯：冰封后熄灭 */}
		{BUILDINGS.map((b, i) =>
			b.win > 0.45 ? (
				<rect
					key={`w${i}`}
					x={b.x + b.w * 0.4}
					y={BASE - b.h * 0.6}
					width={6}
					height={9}
					fill={`rgba(255,248,232,${(1 - ice) * lights * (0.7 + 0.3 * Math.sin(time * 2 + i))})`}
				/>
			) : null,
		)}
		{/* 冰棱：从地面往上长，越往上越稀 */}
		<g fill={`rgba(${ACCENT.iceRgb},0.22)`} stroke={`rgba(${ACCENT.iceRgb},0.85)`} strokeWidth={1.4}>
			{BUILDINGS.map((b, i) => {
				const grow = Math.max(0, Math.min(1, ice * 1.6 - random(`ig${i}`) * 0.6));
				if (grow <= 0) return null;
				const hh = b.h * (0.35 + 0.75 * random(`ih${i}`)) * grow;
				const cx = b.x + b.w * (0.3 + 0.4 * random(`ic${i}`));
				return (
					<g key={`i${i}`}>
						<path d={`M${cx - 26},${BASE + 4} L${cx - 6},${BASE - hh} L${cx + 4},${BASE - hh * 0.7} L${cx + 30},${BASE + 4} Z`} />
						<path d={`M${cx + 18},${BASE + 4} L${cx + 34},${BASE - hh * 0.55} L${cx + 52},${BASE + 4} Z`} />
					</g>
				);
			})}
		</g>
		<rect x={-40} y={BASE} width={2000} height={200} fill="#020202" />
	</svg>
);
