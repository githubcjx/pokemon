"""
把 28 种未知图腾的立绘打包成图集，供 UnownWall 在一个 WebGL 画布里成群绘制（浏览器的 WebGL 上下文数量有限，
不能每只都用一个 PokemonArt3D）。纯算法处理，不改动立绘像素。

输入：public/pokemon/unown/art-<形态>.png 与 depth3d.py 生成的 normal-<形态>.png
输出（同目录）：
  atlas-art.png     立绘图集（直通 alpha）
  atlas-normal.png  法线图集
  atlas-eye.png     眼睛遮罩：R = 眼白 + 瞳孔（睁眼动画用），G = 立绘明度（备用）
  atlas.json        格子尺寸、形态顺序、每只眼睛的中心与半径（格子内 0..1 坐标）

用法：python tools/unown_atlas.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path('public/pokemon/unown')
FORMS = [*'abcdefghijklmnopqrstuvwxyz', 'ex', 'qu']
CELL = 400
COLS = 7


def fill_holes(mask: np.ndarray) -> np.ndarray:
	"""填掉 mask 里被包围的空洞（瞳孔）：从边框出发泛洪"非 mask"区域，没被泛洪到的就是空洞。"""
	h, w = mask.shape
	outside = np.zeros_like(mask)
	outside[0, :] = ~mask[0, :]
	outside[-1, :] = ~mask[-1, :]
	outside[:, 0] = ~mask[:, 0]
	outside[:, -1] = ~mask[:, -1]
	free = ~mask
	while True:
		p = np.pad(outside, 1)
		grown = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & free
		if (grown == outside).all():
			return mask | ~outside
		outside = grown


def largest_component(mask: np.ndarray) -> np.ndarray:
	"""保留最大的连通块（眼白），去掉高光等零碎亮点。"""
	h, w = mask.shape
	label = np.zeros((h, w), np.int32)
	best, best_n, cur = 0, 0, 0
	for y0, x0 in zip(*np.nonzero(mask)):
		if label[y0, x0]:
			continue
		cur += 1
		stack = [(y0, x0)]
		label[y0, x0] = cur
		n = 0
		while stack:
			y, x = stack.pop()
			n += 1
			for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
				yy, xx = y + dy, x + dx
				if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not label[yy, xx]:
					label[yy, xx] = cur
					stack.append((yy, xx))
		if n > best_n:
			best, best_n = cur, n
	return label == best


def main() -> None:
	rows = (len(FORMS) + COLS - 1) // COLS
	art_atlas = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
	nrm_atlas = Image.new('RGB', (COLS * CELL, rows * CELL), (128, 128, 255))
	eye_atlas = Image.new('RGB', (COLS * CELL, rows * CELL), (0, 0, 0))
	eyes = {}
	for i, form in enumerate(FORMS):
		art = Image.open(DIR / f'art-{form}.png').convert('RGBA').resize((CELL, CELL), Image.LANCZOS)
		nrm = Image.open(DIR / f'normal-{form}.png').convert('RGB').resize((CELL, CELL), Image.LANCZOS)
		a = np.asarray(art).astype(np.float32) / 255
		lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])
		bright = (lum > 0.72) & (a[..., 3] > 0.5)
		sclera = largest_component(bright)
		eye = fill_holes(sclera)
		ys, xs = np.nonzero(eye)
		cx, cy = xs.mean() / CELL, ys.mean() / CELL
		r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 / CELL
		eyes[form] = {'cx': round(float(cx), 4), 'cy': round(float(cy), 4), 'r': round(float(r), 4)}
		# 遮罩边缘柔化一点，避免睁眼时出现锯齿
		eye_img = Image.fromarray((eye * 255).astype(np.uint8)).resize((CELL * 2, CELL * 2), Image.BILINEAR).resize((CELL, CELL), Image.LANCZOS)
		lum_img = Image.fromarray((lum * a[..., 3] * 255).astype(np.uint8))
		ox, oy = (i % COLS) * CELL, (i // COLS) * CELL
		art_atlas.paste(art, (ox, oy))
		nrm_atlas.paste(nrm, (ox, oy))
		eye_atlas.paste(Image.merge('RGB', (eye_img, lum_img, Image.new('L', (CELL, CELL), 0))), (ox, oy))
		print(f'{form}: eye at ({cx:.3f}, {cy:.3f}) r={r:.3f}')
	art_atlas.save(DIR / 'atlas-art.png')
	nrm_atlas.save(DIR / 'atlas-normal.png')
	eye_atlas.save(DIR / 'atlas-eye.png')
	(DIR / 'atlas.json').write_text(
		json.dumps({'cell': CELL, 'cols': COLS, 'rows': rows, 'forms': FORMS, 'eyes': eyes}, indent='\t'), encoding='utf-8'
	)


RELIEFS = ['kabuto', 'omanyte', 'aerodactyl', 'ho-oh']
RELIEF_CELL = 800


def relief_atlas() -> None:
	"""阿露福遗迹四块拼图上的宝可梦（化石盔、菊石兽、化石翼龙、凤王），2×2 图集，供石板浮雕使用。"""
	art_atlas = Image.new('RGBA', (2 * RELIEF_CELL, 2 * RELIEF_CELL), (0, 0, 0, 0))
	nrm_atlas = Image.new('RGB', (2 * RELIEF_CELL, 2 * RELIEF_CELL), (128, 128, 255))
	for i, name in enumerate(RELIEFS):
		src = Path('public/pokemon') / name
		ox, oy = (i % 2) * RELIEF_CELL, (i // 2) * RELIEF_CELL
		art_atlas.paste(Image.open(src / 'art.png').convert('RGBA').resize((RELIEF_CELL, RELIEF_CELL), Image.LANCZOS), (ox, oy))
		nrm_atlas.paste(Image.open(src / 'normal.png').convert('RGB').resize((RELIEF_CELL, RELIEF_CELL), Image.LANCZOS), (ox, oy))
	art_atlas.save(DIR / 'relief-art.png')
	nrm_atlas.save(DIR / 'relief-normal.png')
	print('relief atlas:', RELIEFS)


if __name__ == '__main__':
	main()
	relief_atlas()
