
const REMOTE_MODELS = {}

const QUAKE3_FS = {
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
    Sys_gettime: Sys_gettime,

    getStreamChecked: Sys_StreamChecked,

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
    fstat: Sys_filestat_get,
    rename: Sys_Rename,

    // --- Extensions / Internal ---
    mkdirp: Sys_Mkdirp,
	fork: fork,
	wait: wait,
	execv: execv,
	_spawnvp: _spawnvp,
}

function Sys_StreamChecked(fd) {
	debugger
	// 1. Check if the file descriptor is within a valid range
	// In your library, FS.pointers or a similar mapping tracks open files
	let stream = FS.pointers[fd];

	if (!stream) {
		// Return a standard POSIX EBADF (Bad File Descriptor) error
		// WASI_EBADF is usually 8
		throw new Error('ENOENT')
	}

	return stream;
};

function Sys_gettime(clk_id, precision, tp) {
	// If the engine passes 3 args, 'tp' is the third argument slot (index 2)
	// If an older tool pass only sent 2 args, fallback gracefully to the second slot
	const tpAddr = arguments.length === 3 ? Number(tp) : Number(precision);
	const id = Number(clk_id);

	let now;
	if (id === 0) { // CLOCK_REALTIME
		now = Date.now(); // Milliseconds since epoch
	} else { // CLOCK_MONOTONIC / CLOCK_THREAD_CPUTIME_ID etc.
		now = performance.now();
	}

	// WASI standard: timestamp must be written as total nanoseconds since epoch/boot
	// 1 millisecond = 1,000,000 nanoseconds
	const totalNanoseconds = BigInt(Math.floor(now * 1e6));

	// Write the 64-bit (8-byte) integer directly to the WebAssembly memory view
	try {
		const view = new DataView(Module.memory.buffer);
		view.setBigUint64(tpAddr, totalNanoseconds, true); // true = Little Endian
	} catch (err) {
		// Fallback in case memory.buffer isn't immediately exposed on 'Module'
		const heapView = new DataView(HEAPU8.buffer);
		heapView.setBigUint64(tpAddr, totalNanoseconds, true);
	}

	return 0; // Success
}

function Sys_filestat_get(fd, bufPtr) {


	let stream = FS.pointers[fd];
	debugger

	if (!stream) return 8; // WASI_EBADF
	if (stream[2].rewrite) {
		stream = FS.pointers[stream[2].rewrite]
	}

	//writeLog(stream[3])

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
/**
 * WASI fd_seek(fd, offset_low, offset_high, whence, new_offset_ptr)
 * Clang/WASI usually passes the i64 offset as two 32-bit ints or a BigInt
 */
function fd_seek(fd, offset, whence, newOffsetPtr) {

	let stream = FS.pointers[fd];
	if (!stream) return 8; // WASI_EBADF
	if (!stream[2]) {
		debugger

	}
	if (stream[2].rewrite && stream[2].rewrite.length > 0) {
		stream = FS.pointers[stream[2].rewrite[stream[2].rewrite.length - 1]]
	}
	//writeLog(stream[3])

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
    return 0
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

function Sys_FOpen(filename, mode) {

    // now we don't have to do the indexing crap here because it's built into the engine already
    let fileStr = addressToString(filename)
    let extName
    if (fileStr.includes('.')) {
        extName = fileStr.substring(fileStr.lastIndexOf('.')).toLowerCase()
    }
    let modeStr = addressToString(mode)
    let localName = fileStr.trim()

    //writeLog(localName)
    if (!localName.startsWith('/')) localName = '/' + localName;
    if (!localName.startsWith('/base')) localName = '/base' + localName;
    if (localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
    if (localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);


    let createFP = function () {
        FS.filePointer++
        FS.pointers[FS.filePointer] = [
            0, // seek/tell
            modeStr, // r/w/rw string
            FS.virtual[localName], // internal virtual filesystem, path, contents, timestamp, mode === FS_DIR/FS_FILE, 
            localName, // file name
            FS.filePointer, // self index reference
            42
        ]
        //if (!FS.pointers[0][2].rewrite) {
        //    FS.pointers[0][2].rewrite = []
        //}
        //FS.pointers[0][2].rewrite.push(FS.filePointer)
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
        debugger
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

function Sys_FClose(pointer) {
    if (pointer < 3) {
        debugger
    }
    if (typeof FS.pointers[pointer] === 'undefined') {
        return 0
        debugger
        throw new Error('File IO Error') // TODO: POSIX
    }
    Sys_notify(FS.pointers[pointer][2], FS.pointers[pointer][3], FS.pointers[pointer][4])
    delete FS.pointers[pointer]
    if (FS.pointers[0][2].rewrite && FS.pointers[0][2].rewrite.length > 0) {
        let index
        if ((index = FS.pointers[0][2].rewrite.findIndex(i => i === pointer))) {
            delete FS.pointers[0][2].rewrite[index]
        }
    }

    const trimmedArray = FS.pointers.filter(() => true);
    if (trimmedArray.length < FS.filePointer) {
        FS.filePointer = trimmedArray.length
        FS.pointers.length = trimmedArray.length
    }
    return 0
}


function Sys_FFlush(pointer) {
    debugger
    if (typeof FS.pointers[pointer] == 'undefined') {
        throw new Error('File IO Error') // TODO: POSIX
    }
    Sys_notify(FS.pointers[pointer][2], FS.pointers[pointer][3], FS.pointers[pointer][4])
    return 0
}

function Sys_Remove(file) {
    debugger
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
    return 0
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
    return 0
}


function Sys_ListFiles(directory, extension, filter, numfiles, wantsubs) {
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
            || (extensionStr == '/' && (FS.virtual[key].mode >> 12) === ST_DIR))
            // TODO: match directory 
            && (key[localName.length] == '/')
            && (wantsubs || subdirI == -1 || subdirI == key.length - 1)
            && (!localName || key.startsWith(localName))
            && (!dironly || (FS.virtual[key].mode >> 12) === ST_DIR)
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
            return 0;
        }

        // if we got any other error, let's see if the directory already exists
        if (Sys_stat(pathname)) {
            throw e
        }
    }
    return 0
}

function Sys_FRead(bufferAddress, byteSize, count, pointer) {

    if (typeof FS.pointers[pointer] == 'undefined') {
        debugger
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


function Sys_fprintf(fp, fmt, args) {
    debugger
    let formatted = stringToAddress('DEADBEEF')
    let length = sprintf(formatted, fmt, args)
    if (length < 1 || !HEAPU32[formatted >> 2]) {
        formatted = fmt
    }
    Sys_fputs(formatted, fp)
}


function Sys_fgetc(fp) {
    debugger
    let c = stringToAddress('DEADBEEF')
    HEAPU32[c >> 2] = 0
    if (Sys_FRead(c, 1, 1, fp) != 1) {
        return -1
    }
    return HEAPU32[c >> 2]
}


function Sys_fgets(buf, size, fp) {
    debugger
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
    debugger
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
        debugger
        if (Module.errno.value) {
            HEAPU32[Module.errno.value >> 2] = ENOENT
        }
        return 1
    }
}


function Sys_feof(fp) {
    debugger
    if (typeof FS.pointers[fp] == 'undefined') {
        return 1
    }
    if (FS.pointers[fp][0] >= FS.pointers[fp][2].contents.length) {
        return 1
    }
    return 0
}

function fork() {
	// Alternating state machine behavior:
	// First call inside _spawnvp returns 0 (Run the Child code block)
	// Second call inside _spawnvp returns 42 (Run the Parent code block)
	forkToggle = !forkToggle;
	if (forkToggle) {
		return 0; // Trigger case 0: execvp()
	} else {
		return 42; // Skip to parent wait() block
	}
}

function execv(pathPtr, argvPtr) {
	const u8 = new Uint8Array(Module.memory.buffer);
	const path = readStr(u8, pathPtr);
	const cmdArgs = getStringsFromArgv(argvPtr);
	const targetKey = path || cmdArgs[0];

	if (api && api.moduleCache[targetKey]) {
		// 1. Run the target compiler module synchronously RIGHT NOW
		let result = api.runSync(targetKey, ...cmdArgs);
		writeLog('Process resulted in: ' + result);

		// 2. Save the real exit code in our global virtual tracking state
		virtualChildExitCode = result;

		// 3. FORCE a loop mutation: We recall _spawnvp dynamically to trigger the parent pass
		// This forces fork() to toggle and return 42 next, skipping straight to wait()
		Module.exports._spawnvp(0, pathPtr, argvPtr);

		// 4. Clean exit from the child fork branch
		return 0;
	}
	else {
		writeLog('Would have run: ' + [path, ...cmdArgs].join(' '));
		Module.errno = 1; // EPERM / EINVAL
		return -1;
	}
}



function _spawnvp(mode, cmdnamePtr, argvPtr) {
	const u8 = new Uint8Array(Module.memory.buffer);
	const path = readStr(u8, cmdnamePtr);
	try {
		const cmdArgs = getStringsFromArgv(argvPtr)
		const targetKey = path || cmdArgs[0];

		// Await the execution of the WASM tool
		let result = api.runSync(targetKey, ...cmdArgs);
		writeLog('Process resulted in: ' + result);

		return result;
	} catch (e) {
		console.error(`Execution failed for ${path}:`, e);
		return 100; // Standard error exit for LCC
	}
}


function wait(statusPtr) {
	// If a status memory pointer was passed by C, write our captured child status into it
	// C expects the exit code to be shifted left by 8 bits: (status >> 8) & 0377
	if (statusPtr && Module.memory) {
		const view = new DataView(Module.memory.buffer);
		view.setInt32(Number(statusPtr), (virtualChildExitCode << 8), true);
	}

	// Reset our fork toggle tracking flag for the next compilation pass command
	forkToggle = false;

	// Return the fake PID (42) to signify the child process successfully reaped
	return 42;
}


Object.assign(FS, QUAKE3_FS)

if (typeof module != 'undefined') {
	// SOMETHING SOMETHING fs.writeFile
	module.exports = FS
}
