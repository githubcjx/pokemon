import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Flame, Person, Pose, poseAnchor, Sparks} from '../../components/unown/Silhouette';
import {FLOOR_Y, Glyph, projectRoom, UnownWall, WallLight} from '../../components/unown/UnownWall';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {Actor, actorsAt, BRAZIER, CLAN_SCENE_FRAMES, CLAN_T, F1, FLYERS, guide as clanGuide, heroPos as clanHeroPos, PERSON_H, statueEl, V3} from './ClanScene';
import {GLYPH_T, glyphState, wakeAt} from './GlyphScene';
import {DOOR, FAREWELL, FAREWELL_SIZE, flicker, HERO, INSCRIPTION, INSCRIPTION_SIZE, PANELS, TORCH_RGB, WALL} from './wall';

// ─── 第 3 段《为彼而去》（900 帧 = 30 秒，情绪落点）──────────────────────────────
// 接第 2 段末帧（石板上的天光）→ 天光一亮，石板前的未知图腾纷纷退回墙上；伸手的人一靠近，它就躲开
// （可未知图腾能察觉人的意识，却拒绝外面的世界）→ 镜头沿墙往右，露出通往外面的门洞，门边的墙上一只未知图腾都没有
// （它们非常胆小，从不肯走出遗迹）→ 门外的火把越聚越多，越逼越近，门边的未知图腾瑟瑟发抖（后来，遗迹附近的人越来越多）
// → 族人跪在门前的地上刻下最后一句话（于是，那一族人刻下了最后一句话——），四行字一口气灌满金光
// （「吾等人类，当与彼同行。为彼，吾等启程。」）→ 不出字幕：族人举着火把一个个走出门洞，火光在夜里远去、熄灭；
// F 停在门槛前目送；墙上的未知图腾从门边起一只只闭上眼、变回石刻，石室重归黑暗（第 1 段开头的样子）。
export const DEPART_SCENE_FRAMES = 900;

/** 第 2 段结束时在整期时间轴上的位置（第 1 段起算） */
const F2 = F1 + CLAN_SCENE_FRAMES;

const T = {
	sub1: [20, 152] as const,
	recoil: [30, 150] as const,
	sub2: [166, 292] as const,
	crowd: [290, 470] as const,
	sub3: [304, 438] as const,
	sub4: [454, 566] as const,
	carve: [468, 580] as const,
	flood: [582, 640] as const,
	sub5: [584, 742] as const,
	depart: [742, 870] as const,
	sleep: [800, 892] as const,
};

const camKeys = {
	x: [[0, 3360], [140, 3330], [300, 4560], [440, 4700], [540, 4180], [650, 4200], [760, 4420], [900, 3940]],
	y: [[0, 620], [140, 640], [300, 700], [440, 720], [540, 330], [650, 315], [760, 660], [900, 600]],
	zoom: [[0, 0.97], [140, 1.04], [300, 0.88], [440, 0.98], [540, 0.72], [650, 0.74], [760, 0.8], [900, 0.6]],
	pitch: [[0, 0], [140, 0], [300, 0], [440, 2], [540, 44], [650, 46], [760, 3], [900, 0]],
	camZ: [[0, 2600], [300, 2600], [440, 2600], [540, 1720], [650, 1700], [760, 2600], [900, 2600]],
} as Record<string, [number, number][]>;

export const departCam = (f: number): {cam: Cam; pitch: number; camZ: number} => ({
	cam: {x: flow(f, camKeys.x), y: flow(f, camKeys.y), zoom: flow(f, camKeys.zoom), roll: 0},
	pitch: flow(f, camKeys.pitch),
	camZ: flow(f, camKeys.camZ),
});

const ease = Easing.inOut(Easing.sin);

/** 族人走出门洞：先走到门口，再走进门外的夜里；z < 0 时在门外 */
const departPath = (f: number, start: number, from: {x: number; z: number}, side: number) => {
	const t1 = start + 46;
	const t2 = start + 120;
	if (f < start) return {x: from.x, z: from.z, walking: false};
	if (f < t1) {
		const k = ease((f - start) / (t1 - start));
		return {x: from.x + (DOOR.x - 40 * side - from.x) * k, z: from.z + (40 - from.z) * k, walking: true};
	}
	const k = Math.min(1, (f - t1) / (t2 - t1));
	return {x: DOOR.x - 40 * side + side * 260 * k, z: 40 - 1700 * k, walking: true};
};

/** 刻最后一句话的人：跪在每一行的开头 */
const SCRIBES = [0, 1, 2, 3].map((row) => {
	const first = FAREWELL.find((l) => l.row === row)!;
	return {row, x: first.x - 95, z: first.z + 30};
});

/** 门外越聚越多的人（火把） */
const CROWD = Array.from({length: 26}, (_, i) => {
	const z = -380 - random(`cz${i}`) * 2300;
	const spread = 160 + -z * 0.42;
	return {
		i,
		x: DOOR.x + (random(`cx${i}`) - 0.5) * 2 * spread,
		z,
		appear: T.crowd[0] + (i / 26) * (T.crowd[1] - T.crowd[0]) + random(`ca${i}`) * 12,
		pose: (random(`cp${i}`) < 0.5 ? 'raise' : 'walk') as Pose,
		flip: random(`cf${i}`) < 0.5,
	};
}).sort((a, b) => a.z - b.z);

export const DepartScene: React.FC = () => {
	const f = useFrame();
	const fA = F2 + f;
	const f2 = CLAN_SCENE_FRAMES + f; // 第 2 段的本地帧号（接着算）
	const {cam, pitch, camZ} = departCam(f);
	const proj = (p: V3) => projectRoom(cam, p, pitch, camZ);

	const sleepWave = (x: number, y: number) => T.sleep[0] + Math.min(80, Math.hypot(x - DOOR.x, y - 700) / 45);
	const crowdK = interpolate(f, T.crowd, [0, 1], {...clamp, easing: ease}) * interpolate(f, [760, 860], [1, 0], clamp);

	// ── 人 ──
	const g0 = clanGuide(f2 > CLAN_SCENE_FRAMES ? CLAN_SCENE_FRAMES : f2);
	const guideAt = (): Actor => {
		const x = flow(f, [
			[0, g0.x],
			[150, g0.x],
			[300, 4300],
			[470, 4560],
			[742, 4560],
		]);
		const z = flow(f, [
			[0, g0.z],
			[150, g0.z],
			[300, 520],
			[470, 660],
			[742, 660],
		]);
		const walking = (f > 150 && f < 300) || (f > 300 && f < 470 && Math.abs(x - 4560) > 20);
		const d = departPath(f, T.depart[0] + 36, {x, z}, 1);
		return {key: 'guide', pose: d.walking || walking ? 'walk' : 'raise', x: d.x, z: d.z, flip: d.z < 0 ? false : true, t: fA / 26, alpha: 1, torch: true};
	};
	const guide = guideAt();
	// 伸手的人：手伸向石板前的未知图腾，它躲开；之后去刻字
	const q1From = {x: 3480, z: 420};
	const q1Walk = interpolate(f, [150, 330], [0, 1], {...clamp, easing: ease});
	const scribe = (row: number, from: {x: number; z: number}, delay: number, key: string): Actor => {
		const s = SCRIBES[row];
		const arrive = interpolate(f, [150 + delay, 360 + delay], [0, 1], {...clamp, easing: ease});
		const x = from.x + (s.x - from.x) * arrive;
		const z = from.z + (s.z - from.z) * arrive;
		const kneeling = f > 440 && f < 660;
		const d = departPath(f, T.depart[0] + row * 16, {x, z}, row % 2 === 0 ? -1 : 1);
		return {
			key,
			pose: d.walking ? 'walk' : kneeling ? 'kneel' : arrive > 0 && arrive < 1 ? 'walk' : f < 150 && key === 'q1' ? 'reach' : 'stand',
			x: d.x,
			z: d.z,
			flip: d.z < 0 ? row % 2 === 1 : key === 'q1' && f < 150,
			t: kneeling ? fA / 8 + row * 0.25 : fA / 26,
			alpha: key === 'q1' ? 1 : interpolate(f, [120 + delay, 200 + delay], [0, 1], clamp),
		};
	};
	const q1 = scribe(0, {x: 3480 + (q1Walk > 0 ? 0 : 0), z: q1From.z}, 0, 'q1');
	const members = [scribe(1, {x: 3000, z: 900}, 30, 'm1'), scribe(2, {x: 3300, z: 980}, 50, 'm2'), scribe(3, {x: 3700, z: 1060}, 70, 'm3')];
	const clan = [guide, q1, ...members];

	// ── 光源 ──
	// L0：F 的金光（第 2 段末尾就是它）
	const heroP0 = clanHeroPos(CLAN_SCENE_FRAMES);
	const hx = flow(f, [
		[0, heroP0.x],
		[140, heroP0.x - 10],
		[300, 4000],
		[470, 4150],
		[640, 4150],
		[742, 4300],
		[820, 4690],
		[900, 4520],
	]);
	const bobA = (fa: number) => Math.sin((fa - GLYPH_T.heroOut) / 26) * 6;
	// 第 2 段的 heroPos 已含上下浮动：先扣掉第 2 段末帧的浮动作为起点，再加回整期时间轴上的浮动
	const y0 = heroP0.y - bobA(F2);
	const hy = flow(f, [
		[0, y0],
		[140, y0 + 10],
		[300, 760],
		[470, 860],
		[640, 860],
		[742, 840],
		[820, 860],
		[900, 760],
	]);
	const hz = flow(f, [
		[0, heroP0.z],
		[140, heroP0.z],
		[300, 380],
		[470, 760],
		[640, 760],
		[742, 400],
		[820, 130],
		[900, 40],
	]);
	const heroPC: V3 = {x: hx, y: hy + bobA(fA), z: hz};
	const heroDim = interpolate(f, [850, 896], [1, 0.12], {...clamp, easing: ease});
	const heroFlood = interpolate(f, [T.flood[0], T.flood[0] + 20, 700], [0, 1, 0.3], clamp);
	const glowK = 1.1 * heroDim * (1 + heroFlood * 0.8);
	const L0: WallLight = {pos: [heroPC.x, heroPC.y, heroPC.z], color: [glowK, glowK * 0.72, glowK * 0.36], radius: 260};
	// L1：向导的火把（出了门就熄）
	const gTip = torchTipOf(guide);
	const gOut = interpolate(guide.z, [-700, -200], [0, 1], clamp);
	const gk = flicker(fA, 1.3) * 7.5 * gOut;
	const L1: WallLight = {pos: [gTip.x, gTip.y, gTip.z], color: [TORCH_RGB[0] * gk, TORCH_RGB[1] * gk, TORCH_RGB[2] * gk], radius: 360};
	// L2：石板旁的火盆 → 门外人群的火光 → 门外的月光
	const brK = interpolate(f, [200, 270], [1, 0], clamp) * flicker(fA, 2.2) * 6;
	const L2: WallLight =
		f < 240
			? {pos: [BRAZIER.x, BRAZIER.y - 40, BRAZIER.z], color: [TORCH_RGB[0] * brK, TORCH_RGB[1] * brK, TORCH_RGB[2] * brK], radius: 420}
			: f < 820
			? {pos: [DOOR.x, 860, -260], color: [TORCH_RGB[0] * crowdK * 5, TORCH_RGB[1] * crowdK * 5, TORCH_RGB[2] * crowdK * 5], radius: 700}
			: (() => {
					const m = interpolate(f, [820, 880], [0, 1], clamp);
					return {pos: [DOOR.x, 520, -200] as [number, number, number], color: [0.5 * m, 0.62 * m, 0.95 * m] as [number, number, number], radius: 650};
			  })();
	const lights = [L0, L1, L2];

	// ── 未知图腾 ──
	const glyphs: Glyph[] = [];
	const glowEnd = 0.4; // 第 2 段末尾墙上眼白的亮度系数
	const fear = interpolate(f, [330, 470], [0, 1], clamp) * interpolate(f, [742, 800], [1, 0], clamp);
	const sleepOf = (x: number, y: number) => {
		const tw = sleepWave(x, y);
		return {eye: interpolate(f, [tw, tw + 12], [1, 0], {...clamp, easing: Easing.in(Easing.quad)}), carve: interpolate(f, [tw - 6, tw + 16], [1, 0], clamp)};
	};
	const flyerIds = new Set(FLYERS.map((x) => x.g.id));
	for (const w of WALL) {
		const st = glyphState(fA, wakeAt(w.x, w.y, w.seed));
		const sl = sleepOf(w.x, w.y);
		// 门外的人越多，离门越近的越害怕：发抖
		const near = Math.max(0, 1 - Math.hypot(w.x - DOOR.x, w.y - 700) / 1500);
		const shiver = fear * near * 5 * Math.sin(fA * 1.7 + w.seed * 40);
		if (flyerIds.has(w.id)) continue;
		glyphs.push({...w, x: w.x + shiver, carve: Math.min(st.carve, sl.carve), eye: Math.min(st.eye, sl.eye), eyeGlow: st.eyeGlow * glowEnd * sl.eye});
	}
	glyphs.push({x: HERO.x, y: HERO.y, size: HERO.size, form: HERO.form, carve: 0, eye: 0});
	// 石板前飞着的未知图腾：天光一亮，退回墙上
	FLYERS.forEach(({g: w, start, z, dx, dy}, i) => {
		const outFrom = interpolate(f2, [start, start + 90], [0, 1], {...clamp, easing: ease});
		const back = interpolate(f, [T.recoil[0] + i * 6, T.recoil[0] + i * 6 + 70], [0, 1], {...clamp, easing: ease});
		const out = outFrom * (1 - back);
		const st0 = glyphState(fA, wakeAt(w.x, w.y, w.seed));
		const sl = sleepOf(w.x, w.y);
		const drift = Math.sin((f2 + w.seed * 200) / 34) * 18;
		glyphs.push({
			...w,
			carve: Math.min(st0.carve, sl.carve),
			eye: Math.min(st0.eye, sl.eye),
			eyeGlow: st0.eyeGlow * (0.4 + 0.6 * glowEnd) * sl.eye,
			plane: out > 0 ? 2 : 0,
			x: w.x + dx * out + Math.cos((f2 + w.seed * 90) / 47) * 14 * out,
			y: w.y + dy * out + drift * out,
			z: z * out,
			size: w.size * (1 - 0.08 * out),
		});
	});
	// 第 2 段的地面刻文（画面外，保持原样）
	INSCRIPTION.forEach((l) => glyphs.push({form: l.form, x: l.x, y: l.z, size: INSCRIPTION_SIZE, plane: 1, carve: 0, eye: 0, gold: 0.95 * interpolate(f, T.sleep, [1, 0], clamp)}));
	// 拼图石板：天光褪去
	PANELS.forEach((p, i) => {
		const at = CLAN_T.panelGold[i];
		glyphs.push({
			form: p.form,
			x: p.x,
			y: p.y,
			size: p.size,
			relief: true,
			carve: 0,
			eye: 0,
			gold: interpolate(f2, [at - 6, at + 18, at + 70], [0, 0.85, 0.32], clamp) * interpolate(f, T.sleep, [1, 0.25], clamp),
			daylight: 0.55 * interpolate(f, [T.recoil[0], T.recoil[0] + 90], [1, 0], {...clamp, easing: ease}),
		});
	});
	// 最后一句话：一口气刻完，金光一口气灌满
	FAREWELL.forEach((l) => {
		const ti = T.carve[0] + (l.n / FAREWELL.length) * (T.carve[1] - T.carve[0]);
		glyphs.push({
			form: l.form,
			x: l.x,
			y: l.z,
			size: FAREWELL_SIZE,
			plane: 1,
			carve: 0,
			eye: 0,
			alpha: interpolate(f, [ti, ti + 6], [0, 1], clamp),
			gold: interpolate(f, [T.flood[0] + l.row * 6, T.flood[0] + l.row * 6 + 34], [0, 1], {...clamp, easing: ease}) * interpolate(f, [T.sleep[0], T.sleep[1]], [1, 0.3], clamp),
		});
	});

	// ── 画面元素（按离墙远近排序）──
	const drawn: {z: number; outside: boolean; el: React.ReactNode}[] = [];
	const drawPerson = (a: Actor, key: string, rimTo: V3) => {
		const s = proj({x: a.x, y: FLOOR_Y, z: a.z});
		if (s.behind || s.x < -400 || s.x > 2320) return;
		const head = proj({x: a.x, y: FLOOR_Y - PERSON_H, z: a.z});
		const h = Math.max(1, s.y - head.y);
		const aspect = (PERSON_H * s.scale) / h;
		const torchO = a.torch ? interpolate(a.z, [-1400, -600], [0, 1], clamp) : 0;
		const tip = a.torch ? torchTipOf(a) : null;
		const ts = tip ? proj(tip) : null;
		drawn.push({
			z: a.z,
			outside: a.z < 0,
			el: (
				<div key={key} style={{position: 'absolute', inset: 0, opacity: a.alpha * (a.key.startsWith('crowd') ? 1 : interpolate(a.z, [-1500, -700], [0, 1], clamp))}}>
					<Person x={s.x} y={s.y} height={h} aspect={aspect} pose={a.pose} t={a.t} flip={a.flip} rimDir={[rimTo.x - a.x, -0.4]} rim={0.75} />
					{ts && torchO > 0 ? <Flame x={ts.x} y={ts.y + 8 * ts.scale} size={34 * ts.scale} f={fA} seed={a.x} opacity={torchO} /> : null}
				</div>
			),
		});
	};
	// 轮廓光朝向向导的火把（与第 2 段一致）
	for (const a of clan) drawPerson(a, a.key, {x: gTip.x, y: gTip.y, z: gTip.z});
	// 第 2 段石像旁的人与石像（画面左边缘还看得到，接着画）
	const statueCrew = actorsAt(f2).filter((a) => a.key.startsWith('s'));
	for (const a of statueCrew) drawPerson(a, a.key, {x: gTip.x, y: gTip.y, z: gTip.z});
	drawn.push({z: 640, outside: false, el: <div key="statue">{statueEl(f2, proj, statueCrew)}</div>});
	// 门外的人群：近的画剪影 + 火把，远的只见火光
	for (const c of CROWD) {
		const a = interpolate(f, [c.appear, c.appear + 30], [0, 1], clamp) * interpolate(f, [760 + (c.i % 7) * 10, 800 + (c.i % 7) * 10], [1, 0], clamp);
		if (a <= 0) continue;
		const zz = c.z + interpolate(f, [c.appear, 760], [0, 260], clamp);
		const actor: Actor = {key: `crowd${c.i}`, pose: c.pose, x: c.x, z: zz, flip: c.flip, t: fA / 30 + c.i, alpha: a, torch: true};
		if (zz > -1300) drawPerson({...actor, alpha: a}, actor.key, {x: DOOR.x, y: 700, z: 400});
		else {
			const tip = torchTipOf(actor);
			const ts = proj(tip);
			drawn.push({z: zz, outside: true, el: <Flame key={actor.key} x={ts.x} y={ts.y} size={34 * ts.scale} f={fA} seed={c.i} opacity={a} />});
		}
	}
	// F
	const hs = proj(heroPC);
	const toModel = (l: WallLight): [number, number, number] => [(l.pos[0] - heroPC.x) / HERO.size, (l.pos[1] - heroPC.y) / HERO.size, (l.pos[2] - heroPC.z) / HERO.size];
	drawn.push({
		z: heroPC.z,
		outside: false,
		el: (
			<PokemonArt3D
				key="hero"
				dir="pokemon/unown"
				variant="-f"
				x={hs.x}
				y={hs.y}
				size={HERO.size * hs.scale}
				yaw={Math.sin((fA - GLYPH_T.heroOut) / 40) * 4}
				pitch={-2}
				depthScale={0.5}
				ambient={[0.004, 0.004, 0.005]}
				pointLights={[
					{pos: toModel(L0), color: L0.color, radius: L0.radius / HERO.size},
					{pos: toModel(L1), color: L1.color, radius: L1.radius / HERO.size},
				]}
				rim={{dir: [-0.7, 0.55], color: [0.55, 0.32, 0.12], power: 2.5}}
				emissive={0.7 * heroDim}
				emissiveKey={[0.6, 0.85, -1, 0]}
				brightness={heroDim * (1 + heroFlood * 0.15)}
				resolution={1.6}
			/>
		),
	});
	drawn.sort((p, q) => p.z - q.z);

	// 门洞在屏幕上的形状：门外的东西只在门洞里可见
	const doorPts: string[] = [];
	for (let i = 0; i <= 24; i++) {
		const a = Math.PI + (i / 24) * Math.PI;
		const p = proj({x: DOOR.x + Math.cos(a) * DOOR.halfWidth, y: DOOR.springY + Math.sin(a) * DOOR.halfWidth, z: 0});
		doorPts.push(`${p.x}px ${p.y}px`);
	}
	const dr = proj({x: DOOR.x + DOOR.halfWidth, y: FLOOR_Y, z: 0});
	const dl = proj({x: DOOR.x - DOOR.halfWidth, y: FLOOR_Y, z: 0});
	// 门洞下沿之下是门外的地面（视线从门洞底部继续往外），一直延伸到画面底部
	const doorClip = `polygon(${doorPts.join(', ')}, ${dr.x}px ${dr.y}px, ${dr.x + (dr.x - 960) * 3}px 1400px, ${dl.x + (dl.x - 960) * 3}px 1400px, ${dl.x}px ${dl.y}px)`;

	const brazierS = proj(BRAZIER);
	const scribeSparks =
		f > 440 && f < 660
			? SCRIBES.map((sc, i) => {
					const a = [q1, ...members][i];
					const s = proj({x: a.x + 27 * (PERSON_H / 100), y: FLOOR_Y - 6, z: a.z});
					const at = Math.floor(fA / 8 + i * 0.25 + 0.5) * 8 - i * 2 - F2;
					return <Sparks key={`sp${i}`} x={s.x} y={s.y} scale={s.scale * 1.3} f={f} at={at} seed={i * 13 + Math.floor(f / 8)} />;
			  })
			: null;

	const day = interpolate(f, [T.recoil[0], T.recoil[0] + 90], [1, 0], {...clamp, easing: ease});
	const pc = proj({x: (PANELS[0].x + PANELS[3].x) / 2, y: PANELS[0].y, z: 0});
	const outsideNight = interpolate(f, [200, 300], [0.6, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<UnownWall cam={cam} pitch={pitch} camZ={camZ} floor door={DOOR} outside={outsideNight} time={fA / BASE_FPS} lights={lights} glyphs={glyphs} />
			{/* 门外：只在门洞里可见 */}
			<AbsoluteFill style={{clipPath: doorClip}}>{drawn.filter((d) => d.outside).map((d) => d.el)}</AbsoluteFill>
			{drawn.filter((d) => !d.outside).map((d) => d.el)}
			{scribeSparks}
			{/* 石板旁的火盆（与第 2 段一样画在人的上面）：人走之前熄灭 */}
			{f < 300 ? (
				<>
					<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
						<g transform={`translate(${brazierS.x},${brazierS.y}) scale(${brazierS.scale})`} fill="#090705">
							<path d="M -46,0 Q 0,34 46,0 L 40,-8 L -40,-8 Z" />
							<rect x={-9} y={0} width={18} height={240} />
						</g>
					</svg>
					<Flame x={brazierS.x} y={brazierS.y - 4 * brazierS.scale} size={46 * brazierS.scale} f={fA} seed={3} opacity={interpolate(f, [200, 270], [1, 0], clamp)} glow={1.3} />
				</>
			) : null}
			<DustMotes opacity={0.7 * interpolate(f, T.sleep, [1, 0.3], clamp)} frameOffset={F2} />
			{/* 外面的天光（接第 2 段末尾）：未知图腾退回墙上时褪去 */}
			{day > 0 ? (
				<AbsoluteFill
					style={{
						mixBlendMode: 'screen',
						opacity: day * 0.75,
						background: `linear-gradient(${100}deg, transparent ${pc.x / 19.2 - 34}%, rgba(170,200,255,0.22) ${pc.x / 19.2 - 18}%, rgba(200,220,255,0.3) ${pc.x / 19.2}%, rgba(170,200,255,0.2) ${pc.x / 19.2 + 20}%, transparent ${pc.x / 19.2 + 36}%)`,
						maskImage: `linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) ${pc.y / 10.8}%, rgba(0,0,0,0.15) ${pc.y / 10.8 + 22}%, transparent 100%)`,
						WebkitMaskImage: `linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) ${pc.y / 10.8}%, rgba(0,0,0,0.15) ${pc.y / 10.8 + 22}%, transparent 100%)`,
					}}
				/>
			) : null}
			{/* 回忆的暖金色调（接第 2 段），人走后褪去 */}
			<AbsoluteFill style={{background: 'rgba(255,186,96,1)', mixBlendMode: 'soft-light', opacity: 0.14 * interpolate(f, T.sleep, [1, 0], clamp)}} />
			<Vignette strength={0.75} />
			<SubtitleBackdrop />

			{/* 旁白（制作者撰写）：依据心金魂银·菊石兽石室地面文字 "They possess power to sense with mind and reject outside" */}
			<BiSubtitle
				from={T.sub1[0]}
				to={T.sub1[1]}
				zh="可未知图腾能察觉人的意识，却拒绝外面的世界。"
				en="But the Unown could sense the minds of others, and they rejected the outside world."
				source={{zh: '旁白（依据心金魂银·菊石兽石室地面文字）', en: 'NARRATION (after HGSS · Omanyte chamber floor)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·研究员 "The UNOWN were easily scared and wouldn't go outside." */}
			<BiSubtitle
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="它们非常胆小，从不肯走出遗迹。"
				en="They were timid, and would never leave the ruins."
				source={{zh: '旁白（依据心金魂银·研究员）', en: 'NARRATION (after HGSS · researcher)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·研究员 "When more and more people started to appear around the ruins…" */}
			<BiSubtitle
				from={T.sub3[0]}
				to={T.sub3[1]}
				zh="后来，遗迹附近的人越来越多。"
				en="Then more and more people came to the ruins."
				source={{zh: '旁白（依据心金魂银·研究员）', en: 'NARRATION (after HGSS · researcher)'}}
			/>
			{/* 旁白（制作者撰写） */}
			<BiSubtitle
				from={T.sub4[0]}
				to={T.sub4[1]}
				zh="于是，那一族人刻下了最后一句话——"
				en="So the clan carved one last message—"
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			{/* 半文言译文（制作者撰写）；英文为心金魂银·凤王石室地面文字原文（日文：わたしたち にんげん かれらと ともに あゆむ こと ひつよう かれらの ために わたしたち たびだつ） */}
			<BiSubtitle
				from={T.sub5[0]}
				to={T.sub5[1]}
				zh="「吾等人类，当与彼同行。为彼，吾等启程。」"
				en={'"We humans need to walk with them. We leave here for the sake of them."'}
				source={{zh: '心金魂银·凤王石室地面文字（半文言译文）', en: 'HGSS · Ho-Oh chamber floor'}}
			/>
			<Grain frameOffset={F2} />
		</AbsoluteFill>
	);
};

/** 人手里火把的火焰位置（世界坐标） */
function torchTipOf(a: Actor): V3 {
	const tip = poseAnchor(a.pose, a.t ?? 0, 'torch') ?? poseAnchor('raise', 0, 'torch')!;
	const k = PERSON_H / 100;
	return {x: a.x + tip[0] * k * (a.flip ? -1 : 1), y: FLOOR_Y + (tip[1] - 6) * k, z: a.z};
}
