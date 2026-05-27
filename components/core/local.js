
const DB_VERSION = 1 // Increment this when you add new C# Entities!
const LOCAL_DB_NAME = "Quedit" + DB_VERSION
const DB_NAME = "QueditOffline"
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
        const req = indexedDB.open(dbName || LOCAL_DB_NAME, dbVersion || DB_VERSION)
        req.onsuccess = () => rs(req.result)
        req.onerror = () => {
            writeLog(req.error)
            return rj(req.error)
        }
        // Note: setupStore handles the onupgradeneeded logic
        return [dbName || LOCAL_DB_NAME, dbVersion || DB_VERSION]
    })
}

async function deleteOldDatabase(dbName = null) {
    return new Promise((rs) => {
        const req = indexedDB.deleteDatabase(dbName || LOCAL_DB_NAME)
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
    // skip the offline database
    return dbs.filter(db => db.name != DB_NAME)
        .map(db => ({ key: db.name || '', value: db.version || 0 }))
}


async function needsInstall(dbName, expectedStores) {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName || LOCAL_DB_NAME, DB_VERSION)

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
            writeLog(request.error)
            return resolve({ item1: dbName || LOCAL_DB_NAME, item2: DB_VERSION, item3: true, item4: expectedStores.map(s => s.key) })
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
        const request = indexedDB.open(dbName || LOCAL_DB_NAME, DB_VERSION)

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
            writeLog(request.error)
            return rj(request.error)
        }
        request.onblocked = () => rj("Database upgrade blocked. Close other tabs.")
    })
}




async function putRecordInternal(storeName, record, dbName = null) {
    const newRecord = {
        timestamp: record.timestamp,
        mode: record.mode,
        contents: (record.contents = FS.virtual[record.path]?.contents || record.contents?.slice(0)),
        path: record.path,
        sha: record.sha,
        parent: record.parent
    }

    
    if (!newRecord.path
    //    || newRecord.path === 'build/release-wasm-js/cpp/lex.o'
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
            writeLog(req.error)
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
    const path = record.path;
    const parts = dbName.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    // 1. If bypass flag is explicit, execute immediate persistence pass
    if (noBounce) {
        // Clear any existing delayed writes for this path immediately
        if (getBounceRegistry[MODE][path]) {
            clearTimeout(getBounceRegistry[MODE][path].timer);
            getBounceRegistry[MODE][path].reject(new Error("Superseded by immediate write"));
            delete getBounceRegistry[MODE][path];
        }
        if (MODE === 'get')
            return getRecordInternal(storeName, record, dbName);
        else if (MODE === 'put')
            return putRecordInternal(storeName, record, dbName);
        else if (MODE === 'query')
            return queryIndexInternal(storeName, record, dbName);
        else if (MODE === 'cache')
            return cacheFileInternal(ownerName, repoName, record, lower, upper, dbName);
        else
            throw new Error('MODE not recognized in debounceRecords: ' + MODE)
    }

    // 2. If a delayed synchronization operation is already pending, reset its countdown clock
    if (getBounceRegistry[MODE][path]) {
        clearTimeout(getBounceRegistry[MODE][path].timer);
    } else {
        // Otherwise, instantiate a fresh, long-lived promise handle for the layout worker pipeline
        getBounceRegistry[MODE][path] = {
            promise: null,
            resolve: null,
            reject: null,
            timer: null
        };

        getBounceRegistry[MODE][path].promise = new Promise((res, rej) => {
            getBounceRegistry[MODE][path].resolve = res;
            getBounceRegistry[MODE][path].reject = rej;
        });
    }

    // 3. Queue up the snapshot write capture pass
    getBounceRegistry[MODE][path].timer = setTimeout(async () => {
        // Grab a snapshot of the current state reference registry handle
        const currentExecutionState = getBounceRegistry[MODE][path];

        // FIXED: If an immediate write pass cleared or replaced this tracking slot
        // while this callback was queued in the event loop, exit immediately.
        if (!currentExecutionState) {
            writeLog(`Callback for ${path} was superseded or cleared before execution.`);
            return;
        }

        try {
            let result;
            if (MODE === 'get')
                result = await getRecordInternal(storeName, record, dbName);
            else if (MODE === 'put')
                result = await putRecordInternal(storeName, record, dbName);
            else if (MODE === 'query')
                result = await queryIndexInternal(storeName, indexName, record, lower, upper, dbName);
            else if (MODE === 'cache')
                result = await cacheFileInternal(ownerName, repoName, record, lower, upper, dbName);
            else
                throw new Error('MODE not recognized in debounceRecords: ' + MODE)

            // Resolve the long-running promise pipeline safely
            currentExecutionState.resolve(result);
        } catch (err) {
            // Check if it hasn't been rejected already by a superseded execution frame
            if (currentExecutionState && typeof currentExecutionState.reject === 'function') {
                currentExecutionState.reject(err);
            }
        } finally {
            // Garbage collect tracking tokens smoothly if no active overwrites clobbered this block
            if (getBounceRegistry[MODE] && getBounceRegistry[MODE][path] === currentExecutionState) {
                delete getBounceRegistry[MODE][path];
            }
        }
    }, DB_DEBOUNCE_INTERVAL);

    // Return the stable single tracking promise handler back up the execution chain
    return getBounceRegistry[MODE][path].promise;
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
            //writeLog(req.result)
            return rs(req.result)
        }
        req.onerror = () => {
            writeLog(req.error)
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
            writeLog(req.error)
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