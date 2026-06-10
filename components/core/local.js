
const DB_VERSION = 1 // Increment this when you add new C# Entities!
const DB_NAME = "briancullinan2/quedit"
const DB_STORE_NAME = 'FILE_DATA';
const DB_DEBOUNCE_INTERVAL = 50

const DB_SCHEME = [
    {
        key: DB_STORE_NAME, value: {
            item1: 'path', item2: [{
                key: 'timestamp', value: 'timestamp'
            }, {
                key: 'parent', value: 'parent'
            }]
        }
    }
]

async function getDB(dbName = null, dbVersion = null) {
    return new Promise((rs, rj) => {
        const req = indexedDB.open(dbName || DB_NAME, dbVersion || DB_VERSION)
        req.onsuccess = () => rs(req.result)
        req.onerror = () => {
            console.error(req.error)
            return rj(req.error)
        }
        // Note: setupStore handles the onupgradeneeded logic
        return [dbName || DB_NAME, dbVersion || DB_VERSION]
    })
}

async function deleteOldDatabase(dbName = null) {
    return new Promise((rs) => {
        const req = indexedDB.deleteDatabase(dbName || DB_NAME)
        req.onsuccess = () => rs(true)
        req.onerror = () => rs(false) // Silent fail is usually fine for cleanup
        req.onblocked = () => rs(true)
    })
}


async function getDatabaseMetadata() {
    // Returns a list of { name, version } objects
    // Note: this may not be supported in very old WebViews, 
    // but works in modern MAUI (Edge/WebView2/WebKit)
    if (!indexedDB.databases) {
        return []
    }
    const dbs = await indexedDB.databases()
    // DO NOT skip the offline database
    return dbs //.filter(db => db.name != DB_NAME)
        .map(db => ({ key: db.name || '', value: db.version || 0 }))
}


async function needsInstall(dbName, expectedStores) {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName || DB_NAME, DB_VERSION)

        request.onsuccess = (event) => {
            const db = event.target.result
            const existingStores = Array.from(db.objectStoreNames)

            // Identify which expected stores are missing
            const missingStores = expectedStores.filter(s => !existingStores.includes(s.key)).map(s => s.key)

            db.close()
            return resolve({
                item1: dbName,
                item2: db.version,
                item3: missingStores.length > 0,
                item4: missingStores
            })
        }

        request.onerror = () => {
            // If we can't even open it, mark as corrupted
            console.error(request.error)
            return resolve({ item1: dbName || DB_NAME, item2: DB_VERSION, item3: true, item4: expectedStores.map(s => s.key) })
        }
    })
}


async function setupDatabase(dbName, stores) {
    let created = false
    let error = null
    if (dbName.length < 4 || dbName.startsWith('/')) {
        debugger
        console.error('how the fuck does this even happen?')
        throw new Error('how the fuck does this even happen?')
    }
    return new Promise((rs, rj) => {
        const request = indexedDB.open(dbName || DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event) => {
            const db = event.target.result

            try {

                for (let key in stores) {
                    let storeName = stores[key].key
                    let keyPath = stores[key].value.item1
                    let columnNames = stores[key].value.item2

                    if (!keyPath || keyPath.length == 0) throw new Error('Keypath invalid for: ' + JSON.stringify(stores[key]))

                    // If the store already exists, delete it so we can refresh the indexes
                    if (db.objectStoreNames.contains(storeName)) {
                        continue
                    }

                    const store = db.createObjectStore(storeName, { keyPath: keyPath })

                    columnNames.forEach(col => {
                        if (col.key !== keyPath) {
                            store.createIndex(col.key, col.value, { unique: false })
                        }
                    })

                }

                created = true

            } catch (ex) {
                debugger
                error = ('' + ex) + ' on ' + JSON.stringify(stores)
                throw ex
            }
        }
        request.onsuccess = () => rs({ item1: created, item2: error ? ('' + error) : (created ? "upgraded" : "finished") })
        request.onerror = () => {
            console.error(request.error)
            return rj(request.error)
        }
        request.onblocked = () => rj("Database upgrade blocked. Close other tabs.")
    })
}




async function putRecordInternal(storeName, record, dbName = null) {
    const newRecord = {
        timestamp: record.timestamp,
        mode: record.mode,
        contents: typeof FS !== 'undefined' ? (record.contents = FS.virtual[record.path]?.contents || record.contents?.slice(0)) : record.contents?.slice(0),
        path: record.path,
        sha: record.sha,
        parent: record.parent
    }

    if (newRecord.path.includes('//') || newRecord.path.includes('http:')) {
        console.error('LEARN HOW TO FUCKING PROGRAM: ' + newRecord.path);
        debugger;
        throw new Error('LEARN HOW TO FUCKING PROGRAM: ' + newRecord.path)
    }
    if (!newRecord.path
        || newRecord.path === 'assets'
        //    || newRecord.path.includes('.qvm')
    ) {
        debugger
    }

    const db = await getDB(dbName)
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    return new Promise((rs, rj) => {

        const req = store.put(newRecord)
        tx.oncomplete = function () { rs(req.result) }
        req.onerror = () => {
            console.error(req.error)
            return rj(req.error)
        }
        tx.commit();
    })
}



const getBounceRegistry = {
    'put': {},
    'get': {},
    'query': {},
    'cache': {},
};



async function putRecord(storeName, record, dbName = null, noBounce = false) {
    return await debounceRecords(storeName, 'path', record, null, null, dbName, MODE = 'put', noBounce)
}



async function getRecord(storeName, record, dbName = null, noBounce = false) {
    return await debounceRecords(storeName, 'path', record, null, null, dbName, MODE = 'get', noBounce)
}



async function queryIndex(storeName, indexName, exactIndex = null, lower = null, upper = null, dbName = null, noBounce = false) {
    return await debounceRecords(storeName, indexName, exactIndex, lower, upper, dbName, MODE = 'query', noBounce)
}


function debounceRecords(storeName, indexName, record, lower, upper, dbName, MODE = 'get', noBounce = false) {
    const path = typeof record === 'string' ? record : record?.path || '';
    const parts = dbName.split('/');
    const ownerName = parts.length === 2 ? parts[0] : (typeof owner !== 'undefined' ? owner.value : '');
    const repoName = parts.length === 2 ? parts[1] : (parts[0] || (typeof repository !== 'undefined' ? repository.value : ''));

    // 1. Generate a comprehensive unique composite signature key out of all input arguments
    // This isolates variations in stores, indices, query ranges, and databases entirely.
    const compositeArgs = {
        storeName,
        indexName,
        path,
        lower: lower ?? null,
        upper: upper ?? null,
        dbName
    };
    const registryKey = JSON.stringify(compositeArgs);

    // 2. If bypass flag is explicit, execute immediate persistence pass
    if (noBounce) {
        if (getBounceRegistry[MODE][registryKey]) {
            clearTimeout(getBounceRegistry[MODE][registryKey].timer);
            getBounceRegistry[MODE][registryKey].reject(new Error("Superseded by immediate write"));
            delete getBounceRegistry[MODE][registryKey];
        }

        if (MODE === 'get')
            return getRecordInternal(storeName, record, dbName);
        else if (MODE === 'put')
            return putRecordInternal(storeName, record, dbName);
        else if (MODE === 'query')
            return queryIndexInternal(storeName, indexName, record, lower, upper, dbName); // Fixed typo: passed indexName
        else if (MODE === 'cache')
            return cacheFileInternal(ownerName, repoName, record, lower, upper, dbName);
        else
            throw new Error('MODE not recognized in debounceRecords: ' + MODE);
    }

    // 3. If a delayed operation with matching signature exists, reset clock AND update references
    if (getBounceRegistry[MODE][registryKey]) {
        clearTimeout(getBounceRegistry[MODE][registryKey].timer);

        // CRITICAL FIX: Refresh execution parameters in storage to defeat closure scope stalling!
        getBounceRegistry[MODE][registryKey].latestArgs = { storeName, indexName, record, lower, upper, dbName, ownerName, repoName };
    } else {
        // Instantiate a fresh tracking token structural block
        getBounceRegistry[MODE][registryKey] = {
            promise: null,
            resolve: null,
            reject: null,
            timer: null,
            latestArgs: { storeName, indexName, record, lower, upper, dbName, ownerName, repoName }
        };

        getBounceRegistry[MODE][registryKey].promise = new Promise((res, rej) => {
            getBounceRegistry[MODE][registryKey].resolve = res;
            getBounceRegistry[MODE][registryKey].reject = rej;
        });
    }

    // 4. Queue up execution pass mapped directly to the composite signature entry
    getBounceRegistry[MODE][registryKey].timer = setTimeout(async () => {
        const currentExecutionState = getBounceRegistry[MODE][registryKey];

        if (!currentExecutionState) {
            console.warn(`Callback for key structure was superseded or cleared before execution.`);
            return;
        }

        // Destructure the fresh updated configuration parameter variables safely out of state tracking
        const {
            storeName: sName, indexName: iName, record: rec,
            lower: low, upper: up, dbName: dName,
            ownerName: oName, repoName: rName
        } = currentExecutionState.latestArgs;

        try {
            let result;
            if (MODE === 'get')
                result = await getRecordInternal(sName, rec, dName);
            else if (MODE === 'put')
                result = await putRecordInternal(sName, rec, dName);
            else if (MODE === 'query')
                result = await queryIndexInternal(sName, iName, rec, low, up, dName);
            else if (MODE === 'cache')
                result = await cacheFileInternal(oName, rName, rec, low, up, dName);
            else
                throw new Error('MODE not recognized in debounceRecords: ' + MODE);

            currentExecutionState.resolve(result);
        } catch (err) {
            if (currentExecutionState && typeof currentExecutionState.reject === 'function') {
                currentExecutionState.reject(err);
            }
        } finally {
            // Safe garbage collection loop execution pass 
            if (getBounceRegistry[MODE] && getBounceRegistry[MODE][registryKey] === currentExecutionState) {
                delete getBounceRegistry[MODE][registryKey];
            }
        }
    }, DB_DEBOUNCE_INTERVAL);

    return getBounceRegistry[MODE][registryKey].promise;
}


async function getRecordInternal(storeName, key, dbName = null) {


    const db = await getDB(dbName);
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    return new Promise((rs, rj) => {
        let result = null;
        const req = store.get(key);

        req.onsuccess = () => {
            // Capture the raw record out of the request immediately
            result = req.result;
        };

        // Bind resolution to the Transaction's explicit completion event
        tx.oncomplete = () => {
            // 1. If no record was found, exit early with null
            if (!result) {
                return rs(null);
            }

            // 2. Safely fix the Symmetrical Path / "Homeless Node" issue
            if (result.parent === null || result.parent === undefined) {
                const path = result.path || "";
                const lastSlash = path.lastIndexOf('/');

                if (lastSlash <= 0) {
                    result.parent = '/';
                } else {
                    result.parent = path.substring(0, lastSlash);
                }
            }

            rs(result);
        };

        // Trap failures cleanly at both the request and transaction boundaries
        req.onerror = () => rj(req.error);
        tx.onerror = () => {
            console.error("IDB Transaction Failed for getRecord:", tx.error);
            rj(tx.error);
        };
        tx.onabort = () => rj(new Error("Transaction aborted"));
    });
}




async function queryIndexInternal(storeName, indexName, exactIndex = null, lower = null, upper = null, dbName = null) {
    const db = await getDB(dbName)
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName || store.keyPath)

    let range = null
    if (exactIndex !== null) {
        range = IDBKeyRange.only(Array.isArray(index.keyPath) && !(Array.isArray(exactIndex)) ? [exactIndex] : exactIndex)
    } else if (upper !== null && lower !== null) {
        range = IDBKeyRange.bound(Array.isArray(index.keyPath) && !(Array.isArray(lower)) ? [lower] : lower,
            Array.isArray(index.keyPath) && !(Array.isArray(upper)) ? [upper] : upper)
    } else if (upper !== null) {
        range = IDBKeyRange.upperBound(Array.isArray(index.keyPath) && !(Array.isArray(upper)) ? [upper] : upper)
    } else if (lower !== null) {
        range = IDBKeyRange.lowerBound(Array.isArray(index.keyPath) && !(Array.isArray(lower)) ? [lower] : lower)
    } else {
        range = null // Get all records
    }


    return new Promise((rs, rj) => {
        let req;
        if (indexName != null) {
            req = index.getAll(range)
        }
        else {
            req = store.getAll(range)
        }
        req.onsuccess = () => {
            //console.log(req.result)
            return rs(req.result)
        }
        req.onerror = () => {
            console.error(req.error)
            return rj(req.error)
        }
    })
}



async function deleteRecord(storeName, key, dbName = null) {
    const db = await getDB(dbName)
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    return new Promise((rs, rj) => {
        const req = store.delete(key)
        tx.oncomplete = function () { rs(true) }
        req.onerror = () => {
            console.error(req.error)
            return rj(req.error)
        }
        tx.commit()
    })
}

async function readAll(dbName, callback) {
    // ... your existing setup/install logic ...

    let db = await getDB(dbName);
    let transaction = db.transaction([DB_STORE_NAME], 'readonly');
    let objStore = transaction.objectStore(DB_STORE_NAME);

    // getAll() returns an array of all objects in the store immediately
    const request = objStore.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = async (event) => {
            const allItems = event.target.result;

            if (callback && typeof callback === 'function') {
                // You can pass the whole array to your callback at once
                allItems.forEach(callback);
            }
            resolve(allItems);
        };

        request.onerror = (err) => {
            console.error("IndexedDB Read Error:", err);
            reject(err);
        };
    });
}

function findVirtualFiles(globPattern) {
    const filePaths = Object.keys(FS.virtual);
    const rx = globToRegex(globPattern);

    return filePaths.reduce((accumulator, path) => {
        if (rx.test(path)) {
            accumulator[path] = FS.virtual[path];
        }
        return accumulator;
    }, {});
}
function globToRegex(pattern) {
    // Clean up leading/trailing slashes so matching is uniform
    let cleaned = pattern.trim();
    if (cleaned.startsWith('/')) cleaned = cleaned.substring(1);

    let regexStr = cleaned
        .replace(/([.+^=!:${}()|\[\]\/\\])/g, "\\$1") // 1. Escape regex specials
        .replace(/\x2A\x2A/g, ".*")                   // 2. ** -> match anything
        .replace(/(?<!\.)\x2A/g, "[^\\/]*")           // 3. * -> match except slashes (ignore translated .*)
        .replace(/\x3F/g, ".");                      // 4. ? -> match single char

    // If it ends with .*, make the trailing slash context optional 
    if (regexStr.endsWith('.*')) {
        regexStr = regexStr.replace(/\\\/.*$/, "(?:\\/.*)?");
    }

    // Match either from the root of the repository or as a segment within it
    return new RegExp(`^(?:.*\\/)?${regexStr}$`, "i");
}
