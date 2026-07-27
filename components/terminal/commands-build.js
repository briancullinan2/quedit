
/// <reference path="../bundle/global.d.ts" />

/// <reference path="../bundle/global-shared.d.ts" />



async function buildCommand(argv, database)
{
	const mode = argv[0] || 'release';

	let selected = argv[1] || self.engineRepository || database;
	if(api)
	{
		api.database = selected;
	}
	if(mode === 'q3lcc'
		|| mode === 'q3rcc'
		|| mode === 'q3cpp'
		|| mode === 'lburg'
		|| mode === 'tools'
	)
		selected = argv[1] || self.toolsRepository;
	if(mode === 'q3asm')
		selected = argv[1] || self.tools2Repository;
	if(mode === 'all'
		|| mode === 'release'
		|| mode === 'debug'
		|| mode === 'stringify'
		|| mode === 'shaders'
		|| mode === 'client'
		|| mode === 'engine'
		|| mode === 'server'
	)
		selected = argv[1] || self.engineRepository;

	if(mode === 'cgame'
		|| mode === 'game'
		|| mode === 'ui'
		|| mode === 'q3_ui'
		|| mode === 'qvms'
	)
		selected = argv[1] || self.gameRepository;

	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;
	if(selected && !self.filesRepo[selected])
	{
		let branch = await self.getDefaultBranch(ownerName, repoName);
		await self.loadGitHubTree(ownerName, repoName, branch);
	}


	if(TERMINATE) return;

	let validMode = self.SettingsToolbar?.configuration?.value;

	if(mode === 'q3lcc'
		|| mode === 'q3rcc'
		|| mode === 'q3cpp'
		|| mode === 'lburg'
		|| mode === 'q3asm'
		|| mode === 'tools'
	)
		validMode = 'tools';

	else if(mode === 'cgame'
		|| mode === 'game'
		|| mode === 'ui'
		|| mode === 'q3_ui'
		|| mode === 'qvms'
	)
		validMode = 'qvms';
	else if(mode === 'all'
		|| mode === 'release'
		|| mode === 'debug'
		|| mode === 'stringify'
		|| mode === 'shaders'
		|| mode === 'client'
		|| mode === 'engine'
		|| mode === 'server'
	)
		validMode = 'release';


	if(self.SettingsToolbar?.configuration?.querySelector(`[value="${validMode}"]`))
	{
		if(self.SettingsToolbar && self.SettingsToolbar.configuration && validMode)
		{
			self.SettingsToolbar.configuration.value = validMode;
		}
		if(api)
		{
			api.configuration = self.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
		}
	}
	else if(mode)
	{
		let modes = Array.from(self.SettingsToolbar?.configuration?.children || []).map(m =>
		{
			if(m instanceof HTMLOptionElement)
			{
				return m.value;
			}
		});
		terminalWrite(`Valid modes ${modes.join('|')}: ${mode} given.\n\r`);
		return;
	}


	terminalWrite(`Starting ${mode} build...\n\r`);

	if(selected === self.engineRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await downloadHeaders(q3eCommonHeaders, 10, mode === 'all' ? self.engineRepository : selected);
	}

	needsHeaders = false;


	if(TERMINATE) return;

	if(mode === 'stringify' || mode === 'all')
		await buildStringify(mode === 'all' ? self.engineRepository : selected, false, true);

	if(TERMINATE) return;
	if(mode === 'shaders')
		await buildShaders(mode === 'all' ? self.engineRepository : selected, false, true);

	if(TERMINATE) return;
	if(mode === 'client'
		|| mode === 'release' || mode === 'debug'
		|| mode === 'all'
	)
		await buildClient(mode === 'all' ? self.engineRepository : selected, mode === 'client' || mode === 'engine', false, true); // also builds shaders

	if(TERMINATE) return;

	if(selected === self.toolsRepository)
	{
		await downloadHeaders(lccToolHeaders, 10, mode === 'all' ? self.toolsRepository : selected);
	}

	if(TERMINATE) return;

	if(mode === 'lburg' || mode === 'all' || mode === 'tools')
		await buildTools(mode === 'all' ? self.toolsRepository : selected, 'lburg', mode === 'lburg', true); // shared debouncer

	if(TERMINATE) return;
	if(mode === 'q3rcc' || mode === 'all' || mode === 'tools')
		await buildTools(mode === 'all' ? self.toolsRepository : selected, 'q3rcc', mode === 'q3rcc', true); // implicit forceChanged = true

	if(TERMINATE) return;
	if(mode === 'q3cpp' || mode === 'all' || mode === 'tools')
		await buildTools(mode === 'all' ? self.toolsRepository : selected, 'q3cpp', mode === 'q3cpp', true);

	if(TERMINATE) return;
	if(mode === 'q3lcc' || mode === 'all' || mode === 'tools')
		await buildTools(mode === 'all' ? self.toolsRepository : selected, 'q3lcc', mode === 'q3lcc', true);

	if(TERMINATE) return;

	if(selected === self.tools2Repository)
	{
		await downloadHeaders(asmToolHeaders, 10, mode === 'all' || mode === 'tools' ? self.tools2Repository : selected);
	}

	if(mode === 'q3asm' || mode === 'all' || mode === 'tools')
		await buildTools(mode === 'q3asm' || mode === 'tools' ? selected : self.tools2Repository, 'q3asm', mode === 'q3asm', true);




	if(TERMINATE) return;

	if(selected === self.gameRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await downloadHeaders(qvmHeaders, 10, mode === 'all' ? self.gameRepository : selected);
	}

	if(TERMINATE) return;

	if(mode === 'game' || mode === 'all' || mode === 'qvms')
		await buildModule('game', self.dirs.QADIR, gameFiles, mode === 'all' ? self.gameRepository : selected, ['QAGAME'], mode === 'game', false, true);

	if(TERMINATE) return;
	if(mode === 'cgame' || mode === 'all' || mode === 'qvms')
		await buildModule('cgame', self.dirs.CGDIR, cgameFiles, mode === 'all' ? self.gameRepository : selected, ['CGAME'], mode === 'cgame', false, true);

	if(TERMINATE) return;
	if(mode === 'ui' || mode === 'all' || mode === 'qvms')
		await buildModule('ui', self.dirs.UIDIR, uiFiles, mode === 'all' ? self.gameRepository : selected, ['UI'], mode === 'ui', false, true);

	if(TERMINATE) return;
	if(mode === 'q3_ui' || mode === 'all' || mode === 'qvms')
		await buildModule('q3_ui', self.dirs.Q3UIDIR, q3uiFiles, mode === 'all' ? self.gameRepository : selected, ['UI'], mode === 'q3_ui', false, true);


}



async function link(argv, database)
{
	const mode = argv[0] || 'engine';


	let selected = argv[1] || self.engineRepository || database;
	if(api)
	{
		api.database = selected;
	}
	if(mode === 'q3lcc'
		|| mode === 'q3rcc'
		|| mode === 'q3cpp'
		|| mode === 'lburg'
		|| mode === 'tools'
	)
		selected = argv[1] || self.toolsRepository;
	if(mode === 'q3asm')
		selected = argv[1] || self.tools2Repository;
	if(mode === 'all'
		|| mode === 'release'
		|| mode === 'debug'
		|| mode === 'stringify'
		|| mode === 'shaders'
		|| mode === 'client'
		|| mode === 'engine'
		|| mode === 'server'
	)
		selected = argv[1] || self.engineRepository;

	if(mode === 'cgame'
		|| mode === 'game'
		|| mode === 'ui'
		|| mode === 'q3_ui'
		|| mode === 'qvms'
	)
		selected = argv[1] || self.gameRepository;


	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;
	if(selected && !self.filesRepo[selected])
	{
		let branch = await self.getDefaultBranch(ownerName, repoName);
		await self.loadGitHubTree(ownerName, repoName, branch);
	}

	if(TERMINATE) return;

	if(api)
	{
		api.configuration = self.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
	}


	terminalWrite(`Starting ${mode} linking...\n\r`);


	if(selected === self.engineRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await downloadHeaders(q3eCommonHeaders, 10, mode === 'all' ? self.engineRepository : selected);
	}

	if(TERMINATE) return;


	if(mode === 'stringify' || mode === 'all')
		await linkStringify(mode === 'all' ? self.engineRepository : selected, true);

	if(TERMINATE) return;
	if(mode === 'client' || mode === 'engine'
		|| mode === 'shaders' || mode === 'release'
		|| mode === 'debug' || mode === 'all'
	)
		await linkEngine(mode === 'all' ? self.engineRepository : selected, true);

	if(TERMINATE) return;


	if(selected === self.toolsRepository)
	{
		await downloadHeaders(lccToolHeaders, 10, mode === 'all' ? self.toolsRepository : selected);
	}



	if(TERMINATE) return;
	if(mode === 'lburg' || mode === 'tools' || mode === 'all')
		await linkLburg(mode === 'all' ? self.toolsRepository : selected, true);

	if(TERMINATE) return;
	if(mode === 'q3rcc' || mode === 'tools' || mode === 'all')
		await linkRCC(mode === 'all' ? self.toolsRepository : selected, true);

	if(TERMINATE) return;
	if(mode === 'q3cpp' || mode === 'tools' || mode === 'all')
		await linkCPP(mode === 'all' ? self.toolsRepository : selected, true);

	if(TERMINATE) return;
	if(mode === 'q3lcc' || mode === 'tools' || mode === 'all')
		await linkLCC(mode === 'all' ? self.toolsRepository : selected, true);

	if(TERMINATE) return;

	if(selected === self.tools2Repository)
	{
		await downloadHeaders(asmToolHeaders, 10, mode === 'all' || mode === 'tools' ? self.tools2Repository : selected);
	}


	if(TERMINATE) return;
	if(mode === 'q3asm' || mode === 'tools' || mode === 'all')
		await linkAsm(mode === 'all' || mode === 'tools' ? self.tools2Repository : selected, true);

	if(TERMINATE) return;
	if(selected === self.gameRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await downloadHeaders(qvmHeaders, 10, mode === 'all' ? self.gameRepository : selected);
	}
	if(TERMINATE) return;


	if(mode === 'game' || mode === 'qvms' || mode === 'all')
		await linkModule(mode === 'all' ? self.gameRepository : selected, 'game', self.dirs.QADIR, gameFiles, true, false, true);

	if(TERMINATE) return;
	if(mode === 'cgame' || mode === 'qvms' || mode === 'all')
		await linkModule(mode === 'all' ? self.gameRepository : selected, 'cgame', self.dirs.CGDIR, cgameFiles, true, false, true);

	if(TERMINATE) return;
	if(mode === 'ui' || mode === 'qvms' || mode === 'all')
		await linkModule(mode === 'all' ? self.gameRepository : selected, 'ui', self.dirs.UIDIR, uiFiles, true, false, true);

	if(TERMINATE) return;
	if(mode === 'q3_ui' || mode === 'qvms' || mode === 'all')
		await linkModule(mode === 'all' ? self.gameRepository : selected, 'q3_ui', self.dirs.Q3UIDIR, q3uiFiles, true, false, true);

	if(TERMINATE) return;

	// TODO: link dedicated server

}

async function header(argv, database)
{
	let selected = self.toolsRepository || argv[1] || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;
	let headers = [argv[0]];

	if(!argv[0])
		headers = [...lccToolHeaders];

	if(!self.filesRepo[selected])
	{
		let branch = await self.getDefaultBranch(ownerName, repoName);
		await self.loadGitHubTree(ownerName, repoName, branch);
	}

	for(let header of headers)
	{
		let sha = self.filesRepo[selected]?.[header].sha;

		await self.cacheFile(self.DB_STORE_NAME, ownerName, repoName, header, sha);
		await api?.header(ownerName, repoName, header, selected);
	}
}



async function compileWorker(argv, database, commandName, term)
{
	let file = argv[0] || currentSession();
	let selected = argv[1] || self.engineRepository || database;

	if(file.includes('src')
		|| file.includes('cpp')
		|| file.includes('etc')
		|| file.includes('lburg')
	)
	{
		selected = self.toolsRepository;
	}

	if(q3asmFiles.indexOf(file) > -1)
	{
		selected = self.tools2Repository;
	}


	if(file.includes('code/client')
		|| file.includes('code/server')
		|| file.includes('code/qcommon')
		|| file.includes('code/renderer2')
		|| file.includes('code/botlib')
		|| file.includes('code/wasm')
		|| file.includes('code/renderercommon')
	)
	{
		selected = self.engineRepository;
	}

	if(file.includes('code/cgame')
		|| file.includes('code/game')
		|| file.includes('code/q3_ui')
		|| file.includes('code/ui')
	)
	{
		selected = self.gameRepository;
	}


	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;

	if(!self.filesRepo[selected])
	{
		let branch = await self.getDefaultBranch(ownerName, repoName);
		await self.loadGitHubTree(ownerName, repoName, branch);
	}

	if(TERMINATE) return;

	if(selected === self.engineRepository
		|| file.includes('code/client')
		|| file.includes('code/server')
		|| file.includes('code/qcommon')
		|| file.includes('code/renderer2')
		|| file.includes('code/botlib')
		|| file.includes('code/wasm')
		|| file.includes('code/renderercommon')) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await downloadHeaders(q3eCommonHeaders, 10, selected);
	}

	if(TERMINATE) return;

	if(selected === self.gameRepository || file.includes('code/game')
		|| file.includes('code/cgame') || file.includes('code/ui')
		|| file.includes('code/q3_ui')) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await downloadHeaders(qvmHeaders, 10, selected);
	}

	if(TERMINATE) return;

	if(selected === self.toolsRepository || file.includes('src/')
		|| file.includes('cpp/') || file.includes('etc/')
		|| file.includes('lburg/'))
	{
		await downloadHeaders(lccToolHeaders, 10, selected);
	}

	if(TERMINATE) return;

	if(selected === self.tools2Repository || q3asmFiles.indexOf(file) > -1)
	{
		await downloadHeaders(asmToolHeaders, 10, selected);
	}

	if(TERMINATE) return;

	//let sha = filesRepo[selected][file].sha
	let contents = await self.cacheFile(self.DB_STORE_NAME, ownerName, repoName, file);

	if(api)
	{
		api.configuration = self.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
	}

	let CONFIGURATION = api?.configuration === 'release'
		? self.dirs.ENGINE_RELEASE
		: self.dirs.ENGINE_DEBUG;


	let srcPath = file.replace('.o', '.c');
	let obj = CONFIGURATION + '/' + file.replace('.c', '.o');
	let outPath = CONFIGURATION + '/' + file.replace('.c', '.asm');


	if(TERMINATE) return;


	if(selected === self.gameRepository
		|| file.includes('code/cgame')
		|| file.includes('code/game')
		|| file.includes('code/q3_ui')
		|| file.includes('code/ui')
	)
	{

		let DEFINE = ['-DGAME'];
		let vm = 'game';
		if(file.includes('code/cgame'))
		{
			DEFINE = ['-DCGAME', "-Icode/cgame"];
			vm = 'cgame';
		}
		if(file.includes('code/q3_ui'))
		{
			DEFINE = ['-DUI', "-Icode/ui"];
			vm = 'ui';
		}
		if(file.includes('code/ui'))
		{
			DEFINE = ['-DUI', "-Icode/q3_ui"];
			vm = 'q3_ui';
		}


		let tempPath = CONFIGURATION + '/' + srcPath.replace('.c', '.i');

		/*
q3lcc -v -v -D__LCC__ -D__CHAR_UNSIGNED__ -U_CHAR_IS_SIGNED -DQ3_VM -D_Q3_VM -Icode/game -Icode/cgame -Icode/q3_ui code/g
ame/bg_lib.c build/debug-wasm-js/code/game/bg_lib.i
q3lcc $Id$
code/game/bg_lib.c:
q3cpp -D__STDC__=1 -D__STRICT_ANSI__ -D__signed__=signed -DQ3_VM -D__LCC__ -D__LCC__ -D__CHAR_UNSIGNED__ -U_CHAR_IS_SIGNED
-DQ3_VM -D_Q3_VM -Icode/game -Icode/cgame -Icode/q3_ui code/game/bg_lib.c /tmp/lcc420.i
q3rcc -target=bytecode -v /tmp/lcc420.i bg_lib.asm
build/debug-wasm-js/code/game/bg_lib.i:
q3rcc -target=bytecode -v build/debug-wasm-js/code/game/bg_lib.i bg_lib.asm
rm /tmp/lcc420.i
*/

		/*

				await api.run({
					tool: 'q3cpp.js.wasm',
					args: [
						'q3cpp', // '-v', '-v',
						"-Icode/game",
						...DEFINE,
						srcPath,
						tempPath,
					],
					database: selected,
					toolsRepo: toolsRepo,
					paths: [file, tempPath],

					// TODO:
					contents: contents,
					width: term.cols,
					input: srcPath,
					tempPath,
					github_token: api.github_token
				})

				await api.run({
					tool: 'q3rcc.js.wasm',
					args: [
						'q3rcc', // '-v', '-v',
						'-target=bytecode',
						//(configuration.value === 'pre' ? '-g' : '-g2'),
						'-v',
						tempPath,
						outPath //.split('/').pop(),
					],
					database: selected,
					toolsRepo: toolsRepo,
					paths: [outPath, tempPath],
				})

				*/

		if(self.SettingsToolbar?.configuration?.value === 'qvms')
		{
			await api?.run({
				tool: 'q3lcc.js.wasm',
				args: [
					'q3lcc', '-v', '-v', '-S', '-Wf-g',  //  '-Wf-g', '-S',
					"-Icode/game",
					...DEFINE,
					srcPath,
					'-o', outPath,
				],
				database: selected,
				toolsRepo: self.toolsRepository,
				paths: [outPath, srcPath],
			});

		} else
		{
			await api?.run({
				tool: 'clang.wasm',
				args: [
					'clang',
					...QVMLIB_CFLAGS,
					"-Icode/game",
					...DEFINE,
					...(srcPath.includes('bg_lib.c') ? ['-DQ3_VM=1'] : []),
					srcPath,
					'-o', obj,
				],
				database: selected,
				toolsRepo: self.toolsRepository,
				paths: [obj, srcPath],
			});

		}


		return;
	}

	// TODO: clang -E -P -fminimize-whitespace file.c


	const INCLUDES = selected === self.engineRepository
		? [...CFLAGS, "-Icode/wasm", "-Icode/qcommon", "-Icode/client", "-Icode/game"]
		: [...LCC_CFLAGS, "-Isrc"];

	return await api?.compile({
		CFLAGS: [
			...INCLUDES,
			...(self.SettingsToolbar?.configuration?.value === 'pre' ? [
				'-o', obj.replace('.o', '.a')
			] : ['-o', obj]),
			srcPath
		],
		contents: contents,
		width: term.cols,
		input: srcPath,
		database: selected,
		obj,
		github_token: api?.github_token
	});
}


async function clang(argv, database, commandName, term)
{

	let CONFIGURATION = api?.configuration === 'release'
		? self.dirs.ENGINE_RELEASE
		: self.dirs.ENGINE_DEBUG;

	let file = argv[0] || currentSession();
	return await api?.compile({
		CFLAGS: argv,
		contents: aceEditor.getValue(),
		width: term.cols,
		input: file,
		database: database,
		obj: file ? CONFIGURATION + '/' + file.replace('.c', '.o') : null
	});
}





async function runWorker(argv, database)
{
	if(!argv[0] || argv[0].trim().length === 0
		|| argv[0].includes('quake3e')
		// TODO: remove conflict down below by running engine and dedicated in a worker
		|| argv[0].includes('engine')
		|| argv[0].includes('client')
		|| argv[0].includes('q3')
	)
	{
		return loadCommand(argv[0]);
	}

	let thisDatabase = database;
	if(argv[0].includes('lburg')
		|| argv[0].includes('q3lcc')
		|| argv[0].includes('q3rcc')
		|| argv[0].includes('q3cpp')
		|| argv[0].includes('q3asm')
	)
		thisDatabase = self.toolsRepository;
	if(argv[0].includes('stringify')
		|| argv[0].includes('quake3e')
		|| argv === 'dedicated')
		thisDatabase = self.engineRepository;

	return await api?.run({
		tool: argv[0],
		args: argv,
		database: thisDatabase,
		toolsRepo: self.toolsRepository
	});
}


async function lburg(argv, database)
{
	let selected = self.toolsRepository || argv[1] || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;

	if(!self.filesRepo[selected])
	{
		let branch = await self.getDefaultBranch(ownerName, repoName);
		await self.loadGitHubTree(ownerName, repoName, branch);
	}

	if(api)
	{
		api.configuration = self.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
	}

	let CONFIGURATION = api?.configuration === 'release'
		? self.dirs.ENGINE_RELEASE
		: self.dirs.ENGINE_DEBUG;


	let paths = [
		argv[0] || 'src/dagcheck.md',
		argv[1] || path.join(CONFIGURATION, argv[0] ? argv[0].replace('.md', '.c') : 'src/dagcheck.c'),
	];

	await self.cacheFile(self.DB_STORE_NAME, ownerName, repoName, paths[0], (self.filesRepo[selected]?.[paths[0]] || {}).sha);


	let args = [
		'lburg.js.wasm',
		...paths,
		...argv.slice(2)
	];

	return await api?.run({
		tool: 'lburg.js.wasm',
		args: args,
		database: selected,
		toolsRepo: self.toolsRepository,
		paths: paths,
		github_token: api.github_token
	});
}

async function lcc(argv)
{
	return self.COMMAND_SCHEMA['clang'].execute?.(argv);
}



async function wasm(argv, database = null)
{
	return await api?.link({
		LDFLAGS: argv,
		database: database,
		github_token: api?.github_token
	});
}


function kill()
{
	api?.terminate?.();
	//api.worker.terminate()
}
