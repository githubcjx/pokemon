"""
从官方立绘的透明轮廓推算 2.5D 深度图与法线图（纯算法，不用 AI，不改动立绘像素）。

做法：把轮廓当成一张被吹鼓的膜——在轮廓内解泊松方程 ∇²u = -1（边界 u=0），
再取 h = sqrt(4u)。圆形区域会得到正好的半球，细长部位得到圆柱截面，没有距离变换那种棱线。
法线在此基础上叠加少量立绘明暗的高频细节，让打光时出现浮雕纹理。

输出（与立绘同目录）：
  depth-<名>.png   R/G 两通道存 16 位深度（0..1，相对最大值）
  normal-<名>.png  RGB 存法线（图像坐标：x 右、y 下、z 朝向观众），深度比例为 1
  depth-<名>.json  最大深度（占立绘宽度的比例）

用法：python tools/depth3d.py public/pokemon/groudon/art-primal.png
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SOLVE_RES = 400  # 泊松方程在低分辨率下求解，再放大
DETAIL_PX = 5  # 明暗细节的高通半径（全分辨率像素）
DETAIL_AMOUNT = 6.0  # 明暗细节换算成的浮雕高度（像素）


def gaussian(img: np.ndarray, sigma: float) -> np.ndarray:
	"""可分离高斯模糊（边缘按 0 处理）。"""
	r = int(np.ceil(sigma * 3))
	k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
	k /= k.sum()
	out = img
	for axis in (0, 1):
		pad = [(0, 0), (0, 0)]
		pad[axis] = (r, r)
		p = np.pad(out, pad)
		acc = np.zeros_like(out)
		n = out.shape[axis]
		for i, w in enumerate(k):
			acc += w * (p[i : i + n] if axis == 0 else p[:, i : i + n])
		out = acc
	return out


def inflate(mask: np.ndarray, iters: int = 3000, tol: float = 1e-6) -> np.ndarray:
	"""在 mask 内解 ∇²u = -1（轮廓外 u=0，共轭梯度法），返回 sqrt(4u)，单位为 mask 的像素。"""
	m = mask.astype(np.float64)

	def A(u: np.ndarray) -> np.ndarray:  # -∇²，限制在 mask 内
		p = np.pad(u, 1)
		return (4 * u - p[:-2, 1:-1] - p[2:, 1:-1] - p[1:-1, :-2] - p[1:-1, 2:]) * m

	u = np.zeros_like(m)
	r = m.copy()
	d = r.copy()
	rr = (r * r).sum()
	for _ in range(iters):
		Ad = A(d)
		a = rr / (d * Ad).sum()
		u += a * d
		r -= a * Ad
		rr2 = (r * r).sum()
		if rr2 < tol * m.sum():
			break
		d = r + (rr2 / rr) * d
		rr = rr2
	return np.sqrt(np.maximum(4.0 * u, 0.0))


def main(path: str) -> None:
	src = Path(path)
	name = src.stem.removeprefix('art')  # art-primal → -primal，art → ''
	im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float64) / 255.0
	H, W = im.shape[:2]
	alpha = im[..., 3]

	# 1. 低分辨率吹鼓
	small = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize((SOLVE_RES, SOLVE_RES), Image.LANCZOS)) / 255.0
	height_small = inflate(small > 0.5) * (W / SOLVE_RES)  # 换算成全分辨率像素
	height = np.asarray(Image.fromarray(height_small.astype(np.float32)).resize((W, H), Image.BICUBIC)).astype(np.float64)
	height = gaussian(np.maximum(height, 0), 2.0)
	height *= np.clip(alpha * 1.5, 0, 1)  # 半透明边缘收到 0

	# 2. 法线：形体 + 立绘明暗的高频细节（深色描线成为浅槽）
	lum = (im[..., 0] * 0.299 + im[..., 1] * 0.587 + im[..., 2] * 0.114) * alpha
	detail = lum - gaussian(lum, DETAIL_PX)
	bump = height + detail * DETAIL_AMOUNT * (alpha > 0.5)
	bump = gaussian(bump, 1.0)
	gy, gx = np.gradient(bump)
	nrm = np.dstack([-gx, -gy, np.ones_like(gx)])
	nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)

	# 3. 写出
	hmax = float(height.max())
	d16 = np.round(height / hmax * 65535).astype(np.uint32)
	depth_rgb = np.dstack([(d16 >> 8), (d16 & 255), np.zeros_like(d16)]).astype(np.uint8)
	Image.fromarray(depth_rgb, 'RGB').save(src.with_name(f'depth{name}.png'))
	normal_rgb = np.round((nrm * 0.5 + 0.5) * 255).astype(np.uint8)
	Image.fromarray(normal_rgb, 'RGB').save(src.with_name(f'normal{name}.png'))
	src.with_name(f'depth{name}.json').write_text(json.dumps({'maxDepth': hmax / W}, indent=2))
	print(f'{src.name}: max depth {hmax:.0f}px ({hmax / W:.3f} of width)')


if __name__ == '__main__':
	for p in sys.argv[1:]:
		main(p)
