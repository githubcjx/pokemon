import {PaperMist} from '../../components/screen/PaperMist';
import {mixHex, projectToScreen, V3} from '../../three/stage';
import {MIST} from './continuity';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 塔脚的两条纸色雾带（第 2–4 段共用同一套参数，段落交界处连续）。
 * globalFrame 为整期时间轴上的帧号；storm 0 = 第 2 段的样子，1 = 第 3 段风雨里的样子。
 */
export const TowerMist: React.FC<{pos: V3; target: V3; fov: number; globalFrame: number; storm: number; idPrefix: string}> = ({
	pos,
	target,
	fov,
	globalFrame,
	storm,
	idPrefix,
}) => {
	const ground = projectToScreen(pos, target, fov, [0, 3, 0]);
	const c = MIST.calm;
	const s = MIST.storm;
	const color = mixHex(c.color, s.color, storm);
	return (
		<>
			<PaperMist
				id={`${idPrefix}Back`}
				y={ground.y - 60}
				height={lerp(c.backH, s.backH, storm)}
				frame={globalFrame}
				speed={MIST.backSpeed}
				dx={-target[0] * 3}
				seed={4}
				opacity={lerp(c.backO, s.backO, storm)}
				color={color}
			/>
			<PaperMist
				id={`${idPrefix}Front`}
				y={ground.y + lerp(c.frontOff, s.frontOff, storm)}
				height={lerp(c.frontH, s.frontH, storm)}
				frame={globalFrame}
				speed={MIST.frontSpeed}
				dx={-target[0] * 5}
				seed={9}
				toBottom
				opacity={lerp(c.frontO, s.frontO, storm)}
				color={color}
			/>
		</>
	);
};
