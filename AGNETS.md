请阅读CLAUDE.md文件

本地 TypeScript 校验：`npx tsc --noEmit`。当前 `package.json` 没有单独的测试脚本。

Windows PowerShell 通过管道执行 Node/Python 内联脚本时，中文路径可能被替换成 `?`。涉及中文输出目录时，使用 UTF-8 脚本文件或 Unicode 转义，避免直接把中文写入管道中的脚本文本。

Windows 本项目依赖内附 FFmpeg / FFprobe：`node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`、`ffprobe.exe`，不一定在 PATH 中。内附 FFmpeg 是精简构建，不含 `ebur128` 滤镜；音频格式和时长用 FFprobe，真峰值可用现有 SciPy 的 `resample_poly` 过采样检查。