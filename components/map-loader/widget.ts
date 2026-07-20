import { Widget } from '@lumino/widgets';
import { FrameRater } from '../bundle/frame-rater';

// --- External Prototype Global Declarations ---
// These match the standard JS imports you will be referencing at the top of your module.
declare const WebXRPolyfill: any;
declare const mat4: any;
declare const vec3: any;
declare const quat: any;
declare const q3bsp: any;
declare const q3movement: any;
declare const Stats: any;
declare const XRWebGLLayer: any;


declare global
{
	interface Window
	{
		tojiFrameLimiter: FrameRater;
		loadScript(src: string): Promise<any>;
	}
	interface Navigator
	{
		xr?: {
			isSessionSupported(mode: 'inline' | 'immersive-vr' | 'immersive-ar'): Promise<boolean>;
			requestSession(
				mode: 'inline' | 'immersive-vr' | 'immersive-ar',
				options?: {
					requiredFeatures?: string[];
					optionalFeatures?: string[];
				}
			): Promise<any>;
		};
	}
}


export const DEFAULT_MAPNAME = 'maps/q3tourney2.bsp';


/**
 * A Lumino Widget wrapping the Quake 3 WebGL demo engine.
 * Fully type-annotated while keeping all legacy implementation hints intact.
 */
export class TojiWidget extends Widget
{
	// Legacy Polyfill
	private polyfill?: typeof WebXRPolyfill;

	// Map Setup State
	private mapName?: string;
	private previousMapName: string | null = null;
	private maploadDebouncer: any = null;

	// View Matrices & Viewports
	private leftViewMat: any;
	private rightViewMat: any;
	private projMat: any;
	private leftViewport: { x: number; y: number; width: number; height: number; } | null = null;
	private rightViewport: { x: number; y: number; width: number; height: number; } | null = null;

	// Engine Instances
	private activeShader: any = null;
	private map: any = null;
	private playerMover: any = null;
	private mobileSite: boolean = false;

	// Camera & Navigation
	private zAngle: number = 3;
	private xAngle: number = 0;
	private cameraPosition: number[] = [0, 0, 0];

	// WebXR Globals
	private xrDevice: any = null;
	private xrSession: any = null;
	private xrReferenceSpace: any = null;
	private xrPose: any = null;
	private xrViews: any[] = [];

	// Metrical Scaling
	private playerHeight: number = 57; // Roughly where my eyes sit (1.78 meters off the ground)
	private xrIPDScale: number = 32.0; // There are 32 units per meter in Quake 3
	private xrDrawMode: number = 0;

	// Frame Control
	private SKIP_FRAMES: number = 0;
	private REPEAT_FRAMES: number = 1;
	private lastIndex: number = 0;
	private lastMove: number = 0;

	// Math Scratchpads
	private poseMatrix: any;
	private pressed: boolean[] = new Array(128);
	private cameraMat: any;
	private xrOrientation: any;
	private xrEuler: any;

	// DOM Elements Managed inside Widget
	private viewportElement!: HTMLCanvasElement;
	private viewportFrameElement!: HTMLDivElement;
	private webglErrorElement!: HTMLDivElement;
	private statsInstance: any = null;

	// Engine Lifecycle State
	private tojiEngineRunning: boolean = false;
	private tojiRendererRunning: boolean = false;
	private notRunningFrameCount: number = 0;
	private rafCallback: any = null;

	private startTime: number = 0;
	private lastTimestamp: number = 0;
	private lastFps: number = 0;
	private frameId: number = 0;

	// Input Tracking Helpers
	private movingModel: boolean = false;
	private lastX: number = 0;
	private lastY: number = 0;
	private lastMoveX: number = 0;
	private lastMoveY: number = 0;


	private readonly SCRIPTS_TO_LOAD = [
		'/components/map-loader/util/webxr-polyfill.min.js',
		'/components/map-loader/util/game-shim.js',
		'/components/map-loader/util/gl-matrix-min.js',
		'/components/map-loader/util/stats.min.js',
		'/components/map-loader/basis/basis-basics.js',

		// WebGL Renderer Core & Engine Logic
		'/components/map-loader/q3bsp.js',
		'/components/map-loader/q3shader.js',
		'/components/map-loader/q3glshader.js',
		'/components/map-loader/q3movement.js'
	];
	startupPromise: Promise<void>;


	constructor(titleStr: string)
	{
		super();
		this.id = 'toji-panel';
		this.title.label = titleStr;
		this.title.closable = true;
		this.addClass('q3-canvas-widget');

		// Create container and DOM structure matching legacy IDs
		this.viewportFrameElement = document.createElement('div');
		this.viewportFrameElement.id = 'viewport-frame';
		this.viewportFrameElement.style.position = 'relative';
		this.viewportFrameElement.style.width = '100%';
		this.viewportFrameElement.style.height = '100%';

		this.viewportElement = document.createElement('canvas');
		this.viewportElement.id = 'viewport';
		this.viewportElement.style.display = 'none';
		this.viewportElement.style.width = '100%';
		this.viewportElement.style.height = '100%';

		this.webglErrorElement = document.createElement('div');
		this.webglErrorElement.id = 'webgl-error';
		this.webglErrorElement.style.display = 'none';
		this.webglErrorElement.innerText = 'WebGL context initialization failed.';

		this.viewportFrameElement.appendChild(this.viewportElement);
		this.viewportFrameElement.appendChild(this.webglErrorElement);
		this.node.appendChild(this.viewportFrameElement);

		// Initial event hooks
		this.viewportFrameElement.addEventListener('click', () => this.runTojiEngine());

		if(navigator.xr)
		{
			navigator.xr.isSessionSupported('immersive-vr').then((supported: boolean) =>
			{
				if(!supported) { return; }
				let vrToggle = document.getElementById("vrToggle");
				if(vrToggle) vrToggle.style.display = "block";
				let mobileVrBtn = document.getElementById("mobileVrBtn");
				if(mobileVrBtn) mobileVrBtn.style.display = "block";
			});
		}


		this.startupPromise = (async () =>
		{
			for(let src of this.SCRIPTS_TO_LOAD)
			{
				await window.loadScript(src);
			}
			this.polyfill = new WebXRPolyfill();
			// Instantiate scratch matrices early
			this.poseMatrix = mat4.create();
			this.cameraMat = mat4.create();
			this.xrOrientation = quat.create();
			this.xrEuler = vec3.create();
		})();
	}

	protected override async onAfterAttach(msg: any): Promise<void>
	{
		super.onAfterAttach(msg);
		await this.startupPromise;
		this.runTojiEngine();
	}

	protected override onBeforeDetach(msg: any): void
	{
		// Teardown steps if necessary when node leaves Lumino tree
		window.removeEventListener("resize", this.handleResize);
		super.onBeforeDetach(msg);
	}

	protected override onResize(msg: any): void
	{
		super.onResize(msg);
		this.handleResize();
	}

	private isXRPresenting(): boolean
	{
		return !!this.xrSession;
	}

	private getQueryVariable(variable: string): string | null
	{
		let query = window.location.search.substring(1);
		let vars = query.split("&");
		for(let i = 0; i < vars.length; i++)
		{
			let pair = vars[i].split("=");
			if(pair[0] === variable)
			{
				return unescape(pair[1]);
			}
		}
		return null;
	}

	private initGL(gl: any, canvas: HTMLCanvasElement): void
	{
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);

		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.enable(gl.CULL_FACE);

		this.leftViewMat = mat4.create();
		this.rightViewMat = mat4.create();
		this.projMat = mat4.create();

		this.leftViewport = { x: 0, y: 0, width: 0, height: 0 };
		this.rightViewport = { x: 0, y: 0, width: 0, height: 0 };

		this.initMap(gl, DEFAULT_MAPNAME);
	}

	private initMap(gl: any, mapFile: string, mapContent?: any, noBounce: boolean = false): void
	{
		//let titleEl = document.getElementById("mapTitle");
		//titleEl.innerHtml = mapName.toUpperCase();
		if(!noBounce)
		{
			if(this.maploadDebouncer)
			{
				this.previousMapName = mapFile;
				return;
			}
			this.maploadDebouncer = setTimeout(() => this.initMap(gl, mapFile, mapContent, true), 300);
			return;
		}

		let tesselation: any = this.getQueryVariable("tesselate");
		if(tesselation)
		{
			tesselation = parseInt(tesselation, 10);
		}

		let xrMode: any = this.getQueryVariable("vrDrawMode");
		if(xrMode)
		{
			this.xrDrawMode = parseInt(xrMode, 10);
		}

		if(this.mapName === mapFile)
		{
			return; // already loaded
		}
		this.mapName = mapFile || this.mapName;

		this.map = new q3bsp(gl);
		this.map.onentitiesloaded = (entities: any) => this.initMapEntities(entities);
		this.map.onbsp = (bsp: any) => this.initPlayerMover(bsp);
		//map.onsurfaces = initSurfaces;
		this.map.load(mapContent || this.mapName, tesselation);

		this.maploadDebouncer = null;
	}

	private initMapEntities(entities: any): void
	{
		this.respawnPlayer(0);
	}

	private initPlayerMover(bsp: any): void
	{
		this.playerMover = new q3movement(bsp);
		this.respawnPlayer(0);
		this.viewportElement.style.display = 'block';
		this.handleResize();
	}

	private respawnPlayer(index: number): void
	{
		if(this.map.entities && this.playerMover)
		{
			if(index === -1)
			{
				index = (this.lastIndex + 1) % this.map.entities.info_player_deathmatch.length;
			}
			this.lastIndex = index;

			let spawnPoint = this.map.entities.info_player_deathmatch[index];
			this.playerMover.position = [
				spawnPoint.origin[0],
				spawnPoint.origin[1],
				spawnPoint.origin[2] + 30 // Start a little ways above the floor
			];

			this.playerMover.velocity = [0, 0, 0];

			this.zAngle = -(spawnPoint.angle || 0) * (3.1415 / 180) + (3.1415 * 0.5); // Negative angle in radians + 90 degrees
			this.xAngle = 0;
		}
	}

	private eulerFromQuaternion(out: number[], q: number[], order: string): void
	{
		function clamp(value: number, min: number, max: number): number
		{
			return (value < min ? min : (value > max ? max : value));
		}
		let sqx = q[0] * q[0];
		let sqy = q[1] * q[1];
		let sqz = q[2] * q[2];
		let sqw = q[3] * q[3];

		if(order === 'XYZ')
		{
			out[0] = Math.atan2(2 * (q[0] * q[3] - q[1] * q[2]), (sqw - sqx - sqy + sqz));
			out[1] = Math.asin(clamp(2 * (q[0] * q[2] + q[1] * q[3]), -1, 1));
			out[2] = Math.atan2(2 * (q[2] * q[3] - q[0] * q[1]), (sqw + sqx - sqy - sqz));
		} else if(order === 'YXZ')
		{
			out[0] = Math.asin(clamp(2 * (q[0] * q[3] - q[1] * q[2]), -1, 1));
			out[1] = Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), (sqw - sqx - sqy + sqz));
			out[2] = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), (sqw - sqx + sqy - sqz));
		} else if(order === 'ZXY')
		{
			out[0] = Math.asin(clamp(2 * (q[0] * q[3] + q[1] * q[2]), -1, 1));
			out[1] = Math.atan2(2 * (q[1] * q[3] - q[2] * q[0]), (sqw - sqx - sqy + sqz));
			out[2] = Math.atan2(2 * (q[2] * q[3] - q[0] * q[1]), (sqw - sqx + sqy - sqz));
		} else if(order === 'ZYX')
		{
			out[0] = Math.atan2(2 * (q[0] * q[3] + q[2] * q[1]), (sqw - sqx - sqy + sqz));
			out[1] = Math.asin(clamp(2 * (q[1] * q[3] - q[0] * q[2]), -1, 1));
			out[2] = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), (sqw + sqx - sqy - sqz));
		} else if(order === 'YZX')
		{
			out[0] = Math.atan2(2 * (q[0] * q[3] - q[2] * q[1]), (sqw - sqx + sqy - sqz));
			out[1] = Math.atan2(2 * (q[1] * q[3] - q[0] * q[2]), (sqw + sqx + sqy - sqz));
			out[2] = Math.asin(clamp(2 * (q[0] * q[1] + q[2] * q[3]), -1, 1));
		} else if(order === 'XZY')
		{
			out[0] = Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), (sqw - sqx + sqy - sqz));
			out[1] = Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), (sqw + sqx - sqy - sqz));
			out[2] = Math.asin(clamp(2 * (q[2] * q[3] - q[0] * q[1]), -1, 1));
		} else
		{
			console.log('No order given for quaternion to euler conversion.');
			return;
		}
	}

	private onFrame(gl: any, event: { timestamp: number; elapsed: number; frameTime: number; }): void
	{
		if(!this.map || !this.playerMover) { return; }

		while(event.elapsed - this.lastMove >= 16)
		{
			this.updateInput(16);
			this.lastMove += 16;
		}

		for(let i = 0; i < this.REPEAT_FRAMES; ++i)
		{
			this.drawFrame(gl);
		}
	}

	private getViewMatrix(out: any, pose?: any, view?: any): void
	{
		mat4.identity(out);
		mat4.translate(out, out, this.playerMover.position);
		if(!pose)
		{
			mat4.translate(out, out, [0, 0, this.playerHeight]);
		}
		mat4.rotateZ(out, out, -this.zAngle);
		mat4.rotateX(out, out, Math.PI / 2);

		if(view)
		{
			mat4.scale(this.poseMatrix, view.transform.inverse.matrix, [1 / this.xrIPDScale, 1 / this.xrIPDScale, 1 / this.xrIPDScale]);
			mat4.invert(this.poseMatrix, this.poseMatrix);
			mat4.multiply(out, out, this.poseMatrix);
		}

		mat4.rotateX(out, out, -this.xAngle);
		mat4.invert(out, out);
	}

	private drawFrame(gl: any): void
	{
		gl.depthMask(true);

		if(!this.map || !this.playerMover) { return; }

		if(!this.xrPose)
		{
			this.getViewMatrix(this.leftViewMat);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.clear(gl.DEPTH_BUFFER_BIT);
			this.map.draw(this.leftViewMat, this.projMat);
		} else
		{
			if(this.xrViews.length !== this.xrPose.views.length)
			{
				this.xrViews = [];
			}

			for(let v = 0; v < this.xrPose.views.length; ++v)
			{
				if(this.xrViews.length <= v)
				{
					this.xrViews.push({
						viewMat: mat4.create(),
						projMat: null,
						viewport: null,
					});
				}
				let view = this.xrViews[v];
				this.getViewMatrix(view.viewMat, this.xrPose, this.xrPose.views[v]);
				view.projMat = this.xrPose.views[v].projectionMatrix;
				view.viewport = this.xrSession.renderState.baseLayer.getViewport(this.xrPose.views[v]);
			}

			gl.bindFramebuffer(gl.FRAMEBUFFER, this.xrSession.renderState.baseLayer.framebuffer);
			gl.clear(gl.DEPTH_BUFFER_BIT);
			this.map.drawViews(this.xrViews);
		}
	}

	private moveLookLocked(xDelta: number, yDelta: number): void
	{
		this.zAngle += xDelta * 0.0025;
		while(this.zAngle < 0) this.zAngle += Math.PI * 2;
		while(this.zAngle >= Math.PI * 2) this.zAngle -= Math.PI * 2;

		if(!this.isXRPresenting())
		{
			this.xAngle += yDelta * 0.0025;
			while(this.xAngle < -Math.PI * 0.5) this.xAngle = -Math.PI * 0.5;
			while(this.xAngle > Math.PI * 0.5) this.xAngle = Math.PI * 0.5;
		}
	}

	private filterDeadzone(value: number): number
	{
		return Math.abs(value) > 0.35 ? value : 0;
	}

	private moveViewOriented(dir: number[], frameTime: number): void
	{
		if(dir[0] !== 0 || dir[1] !== 0 || dir[2] !== 0)
		{
			mat4.identity(this.cameraMat);
			if(this.xrPose)
			{
				mat4.getRotation(this.xrOrientation, this.xrPose.transform.matrix);
				this.eulerFromQuaternion(this.xrEuler, this.xrOrientation, 'YXZ');
				mat4.rotateZ(this.cameraMat, this.cameraMat, this.zAngle - this.xrEuler[1]);
			} else
			{
				mat4.rotateZ(this.cameraMat, this.cameraMat, this.zAngle);
			}
			mat4.invert(this.cameraMat, this.cameraMat);
			vec3.transformMat4(dir, dir, this.cameraMat);
		}
		this.playerMover.move(dir, frameTime);
	}

	private updateInput(frameTime: number): void
	{
		if(!this.playerMover) { return; }

		let dir = [0, 0, 0];

		if(this.pressed['W'.charCodeAt(0)]) { dir[1] += 1; }
		if(this.pressed['S'.charCodeAt(0)]) { dir[1] -= 1; }
		if(this.pressed['A'.charCodeAt(0)]) { dir[0] -= 1; }
		if(this.pressed['D'.charCodeAt(0)]) { dir[0] += 1; }

		if(!this.xrSession)
		{
			let gamepads: any[] = [];
			if((navigator as any).getGamepads)
			{
				gamepads = (navigator as any).getGamepads();
			} else if((navigator as any).webkitGetGamepads)
			{
				gamepads = (navigator as any).webkitGetGamepads();
			}

			for(let i = 0; i < gamepads.length; ++i)
			{
				let pad = gamepads[i];
				if(pad)
				{
					dir[0] += this.filterDeadzone(pad.axes[0]);
					dir[1] -= this.filterDeadzone(pad.axes[1]);

					this.moveLookLocked(
						this.filterDeadzone(pad.axes[2]) * 25.0,
						this.filterDeadzone(pad.axes[3]) * 25.0
					);

					for(let j = 0; j < Math.min(pad.buttons.length, 4); ++j)
					{
						let button = pad.buttons[j];
						if(typeof (button) === "number" && button === 1.0)
						{
							this.playerMover.jump();
						} else if(button.pressed)
						{
							this.playerMover.jump();
						}
					}
				}
			}
		}
		this.moveViewOriented(dir, frameTime);
	}

	private initEvents(): void
	{
		document.addEventListener("keydown", (event) =>
		{
			if(event.keyCode === 32 && !this.pressed[32])
			{
				this.playerMover.jump();
			}
			this.pressed[event.keyCode] = true;
			if((event.keyCode === 'W'.charCodeAt(0) ||
				event.keyCode === 'S'.charCodeAt(0) ||
				event.keyCode === 'A'.charCodeAt(0) ||
				event.keyCode === 'D'.charCodeAt(0) ||
				event.keyCode === 32) && !event.ctrlKey)
			{
				event.preventDefault();
			}
		}, false);

		document.addEventListener("keypress", (event) =>
		{
			if(event.charCode === 'R'.charCodeAt(0) || event.charCode === 'r'.charCodeAt(0))
			{
				this.respawnPlayer(-1);
			}
		}, false);

		document.addEventListener("keyup", (event) =>
		{
			this.pressed[event.keyCode] = false;
		}, false);

		const startLook = (x: number, y: number) =>
		{
			this.movingModel = true;
			this.lastX = x;
			this.lastY = y;
		};

		const endLook = () =>
		{
			this.movingModel = false;
		};

		const moveLook = (x: number, y: number) =>
		{
			let xDelta = x - this.lastX;
			let yDelta = y - this.lastY;
			this.lastX = x;
			this.lastY = y;
			if(this.movingModel)
			{
				this.moveLookLocked(xDelta, yDelta);
			}
		};

		const startMove = (x: number, y: number) =>
		{
			this.lastMoveX = x;
			this.lastMoveY = y;
		};

		const moveUpdate = (x: number, y: number, frameTime: number) =>
		{
			let xDelta = x - this.lastMoveX;
			let yDelta = y - this.lastMoveY;
			this.lastMoveX = x;
			this.lastMoveY = y;
			let dir = [xDelta, yDelta * -1, 0];
			this.moveViewOriented(dir, frameTime * 2);
		};

		this.viewportElement.addEventListener("click", () =>
		{
			this.viewportElement.requestPointerLock();
		}, false);

		this.viewportElement.addEventListener("mousedown", (event) =>
		{
			if(event.which === 1)
			{
				startLook(event.pageX, event.pageY);
			}
		}, false);

		this.viewportElement.addEventListener("mouseup", () =>
		{
			endLook();
		}, false);

		this.viewportFrameElement.addEventListener("mousemove", (event) =>
		{
			if(document.pointerLockElement)
			{
				this.moveLookLocked(event.movementX, event.movementY);
			} else
			{
				moveLook(event.pageX, event.pageY);
			}
		}, false);

		this.viewportElement.addEventListener('touchstart', (event) =>
		{
			let touches = event.touches;
			switch(touches.length)
			{
				case 1:
					startLook(touches[0].pageX, touches[0].pageY);
					break;
				case 2:
					startMove(touches[0].pageX, touches[0].pageY);
					break;
				case 3:
					this.playerMover.jump();
					break;
				default:
					return;
			}
			event.stopPropagation();
			event.preventDefault();
		}, false);

		this.viewportElement.addEventListener('touchend', (event) =>
		{
			endLook();
			return false;
		}, false);

		this.viewportElement.addEventListener('touchmove', (event) =>
		{
			let touches = event.touches;
			switch(touches.length)
			{
				case 1:
					moveLook(touches[0].pageX, touches[0].pageY);
					break;
				case 2:
					moveUpdate(touches[0].pageX, touches[0].pageY, 16);
					break;
				default:
					return;
			}
			event.stopPropagation();
			event.preventDefault();
		}, false);
	}

	private getAvailableContext(canvas: HTMLCanvasElement, contextList: string[]): any
	{
		if(canvas.getContext)
		{
			for(let i = 0; i < contextList.length; ++i)
			{
				try
				{
					let context = canvas.getContext(contextList[i], {
						antialias: false,
						alpha: false,
						xrCompatible: true
					});
					if(context !== null) return context;
				} catch(ex) { }
			}
		}
		return null;
	}

	private onRequestedFrame(gl: any, stats: any, t: number, frame: any): void
	{
		let timestamp = new Date().getTime();

		if(this.xrSession && frame)
		{
			this.xrPose = frame.getViewerPose(this.xrReferenceSpace);
		} else
		{
			this.xrPose = null;
		}

		this.frameId++;
		if(this.SKIP_FRAMES !== 0 && this.frameId % this.SKIP_FRAMES !== 0) return;

		stats.begin();
		this.onFrame(gl, {
			timestamp: timestamp,
			elapsed: timestamp - this.startTime,
			frameTime: timestamp - this.lastTimestamp
		});
		stats.end();

		if(window.tojiFrameLimiter)
		{
			window.tojiFrameLimiter.requestFrameUpdate();
		}
	}

	private handleResize = (): void =>
	{
		// Ported from window.onResize structure inside legacy environment
		if(!this.isXRPresenting() && this.map)
		{
			let devicePixelRatio = window.devicePixelRatio || 1;
			let gl = this.viewportElement.getContext('webgl2') || this.viewportElement.getContext('webgl');
			if(!gl) return;

			if(document.fullscreenElement)
			{
				this.viewportElement.width = screen.width * devicePixelRatio;
				this.viewportElement.height = screen.height * devicePixelRatio;
			} else
			{
				this.viewportElement.width = this.viewportElement.clientWidth * devicePixelRatio;
				this.viewportElement.height = this.viewportElement.clientHeight * devicePixelRatio;
			}

			(gl as WebGLRenderingContext).viewport(0, 0, this.viewportElement.width, this.viewportElement.height);
			mat4.perspective(this.projMat, 45.0, this.viewportElement.width / this.viewportElement.height, 1.0, 4096.0);
		}
	};

	public runTojiEngine(): void
	{
		if(this.tojiEngineRunning)
		{
			if(!this.tojiRendererRunning)
			{
				this.notRunningFrameCount = 0;
				if(window.tojiFrameLimiter) window.tojiFrameLimiter.requestFrameUpdate();
			}
			return;
		}

		this.tojiEngineRunning = true;

		this.statsInstance = new Stats();
		this.viewportFrameElement.appendChild(this.statsInstance.domElement);

		let gl = this.getAvailableContext(this.viewportElement, ['webgl2', 'webgl', 'experimental-webgl']);

		if(!gl)
		{
			this.viewportFrameElement.style.display = 'none';
			this.webglErrorElement.style.display = 'block';
		} else
		{
			this.initEvents();
			this.initGL(gl, this.viewportElement);
			this.startTime = new Date().getTime();
			this.frameId = 0;
			this.lastTimestamp = this.startTime;
			this.lastFps = this.startTime;

			window.tojiFrameLimiter = new FrameRater(25, (e: any, t: number, frame: any) =>
			{
				/*
				if(!this.viewportFrameElement.classList.contains('not-hidden')
					&& (!document.body.classList.contains('previous-viewport-frame') || window.innerWidth < 1200)
					&& (!document.body.classList.contains('panel-terminal-container')
						&& document.querySelector('#terminals a[href="#soft"].active') === null)
				)
				{
					this.notRunningFrameCount++;
					if(this.notRunningFrameCount > 25)
					{
						this.tojiRendererRunning = false;
						return;
					}
				}
				*/
				this.tojiRendererRunning = true;
				this.onRequestedFrame(gl, this.statsInstance, t, frame);
			});

			window.tojiFrameLimiter.requestFrameUpdate();
			// TODO: make this lazy with a separate function
			this.rafCallback = this.onRequestedFrame.bind(this, gl, this.statsInstance);
		}

		this.handleResize();
		window.addEventListener("resize", this.handleResize, false);

		document.addEventListener("fullscreenchange", () =>
		{
			if(document.fullscreenElement)
			{
				this.viewportElement.requestPointerLock();
			}
			this.handleResize();
		}, false);
	}

	private presentXR(gl: any): void
	{
		if(this.xrSession)
		{
			this.xrSession.end();
		} else
		{
			this.xAngle = 0.0;
			(navigator as any).xr.requestSession('immersive-vr', {
				optionalFeatures: ['local-floor']
			}).then((session: any) =>
			{
				session.addEventListener('end', () =>
				{
					this.xrSession = null;
					this.xrPose = null;
					this.handleResize();
				});

				session.addEventListener('select', (evt: any) =>
				{
					// ?
				});

				session.addEventListener('selectstart', (evt: any) =>
				{
					this.pressed['W'.charCodeAt(0)] = true;
				});

				session.addEventListener('selectend', (evt: any) =>
				{
					this.pressed['W'.charCodeAt(0)] = false;
				});

				session.requestReferenceSpace('local-floor').then((refSpace: any) =>
				{
					this.xrReferenceSpace = refSpace;

					session.updateRenderState({
						depthNear: 1.0,
						depthFar: 4096.0,
						baseLayer: new XRWebGLLayer(session, gl)
					});
					this.xrSession = session;
					this.xrSession.requestAnimationFrame(this.rafCallback);
				});
			});
		}
	}
}

