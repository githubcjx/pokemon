import {useMemo} from 'react';
import * as THREE from 'three';
import {
	agedTexture,
	fasciaGeometry,
	mossyTileTexture,
	PAGODA_TOP,
	pillarSpots,
	PODIUM_TOP,
	rng,
	roofGeometry,
	Tier,
	TIERS,
	tileTexture,
} from './pagodaGeometry';

// ─── 九重塔（完整 / 烧毁后的废墟）的 three.js 组件 ───────────────────────────

type V3 = [number, number, number];

/** 屋面在离中心 d 处的高度（取各边中线，不含翘角） */
const roofY = (t: Tier, d: number) => {
	const v = Math.min(1, Math.max(0, (d - t.a) / (t.R - t.a)));
	return t.roofIn - (t.roofIn - t.roofOut) * (1 - Math.pow(1 - v, 1.7));
};

const Box: React.FC<{p: V3; s: V3; m: THREE.Material; r?: V3}> = ({p, s, m, r}) => (
	<mesh position={p} rotation={r} material={m} castShadow receiveShadow>
		<boxGeometry args={s} />
	</mesh>
);

/** 开阴影的自定义几何网格（屋面、封檐板） */
const Surf: React.FC<{g: THREE.BufferGeometry; m: THREE.Material; y?: number}> = ({g, m, y = 0}) => (
	<mesh geometry={g} material={m} position={[0, y, 0]} castShadow receiveShadow />
);

/** 一圈方框（四根梁） */
const Frame: React.FC<{y: number; half: number; h: number; d: number; m: THREE.Material}> = ({y, half, h, d, m}) => (
	<>
		<Box p={[0, y, half]} s={[half * 2 + d, h, d]} m={m} />
		<Box p={[0, y, -half]} s={[half * 2 + d, h, d]} m={m} />
		<Box p={[half, y, 0]} s={[d, h, half * 2 - d]} m={m} />
		<Box p={[-half, y, 0]} s={[d, h, half * 2 - d]} m={m} />
	</>
);

export type PagodaMats = ReturnType<typeof useGoldMats>;

/**
 * 两座塔的瓦色：铃铛塔（原名锡塔）偏银灰，金钟塔（原名铜塔）偏铜金（水晶版的设定，片中不说）。
 * char：大火中烧焦的整座塔（同一套构件，全部换成焦黑的材质）。
 */
export type PagodaVariant = 'tin' | 'brass' | 'char';

const charMats = () => {
	const char = (c: string, seed: number) =>
		new THREE.MeshStandardMaterial({map: agedTexture(c, 'rgba(8,5,3,0.8)', {seed, grain: true, mottle: 0.45, grimeH: 0.6}), roughness: 1});
	return {
		tile: new THREE.MeshStandardMaterial({map: tileTexture('#2a2826', '#121110', '#3d3a36'), roughness: 1}),
		under: new THREE.MeshStandardMaterial({color: '#2a1a12', roughness: 1, side: THREE.BackSide}),
		gold: new THREE.MeshStandardMaterial({color: '#4a3a24', roughness: 0.8, metalness: 0.3}),
		plaster: char('#4a423a', 61),
		verm: char('#3a2218', 62),
		wood: char('#1c140e', 63),
		green: char('#2a2a24', 64),
		stone: char('#5a544c', 65),
	};
};

export const useGoldMats = (variant: PagodaVariant = 'tin') =>
	useMemo(
		() => (variant === 'char' ? charMats() : {
			// 做旧的配色：褪色的朱漆、泛黄带污渍的白壁、哑光旧金、生了青苔绿锈的瓦
			tile: new THREE.MeshStandardMaterial({
				map:
					variant === 'brass'
						? mossyTileTexture('#6a5636', '#2e2416', '#9a8358', 'rgba(92,98,56,0.8)', 17)
						: mossyTileTexture('#545a55', '#262a27', '#848b84', 'rgba(96,112,66,0.85)'),
				roughness: variant === 'brass' ? 0.7 : 0.9,
				metalness: variant === 'brass' ? 0.25 : 0,
			}),
			under: new THREE.MeshStandardMaterial({
				map: agedTexture('#6e3a26', 'rgba(30,16,8,0.6)', {seed: 4, grain: true, grimeH: 0.3}),
				roughness: 0.95,
				side: THREE.BackSide,
			}),
			gold: new THREE.MeshStandardMaterial({color: '#a88a4c', roughness: 0.62, metalness: 0.55}),
			plaster: new THREE.MeshStandardMaterial({
				map: agedTexture('#d4c39c', 'rgba(74,52,26,0.75)', {seed: 7, grimeH: 0.5, streaks: 34, mottle: 0.22}),
				roughness: 0.98,
			}),
			verm: new THREE.MeshStandardMaterial({
				map: agedTexture('#8f4630', 'rgba(36,18,10,0.7)', {seed: 12, grain: true, grimeH: 0.4, streaks: 18, mottle: 0.28}),
				roughness: 0.88,
			}),
			wood: new THREE.MeshStandardMaterial({
				map: agedTexture('#3a2617', 'rgba(14,8,4,0.6)', {seed: 15, grain: true}),
				roughness: 0.9,
			}),
			green: new THREE.MeshStandardMaterial({
				map: agedTexture('#445b50', 'rgba(26,22,14,0.6)', {seed: 21, grimeH: 0.35, mottle: 0.25}),
				roughness: 0.9,
			}),
			stone: new THREE.MeshStandardMaterial({
				map: agedTexture('#8c8270', 'rgba(40,32,22,0.7)', {seed: 31, mottle: 0.3, streaks: 12}),
				roughness: 1,
			}),
		}),
		[variant],
	) as ReturnType<typeof charMats>;

const Podium: React.FC<{m: THREE.Material; top: THREE.Material}> = ({m, top}) => (
	<group>
		<Box p={[0, PODIUM_TOP / 2 - 0.1, 0]} s={[13.8, PODIUM_TOP - 0.2, 13.8]} m={m} />
		<Box p={[0, PODIUM_TOP - 0.1, 0]} s={[13.2, 0.2, 13.2]} m={top} />
		{[0, 1, 2, 3].map((side) => (
			<group key={side} rotation={[0, (side * Math.PI) / 2, 0]}>
				{[0, 1, 2].map((k) => (
					<Box key={k} p={[0, 0.22 + k * 0.42, 7.6 - k * 0.45]} s={[3.2, 0.44, 0.5]} m={m} />
				))}
			</group>
		))}
	</group>
);

/** 一层：塔身 + 斗栱带 + 屋顶 + 平台，上层带栏杆 */
const TierMesh: React.FC<{t: Tier; m: PagodaMats; roofGeo: THREE.BufferGeometry; fasciaGeo: THREE.BufferGeometry}> = ({
	t,
	m,
	roofGeo,
	fasciaGeo,
}) => {
	const half = t.w / 2;
	const yTop = t.y0 + t.h;
	const bandHalf = half + 0.3;
	const bandTop = roofY(t, bandHalf) - 0.18;
	const bandH = bandTop - yTop;
	const doorW = t.i === 0 ? 1.7 : 1.05;
	const doorH = t.i === 0 ? 2.7 : 1.35;
	const brackets = 7;
	return (
		<group>
			{/* 白壁 */}
			<Box p={[0, t.y0 + t.h / 2, 0]} s={[t.w - 0.3, t.h, t.w - 0.3]} m={m.plaster} />
			{/* 朱柱 */}
			{pillarSpots(t.w).map(([x, z], k) => (
				<Box key={k} p={[x, t.y0 + t.h / 2, z]} s={[0.34, t.h, 0.34]} m={m.verm} />
			))}
			{/* 头贯、地覆 */}
			<Frame y={yTop - 0.18} half={half - 0.17} h={0.26} d={0.38} m={m.verm} />
			<Frame y={t.y0 + 0.14} half={half - 0.17} h={0.22} d={0.38} m={m.verm} />
			{/* 门扉（四面），金色门钉横带 */}
			{[0, 1, 2, 3].map((side) => (
				<group key={side} rotation={[0, (side * Math.PI) / 2, 0]}>
					<Box p={[0, t.y0 + 0.25 + doorH / 2, half - 0.13]} s={[doorW, doorH, 0.08]} m={m.wood} />
					<Box p={[0, t.y0 + 0.25 + doorH * 0.32, half - 0.08]} s={[doorW * 0.94, 0.07, 0.04]} m={m.gold} />
					<Box p={[0, t.y0 + 0.25 + doorH * 0.68, half - 0.08]} s={[doorW * 0.94, 0.07, 0.04]} m={m.gold} />
				</group>
			))}
			{/* 斗栱带：绿青底 + 一圈出挑的斗栱 + 金线 */}
			<Box p={[0, yTop + bandH / 2, 0]} s={[bandHalf * 2, bandH, bandHalf * 2]} m={m.green} />
			<Frame y={yTop + bandH * 0.5} half={bandHalf + 0.02} h={0.06} d={0.05} m={m.gold} />
			{[0, 1, 2, 3].map((side) => (
				<group key={side} rotation={[0, (side * Math.PI) / 2, 0]}>
					{Array.from({length: brackets}, (_, k) => {
						const x = (-1 + (2 * k) / (brackets - 1)) * (bandHalf - 0.2);
						return (
							<group key={k}>
								<Box p={[x, yTop + bandH * 0.3, bandHalf + 0.18]} s={[0.3, bandH * 0.32, 0.36]} m={m.verm} />
								<Box p={[x, yTop + bandH * 0.56, bandHalf + 0.24]} s={[0.34, bandH * 0.26, 0.48]} m={m.verm} />
							</group>
						);
					})}
				</group>
			))}
			{/* 屋面：上表面是瓦，背面是朱色椽底 */}
			<Surf g={roofGeo} m={m.tile} />
			<Surf g={roofGeo} m={m.under} y={-0.16} />
			<Surf g={fasciaGeo} m={m.gold} />
			{/* 屋面内缘的平台（承托上一层） */}
			<Box p={[0, t.roofIn - 0.1, 0]} s={[t.a * 2 + 0.1, 0.22, t.a * 2 + 0.1]} m={m.tile} />
		</group>
	);
};

/** 上层四周的高栏 */
const Railing: React.FC<{t: Tier; m: PagodaMats}> = ({t, m}) => {
	const half = t.w / 2 + 0.16;
	const y = t.y0;
	const posts = 9;
	return (
		<group>
			<Frame y={y + 0.5} half={half} h={0.07} d={0.07} m={m.verm} />
			<Frame y={y + 0.24} half={half} h={0.05} d={0.05} m={m.verm} />
			{[0, 1, 2, 3].map((side) => (
				<group key={side} rotation={[0, (side * Math.PI) / 2, 0]}>
					{Array.from({length: posts}, (_, k) => (
						<Box key={k} p={[(-1 + (2 * k) / (posts - 1)) * half, y + 0.26, half]} s={[0.08, 0.52, 0.08]} m={m.verm} />
					))}
				</group>
			))}
		</group>
	);
};

/** 相轮：露盘、伏钵、九轮、水烟、宝珠 */
const Finial: React.FC<{m: PagodaMats}> = ({m}) => {
	const y = PAGODA_TOP;
	return (
		<group position={[0, y, 0]}>
			<Box p={[0, 0.25, 0]} s={[1.4, 0.5, 1.4]} m={m.gold} />
			<mesh position={[0, 0.5, 0]} material={m.gold} castShadow>
				<sphereGeometry args={[0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
			</mesh>
			<mesh position={[0, 4.6, 0]} material={m.gold}>
				<cylinderGeometry args={[0.09, 0.12, 8.4, 16]} />
			</mesh>
			{Array.from({length: 9}, (_, k) => (
				<mesh key={k} position={[0, 1.6 + k * 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.gold}>
					<torusGeometry args={[0.62 - k * 0.018, 0.075, 10, 40]} />
				</mesh>
			))}
			{[0, Math.PI / 2].map((r) => (
				<mesh key={r} position={[0, 7.0, 0]} rotation={[0, r, 0]} material={m.gold}>
					<torusGeometry args={[0.55, 0.05, 8, 40]} />
				</mesh>
			))}
			<mesh position={[0, 8.0, 0]} material={m.gold} castShadow>
				<sphereGeometry args={[0.2, 20, 14]} />
			</mesh>
			<mesh position={[0, 8.6, 0]} material={m.gold} castShadow>
				<sphereGeometry args={[0.3, 24, 16]} />
			</mesh>
		</group>
	);
};

/** 完整的九重塔 */
export const Pagoda: React.FC<{variant?: PagodaVariant}> = ({variant = 'tin'}) => {
	const m = useGoldMats(variant);
	const geos = useMemo(() => TIERS.map((t) => ({roof: roofGeometry(t), fascia: fasciaGeometry(t)})), []);
	return (
		<group>
			<Podium m={m.stone} top={m.stone} />
			{TIERS.map((t, i) => (
				<group key={i}>
					<TierMesh t={t} m={m} roofGeo={geos[i].roof} fasciaGeo={geos[i].fascia} />
					{i > 0 ? <Railing t={t} m={m} /> : null}
				</group>
			))}
			<Finial m={m} />
		</group>
	);
};

// ─── 废墟：只剩塔基、一层的焦黑柱架与塌陷的屋檐，满地断梁与余烬 ─────────────

const useRuinMats = () =>
	useMemo(
		() => ({
			char: new THREE.MeshStandardMaterial({color: '#2e2620', roughness: 1}),
			charRed: new THREE.MeshStandardMaterial({color: '#4f2a1c', roughness: 0.95}),
			tile: new THREE.MeshStandardMaterial({
				map: tileTexture('#3d413d', '#1c1f1c', '#5d625b'),
				roughness: 0.9,
			}),
			under: new THREE.MeshStandardMaterial({color: '#33221a', roughness: 1, side: THREE.BackSide}),
			goldDull: new THREE.MeshStandardMaterial({color: '#7a6644', roughness: 0.7, metalness: 0.4}),
			stone: new THREE.MeshStandardMaterial({map: agedTexture('#77706a', 'rgba(20,16,12,0.65)', {seed: 41, mottle: 0.35}), roughness: 1}),
			stoneTop: new THREE.MeshStandardMaterial({color: '#4d4843', roughness: 1}),
			plaster: new THREE.MeshStandardMaterial({map: agedTexture('#8e8574', 'rgba(22,16,10,0.85)', {seed: 43, grimeH: 0.7, mottle: 0.4}), roughness: 1}),
			ground: new THREE.MeshStandardMaterial({color: '#34322f', roughness: 1}),
			shard: new THREE.MeshStandardMaterial({color: '#3e433f', roughness: 0.95}),
		}),
		[],
	);

export const PagodaRuin: React.FC<{frame: number; ground?: boolean}> = ({frame, ground = true}) => {
	const m = useRuinMats();
	const t0 = TIERS[0];
	const t1 = TIERS[1];

	const parts = useMemo(() => {
		const r = rng(11);
		// 一层的柱子：有的齐腰烧断，有的歪斜
		const posts = pillarSpots(t0.w).map(([x, z]) => {
			const broken = r() < 0.45;
			const h = broken ? 1.2 + r() * 1.8 : t0.h;
			return {x, z, h, tilt: [(r() - 0.5) * (broken ? 0.18 : 0.05), 0, (r() - 0.5) * (broken ? 0.18 : 0.05)] as V3};
		});
		// 二层残存的几根断柱
		const upper = pillarSpots(t1.w)
			.filter(() => r() < 0.4)
			.map(([x, z]) => ({x, z, h: 0.5 + r() * 1.3, tilt: [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3] as V3}));
		// 散落的断梁
		const beams = Array.from({length: 9}, () => {
			const ang = r() * Math.PI * 2;
			const dist = 2 + r() * 5;
			return {
				p: [Math.cos(ang) * dist, PODIUM_TOP + 0.2 + r() * 0.6, Math.sin(ang) * dist] as V3,
				len: 2.5 + r() * 4,
				rot: [(r() - 0.5) * 0.5, r() * Math.PI, (r() - 0.5) * 0.6] as V3,
			};
		});
		// 碎瓦与木屑
		const debris = Array.from({length: 70}, () => {
			const ang = r() * Math.PI * 2;
			const dist = Math.sqrt(r()) * 7.5;
			const s = 0.1 + r() * 0.28;
			return {
				p: [Math.cos(ang) * dist, PODIUM_TOP + s * 0.3, Math.sin(ang) * dist] as V3,
				s: [s, s * (0.3 + r() * 0.5), s * (0.6 + r())] as V3,
				rot: [r() * 0.8, r() * Math.PI, r() * 0.8] as V3,
				tile: r() < 0.5,
			};
		});
		// 余烬
		const embers = Array.from({length: 70}, () => {
			const ang = r() * Math.PI * 2;
			const dist = Math.sqrt(r()) * 4.6;
			return {p: [Math.cos(ang) * dist, PODIUM_TOP + 0.03, Math.sin(ang) * dist] as V3, s: 0.05 + r() * 0.12, ph: r() * 6.28, sp: 0.6 + r()};
		});
		// 从屋面破洞里斜刺出来的焦黑椽木
		const rafters = Array.from({length: 7}, () => {
			const ang = r() * Math.PI * 2;
			const dist = 3 + r() * 2.5;
			return {
				p: [Math.cos(ang) * dist, t0.roofOut + 0.4 + r() * 0.8, Math.sin(ang) * dist] as V3,
				len: 1.5 + r() * 2.5,
				rot: [(r() - 0.5) * 1.2, ang, (r() - 0.5) * 1.2] as V3,
			};
		});
		// 残壁
		const walls = [
			{side: 0, h: 1.6, w: 2.2, off: -1.5},
			{side: 1, h: 1.1, w: 1.0, off: 2.9},
			{side: 3, h: 1.1, w: 2.8, off: 0.4},
		];
		return {posts, upper, beams, debris, embers, walls, rafters};
	}, [t0, t1]);

	const roof = useMemo(() => {
		const hole = (side: number, v: number, s: number) => {
			const n = Math.sin(3.1 * s + side * 1.7) * Math.cos(4.3 * v + side) + 0.5 * Math.sin(7.3 * s * v + side * 2.1);
			if (side === 2 && v > 0.2) return true; // 背面整片塌落
			return n > 0.35;
		};
		const sag = (side: number, v: number, s: number) => (side === 1 ? 1.1 * v * v * (1 - 0.6 * Math.abs(s)) : 0.25 * v * v);
		return {roof: roofGeometry(t0, {hole, sag, lift: 0.5}), fascia: fasciaGeometry(t0, {hole, sag, lift: 0.5})};
	}, [t0]);

	const half = t0.w / 2;
	return (
		<group>
			{ground ? (
				<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={m.ground} receiveShadow>
					<planeGeometry args={[400, 400]} />
				</mesh>
			) : null}
			<Podium m={m.stone} top={m.stoneTop} />
			{/* 焦黑的柱架 */}
			{parts.posts.map((p, k) => (
				<Box key={k} p={[p.x, t0.y0 + p.h / 2, p.z]} s={[0.34, p.h, 0.34]} m={k % 3 === 0 ? m.charRed : m.char} r={p.tilt} />
			))}
			{/* 残存的头贯（只剩两面） */}
			<Box p={[0, t0.y0 + t0.h - 0.18, half - 0.17]} s={[t0.w * 0.7, 0.26, 0.38]} m={m.char} r={[0, 0, 0.04]} />
			<Box p={[-(half - 0.17), t0.y0 + t0.h - 0.3, -0.6]} s={[0.38, 0.26, t0.w * 0.55]} m={m.char} r={[0.06, 0, 0]} />
			{/* 残壁 */}
			{parts.walls.map((wl, k) => (
				<group key={k} rotation={[0, (wl.side * Math.PI) / 2, 0]}>
					<Box p={[wl.off, t0.y0 + wl.h / 2, half - 0.2]} s={[wl.w, wl.h, 0.18]} m={m.plaster} />
				</group>
			))}
			{/* 斗栱带只剩正面一段 */}
			<Box p={[0.8, t0.y0 + t0.h + 0.35, half + 0.15]} s={[t0.w * 0.6, 0.7, 0.5]} m={m.char} r={[0, 0, -0.05]} />
			{/* 塌陷、烧穿的一层屋檐 */}
			<Surf g={roof.roof} m={m.tile} />
			<Surf g={roof.roof} m={m.under} y={-0.16} />
			<Surf g={roof.fascia} m={m.charRed} />
			{/* 二层的断柱 */}
			{parts.upper.map((p, k) => (
				<Box key={k} p={[p.x, t1.y0 + p.h / 2, p.z]} s={[0.3, p.h, 0.3]} m={m.char} r={p.tilt} />
			))}
			{/* 心柱：贯穿全塔的中心柱，烧剩一根焦黑的残柱，在半空中折断 */}
			<Box p={[0, PODIUM_TOP + 7.2, 0]} s={[0.72, 14.4, 0.72]} m={m.char} r={[0.025, 0, -0.035]} />
			<Box p={[0.32, PODIUM_TOP + 14.9, 0.05]} s={[0.42, 1.5, 0.36]} m={m.char} r={[0.15, 0.4, 0.38]} />
			<Box p={[-0.2, PODIUM_TOP + 14.6, -0.15]} s={[0.3, 0.9, 0.3]} m={m.char} r={[-0.2, 0, -0.3]} />
			{/* 二层残存的一段梁 */}
			<Box p={[0.6, t1.y0 + 1.3, t1.w / 2 - 0.2]} s={[t1.w * 0.5, 0.24, 0.32]} m={m.char} r={[0, 0, 0.12]} />
			{parts.rafters.map((b, k) => (
				<Box key={k} p={b.p} s={[0.16, 0.16, b.len]} m={m.char} r={b.rot} />
			))}
			{/* 断梁 */}
			{parts.beams.map((b, k) => (
				<Box key={k} p={b.p} s={[0.32, 0.32, b.len]} m={m.char} r={b.rot} />
			))}
			{parts.debris.map((d, k) => (
				<Box key={k} p={d.p} s={d.s} m={d.tile ? m.shard : m.char} r={d.rot} />
			))}
			{/* 余烬：随帧明灭 */}
			{parts.embers.map((e, k) => {
				const glow = 0.55 + 0.45 * Math.sin(frame * 0.07 * e.sp + e.ph) * Math.sin(frame * 0.023 * e.sp + e.ph * 2);
				return (
					<mesh key={k} position={e.p} scale={[1, 0.3, 0.7]} rotation={[0, e.ph, 0]}>
						<dodecahedronGeometry args={[e.s * 0.8, 0]} />
						<meshStandardMaterial color="#2a120a" emissive="#ff5a18" emissiveIntensity={0.3 + glow * 1.5} />
					</mesh>
				);
			})}
		</group>
	);
};

/** 废墟上空的灰烬与火星（3D 粒子，带视差） */
export const AshField: React.FC<{frame: number; count?: number}> = ({frame, count = 700}) => {
	const seeds = useMemo(() => {
		const r = rng(5);
		return Array.from({length: count}, () => ({
			x: (r() - 0.5) * 50,
			y: r() * 30,
			z: (r() - 0.5) * 50,
			sp: 0.01 + r() * 0.025,
			ph: r() * 6.28,
			ember: r() < 0.08,
		}));
	}, [count]);
	const {ash, ember} = useMemo(() => {
		const ashP: number[] = [];
		const emP: number[] = [];
		for (const s of seeds) {
			if (s.ember) {
				// 火星缓缓上升
				const y = (s.y + frame * s.sp * 2.2) % 22;
				emP.push(s.x * 0.35 + Math.sin(frame * 0.03 + s.ph) * 0.6, y, s.z * 0.35 + Math.cos(frame * 0.025 + s.ph) * 0.6);
			} else {
				// 灰烬缓缓飘落
				const y = 30 - ((30 - s.y + frame * s.sp) % 30);
				ashP.push(s.x + Math.sin(frame * 0.02 + s.ph) * 1.2, y, s.z + Math.cos(frame * 0.017 + s.ph) * 1.2);
			}
		}
		const a = new THREE.BufferGeometry();
		a.setAttribute('position', new THREE.Float32BufferAttribute(ashP, 3));
		const e = new THREE.BufferGeometry();
		e.setAttribute('position', new THREE.Float32BufferAttribute(emP, 3));
		return {ash: a, ember: e};
	}, [seeds, frame]);
	return (
		<group>
			<points geometry={ash}>
				<pointsMaterial color="#b9b6ae" size={0.09} sizeAttenuation transparent opacity={0.75} depthWrite={false} />
			</points>
			<points geometry={ember}>
				<pointsMaterial color="#ff8a3a" size={0.08} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
			</points>
		</group>
	);
};

/** 塔前的告示牌（风化的木牌，画面上不写字，原文放在字幕里） */
export const Signboard: React.FC<{p: V3; ry?: number; scale?: number}> = ({p, ry = 0, scale = 1}) => {
	const wood = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				map: agedTexture('#5d4a36', 'rgba(20,14,8,0.7)', {seed: 51, grain: true, mottle: 0.35, streaks: 30}),
				roughness: 0.95,
			}),
		[],
	);
	const face = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				map: agedTexture('#8a7a62', 'rgba(30,22,12,0.55)', {seed: 53, grain: true, mottle: 0.4, streaks: 40, grimeH: 0.3}),
				roughness: 1,
			}),
		[],
	);
	return (
		<group position={p} rotation={[0, ry, 0]} scale={scale}>
			<Box p={[-0.95, 1.1, 0]} s={[0.14, 2.2, 0.14]} m={wood} r={[0, 0, 0.02]} />
			<Box p={[0.95, 1.1, 0]} s={[0.14, 2.2, 0.14]} m={wood} r={[0, 0, -0.015]} />
			<Box p={[0, 1.55, 0.06]} s={[2.1, 1.05, 0.07]} m={face} />
			<Box p={[0, 2.2, 0.02]} s={[2.5, 0.08, 0.42]} m={wood} r={[0.08, 0, 0.01]} />
		</group>
	);
};
