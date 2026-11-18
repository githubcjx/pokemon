"""
把立绘按网格采样成“文字粒子”的落点（《坠落的序列》用）。纯算法，不改立绘像素。

每个网格格子取一次：平均不透明度 > 0.5 才保留；记录颜色、亮度、轮廓强度、深度（来自 depth3d.py 的深度图）。
点数精确重采样到 N，并按希尔伯特曲线排序——两套点按同一顺序一一对应，形态之间变换时相邻的字飞向相邻的位置。

坐标：以轮廓包围盒中心为原点，单位是包围盒高度（x 右、y 上），z 为深度（同单位，朝向观众为正）。

用法：python tools/glyph_points.py <立绘.png> <输出.json> <N> [晶体 u,v]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def hilbert_index(n: int, x: np.ndarray, y: np.ndarray) -> np.ndarray:
	d = np.zeros_like(x)
	x = x.copy()
	y = y.copy()
	s = n // 2
	while s > 0:
		rx = ((x & s) > 0).astype(np.int64)
		ry = ((y & s) > 0).astype(np.int64)
		d += s * s * ((3 * rx) ^ ry)
		# 旋转
		flip = ry == 0
		swap_x = np.where(flip & (rx == 1), s - 1 - x, x)
		swap_y = np.where(flip & (rx == 1), s - 1 - y, y)
		x, y = np.where(flip, swap_y, swap_x), np.where(flip, swap_x, swap_y)
		s //= 2
	return d


def load_depth(art: Path) -> np.ndarray | None:
	stem = art.stem.replace('art', 'depth', 1)
	p = art.with_name(stem + '.png')
	j = art.with_name(stem + '.json')
	if not p.exists():
		return None
	d = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
	depth = (d[..., 0] * 256 + d[..., 1]) / 65535.0
	max_depth = json.loads(j.read_text())['maxDepth'] if j.exists() else 0.1
	return depth * max_depth * d.shape[1]  # 像素


def sample(art: Path, sp: float):
	im = np.asarray(Image.open(art).convert('RGBA')).astype(np.float64) / 255.0
	h, w = im.shape[:2]
	a = im[..., 3]
	lum = (0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]) * a
	gy, gx = np.gradient(lum)
	edge = np.hypot(gx, gy)
	pts = []
	ys = np.arange(sp / 2, h, sp)
	xs = np.arange(sp / 2, w, sp)
	r = max(1, int(sp / 2))
	for py in ys:
		for px in xs:
			x0, x1 = int(px - r), int(px + r) + 1
			y0, y1 = int(py - r), int(py + r) + 1
			cell = a[y0:y1, x0:x1]
			if cell.size == 0 or cell.mean() < 0.5:
				continue
			c = im[y0:y1, x0:x1, :3] * cell[..., None]
			rgb = c.sum((0, 1)) / max(cell.sum(), 1e-6)
			pts.append((px, py, *rgb, edge[y0:y1, x0:x1].max()))
	return np.array(pts), (h, w)


def main():
	art = Path(sys.argv[1])
	out = Path(sys.argv[2])
	n = int(sys.argv[3])
	crystal = tuple(float(v) for v in sys.argv[4].split(',')) if len(sys.argv) > 4 else None
	# 二分找网格间距，使点数略多于 N
	lo, hi = 2.0, 60.0
	for _ in range(22):
		mid = (lo + hi) / 2
		cnt = len(sample(art, mid)[0])
		if cnt >= n:
			lo = mid
		else:
			hi = mid
	sp = lo
	pts, (h, w) = sample(art, sp)
	depth = load_depth(art)
	alpha = np.asarray(Image.open(art).convert('RGBA'))[..., 3]
	yy, xx = np.nonzero(alpha > 128)
	bx0, bx1, by0, by1 = xx.min(), xx.max(), yy.min(), yy.max()
	cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
	bh = float(by1 - by0)
	# 希尔伯特排序后均匀抽到 N 个
	q = 1024
	hx = np.clip((pts[:, 0] / w * q).astype(np.int64), 0, q - 1)
	hy = np.clip((pts[:, 1] / h * q).astype(np.int64), 0, q - 1)
	order = np.argsort(hilbert_index(q, hx, hy))
	pts = pts[order]
	pick = (np.arange(n) * len(pts) / n).astype(int)
	pts = pts[pick]
	edge = pts[:, 5]
	edge = np.clip(edge / (np.percentile(edge, 95) + 1e-6), 0, 1)
	data = []
	for i, p in enumerate(pts):
		px, py, rr, gg, bb = p[:5]
		lum = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
		z = 0.0
		if depth is not None:
			z = depth[int(min(py, h - 1)), int(min(px, w - 1))] / bh
		cr = 0
		if crystal is not None and np.hypot(px / w - crystal[0], py / h - crystal[1]) < 0.026:
			cr = 1
		data += [round((px - cx) / bh, 4), round((cy - py) / bh, 4), round(z, 4), round(rr, 3), round(gg, 3), round(bb, 3), round(lum, 3), round(float(edge[i]), 3), cr]
	out.write_text(json.dumps({'n': n, 'stride': 9, 'cell': round(sp / bh, 5), 'aspect': round((bx1 - bx0) / bh, 4), 'crystal': [round((crystal[0] * w - cx) / bh, 4), round((cy - crystal[1] * h) / bh, 4)] if crystal else None, 'data': data}, separators=(',', ':')))
	print(f'{out}: n={n} spacing={sp:.2f}px cell={sp / bh:.4f} bbox_h={bh:.0f}')


if __name__ == '__main__':
	main()
