// ─── 《烧焦塔的大火》段落接续：各段在整期时间轴上的起点，以及交界处必须一致的状态 ───────────
// 规则：下一段的第一帧必须与上一段的最后一帧完全相同（机位、背景、光、雾、雨、云）；
// 随时间流动的纹理（雾带、远山云带、雷云、雨丝、余烬）都用整期时间轴计时，再在新段里慢慢过渡。

export const SEG_FRAMES = {ruins: 600, twin: 780, fire: 900, rebirth: 810};

/** 第 2 段起点为 0（第 2 段的雾带、远山直接用本段帧号，所以以它为基准） */
export const SEG_START = {
	twin: 0,
	fire: SEG_FRAMES.twin,
	rebirth: SEG_FRAMES.twin + SEG_FRAMES.fire,
};

/** 纸色雾带：与第 2 段完全一致的基准参数，storm = 1 时为第 3 段风雨里的样子 */
export const MIST = {
	backSpeed: 0.25,
	frontSpeed: -0.35,
	calm: {backH: 240, backO: 0.75, frontOff: 40, frontH: 300, frontO: 1, color: '#dccaa3'},
	storm: {backH: 220, backO: 0.45, frontOff: 70, frontH: 260, frontO: 0.9, color: '#a89d88'},
};
