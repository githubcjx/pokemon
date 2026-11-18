"""
AI 生图（Grsai 的 nano-banana / gpt-image 接口），用来补官方立绘里没有的动作。

接口文档：https://qmy27nhsd9.apifox.cn/452392911e0（nano-banana）、452409160e0（gpt-image）、452409577e0（异步结果查询）
提交 POST {base}/v1/api/generate（replyType=async）拿到任务 id，再轮询 GET {base}/v1/api/result?id=…，
成功后下载结果图。

API Key 依次从这些地方找：环境变量 GRSAI_API_KEY → 项目根目录 .env.local（GRSAI_API_KEY=sk-…）。

子命令（另有 poll <任务id> -o <路径>：超时后取回结果）：

  gen      生成。输出 PNG，旁边写同名 .json（模型、提示词、参数、任务 id、结果链接）。
           python tools/genimage.py gen "提示词" -r assets-src/charizard/006Charizard.png -s 16:9 -o <scratchpad>/charizard-fly.png
           python tools/genimage.py gen -f prompt.txt -n 3 -o <scratchpad>/charizard-fly.png   # 3 张：-1/-2/-3
           python tools/genimage.py gen "…" --dry-run                                          # 只打印请求体
  cutout   纯色背景抠成透明（按颜色距离给 alpha，反算边缘混色，再去掉描线外的背景色溢出），看效果用。
           python tools/genimage.py cutout <scratchpad>/charizard-fly.png --trim
  publish  选定的一张入库：不透明的先自动抠图，原图存 assets-src/<名字>/，缩到 1600px 放
           public/pokemon/<名字>/art-*.png，来源记进 public/pokemon/sources.json 的 ai_artworks，再跑 tools/depth3d.py。
           python tools/genimage.py publish <scratchpad>/charizard-fly.png --to public/pokemon/charizard/art-ai-fly.png --trim

模型（默认 nano-banana-2：目前唯一能稳定画宝可梦的）：
  gpt-image-2 / gpt-image-2.5           比例（"16:9"）或 1K 像素值；quality 只有 auto；不支持透明背景
  gpt-image-2-vip                       像素值；quality medium；支持透明
  gpt-image-2.5-flare                   像素值；quality low/medium/high；支持透明
  gpt-image-2.5-sunburst                像素值；quality low…max；支持透明
  nano-banana / -2 / -pro 等            同一接口；--size 只收比例（-2 系列另有 1:4 4:1 1:8 8:1），--res 1K/2K/4K；
                                        没有 quality，不支持透明
实测（2026-10-24）：gpt-image 系列会拦宝可梦——写名字、只描述外形、带官方立绘参考图都报 violation；
vip 开透明背景必失败（generate failed）；sunburst / flare 当时在维护。参考图用 PNG data URI 可以正常识别。

实测 nano-banana-2：带官方立绘参考图能画出新动作，造型配色准，但上色偏动画平涂、没有杉森建的水彩质感；
提示词只说"换个姿势"时它几乎照描原图，要写"完全不同的新姿势"并具体描述。nano-banana-pro 报 violation。

写提示词：参考图放官方立绘（--ref，可多张），写"只用参考图的造型、配色、线条和上色风格"，
具体描述新姿势和朝向；要求全身完整入画并留边；背景写 "flat solid pure green (#00FF00) background,
no text, no shadow"（草系等带绿色的宝可梦改用 #FF00FF 品红），出图后 publish 自动抠掉。
"""
import argparse
import base64
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BASES = {"global": "https://grsaiapi.com", "cn": "https://grsai.dakka.com.cn"}

PIXEL_MODELS = {"gpt-image-2-vip", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"}  # 只收像素值，支持透明
NANO_MODELS = {
	"nano-banana", "nano-banana-fast",
	"nano-banana-2", "nano-banana-2-cl", "nano-banana-2-2k-cl", "nano-banana-2-4k-cl", "nano-banana-2.1",
	"nano-banana-pro", "nano-banana-pro-vt", "nano-banana-pro-cl", "nano-banana-pro-vip", "nano-banana-pro-4k-vip",
}  # 只收比例，分辨率另用 imageSize；没有 quality / background
NANO_RATIOS = {"auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9"}
NANO2_RATIOS = {"1:4", "4:1", "1:8", "8:1"}  # nano-banana-2 系列额外支持
MODELS = {"gpt-image-2", "gpt-image-2.5"} | PIXEL_MODELS | NANO_MODELS
QUALITIES = {
	"gpt-image-2": ["auto"],
	"gpt-image-2.5": ["auto"],
	"gpt-image-2-vip": ["medium"],
	"gpt-image-2.5-flare": ["low", "medium", "high"],
	"gpt-image-2.5-sunburst": ["low", "medium", "high", "xhigh", "max"],
}
DEFAULT_QUALITY = {"gpt-image-2-vip": "medium", "gpt-image-2.5-flare": "high", "gpt-image-2.5-sunburst": "high"}
REF_MAX_PX = 1536  # 本地参考图编码前先缩到这个长边，免得请求体过大
PUBLISH_PX = 1600  # 与 public/pokemon/*/art*.png 一致

if hasattr(sys.stdout, "reconfigure"):
	sys.stdout.reconfigure(encoding="utf-8")
	sys.stderr.reconfigure(encoding="utf-8")


def log(*a):
	print(*a, flush=True)


def api_key() -> str:
	key = os.environ.get("GRSAI_API_KEY", "").strip()
	if key:
		return key
	env = ROOT / ".env.local"
	if env.exists():
		m = re.search(r"^\s*GRSAI_API_KEY\s*=\s*['\"]?(\S+?)['\"]?\s*$", env.read_text(encoding="utf-8"), re.M)
		if m:
			return m.group(1)
	sys.exit("找不到 API Key：设置环境变量 GRSAI_API_KEY，或在项目根目录 .env.local 写 GRSAI_API_KEY=sk-…")


def check_size(model: str, size: str):
	"""按文档的约束检查 aspectRatio；不合格直接退出，省一次失败的请求。"""
	if model in NANO_MODELS:
		ok = NANO_RATIOS | (NANO2_RATIOS if model.startswith("nano-banana-2") else set())
		if size not in ok:
			sys.exit(f"{model} 只收这些比例：{', '.join(sorted(ok))}（分辨率用 --res）")
		return
	if size == "auto":
		return
	m = re.fullmatch(r"(\d+)\s*x\s*(\d+)", size)
	if model in PIXEL_MODELS:
		if not m:
			sys.exit(f"{model} 只收像素值（如 2048x2048），不收比例 {size!r}")
		w, h = int(m[1]), int(m[2])
		problems = []
		if max(w, h) > 3840:
			problems.append("最长边 > 3840")
		if w % 16 or h % 16:
			problems.append("边长不是 16 的倍数")
		if max(w, h) / min(w, h) > 3:
			problems.append("长短边之比 > 3:1")
		if not 655_360 <= w * h <= 8_294_400:
			problems.append("总像素不在 655,360–8,294,400")
		if problems:
			sys.exit(f"尺寸 {size} 不合格：" + "；".join(problems))
	elif m:
		w, h = int(m[1]), int(m[2])
		if max(w, h) > 1920:
			log(f"提醒：{model} 只支持 1K 像素值，{size} 可能被拒")
	elif not re.fullmatch(r"\d+:\d+", size):
		sys.exit(f"尺寸 {size!r} 既不是比例也不是像素值")


def encode_image(src: str) -> str:
	"""URL 原样传；本地文件缩到 REF_MAX_PX 后转成 PNG 的 data URI（保留透明通道）。"""
	if re.match(r"https?://", src):
		return src
	p = Path(src)
	if not p.exists():
		sys.exit(f"找不到图片：{src}")
	im = Image.open(p)
	im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
	if max(im.size) > REF_MAX_PX:
		im.thumbnail((REF_MAX_PX, REF_MAX_PX), Image.LANCZOS)
	buf = io.BytesIO()
	im.save(buf, "PNG", optimize=True)
	return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def unwrap(d: dict) -> dict:
	"""文档里返回的是平铺的 {id, status, …}；万一套了一层 data 也能取到。"""
	if isinstance(d, dict) and "status" not in d and isinstance(d.get("data"), dict):
		return d["data"]
	return d


class Client:
	def __init__(self, base: str, key: str, timeout: float, interval: float):
		self.base = base
		self.timeout = timeout
		self.interval = interval
		self.s = requests.Session()
		self.s.headers.update({"Authorization": f"Bearer {key}", "Content-Type": "application/json"})

	def submit(self, body: dict) -> str:
		# 只在连不上（请求没发出去）时重试，免得重复扣费
		for attempt in range(3):
			try:
				r = self.s.post(f"{self.base}/v1/api/generate", json=body, timeout=120)
				break
			except requests.ConnectionError as e:
				if attempt == 2:
					raise
				log(f"  连接失败，重试：{e}")
				time.sleep(3)
		try:
			d = unwrap(r.json())
		except ValueError:
			raise RuntimeError(f"提交失败 HTTP {r.status_code}：{r.text[:500]}")
		if r.status_code != 200 or d.get("status") in ("failed", "violation") or not d.get("id"):
			raise RuntimeError(f"提交失败 HTTP {r.status_code}：{json.dumps(d, ensure_ascii=False)[:500]}")
		return d["id"]

	def wait(self, task_id: str, tag: str) -> dict:
		start = time.time()
		last = None
		while True:
			if time.time() - start > self.timeout:
				raise RuntimeError(f"{tag} 等待超时（{self.timeout:.0f}s），任务 id {task_id}，之后可用 poll 子命令取回")
			try:
				r = self.s.get(f"{self.base}/v1/api/result", params={"id": task_id}, timeout=60)
				d = unwrap(r.json())
			except (requests.RequestException, ValueError) as e:
				log(f"  {tag} 查询出错，继续等：{e}")
				time.sleep(self.interval)
				continue
			status = d.get("status")
			if status == "succeeded":
				return d
			if status in ("failed", "violation"):
				raise RuntimeError(f"{tag} {status}：{d.get('error') or ''}（任务 id {task_id}）")
			prog = d.get("progress")
			if prog != last:
				log(f"  {tag} {status} {prog if prog is not None else ''}%  {time.time() - start:.0f}s")
				last = prog
			time.sleep(self.interval)

	def download(self, url: str) -> bytes:
		for attempt in range(3):
			try:
				r = self.s.get(url, timeout=120, headers={"Authorization": None})
				r.raise_for_status()
				return r.content
			except requests.RequestException:
				if attempt == 2:
					raise
				time.sleep(3)


def save_result(data: bytes, out: Path, meta: dict):
	out.parent.mkdir(parents=True, exist_ok=True)
	im = Image.open(io.BytesIO(data))
	im.load()
	if im.mode not in ("RGB", "RGBA"):
		im = im.convert("RGBA")
	im.save(out, "PNG")
	alpha = "无透明通道"
	if im.mode == "RGBA":
		lo, _ = im.getchannel("A").getextrema()
		alpha = "背景透明" if lo < 255 else "有 alpha 但全不透明"
	meta = {**meta, "size": list(im.size), "alpha": alpha}
	out.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent="\t"), encoding="utf-8")
	log(f"  已保存 {out}  {im.size[0]}x{im.size[1]}  {alpha}")


def out_paths(out: Path, n: int) -> list[Path]:
	if out.suffix.lower() != ".png":
		out = out / "ai.png" if not out.suffix else out.with_suffix(".png")
	if n == 1:
		return [out]
	return [out.with_name(f"{out.stem}-{i + 1}.png") for i in range(n)]


def cmd_gen(a):
	prompt = Path(a.file).read_text(encoding="utf-8").strip() if a.file else (a.prompt or "")
	if not prompt:
		sys.exit("没有提示词：直接写在参数里，或用 -f 指定文件")
	if a.model not in MODELS:
		sys.exit(f"未知模型 {a.model}，可选：{', '.join(sorted(MODELS))}")
	nano = a.model in NANO_MODELS
	size = a.size or ("2048x2048" if a.model in PIXEL_MODELS else "1:1")
	check_size(a.model, size)
	if nano:
		quality = None
		if a.quality:
			log(f"提醒：{a.model} 没有 quality 参数，已忽略")
	else:
		quality = a.quality or DEFAULT_QUALITY.get(a.model, "auto")
		if quality not in QUALITIES[a.model]:
			sys.exit(f"{a.model} 的 quality 只能是 {QUALITIES[a.model]}")

	body = {
		"model": a.model,
		"prompt": prompt,
		"images": [encode_image(x) for x in a.ref],
		"aspectRatio": size,
		"replyType": "async",
	}
	if nano:
		body["imageSize"] = a.res
	else:
		body["quality"] = quality
	if a.model in PIXEL_MODELS and not a.opaque:
		body["background"] = "transparent"
	elif not a.opaque and not nano:
		log(f"提醒：{a.model} 不支持透明背景，出图会带底色")
	if a.mask:
		body["mask"] = encode_image(a.mask)

	shown = {**body, "images": [x if x.startswith("http") else f"<base64 {len(x) // 1024}KB>" for x in body["images"]]}
	if "mask" in body and not body["mask"].startswith("http"):
		shown["mask"] = f"<base64 {len(body['mask']) // 1024}KB>"
	if a.dry_run:
		log(json.dumps(shown, ensure_ascii=False, indent=2))
		return

	outs = out_paths(Path(a.out), a.n)
	client = Client(BASES[a.node], api_key(), a.timeout, a.interval)
	meta_base = {
		"model": a.model,
		"prompt": prompt,
		"refs": a.ref,
		"mask": a.mask,
		"aspectRatio": size,
		"quality": quality,
		"imageSize": body.get("imageSize"),
		"background": body.get("background"),
		"date": date.today().isoformat(),
	}

	def one(i: int):
		tag = f"[{i + 1}/{a.n}]"
		task_id = client.submit(body)
		log(f"  {tag} 已提交，任务 id {task_id}")
		d = client.wait(task_id, tag)
		urls = [r.get("url") for r in d.get("results") or [] if r.get("url")]
		if not urls:
			raise RuntimeError(f"{tag} 成功但没有结果链接：{d}")
		save_result(client.download(urls[0]), outs[i], {**meta_base, "task_id": task_id, "url": urls[0]})

	log(f"{a.model} · {size} · {a.res if nano else quality} · 参考图 {len(a.ref)} 张 · {a.n} 张")
	errors = []
	with ThreadPoolExecutor(max_workers=min(a.n, 4)) as pool:
		for f in [pool.submit(one, i) for i in range(a.n)]:
			try:
				f.result()
			except Exception as e:
				errors.append(str(e))
				log(f"  出错：{e}")
	if errors:
		sys.exit(f"{len(errors)}/{a.n} 张失败")


def chroma_key(im: Image.Image, key: str = "auto", lo: float = 60, hi: float = 150) -> Image.Image:
	"""纯色背景抠成透明：按与背景色的距离给 alpha，再把边缘混进来的背景色反算掉（F = (C - (1-α)K) / α）。
	背景色 auto 时取四边像素的中位数。整张图按颜色抠，所以翅膀和身体围出来的封闭空隙也会抠掉。"""
	rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
	if key == "auto":
		h, w, _ = rgb.shape
		b = max(2, min(h, w) // 100)
		border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3), rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
		k = np.median(border, axis=0)
	else:
		named = {"white": (255, 255, 255), "green": (0, 255, 0), "magenta": (255, 0, 255), "blue": (0, 0, 255)}
		k = np.array(named.get(key) or tuple(int(key.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)), dtype=np.float32)
	d = np.linalg.norm(rgb - k, axis=2)
	alpha = np.clip((d - lo) / (hi - lo), 0, 1)
	a = np.maximum(alpha, 1e-3)[..., None]
	fg = np.clip((rgb - (1 - a) * k) / a, 0, 255)
	# 描线与背景混出的暗色（如黑 + 绿 = 暗绿）离背景色够远、会被当成不透明：
	# 在主体边缘一圈里，把背景主色那个通道压到不超过另两个通道（白底没有主色，跳过）
	ch = int(np.argmax(k))
	if k[ch] - np.sort(k)[1] > 80:
		band = max(3, min(rgb.shape[:2]) // 400)
		near = Image.fromarray(((alpha < 1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(band * 2 + 1))
		near = np.asarray(near) > 0
		others = np.delete(fg, ch, axis=2).max(axis=2)
		fg[..., ch] = np.where(near, np.minimum(fg[..., ch], others), fg[..., ch])
	fg[alpha <= 0] = 0
	out = np.dstack([fg, alpha * 255]).round().astype(np.uint8)
	log(f"  抠图：背景色 {tuple(int(x) for x in k)}，透明 {np.mean(alpha <= 0):.0%}，半透明边缘 {np.mean((alpha > 0) & (alpha < 1)):.1%}")
	return Image.fromarray(out, "RGBA")


def trim(im: Image.Image, pad: float = 0.03) -> Image.Image:
	"""裁到不透明区域的包围盒，四周留 pad（占长边的比例）。"""
	box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
	if not box:
		return im
	p = round(max(box[2] - box[0], box[3] - box[1]) * pad)
	return im.crop((max(0, box[0] - p), max(0, box[1] - p), min(im.width, box[2] + p), min(im.height, box[3] + p)))


def cmd_cutout(a):
	im = Image.open(a.src)
	out = chroma_key(im, a.key)
	if a.trim:
		out = trim(out)
	dest = Path(a.out) if a.out else Path(a.src).with_name(Path(a.src).stem + "-cut.png")
	out.save(dest, "PNG")
	log(f"已保存 {dest}  {out.size[0]}x{out.size[1]}")


def cmd_poll(a):
	"""超时或中断后，凭任务 id 把结果取回来。"""
	client = Client(BASES[a.node], api_key(), a.timeout, a.interval)
	d = client.wait(a.id, a.id)
	url = d["results"][0]["url"]
	save_result(client.download(url), Path(a.out), {"task_id": a.id, "url": url, "date": date.today().isoformat()})


def cmd_publish(a):
	src = Path(a.src).resolve()
	dest = Path(a.to)
	dest = (dest if dest.is_absolute() else ROOT / dest).resolve()
	pub = ROOT / "public" / "pokemon"
	try:
		rel = dest.relative_to(pub)
	except ValueError:
		sys.exit(f"--to 要在 public/pokemon/<名字>/ 下面：{dest}")
	if len(rel.parts) != 2 or not rel.name.startswith("art") or rel.suffix != ".png":
		sys.exit("--to 的格式是 public/pokemon/<名字>/art-<说明>.png")
	name = rel.parts[0]
	meta_src = src.with_suffix(".json")
	meta = json.loads(meta_src.read_text(encoding="utf-8")) if meta_src.exists() else {}

	# 原图进 assets-src/<名字>/，文件名跟发布名对应
	orig_dir = ROOT / "assets-src" / name
	orig_dir.mkdir(parents=True, exist_ok=True)
	orig = orig_dir / f"{dest.stem}.png"
	if src != orig:
		shutil.copy2(src, orig)
		if meta:
			orig.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent="\t"), encoding="utf-8")

	im = Image.open(orig)
	has_alpha = im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 255
	if not has_alpha and a.key != "none":
		im = chroma_key(im, a.key)
	im = im.convert("RGBA")
	if a.trim:
		im = trim(im)
	if max(im.size) > PUBLISH_PX:
		im.thumbnail((PUBLISH_PX, PUBLISH_PX), Image.LANCZOS)
	dest.parent.mkdir(parents=True, exist_ok=True)
	im.save(dest, "PNG")
	log(f"已发布 {dest.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}（原图 {orig.relative_to(ROOT)}）")

	sources = pub / "sources.json"
	d = json.loads(sources.read_text(encoding="utf-8"))
	ai = d.setdefault("ai_artworks", {})
	ai[rel.as_posix()] = {
		"via": f"AI 生成（Grsai {meta.get('model', '?')}）",
		"original": orig.relative_to(ROOT).as_posix(),
		"prompt": meta.get("prompt"),
		"refs": meta.get("refs"),
		"task_id": meta.get("task_id"),
		"date": meta.get("date"),
	}
	sources.write_text(json.dumps(d, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
	log(f"已记入 sources.json 的 ai_artworks：{rel.as_posix()}")

	if not a.no_depth:
		subprocess.run([sys.executable, str(ROOT / "tools" / "depth3d.py"), str(dest)], check=True, cwd=ROOT)


def main():
	ap = argparse.ArgumentParser(description="Grsai gpt-image 生图")
	sub = ap.add_subparsers(dest="cmd", required=True)

	def common(p):
		p.add_argument("--node", choices=BASES, default="global", help="接口节点：global 全球 / cn 国内")
		p.add_argument("--timeout", type=float, default=900, help="每张最长等待秒数")
		p.add_argument("--interval", type=float, default=4, help="轮询间隔秒数")

	g = sub.add_parser("gen", help="生成图片")
	g.add_argument("prompt", nargs="?", help="提示词")
	g.add_argument("-f", "--file", help="从文件读提示词（UTF-8）")
	g.add_argument("-r", "--ref", action="append", default=[], help="参考图：本地路径或 URL，可重复")
	g.add_argument("--mask", help="蒙版：本地路径或 URL")
	g.add_argument("-m", "--model", default="nano-banana-2")
	g.add_argument("-s", "--size", help="aspectRatio：像素值如 2048x2048，或比例如 16:9（仅 gpt-image-2/2.5）")
	g.add_argument("-q", "--quality", help="默认 sunburst/flare 为 high，vip 为 medium，其余 auto（nano-banana 没有）")
	g.add_argument("--res", choices=["1K", "2K", "4K"], default="2K", help="nano-banana 的 imageSize")
	g.add_argument("--opaque", action="store_true", help="不要透明背景")
	g.add_argument("-n", type=int, default=1, help="生成几张（并行，各自独立扣费）")
	g.add_argument("-o", "--out", default=str(ROOT / "out" / "ai" / "ai.png"), help="输出 PNG 路径（多张时加 -1/-2…）")
	g.add_argument("--dry-run", action="store_true", help="只打印请求体，不调用接口")
	common(g)
	g.set_defaults(func=cmd_gen)

	p = sub.add_parser("poll", help="凭任务 id 取回结果")
	p.add_argument("id")
	p.add_argument("-o", "--out", required=True)
	common(p)
	p.set_defaults(func=cmd_poll)

	pb = sub.add_parser("publish", help="把选定的图入库到 assets-src / public/pokemon，并生成深度图")
	pb.add_argument("src", help="gen 生成的 PNG")
	pb.add_argument("--to", required=True, help="public/pokemon/<名字>/art-<说明>.png")
	pb.add_argument("--no-depth", action="store_true", help="不跑 depth3d.py")
	pb.add_argument("--key", default="auto", help="原图不透明时抠掉的背景色：auto（取四边）/ green / white / magenta / #rrggbb / none")
	pb.add_argument("--trim", action="store_true", help="裁到主体包围盒，留 3% 边")
	pb.set_defaults(func=cmd_publish)

	c = sub.add_parser("cutout", help="纯色背景抠成透明（看效果用，publish 会自动做）")
	c.add_argument("src")
	c.add_argument("-o", "--out", help="默认 <原名>-cut.png")
	c.add_argument("--key", default="auto", help="auto / green / white / magenta / #rrggbb")
	c.add_argument("--trim", action="store_true")
	c.set_defaults(func=cmd_cutout)

	a = ap.parse_args()
	a.func(a)


if __name__ == "__main__":
	main()
