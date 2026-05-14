
const DB_VERSION = 1 // Increment this when you add new C# Entities!
const LOCAL_DB_NAME = "Quedit" + DB_VERSION
const DB_NAME = "QueditOffline"
const DB_STORE_NAME = 'FILE_DATA';

const DB_SCHEME = [
    {
        key: DB_STORE_NAME, value: {
            item1: 'path', item2: [{
                key: 'timestamp', value: ['path', 'mode']
            }, {
                key: 'path', value: ['path', 'mode']
            }, {
                key: 'parent', value: ['parent', 'path', 'mode']
            }]
        }
    }
]

async function getDB(dbName = null, dbVersion = null) {
    return new Promise((rs, rj) => {
        const req = indexedDB.open(dbName || LOCAL_DB_NAME, dbVersion || DB_VERSION)
        req.onsuccess = () => rs(req.result)
        req.onerror = () => {
            console.log(req.error)
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
            console.log(request.error)
            return resolve({ item1: dbName || LOCAL_DB_NAME, item2: DB_VERSION, item3: true, item4: expectedStores.map(s => s.key) })
        }
    })
}


async function setupDatabase(dbName, stores) {
    var created = false
    var error = null
    return new Promise((rs, rj) => {
        const request = indexedDB.open(dbName || LOCAL_DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event) => {
            const db = event.target.result

            try {

                for (var key in stores) {
                    var storeName = stores[key].key
                    var keyPath = stores[key].value.item1
                    var columnNames = stores[key].value.item2

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

            } catch (ex) { error = ('' + ex) + ' on ' + JSON.stringify(stores) }
        }
        request.onsuccess = () => rs({ item1: created, item2: error ? ('' + error) : (created ? "upgraded" : "finished") })
        request.onerror = () => {
            console.log(request.error)
            return rj(request.error)
        }
        request.onblocked = () => rj("Database upgrade blocked. Close other tabs.")
    })
}


const debouncePath = {}
async function putRecord(storeName, record, dbName = null, noBounce = false) {
    if(typeof debouncePath[record.path] !== 'undefined')
    {
        clearTimeout(debouncePath)
    }
    if(!noBounce)
        return debouncePath[record.path] = setTimeout(() => putRecord(storeName, record, dbName, true), 100)

    const db = await getDB(dbName)
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    return new Promise((rs, rj) => {
        const newRecord = {
            timestamp: record.timestamp,
            mode: record.mode,
            contents: record.contents,
            path: record.path,
            sha: record.sha,
            parent: record.parent
        }
        if(!newRecord.path
            || newRecord.path === 'build/release-wasm-js/cpp/lex.o'
        )
        {
            debugger
        }
        const req = store.put(newRecord)
        tx.oncomplete = function () { rs(req.result) }
        req.onerror = () => {
            console.log(req.error)
            return rj(req.error)
        }
        tx.commit();
    })
}

async function getRecord(storeName, key, dbName = null) {
    const db = await getDB(dbName)
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    return new Promise((rs, rj) => {
        const req = store.get(key)
        req.onsuccess = () => rs(req.result)
        req.onerror = () => {
            console.log(req.error)
            return rj(req.error)
        }
    })
}



async function queryIndex(storeName, indexName, exactIndex = null, lower = null, upper = null) {
    const db = await getDB()
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)

    var range = null
    if (exactIndex !== null) {
        range = IDBKeyRange.only([exactIndex])
    } else if (upper !== null && lower !== null) {
        range = IDBKeyRange.bound([lower], [upper])
    } else if (upper !== null) {
        range = IDBKeyRange.upperBound([upper])
    } else if (lower !== null) {
        range = IDBKeyRange.lowerBound([lower])
    } else {
        range = null // Get all records
    }


    return new Promise((rs, rj) => {
        let req;
        if (indexName != null) {
            const index = store.index(indexName)
            req = index.getAll(range)
        }
        else {
            req = store.getAll(range)
        }
        req.onsuccess = () => {
            console.log(req.result)
            return rs(req.result)
        }
        req.onerror = () => {
            console.log(req.error)
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
            console.log(req.error)
            return rj(req.error)
        }
        tx.commit()
    })
}

async function readAll(database, callback) {
    // ... your existing setup/install logic ...

    let db = await getDB(database);
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