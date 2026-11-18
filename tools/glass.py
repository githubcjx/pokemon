"""
彩色玻璃窗格烘焙（《剑与盾》）。

一个窗格 = 一张"玻璃片编号图"（每个像素属于哪块玻璃）+ 每块玻璃的颜色 + 棕色釉绘（grisaille）。
铅条只在两块玻璃相接处生成（一块玻璃一种颜色），所以整张窗格的铅条网是一张平面网。

宝可梦取自官方立绘，按立绘自己的色块切玻璃（"由立绘推算的风格化"，不改动立绘造型）：
  · 立绘的深色描线 → 相接处变成铅条，玻璃片内部的描线变成釉绘线；
  · 同一色相的亮面 / 暗面合成一块玻璃，明暗改用釉绘的晕染（matting）表现；
  · 大块面再沿起伏切成几块，像真的玻璃那样不会整片一块。

输出（两张 PNG + 一份 JSON）：
  <名>-color.png  RGB = 玻璃颜色（sRGB），A = 1 是玻璃、0 是石头（窗格外）
  <名>-data.png   R = 铅条覆盖，G = 釉绘浓度，B = 每块玻璃的随机数，A = 每块玻璃的出现顺序（重新嵌铅时用）
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

PPM = 960  # 每米像素数（窗格烘焙分辨率）


# ───────────────────────── 颜色 ─────────────────────────

def hexrgb(h: str) -> np.ndarray:
	h = h.lstrip('#')
	return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def to_lab(rgb: np.ndarray) -> np.ndarray:
	img = (np.clip(rgb, 0, 1) * 255).astype(np.uint8).reshape(-1, 1, 3)
	return cv2.cvtColor(img, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)


def glassify(rgb: np.ndarray) -> np.ndarray:
	"""立绘颜色 → 玻璃颜色：饱和一些、暗一些（背光一照就亮）；白和肤色压暗并带一点绿（中世纪白玻璃）。"""
	hsv = cv2.cvtColor((np.clip(rgb, 0, 1)[None, None] * 255).astype(np.uint8), cv2.COLOR_RGB2HSV)[0, 0].astype(np.float32)
	h, s, v = hsv[0], hsv[1] / 255, hsv[2] / 255
	if s < 0.18:  # 白、灰、奶油色
		v = 0.55 + 0.35 * v
		out = np.array([v * 0.93, v * 0.97, v * 0.86], np.float32)
		return out
	s = min(1.0, s * 1.25 + 0.05)
	v = min(1.0, v * 0.9)
	hsv2 = np.array([[[h, s * 255, v * 255]]], np.uint8)
	return cv2.cvtColor(hsv2, cv2.COLOR_HSV2RGB)[0, 0].astype(np.float32) / 255.0


# ───────────────────────── 曲线工具 ─────────────────────────

def catmull(pts, closed=True, steps=10) -> np.ndarray:
	"""Catmull-Rom 平滑：玻璃的切线都是顺滑的弧，不出现深凹角。"""
	p = np.asarray(pts, np.float32)
	n = len(p)
	out = []
	rng = range(n) if closed else range(n - 1)
	for i in rng:
		p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
		if not closed:
			p0 = p[max(i - 1, 0)]
			p3 = p[min(i + 2, n - 1)]
		for t in np.linspace(0, 1, steps, endpoint=False):
			t2, t3 = t * t, t * t * t
			out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
	if not closed:
		out.append(p[-1])
	return np.array(out, np.float32)


# ───────────────────────── 窗格 ─────────────────────────

@dataclass
class Pane:
	"""一个窗格。坐标单位：像素（PPM 像素 = 1 米），原点在左上。"""

	w: int
	h: int
	seed: int = 1
	labels: np.ndarray = field(init=False)
	colors: dict = field(init=False)
	paint: np.ndarray = field(init=False)
	glass: np.ndarray = field(init=False)  # 窗格形状（True = 玻璃）
	lead_w: dict = field(init=False)  # 每块玻璃周围的铅条半宽（像素）

	def __post_init__(self):
		self.labels = np.zeros((self.h, self.w), np.int32)
		self.colors = {0: np.zeros(3, np.float32)}
		self.paint = np.zeros((self.h, self.w), np.float32)
		self.glass = np.zeros((self.h, self.w), bool)
		self.lead_w = {}
		self.scars = []  # 修补的裂痕：额外的铅条折线
		self.next = 1
		self.rng = np.random.default_rng(self.seed)

	# ── 新玻璃 ──
	def new(self, rgb, lead=None) -> int:
		i = self.next
		self.next += 1
		self.colors[i] = np.asarray(rgb, np.float32)
		if lead is not None:
			self.lead_w[i] = lead
		return i

	def fill(self, mask: np.ndarray, rgb, lead=None) -> int:
		i = self.new(rgb, lead)
		self.labels[mask] = i
		self.paint[mask] = 0  # 新玻璃盖住的地方，原来的釉绘也一起换掉
		return i

	def fill_box(self, m: np.ndarray, y0: int, x0: int, rgb, lead=None) -> int:
		"""只在包围盒里填（大窗格上切几百块小玻璃时快得多）。"""
		i = self.new(rgb, lead)
		sl = (slice(y0, y0 + m.shape[0]), slice(x0, x0 + m.shape[1]))
		self.labels[sl][m] = i
		self.paint[sl][m] = 0
		return i

	def poly_box(self, pts, smooth=True):
		"""多边形在包围盒里的掩膜：返回 (掩膜, y0, x0)，已裁到窗格范围内。"""
		pts = catmull(pts, True) if smooth else np.asarray(pts, np.float32)
		x0 = max(int(np.floor(pts[:, 0].min())) - 1, 0)
		y0 = max(int(np.floor(pts[:, 1].min())) - 1, 0)
		x1 = min(int(np.ceil(pts[:, 0].max())) + 2, self.w)
		y1 = min(int(np.ceil(pts[:, 1].max())) + 2, self.h)
		if x1 <= x0 or y1 <= y0:
			return np.zeros((0, 0), bool), 0, 0
		m = np.zeros((y1 - y0, x1 - x0), np.uint8)
		q = np.round((pts - [x0, y0]) * 4).astype(np.int32)
		cv2.fillPoly(m, [q], 1, lineType=cv2.LINE_8, shift=2)
		return m.astype(bool), y0, x0

	def poly_mask(self, pts, smooth=True, closed=True) -> np.ndarray:
		pts = catmull(pts, closed) if smooth else np.asarray(pts, np.float32)
		m = np.zeros((self.h, self.w), np.uint8)
		cv2.fillPoly(m, [np.round(pts * 4).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=2)
		return m.astype(bool)

	def poly(self, pts, rgb, smooth=True, lead=None, clip=True) -> int:
		m = self.poly_mask(pts, smooth)
		if clip:
			m &= self.glass
		return self.fill(m, rgb, lead)

	def ellipse(self, cx, cy, rx, ry, rgb, angle=0.0, lead=None) -> int:
		m = np.zeros((self.h, self.w), np.uint8)
		cv2.ellipse(m, (int(cx), int(cy)), (int(rx), int(ry)), angle, 0, 360, 1, -1)
		return self.fill(m.astype(bool) & self.glass, rgb, lead)

	# ── 釉绘 ──
	def trace(self, pts, width=6.0, smooth=True, opacity=0.95, taper=True):
		"""釉绘描线：两端收尖的棕色笔画。"""
		pts = catmull(pts, closed=False, steps=8) if smooth and len(pts) > 2 else np.asarray(pts, np.float32)
		pad = int(width) + 4
		x0 = max(int(np.floor(pts[:, 0].min())) - pad, 0)
		y0 = max(int(np.floor(pts[:, 1].min())) - pad, 0)
		x1 = min(int(np.ceil(pts[:, 0].max())) + pad, self.w)
		y1 = min(int(np.ceil(pts[:, 1].max())) + pad, self.h)
		if x1 <= x0 or y1 <= y0:
			return
		layer = np.zeros((y1 - y0, x1 - x0), np.float32)
		n = len(pts)
		for i in range(n - 1):
			t = i / max(n - 2, 1)
			k = math.sin(math.pi * min(max(t, 0.0), 1.0)) ** 0.6 if taper else 1.0
			wpx = max(1, int(round(width * (0.35 + 0.65 * k))))
			a = tuple(np.round((pts[i] - [x0, y0]) * 4).astype(int))
			b = tuple(np.round((pts[i + 1] - [x0, y0]) * 4).astype(int))
			cv2.line(layer, a, b, 1.0, wpx, lineType=cv2.LINE_AA, shift=2)
		layer = cv2.GaussianBlur(layer, (0, 0), 0.8)
		sl = (slice(y0, y1), slice(x0, x1))
		self.paint[sl] = np.maximum(self.paint[sl], np.clip(layer, 0, 1) * opacity)

	def wash(self, mask: np.ndarray, amount: float, blur=12.0):
		"""晕染：一片柔边的淡棕色（点刷的颗粒在着色器里加）。"""
		m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), blur)
		self.paint = np.clip(self.paint + m * amount, 0, 1)

	def gradient_wash(self, mask: np.ndarray, p0, p1, a0: float, a1: float):
		"""沿 p0→p1 方向渐变的晕染（衣褶、天空边缘的阴影）。"""
		yy, xx = np.mgrid[0 : self.h, 0 : self.w].astype(np.float32)
		d = np.array(p1, np.float32) - np.array(p0, np.float32)
		t = ((xx - p0[0]) * d[0] + (yy - p0[1]) * d[1]) / max(float(d @ d), 1e-6)
		g = a0 + (a1 - a0) * np.clip(t, 0, 1)
		self.paint = np.where(mask, np.clip(self.paint + g, 0, 1), self.paint)

	# ── 菱形格底纹（quarries）──
	def quarries(self, mask: np.ndarray, size: float, rgb, jitter=0.12, motif='dot', var=0.05, lead=None):
		"""手切菱形格：共享顶点的菱形网格，顶点带抖动；每格一个釉绘小纹样。"""
		rng = self.rng
		sx, sy = size, size * 1.35
		cols = int(self.w / sx) + 3
		rows = int(self.h / sy) * 2 + 4
		# 菱形网格的顶点：两套交错的点阵
		verts = {}
		for r in range(-3, rows + 3):
			for c in range(-4, cols + 3):
				x = c * sx + (sx / 2 if r % 2 else 0)
				y = r * sy / 2
				verts[(r, c)] = (x + rng.normal(0, jitter * sx), y + rng.normal(0, jitter * sy * 0.5))
		ids = []
		for r in range(-2, rows - 2):
			for c in range(-2, cols - 1):
				# 菱形：上、右、下、左四个顶点
				if r % 2 == 0:
					top, left, right, bot = verts[(r, c)], verts[(r + 1, c - 1)], verts[(r + 1, c)], verts[(r + 2, c)]
				else:
					top, left, right, bot = verts[(r, c)], verts[(r + 1, c)], verts[(r + 1, c + 1)], verts[(r + 2, c)]
				pts = np.array([top, right, bot, left], np.float32)
				cx, cy = pts.mean(0)
				if cx < -sx or cy < -sy or cx > self.w + sx or cy > self.h + sy:
					continue
				m, y0, x0 = self.poly_box(pts, smooth=False)
				if m.size == 0:
					continue
				m &= mask[y0 : y0 + m.shape[0], x0 : x0 + m.shape[1]]
				if m.sum() < 30:
					continue
				col = np.clip(np.asarray(rgb, np.float32) * (1 + rng.normal(0, var)), 0, 1)
				i = self.fill_box(m, y0, x0, col, lead)
				ids.append(i)
				if motif == 'dot':
					self.trace([(cx - 3, cy), (cx + 3, cy)], width=size * 0.09, smooth=False, taper=False, opacity=0.8)
				elif motif == 'rosette':
					rr = size * 0.16
					for a in range(4):
						ang = a * math.pi / 2 + math.pi / 4
						self.trace([(cx, cy), (cx + rr * math.cos(ang), cy + rr * math.sin(ang))], width=size * 0.07, smooth=False)
				elif motif == 'star':
					rr = size * 0.12
					for a in range(3):
						ang = a * math.pi / 3
						self.trace([(cx - rr * math.cos(ang), cy - rr * math.sin(ang)), (cx + rr * math.cos(ang), cy + rr * math.sin(ang))], width=size * 0.05, smooth=False, opacity=0.7)
		return ids

	# ── 立绘 → 玻璃 ──
	def art(self, path: str, cx: float, cy: float, height: float, flip=False, k=16, min_area=None, max_area=None,
			line_paint=0.95, matting=0.75, sat_boost=1.0, clip=True, extend=False):
		"""把官方立绘切成玻璃放进窗格。cx, cy：立绘包围盒中心；height：立绘可见部分的高度（像素）。"""
		im = Image.open(path).convert('RGBA')
		a = np.array(im)
		ys, xs = np.nonzero(a[..., 3] > 16)
		a = a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
		if flip:
			a = a[:, ::-1]
		scale = height / a.shape[0]
		W, H = max(1, int(round(a.shape[1] * scale))), max(1, int(round(height)))
		a = cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
		rgb, alpha = a[..., :3], a[..., 3]
		inside = alpha > 0.5

		lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
		mx, mn = rgb.max(-1), rgb.min(-1)
		sat = (mx - mn) / np.maximum(mx, 1e-4)
		# 描线：很暗、或者暗且饱和度低
		line = inside & ((lum < 0.16) | ((lum < 0.3) & (sat < 0.35)))
		# 轮廓边缘一圈也当描线（立绘外描边）
		edge = inside & ~ndi.binary_erosion(inside, iterations=2)
		line |= edge

		# 颜色聚类：只看色度（a、b）和少量亮度，让亮面暗面归到同一块玻璃
		body = inside & ~line
		lab = to_lab(rgb.reshape(-1, 3)).reshape(H, W, 3)
		feat = np.stack([lab[..., 0] * 0.35, lab[..., 1], lab[..., 2]], -1)
		samples = feat[body]
		kk = min(k, max(2, len(samples) // 50))
		crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5)
		_, lab_k, centers = cv2.kmeans(samples.astype(np.float32), kk, None, crit, 3, cv2.KMEANS_PP_CENTERS)
		q = np.full((H, W), -1, np.int32)
		q[body] = lab_k[:, 0]
		# 描线像素归给最近的色块
		_, (iy, ix) = ndi.distance_transform_edt(q < 0, return_indices=True)
		q = q[iy, ix]
		q[~inside] = -1
		# 边界平滑：每类的 one-hot 模糊后取最大
		acc = np.full((H, W), -1.0, np.float32)
		best = q.copy()
		for c in range(kk):
			s = cv2.GaussianBlur((q == c).astype(np.float32), (0, 0), 2.2)
			upd = s > acc
			acc[upd] = s[upd]
			best[upd] = c
		q = np.where(inside, best, -1)

		# 连通块 → 玻璃片；太小的并入邻居
		area_px = inside.sum()
		min_area = min_area or max(60, area_px / 900)
		max_area = max_area or area_px / 18
		pieces = np.zeros((H, W), np.int32)
		nid = 1
		for c in range(kk):
			lab_c, n = ndi.label(q == c)
			pieces[lab_c > 0] = lab_c[lab_c > 0] + nid - 1
			nid += n
		pieces = self._merge_small(pieces, inside, min_area)
		pieces = self._split_large(pieces, max_area)

		# 每块玻璃的颜色：取该块原图非描线像素的中位色
		out_ids = {}
		ox, oy = int(round(cx - W / 2)), int(round(cy - H / 2))
		# 放进窗格的区域
		x0, y0 = max(ox, 0), max(oy, 0)
		x1, y1 = min(ox + W, self.w), min(oy + H, self.h)
		if x1 <= x0 or y1 <= y0:
			return
		sl_p = (slice(y0, y1), slice(x0, x1))
		sl_a = (slice(y0 - oy, y1 - oy), slice(x0 - ox, x1 - ox))
		region = pieces[sl_a]
		if extend:
			# 立绘盖过窗格形状（石头花格）：立绘所在的地方也变成玻璃
			self.glass[sl_p] |= region > 0
		target = self.glass[sl_p] if clip else np.ones_like(region, bool)
		mean_lum = {}
		objs = ndi.find_objects(pieces)
		for pid in np.unique(region[region > 0]):
			sl = objs[pid - 1]
			pm = pieces[sl] == pid
			m = pm & body[sl]
			px = rgb[sl][m] if m.sum() > 8 else rgb[sl][pm]
			col = np.median(px, 0)
			g = glassify(col)
			if sat_boost != 1.0:
				g = np.clip(g.mean() + (g - g.mean()) * sat_boost, 0, 1)
			out_ids[pid] = self.new(g)
			mean_lum[pid] = float(np.median(lum[sl][pm]))
		lut = np.zeros(pieces.max() + 1, np.int32)
		for pid, gid in out_ids.items():
			lut[pid] = gid
		new_labels = lut[region]
		place = (new_labels > 0) & target
		self.labels[sl_p][place] = new_labels[place]

		# 釉绘：内部描线 + 明暗晕染（比本块中位亮度暗的地方）
		ml = np.zeros(pieces.max() + 1, np.float32)
		for pid, v in mean_lum.items():
			ml[pid] = v
		base = ml[pieces]
		shade = np.clip((base - lum) / np.maximum(base, 0.08), 0, 1)
		shade = cv2.GaussianBlur(shade, (0, 0), 1.5) * matting
		ln = cv2.GaussianBlur(line.astype(np.float32), (0, 0), 0.7) * line_paint
		p = np.maximum(shade, ln) * inside
		pr = p[sl_a]
		self.paint[sl_p] = np.where(place, pr, self.paint[sl_p])

	def _merge_small(self, pieces, inside, min_area):
		"""太小的玻璃片并入与它接壤最长的邻居（只在每片的包围盒里算）。"""
		for _ in range(6):
			ids, counts = np.unique(pieces[pieces > 0], return_counts=True)
			small = set(ids[counts < min_area].tolist())
			if not small:
				break
			objs = ndi.find_objects(pieces)
			for pid in sorted(small):
				sl = objs[pid - 1] if pid - 1 < len(objs) else None
				if sl is None:
					continue
				y0, y1 = max(sl[0].start - 3, 0), min(sl[0].stop + 3, pieces.shape[0])
				x0, x1 = max(sl[1].start - 3, 0), min(sl[1].stop + 3, pieces.shape[1])
				sub = pieces[y0:y1, x0:x1]
				m = sub == pid
				if not m.any():
					continue
				ring = ndi.binary_dilation(m, iterations=2) & ~m & (sub > 0)
				nb = sub[ring]
				if len(nb) == 0:
					continue
				vals, cnt = np.unique(nb, return_counts=True)
				sub[m] = vals[cnt.argmax()]
		return pieces

	def _split_large(self, pieces, max_area):
		rng = self.rng
		nxt = pieces.max() + 1
		ids, counts = np.unique(pieces[pieces > 0], return_counts=True)
		yy, xx = np.mgrid[0 : pieces.shape[0], 0 : pieces.shape[1]].astype(np.float32)
		# 低频噪声扭一扭切线，让切口成为弧线
		noise = cv2.GaussianBlur(rng.normal(0, 1, pieces.shape).astype(np.float32), (0, 0), 25) * 400
		objs = ndi.find_objects(pieces)
		for pid, cnt in zip(ids, counts):
			if cnt <= max_area:
				continue
			k = int(math.ceil(cnt / max_area))
			sl = objs[pid - 1]
			sub = pieces[sl]
			m = sub == pid
			pts = np.stack([xx[sl][m] + noise[sl][m], yy[sl][m] - noise[sl][m] * 0.7], -1).astype(np.float32)
			crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1.0)
			_, lab_k, _ = cv2.kmeans(pts, k, None, crit, 2, cv2.KMEANS_PP_CENTERS)
			subl = np.zeros(m.sum(), np.int32)
			for j in range(1, k):
				subl[lab_k[:, 0] == j] = nxt
				nxt += 1
			cur = sub[m]
			sub[m] = np.where(subl > 0, subl, cur)
		return pieces

	def scar(self, pts, width=3.5):
		"""裂过又用铅条接上的痕迹：一条折线变成铅条（玻璃片也被它切开）。"""
		self.scars.append((np.asarray(pts, np.float32), width))

	# ── 输出 ──
	def finish(self, out: str, lead_px=5.0, outer_lead=9.0, order_from=(0.5, 0.5), order_jitter=0.12, inner_band=0.28):
		lab = np.where(self.glass, self.labels, 0)
		h, w = lab.shape
		# 铅条：编号不同的相邻像素之间
		bnd = np.zeros((h, w), bool)
		bnd[:, 1:] |= lab[:, 1:] != lab[:, :-1]
		bnd[:, :-1] |= lab[:, 1:] != lab[:, :-1]
		bnd[1:, :] |= lab[1:, :] != lab[:-1, :]
		bnd[:-1, :] |= lab[1:, :] != lab[:-1, :]
		dist = ndi.distance_transform_edt(~bnd).astype(np.float32)
		if self.scars:
			sc = np.zeros((h, w), np.uint8)
			for pts, wd in self.scars:
				cv2.polylines(sc, [np.round(pts * 4).astype(np.int32)], False, 1, max(1, int(wd * 2)), lineType=cv2.LINE_AA, shift=2)
			sc = sc.astype(bool)
			dist = np.minimum(dist, ndi.distance_transform_edt(~sc).astype(np.float32) + 0.5)
		# 小玻璃片周围的铅条细一些
		ids, counts = np.unique(lab, return_counts=True)
		size_lut = np.zeros(lab.max() + 1, np.float32)
		size_lut[ids] = counts
		area = size_lut[lab]
		half = lead_px * np.clip(np.sqrt(area / (PPM * 0.08) ** 2), 0.6, 1.0)
		for i, lw in self.lead_w.items():
			half = np.where(lab == i, lw, half)
		# 窗格外缘的铅条更粗
		outer = ndi.distance_transform_edt(self.glass).astype(np.float32)
		lead = np.clip(half + 0.75 - dist, 0, 1)
		lead = np.maximum(lead, np.clip(outer_lead + 0.75 - outer, 0, 1))
		lead[~self.glass] = 1

		# 铅条内侧一圈柔和的晕染（matting 的软边）
		paint = np.clip(self.paint + inner_band * np.exp(-np.maximum(dist - half, 0) / 9.0), 0, 1)

		rng = np.random.default_rng(self.seed + 7)
		rand_lut = rng.random(lab.max() + 1).astype(np.float32)
		# 出现顺序：按玻璃片中心到参考点的距离
		com = np.array(ndi.center_of_mass(np.ones_like(lab), lab, ids), np.float32).reshape(-1, 2)
		cy, cx = com[:, 0], com[:, 1]
		order_lut = np.zeros(lab.max() + 1, np.float32)
		ox, oy = order_from[0] * w, order_from[1] * h
		d = np.hypot(np.array(cx) - ox, np.array(cy) - oy)
		d = d / max(d.max(), 1)
		order_lut[ids] = np.clip(d * (1 - order_jitter) + rng.random(len(ids)) * order_jitter, 0, 1)

		col_lut = np.zeros((lab.max() + 1, 3), np.float32)
		for i, c in self.colors.items():
			if i <= lab.max():
				col_lut[i] = c
		color = col_lut[lab]
		A = self.glass.astype(np.float32)
		Image.fromarray((np.dstack([color, A]) * 255 + 0.5).astype(np.uint8), 'RGBA').save(out + '-color.png', optimize=False, compress_level=3)
		data = np.dstack([lead, paint, rand_lut[lab], order_lut[lab]])
		Image.fromarray((np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(out + '-data.png', optimize=False, compress_level=3)
		# 平均透光颜色（给石墙的溢光用）
		g = self.glass & (lead < 0.5)
		avg = (color[g] * (1 - paint[g, None] * 0.85)).mean(0) if g.any() else np.zeros(3)
		meta = {'w': w, 'h': h, 'ppm': PPM, 'avg': [round(float(v), 4) for v in avg]}
		Path(out + '.json').write_text(json.dumps(meta), encoding='utf-8')
		return meta


# ───────────────────────── 窗洞形状 ─────────────────────────

def lancet_mask(w: int, h: int, arch_h: float) -> np.ndarray:
	"""尖拱窗洞：下方矩形，上方两段圆弧交成尖顶（等边尖拱，圆心在对边的起拱点）。"""
	yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
	spring = arch_h  # 起拱线（从顶端往下）
	r = w * 1.0
	left = (xx - w) ** 2 + (yy - spring) ** 2 <= r * r  # 以右起拱点为圆心
	right = xx ** 2 + (yy - spring) ** 2 <= r * r
	arch = left & right & (yy < spring)
	return arch | (yy >= spring)
