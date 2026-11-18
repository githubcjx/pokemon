import {PARTS, SEG_FRAMES, SEG_START, SegName, TOTAL_FRAMES} from './common';
import {WishMaster} from './Master';

const seg = (name: SegName) => {
	const C: React.FC = () => <WishMaster start={SEG_START[name]} />;
	return C;
};

/** 各段：合成 ID 为 WISH-<段名>（首字母大写） */
export const WISH_SEGMENTS = (Object.keys(SEG_START) as SegName[]).map((name) => ({
	id: `WISH-${name[0].toUpperCase()}${name.slice(1)}`,
	component: seg(name),
	frames: SEG_FRAMES[name],
}));

/** 交付的三个文件：上（第 2–4 段）、中（第 5–7 段）、下（第 8–12 段） */
export const WISH_PARTS = [
	...(Object.keys(PARTS) as (keyof typeof PARTS)[]).map((k, i) => {
		const [a, b] = PARTS[k];
		const C: React.FC = () => <WishMaster start={a} />;
		return {id: `WISH-Part${i + 1}`, component: C, frames: b - a};
	}),
	{id: 'WISH', component: (() => <WishMaster start={0} />) as React.FC, frames: TOTAL_FRAMES},
];
