import type { SettingConfig } from '../bundle/settings';


const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {

	paint: {
		transparency: {
			key: 'paint_transparency',
			default: true,
			elementId: 'pop_data_transparency',
			type: 'boolean',
			description: 'Toggles visibility transparent handling states inside the built-in textures/imaging application paint tools.'
		},
		transparencyType: {
			key: 'paint_transparency_type',
			default: 'squares',
			elementId: 'pop_data_transparency_type',
			description: 'The background grid visualization graphic style (e.g., standard checkerboard squares) representing empty transparent canvas regions.'
		},
		theme: {
			key: 'paint_theme',
			default: 'dark',
			elementId: 'pop_data_theme',
			description: 'Sets the user interface background aesthetic layout configuration choice for custom asset creation modules.'
		},
		units: {
			key: 'paint_units',
			default: 'pixels',
			elementId: 'pop_data_default_units',
			description: 'Establishes the default evaluation metric scaling standard used during positioning calculations (e.g., pixels or percentages).'
		},
		resolution: {
			key: 'paint_resolution',
			default: '72',
			elementId: 'pop_data_resolution',
			description: 'Target rasterization resolution value tracking pixel denseness outputs across generated texturing operations.'
		},
		enableSnap: {
			key: 'paint_snap',
			default: true,
			elementId: 'pop_data_snap',
			type: 'boolean',
			description: 'Locks brush positions, vertex points, or element placement edges directly onto active layout grid thresholds.'
		},
		enableGuides: {
			key: 'paint_guides',
			default: true,
			elementId: 'pop_data_guides',
			type: 'boolean',
			description: 'Displays vector overlay target alignment lines to assist canvas item configuration balancing structures.'
		},
		safeSearch: {
			key: 'paint_safe_search',
			default: true,
			elementId: 'pop_data_safe_search',
			type: 'boolean',
			description: 'Filters external asset lookups and image integration components to enforce content security constraints.'
		},
		exitConfirm: {
			key: 'paint_exit_confirm',
			default: true,
			elementId: 'pop_data_exit_confirm',
			type: 'boolean',
			description: 'Prompts users with confirmation modals to prevent unintended layout asset progress data loss when navigating away.'
		},
		thickGuides: {
			key: 'paint_thick_guides',
			default: false,
			elementId: 'pop_data_thick_guides',
			type: 'boolean',
			description: 'Increases the contrast weight and visibility profile thickness lines of canvas coordinate target alignment helpers.'
		},
		enableAutoResize: {
			key: 'paint_autoresize',
			default: true,
			elementId: 'pop_data_enable_autoresize',
			type: 'boolean',
			description: 'Automatically stretches or compresses the editing canvas frame sizes relative to shifts in screen display boundaries.'
		},
		quickSaveData: {
			key: 'quicksave_data',
			default: '',
			description: 'Temporary serialization string containing emergency restore snapshots of the local design layout configuration state.'
		}
	},

};


if(!window.IMPORT_SETTINGS)
{
	window.IMPORT_SETTINGS = {};
}

for(const [moduleKey, configs] of Object.entries(LOCAL_SETTINGS))
{
	window.IMPORT_SETTINGS[moduleKey] = {
		...(window.IMPORT_SETTINGS[moduleKey] || {}),
		...configs
	};
}

export const IMPORT_SETTINGS = window.IMPORT_SETTINGS;

