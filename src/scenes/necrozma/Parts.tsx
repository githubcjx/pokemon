import {NECROZMA_TOTAL_FRAMES, SEG_START} from './continuity';
import {SegmentWindow} from './SegmentWindow';

// 分三个文件交付：第一部分第 1–3 段（另一个世界）、第二部分第 4–6 段（黑暗、牢塔、古书）、第三部分第 7–9 段（再临、究极爆发、尾声）
export const NECROZMA_PART1_FRAMES = SEG_START.dark;
export const NECROZMA_PART2_FRAMES = SEG_START.return - SEG_START.dark;
export const NECROZMA_PART3_FRAMES = NECROZMA_TOTAL_FRAMES - SEG_START.return;
export {NECROZMA_TOTAL_FRAMES};

export const NecrozmaPart1: React.FC = () => <SegmentWindow seg="hook" />;
export const NecrozmaPart2: React.FC = () => <SegmentWindow seg="dark" />;
export const NecrozmaPart3: React.FC = () => <SegmentWindow seg="return" />;
export const NecrozmaEpisode: React.FC = () => <SegmentWindow seg="hook" />;
