/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {

  function Set() {
    this.set_ = new global.Set;
    this.keys_ = [];
  }

  Set.prototype = {
    add: function(key) {
      if (!this.set_.has(key))
        this.keys_.push(key);
      return this.set_.add(key);
    },

    has: function(key) {
      return this.set_.has(key);
    },

    delete: function(key) {
      this.keys_.splice(this.keys_.indexOf(key), 1);
      this.set_.delete(key);
    },

    keys: function() {
      return this.keys_.slice();
    }
  }

  var dbName = 'PersistObserved';
  var version;
  var db;
  var storeNames = {};

  function constructorName(objOrFunction) {
    if (typeof objOrFunction == 'function')
      return objOrFunction.name;
    else
      return Object.getPrototypeOf(objOrFunction).constructor.name;
  }

  function getKeyPath(constructor) {
    return constructor.keyPath || 'id';
  }

  function onerror(e) {
    console.log('Error: ' + e);
  };

  var postOpen = [];

  function openDB() {
    var request = webkitIndexedDB.open(dbName);

    request.onerror = onerror;
    request.onsuccess = function(e) {
      db = e.target.result;
      version = db.version || 0;
      for (var i = 0; i < db.objectStoreNames.length; i++)
        storeNames[db.objectStoreNames.item(i)] = true;

      postOpen.forEach(function(action) {
        action();
      });
    };
  }

  function handleChanged(changeRecords) {
    changeRecords.forEach(function(change) {
      persist(change.object);
    });
  }

  var observer = new ChangeSummary(function(summaries) {
    storeChanges = {};

    function getChange(obj) {
      var change = storeChanges[constructorName(obj)];
      if (change)
        return change;

      change = {
        keyPath: getKeyPath(obj),
        needsAdd: new Set,
        needsSave: new Set,
        needsDelete: new Set
      };

      storeChanges[storeName] = change;
      return change;
    }

    summaries.forEach(function(summary) {
      if (!Array.isArray(summary.object)) {
        getChange(summary.object).needsSave.add(summary.object);
        return;
      }

      summary.arraySplices.forEach(function(splice) {
        for (var i = 0; i < splice.removed.length; i++) {
          var obj = splice.removed[i];
          var change = getChange(obj);
          if (change.needsAdd.has(obj))
            change.needsAdd.delete(obj);
          else
            change.needsDelete.add(obj);
        }

        for (var i = splice.index; i < splice.index + splice.addedCount; i++) {
          var obj = summary.object[i];
          var change = getChange(obj);
          if (change.needsDelete.has(obj))
            change.needsDelete.delete(obj);
          else
            change.needsAdd.add(obj);
        }
      });
    });

    var storeNames = Object.keys(storeChanges);

    console.log('Persisting: ' + JSON.stringify(storeNames));
    var trans = db.transaction(storeNames, "readwrite");
    trans.onerror = onerror;
    trans.oncomplete = function() {
      console.log('...complete');
    }
    storeNames.forEach(function(storeName) {

      var change = storeChanges[storeName];
      var store = trans.objectStore(storeName);

      change.needsDelete.keys().forEach(function(obj) {
        var request = store.delete(obj[change.keyPath]);
        request.onerror = onerror;
        request.onsuccess = function(e) {
          console.log(' deleted: ' + JSON.stringify(obj));
          delete obj[keyPath];
          observer.unobserve(obj);
          if (change.needsSave.has(obj))
            change.needsSave.delete(obj);
        };
      });

      change.needsSave.keys().forEach(function(obj) {
        var request = store.put(obj);
        request.onerror = onerror;
        request.onsuccess = function(e) {
          console.log(' saved: ' + JSON.stringify(obj));
        };
      });

      change.needsAdd.keys().forEach(function(obj) {
        obj[keyPath] = ++maxIds[storeName];
        var request = store.put(obj);
        request.onerror = onerror;
        request.onsuccess = function(e) {
          console.log(' created: ' + JSON.stringify(obj));
          observer.observe(obj);
        };
      });
    });
  });

  var maxIds = {};

  global.persistDB = {};

  global.persistDB.retrieve = function(constructor) {
    var results = [];
    var instance = new constructor();

    keyPath = constructor.keyPath || 'id';
    storeName = constructor.name;
    maxIds[storeName] = maxIds[storeName] || 0;

    function doRetrieve() {
      console.log("Retrieving: " + storeName);

      var trans = db.transaction([storeName]);
      var store = trans.objectStore(storeName);

      var keyRange = webkitIDBKeyRange.lowerBound(0);
      var request = store.openCursor(keyRange);

      request.onerror = onerror;

      request.onsuccess = function(e) {
        var result = e.target.result;
        if (!!result == false) {
          observer.observePropertySet(results);
          console.log('...complete');
          return;
        }

        var object = result.value;
        maxIds[storeName] = Math.max(maxIds[storeName], object[keyPath]);

        object.__proto__ = instance;
        constructor.apply(object);
        results.push(object);
        observer.observe(object);

        console.log(' => ' + JSON.stringify(object));
        result.continue();
      };
    }

    function createStore() {
      console.log('Creating store: ' + storeName);
      version++;
      var request = db.setVersion(version);
      request.onerror = onerror;

      request.onsuccess = function(e) {
        var store = db.createObjectStore(storeName, { keyPath: keyPath });
        storeNames[storeName] = true;
        e.target.transaction.oncomplete = doRetrieve;
      };
    }

    var action = function() {
      if (storeName in storeNames)
        doRetrieve()
      else
        createStore();
    }

    if (db)
      action();
    else
      postOpen.push(action);

    return results;
  };

  openDB();
})(this);
