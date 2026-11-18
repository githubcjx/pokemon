import {AbsoluteFill, Sequence} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {toFrames, useFrame} from '../../time';
import {AltarSeg} from './AltarSeg';
import {K, ramp, SEG_START, SUB, SUBS, TOTAL_FRAMES} from './common';
import {EndingSeg} from './EndingSeg';
import {Dissolve} from './finishFx';
import {HookSeg} from './HookSeg';
import {InheritSeg} from './InheritSeg';
import {MuralSeg} from './MuralSeg';
import {SpaceSeg} from './SpaceSeg';
import {SuperSeg} from './SuperSeg';
import {OpeningVeil, UpperSeg} from './UpperSeg';

const cuts = new Set<number>(Object.values(SEG_START).slice(1));
const impulses = [
	{at: K.megaAt, strength: 18, length: 11},
	{at: K.riteMegaAt, strength: 19, length: 11},
	{at: K.impactAt, strength: 30, length: 16},
];

const cameraTransform = (frame: number) => {
	const impulse = impulses.find(({at, length}) => frame >= at && frame < at + length);
	if (!impulse) return undefined;
	const age = frame - impulse.at;
	const shake = impulse.strength * (1 - age / impulse.length) ** 2.15;
	const x = shake * Math.cos(age * 1.08);
	const y = shake * .63 * Math.sin(age * 1.36 + .85);
	return `translate(${x}px, ${y}px) scale(${1 + shake * .0023})`;
};

const Picture: React.FC = () => {
	const frame = useFrame();
	const openingOut = ramp(frame, SEG_START.unseen, 532);
	const muralIn = ramp(frame, SEG_START.mural1, 1982);
	const superIn = ramp(frame, SEG_START.super, 3725);
	const inheritIn = ramp(frame, SEG_START.inherit, 4520);
	const altarIn = ramp(frame, SEG_START.altar, 5434);
	const spaceIn = ramp(frame, SEG_START.burst, SEG_START.burst + 87);
	const endingIn = ramp(frame, SEG_START.ending, SEG_START.ending + 85);
	const darken = 1 - ramp(frame, TOTAL_FRAMES - 114, TOTAL_FRAMES - .5);
	const caption = SUBS.find(([from, to]) => from <= frame && frame < to);
	return (
		<>
			<AbsoluteFill style={{transform: cameraTransform(frame)}}>
				{openingOut > 0 && muralIn < 1 && <UpperSeg />}
				{openingOut < 1 && <HookSeg exit={openingOut} />}
				<OpeningVeil />
				{superIn < 1 && <Dissolve opacity={muralIn}><MuralSeg frame={frame} /></Dissolve>}
				{inheritIn < 1 && <Dissolve opacity={superIn}><SuperSeg frame={frame} /></Dissolve>}
				{altarIn < 1 && <Dissolve opacity={inheritIn}><InheritSeg frame={frame} /></Dissolve>}
				{spaceIn < 1 && <Dissolve opacity={altarIn}><AltarSeg frame={frame} /></Dissolve>}
				{endingIn < 1 && <Dissolve opacity={spaceIn}><SpaceSeg frame={frame} /></Dissolve>}
				<Dissolve opacity={endingIn}><EndingSeg frame={frame} /></Dissolve>
			</AbsoluteFill>
			<AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 74%, #070a14b3)', opacity: darken, pointerEvents: 'none'}} />
			<Grain opacity={.06 * darken} />
			{caption && (
				<BiSubtitle from={caption[0]} to={caption[1]} zh={caption[2]} en={caption[3]} source={caption[4]} {...SUB} />
			)}
		</>
	);
};

/** 每个独立成片都是总时间轴上的窗口，切点首帧与上一段末帧一致。 */
export const WishMaster: React.FC<{start: number}> = ({start}) => {
	const frame = useFrame() + start;
	const offset = -toFrames(start);
	// 只让画面在切点退回一个渲染帧，叫声依然走原来的时间轴。
	const hold = cuts.has(frame) ? 1 : 0;
	return (
		<AbsoluteFill style={{backgroundColor: '#05080e', overflow: 'hidden'}}>
			<Sequence from={offset + hold} layout="none">
				<Picture />
			</Sequence>
			<Sequence from={offset} layout="none">
				<Cry name="rayquaza" at={K.nameAt} volume={.81} />
				<Cry name="groudon" at={K.groudonAt} volume={.74} />
				<Cry name="kyogre" at={K.kyogreAt} volume={.76} />
				<Cry name="groudon-primal" at={K.primalGroudonAt} volume={.70} />
				<Cry name="kyogre-primal" at={K.primalKyogreAt} volume={.73} />
				<Cry name="rayquaza-mega" at={K.megaAt} volume={.84} />
				<Cry name="rayquaza-mega" at={K.ascentAt} volume={.76} />
			</Sequence>
		</AbsoluteFill>
	);
};
