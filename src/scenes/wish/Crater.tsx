import {random} from 'remotion';
import {LightPool, ScreenSvg} from './finishFx';

const rim = (rx: number, ry: number, offset: number) => {
	const points = Array.from({length: 100}, (_, i) => {
		const a = i * Math.PI * 2 / 100;
		const eroded = 1 + 0.061 * Math.sin(a * 7 + 1.2) + 0.024 * Math.cos(a * 19 - 0.7) + 0.014 * Math.sin(a * 31);
		return [Math.cos(a) * rx * eroded, Math.sin(a) * ry * eroded + offset]
			.map((v) => v.toFixed(2)).join(' ');
	});
	return 'M' + points.join('L') + 'Z';
};

const ledges = Array.from({length: 8}, (_, i) => rim(615 - i * 33, 271 - i * 14, i * 6));
const shore = rim(389, 142, 56);

const homes = Array.from({length: 39}, (_, i) => {
	const a = .14 + i / 39 * Math.PI * 1.82;
	const r = .94 + random('wish-home-radius-' + i) * .19;
	return {x: Math.cos(a) * 420 * r, y: 52 + Math.sin(a) * 157 * r, height: 8 + random('wish-home-height-' + i) * 10, seed: random('wish-home-glow-' + i)};
});

/** 用环形崖壁、内湖和临水灯火表示琉璃市的地形。 */
export const CraterBasin: React.FC<{
	frame: number;
	x?: number;
	y?: number;
	scale?: number;
	lamps: number;
	impact: number;
}> = ({frame, x = 960, y = 570, scale = 1, lamps, impact}) => (
	<ScreenSvg>
		<defs>
			<linearGradient id="wish-crater-rock" x1="0" y1="0" x2="0" y2="1">
				<stop stopColor="#685044" />
				<stop offset=".55" stopColor="#342b2b" />
				<stop offset="1" stopColor="#1a171e" />
			</linearGradient>
			<radialGradient id="wish-crater-water">
				<stop stopColor="#2c4957" />
				<stop offset=".72" stopColor="#1d3441" />
				<stop offset="1" stopColor="#152733" />
			</radialGradient>
		</defs>
		<g transform={`translate(${x} ${y}) scale(${scale})`}>
			<ellipse cx="0" cy="63" rx="744" ry="273" fill="#110e16" opacity=".58" />
			{ledges.map((path, i) => (
				<path key={i} d={path} fill={i === 0 ? 'url(#wish-crater-rock)' : 'none'} stroke={i % 2 ? '#9b7158' : '#211c23'} strokeWidth={i % 2 ? 2.4 : 5.5} opacity={i === 0 ? 1 : .57} />
			))}
			<path d={shore} fill="url(#wish-crater-water)" stroke="#a17b66" strokeWidth="3.5" />
			<path d="M-71 88-48 26-12 16 34 28 75 66 56 110 9 126-47 116Z" fill="#514a43" stroke="#8d7761" strokeWidth="2.5" />
			{Array.from({length: 5}, (_, i) => {
				const pulse = (frame / 115 + i / 5) % 1;
				return <ellipse key={i} cx={-1} cy={55} rx={38 + 309 * pulse} ry={15 + 105 * pulse} fill="none" stroke="#c6d5c9" strokeWidth={1.3 + impact * 3} opacity={(1 - pulse) * (.12 + impact * .60)} />;
			})}
			{lamps > 0 && homes.map(({x: hx, y: hy, height, seed}, i) => {
				const on = Math.max(0, Math.min(1, (lamps - seed * .76) * 4.2));
				return (
					<g key={i} transform={`translate(${hx} ${hy})`} opacity={on}>
						<path d={`M-8 4v-${height}l8-5 8 5V4Z`} fill="#4c3d37" stroke="#b39d79" strokeWidth="1.3" />
						<rect x="-2.2" y={-height * .53} width="4.4" height="4.4" rx="1" fill="#ffe4a5" opacity={.62 + Math.sin(frame / 19 + i) * .16} />
					</g>
				);
			})}
		</g>
	</ScreenSvg>
);

const facets = [
	{d: 'M0-106 41-75 70-13 49 78 0 97-45 75-67-19-36-80Z', color: '#6f4e49'},
	{d: 'M0-106 41-75 13-34-36-80Z', color: '#e19a71'},
	{d: 'M41-75 70-13 38 39 13-34Z', color: '#b37e79'},
	{d: 'M13-34 38 39 0 97-28 28Z', color: '#bc7a71'},
	{d: 'M-36-80 13-34-28 28-67-19Z', color: '#8c645f'},
	{d: 'M70-13 49 78 0 97 38 39Z', color: '#4d5062'},
	{d: 'M-67-19-28 28 0 97-45 75Z', color: '#4e3d3f'},
];

export const MeteorJewel: React.FC<{
	x: number;
	y: number;
	scale: number;
	glow: number;
}> = ({x, y, scale, glow}) => (
	<>
		<LightPool x={x} y={y} radius={244 * scale} color="248,168,111" opacity={glow * .75} />
		<ScreenSvg>
			<defs>
				<linearGradient id="wish-jewel-spectrum" x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="#ffecc6" />
					<stop offset=".25" stopColor="#f7bb8c" />
					<stop offset=".5" stopColor="#f3b5da" />
					<stop offset=".71" stopColor="#9fe6ca" />
					<stop offset="1" stopColor="#a4c6f9" />
				</linearGradient>
			</defs>
			<g transform={`translate(${x} ${y}) scale(${scale})`}>
				{facets.map(({d, color}, i) => <path key={d} d={d} fill={color} stroke="#523b39" strokeWidth={i ? 1.6 : 4} />)}
				<path d={facets[0].d} fill="url(#wish-jewel-spectrum)" stroke="#ffe5b3" strokeWidth="3.4" opacity={glow * .8} />
				<path d="M0-106 13-34 70-13 M13-34-28 28 0 97 M13-34 38 39 49 78" fill="none" stroke="#fff3d1" strokeWidth="2.4" opacity={glow * .85} />
			</g>
		</ScreenSvg>
	</>
);
