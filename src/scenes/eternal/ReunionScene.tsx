import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {DustMotes} from '../../components/DustMotes';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Cam, shake, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {LAMP, REUNION_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {AZ, hookCam} from './HookScene';
import {CityBg, Glow, onScreen} from './Oil';

export {REUNION_SCENE_FRAMES};

/**
 * 第 7 段《重逢》（35 秒，情感高潮）：
 * 接第 6 段结尾那条街。黄昏转暖；一位年轻的训练家（XY 男主角官方立绘，剪影）来到他面前 → 对战（只用光表现，不出现其他宝可梦）→
 * 对战结束，他的脸上第一次有了一点光 → 天上一点闪光，花叶蒂缓缓落到他手边（第二次叫声）→
 * 光照亮了他：ＡＺ的立绘显出原色（油画），整个画面的颜色回来了 →
 * 花叶蒂飘到他肩旁，镜头慢慢推近他的脸，两行泪流下，停留一会儿再接第 8 段。
 */

const cam0 = hookCam(0);
const CALEM = {x: 560, y: 700, size: 520};
const BURSTS = [168, 196, 222, 250, 274];
const BURST_RGB = ['255,170,90', '200,150,255', '255,236,200', '255,150,110', '220,200,255'];
const DESCEND: [number, number] = [540, 700];
/** 花叶蒂落到ＡＺ伸出的手边（XY 立绘里拿着精灵球的那只手的上方） */
const FLOETTE_END = {x: 990, y: 694};
const FLOETTE_SIZE = 92;
/** 推近：ＡＺ的脸（立绘像素 (880, 265) 处）推到画面的这个位置 */
const PUSH: [number, number] = [800, 1010];
const art = (ax: number, ay: number) => ({x: AZ.x + (ax / 1600 - 0.5) * AZ.size, y: AZ.y + (ay / 1600 - 0.5) * AZ.size});
const FACE = art(880, 265);
const FACE_SCREEN: [number, number, number][] = [
	[PUSH[1], 1100, 420],
	[REUNION_SCENE_FRAMES, 1105, 415],
];
const ZOOM_PUSH: [number, number][] = [
	[PUSH[0], 1.6],
	[PUSH[1], 6.4],
	[REUNION_SCENE_FRAMES, 6.7],
];
/** 花叶蒂最后飘到他肩旁（推近后在画面左下） */
const FLOETTE_RISE = {x: 1080, y: 590};

const baseCam = (f: number): Cam => {
	const sk = BURSTS.map((b) => shake(f, b, 3, 18));
	return {
		x:
			track(f, [
				[0, cam0.x],
				[150, 1000],
				[380, 980],
				[540, 1010],
				[DESCEND[1], 1030],
				[PUSH[0], 1034],
			]) + sk.reduce((a, s) => a + s.x, 0),
		y:
			track(f, [
				[0, cam0.y],
				[150, 590],
				[380, 600],
				[540, 600],
				[DESCEND[1], 640],
				[PUSH[0], 644],
			]) + sk.reduce((a, s) => a + s.y, 0),
		zoom: track(f, [
			[0, cam0.zoom],
			[150, 1.05],
			[380, 1.12],
			[540, 1.2],
			[DESCEND[1], 1.55],
			[PUSH[0], 1.6],
		]),
		roll: 0,
	};
};

/** 推近ＡＺ的脸：缩放按对数插值（推得匀），机位由"脸在画面上的位置"反推，脸平稳地移到画面中上 */
export const reunionCam = (f: number): Cam => {
	if (f <= PUSH[0]) return baseCam(f);
	const c0 = baseCam(PUSH[0]);
	const zoom = Math.exp(track(f, ZOOM_PUSH.map(([k, z]) => [k, Math.log(z)] as [number, number])));
	const s0 = {x: (FACE.x - c0.x) * c0.zoom + 960, y: (FACE.y - c0.y) * c0.zoom + 540};
	const keys: [number, number, number][] = [[PUSH[0], s0.x, s0.y], ...FACE_SCREEN];
	const sx = track(f, keys.map(([k, x]) => [k, x] as [number, number]));
	const sy = track(f, keys.map(([k, , y]) => [k, y] as [number, number]));
	return {x: FACE.x - (sx - 960) / zoom, y: FACE.y - (sy - 540) / zoom, zoom, roll: 0};
};

const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});

/** 花叶蒂的位置：从天上一点闪光，缓缓落下 */
export const reunionFloette = (f: number, time: number) => {
	const k = ramp(f, DESCEND[0], DESCEND[1]);
	const x = 1270 + (FLOETTE_END.x - 1270) * k + Math.sin(k * Math.PI * 1.5) * 60 * (1 - k);
	const y = 60 + (FLOETTE_END.y - 60) * k;
	// 落到手边之后，再慢慢飘到他肩旁
	const r = ramp(f, PUSH[0] + 30, PUSH[1]);
	const rx = x + (FLOETTE_RISE.x - x) * r;
	const ry = y + (FLOETTE_RISE.y - y) * r - Math.sin(r * Math.PI) * 14;
	return {x: rx, y: ry + Math.sin(time * 1.6) * 4 * k};
};

/** 两行泪：立绘像素坐标里的路径（露出的那只眼 / 被白发挡住的那只眼），[开始, 流到底] 帧 */
const TEARS: {pts: [number, number][]; t: [number, number]; w: number}[] = [
	{pts: [[918, 238], [922, 249], [925, 262], [927.5, 279], [928.5, 293], [929, 304]], t: [900, 990], w: 4.4},
	{pts: [[822, 271], [822.8, 281], [824.5, 292], [826, 304]], t: [945, 1030], w: 4},
];

/** 沿折线取到总长的 p 处为止的点 */
const partial = (pts: [number, number][], p: number) => {
	const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
	let left = seg.reduce((a, b) => a + b, 0) * p;
	const out: [number, number][] = [pts[0]];
	for (let i = 0; i < seg.length; i++) {
		if (left >= seg[i]) {
			out.push(pts[i + 1]);
			left -= seg[i];
		} else {
			const u = left / seg[i];
			out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]);
			break;
		}
	}
	return out;
};

/** ＡＺ脸上的泪（按立绘像素坐标画，随镜头缩放）：眼眶先湿，泪珠沿脸颊流下，泪痕被花叶蒂的暖光照出反光 */
const Tears: React.FC<{cam: Cam; frame: number}> = ({cam, frame}) => {
	const o = onScreen(cam, {x: AZ.x - AZ.size / 2, y: AZ.y - AZ.size / 2});
	const k = (AZ.size / 1600) * cam.zoom;
	const well = interpolate(frame, [860, 905], [0, 1], clamp);
	if (well <= 0) return null;
	return (
		<svg style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'visible'}}>
			<defs>
				<filter id="tear-soft" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={0.35} />
				</filter>
			</defs>
			<g transform={`translate(${o.x} ${o.y}) scale(${k})`} filter="url(#tear-soft)">
				{/* 下眼睑湿润的反光 */}
				<ellipse cx={909} cy={236.5} rx={7} ry={1.3} fill="rgba(255,246,228,0.75)" opacity={well} />
				<ellipse cx={912} cy={236} rx={2.4} ry={0.8} fill="rgba(255,255,250,1)" opacity={well} />
				{TEARS.map(({pts, t, w}, i) => {
					const p = interpolate(frame, t, [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.3, 1)});
					const appear = interpolate(frame, [t[0] - 12, t[0]], [0, 1], clamp);
					if (appear <= 0) return null;
					const tr = partial(pts, Math.max(0.02, p));
					const d = tr.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join(' ');
					const [hx, hy] = tr[tr.length - 1];
					const drop = w * (0.85 + 0.35 * Math.min(1, p * 3));
					return (
						<g key={i} opacity={appear}>
							{/* 泪痕：透亮的水膜 + 背光一侧的暗边 + 朝向花叶蒂（左下）一侧断续的水光 */}
							<path d={d} stroke="rgba(255,228,196,0.22)" strokeWidth={w * 1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
							<path d={d} stroke="rgba(60,30,18,0.3)" strokeWidth={w * 0.3} fill="none" strokeLinecap="round" strokeLinejoin="round" transform={`translate(${w * 0.45} 0)`} />
							<path d={d} stroke="rgba(255,248,232,0.32)" strokeWidth={w * 0.75} fill="none" strokeLinecap="round" strokeLinejoin="round" />
							<path
								d={d}
								stroke="rgba(255,255,248,1)"
								strokeWidth={w * 0.2}
								strokeDasharray={`${w * 2.2} ${w * 0.9} ${w * 4} ${w * 1.4}`}
								opacity={0.8 + 0.2 * Math.sin(frame * 0.13 + i * 2)}
								fill="none"
								strokeLinecap="round"
								transform={`translate(${-w * 0.2} 0)`}
							/>
							{/* 泪珠 */}
							<ellipse cx={hx + drop * 0.12} cy={hy + drop * 0.3} rx={drop * 0.66} ry={drop * 0.9} fill="rgba(60,30,18,0.28)" />
							<ellipse cx={hx} cy={hy + drop * 0.2} rx={drop * 0.58} ry={drop * 0.8} fill="rgba(255,240,218,0.62)" />
							<ellipse cx={hx + drop * 0.1} cy={hy + drop * 0.42} rx={drop * 0.34} ry={drop * 0.3} fill="rgba(255,214,160,0.55)" />
							<circle cx={hx - drop * 0.2} cy={hy - drop * 0.02} r={drop * 0.22} fill="rgba(255,255,250,1)" />
						</g>
					);
				})}
			</g>
		</svg>
	);
};

/** 画面颜色：冷色黄昏 → 中性 → 重逢时暖色 */
export const reunionCity = (f: number) => {
	const warm = ramp(f, 640, 800);
	const a = ramp(f, 0, 200);
	return {
		night: 0.62 - 0.22 * a,
		desat: 0.45 - 0.2 * a - 0.25 * warm,
		tint: [0.86 + 0.14 * a + 0.04 * warm, 0.93 + 0.07 * a, 1.06 - 0.06 * a - 0.06 * warm] as [number, number, number],
	};
};

/** ＡＺ受到的光：剪影 → 对战后脸上有一点光 → 花叶蒂回来，第一次被照亮 */
export const reunionAzLight = (f: number) => {
	const smile = ramp(f, 300, 380);
	const lit = ramp(f, 640, 790);
	const a = 0.004 + 0.03 * smile + 0.8 * lit;
	return {
		ambient: [a * 1.06, a * 0.95, a * 0.84] as [number, number, number],
		dirColor: [0.5 * lit, 0.36 * lit, 0.22 * lit] as [number, number, number],
		rim: [0.55 + 0.6 * lit, 0.32 + 0.45 * lit, 0.14 + 0.25 * lit] as [number, number, number],
		oil: lit,
	};
};

/** 第 7 段的画面（不含字幕、颗粒）：第 8 段开头接续时也用它，frame 为状态、time 为整期时间 */
export const ReunionView: React.FC<{frame: number; time: number}> = ({frame, time}) => {
	const t = time;
	const cam = reunionCam(frame);
	const city = reunionCity(frame);
	const az = onScreen(cam, AZ);
	const lamp = onScreen(cam, LAMP);
	const light = reunionAzLight(frame);

	const calemO = interpolate(frame, [24, 100], [0, 1], clamp) * (1 - ramp(frame, 560, 660));
	const calem = onScreen(cam, CALEM);

	const fp = reunionFloette(frame, t);
	const fs = onScreen(cam, fp);
	const sparkle = interpolate(frame, [DESCEND[0], DESCEND[0] + 20, 640, 700], [0, 1, 0.8, 0.5], clamp) * (frame >= DESCEND[0] ? 1 : 0);
	const fO = interpolate(frame, [590, 650], [0, 1], clamp);
	// 推近时花叶蒂的光晕不跟着放大到铺满画面
	const glowS = fs.s <= 1.6 ? fs.s : 1.6 + (fs.s - 1.6) * 0.35;

	// 花叶蒂的光照到ＡＺ身上（从它所在的方向）
	const toF: [number, number, number] = [(fs.x - az.x) / 400, (fs.y - az.y) / 400, 0.6];

	return (
		<AbsoluteFill>
			<CityBg time={t} cam={cam} night={city.night} lamp={1} desat={city.desat} tint={city.tint} />

			{/* 年轻的训练家（XY 男主角官方立绘，剪影） */}
			{calemO > 0 && (
				<PokemonArt3D
					dir="trainers/calem"
					variant="-xy"
					x={calem.x}
					y={calem.y}
					size={CALEM.size * calem.s}
					depthScale={0.4}
					ambient={[0.004, 0.0045, 0.007]}
					rim={{dir: [lamp.x - calem.x, lamp.y - calem.y], color: [0.45, 0.28, 0.13], power: 3}}
					opacity={calemO}
				/>
			)}

			{/* 对战：只用光表现 */}
			{BURSTS.map((b, i) => {
				const amt = interpolate(frame - b, [0, 3, 22], [0, 1, 0], clamp);
				const p = onScreen(cam, {x: 820 + (i % 2 ? 60 : -40), y: 640 - (i % 3) * 30});
				return <Glow key={b} x={p.x} y={p.y} r={260 * p.s} rgb={BURST_RGB[i]} amt={0.75 * amt} />;
			})}

			{/* ＡＺ（XY 立绘）：剪影 → 被花叶蒂的光照亮，显出原色（油画） */}
			<PokemonArt3D
				dir="trainers/az"
				variant="-xy"
				x={az.x}
				y={az.y}
				size={AZ.size * az.s}
				depthScale={0.5}
				ambient={light.ambient}
				dirLights={[
					{dir: [-0.6, -0.3, 0.5], color: [0.006, 0.009, 0.016], wrap: 0.5},
					{dir: toF, color: light.dirColor, wrap: 0.6},
				]}
				rim={{dir: [lamp.x - az.x, lamp.y - az.y], color: light.rim, power: 3}}
				oil={{amount: light.oil, radius: 0.006 - 0.0028 * ramp(frame, PUSH[0], PUSH[1]), warm: 0.3}}
				resolution={Math.min(1.6, 2900 / (AZ.size * az.s * 1.12))}
			/>
			<Tears cam={cam} frame={frame} />

			{/* 花叶蒂：天上的一点闪光 → 缓缓落下 */}
			<Glow x={fs.x} y={fs.y} r={(120 + 200 * fO) * glowS} rgb="255,214,170" amt={0.7 * sparkle} />
			<Glow x={fs.x} y={fs.y} r={18 * glowS} rgb="255,250,240" amt={sparkle * (1 - fO * 0.7)} />
			{fO > 0 && (
				<PokemonArt3D
					dir="pokemon/floette"
					variant="-eternal"
					x={fs.x}
					y={fs.y}
					size={FLOETTE_SIZE * fs.s}
					yaw={Math.sin(t * 0.9) * 4}
					pitch={Math.sin(t * 0.7 + 1) * 2}
					depthScale={0.5}
					ambient={[0.85, 0.78, 0.7]}
					dirLights={[{dir: [0.6, -0.5, 0.4], color: [0.5, 0.38, 0.24], wrap: 0.5}]}
					rim={{dir: [lamp.x - fs.x, lamp.y - fs.y], color: [0.9, 0.6, 0.3], power: 2.6}}
					oil={{amount: 1, radius: 0.0075, warm: 0.35}}
					opacity={fO}
					resolution={1.6}
				/>
			)}

		</AbsoluteFill>
	);
};

export const ReunionScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('reunion', frame);
	return (
		<AbsoluteFill style={{background: '#06070b'}}>
			<ReunionView frame={frame} time={t} />
			<DustMotes opacity={0.5 * ramp(frame, 660, 800)} rgb="255,214,150" frameOffset={globalFrame('reunion', 0)} />

			<Vignette strength={0.7 - 0.12 * ramp(frame, 640, 800)} />

			<BiSubtitle zh="三千年后，他向一位年轻的训练家提出对战。" en="Three thousand years later, he challenged a young Trainer to a battle." from={24} to={144} source={{zh: 'XY 密阿雷·冠军游行', en: 'X/Y Lumiose City parade'}} />
			<BiSubtitle zh="他想知道，训练家究竟是什么。" en="He wanted to know what a Trainer truly is." from={152} to={262} source={{zh: 'XY·ＡＺ："我想知道所谓训练家是什么"', en: 'X/Y AZ: "I want to know what a “Trainer” is."'}} />
			<BiSubtitle zh="对战结束，他笑了。" en="When it was over, he smiled." from={300} to={382} source={{zh: 'XY（对战后ＡＺ露出笑容）', en: 'X/Y'}} />
			<BiSubtitle zh="他终于放下了那个被悲伤困住、造出最终兵器的自己。" en="At last, he let go of the part of himself mired in sorrow, the part that built the ultimate weapon." from={392} to={532} source={{zh: 'XY·ＡＺ（日：ようやく 自分を 捨てられた……最終兵器を 造り 悲しみに 囚われた 自分を……）', en: 'X/Y AZ: "Now I finally feel free… Free from the part of me mired in sorrow--the part of me that built the ultimate weapon…"'}} />

			<Cry name="floette-eternal" at={DESCEND[1]} />
			<BiSubtitle zh="这时，花叶蒂回来了。" en="Just then, Floette came back." from={DESCEND[1] + 8} to={800} />
			<BiSubtitle zh="「花叶蒂……三千年了啊……」" en={'"Floette… It\'s been 3,000 years…"'} from={820} to={968} source={{zh: 'XY·ＡＺ（XY 无官方中文，中文据英日原文自译；日：フラエッテ…… ３０００年ぶり だな……）', en: 'X/Y AZ (official English)'}} />

		</AbsoluteFill>
	);
};
