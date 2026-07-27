/// <reference path="../bundle/global.d.ts" />


/**
 * Safely inspects and extracts properties from complex engine objects,
 * walking up prototype chains without invoking dangerous getters.
 */
function rebuildComplexObjectAsText(obj, maxDepth = 3, currentDepth = 0, cache = new Set())
{
	if(obj === null || obj === undefined) return String(obj);
	if(typeof obj !== 'object' && typeof obj !== 'function') return String(obj);

	// Prevent infinite cyclic loops
	if(cache.has(obj)) return '[Circular]';
	cache.add(obj);

	if(currentDepth >= maxDepth) return '[Max Depth Reached]';

	// Handle array configurations immediately
	if(Array.isArray(obj))
	{
		if(obj.length === 0) return '[]';
		return '[' + obj.map(item => rebuildComplexObjectAsText(item, maxDepth, currentDepth + 1, cache)).join(', ') + ']';
	}

	const lines = [];
	const className = obj.constructor ? obj.constructor.name : 'Object';

	// Walk up the prototype chain to catch inherited settings, stopping at base Object
	let currentTarget = obj;
	const visitedProps = new Set();

	while(currentTarget && currentTarget !== Object.prototype)
	{
		const props = Object.getOwnPropertyNames(currentTarget);

		for(const prop of props)
		{
			if(visitedProps.has(prop)) continue;
			visitedProps.add(prop);

			try
			{
				const descriptor = Object.getOwnPropertyDescriptor(currentTarget, prop);

				// CRITICAL: If it's an active getter, do NOT invoke it (could trigger errors)
				if(descriptor && descriptor.get && !descriptor.value)
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: [Getter]`);
					continue;
				}

				const val = obj[prop]; // Safe to read raw values if it's a standard descriptor field

				if(typeof val === 'function')
				{
					//lines.push(`${'  '.repeat(currentDepth + 1)}${prop}(): [Function]`);
				} else if(typeof val === 'object' && val !== null)
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: ${rebuildComplexObjectAsText(val, maxDepth, currentDepth + 1, cache)}`);
				} else
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: ${String(val)}`);
				}
			} catch(e)
			{
				if(e instanceof Error)
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: [Unreadable Property: ${e.message}]`);
				}
			}
		}
		currentTarget = Object.getPrototypeOf(currentTarget);
	}

	cache.delete(obj); // Allow sibling branches to evaluate correctly

	if(lines.length === 0) return `${className} {}`;
	return `${className} {\n${lines.join('\n')}\n${'  '.repeat(currentDepth)}}`;
}


function formatMessageItem(arg)
{
	if(typeof arg === 'string')
	{
		return arg.trim();
	}

	if(arg instanceof Error)
	{
		return `${arg.name}: ${arg.message}\n\r${arg.stack || ''}\n\r[Context State Dump]:\n\r${rebuildComplexObjectAsText(arg)}`;
	}

	if(typeof arg === 'object' && arg !== null)
	{
		if(Object.keys(arg).length === 0)
		{
			return (arg.name || arg.constructor.name || typeof arg) + ' ' + '{empty}';
		}

		// Try the fast track native path first
		try
		{
			const stringifyCache = new Set();
			return (arg.name || arg.constructor.name || typeof arg) + ' ' + JSON.stringify(arg, (key, value) =>
			{
				if(typeof value === 'object' && value !== null)
				{
					if(stringifyCache.has(value)) return '[Circular]';
					stringifyCache.add(value);
				}
				return value;
			}, 4);
		} catch(jsonCrash)
		{
			// ─── DYNAMIC AUTOMATIC RECOVERY FALLBACK ───
			// If the object contained hidden internal native toJSON hooks that crashed,
			// or had complex un-scannable structures, manually rebuild it safely.
			if(jsonCrash instanceof Error)
			{
				return `[Rebuilt Object Asset Dump due to serialization crash: ${jsonCrash.message}]\n` + rebuildComplexObjectAsText(arg);
			}
		}
	}

	return String(arg);
}

const formatMessage = (level, args) =>
{
	// Clean execution pass: Map items down their own independent serialization windows
	const processed = args.map(formatMessageItem);

	return `${processed.join('\n\r')}\r\n`;
};

const originalConsole = {
	log: console.log,
	warn: console.warn,
	error: console.error,
	info: console.info
};

self.originalConsole = originalConsole;

self.console.log = (...args) =>
{
	const formatted = formatMessage('log', args);
	const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
	const source = [category, 'log', ...trailingFiles, func,
		rawFile.split('/').pop().replace('.js', ''), rawFile
	];
	if(typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
	if(typeof originalConsole != 'undefined') originalConsole.log(...args);
};

self.console.warn = (...args) =>
{
	const formatted = formatMessage('warn', args);
	const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
	const source = [category, 'warn', ...trailingFiles, func,
		rawFile.split('/').pop().replace('.js', ''), rawFile
	];
	if(typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
	if(typeof originalConsole != 'undefined') originalConsole.warn(...args);
};

self.console.error = (...args) =>
{
	const formatted = formatMessage('error', args);
	const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
	const source = [category, 'error', ...trailingFiles, func,
		rawFile.split('/').pop().replace('.js', ''), rawFile
	];
	if(typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
	if(typeof originalConsole != 'undefined') originalConsole.error(...args);
};

self.console.info = (...args) =>
{
	const formatted = formatMessage('info', args);
	const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
	const source = [category, 'info', ...trailingFiles, func,
		rawFile.split('/').pop().replace('.js', ''), rawFile
	];
	if(typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
	if(typeof originalConsole != 'undefined') originalConsole.info(...args);
};



function forceLineWrap(text, maxCharsPerRow = 80)
{
	const rows = [];
	let currentLine = '';
	let visibleCount = 0;

	// Tokenize text into individual printable characters vs ANSI sequences
	// Matches standard ANSI codes: \x1b[...m
	const tokenRegex = /(\x1b\[[0-9;]*[a-zA-Z])|([\s\S])/g;
	let match;

	while((match = tokenRegex.exec(text)) !== null)
	{
		const [token, ansiCode, printableChar] = match;

		if(ansiCode)
		{
			// Invisible color tag—pass it into the line buffer for free
			currentLine += ansiCode;
		} else
		{
			// Printable text character
			if(printableChar === '\n')
			{
				// Hard break found naturally in stream, push and reset
				rows.push(currentLine);
				currentLine = '';
				visibleCount = 0;
			} else
			{
				currentLine += printableChar;
				visibleCount++;

				if(visibleCount >= maxCharsPerRow)
				{
					// Artificial limit hit! Wrap to next segment line
					rows.push(currentLine);
					currentLine = '';
					visibleCount = 0;
				}
			}
		}
	}

	// Flush remaining stray items in the text buffer
	if(currentLine.length > 0)
	{
		rows.push(currentLine);
	}

	return rows.join('\n\r');
}


function specialWrite(msg, source)
{
	if(!msg) return;

	if(msg.includes('Array "[Circular]"'))
		debugger;
	// 1. Core Fix: Clear old marks instantly via the native module API
	if(msg.includes('q3lcc -v') && window.compilerDiagnostics)
	{
		window.compilerDiagnostics.clear();
	}

	if(msg.includes('memory access out of bounds'))
	{
		needsHeaders = true;
	}

	if(!window.runningCommand)
	{
		window.runningCommand = true;
		if(!window.detachedConsole && !window.alreadyWroteDetached)
		{
			window.detachedConsole = true;
			debugger;
			console.warn('\n\rDetached console, awaiting terminate...');
		}
	}

	let skipTerminal = false;
	if(msg.includes('Assertion failed: lookup.node'))
	{
		skipTerminal = true;
	}
}



// Mapping system to identify active runtime environments based on trailing stack files
const PIPELINE_CATEGORIES = {
	'make': 'build',
	'compiler': 'build',
	'linker': 'build',
	'github': 'network',
	'p2p': 'network',
	'worker': 'worker',
	'shared': 'build'
};

function getCalleeInfoFromStackTrace()
{
	try
	{
		throw new Error();
	} catch(error)
	{
		if(!(error instanceof Error) || !error.stack) return ['unknown', [], 'unknown'];
		const stackLines = error.stack.split('\n');

		const parseLine = (line) =>
		{
			let match = line.match(/at\s+([^\s(]+)\s+\((.+):[0-9]+:[0-9]+\)/);
			if(match) return { func: match[1], file: match[2] };

			match = line.match(/at\s+(.+):[0-9]+:[0-9]+/);
			if(match) return { func: 'global', file: match[1] };

			return null;
		};

		// Identify internal logger context dynamically (e.g., logging.js)
		let currentFile = null;
		for(let i = 0; i < stackLines.length; i++)
		{
			const parsed = parseLine(stackLines[i]);
			if(parsed)
			{
				currentFile = parsed.file;
				break;
			}
		}

		let immediateCalleeFunc = null;
		let immediateCalleeFile = null;
		const trailingFiles = [];
		const uniqueNames = new Set();

		// Scan the entire call stack structure
		for(let i = 0; i < stackLines.length; i++)
		{
			const parsed = parseLine(stackLines[i]);
			if(!parsed) continue;

			// Skip internal wrapper functions inside the logging script itself
			if(parsed.file === currentFile) continue;

			// The first file we hit outside of logging.js is our immediate caller
			if(!immediateCalleeFunc)
			{
				immediateCalleeFunc = parsed.func;
				immediateCalleeFile = parsed.file;
			}

			// Isolate clean script names (e.g., "file:///path/make.js" -> "make")
			const scriptName = parsed.file.split('/').pop().replace('.js', '');

			if(!uniqueNames.has(scriptName))
			{
				uniqueNames.add(scriptName);
				trailingFiles.push(scriptName);
			}
		}

		// Determine the process category by looking up the captured trace names in our dictionary
		let matchedCategory = 'unknown';
		for(const name of trailingFiles)
		{
			if(PIPELINE_CATEGORIES[name])
			{
				matchedCategory = PIPELINE_CATEGORIES[name];
				break; // Break early to preserve highest-priority origin tracking (top-down)
			}
		}

		return [
			immediateCalleeFunc || 'global',
			trailingFiles,
			matchedCategory,
			immediateCalleeFile || 'unknown'
		];
	}
}

