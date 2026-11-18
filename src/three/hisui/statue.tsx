import {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {V3} from '../stage';

// ─── 石像：由官方立绘推算的石雕（《神奥之名》神殿里的十尊宝可梦像）──────────────
// 造型完全来自立绘：轮廓 = 立绘的透明通道，体积 = tools/depth3d.py 算出的深度图（前后各挤出一半），
// 刻纹 = 立绘明暗换成石头的深浅，法线贴图让侧光下看得出凹凸。不手画任何造型。

type ArtData = {
	art: HTMLImageElement;
	depth: Uint8ClampedArray;
	normal: HTMLImageElement;
	w: number;
	h: number;
	maxDepth: number;
	/** 立绘不透明部分的外接框（像素） */
	box: [number, number, number, number];
	alpha: Uint8ClampedArray;
};

const cache = new Map<string, Promise<ArtData>>();
const img = (src: string) =>
	new Promise<HTMLImageElement>((res, rej) => {
		const i = new Image();
		i.onload = () => res(i);
		i.onerror = () => rej(new Error(`failed to load ${src}`));
		i.src = src;
	});
const pixels = (i: HTMLImageElement) => {
	const c = document.createElement('canvas');
	c.width = i.width;
	c.height = i.height;
	const ctx = c.getContext('2d', {willReadFrequently: true})!;
	ctx.drawImage(i, 0, 0);
	return ctx.getImageData(0, 0, i.width, i.height).data;
};

const loadArt = (dir: string) => {
	if (!cache.has(dir)) {
		cache.set(
			dir,
			Promise.all([img(staticFile(`${dir}/art.png`)), img(staticFile(`${dir}/depth.png`)), img(staticFile(`${dir}/normal.png`)), fetch(staticFile(`${dir}/depth.json`)).then((r) => r.json())]).then(
				([art, depthImg, normal, json]) => {
					const alpha = pixels(art);
					const w = art.width;
					const h = art.height;
					let x0 = w;
					let y0 = h;
					let x1 = 0;
					let y1 = 0;
					for (let y = 0; y < h; y++)
						for (let x = 0; x < w; x++)
							if (alpha[(y * w + x) * 4 + 3] > 24) {
								x0 = Math.min(x0, x);
								x1 = Math.max(x1, x);
								y0 = Math.min(y0, y);
								y1 = Math.max(y1, y);
							}
					const maxDepth = (json.maxDepth ?? json.max_depth ?? json.max ?? 0.2) as number;
					return {art, depth: pixels(depthImg), normal, w, h, maxDepth, box: [x0, y0, x1 + 1, y1 + 1], alpha};
				},
			),
		);
	}
	return cache.get(dir)!;
};

/**
 * 加载立绘数据。delayRender 的句柄交给调用方：ThreeCanvas 只在换帧时重画，
 * 必须等用新数据重画过一次画布之后才能放行截图（见 StoneStatue）。
 */
const useArt = (dir: string) => {
	const [data, setData] = useState<ArtData | null>(null);
	const [handle] = useState(() => delayRender(`statue ${dir}`));
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		loadArt(dir)
			.then(setData)
			.catch((e) => {
				console.error(e);
				setFailed(true);
			});
	}, [dir]);
	useEffect(() => {
		if (failed) continueRender(handle);
	}, [failed, handle]);
	return {data, handle};
};

/** 立绘明暗 → 石头的深浅（描线成了刻痕），加一点石材的斑点 */
const stoneMap = (d: ArtData, base: THREE.Color) => {
	const c = document.createElement('canvas');
	c.width = d.w;
	c.height = d.h;
	const ctx = c.getContext('2d')!;
	const out = ctx.createImageData(d.w, d.h);
	const a = d.alpha;
	for (let i = 0; i < d.w * d.h; i++) {
		const L = (0.299 * a[i * 4] + 0.587 * a[i * 4 + 1] + 0.114 * a[i * 4 + 2]) / 255;
		const speck = (Math.sin(i * 12.9898) * 43758.5453) % 1;
		const v = 0.5 + 0.5 * Math.pow(L, 0.65) + (speck - 0.5) * 0.05;
		out.data[i * 4] = Math.min(255, base.r * 255 * v);
		out.data[i * 4 + 1] = Math.min(255, base.g * 255 * v);
		out.data[i * 4 + 2] = Math.min(255, base.b * 255 * v);
		out.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(out, 0, 0);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
};

const alphaMap = (d: ArtData) => {
	const c = document.createElement('canvas');
	c.width = d.w;
	c.height = d.h;
	const ctx = c.getContext('2d')!;
	const out = ctx.createImageData(d.w, d.h);
	for (let i = 0; i < d.w * d.h; i++) {
		const v = d.alpha[i * 4 + 3];
		out.data[i * 4] = v;
		out.data[i * 4 + 1] = v;
		out.data[i * 4 + 2] = v;
		out.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(out, 0, 0);
	return new THREE.CanvasTexture(c);
};

/** 浮雕网格：按外接框铺一张网格，每个顶点按深度图往前挤出；depthScale 与 PokemonArt3D 一致取 0.5 */
const reliefGeometry = (d: ArtData, worldH: number, depthScale: number) => {
	const [x0, y0, x1, y1] = d.box;
	const bw = x1 - x0;
	const bh = y1 - y0;
	const worldW = (worldH * bw) / bh;
	const segY = 140;
	const segX = Math.max(20, Math.round((segY * bw) / bh));
	const g = new THREE.PlaneGeometry(worldW, worldH, segX, segY);
	const p = g.attributes.position as THREE.BufferAttribute;
	const uv = g.attributes.uv as THREE.BufferAttribute;
	const perPx = worldW / bw;
	const zMax = d.maxDepth * d.w * perPx * depthScale;
	for (let i = 0; i < p.count; i++) {
		const u = uv.getX(i);
		const v = uv.getY(i);
		const px = Math.min(d.w - 1, Math.max(0, Math.round(x0 + u * bw)));
		const py = Math.min(d.h - 1, Math.max(0, Math.round(y0 + (1 - v) * bh)));
		const k = (py * d.w + px) * 4;
		const dep = (d.depth[k] * 256 + d.depth[k + 1]) / 65535;
		p.setXYZ(i, p.getX(i), p.getY(i) + worldH / 2, dep * zMax);
		uv.setXY(i, (x0 + u * bw) / d.w, 1 - (y0 + (1 - v) * bh) / d.h);
	}
	g.computeVertexNormals();
	return {g, worldW};
};

export const STONE = new THREE.Color('#d9d4c9');

/**
 * 一尊石像：脚底在 pos，朝向 ry（绕竖轴，0 = 面朝 +z），高 height。opacity 用来淡入淡出。
 */
export const StoneStatue: React.FC<{dir: string; pos: V3; ry: number; height: number; opacity: number; tint?: THREE.Color; shatter?: number; seed?: number; /** 碎裂时留在原处的高度比例（0 = 全部掉落） */ keep?: number}> = ({
	dir,
	pos,
	ry,
	height,
	opacity,
	tint = STONE,
	shatter = 0,
	seed = 1,
	keep = 0,
}) => {
	const {data: d, handle} = useArt(dir);
	const advance = useThree((st) => st.advance);
	const built = useMemo(() => {
		if (!d) return null;
		const {g} = reliefGeometry(d, height, 0.5);
		const normal = new THREE.Texture(d.normal);
		normal.needsUpdate = true;
		const mat = new THREE.MeshStandardMaterial({
			map: stoneMap(d, tint),
			alphaMap: alphaMap(d),
			alphaTest: 0.5,
			normalMap: normal,
			normalScale: new THREE.Vector2(0.8, -0.8),
			roughness: 0.82,
		});
		return {g, mat, chunks: shatterChunks(g, height, seed)};
	}, [d, height, tint, seed]);
	// 数据就绪后先强制重画一次画布，再放行截图
	useEffect(() => {
		if (!built) return;
		advance(performance.now());
		continueRender(handle);
	}, [built, advance, handle]);
	if (!built || opacity <= 0.001) return null;
	// 淡入淡出：透明度乘在 alpha 上，判定阈值随之缩放，轮廓始终按 alpha > 0.5 裁切
	built.mat.transparent = opacity < 0.999;
	built.mat.opacity = opacity;
	built.mat.alphaTest = 0.5 * opacity;
	if (shatter > 0)
		return (
			<group position={pos} rotation={[0, ry, 0]}>
				{built.chunks.map((c, i) => {
					// keep：下面 keep × 高度以内的碎块留在原处，上面的只留三成左右（碎了一半、还认得出来的像）
					const stay = keep > 0 && (c.c[1] < keep * height || ((Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1 < 0.3);
					const s = chunkPose(c, stay ? 0 : shatter);
					return (
						<group key={i} position={s.p} rotation={s.r}>
							<mesh geometry={c.g} material={built.mat} castShadow receiveShadow />
							<mesh geometry={c.g} material={built.mat} scale={[1, 1, -1]} castShadow receiveShadow />
						</group>
					);
				})}
			</group>
		);
	return (
		<group position={pos} rotation={[0, ry, 0]}>
			<mesh geometry={built.g} material={built.mat} castShadow receiveShadow />
			<mesh geometry={built.g} material={built.mat} scale={[1, 1, -1]} castShadow receiveShadow />
		</group>
	);
};

// ── 碎裂（第 5 段：两股力量撞在一起，石像碎了一地）──
// 把浮雕网格按三角形的重心分进十几块（Voronoi），每块绕自己的重心各自松脱、歪倒、落到地上（不往上抛）。

type Chunk = {g: THREE.BufferGeometry; c: V3; v: V3; spin: V3; floor: number};
const GRAV = 9.8;

const shatterChunks = (src: THREE.BufferGeometry, height: number, seed: number): Chunk[] => {
	const g = src.index ? src.toNonIndexed() : src;
	const pos = g.attributes.position as THREE.BufferAttribute;
	const nor = g.attributes.normal as THREE.BufferAttribute;
	const uv = g.attributes.uv as THREE.BufferAttribute;
	let s = seed * 9301 + 49297;
	const r = () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	g.computeBoundingBox();
	const bb = g.boundingBox!;
	const K = 16;
	const seeds = Array.from({length: K}, () => [bb.min.x + r() * (bb.max.x - bb.min.x), bb.min.y + r() * (bb.max.y - bb.min.y)]);
	const buckets: number[][] = seeds.map(() => []);
	for (let t = 0; t < pos.count / 3; t++) {
		let cx = 0;
		let cy = 0;
		for (let k = 0; k < 3; k++) {
			cx += pos.getX(t * 3 + k) / 3;
			cy += pos.getY(t * 3 + k) / 3;
		}
		let best = 0;
		let bd = Infinity;
		seeds.forEach(([sx, sy], i) => {
			const dd = (sx - cx) ** 2 + (sy - cy) ** 2;
			if (dd < bd) {
				bd = dd;
				best = i;
			}
		});
		buckets[best].push(t);
	}
	const out: Chunk[] = [];
	buckets.forEach((tris) => {
		if (!tris.length) return;
		const n = tris.length * 3;
		const P = new Float32Array(n * 3);
		const N = new Float32Array(n * 3);
		const U = new Float32Array(n * 2);
		let mx = 0;
		let my = 0;
		tris.forEach((t, j) => {
			for (let k = 0; k < 3; k++) {
				const a = t * 3 + k;
				const b = j * 3 + k;
				P.set([pos.getX(a), pos.getY(a), pos.getZ(a)], b * 3);
				N.set([nor.getX(a), nor.getY(a), nor.getZ(a)], b * 3);
				U.set([uv.getX(a), uv.getY(a)], b * 2);
				mx += pos.getX(a) / n;
				my += pos.getY(a) / n;
			}
		});
		for (let b = 0; b < n; b++) {
			P[b * 3] -= mx;
			P[b * 3 + 1] -= my;
		}
		const cg = new THREE.BufferGeometry();
		cg.setAttribute('position', new THREE.BufferAttribute(P, 3));
		cg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
		cg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
		// 不往上抛：从原处松脱，稍微往外、往前歪着落下去（上半身的块落得远一点）
		const up = my / height;
		out.push({
			g: cg,
			c: [mx, my, 0],
			v: [mx * (0.3 + r() * 0.5) + (r() - 0.5) * 0.8, -r() * 0.6, 0.3 + r() * 1.0 + up * 0.8],
			spin: [(r() - 0.5) * 2.6, (r() - 0.5) * 1.6, (r() - 0.5) * 2.6],
			floor: 0.25 + r() * 0.35,
		});
	});
	return out;
};

/** t 秒后这一块的位置与转角：抛物线落地后停住（地面在基座以下 floorY） */
const chunkPose = (c: Chunk, t: number, floorY = -1.1) => {
	const yAt = (tt: number) => c.c[1] + c.v[1] * tt - 0.5 * GRAV * tt * tt;
	// 落地时刻：y = floorY + floor（块的半高约略）
	const y0 = c.c[1] - (floorY + c.floor);
	const tHit = (c.v[1] + Math.sqrt(c.v[1] * c.v[1] + 2 * GRAV * Math.max(0, y0))) / GRAV;
	const tt = Math.min(t, tHit);
	const roll = Math.min(t, tHit + 0.25);
	return {
		p: [c.c[0] + c.v[0] * tt, t >= tHit ? floorY + c.floor : yAt(tt), c.c[2] + c.v[2] * tt] as V3,
		r: [c.spin[0] * roll, c.spin[1] * roll, c.spin[2] * roll] as V3,
	};
};
