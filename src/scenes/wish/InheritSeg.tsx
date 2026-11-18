import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';
import {ramp} from './common';
import {CraterBasin} from './Crater';
import {Meteor} from './elements';
import {Dissolve, H, LightPool, ScreenSvg, W} from './finishFx';
import {ORBIT_FRAG} from './orbitGl';

// 两张原图留白不同。按可见圆的外缘缩放，再用相同尺寸的圆形窗口展示。
const stoneArt = {
	key: {path: 'wish/key-stone.png', imageSize: 80, inset: 0, circleSize: 80, tilt: -28},
	mega: {path: 'wish/mega-stone.png', imageSize: 160, inset: 29, circleSize: 102, tilt: 23},
};
const STONE_DIAMETER = 164;

const ChartStone: React.FC<{x: number; y: number; kind: keyof typeof stoneArt; frame: number}> = ({x, y, kind, frame}) => {
	const {path, imageSize, inset, circleSize, tilt} = stoneArt[kind];
	const scale = STONE_DIAMETER / circleSize;
	return (
		<>
			<ScreenSvg>
				<g transform={`translate(${x} ${y})`}>
					<circle r={159} fill="none" stroke="#82a8b8" strokeWidth="1.2" opacity=".35" />
					<circle r={131} fill="none" stroke="#acbfc6" strokeWidth="1.3" strokeDasharray="2 12" opacity=".45" />
					<ellipse rx={123} ry={37} transform={`rotate(${tilt})`} fill="none" stroke="#aed6d6" strokeWidth="1.6" opacity=".43" />
					<circle cx={159 * Math.cos(frame / 79)} cy={159 * Math.sin(frame / 79)} r={3.2} fill="#d7ead9" opacity=".78" />
				</g>
			</ScreenSvg>
			<div style={{
				position: 'absolute', left: x - STONE_DIAMETER / 2, top: y - STONE_DIAMETER / 2,
				width: STONE_DIAMETER, height: STONE_DIAMETER, borderRadius: '50%', overflow: 'hidden',
				boxShadow: '0 0 0 1px #b0c9d6a0, 0 0 30px #6ab3d84a', background: '#1b2940',
			}}>
				<Img src={staticFile(path)} style={{
					position: 'absolute', left: -inset * scale, top: -inset * scale,
					width: imageSize * scale, height: imageSize * scale,
				}} />
			</div>
		</>
	);
};

const bits = Array.from({length: 25}, (_, i) => {
	const seed = random('wish-study-' + i);
	return {seed, y: 224 + seed * 525, s: 3.2 + random('wish-size-' + i) * 9};
});

const Convergence: React.FC<{frame: number; power: number; x: number; y: number}> = ({frame, power, x, y}) => (
	<>
		<LightPool x={x} y={y} radius={339} color="151,233,187" opacity={power * .69} />
		<ScreenSvg>
			<defs>
				<linearGradient id="wish-energy-combine">
					<stop stopColor="#bfdfe6" stopOpacity="0" />
					<stop offset=".53" stopColor="#7ea9df" stopOpacity=".62" />
					<stop offset="1" stopColor="#d0edb6" stopOpacity=".91" />
				</linearGradient>
			</defs>
			{Array.from({length: 6}, (_, i) => {
				const y0 = 248 + 108 * i;
				const curve = `M142 ${y0}C518 ${y0 - 30} 756 ${y0 * .58 + y * .42} ${x} ${y}`;
				return <path key={i} d={curve} fill="none" stroke="url(#wish-energy-combine)"
					strokeWidth={i % 2 ? 3 : 1.55} strokeDasharray="104 28 17 11" strokeDashoffset={-frame * (2 + i * .12)}
					opacity={.37 + power * .58} />;
			})}
			{bits.map(({seed, y: fromY, s}, i) => {
				const travel = ((frame - 4548) / 140 + seed * 2.31) % 1;
				const px = 206 + (x - 206) * travel;
				const py = fromY + (y - fromY) * travel ** 1.34;
				return <path key={i} d={`M${px - s} ${py}l${s} ${-s * .77} ${s} ${s * .77} ${-s} ${s * .77}Z`} fill={i % 2 ? '#eac493' : '#9ce2c5'} opacity={(1 - travel * .8) * (.3 + power * .45)} />;
			})}
			<g transform={`translate(${x} ${y})`} fill="none" stroke="#ceecc5" opacity={power}>
				<circle r={48 + 12 * power} strokeOpacity=".59" strokeWidth="1.8" />
				<circle r={73 + 13 * power} strokeOpacity=".33" strokeWidth="1.3" strokeDasharray="2 7" />
				<path d="M0-40 36 23-36 23Z M0-24 22 15-22 15Z" strokeWidth="2" strokeLinejoin="round" />
			</g>
		</ScreenSvg>
	</>
);

/** 用两颗石头和能量的汇流说明机制，随后把镜头移到陨石将至的丰缘。 */
export const InheritSeg: React.FC<{frame: number}> = ({frame}) => {
	const separate = ramp(frame, 4420, 4503);
	const ray = ramp(frame, 4516, 4619);
	const power = ramp(frame, 4600, 4789);
	const city = ramp(frame, 4833, 4928);
	const forecast = ramp(frame, 4957, 5355);
	const y = 443 + Math.sin(frame / 49) * 13;
	return (
		<AbsoluteFill>
			<ShaderCanvas frag={ORBIT_FRAG} width={W} height={H} scale={.72}
				uniforms={{uTime: frame / BASE_FPS, uRise: .38 - city * 1.33 + forecast * .19, uDrift: separate * .2 + city * .73, uGlare: power * .24 * (1 - city), uWarm: city * .41}}
				style={{position: 'absolute', inset: 0}} />
			<Dissolve opacity={1 - city}>
				<Dissolve opacity={1 - ramp(frame, 4519, 4575)}>
					<ChartStone x={960 - separate * 365} y={460 + 11 * Math.sin(frame / 32)} kind="key" frame={frame} />
					<ChartStone x={960 + separate * 365} y={460 - 10 * Math.sin(frame / 32)} kind="mega" frame={frame} />
					<ScreenSvg>
						<path d={`M${962 - separate * 207} 461Q960 369 ${958 + separate * 207} 461`}
							fill="none" stroke="#dbd8c3" strokeWidth="1.6" strokeDasharray="4 7" opacity=".57" />
					</ScreenSvg>
				</Dissolve>
				{ray > 0 && (
					<>
						<LightPool x={1274} y={y} radius={537} color="107,184,174" opacity={ray * .31} />
						<PokemonArt3D dir="pokemon/rayquaza" x={1296 - 89 * power} y={y} size={758}
							yaw={-3.2 + power * 3.7} pitch={2.6} depthScale={.48} resolution={.90} opacity={ray}
							ambient={[.37 + power * .19, .50 + power * .20, .52 + power * .10]}
							dirLights={[{dir: [-.63, .16, .72], color: [.32, .48, .36], wrap: .44}]}
							rim={{dir: [-.62, -.41], color: [.27, .56, .53], power: 3.1}}
							emissive={power * .42} emissiveTint={[1, .83, .39]} />
						<Dissolve opacity={ramp(frame, 4570, 4630)}>
							<Convergence frame={frame} power={power} x={1164 - 56 * power} y={y + 94} />
						</Dissolve>
					</>
				)}
			</Dissolve>
			<Dissolve opacity={city}>
				<CraterBasin frame={frame} x={960 - 41 * forecast} y={641 + 43 * forecast} scale={.84 - .14 * forecast}
					lamps={ramp(frame, 4844, 4998)} impact={0} />
				<LightPool x={945} y={668} radius={450} color="219,184,131" opacity={.22 * city} />
				<Meteor frame={frame} from={4951} to={5444} x0={2120} y0={-323} x1={810} y1={313}
					size={.29 + .91 * forecast} spin={.09} />
			</Dissolve>
		</AbsoluteFill>
	);
};
