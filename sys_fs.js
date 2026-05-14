// ZERO DEPENDENCY BARE-BONES JAVASCRIPT FILE-SYSTEM FOR 
//   POSIX WEB-ASSEMBLY

const VFS_NOW = 3
const ST_FILE = 8
const ST_DIR = 4

// 438 = 0o666
const FS_DEFAULT = (6 << 3) + (6 << 6) + (6)
const FS_FILE = (ST_FILE << 12) + FS_DEFAULT
const FS_DIR = (ST_DIR << 12) + FS_DEFAULT

// (33206 & (((1 << 3) - 1) << 3) >> 3 = 6
const S_IRGRP = ((1 << 3) - 1) << 3
const S_IRUSR = ((1 << 3) - 1) << 6
const S_IROTH = ((1 << 3) - 1) << 0

const ENOENT = 9968
const R_OK = 1
const W_OK = 2
const X_OK = 3
const F_OK = 4


function Sys_Mkdir(filename) {
	let fileStr = addressToString(filename)
	let localName = fileStr
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName[0] != '/')
		localName = '/' + localName
	if (!localName.startsWith('/base')
		&& !localName.startsWith('/home'))
		localName = '/base' + localName
	// check if parent directory has been created, TODO: POSIX errno?
	let parentDirectory = localName.substring(0, localName.lastIndexOf('/'))
	if (parentDirectory && !FS.virtual[parentDirectory]) {
		throw new Error('ENOENT')
	}
	FS.virtual[localName] = {
		timestamp: new Date(),
		mode: FS_DIR,
		size: 4096,
		path: localName,
		parent: localName.substring(0, localName.lastIndexOf('/'))
	}
	// async to filesystem
	// does it REALLY matter if it makes it? wont it just redownload?
	Sys_notify(FS.virtual[localName], localName)
}

function Sys_GetFileStats(filename, size, mtime, ctime) {

	let fileStr = addressToString(filename)
	let localName = fileStr
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName[0] != '/')
		localName = '/' + localName
	if (!localName.startsWith('/base')
		&& !localName.startsWith('/home'))
		localName = '/base' + localName
	if (typeof FS.virtual[localName] != 'undefined') {
		HEAPU32[size >> 2] = (FS.virtual[localName].contents || []).length
		HEAPU32[mtime >> 2] = FS.virtual[localName].timestamp.getTime()
		HEAPU32[ctime >> 2] = FS.virtual[localName].timestamp.getTime()
		return 1
	} else {
		HEAPU32[size >> 2] = 0
		HEAPU32[mtime >> 2] = 0
		HEAPU32[ctime >> 2] = 0
		return 0
	}
}


const REMOTE_MODELS = {}


function Sys_FOpen(filename, mode) {

	// now we don't have to do the indexing crap here because it's built into the engine already
	let fileStr = addressToString(filename)
	let extName
	if (fileStr.includes('.')) {
		extName = fileStr.substring(fileStr.lastIndexOf('.')).toLowerCase()
	}
	let modeStr = addressToString(mode)
	let localName = fileStr.trim()

	//console.log(localName)
	if (localName.startsWith('/')) localName = localName;
	if (localName.startsWith('base/')) localName = localName.substring(5);
	if (localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if (localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);

	let createFP = function () {
		FS.filePointer++
		FS.pointers[FS.filePointer] = [
			0, // seek/tell
			modeStr,
			FS.virtual[localName],
			localName,
			FS.filePointer
		]
		// DO THIS ON OPEN SO WE CAN CHANGE ICONS
		Sys_notify(FS.virtual[localName], localName)
		return FS.filePointer // not zero
	}

	// check if parent directory has been created, TODO: POSIX errno?
	let parentDirectory = localName.substring(0, localName.lastIndexOf('/'))
	// TODO: check mode?
	if (typeof FS.virtual[localName] != 'undefined'
		&& (FS.virtual[localName].mode >> 12) == ST_FILE) {
		// open the file successfully
		return createFP()
	} else
		// only write+ files after they have all been loaded, so we don't accidentally overwrite
		if (/* !FS.isSyncing && */ modeStr.includes('w')
			&& (typeof FS.virtual[parentDirectory] != 'undefined'
				// allow writing to root path
				|| parentDirectory.length == 0)
		) {
			// create the file for write because the parent directory exists
			debugger
			FS.virtual[localName] = {
				timestamp: new Date(),
				mode: FS_FILE,
				contents: new Uint8Array(0),
				path: localName,
				parent: localName.substring(0, localName.lastIndexOf('/'))
			}
			return createFP()
		} else if (typeof FS_GetCurrentGameDir != 'undefined') {
			let gamedir = addressToString(FS_GetCurrentGameDir())
			if (localName.startsWith(gamedir + '/'))
				localName = localName.substring(gamedir.length + 1)

			// TODO: if MD3/IQM try to load remotely
			if (typeof REMOTE_MODELS[localName] == 'undefined'
				&& typeof REMOTE_MODELS[localName.replace(extName, '')] == 'undefined'
				&& (extName == '.md3' || extName == '.iqm')) {
				// ?alt will redirect to the correct extension and `ui_breadCrumb` will pick it up regardless
				REMOTE_MODELS[localName.replace(extName, '')] = REMOTE_MODELS[localName] = true

				let remoteFile = 'pak0.pk3dir/' + localName
				Promise.resolve(Com_DL_Begin(gamedir + '/' + remoteFile, '/' + gamedir + '/' + remoteFile + '?alt')
					.then(function (responseData) {
						Com_DL_Perform(gamedir + '/' + remoteFile, remoteFile, responseData)
						Cvar_Set(stringToAddress('ui_breadCrumb'), stringToAddress(localName))
						if (responseData)
							FS_RecordFile(stringToAddress(localName))
					}))
			}

			return 0 // POSIX
		}
}

function Sys_FTell(pointer) {
	if (typeof FS.pointers[pointer] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	return FS.pointers[pointer][0]
}

function Sys_llseek(pointer, position, mode) {
	debugger
	if (typeof FS.pointers[pointer] === 'undefined') {
		throw new Error('EBADF');
	}

	// Convert everything to BigInt for the calculation to be safe
	let currentPos = BigInt(FS.pointers[pointer][0]);
	let offset = BigInt(position);
	let fileSize = BigInt(FS.pointers[pointer][2].contents.length);

	let newPos;
	if (mode === 0 /* SEEK_SET */) {
		newPos = offset;
	} else if (mode === 1 /* SEEK_CUR */) {
		newPos = currentPos + offset;
	} else if (mode === 2 /* SEEK_END */) {
		newPos = fileSize + offset;
	} else {
		return -1;
	}

	// Update the pointer (store back as Number if your VFS prefers it, 
	// but BigInt is safer for large files)
	FS.pointers[pointer][0] = Number(newPos);

	// llseek / fd_seek usually returns the new position, not just 0
	return newPos;
}

/**
 * WASI fd_seek(fd, offset_low, offset_high, whence, new_offset_ptr)
 * Clang/WASI usually passes the i64 offset as two 32-bit ints or a BigInt
 */
function fd_seek(fd, offset, whence, newOffsetPtr) {

	let stream = FS.pointers[fd];
	if (!stream) return 8; // WASI_EBADF
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}
	//console.log(stream[3])

	// 1. Force everything to BigInt for consistent 64-bit math
	let bigOffset = BigInt(offset);
	let currentPos = BigInt(stream[0]);
	let fileSize = BigInt(stream[2].contents.length);

	let newPos;

	switch (whence) {
		case 0: // SET
			newPos = bigOffset;
			break;
		case 1: // CUR
			newPos = currentPos + bigOffset;
			break;
		case 2: // END
			newPos = fileSize + bigOffset;
			break;
		default:
			return 28; // WASI_EINVAL
	}

	if (newPos < 0n) return 28; // WASI_EINVAL (can't seek before start)

	// 2. Update the internal pointer (back to Number if your FS expects it)
	stream[0] = Number(newPos);

	// 3. Write the result back to memory (64-bit)
	const view = new DataView(Module.memory.buffer);
	view.setUint32(newOffsetPtr, Number(newPos & 0xFFFFFFFFn), true);
	view.setUint32(newOffsetPtr + 4, Number(newPos >> 32n), true);

	return 0; // WASI_ESUCCESS
}

function Sys_FClose(pointer) {
	if (typeof FS.pointers[pointer] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	Sys_notify(FS.pointers[pointer][2], FS.pointers[pointer][3], FS.pointers[pointer][4])
	FS.pointers[pointer] = void 0
	return 0
}


function Sys_FFlush(pointer) {
	if (typeof FS.pointers[pointer] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	Sys_notify(FS.pointers[pointer][2], FS.pointers[pointer][3], FS.pointers[pointer][4])
}

function Sys_Remove(file) {
	let fileStr = addressToString(file)
	let localName = fileStr
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName[0] != '/')
		localName = '/' + localName
	if (!localName.startsWith('/base')
		&& !localName.startsWith('/home'))
		localName = '/base' + localName
	if (typeof FS.virtual[localName] != 'undefined') {
		delete FS.virtual[localName]
		// remove from IDB
		Sys_notify(false, localName)
	}
}

function Sys_Rename(src, dest) {
	let strStr = addressToString(src)
	let srcName = strStr
	if (srcName.startsWith('//'))
		srcName = srcName.substring(1)
	if (srcName.startsWith('/base')
		|| srcName.startsWith('/home'))
		srcName = srcName.substring('/base'.length)
	if (srcName[0] == '/')
		srcName = srcName.substring(1)
	let fileStr = addressToString(dest)
	let destName = fileStr
	if (destName.startsWith('//'))
		destName = destName.substring(1)
	if (destName.startsWith('/base')
		|| destName.startsWith('/home'))
		destName = destName.substring('/base'.length)
	if (destName[0] == '/')
		destName = destName.substring(1)
	if (typeof window.updateFilelist != 'undefined') {
		Sys_notify(FS.virtual[srcName], srcName)
		Sys_notify(FS.virtual[destName], destName)
	}
}


function Sys_ListFiles(directory, extension, filter, numfiles, wantsubs) {
	let files = {
		'default.cfg': {
			mtime: 0,
			size: 1024,
		}
	}
	let dironly = wantsubs
	// TODO: don't combine /home and /base?
	let localName = addressToString(directory)
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName[0] != '/')
		localName = '/' + localName
	if (!localName.startsWith('/base')
		&& !localName.startsWith('/home'))
		localName = '/base' + localName
	let extensionStr = addressToString(extension)
	//let matches = []
	// can't use utility because FS_* frees and moves stuff around
	let matches = Object.keys(FS.virtual).filter(function (key) {
		let subdirI = key.substring(localName.length + 1).indexOf('/')
		return (!extensionStr || key.endsWith(extensionStr)
			|| (extensionStr == '/' && (FS.virtual[key].mode >> 12) == ST_DIR))
			// TODO: match directory 
			&& (key[localName.length] == '/')
			&& (wantsubs || subdirI == -1 || subdirI == key.length - 1)
			&& (!localName || key.startsWith(localName))
			&& (!dironly || (FS.virtual[key].mode >> 12) == ST_DIR)
	})
	// return a copy!
	let listInMemory
	if (typeof Z_Malloc != 'undefined') {
		listInMemory = Z_Malloc((matches.length + 1) * 4)
	} else {
		listInMemory = malloc((matches.length + 1) * 4)
	}
	for (let i = 0; i < matches.length; i++) {
		let relativeName = matches[i]
		if (localName && relativeName.startsWith(localName)) {
			relativeName = relativeName.substring(localName.length)
		}
		if (relativeName[0] == '/')
			relativeName = relativeName.substring(1)
		//matches.push(files[i])
		HEAPU32[(listInMemory + i * 4) >> 2] = FS_CopyString(stringToAddress(relativeName));
	}
	HEAPU32[(listInMemory >> 2) + matches.length] = 0
	HEAPU32[numfiles >> 2] = matches.length
	// skip address-list because for-loop counts \0 with numfiles
	return listInMemory
}


function Sys_stat(filename) {
	debugger
	let fileStr = addressToString(filename)
	let localName = fileStr
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName.startsWith('/base')
		|| localName.startsWith('/home'))
		localName = localName.substring('/base'.length)
	if (localName[0] == '/')
		localName = localName.substring(1)
	//if(typeof FS.virtual[localName] != 'undefined') {
	//  localName = localName
	//}
	if (typeof FS.virtual[localName] != 'undefined') {
		HEAPU32[(stat >> 2) + 0] = FS.virtual[localName].mode
		HEAPU32[(stat >> 2) + 1] = (FS.virtual[localName].contents || []).length
		HEAPU32[(stat >> 2) + 2] = FS.virtual[localName].timestamp.getTime()
		HEAPU32[(stat >> 2) + 3] = FS.virtual[localName].timestamp.getTime()
		HEAPU32[(stat >> 2) + 4] = FS.virtual[localName].timestamp.getTime()
		return 0
	} else {
		HEAPU32[(stat >> 2) + 0] = 0
		HEAPU32[(stat >> 2) + 1] = 0
		HEAPU32[(stat >> 2) + 2] = 0
		HEAPU32[(stat >> 2) + 3] = 0
		HEAPU32[(stat >> 2) + 4] = 0
		return 1
	}
}


function Sys_Mkdirp(pathname) {
	let localName = addressToString(pathname)
	try {
		if (localName.startsWith('//'))
			localName = localName.substring(1)
		if (localName[0] != '/')
			localName = '/' + localName
		if (!localName.startsWith('/base')
			&& !localName.startsWith('/home'))
			localName = '/base' + localName
		Sys_Mkdir(pathname, FS_DIR);
	} catch (e) {
		// make the subdirectory and then retry
		if (e.message === 'ENOENT') {
			let parentDirectory = localName.substring(0, localName.lastIndexOf('/'))
			if (!parentDirectory) {
				throw e
			}
			Sys_Mkdirp(stringToAddress(parentDirectory));
			Sys_Mkdir(pathname);
			return;
		}

		// if we got any other error, let's see if the directory already exists
		if (Sys_stat(pathname)) {
			throw e
		}
	}
}

function Sys_FRead(bufferAddress, byteSize, count, pointer) {
	if (typeof FS.pointers[pointer] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	let i = 0
	for (; i < count * byteSize; i++) {
		if (FS.pointers[pointer][0] >= FS.pointers[pointer][2].contents.length) {
			break
		}
		HEAPU8[bufferAddress + i] = FS.pointers[pointer][2].contents[FS.pointers[pointer][0]]
		FS.pointers[pointer][0]++
	}

	return (i - (i % byteSize)) / byteSize
}


function Sys_fgetc(fp) {
	let c = stringToAddress('DEADBEEF')
	HEAPU32[c >> 2] = 0
	if (Sys_FRead(c, 1, 1, fp) != 1) {
		return -1
	}
	return HEAPU32[c >> 2]
}


function Sys_fgets(buf, size, fp) {
	if (typeof FS.pointers[fp] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	let dataView = FS.pointers[fp][2].contents
		.slice(FS.pointers[fp][0], FS.pointers[fp][0] + size)
	let line = dataView.indexOf('\n'.charCodeAt(0))
	let length
	if (line <= 1) {  // <- TODO: WTF IS THIS?
		//length = Sys_FRead(buf, 1, size - 1, fp)
		length = Sys_FRead(buf, 1, size, fp)
		//HEAPU8[buf + length] = 0 // FILL THE BUFFER COMPLETELY?
		return length ? buf : 0
	} else {
		length = Sys_FRead(buf, 1, line + 1, fp) // DO I INCLUDE THE \n IN THE BUFFER?
		HEAPU8[buf + length] = 0
		return length ? buf : 0
	}
}

function Sys_FWrite(buf, size, nmemb, pointer) {
	// something wrong with breaking inside `node -e`
	//   maybe someone at Google saw my stream because they made it even worse.
	//   now it shows Nodejs system code all the time instead of only when I 
	//   click on it like resharper. LOL!
	if (typeof FS.pointers[pointer] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	let tmp = FS.pointers[pointer][2].contents
	if (FS.pointers[pointer][0] + size * nmemb > FS.pointers[pointer][2].contents.length) {
		tmp = new Uint8Array(FS.pointers[pointer][2].contents.length + size * nmemb);
		tmp.set(FS.pointers[pointer][2].contents, 0);
	}
	tmp.set(HEAPU8.slice(buf, buf + size * nmemb), FS.pointers[pointer][0]);
	FS.pointers[pointer][0] += size * nmemb
	// WE DON'T NEED FILE LOCKING BECAUSE IT'S SINGLE THREADED IN NATURE
	//   IT WOULD BE IMPOSSIBLE FOR ANOTHER PROCESS TO COME ALONG AND
	//   OVERWRITE OUR TMP CONTENTS MID FUNCTION.
	FS.pointers[pointer][2].contents = tmp
	Sys_notify(FS.pointers[pointer][2], FS.pointers[pointer][3], FS.pointers[pointer][4])
	return nmemb // k==size*nmemb ? nmemb : k/size;
}


// WHY ADD THIS INSTEAD OF FWRITE DIRECTLY? 
//   TO MAKE IT EASIER TO DROP INFRONT OF WASI BS.
function Sys_fputs(s, f) {
	let l = addressToString(s).length;
	return Sys_FWrite(s, 1, l, f) == l ? 0 : -1;
}

function Sys_fputc(c, f) {
	let s = stringToAddress(String.fromCharCode(c))
	return Sys_FWrite(s, 1, 1, f) == 1 ? 0 : -1;
}

function Sys_fprintf(fp, fmt, args) {
	let formatted = stringToAddress('DEADBEEF')
	let length = sprintf(formatted, fmt, args)
	if (length < 1 || !HEAPU32[formatted >> 2]) {
		formatted = fmt
	}
	Sys_fputs(formatted, fp)
}

function Sys_access(filename, i) {
	if (i != F_OK) {
		throw new Error('Not implemented!')
	}
	let fileStr = addressToString(filename)
	let localName = fileStr
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName.startsWith('/base')
		|| localName.startsWith('/home'))
		localName = localName.substring('/base'.length)
	if (localName[0] == '/')
		localName = localName.substring(1)

	if (FS.virtual[localName]) {
		return 0
	} else {
		if (Module.errno.value) {
			HEAPU32[Module.errno.value >> 2] = ENOENT
		}
		return 1
	}
}


function Sys_feof(fp) {
	if (typeof FS.pointers[fp] == 'undefined') {
		return 1
	}
	if (FS.pointers[fp][0] >= FS.pointers[fp][2].contents.length) {
		return 1
	}
	return 0
}

const FS = {
	ST_FILE: ST_FILE,
	ST_DIR: ST_DIR,
	FS_FILE: FS_FILE,
	FS_DIR: FS_DIR,
	ENOENT: ENOENT,
	modeToStr: ['r', 'w', 'rw'],
	pointers: {
		0: [0, 'r', {
			timestamp: new Date(),
			mode: FS_FILE,
			size: 0,
			contents: new Uint8Array(),
			path: '/dev/stdin',
			parent: '/dev'
		}, '/dev/stdin', 0],
		1: [0, 'w', {
			timestamp: new Date(),
			mode: FS_FILE,
			size: 0,
			contents: new Uint8Array(),
			path: '/dev/stdout',
			parent: '/dev'
		}, '/dev/stdout', 1],
		2: [0, 'w', {
			timestamp: new Date(),
			mode: FS_FILE,
			size: 0,
			contents: new Uint8Array(),
			path: '/dev/stderr',
			parent: '/dev'
		}, '/dev/stderr', 2],
		3: [0, 'rw', {
			timestamp: new Date(),
			mode: FS_DIR,
			size: 4096,
			path: '/',
			parent: ''
		}, '/', 3],
	},
	filePointer: 3,
	virtual: {
		'/': {
			timestamp: new Date(),
			mode: FS_DIR,
			size: 4096,
			path: '/',
			parent: ''
		},
		'.': {
			timestamp: new Date(),
			mode: FS_DIR,
			size: 4096,
			path: '.',
			parent: ''
		},
		'/home': {
			timestamp: new Date(),
			mode: FS_DIR,
			size: 4096,
			path: '/home',
			parent: '/'
		},
		'/tmp': {
			timestamp: new Date(),
			mode: FS_DIR, // ST_DIR + standard permissions
			size: 4096,
			path: '/tmp',
			parent: '/'
		}
	}, // temporarily store items as they go in and out of memory
	Sys_ListFiles: Sys_ListFiles,
	Sys_FTell: Sys_FTell,
	Sys_FSeek: fd_seek,
	Sys_llseek: Sys_llseek,
	Sys_FClose: Sys_FClose,
	Sys_FWrite: Sys_FWrite,
	Sys_FFlush: Sys_FFlush,
	Sys_FRead: Sys_FRead,
	Sys_FOpen: Sys_FOpen,
	Sys_Remove: Sys_Remove,
	Sys_Rename: Sys_Rename,
	Sys_GetFileStats: Sys_GetFileStats,
	Sys_Mkdir: Sys_Mkdir,
	Sys_Mkdirp: Sys_Mkdirp,
	Sys_FOpen: Sys_FOpen,
	fopen: Sys_FOpen,
	fd_open: Sys_FOpen,
	Sys_Mkdir: Sys_Mkdir,
	Sys_fgets: Sys_fgets,
	Sys_fputs: Sys_fputs,
	Sys_vfprintf: Sys_fprintf,
	Sys_fprintf: Sys_fprintf,
	Sys_fputc: Sys_fputc,
	Sys_putc: Sys_fputc,
	Sys_getc: Sys_fgetc,
	Sys_fgetc: Sys_fgetc,
	Sys_feof: Sys_feof,
	Sys_access: Sys_access,
	Sys_umask: function () { },
	getStreamChecked: getStreamChecked,

	// --- Low-Level IO (Unistd.h) ---
	open: Sys_FOpen,
	read: Sys_FRead,
	write: Sys_FWrite,
	lseek: Sys_llseek,
	close: Sys_FClose,
	unlink: Sys_Remove,
	access: Sys_access,
	rmdir: Sys_Remove, // Simplified for your VFS
	mkdir: Sys_Mkdir,
	umask: function () { return 0; },
	getpid: getpid,

	// --- Stream IO (Stdio.h) ---
	fopen: Sys_FOpen,
	fclose: Sys_FClose,
	fread: Sys_FRead,
	fwrite: Sys_FWrite,
	fseek: fd_seek,
	ftell: Sys_FTell,
	fflush: Sys_FFlush,
	fgets: Sys_fgets,
	fputs: Sys_fputs,
	fprintf: Sys_fprintf,
	vfprintf: Sys_fprintf,
	fputc: Sys_fputc,
	putc: Sys_fputc,
	fgetc: Sys_fgetc,
	getc: Sys_fgetc,
	feof: Sys_feof,

	// --- Directory & Metadata ---
	opendir: Sys_ListFiles, // Closest match for your readdir logic
	stat: Sys_stat,
	fstat: fd_filestat_get,
	rename: Sys_Rename,

	// --- Extensions / Internal ---
	mkdirp: Sys_Mkdirp,
}





function getStreamChecked(fd) {
	debugger
	// 1. Check if the file descriptor is within a valid range
	// In your library, FS.pointers or a similar mapping tracks open files
	var stream = FS.pointers[fd];

	if (!stream) {
		// Return a standard POSIX EBADF (Bad File Descriptor) error
		// WASI_EBADF is usually 8
		throw new Error('ENOENT')
	}

	return stream;
};

var WASI_ESUCCESS = 0;
var WASI_EBADF = 8;
var WASI_EINVAL = 28;
var WASI_ENOSYS = 52;

var WASI_STDOUT_FILENO = 1;
var WASI_STDERR_FILENO = 2;

function fd_prestat_get(fd, bufPtr) {
	// 1. Scoped result and early exit for invalid FDs
	if (fd !== VFS_NOW) {
		return 8; // WASI_EBADF (tells the guest to stop looking for drives)
	}

	const view = new DataView(Module.memory.buffer);

	// Offset 0: pr_type (0 = prestat_dir)
	view.setUint8(bufPtr, 0);

	// Offset 4: pr_name_len
	// We use 0 for the root mapping to match MemFs behavior
	view.setUint32(bufPtr + 4, 0, true);

	return 0; // WASI_ESUCCESS
}

function fd_prestat_dir_name(fd, pathPtr, pathLen) {
	if (fd !== VFS_NOW) {
		return 8; // WASI_EBADF
	}

	// 2. Compatible Root Logic
	// If pathLen is 0, we don't write anything, but we MUST return success (0)
	// if the guest provided a buffer (pathLen >= 1), we write the root '/'
	if (pathLen > 0) {
		const heap = new Uint8Array(Module.memory.buffer);
		heap[pathPtr] = 47; // ASCII for '/'
	}

	return 0; // WASI_ESUCCESS (Matches MemFs even for 0-length calls)
}

function fd_filestat_get(fd, bufPtr) {


	let stream = FS.pointers[fd];

	if (!stream) return 8; // WASI_EBADF
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}

	//console.log(stream[3])

	const view = new DataView(Module.memory.buffer);

	// Clear 64 bytes
	for (let i = 0; i < 64; i++) view.setUint8(bufPtr + i, 0);

	// 1. Resolve Metadata from your FS.virtual layout
	// stream[2] appears to be your 'node' containing the mode/size
	const node = stream[2] || { mode: FS_FILE, contents: new Uint8Array(0) };
	const modeType = node.mode >> 12;

	// Map your ST_DIR/ST_FILE to WASI types
	let type = 8; // regular_file
	if (fd <= 3) {
		type = (fd === 3) ? 4 : 3; // 4=dir, 3=char_device
	} else if (modeType === ST_DIR) {
		type = 4;
	}

	// 2. Populate the Buffer
	// Device and Inode (using 1 as placeholders)
	view.setUint32(bufPtr + 0, 1, true);
	view.setUint32(bufPtr + 8, fd, true); // Using FD as inode for simplicity

	// Filetype (Offset 16)
	view.setUint8(bufPtr + 16, type);

	// nlink (Offset 24)
	view.setUint32(bufPtr + 24, 1, true);

	// Size (Offset 32) - 64-bit
	const size = node.contents.length || 0;
	view.setUint32(bufPtr + 32, size, true);
	view.setUint32(bufPtr + 36, 0, true);

	// Timestamps (Offset 40, 48, 56)
	// WASI expects nanoseconds. Convert JS ms to ns.
	const nowNsLow = (Date.now() * 1000000) >>> 0;
	const nowNsHigh = Math.floor((Date.now() * 1000000) / 0x100000000);

	for (let offset of [40, 48, 56]) {
		view.setUint32(bufPtr + offset, nowNsLow, true);
		view.setUint32(bufPtr + offset + 4, nowNsHigh, true);
	}

	return 0; // WASI_ESUCCESS
}

function environ_sizes_get(environ_count_out, environ_buf_size_out) {
	const view = new DataView(Module.memory.buffer); // or Module.memory.buffer
	const names = Object.getOwnPropertyNames(Module.environment);

	let size = 0;
	for (const name of names) {
		const value = Module.environment[name];
		// "name=value\0"
		size += name.length + value.length + 2;
	}

	// WASI standard usually expects 32-bit for these counts/sizes
	view.setUint32(environ_count_out, names.length, true);
	view.setUint32(environ_buf_size_out, size, true);

	return WASI_ESUCCESS;
}

function environ_get(environ_ptrs, environ_buf) {
	const view = new DataView(Module.memory.buffer);
	const uint8 = new Uint8Array(Module.memory.buffer);
	const encoder = new TextEncoder();
	const names = Object.getOwnPropertyNames(Module.environment);

	let currentPtr = environ_ptrs;
	let currentBuf = environ_buf;

	for (const name of names) {
		// 1. Write the current buffer address to the pointer array
		view.setUint32(currentPtr, currentBuf, true);
		currentPtr += 4;

		// 2. Encode and write "name=value\0" into the buffer
		const str = `${name}=${Module.environment[name]}\0`;
		const encoded = encoder.encode(str);
		uint8.set(encoded, currentBuf);

		// 3. Advance buffer pointer by the actual byte length
		currentBuf += encoded.length;
	}

	// Null terminate the pointer array (optional but standard in some envs)
	// view.setUint32(currentPtr, 0, true); 

	return WASI_ESUCCESS;
}


function args_sizes_get(argcPtr, argvBufSizePtr) {
	var args = SYS.startArgs || [];
	var view = new DataView(Module.memory.buffer);

	// Number of arguments
	view.setUint32(argcPtr, args.length, true);

	// Total length of all strings + null terminators
	var totalLength = args.reduce((acc, str) => acc + str.length + 1, 0);
	view.setUint32(argvBufSizePtr, totalLength, true);

	return 0; // WASI_ESUCCESS
}
function args_get(argvPtr, argvBufPtr) {
	const args = SYS.startArgs || [];
	let currentBufPtr = argvBufPtr;
	const encoder = new TextEncoder();

	// Use the latest buffer from the module
	const buffer = Module.memory.buffer;
	const view = new DataView(buffer);
	const heap = new Int8Array(buffer); // Create a fresh view here

	args.forEach((arg, i) => {
		// 1. Write the pointer
		view.setUint32(argvPtr + (i * 4), currentBufPtr, true);

		// 2. Encode and set
		const bytes = encoder.encode(arg);

		// This is where the crash was happening; 
		// using 'heap' (the fresh view) prevents the detached error.
		heap.set(bytes, currentBufPtr);

		// 3. Null terminator
		heap[currentBufPtr + bytes.length] = 0;

		currentBufPtr += bytes.length + 1;
	});

	return 0;
}

function debug_print_mem(ptr, length) {
	const view = new Uint8Array(Module.memory.buffer, ptr, length);
	let hex = "";
	for (let i = 0; i < length; i++) {
		hex += view[i].toString(16).padStart(2, '0') + " ";
		if ((i + 1) % 8 === 0) hex += " | ";
	}
	console.log(`Memory at 0x${ptr.toString(16)} (${length} bytes):`);
	console.log(hex);
}



function fd_fdstat_get(fd, bufPtr) {


	let stream = FS.pointers[fd];

	if (!stream) return 8; // WASI_EBADF
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}

	//console.log(stream[3])

	const view = new DataView(Module.memory.buffer);

	// 1. Determine WASI Type
	let type = 8; // Default to ST_FILE (WASI Regular File)

	if (fd <= 3) {
		// Your log showed '3' for both fd 3 and lower streams
		type = VFS_NOW;
	} else if (stream && stream[2]) {
		// Extract the type from your FS.virtual mode (high 4 bits)
		const modeType = stream[2].mode >> 12;
		if (modeType === ST_DIR) {
			type = 4; // Directory
		} else if (modeType === ST_FILE) {
			type = 8; // Regular File
		}
	}

	// 2. Clear buffer and set values
	// Using the exact mask from your 'Success' log: 0x1FFFFFFF
	const SUCCESS_MASK = 0x1FFFFFFF;

	for (let i = 0; i < 24; i++) view.setUint8(bufPtr + i, 0);

	// Offset 0: Type
	view.setUint8(bufPtr, type);

	// Offset 2: Flags (keeping at 0 per your log)
	view.setUint16(bufPtr + 2, 0, true);

	// Offset 8: Base Rights (Lower 32 bits)
	view.setUint32(bufPtr + 8, SUCCESS_MASK, true);

	// Offset 16: Inheriting Rights (Lower 32 bits)
	view.setUint32(bufPtr + 16, SUCCESS_MASK, true);

	return 0; // WASI_ESUCCESS
}

function fd_write(fd, iovs, iovsLen, nwritten) {
	const view = new DataView(Module.memory.buffer);
	let written = 0;

	// 1. Get the stream/pointer object for this FD
	let stream = FS.pointers[fd];
	if (!stream) return 8; // WASI_EBADF
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}


	// 2. Collect all bytes from iovs into one Uint8Array
	// We do this first to calculate total 'written' size
	const iovsList = [];
	for (let i = 0; i < iovsLen; i++) {
		let ptr = iovs + i * 8;
		let buf = view.getUint32(ptr, true);
		let bufLen = view.getUint32(ptr + 4, true);
		iovsList.push(new Uint8Array(Module.memory.buffer, buf, bufLen));
		written += bufLen;
	}

	// 3. Handle Standard I/O (fd 1 and 2)
	if (fd <= 2 && !FS.pointers[fd][2].rewrite) {
		// Concatenate for the host console/logs
		let totalBuf = new Uint8Array(written);
		let offset = 0;
		for (let b of iovsList) {
			totalBuf.set(b, offset);
			offset += b.byteLength;
		}

		if (typeof Module.hostWrite !== 'undefined') {
			Module.hostWrite(String.fromCharCode.apply(null, totalBuf));
		}
		view.setUint32(nwritten, written, true);
		return 0;
	}

	// 4. Handle Actual File Write (fd > 2)
	// stream layout: [position, mode, node, path, fd]
	let pos = stream[0];
	const node = stream[2]; // This is the object in FS.virtual[path]

	if (!node) return 28; // WASI_EINVAL

	// Ensure node.contents is a Uint8Array
	if (!(node.contents instanceof Uint8Array)) {
		node.contents = new Uint8Array(0);
	}

	// Expand buffer if writing beyond current capacity
	if (pos + written > node.contents.byteLength) {
		let newSize = pos + written;
		let newBuf = new Uint8Array(newSize);
		newBuf.set(node.contents);
		node.contents = newBuf;
	}

	// Copy each iov buffer into the node's contents at the current position
	let currentOffset = pos;
	for (let b of iovsList) {
		node.contents.set(b, currentOffset);
		currentOffset += b.byteLength;
	}

	// 5. Update the seek position for the next write
	stream[0] = currentOffset;

	// Write the number of bytes successfully written to nwritten pointer
	view.setUint32(nwritten, written, true);

	// Notify UI/Storage that the file has changed
	if (typeof Sys_notify !== 'undefined') {
		if (FS.pointers[fd][2].rewrite) {
			//FS.pointers[node.rewrite][2].contents = node.contents
			Sys_notify(FS.pointers[FS.pointers[fd][2].rewrite][2], FS.pointers[FS.pointers[fd][2].rewrite][3], fd);
		}
		else
			Sys_notify(node, stream[3], fd);
	}

	return 0; // WASI_ESUCCESS
}

function poll_oneoff(in_ptr, out_ptr, nsubscriptions, nevents_out) {
	this.mem.check();
	const mem = new DataView(Module.memory.buffer);
	let eventsCreated = 0;

	for (let i = 0; i < nsubscriptions; i++) {
		// WASI Subscription struct is 40 bytes
		const subPtr = in_ptr + (i * 40);
		const userdata = mem.getBigUint64(subPtr, true);
		const type = mem.getUint8(subPtr + 8); // 0 = Clock, 1 = FD_READ, 2 = FD_WRITE

		if (type === 0) { // EVENTTYPE_CLOCK
			// Clock subscription starts at offset 16
			const clockId = mem.getUint32(subPtr + 16, true);
			const timeout = mem.getBigUint64(subPtr + 24, true);
			const precision = mem.getBigUint64(subPtr + 32, true);
			const flags = mem.getUint16(subPtr + 40, true);

			// In a browser, we can't actually "sleep" synchronously 
			// without blocking the UI thread, so we just report success 
			// immediately or check if the timeout is valid.

			// Write the Event back to out_ptr (32 bytes)
			const eventPtr = out_ptr + (eventsCreated * 32);
			mem.setBigUint64(eventPtr, userdata, true); // Userdata
			mem.setUint16(eventPtr + 8, 0, true);       // error (0 = Success)
			mem.setUint8(eventPtr + 10, 0);             // type (Clock)

			eventsCreated++;
		} else {
			// For FD_READ/WRITE, we usually just report success for standard streams
			const eventPtr = out_ptr + (eventsCreated * 32);
			mem.setBigUint64(eventPtr, userdata, true);
			mem.setUint16(eventPtr + 8, 0, true);
			mem.setUint8(eventPtr + 10, type);
			eventsCreated++;
		}
	}

	// Write number of events created to the output pointer
	const outEventsView = new Uint32Array(this.mem.buffer, nevents_out, 1);
	outEventsView[0] = eventsCreated;

	return 0; // errno.SUCCESS
}


function proc_exit(rval) {
	if (typeof GL == 'undefined') {
		let error = new Error('WASI_ENOSYS')
		error.code = rval
		throw error
	}
	return WASI_ENOSYS;
}


function path_open(dirfd, lookupflags, pathPtr, pathLen, oflags, rights_base, rights_inheriting, fdflags, openedFdPtr) {

	// 1. Resolve Memory Buffer (Host vs Inner Module)
	const buffer = Module.memory.buffer;

	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 2. Resolve Full Path relative to dirfd
	let localName = path.trim();
	//console.log(localName)
	if (localName.startsWith('/')) localName = localName;
	if (localName.startsWith('base/')) localName = localName.substring(5);
	if (localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if (localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);

	// 3. Handle oflags (WASI specific)
	const O_CREAT = 1;
	const O_DIRECTORY = 2;
	const O_EXCL = 4;
	const O_TRUNC = 8;

	const exists = typeof FS.virtual[localName] !== 'undefined';

	if (!exists) {
		if (oflags & O_CREAT
			&& !FS.virtual[localName]
		) {
			// Create a new virtual node
			FS.virtual[localName] = {
				contents: new Uint8Array(0),
				timestamp: new Date(),
				mode: (oflags & O_DIRECTORY) ? FS_DIR : FS_FILE,
				size: 0,
				path: localName
			};
		}

		//else {
		//	return 44; // WASI_ENOENT
		//}
	} else {
		if ((oflags & O_CREAT) && (oflags & O_EXCL)) return 20; // WASI_EEXIST
		if (oflags & O_TRUNC) {
			//debugger
			FS.virtual[localName].contents = new Uint8Array(0);
			//FS.virtual[localName].size = 0;
		}
	}

	const rb = BigInt(rights_base);
	const canRead = (rb & 2n) !== 0n;
	const canWrite = (rb & 64n) !== 0n;
	const modeStr = (canRead ? 'r' : '') + (canWrite ? 'w' : '')
	const view = new DataView(Module.memory.buffer); // Result ALWAYS goes to host memory

	if (api.memfs) {

		let result = api.memfs.exports.path_open(dirfd, lookupflags, pathPtr, pathLen, oflags, rights_base, rights_inheriting, fdflags, openedFdPtr)
		if (result === 0) {

			let localPointer = FS.filePointer = view.getUint32(openedFdPtr, true);
			FS.pointers[localPointer] = [
				0, // seek/tell
				modeStr,
				FS.virtual[localName],
				localName,
				localPointer
			]
			// DO THIS ON OPEN SO WE CAN CHANGE ICONS
			//if (!(oflags & O_TRUNC))
			//	Sys_notify(FS.virtual[localName], localName)
		}
		return result;
	}

	else {

		// 4. Create File Descriptor (Stream)
		// Layout: [position, path, node]
		let createFP = function () {
			FS.filePointer++
			FS.pointers[FS.filePointer] = [
				0, // seek/tell
				modeStr,
				FS.virtual[localName],
				localName,
				FS.filePointer
			]
			// DO THIS ON OPEN SO WE CAN CHANGE ICONS
			//if (!(oflags & O_TRUNC))
			//	Sys_notify(FS.virtual[localName], localName)
			return FS.filePointer // not zero
		}

		// 5. Write result to guest memory
		view.setUint32(openedFdPtr, createFP(), true);

	}

	return 0; // WASI_ESUCCESS
}



function _fd_close(fd) {
	try {
		//var stream = SYSCALLS.getStreamFromFD(fd);
		if (fd <= VFS_NOW) return
		if (FS.pointers[fd] && FS.pointers[fd][2].rewrite) {
			FS.pointers[FS.pointers[fd][2].rewrite] = null
			FS.pointers[fd][2].rewrite = 0
		}
		else
			FS.pointers[fd] = null
		return 0;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return e.errno;
	}
}

const ST_UNSTABLE_DIR = 3
const ST_UNSTABLE_FILE = 4
const ST_UNSTABLE_LINK = 7

function path_filestat_get(dirfd, lookupflags, pathPtr, pathLen, bufPtr) {

	const buffer = Module.memory.buffer;
	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 1. Normalize Path - MUST MATCH YOUR path_open LOGIC EXACTLY
	let localName = path;
	//console.log(localName)
	if (localName.startsWith('base/')) localName = localName.substring(5);
	if (localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if (localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);
	if (localName.startsWith('/')) localName = localName.substring(1);

	const file = FS.virtual[localName];
	if (!file) return 44; // ENOENT

	const view = new DataView(buffer);
	new Uint8Array(buffer, bufPtr, 64).fill(0);

	// dev (0)
	view.setBigUint64(bufPtr + 0, BigInt(dirfd), true);

	// ino (8) - Use small stable IDs to avoid 32-bit guest overflows
	let myNode = Object.values(FS.pointers).find(p => p && p[3] == localName)
	if (!myNode) {
		/*
		FS.filePointer++
		FS.pointers[FS.filePointer] = [
			0, // seek/tell
			'rw',
			FS.virtual[localName],
			localName,
			FS.filePointer
		]
		myNode = FS.filePointer
		*/
	}
	else {
		if (myNode[2].rewrite)
			myNode = myNode[2].rewrite
		else
			myNode = myNode[4]
		view.setBigUint64(bufPtr + 8, BigInt(myNode), true);
	}

	// type (16)
	const isDir = (file.mode >> 12) === 4;
	view.setUint8(bufPtr + 16, isDir ? ST_UNSTABLE_DIR : ST_UNSTABLE_FILE);

	// nlink (20) - 32-bit!
	view.setUint32(bufPtr + 20, 1, true);

	// size (24) - Starts at 24 in unstable
	const size = isDir ? 0n : BigInt(file.contents?.length || 0);
	view.setBigUint64(bufPtr + 24, size, true);

	// timestamps (32, 40, 48)
	const timeNs = BigInt(file.timestamp.getTime()) * 1000000n;
	view.setBigUint64(bufPtr + 32, timeNs, true); // atime
	view.setBigUint64(bufPtr + 40, timeNs, true); // mtime
	view.setBigUint64(bufPtr + 48, timeNs, true); // ctime

	return 0;

}

// Helper to safely write a 32-bit value to a potentially BigInt pointer
function writeU32(ptr, value) {
	const addr = Number(ptr); // Force BigInt pointer to Number
	const view = new DataView(Module.memory.buffer);
	view.setUint32(addr, value, true);
}


function fd_read(fd, iovs, iovsLen, nreadPtr) {

	let stream = FS.pointers[fd];
	if (!stream) return 8; // WASI_EBADF
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}

	//console.log(stream[3])

	const view = new DataView(Module.memory.buffer);
	const contents = stream[2].contents; // Uint8Array of file data
	let offset = stream[0]; // Current seek position
	let totalRead = 0;

	for (let i = 0; i < iovsLen; i++) {
		const iovPtr = iovs + (i * 8);
		const bufOffset = view.getUint32(iovPtr, true);
		const bufLen = view.getUint32(iovPtr + 4, true);

		const available = contents.length - offset;
		const toRead = Math.min(bufLen, available);

		if (toRead > 0) {
			const heap = new Uint8Array(Module.memory.buffer);
			heap.set(contents.subarray(offset, offset + toRead), bufOffset);
			offset += toRead;
			totalRead += toRead;
		}

		if (toRead < bufLen) break;
	}

	stream[0] = offset; // Update seek position
	view.setUint32(nreadPtr, totalRead, true);
	return 0; // WASI_ESUCCESS
}



function fd_pread(fd, iovs, iovsLen, offset, nreadPtr) {
	let stream = FS.pointers[Number(fd)];
	if (!stream) return 8;
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}
	//console.log(stream[3])

	const node = stream[2];
	const contents = node.contents;
	const baseOffset = Number(offset); // Handle BigInt offset
	let totalRead = 0;

	const view = new DataView(Module.memory.buffer);
	const iovs_ptr = Number(iovs);

	for (let i = 0; i < Number(iovsLen); i++) {
		const iovAddr = iovs_ptr + (i * 8);
		const bufAddr = view.getUint32(iovAddr, true);
		const bufLen = view.getUint32(iovAddr + 4, true);

		const available = contents.byteLength - (baseOffset + totalRead);
		const toRead = Math.min(bufLen, available);

		if (toRead > 0) {
			const dest = new Uint8Array(Module.memory.buffer, bufAddr, toRead);
			dest.set(contents.subarray(baseOffset + totalRead, baseOffset + totalRead + toRead));
			totalRead += toRead;
		}
		if (toRead < bufLen) break;
	}

	writeU32(nreadPtr, totalRead);
	return 0;
}


function fd_readdir(fd, buf, buf_len, cookie, nread_ptr) {
	debugger
	// ... logic to get files in directory ...
	const view = new DataView(Module.memory.buffer);
	let offset = 0;

	// For each file:
	view.setBigUint64(offset, next_cookie, true); // d_next
	view.setBigUint64(offset + 8, inode, true);    // d_ino
	view.setUint32(offset + 16, name_bytes.length, true); // d_namlen
	view.setUint8(offset + 20, type); // d_type
	// offset + 21, 22, 23 is padding

	// Copy name string immediately after the 24-byte header
	const heap = new Uint8Array(Module.memory.buffer);
	heap.set(name_bytes, offset + 24);

	offset += 24 + name_bytes.length;
	view.setUint32(nread_ptr, offset, true);
	return 0;
}



function random_get(buf, buf_len) {
	const data = new Uint8Array(Module.memory.buffer, buf, buf_len);
	for (let i = 0; i < buf_len; ++i) {
		data[i] = (Math.random() * 256) | 0;
	}
}

function path_readlink(dirfd, pathPtr, pathLen, bufPtr, bufLen, nreadPtr) {
	const buffer = Module.memory.buffer;
	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 1. Normalize path
	let localName = path;
	if (localName.startsWith('/')) localName = localName.substring(1);
	if (localName.startsWith('base/')) localName = localName.substring(5);
	if (localName.startsWith('/')) localName = localName.substring(1);

	const file = FS.virtual[localName];

	// 2. Check if file exists and is a symlink
	// WASI filetype for symbolic_link is 7
	// If you don't support symlinks, return EINVAL (28)
	if (!file) {
		debugger
		return 44; // ENOENT
	}

	// If your FS doesn't store a 'target' property, it's not a link
	if (!file.target) {
		return 28; // EINVAL (Not a symbolic link)
	}

	// 3. Handle the buffer copy
	const encoder = new TextEncoder();
	const targetBytes = encoder.encode(file.target);
	const len = Math.min(targetBytes.length, bufLen);

	const heap = new Uint8Array(buffer);
	heap.set(targetBytes.subarray(0, len), bufPtr);

	// 4. Write the number of bytes read back to guest memory
	const view = new DataView(buffer);
	view.setUint32(nreadPtr, len, true);

	return 0; // WASI_ESUCCESS
}
/**
 * fd_renumber(fd, to)
 * Maps to POSIX dup2(fd, to) logic.
 */
function fd_renumber(fd, to) {

	// 1. Validate the source descriptor
	let stream = FS.pointers[fd];
	if (!stream) {
		return 8; // WASI_EBADF
	}

	// 2. If 'to' is already open, POSIX says we silently close it first
	if (FS.pointers[to]) {
		// You might want to call Sys_FClose(to) here to ensure 
		// any pending Sys_notify calls fire.
		FS.pointers[to][0] = 0;
	}
	else
	// 3. Renumber: Copy the reference to the new 'to' index
		FS.pointers[to] = [
			0, // seek/tell
			stream[1],
			stream[2],
			stream[3],
			fd
		]

	// 4. Update the internal FD stored in your stream array [pos, mode, node, path, FD]
	// stream[4] is where you store the FD index
	FS.pointers[to][2].rewrite = fd
	FS.pointers[to][4] = fd;

	// 5. Remove the old reference
	//FS.pointers[fd] = null;

	return 0; // WASI_ESUCCESS
}

const FILED = {

	//setModuleInstance : setModuleInstance,
	fputs: Sys_fputs,

	environ_sizes_get: environ_sizes_get,
	args_sizes_get: args_sizes_get,
	fd_fdstat_set_flags: function () { debugger },
	fd_prestat_get: fd_prestat_get,
	fd_fdstat_get: fd_fdstat_get,
	fd_write: fd_write,
	fd_prestat_dir_name: fd_prestat_dir_name,
	environ_get: environ_get,
	args_get: args_get,
	fd_advise: function () { debugger },
	fd_allocate: function () { debugger },
	fd_datasync: function () { debugger },
	path_open: path_open,
	fd_fdstat_set_rights: function () { debugger },
	fd_filestat_set_size: function () { debugger },
	fd_filestat_set_times: function () { debugger },
	fd_pread: fd_pread,
	fd_seek: fd_seek,
	Sys_FSeek: fd_seek,
	fd_read: fd_read,
	fd_close: _fd_close,
	fd_pwrite: function () { debugger },
	fd_readdir: fd_readdir,
	fd_renumber: fd_renumber,
	fd_sync: function () { debugger },
	fd_tell: function () { debugger },
	path_create_directory: function () { debugger },
	path_filestat_get: path_filestat_get,
	path_filestat_set_times: function () { debugger },
	path_link: function () { debugger },
	path_readlink: path_readlink,
	path_remove_directory: function () { debugger },
	path_symlink: path_symlink,
	path_unlink_file: path_unlink_file,
	proc_raise: function () { debugger },
	sched_yield: function () { debugger },
	random_get: random_get,
	sock_recv: function () { debugger },
	sock_send: function () { debugger },
	sock_shutdown: function () { debugger },
	AddDirectoryNode: AddDirectoryNode,
	AddFileNode: AddFileNode,
	FindNode: function FindNode() { debugger },
	GetFileNodeAddress: function GetFileNodeAddress() { debugger },
	GetFileNodeSize: function GetFileNodeSize() { debugger },
	GetPathBuf: function GetPathBuf() { debugger },
	GetPathBufLen: function GetPathBufLen() { debugger },
	fd_allocate: function fd_allocate() { debugger },
	fd_fdstat_set_flags: function fd_fdstat_set_flags() { debugger },
	fd_filestat_get: fd_filestat_get,
	fd_filestat_set_size: function fd_filestat_set_size() { debugger },
	init: function init() { debugger },
	path_create_directory: function path_create_directory() { debugger },
	path_remove_directory: function path_remove_directory() { debugger },
	path_rename: path_rename,
	Sys_gettime: clock_gettime,
	clock_time_get: clock_gettime,
	poll_oneoff: poll_oneoff,
	proc_exit: proc_exit,
	getpid: getpid,
	fork: fork,
	wait: wait,
	execv: execv,
	_spawnvp: _spawnvp,
	//getStringsFromArgv: getStringsFromArgv
}

function path_symlink(oldPathPtr, oldPathLen, dirfd, newPathPtr, newPathLen) {

	debugger
	const buffer = Module.memory.buffer;

	const target = new TextDecoder().decode(new Uint8Array(buffer, oldPathPtr, oldPathLen));
	const linkName = new TextDecoder().decode(new Uint8Array(buffer, newPathPtr, newPathLen));

	// Resolve virtual path
	let localLink = linkName.startsWith('/') ? linkName.substring(1) : linkName;

	FS.virtual[localLink] = {
		contents: new TextEncoder().encode(target), // The 'data' of a symlink is the path it points to
		timestamp: new Date(),
		mode: (7 << 12) + FS_DEFAULT, // S_IFLNK (Symbolic Link)
		size: target.length,
		path: localLink,
		target: target // Helper for your path resolution logic
	};

	if (api.memfs) {
		return api.memfs.exports.path_symlink(oldPathPtr, oldPathLen, dirfd, newPathPtr, newPathLen);
	}

	return 0;
}

function AddDirectoryNode(parentFd, pathPtr, pathLen) {
	const buffer = Module.memory.buffer;
	const name = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// Normalize path to prevent leading slash panics
	let localName = name;
	if (localName.startsWith('/')) localName = localName.substring(1);
	if (localName.endsWith('/')) localName = localName.substring(0, localName.length - 1);

	if (typeof FS.virtual[localName] === 'undefined') {
		FS.virtual[localName] = {
			contents: null, // Directories don't have binary contents
			timestamp: new Date(),
			mode: FS_DIR,
			size: 4096, // Standard directory block size
			path: localName
		};
	}

	if (api.memfs) {
		// Only call the WASM export if we know it's a safe creation
		// Note: We use the normalized length to match the buffer write
		return api.memfs.exports.AddDirectoryNode(parentFd, pathPtr, pathLen);
	}

	return 0;
}

function AddFileNode(parentFd, pathPtr, pathLen) {
	const buffer = Module.memory.buffer;
	const name = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// Resolve path (Assuming root dirfd 3 for context if not specified)
	const localName = name.startsWith('/') ? name.substring(1) : name;

	// Check if it already exists to avoid the 'unreachable' panic
	if (typeof FS.virtual[localName] === 'undefined') {
		FS.virtual[localName] = {
			contents: new Uint8Array(0),
			timestamp: new Date(),
			mode: FS_FILE,
			size: 0,
			path: localName
		};
	}

	if (api.memfs) {
		// Sync with WASM backend
		return api.memfs.exports.AddFileNode(parentFd, pathPtr, pathLen);
	}

	return 0; // WASI_ESUCCESS
}


function getStringsFromArgv(argv) {
	const u8 = new Uint8Array(Module.memory.buffer)
	const args = [];

	// If argv is a number, it's a pointer to a NULL-terminated array in WASM memory
	if (typeof argv === 'number') {
		const view = new DataView(Module.memory.buffer);
		for (let i = 0; ; i++) {
			const stringPointer = view.getUint32(argv + (i * 4), true);
			if (stringPointer === 0) break; // NULL terminator

			// Using your Mem lib's string reader (assuming it's called readString or similar)
			args.push(readStr(u8, stringPointer));
		}
	}
	// If argv is already an array (passed via ...argv in JS), just sanitize it
	else if (Array.isArray(argv)) {
		return argv.map(arg => (typeof arg === 'number' ? readStr(u8, arg) : arg));
	}

	return args;
}


async function _spawnvp(mode, cmdnamePtr, argvPtr) {
	debugger
	// 1. Convert cmdname from pointer to JS String
	const cmdname = readString(cmdnamePtr);

	// 2. Reconstruct the argument array from memory
	const args = [];
	let currentPtr = argvPtr;

	while (true) {
		// Read the pointer stored at the current array index
		const strPtr = Module.getValue(currentPtr, 'i32');
		if (strPtr === 0) break; // NULL terminator

		args.push(readString(strPtr));
		currentPtr += 4; // Move to next 32-bit pointer
	}

	try {
		/**
		 * Mapping to your specific call:
		 * args[0] is usually the program name (e.g., 'clang')
		 * the rest are the flags
		 */
		const bin = args[0];
		const remainingArgs = args.slice(1);

		// Await the execution of the WASM tool
		const exitCode = await api.run(bin, ...remainingArgs);

		return exitCode;
	} catch (e) {
		console.error(`Execution failed for ${cmdname}:`, e);
		return 100; // Standard error exit for LCC
	}
}


function getpid() { return 42; }
function fork() { return 0; }
function wait(status) {
	debugger
	Module.errno = WASI_ENOSYS;
	return -1;
}


function readStr(u8, o, len = -1) {
	let str = '';
	let end = u8.length;
	if (len != -1)
		end = o + len;
	for (let i = o; i < end && u8[i] != 0; ++i)
		str += String.fromCharCode(u8[i]);
	return str;
}


function execv(pathPtr, argvPtr) {
	const u8 = new Uint8Array(Module.memory.buffer)
	const path = readStr(u8, pathPtr);
	const cmdArgs = getStringsFromArgv(argvPtr);

	if (api && api.moduleCache[path || cmdArgs[0]]) {
		let result = api.runSync(path || cmdArgs[0], ...cmdArgs);
		return result.output;
	}
	else {
		log('Would have run: ' + [path, ...cmdArgs].join(' '))
		Module.errno = WASI_ENOSYS;
		return -1;
	}
	return 0;
}

function path_unlink_file(dirfd, pathPtr, pathLen) {
	const buffer = Module.memory.buffer;
	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 1. Normalize Path - Use the EXACT logic from filestat
	let localName = path;
	if (localName.startsWith('base/')) localName = localName.substring(5);
	if (localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if (localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);
	if (localName.startsWith('/')) localName = localName.substring(1);

	const file = FS.virtual[localName];

	// 2. Check existence
	if (!file) {
		return 44; // WASI_ENOENT
	}

	// 3. Check type
	// In WASI, path_unlink_file is strictly for files.
	// If it's a directory, return EPERM (1) or EISDIR (31)
	const isDir = (file.mode >> 12) === 4; // Your ST_DIR check
	if (isDir) {
		return 31; // WASI_EISDIR
	}

	// 4. Perform Deletion
	delete FS.virtual[localName];

	// 5. Cleanup active pointers (Optional but recommended)
	// If a file is open and unlinked, POSIX says it stays until closed,
	// but for your bare-bones VFS, just making it unreachable is usually fine.

	// 6. Notify Sync/UI
	if (typeof Sys_notify !== 'undefined') {
		Sys_notify(false, localName);
	}

	return 0; // WASI_ESUCCESS
}



function path_rename(oldFd, oldPathPtr, oldPathLen, newFd, newPathPtr, newPathLen) {

	const heap = new Uint8Array(Module.memory.buffer);

	// Helper to decode strings from WASM memory
	const readStr = (ptr, len) => {
		const bytes = heap.subarray(ptr, ptr + len);
		return new TextDecoder().decode(bytes);
	};

	// 1. Read the paths
	// In your log, oldPathPtr was actually 6635560 (the 2nd argument)
	let oldPath = readStr(oldPathPtr, oldPathLen);
	let newPath = readStr(newPathPtr, newPathLen);

	/*
	// 2. Resolve them against their respective FDs
	// Since fd 3 is your root "/", we just join them.
	const resolve = (fd, path) => {
		let base = (fd === 3) ? "/" : (FS.pointers[fd] ? FS.pointers[fd][1] : "/");
		let full = base + (base.endsWith('/') ? '' : '/') + path;
		// Clean up double slashes and relative dots if necessary
		return full.replace(/\/+/g, '/'); 
	};

	const oldPath = resolve(oldFd, oldPathRelative);
	const newPath = resolve(newFd, newPathRelative);
	*/

	// 3. The Actual Rename Logic (Flat Key Swap)
	if (typeof FS.virtual[oldPath] === 'undefined') return 44; // ENOENT

	const node = FS.virtual[oldPath];
	const isDir = (node.mode >> 12) === 4;

	if (isDir) {
		const oldPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
		const newPrefix = newPath.endsWith('/') ? newPath : newPath + '/';

		Object.keys(FS.virtual).forEach(p => {
			if (p.startsWith(oldPrefix)) {
				const updated = newPrefix + p.substring(oldPrefix.length);
				FS.virtual[updated] = FS.virtual[p];
				delete FS.virtual[p];
			}
		});
	}

	FS.virtual[newPath] = node;
	delete FS.virtual[oldPath];

	return 0; // SUCCESS
}




function clock_gettime(clk_id, tp) {
	// 1. Force pointers to Numbers immediately to allow bitwise math
	const tpAddr = Number(tp);
	const clkAddr = Number(clk_id);

	// Depending on your WASM build, clk_id might be the ID itself 
	// OR a pointer to it. Your code suggests it's a pointer:
	let id = HEAPU32[clkAddr >> 2];

	let now;
	if (id === 0) { // CLOCK_REALTIME
		now = Date.now(); // Milliseconds since epoch
	} else if (id === 1 || id === 4) { // CLOCK_MONOTONIC / CLOCK_THREAD_CPUTIME_ID
		now = performance.now(); // High-res relative time
	} else if (Module.errno) {
		const errnoPtr = Number(Module.errno);
		HEAP32[errnoPtr >> 2] = 28; // EINVAL
		return -1;
	}

	// 2. Convert to Seconds and Nanoseconds
	// WASI 'timespec' struct:
	// [0] tv_sec  (8 bytes in WASI, 4 bytes in some unstable versions)
	// [8] tv_nsec (8 bytes in WASI, 4 bytes in some unstable versions)

	const sec = Math.floor(now / 1000);
	const nsec = Math.floor((now % 1000) * 1e6); // ms to ns

	// 3. Write to memory using standard Number-based indexing
	// If your Binji build uses 4-byte fields for timespec:
	HEAP32[tpAddr >> 2] = sec;
	HEAP32[(tpAddr + 4) >> 2] = nsec;

	// If your build uses 8-byte fields (Standard WASI):
	// const view = new DataView(Module.memory.buffer);
	// view.setBigUint64(tpAddr, BigInt(sec), true);
	// view.setBigUint64(tpAddr + 8, BigInt(nsec), true);

	return 0;
}



Object.assign(FS, FILED)

if (typeof module != 'undefined') {
	// SOMETHING SOMETHING fs.writeFile
	module.exports = FS
}
