
import type { MenuConfig } from '../bundle/menu-manager';

export const IMAGE_MENU: MenuConfig = {
	name: "Image",
	iconClass: "bx bx-image",
	children: [{
		name: "Information",
		shortcut: "I",
		ellipsis: true,
		target: "image/information.information",
		iconClass: "bx bx-info-circle"
	}, {
		name: "Canvas Size",
		ellipsis: true,
		target: "image/size.size",
		iconClass: "bx bx-frame"
	}, {
		name: "Trim",
		ellipsis: true,
		shortcut: "T",
		target: "image/trim.trim",
		iconClass: "bx bx-shape-trim"
	}, {
		divider: true
	}, {
		name: "Resize",
		ellipsis: true,
		shortcut: "R",
		target: "image/resize.resize",
		iconClass: "bx bx-area"
	}, {
		name: "Rotate",
		ellipsis: true,
		target: "image/rotate.rotate",
		iconClass: "bx bx-rotate-cw"
	}, {
		name: "Flip",
		iconClass: "bx bx-reflect-vertical",
		children: [{
			name: "Vertical",
			target: "image/flip.vertical",
			iconClass: "bx bx-reflect-vertical"
		}, {
			name: "Horizontal",
			target: "image/flip.horizontal",
			iconClass: "bx bx-reflect-horizontal"
		}]
	}, {
		name: "Translate",
		ellipsis: true,
		target: "image/translate.translate",
		iconClass: "bx bx-move"
	}, {
		name: "Opacity",
		ellipsis: true,
		target: "image/opacity.opacity",
		iconClass: "bx bx-brightness-half"
	}, {
		divider: true
	}, {
		name: "Color Corrections",
		ellipsis: true,
		target: "image/color_corrections.color_corrections",
		iconClass: "bx bx-slider"
	}, {
		name: "Auto Adjust Colors",
		shortcut: "F",
		target: "image/auto_adjust.auto_adjust",
		iconClass: "bx bx-magic-wand"
	}, {
		name: "Decrease Color Depth",
		target: "image/decrease_colors.decrease_colors",
		iconClass: "bx bx-layer-minus-alt"
	}, {
		name: "Color Palette",
		ellipsis: true,
		target: "image/palette.palette",
		iconClass: "bx bx-palette"
	}, {
		divider: true
	}, {
		name: "Histogram",
		ellipsis: true,
		target: "image/histogram.histogram",
		iconClass: "bx bx-bar-chart-square"
	}]
};


export const LAYER_MENU: MenuConfig = {
	name: "Layer",
	iconClass: "bx bx-layers",
	children: [{
		name: "New",
		shortcut: "N",
		target: "layer/new.new",
		iconClass: "bx bx-file-plus"
	}, {
		name: "New from Selection",
		target: "layer/new.new_selection",
		iconClass: "bx bx-copy-plus"
	}, {
		divider: true
	}, {
		name: "Duplicate",
		shortcut: "D",
		target: "layer/duplicate.duplicate",
		iconClass: "bx bx-copy"
	}, {
		name: "Show / Hide",
		target: "layer/visibility.toggle",
		iconClass: "bx bx-eye-slash"
	}, {
		name: "Delete",
		target: "layer/delete.delete",
		iconClass: "bx bx-trash"
	}, {
		name: "Convert to Raster",
		target: "layer/raster.raster",
		iconClass: "bx bx-image"
	}, {
		divider: true
	}, {
		name: "Move",
		iconClass: "bx bx-move",
		children: [{
			name: "Up",
			target: "layer/move.up",
			iconClass: "bx bx-arrow-up"
		}, {
			name: "Down",
			target: "layer/move.down",
			iconClass: "bx bx-arrow-down"
		}]
	}, {
		name: "Composition",
		ellipsis: true,
		target: "layer/composition.composition",
		iconClass: "bx bx-component"
	}, {
		name: "Rename",
		ellipsis: true,
		target: "layer/rename.rename",
		iconClass: "bx bx-rename"
	}, {
		name: "Clear",
		target: "layer/clear.clear",
		iconClass: "bx bx-x-square"
	}, {
		divider: true
	}, {
		name: "Differences Down",
		target: "layer/differences.differences",
		iconClass: "bx bx-compare"
	}, {
		name: "Merge Down",
		target: "layer/merge.merge",
		iconClass: "bx bx-merge"
	}, {
		name: "Flatten Image",
		target: "layer/flatten.flatten",
		iconClass: "bx bx-layers-minus-alt"
	}]
};


export const EFFECTS_MENU: MenuConfig = {
	name: "Effects",
	iconClass: "bx bx-magic-wand",
	children: [{
		name: "Effect browser",
		ellipsis: true,
		target: "effects/browser.browser",
		iconClass: "bx bx-search-alt"
	}, {
		divider: true
	}, {
		name: "Common Filters",
		iconClass: "bx bx-filter",
		children: [{
			name: "Gaussian Blur",
			ellipsis: true,
			target: "effects/common/blur.blur",
			iconClass: "bx bx-blur"
		}, {
			name: "Brightness",
			ellipsis: true,
			target: "effects/common/brightness.brightness",
			iconClass: "bx bx-sun"
		}, {
			name: "Contrast",
			ellipsis: true,
			target: "effects/common/contrast.contrast",
			iconClass: "bx bx-contrast"
		}, {
			name: "Grayscale",
			ellipsis: true,
			target: "effects/common/grayscale.grayscale",
			iconClass: "bx bx-circle-half"
		}, {
			name: "Hue Rotate",
			ellipsis: true,
			target: "effects/common/hue-rotate.hue_rotate",
			iconClass: "bx bx-refresh"
		}, {
			name: "Negative",
			ellipsis: true,
			target: "effects/common/invert.invert",
			iconClass: "bx bx-invert"
		}, {
			name: "Saturate",
			ellipsis: true,
			target: "effects/common/saturate.saturate",
			iconClass: "bx bx-sun-bright"
		}, {
			name: "Sepia",
			ellipsis: true,
			target: "effects/common/sepia.sepia",
			iconClass: "bx bx-color-fill"
		}, {
			name: "Shadow",
			ellipsis: true,
			target: "effects/common/shadow.shadow",
			iconClass: "bx bx-inner-shadow"
		}]
	}, {
		name: "Instagram Filters",
		iconClass: "bx bx-photo-album",
		children: [{
			name: "1977",
			target: "effects/instagram/1977.1977",
			iconClass: "bx bx-image"
		}, {
			name: "Aden",
			target: "effects/instagram/aden.aden",
			iconClass: "bx bx-image"
		}, {
			name: "Clarendon",
			target: "effects/instagram/clarendon.clarendon",
			iconClass: "bx bx-image"
		}, {
			name: "Gingham",
			target: "effects/instagram/gingham.gingham",
			iconClass: "bx bx-image"
		}, {
			name: "Inkwell",
			target: "effects/instagram/inkwell.inkwell",
			iconClass: "bx bx-image"
		}, {
			name: "Lo-fi",
			target: "effects/instagram/lofi.lofi",
			iconClass: "bx bx-image"
		}, {
			name: "Toaster",
			target: "effects/instagram/toaster.toaster",
			iconClass: "bx bx-image"
		}, {
			name: "Valencia",
			target: "effects/instagram/valencia.valencia",
			iconClass: "bx bx-image"
		}, {
			name: "X-Pro II",
			target: "effects/instagram/xpro2.xpro2",
			iconClass: "bx bx-image"
		}]
	}, {
		name: "Black and White",
		ellipsis: true,
		target: "effects/black_and_white.black_and_white",
		iconClass: "bx bx-circle-half"
	}, {
		name: "Borders",
		ellipsis: true,
		target: "effects/borders.borders",
		iconClass: "bx bx-border-outer"
	}, {
		name: "Blueprint",
		target: "effects/blueprint.blueprint",
		iconClass: "bx bx-article"
	}, {
		name: "Box Blur",
		ellipsis: true,
		target: "effects/box_blur.box_blur",
		iconClass: "bx bx-blur"
	}, {
		name: "Denoise",
		ellipsis: true,
		target: "effects/denoise.denoise",
		iconClass: "bx bx-noise"
	}, {
		name: "Dither",
		ellipsis: true,
		target: "effects/dither.dither",
		iconClass: "bx bx-grid"
	}, {
		name: "Dot Screen",
		ellipsis: true,
		target: "effects/dot_screen.dot_screen",
		iconClass: "bx bx-dot-screen"
	}, {
		name: "Edge",
		target: "effects/edge.edge",
		iconClass: "bx bx-border-radius"
	}, {
		name: "Emboss",
		target: "effects/emboss.emboss",
		iconClass: "bx bx-cube"
	}, {
		name: "Enrich",
		ellipsis: true,
		target: "effects/enrich.enrich",
		iconClass: "bx bx-sparkles"
	}, {
		name: "Grains",
		ellipsis: true,
		target: "effects/grains.grains",
		iconClass: "bx bx-noise"
	}, {
		name: "Heatmap",
		target: "effects/heatmap.heatmap",
		iconClass: "bx bx-heatmap"
	}, {
		name: "Mosaic",
		ellipsis: true,
		target: "effects/mosaic.mosaic",
		iconClass: "bx bx-grid-9"
	}, {
		name: "Night Vision",
		target: "effects/night_vision.night_vision",
		iconClass: "bx bx-eye"
	}, {
		name: "Oil",
		ellipsis: true,
		target: "effects/oil.oil",
		iconClass: "bx bx-brush"
	}, {
		name: "Pencil",
		target: "effects/pencil.pencil",
		iconClass: "bx bx-pencil"
	}, {
		name: "Sharpen",
		ellipsis: true,
		target: "effects/sharpen.sharpen",
		iconClass: "bx bx-triangle"
	}, {
		name: "Solarize",
		target: "effects/solarize.solarize",
		iconClass: "bx bx-sun-bright"
	}, {
		name: "Tilt Shift",
		ellipsis: true,
		target: "effects/tilt_shift.tilt_shift",
		iconClass: "bx bx-slider-vertical"
	}, {
		name: "Vignette",
		ellipsis: true,
		target: "effects/vignette.vignette",
		iconClass: "bx bx-vignette"
	}, {
		name: "Vibrance",
		ellipsis: true,
		target: "effects/vibrance.vibrance",
		iconClass: "bx bx-sun-bright"
	}, {
		name: "Vintage",
		ellipsis: true,
		target: "effects/vintage.vintage",
		iconClass: "bx bx-history"
	}, {
		name: "Zoom Blur",
		ellipsis: true,
		target: "effects/zoom_blur.zoom_blur",
		iconClass: "bx bx-blur"
	}]
};



export const TOOLS_MENU: MenuConfig = {
	name: "Tools",
	iconClass: "bx bx-wrench",
	children: [{
		name: "Sprites",
		target: "tools/sprites.sprites",
		iconClass: "bx bx-images"
	}, {
		name: "Key-Points",
		target: "tools/keypoints.keypoints",
		iconClass: "bx bx-vector-triangle"
	}, {
		name: "Content Fill",
		ellipsis: true,
		target: "tools/content_fill.content_fill",
		iconClass: "bx bx-paint"
	}, {
		divider: true
	}, {
		name: "Color Zoom",
		ellipsis: true,
		target: "tools/color_zoom.color_zoom",
		iconClass: "bx bx-search-plus"
	}, {
		name: "Replace Color",
		ellipsis: true,
		target: "tools/replace_color.replace_color",
		iconClass: "bx bx-refresh"
	}, {
		name: "Restore Alpha",
		ellipsis: true,
		target: "tools/restore_alpha.restore_alpha",
		iconClass: "bx bx-transparency"
	}, {
		name: "External",
		iconClass: "bx bx-link-external",
		children: [{
			name: "TINYPNG - Compress PNG and JPEG",
			href: "https://tinypng.com",
			iconClass: "bx bx-export"
		}, {
			name: "REMOVE.BG - Remove Image Background",
			href: "https://www.remove.bg",
			iconClass: "bx bx-image-no-background"
		}, {
			name: "PNGTOSVG - Convert Image to SVG",
			href: "https://www.pngtosvg.com",
			iconClass: "bx bx-vector"
		}, {
			name: "SQUOOSH - Compress and Compare Images",
			href: "https://squoosh.app",
			iconClass: "bx bx-compare"
		}]
	}, {
		divider: true
	}, {
		name: "Language",
		iconClass: "bx bx-translate",
		children: [{
			name: "English",
			target: "tools/translate.translate",
			parameter: "en",
			iconClass: "bx bx-globe"
		}, {
			divider: true
		}, {
			name: "عربي",
			target: "tools/translate.translate",
			parameter: "ar",
			iconClass: "bx bx-globe"
		}, {
			name: "简体中文",
			target: "tools/translate.translate",
			parameter: "zh",
			iconClass: "bx bx-globe"
		}, {
			name: "Deutsch",
			target: "tools/translate.translate",
			parameter: "de",
			iconClass: "bx bx-globe"
		}, {
			name: "Dutch",
			target: "tools/translate.translate",
			parameter: "nl",
			iconClass: "bx bx-globe"
		}, {
			name: "English (UK)",
			target: "tools/translate.translate",
			parameter: "uk",
			iconClass: "bx bx-globe"
		}, {
			name: "Español",
			target: "tools/translate.translate",
			parameter: "es",
			iconClass: "bx bx-globe"
		}, {
			name: "Français",
			target: "tools/translate.translate",
			parameter: "fr",
			iconClass: "bx bx-globe"
		}, {
			name: "Greek",
			target: "tools/translate.translate",
			parameter: "el",
			iconClass: "bx bx-globe"
		}, {
			name: "Italiano",
			target: "tools/translate.translate",
			parameter: "it",
			iconClass: "bx bx-globe"
		}, {
			name: "日本語",
			target: "tools/translate.translate",
			parameter: "ja",
			iconClass: "bx bx-globe"
		}, {
			name: "한국어",
			target: "tools/translate.translate",
			parameter: "ko",
			iconClass: "bx bx-globe"
		}, {
			name: "Lietuvių",
			target: "tools/translate.translate",
			parameter: "lt",
			iconClass: "bx bx-globe"
		}, {
			name: "Português",
			target: "tools/translate.translate",
			parameter: "pt",
			iconClass: "bx bx-globe"
		}, {
			name: "русский язык",
			target: "tools/translate.translate",
			parameter: "ru",
			iconClass: "bx bx-globe"
		}, {
			name: "Türkçe",
			target: "tools/translate.translate",
			parameter: "tr",
			iconClass: "bx bx-globe"
		}]
	}, {
		name: "Search",
		shortcut: "F3",
		ellipsis: true,
		target: "tools/search.search",
		iconClass: "bx bx-search"
	}, {
		name: "Settings",
		ellipsis: true,
		target: "tools/settings.settings",
		iconClass: "bx bx-cog"
	}, {
		divider: true
	}, {
		name: "Create Scene",
		target: "project/create_scene",
		iconClass: "bx bx-plus-circle"
	}, {
		name: "Execute Script",
		target: "project/execute_script",
		iconClass: "bx bx-code"
	}]
};

