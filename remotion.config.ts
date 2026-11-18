import {Config} from '@remotion/cli/config';

Config.setOverwriteOutput(true);
// WebGL 着色器走 GPU（ANGLE），避免软件渲染过慢
Config.setChromiumOpenGlRenderer('angle');
// 画质优先：中间帧不做有损压缩损失，编码用低 CRF + 慢速预设
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setCrf(16);
Config.setX264Preset('slow');
