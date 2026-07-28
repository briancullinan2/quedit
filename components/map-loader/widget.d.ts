import type { FrameRater } from "../bundle/frame-rater";
import type { TojiWidget } from "./widget";


export interface TojiWindow
{
	moveLookLocked?: (mx: number, my: number) => void;
	playerMover?: { jump: () => void; };
	tojiFrameLimiter: FrameRater;
	TojiWidget: typeof TojiWidget;
}
