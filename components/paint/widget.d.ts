import type { MiniPaintApp, PaintWidget } from "./widget";

export interface PaintWindow
{
	initializeMiniPaint?: (targetNode?: HTMLElement | null) => MiniPaintApp;
	PaintWidget: typeof PaintWidget;
}
