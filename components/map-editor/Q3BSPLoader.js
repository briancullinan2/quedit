/* eslint-disable camelcase */
import {
	Loader,
	BufferGeometry,
	DefaultLoadingManager,
	FileLoader,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshPhongMaterial
} from "three";

/**
 * Q3BSPLoader converts parsed Quake 3 BSP maps into native Three.js hierarchies.
 * Adapted from Brandon Jones' (toji) WebGL Q3BSP parser for the nunuStudio ecosystem.
 */
var Q3BSPLoader = function(manager)
{
	Loader.call(this, manager !== undefined ? manager : DefaultLoadingManager);
	this.tesselationLevel = 5;
};

Q3BSPLoader.prototype = Object.assign(Object.create(Loader.prototype),
	{
		constructor: Q3BSPLoader,

		load: function(url, onLoad, onProgress, onError)
		{
			var scope = this;
			var loader = new FileLoader(scope.manager);
			loader.setPath(scope.path);
			loader.setResponseType("arraybuffer");
			
			loader.load(url, function(buffer)
			{
				// Note: Raw binary processing or message routing from background workers 
				// should pass structured object structures down to the inline parser block.
				onLoad(scope.parse(buffer));
			}, onProgress, onError);
		},

		setTesselationLevel: function(value)
		{
			this.tesselationLevel = value;
			return this;
		},

		parse: function(data)
		{
			var rootNode = new Group();
			rootNode.name = "Q3BSP_Map";

			// Fallback placeholder container for storing binary structural lumps
			rootNode.userData = {
				entities: {},
				planes: [],
				nodes: [],
				leaves: [],
				brushes: [],
				brushSides: [],
				leafBrushes: []
			};

			// If data arrives pre-processed/parsed via an asynchronous Web Worker message thread:
			if (data.type === "geometry" || data.vertices)
			{
				return this._buildFromMeshData(data, rootNode);
			}

			// If raw arraybuffer arrives via standard standalone FileLoader parsing channels:
			return this._parseRawBinaryBuffer(data, rootNode);
		},

		_buildFromMeshData: function(meshData, rootNode)
		{
			var geometry = new BufferGeometry();
			var rawVertices = meshData.vertices;
			var rawIndices = meshData.indices;
			var surfaces = meshData.surfaces || [];

			var stride = 14; // positions(3) + uvs(2) + lightuvs(2) + normals(3) + colors(4)
			var vertexCount = rawVertices.length / stride;

			var positions = new Float32Array(vertexCount * 3);
			var normals = new Float32Array(vertexCount * 3);
			var uvs = new Float32Array(vertexCount * 2);
			var colors = new Float32Array(vertexCount * 4);

			for (var i = 0; i < vertexCount; i++)
			{
				var idx = i * stride;

				// Map coordinate transformation: Swizzling Z-up to Three.js Y-up format
				positions[i * 3] = rawVertices[idx];
				positions[i * 3 + 1] = rawVertices[idx + 2];
				positions[i * 3 + 2] = -rawVertices[idx + 1];

				// Texture Coordinates
				uvs[i * 2] = rawVertices[idx + 3];
				uvs[i * 2 + 1] = 1.0 - rawVertices[idx + 4]; // Flip V component

				// Vertex Normals
				normals[i * 3] = rawVertices[idx + 7];
				normals[i * 3 + 1] = rawVertices[idx + 9];
				normals[i * 3 + 2] = -rawVertices[idx + 8];

				// Vertex Color values
				colors[i * 4] = rawVertices[idx + 10];
				colors[i * 4 + 1] = rawVertices[idx + 11];
				colors[i * 4 + 2] = rawVertices[idx + 12];
				colors[i * 4 + 3] = rawVertices[idx + 13];
			}

			geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
			geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
			geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
			geometry.setAttribute("color", new Float32BufferAttribute(colors, 4));

			if (rawIndices)
			{
				geometry.setIndex(rawIndices.length > 65535 ? new Uint32Array(rawIndices) : new Uint16Array(rawIndices));
			}

			// Generate mesh groupings matching distinct surface lumps
			for (var s = 0; s < surfaces.length; s++)
			{
				var surface = surfaces[s];
				if (surface.elementCount === 0) {continue;}

				geometry.addGroup(surface.indexOffset, surface.elementCount, s);

				// Create individual runtime Sub-Meshes so they show up discrete within the editor object tree
				var mat = new MeshPhongMaterial({
					name: surface.shaderName || "default_bsp",
					vertexColors: true
				});

				var surfaceMesh = new Mesh(geometry, mat);
				surfaceMesh.name = (surface.shaderName !== "noshader") ? surface.shaderName : "surface_" + s;
				surfaceMesh.userData = {
					geomType: surface.geomType,
					visible: true,
					indexOffset: surface.indexOffset,
					elementCount: surface.elementCount
				};

				rootNode.add(surfaceMesh);
			}

			if (meshData.entities) {rootNode.userData.entities = meshData.entities;}
			if (meshData.bsp) {rootNode.userData.bspTree = meshData.bsp;}

			return rootNode;
		},

		_parseRawBinaryBuffer: function(buffer, rootNode)
		{
			var view = new DataView(buffer);
			var ptr = 0;

			// Validate IBSP Magic Identification block
			var magic = view.getUint32(ptr, true); ptr += 4;
			var version = view.getUint32(ptr, true); ptr += 4;

			if (magic !== 1347633737 || version !== 46) // "IBSP" and Version 46 check
			{
				console.error("Q3BSPLoader: Invalid BSP structural parameters or unexpected magic signature.");
				return rootNode;
			}

			// Parse Directory Lumps Offset References
			var lumps = [];
			for (var i = 0; i < 17; i++)
			{
				lumps.push({
					offset: view.getInt32(ptr, true),
					length: view.getInt32(ptr, true)
				});
				ptr += 8;
			}

			// Parse Lump 0: Entities parsing block
			var entLump = lumps[0];
			if (entLump.length > 0)
			{
				var entBytes = new Uint8Array(buffer, entLump.offset, entLump.length);
				var entString = String.fromCharCode.apply(null, entBytes);
				rootNode.userData.entities = this._parseEntityString(entString);
			}

			// NOTE: Geometry processing blocks should delegate heavy lifting tasks 
			// down to background Web Workers matching standard toji architectural loops.
			console.warn("Q3BSPLoader: Raw geometric structural compilation should utilize a companion worker script context.");
			
			return rootNode;
		},

		_parseEntityString: function(str)
		{
			var entities = [];
			var currentEntity = null;
			var matches = str.match(/[^\r\n]+/g) || [];

			for (var i = 0; i < matches.length; i++)
			{
				var line = matches[i].trim();
				if (line === "{")
				{
					currentEntity = {};
				}
				else if (line === "}")
				{
					if (currentEntity) {entities.push(currentEntity);}
					currentEntity = null;
				}
				else if (currentEntity)
				{
					var propMatch = line.match(/"([^"]+)"\s+"([^"]+)"/);
					if (propMatch)
					{
						currentEntity[propMatch[1]] = propMatch[2];
					}
				}
			}
			return entities;
		}
	});

export {Q3BSPLoader};
