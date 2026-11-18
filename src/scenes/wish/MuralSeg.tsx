import {AbsoluteFill, random} from 'remotion';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';
import {TrainerSilhouette} from '../regi/DoorsSeg';
import {K, ramp, SEG_START} from './common';
import {CraterBasin, MeteorJewel} from './Crater';
import {Meteor} from './elements';
import {Dissolve, H, LightPool, ScreenSvg, W} from './finishFx';
import {PILLAR_WALL_FRAG} from './muralGl';

const ANCIENT_IMPACT = 2603;
const CALDERA_IMPACT = 3307;

const dust = Array.from({length: 34}, (_, i) => ({
	x: 110 + random('wish-pillar-x-' + i) * 1700,
	y: 130 + random('wish-pillar-y-' + i) * 690,
	r: 1 + random('wish-pillar-r-' + i) * 2.1,
}));

const MonumentFrame: React.FC<{frame: number; glow: number}> = ({frame, glow}) => (
	<ScreenSvg>
		<defs>
			<linearGradient id="wish-relief-line" x2="1" y2=".34">
				<stop stopColor="#76513d" stopOpacity=".28" />
				<stop offset=".53" stopColor="#bf8d60" stopOpacity=".72" />
				<stop offset="1" stopColor="#725038" stopOpacity=".38" />
			</linearGradient>
		</defs>
		<path d="M100 807V302Q190 202 322 187H1598Q1731 202 1820 302V807Z" fill="#43281c" fillOpacity=".12" stroke="#231711" strokeWidth="17" strokeOpacity=".49" />
		<path d="M111 802V306Q193 211 326 197H1594Q1726 211 1809 306V802Z M140 772V321Q214 239 331 230H1589Q1706 239 1780 321V772Z" fill="none" stroke="url(#wish-relief-line)" strokeWidth="2.6" />
		<path d="M112 816H1808 M124 826H1796 M331 219H1589" fill="none" stroke="url(#wish-relief-line)" strokeWidth="2.2" />
		{Array.from({length: 29}, (_, i) => {
			const x = 170 + i * 56.4;
			const y = 825;
			return <path key={i} d={`M${x - 7} ${y}l7 -5 7 5 -7 5Z`} fill="#c49360" opacity={.22 + .14 * Math.sin(i + glow * 4)} />;
		})}
		{dust.map(({x, y, r}, i) => (
			<circle key={i} cx={x + 12 * Math.sin(frame / 146 + i)} cy={y + 17 * Math.cos(frame / 195 + i)}
				r={r} fill="#f5c99b" opacity={(.16 + .12 * Math.sin(frame / 27 + i)) * (.42 + glow * .35)} />
		))}
	</ScreenSvg>
);

const reliefLand = 'M130 725 235 621 337 632 445 517 566 603 660 474 799 628 910 579 998 682 1114 661 1231 550 1350 655 1422 584 1514 622 1662 528 1785 652V783H130Z';
const AncientTerrain: React.FC<{frame: number; unrest: number}> = ({frame, unrest}) => (
	<ScreenSvg>
		<defs>
			<linearGradient id="wish-land-pigment" x2="1" y2="1">
				<stop stopColor="#a2603a" stopOpacity=".75" />
				<stop offset=".5" stopColor="#65422d" stopOpacity=".63" />
				<stop offset="1" stopColor="#553a2e" stopOpacity=".22" />
			</linearGradient>
		</defs>
		<path d={reliefLand} fill="url(#wish-land-pigment)" stroke="#bd905e" strokeWidth="3.8" strokeOpacity=".75" />
		<path d="M235 621l34 64 68-53 76 51 32-166 31 131 90-45 46 111 48-240 63 179 76-25 48 67 63-116 33 125 55-22 116-21 117-111 76 166 43-61 72-71 48 114 44-76 53 78 95-172 51 198" fill="none" stroke="#d9a069" strokeOpacity=".27" strokeWidth="3" />
		{Array.from({length: 6}, (_, i) => {
			const y = 676 + i * 19;
			const phase = (frame * .35 + i * 20) % 100;
			return <path key={i} d={`M170 ${y}Q431 ${y - 37} 759 ${y + 3}T1304 ${y + 7}Q1559 ${y - 31} 1760 ${y}`} fill="none" stroke={i < 3 ? '#dcb58b' : '#705148'} opacity={.18 + .14 * unrest} strokeWidth="2.1" strokeDasharray="76 5 12 6" strokeDashoffset={-phase} />;
		})}
		<path d="M667 763l89-43 74-19 33-65 49-25 26-77 40-20 33-109M939 536l-46-20-36-56-72-30m79 207 52 36 10 49 48 32m-143-53-64-48-88-12" fill="none" stroke="#ffba70" strokeWidth="3.2" opacity={unrest * .76} />
	</ScreenSvg>
);

const fallsSide = 'M143 675 235 431 348 393 450 515 548 419 648 493 748 379 872 390 930 510 988 536 1060 500 1082 412 1199 376 1305 418 1415 359 1572 437 1672 409 1770 625V771H143Z';

const WaterfallRelief: React.FC<{frame: number}> = ({frame}) => {
	const down = ramp(frame, ANCIENT_IMPACT, ANCIENT_IMPACT + 14) * (1 - ramp(frame, ANCIENT_IMPACT + 18, ANCIENT_IMPACT + 65));
	const light = ramp(frame, 2652, 2737) * (1 - ramp(frame, 2938, 3130));
	return (
		<>
			<ScreenSvg>
				<defs>
					<linearGradient id="wish-falls-mist" x2="0" y2="1">
						<stop stopColor="#fae3b4" stopOpacity=".66" />
						<stop offset=".46" stopColor="#bf9f79" stopOpacity=".48" />
						<stop offset="1" stopColor="#a77f68" stopOpacity=".12" />
					</linearGradient>
				</defs>
				<path d={fallsSide} fill="#32251d" stroke="#bb936b" strokeWidth="3.5" strokeOpacity=".67" />
				<path d="M143 668 293 482 443 584 555 494 688 542 750 450 861 435 909 559 981 593 1094 547 1131 458 1199 427 1312 465 1420 404 1532 502 1685 463 1770 636V766H143Z" fill="#654932" opacity=".71" />
				<path d="M934 512Q1009 546 1063 494C1044 580 1048 618 1112 696Q1054 735 952 702C981 604 968 585 934 512Z" fill="url(#wish-falls-mist)" />
				{Array.from({length: 10}, (_, i) => {
					const x = 943 + i * 12.7;
					return <path key={i} d={`M${x} ${519 - i * 2.1}Q${x + 43 - i * 4} 592 ${x + 6 + i * 4} ${704 + i % 3 * 11}`} fill="none" stroke="#ffebbe" strokeWidth={1.1 + i % 3 * .8} opacity={.3 + (i % 5) * .07} strokeDasharray="44 18 12 9" strokeDashoffset={-frame * (0.75 + i * .021)} />;
				})}
				{[0, 1, 2].map((i) => <ellipse key={i} cx={1020} cy={714} rx={111 + i * 53 + down * 38} ry={17 + i * 12} fill="none" stroke="#e9c3a3" strokeWidth="3" opacity={.14 + down * (.56 - i * .1)} />)}
			</ScreenSvg>
			<Meteor frame={frame} from={2471} to={ANCIENT_IMPACT - 1} x0={1980} y0={44} x1={1028} y1={698} size={.34} spin={.28} />
			<Meteor frame={frame} from={2516} to={2626} x0={2020} y0={170} x1={1216} y1={691} size={.18} spin={.34} />
			<Meteor frame={frame} from={2560} to={2648} x0={1740} y0={117} x1={889} y1={711} size={.14} spin={.32} />
			<LightPool x={1020} y={701} radius={430} color="255,194,128" opacity={down * .85} />
			{light > 0 && (
				<>
					<MeteorJewel x={1027} y={686} scale={.39} glow={light} />
					<LightPool x={1027} y={680} radius={364} color="159,229,185" opacity={light * (.54 + Math.sin(frame / 35) * .09)} />
				</>
			)}
		</>
	);
};

export const PrayerRelief: React.FC<{opacity: number; y?: number}> = ({opacity, y = 792}) => (
	<ScreenSvg style={{opacity}}>
		{[472, 626, 738, 1178, 1312, 1482].map((x, i) => (
			<g key={x} transform={`translate(${x} ${y - (i % 3) * 17}) scale(${i < 3 ? 1 : -1} 1)`} fill="#32241e" stroke="#e5ab71" strokeOpacity=".47" strokeWidth="2.1">
				<path d="M-44 0-21-18-8-68 13-70 28-43 59-53 64-44 34-28 16-34 9-12 37-3 37 2Z" />
				<path d="M-4-75Q-12-82-8-96Q2-110 14-103L27-92 21-81 12-75Z" />
			</g>
		))}
	</ScreenSvg>
);

const PrimalRelief: React.FC<{
	frame: number;
	groudon: number;
	kyogre: number;
	subside?: number;
}> = ({frame, groudon, kyogre, subside = 0}) => (
	<>
		{groudon > 0 && (
			<PokemonArt3D
				dir="pokemon/groudon" variant="-primal" x={494 + groudon * 30 - subside * 104} y={524 + subside * 105}
				size={650} yaw={-1.5 + subside * 2} pitch={2.1} depthScale={.48} resolution={.82}
				ambient={[.82, .68, .46]} dirLights={[{dir: [-.3, .79, .52], color: [.21, .12, .054]}]}
				hatch={{amount: .9, body: .72, reveal: .16 + groudon * .31, freq: 67, color: [.92, .57, .32], time: frame / BASE_FPS}}
				opacity={groudon}
			/>
		)}
		{kyogre > 0 && (
			<PokemonArt3D
				dir="pokemon/kyogre" variant="-primal" x={1442 - kyogre * 29 + subside * 105} y={519 + subside * 108}
				size={691} yaw={2.3 - subside * 3} pitch={-1.8} depthScale={.49} resolution={.82}
				ambient={[.55, .72, .83]} dirLights={[{dir: [.53, -.70, .5], color: [.15, .23, .27]}]}
				hatch={{amount: .84, body: .72, reveal: .16 + kyogre * .30, freq: 64, color: [.64, .69, .74], time: frame / BASE_FPS}}
				opacity={kyogre}
			/>
		)}
	</>
);

const SootopolisRelief: React.FC<{frame: number}> = ({frame}) => {
	const impact = ramp(frame, CALDERA_IMPACT, CALDERA_IMPACT + 8) * (1 - ramp(frame, CALDERA_IMPACT + 13, 3381));
	const carve = ramp(frame, CALDERA_IMPACT, CALDERA_IMPACT + 26);
	const stone = ramp(frame, 3444, 3528);
	const wake = ramp(frame, 3317, 3359) * (1 - ramp(frame, 3400, 3441));
	return (
		<>
			<Dissolve opacity={1 - carve}>
				<ScreenSvg>
					<path d="M141 476Q425 438 687 477T1181 475 1781 481V774H141Z" fill="#2b353b" opacity=".68" />
					{Array.from({length: 7}, (_, i) => {
						const y = 499 + i * 37;
						return <path key={i} d={`M164 ${y}Q519 ${y - 38} 890 ${y}T1750 ${y + 4}`} fill="none"
							stroke="#b6ad8b" strokeWidth="2.2" strokeDasharray="67 12" strokeDashoffset={-frame * .6} opacity={.24 + i * .028} />;
					})}
				</ScreenSvg>
			</Dissolve>
			<Dissolve opacity={carve}>
				<CraterBasin frame={frame} y={564} scale={1.12} lamps={ramp(frame, 3360, 3495)} impact={impact} />
			</Dissolve>
			<Meteor frame={frame} from={3179} to={CALDERA_IMPACT - 1} x0={-230} y0={45} x1={961} y1={623} size={.88} spin={.22} />
			<LightPool x={960} y={625} radius={650} color="255,169,102" opacity={impact * .98} />
			<ScreenSvg style={{opacity: wake}}>
				<path d="M313 725 459 682 590 704 690 628 780 661 838 615 960 625 1019 532 1097 519 1147 474 1260 452 1330 356 M960 625 1048 666 1134 654 1210 714 1405 734 1537 797" fill="none" stroke="#ffc287" strokeWidth="3" opacity=".67" />
			</ScreenSvg>
			<PrimalRelief frame={frame} groudon={wake * .62} kyogre={wake * .62} subside={.23} />
			<PrayerRelief opacity={ramp(frame, 3411, 3444) * .93} />
			{stone > 0 && (
				<>
					<MeteorJewel x={960} y={592 - stone * 43} scale={.82 + stone * .43} glow={stone} />
					<LightPool x={960} y={550} radius={530} color="178,216,193" opacity={stone * .61} />
				</>
			)}
		</>
	);
};

/** 天空之柱上的壁画，先讲流星瀑布，再沿着海岸转入琉璃市。 */
export const MuralSeg: React.FC<{frame: number}> = ({frame}) => {
	const open = ramp(frame, SEG_START.mural1, 2133);
	const force = ramp(frame, 2190, 2295);
	const waterfall = ramp(frame, 2458, 2526);
	const revealRay = ramp(frame, 2818, 2940);
	const calm = ramp(frame, 2980, 3120);
	const crater = ramp(frame, 3174, 3265);
	const zinnia = ramp(frame, 1924, 2044) * (1 - ramp(frame, 2169, 2284));
	const ground = ramp(frame, 2286, K.primalGroudonAt) * (1 - waterfall);
	const sea = ramp(frame, 2318, K.primalKyogreAt) * (1 - waterfall);
	const secondLight = ramp(frame, 3472, 3597);
	return (
		<AbsoluteFill>
			<ShaderCanvas frag={PILLAR_WALL_FRAG} width={W} height={H} scale={.72}
				uniforms={{uTime: frame / BASE_FPS, uLamp: [.70 - open * .20 + .038 * Math.sin(frame / 181), .47], uRelief: open, uGlow: .22 + force * .24 + secondLight * .28}}
				style={{position: 'absolute', inset: 0}} />
			<MonumentFrame frame={frame} glow={open + secondLight * .4} />
			<Dissolve opacity={(.25 + open * .75) * (1 - waterfall) * (1 - crater)}>
				<AncientTerrain frame={frame} unrest={force} />
				<LightPool x={944} y={684} radius={605} color="228,143,81" opacity={force * .32} />
				<PrimalRelief frame={frame} groudon={ground} kyogre={sea} />
				<NameTag compact from={K.primalGroudonAt - 25} x={169} y={139} no="No.0383 ·" zh="原始固拉多" en="PRIMAL GROUDON"
					category="大陆宝可梦" categoryEn="CONTINENT POKÉMON" tone="mono" glowRgb="224,142,79" opacity={1 - ramp(frame, 2428, 2476)} />
				<NameTag compact from={K.primalKyogreAt - 25} x={1751} y={139} no="No.0382 ·" zh="原始盖欧卡" en="PRIMAL KYOGRE"
					category="海底宝可梦" categoryEn="SEA BASIN POKÉMON" align="right" tone="mono" glowRgb="103,155,205" opacity={1 - ramp(frame, 2428, 2476)} />
			</Dissolve>
			<Dissolve opacity={waterfall * (1 - crater)}>
				<WaterfallRelief frame={frame} />
				{revealRay > 0 && (
					<>
						<LightPool x={969} y={357} radius={640} color="142,223,169" opacity={revealRay * .59} />
						<PrimalRelief frame={frame} groudon={revealRay * (1 - calm) * .73} kyogre={revealRay * (1 - calm) * .73} subside={.60 + calm * .4} />
						<PokemonArt3D dir="pokemon/rayquaza" x={978 + calm * 37} y={250 + revealRay * 221 - calm * 27} size={635}
							yaw={-4 + calm * 4} pitch={4.2} depthScale={.5} resolution={.83} opacity={revealRay}
							ambient={[.71, .89, .68]} dirLights={[{dir: [.25, -.79, .62], color: [.22, .45, .24]}]}
							hatch={{amount: .82, body: .59, reveal: .34 + revealRay * .25, color: [.58, .83, .54], freq: 62, time: frame / BASE_FPS}} />
					</>
				)}
			</Dissolve>
			<Dissolve opacity={crater}>
				<SootopolisRelief frame={frame} />
			</Dissolve>
			{zinnia > 0 && (
				<>
					<LightPool x={1531} y={492} radius={458} color="237,166,91" opacity={zinnia * .49} />
					<TrainerSilhouette file="trainers/zinnia/oras.png" x={1534 + open * 32} top={451} h={369} aspect={994 / 1600}
						o={zinnia} from="left" rgb="238,174,108" lift={.16} />
				</>
			)}
			<AbsoluteFill style={{background: 'linear-gradient(180deg, #140c155c, transparent 29%, transparent 73%, #110b11c2)', pointerEvents: 'none'}} />
		</AbsoluteFill>
	);
};
