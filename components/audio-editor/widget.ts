import type { MenuConfig } from "../bundle/menu-manager";


const AUDIO_EFFECTS_MENU: MenuConfig[] = [
	{ name: "Gain", target: "effects/gain", iconClass: "bx bx-volume-full" },
	{ name: "Fade In", target: "effects/fade_in", iconClass: "bx bx-chart-trend" },
	{ name: "Fade Out", target: "effects/fade_out", iconClass: "bx bx-trending-down" },
	{ name: "Noise Reduction (Voice)", target: "effects/noise_reduction", iconClass: "bx bx-noise" },
	{ name: "Paragraphic EQ", target: "effects/paragraphic_eq", iconClass: "bx bx-equalizer" },
	{ name: "Compressor", target: "effects/compressor", iconClass: "bx bx-vertical-spacing" },
	{ name: "Normalize", target: "effects/normalize", iconClass: "bx bx-line-spacing" },
	{ name: "Graphic EQ", target: "effects/graphic_eq_10", iconClass: "bx bx-bar-chart" },
	{ name: "Graphic EQ (20 bands)", target: "effects/graphic_eq_20", iconClass: "bx bx-equalizer" },
	{ name: "Hard Limiter", target: "effects/hard_limiter", iconClass: "bx bx-minus-front" },
	{ name: "Delay", target: "effects/delay", iconClass: "bx bx-history" },
	{ name: "Distortion", target: "effects/distortion", iconClass: "bx bx-pulse" },
	{ name: "Reverb", target: "effects/reverb", iconClass: "bx bx-broadcast" },
	{ name: "Audio Repair", target: "effects/audio_repair", iconClass: "bx bx-wrench" },
	{ name: "Speed Up / Slow Down (pitch)", target: "effects/speed_pitch", iconClass: "bx bx-timer" },
	{ name: "Speed / Playback Rate", target: "effects/playback_rate", iconClass: "bx bx-tachometer" },
	{ name: "Reverse", target: "effects/reverse", iconClass: "bx bx-undo" },
	{ name: "Invert", target: "effects/invert", iconClass: "bx bx-invert" },
	{ name: "Remove Silence", target: "effects/remove_silence", iconClass: "bx bx-volume-mute" }
];


const AUDIO_VIEW_MENU: MenuConfig[] = [{
	name: "Follow Cursor",
	target: "view/follow_cursor",
	iconClass: "bx bx-cursor-pointer"
}, {
	name: "Peak Separators",
	target: "view/peak_separators",
	iconClass: "bx bx-grid-lines"
}, {
	name: "Timeline",
	target: "view/timeline",
	iconClass: "bx bx-timeline"
}, {
	divider: true
}, {
	name: "Frequency Analyser",
	target: "view/frequency_analyser",
	iconClass: "bx bx-waveform"
}, {
	name: "Spectrum Analyser",
	target: "view/spectrum_analyser",
	iconClass: "bx bx-bar-chart"
}, {
	name: "Multitrack Mixer",
	target: "view/multitrack_mixer",
	iconClass: "bx bx-equalizer"
}, {
	name: "Tempo Tools",
	target: "view/tempo_tools",
	iconClass: "bx bx-timer"
}, {
	name: "ID3 Tags",
	target: "view/id3_tags",
	iconClass: "bx bx-tag"
}, {
	divider: true
}, {
	name: "Center to Cursor",
	shortcut: "Tab",
	target: "view/center_to_cursor",
	iconClass: "bx bx-horizontal-center"
}, {
	name: "Reset Zoom",
	shortcut: "0",
	target: "view/reset_zoom",
	iconClass: "bx bx-refresh"
}];

const AUDIO_EDIT_MENU: MenuConfig[] = [{
	name: "Play",
	shortcut: "Space",
	target: "edit/play",
	iconClass: "bx bx-play"
}, {
	name: "Stop",
	target: "edit/stop",
	iconClass: "bx bx-stop"
}, {
	name: "Channel Info/Flip",
	target: "edit/channel_info_flip",
	iconClass: "bx bx-reflect-vertical"
}, {
	name: "Seamless Loop",
	target: "edit/seamless_loop",
	iconClass: "bx bx-repeat"
}, {
	name: "Zero Cross Selection",
	target: "edit/zero_cross_selection"
}];


