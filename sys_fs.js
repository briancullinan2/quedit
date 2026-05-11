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
		path: localName
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
	let localName = fileStr
	if (localName.startsWith('//'))
		localName = localName.substring(1)
	if (localName[0] != '/')
		localName = '/' + localName
	if (!localName.startsWith('/base')
		&& !localName.startsWith('/home'))
		localName = '/base' + localName

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
			FS.virtual[localName] = {
				timestamp: new Date(),
				mode: FS_FILE,
				contents: new Uint8Array(0),
				path: localName
			}
			return createFP()
		} else {
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

function Sys_FSeek(pointer, position, mode) {
	if (typeof FS.pointers[pointer] == 'undefined') {
		throw new Error('File IO Error') // TODO: POSIX
	}
	if (mode == 0 /* SEEK_SET */) {
		FS.pointers[pointer][0] = position
	} else if (mode == 1 /* SEEK_CUR */) {
		FS.pointers[pointer][0] += position
	} else if (mode == 2 /* SEEK_END */) {
		FS.pointers[pointer][0] = FS.pointers[pointer][2].contents.length + position
	} else {
		return -1 // POSIX?
	}
	return 0
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
		if (errno) {
			HEAPU32[errno >> 2] = ENOENT
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
		1: [0, 'r', {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: new Uint8Array(),
			path: '/dev/stdin',
		}, '/dev/stdin', 0],
		2: [0, 'w', {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: new Uint8Array(),
			path: '/dev/stdout',
		}, '/dev/stdout', 1],
		3: [0, 'w', {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: new Uint8Array(),
			path: '/dev/stderr',
		}, '/dev/stderr', 2],
	},
	filePointer: 3,
	virtual: {}, // temporarily store items as they go in and out of memory
	Sys_ListFiles: Sys_ListFiles,
	Sys_FTell: Sys_FTell,
	Sys_FSeek: Sys_FSeek,
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
}


function getStreamChecked(fd) {
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
	// We only provide the root directory at FD 3
	if (fd === 3) {
		const view = new DataView(Module.memory.buffer);
		// byte 0: pr_type (0 is prestat_dir)
		view.setUint8(bufPtr, 0);
		// byte 4: pr_name_len (the length of the string "/", which is 1)
		view.setUint32(bufPtr + 4, 1, true);
		return 0; // WASI_ESUCCESS
	}
	return 8; // WASI_EBADF (stop looking after FD 3)
}

function fd_prestat_dir_name(fd, pathPtr, pathLen) {
	if (fd === 3) {
		const heap = new Uint8Array(Module.memory.buffer);
		// Write "/" into the buffer
		heap[pathPtr] = "/".charCodeAt(0);
		return 0; // WASI_ESUCCESS
	}
	return 28; // WASI_EINVAL
}


function environ_sizes_get(environCountPtr, environBufSizePtr) {
	var view = new DataView(Module.memory.buffer);
	view.setUint32(environCountPtr, 0, true);
	view.setUint32(environBufSizePtr, 0, true);
	return 0;
}

function environ_get(environPtr, environBufPtr) {
	return 0;
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

function fd_fdstat_get(fd, bufPtr) {
    const stream = FS.pointers[fd];
    const view = new DataView(Module.memory.buffer);

    // 1. Determine Type
    // Standard WASI: 2 = char device, 3 = block, 4 = directory, 8 = regular file
    let type = 8; 
    if (fd <= 2) {
        type = 2; // stdin/out/err are character devices
    } else if (fd === 3) {
        type = 4; // Our pre-opened root is a directory
    } else if (stream && stream[2] && (stream[2].mode >> 12) === ST_DIR) {
        type = 4;
    }

    // Offset 0: fs_filetype (u8)
    view.setUint8(bufPtr, type);

    // Offset 2: fs_flags (u16)
    // 0 = no special flags (like non-block or append)
    view.setUint16(bufPtr + 2, 0, true);

    // Offset 8: fs_rights_base (u64)
    // Offset 16: fs_rights_inheriting (u64)
    // We grant "All Rights" (0xFFFFFFFFFFFFFFFF)
    // Written as two 32-bit parts for compatibility
    const ALL_RIGHTS_LOW = 0xFFFFFFFF;
    const ALL_RIGHTS_HIGH = 0xFFFFFFFF;

    // Base Rights
    view.setUint32(bufPtr + 8, ALL_RIGHTS_LOW, true);
    view.setUint32(bufPtr + 12, ALL_RIGHTS_HIGH, true);

    // Inheriting Rights (What files opened from this dir get)
    view.setUint32(bufPtr + 16, ALL_RIGHTS_LOW, true);
    view.setUint32(bufPtr + 20, ALL_RIGHTS_HIGH, true);

    return 0; // WASI_ESUCCESS
}


// TODO: THIS MIGHT BE A MORE COMPREHENSIVE WRITE FUNCTION
//   AND THE FS.VIRTUAL CODE COULD BE INSERTED AT THE BOTTOM
function fd_write(fd, iovs, iovsLen, nwritten) {
	var view = new DataView(Module.memory.buffer);
	var written = 0;
	var bufferBytes = [];

	function getiovs(iovs, iovsLen) {
		// iovs* -> [iov, iov, ...]
		// __wasi_ciovec_t {
		//   void* buf,
		//   size_t buf_len,
		// }
		var buffers = Array.from({ length: iovsLen }, function (_, i) {
			var ptr = iovs + i * 8;
			var buf = view.getUint32(ptr, !0);
			var bufLen = view.getUint32(ptr + 4, !0);

			return new Uint8Array(Module.memory.buffer, buf, bufLen);
		});

		return buffers;
	}

	var buffers = getiovs(iovs, iovsLen);
	function writev(iov) {
		for (var b = 0; b < iov.byteLength; b++) {
			bufferBytes.push(iov[b]);
		}

		written += b;
	}

	buffers.forEach(writev);
	let newMessage = stringToAddress(String.fromCharCode.apply(null, bufferBytes))

	if (typeof stdout !== 'undefined' && fd === WASI_STDOUT_FILENO)
		Sys_FWrite(newMessage, 1, bufferBytes.length, HEAPU32[stdout >> 2])
	else if (typeof stderr !== 'undefined' && fd === WASI_STDERR_FILENO)
		Sys_FWrite(newMessage, 1, bufferBytes.length, HEAPU32[stderr >> 2])
	else if (typeof Module.hostWrite !== 'undefined') {
		Module.hostWrite(String.fromCharCode.apply(null, bufferBytes))
	} else {
		throw new Error('wtf')
	}
	view.setUint32(nwritten, written, !0);

	return WASI_ESUCCESS;
}

function poll_oneoff(sin, sout, nsubscriptions, nevents) {
	debugger
	return WASI_ENOSYS;
}

function proc_exit(rval) {
	return WASI_ENOSYS;
}

function path_open(dirfd, lookupflags, pathPtr, pathLen, oflags, rights_base, rights_inheriting, fdflags, openedFdPtr) {
	const path = new TextDecoder().decode(new Uint8Array(Module.memory.buffer, pathPtr, pathLen));

	// Use your existing POSIX-style opener
	// Sys_FOpen expects a pointer, so we'll mock that or change it to take a string
	// Here I'll assume you want to hit your internal Sys_FOpen logic:
	const fd = Sys_FOpen(pathPtr, 0); // Warning: check if Sys_FOpen expects string address or string

	if (fd === 0) return 44; // WASI_ENOENT

	const view = new DataView(Module.memory.buffer);
	view.setUint32(openedFdPtr, fd, true);
	return 0;
}


function _fd_close(fd) {
	try {

		var stream = SYSCALLS.getStreamFromFD(fd);
		FS.close(stream);
		return 0;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return e.errno;
	}
}

function path_filestat_get(dirfd, lookupflags, pathPtr, pathLen, bufPtr) {
	const path = new TextDecoder().decode(new Uint8Array(Module.memory.buffer, pathPtr, pathLen));

	// Resolve path to your FS.virtual
	let localName = path;
	if (!localName.startsWith('/')) localName = '/' + localName;
	if (!localName.startsWith('/base')) localName = '/base' + localName;
	if (localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	//if (localName.startsWith('/base/usr/local')) localName = '/base' + localName.substring('/base/usr/local'.length)
	//if (localName.startsWith('/usr/local')) localName = '/base' + localName.substring('/usr/local'.length)

	const file = FS.virtual[localName];
	if (!file) {
		return 44; // ENOENT
	}

	const view = new DataView(Module.memory.buffer);
	// wasi_unstable stat struct offsets:
	// dev (8b), ino (8b), type (1b), nlink (4b), size (8b), atime (8b), mtime (8b), ctime (8b)

	const isDir = (file.mode >> 12) === ST_DIR;
	view.setUint8(bufPtr + 16, isDir ? 4 : 8); // filetype

	let size = 0n;
	if (!isDir && file.contents) {
		size = BigInt(file.contents.length);
		view.setBigUint64(bufPtr + 24, size, true);
	}

	const time = BigInt(file.timestamp.getTime()) * 1000000n; // Convert ms to ns
	view.setBigUint64(bufPtr + 32, time, true); // atime
	view.setBigUint64(bufPtr + 40, time, true); // mtime
	view.setBigUint64(bufPtr + 48, time, true); // ctime

	return 0;
}


function fd_pread(fd, iovs, iovsLen, offset, nreadPtr) {
	const stream = FS.pointers[fd];
	if (!stream) return 8;

	const view = new DataView(Module.memory.buffer);
	const contents = stream[2].contents;
	// offset is a BigInt in many WASI implementations, cast to Number
	let readOffset = Number(offset);
	let totalRead = 0;

	for (let i = 0; i < iovsLen; i++) {
		const iovPtr = iovs + (i * 8);
		const bufOffset = view.getUint32(iovPtr, true);
		const bufLen = view.getUint32(iovPtr + 4, true);

		const available = contents.length - readOffset;
		const toRead = Math.min(bufLen, available);

		if (toRead > 0) {
			const heap = new Uint8Array(Module.memory.buffer);
			heap.set(contents.subarray(readOffset, readOffset + toRead), bufOffset);
			readOffset += toRead;
			totalRead += toRead;
		}
	}

	view.setUint32(nreadPtr, totalRead, true);
	return 0;
}


function fd_read(fd, iovs, iovsLen, nreadPtr) {
	const stream = FS.pointers[fd];
	if (!stream) return 8; // WASI_EBADF

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

function fd_readdir(fd, buf, buf_len, cookie, nread_ptr) {
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
}


const FILED = {

	//setModuleInstance : setModuleInstance,
	environ_sizes_get: environ_sizes_get,
	args_sizes_get: args_sizes_get,
	fd_fdstat_set_flags: function () { debugger },
	fd_prestat_get: fd_prestat_get,
	fd_fdstat_get: fd_fdstat_get,
	fd_write: fd_write,
	fd_prestat_dir_name: fd_prestat_dir_name,
	environ_get: environ_get,
	args_get: args_get,
	poll_oneoff: poll_oneoff,
	proc_exit: proc_exit,
	fd_advise: function () { debugger },
	fd_allocate: function () { debugger },
	fd_datasync: function () { debugger },
	path_open: path_open,
	fd_fdstat_set_rights: function () { debugger },
	fd_filestat_get: function () { 
		debugger 
	},
	fd_filestat_set_size: function () { debugger },
	fd_filestat_set_times: function () { debugger },
	fd_pread: fd_pread,
	fd_seek: Sys_FSeek,
	fd_read: fd_read,
	fd_close: _fd_close,
	fd_pwrite: function () { debugger },
	fd_readdir: fd_readdir,
	fd_renumber: function () { debugger },
	fd_sync: function () { debugger },
	fd_tell: function () { debugger },
	path_create_directory: function () { debugger },
	path_filestat_get: path_filestat_get,
	path_filestat_set_times: function () { debugger },
	path_link: function () { debugger },
	path_readlink: function () { debugger },
	path_remove_directory: function () { debugger },
	path_rename: function () { debugger },
	path_symlink: function () { debugger },
	path_unlink_file: function () { debugger },
	proc_raise: function () { debugger },
	sched_yield: function () { debugger },
	random_get: function () { debugger },
	sock_recv: function () { debugger },
	sock_send: function () { debugger },
	sock_shutdown: function () { debugger },
}

Object.assign(FS, FILED)

if (typeof module != 'undefined') {
	// SOMETHING SOMETHING fs.writeFile
	module.exports = FS
}
