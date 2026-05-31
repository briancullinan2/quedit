/**
 * Custom File-System Adapter translating Node-style fs actions 
 * directly onto the in-memory POSIX WASI VFS database.
 */
const isoGitFS = {
    // 1. Core Property configuration required by Isomorphic-Git
    promises: {
        /**
         * Reads the full binary snapshot contents of a file path.
         */
        readFile: async function (path, options) {
            const localPath = normalizeVfsPath(path);
            const node = FS.virtual[localPath];

            if (!node || (node.mode >> 12) === ST_DIR) {
                throw createFsError('ENOENT', `No such file: ${path}`);
            }

            const data = node.contents || new Uint8Array(0);

            // Isomorphic-git expects a Buffer/Uint8Array unless encoding is explicitly specified
            if (options === 'utf8' || (options && options.encoding === 'utf8')) {
                return new TextDecoder().decode(data);
            }
            return data;
        },

        /**
         * Writes a binary chunk or string payload directly to a flat virtual path node.
         */
        writeFile: async function (path, data, options) {
            const localPath = normalizeVfsPath(path);
            let binaryData;

            if (typeof data === 'string') {
                binaryData = new TextEncoder().encode(data);
            } else if (data instanceof Uint8Array) {
                binaryData = data;
            } else if (data && data.buffer) {
                binaryData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            } else {
                binaryData = new Uint8Array(0);
            }

            // Upsert the entry matching your WASI structures
            FS.virtual[localPath] = {
                path: localPath,
                contents: binaryData,
                timestamp: new Date(),
                mode: FS_FILE,
                size: binaryData.length,
                parent: localPath.includes('/') ? localPath.substring(0, localPath.lastIndexOf('/')) : ''
            };

            // Trigger UI/Worker notification events if mounted
            if (typeof Sys_notify !== 'undefined') {
                Sys_notify(FS.virtual[localPath], localPath);
            }
            return null;
        },

        /**
         * Deletes a file entry key from the flat map memory context.
         */
        unlink: async function (path) {
            const localPath = normalizeVfsPath(path);
            const node = FS.virtual[localPath];

            if (!node) {
                throw createFsError('ENOENT', `No such file to unlink: ${path}`);
            }
            if ((node.mode >> 12) === ST_DIR) {
                throw createFsError('EISDIR', `Cannot unlink directory: ${path}`);
            }

            delete FS.virtual[localPath];

            if (typeof Sys_notify !== 'undefined') {
                Sys_notify(false, localPath);
            }
            return null;
        },

        /**
         * Creates a standardized directory map placeholder.
         */
        mkdir: async function (path, mode) {
            const localPath = normalizeVfsPath(path);

            if (FS.virtual[localPath]) {
                return null; // POSIX idempotent shorthand or choose to throw EEXIST
            }

            FS.virtual[localPath] = {
                path: localPath,
                contents: null,
                timestamp: new Date(),
                mode: FS_DIR,
                size: 4096,
                parent: localPath.includes('/') ? localPath.substring(0, localPath.lastIndexOf('/')) : ''
            };

            return null;
        },

        /**
         * Deletes a targeted empty directory path record.
         */
        rmdir: async function (path) {
            const localPath = normalizeVfsPath(path);
            const node = FS.virtual[localPath];

            if (!node) {
                throw createFsError('ENOENT', `Directory not found: ${path}`);
            }
            if ((node.mode >> 12) !== ST_DIR) {
                throw createFsError('ENOTDIR', `Path is a file target: ${path}`);
            }

            // Enforce safe directory deletion constraints
            const searchPrefix = localPath === '/' ? '/' : localPath + '/';
            const holdsChildren = Object.keys(FS.virtual).some(k => k.startsWith(searchPrefix) && k !== localPath);

            if (holdsChildren) {
                throw createFsError('ENOTEMPTY', `Directory containing assets: ${path}`);
            }

            delete FS.virtual[localPath];
            return null;
        },

        /**
         * Scans the flat keys of your registry context, returning only 
         * the immediate child names relative to the directory path.
         */
        readdir: async function (path) {
            const localPath = normalizeVfsPath(path);

            // Build trailing path matching signature 
            let prefix = localPath;
            if (!prefix.endsWith('/')) prefix += '/';
            if (localPath === '/' || localPath === config.RUNBASE) prefix = config.RUNBASE + '/';

            const collectedEntries = new Set();

            for (const key of Object.keys(FS.virtual)) {
                if (!key.startsWith(prefix) || key === localPath) continue;

                // Extract substring slice directly relative to current node level
                const relativeChunk = key.substring(prefix.length);
                const absoluteSlashIndex = relativeChunk.indexOf('/');

                if (absoluteSlashIndex === -1) {
                    collectedEntries.add(relativeChunk); // It's a direct child asset
                } else {
                    collectedEntries.add(relativeChunk.substring(0, absoluteSlashIndex)); // It's a sub-directory component
                }
            }

            return Array.from(collectedEntries);
        },

        /**
         * Generates metadata objects matching Node-style stats signatures.
         */
        stat: async function (path) {
            return isoGitFS._statEngine(path);
        },

        /**
         * Maps symlink tracking structures; falls back to standard stat rules for this flat environment.
         */
        lstat: async function (path) {
            return isoGitFS._statEngine(path);
        }
    },

    /**
     * Shared Internal Node Translation Engine
     */
    _statEngine: function (path) {
        const localPath = normalizeVfsPath(path);
        const node = FS.virtual[localPath];

        if (!node) {
            throw createFsError('ENOENT', `File entry context missing: ${path}`);
        }

        const isDirectory = (node.mode >> 12) === ST_DIR;

        // Construct isomorphic-git expected duck-typed Node.Stats structure payload
        return {
            size: isDirectory ? 0 : (node.contents?.length || 0),
            mtimeMs: node.timestamp.getTime(),
            mtime: node.timestamp,
            mode: node.mode,
            ino: 999, // Static stable tracking mapping identity
            dev: 1,
            uid: 1,
            gid: 1,
            isDirectory: () => isDirectory,
            isFile: () => !isDirectory,
            isSymbolicLink: () => node.target !== undefined
        };
    }
};

/**
 * Shared Helper to structure standard system errors throwing out of the layers
 */
function createFsError(code, message) {
    const error = new Error(`${code}: ${message}`);
    error.code = code;
    return error;
}

