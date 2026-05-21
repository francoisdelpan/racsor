var RacsorRepository = (function () {
  var runtimeCache = {};
  var CACHE_TTL_SECONDS = 300;
  var SCRIPT_CACHE_SHEETS = {};
  SCRIPT_CACHE_SHEETS[RacsorConfig.SHEETS.PRODUCTS] = true;
  SCRIPT_CACHE_SHEETS[RacsorConfig.SHEETS.PRICING_RULES] = true;
  SCRIPT_CACHE_SHEETS[RacsorConfig.SHEETS.PRICES] = true;
  SCRIPT_CACHE_SHEETS[RacsorConfig.SHEETS.RETURN_STATES] = true;
  SCRIPT_CACHE_SHEETS[RacsorConfig.SHEETS.USERS] = true;

  function getSpreadsheet() {
    var settings = RacsorConfig.getProjectSettings();
    if (settings.spreadsheetId) {
      return SpreadsheetApp.openById(settings.spreadsheetId);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function getSheet(name) {
    var sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) {
      throw new Error('Sheet not found: ' + name);
    }
    return sheet;
  }

  function ensureSheet(name, headers) {
    var spreadsheet = getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return sheet;
    }
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastColumn, headers.length)).getValues()[0];
    var headersMatch = headers.every(function (header, index) {
      return String(currentHeaders[index] || '') === String(header);
    });
    if (!headersMatch && sheet.getLastRow() <= 1) {
      sheet.clearContents();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      invalidate(name);
      return sheet;
    }
    if (appendMissingHeaders_(sheet, currentHeaders, headers)) {
      invalidate(name);
    }
    return sheet;
  }

  function getAll(name) {
    if (runtimeCache[name]) {
      return cloneRows_(runtimeCache[name]);
    }
    var cached = getFromScriptCache_(name);
    if (cached) {
      runtimeCache[name] = cached;
      return cloneRows_(cached);
    }
    var sheet = getSheet(name);
    var lastRow = sheet.getLastRow();
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    if (lastRow < 2) {
      runtimeCache[name] = [];
      saveToScriptCache_(name, []);
      return [];
    }
    var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    if (values.length < 2) {
      return [];
    }
    var rows = RacsorUtils.mapRows(values[0], values.slice(1)).filter(function (row) {
      return row[values[0][0]] !== '';
    });
    runtimeCache[name] = rows;
    saveToScriptCache_(name, rows);
    return cloneRows_(rows);
  }

  function append(name, records) {
    if (!records || !records.length) {
      return;
    }
    var headers = RacsorConfig.SHEET_HEADERS[name];
    ensureSheet(name, headers);
    var rows = records.map(function (record) {
      return RacsorUtils.objectToRow(headers, record);
    });
    var sheet = getSheet(name);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    invalidate(name);
  }

  function replaceAll(name, records) {
    var headers = RacsorConfig.SHEET_HEADERS[name];
    var sheet = getSheet(name);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (records && records.length) {
      append(name, records);
    }
    invalidate(name);
  }

  function updateById(name, idField, idValue, patch) {
    ensureSheet(name, RacsorConfig.SHEET_HEADERS[name]);
    var sheet = getSheet(name);
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      throw new Error('No data in sheet ' + name);
    }
    var headers = values[0];
    var rowIndex = -1;
    for (var i = 1; i < values.length; i += 1) {
      if (String(values[i][headers.indexOf(idField)]) === String(idValue)) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) {
      throw new Error('Record not found in ' + name + ' for ' + idField + '=' + idValue);
    }
    var rowValues = values[rowIndex - 1].slice();
    Object.keys(patch).forEach(function (key) {
      var col = headers.indexOf(key);
      if (col >= 0) {
        rowValues[col] = patch[key];
      }
    });
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    invalidate(name);
  }

  function deleteBy(name, predicate) {
    var records = getAll(name);
    var remaining = records.filter(function (record) {
      return !predicate(record);
    });
    if (remaining.length === records.length) {
      return;
    }
    replaceAll(name, remaining);
  }

  function replaceWhere(name, predicate, newRecords) {
    var records = getAll(name).filter(function (record) {
      return !predicate(record);
    });
    (newRecords || []).forEach(function (record) {
      records.push(record);
    });
    replaceAll(name, records);
  }

  function findBy(name, predicate) {
    return getAll(name).filter(predicate);
  }

  function findOneBy(name, predicate) {
    var records = getAll(name);
    for (var i = 0; i < records.length; i += 1) {
      if (predicate(records[i])) {
        return records[i];
      }
    }
    return null;
  }

  function invalidate(name) {
    delete runtimeCache[name];
    if (!SCRIPT_CACHE_SHEETS[name]) {
      return;
    }
    try {
      CacheService.getScriptCache().remove(getCacheKey_(name));
    } catch (error) {
    }
  }

  function appendMissingHeaders_(sheet, currentHeaders, expectedHeaders) {
    var headerMap = {};
    var changed = false;
    currentHeaders.forEach(function (header) {
      if (header) {
        headerMap[String(header)] = true;
      }
    });
    var nextColumn = sheet.getLastColumn() + 1;
    expectedHeaders.forEach(function (header) {
      if (!headerMap[String(header)]) {
        sheet.getRange(1, nextColumn).setValue(header);
        headerMap[String(header)] = true;
        nextColumn += 1;
        changed = true;
      }
    });
    return changed;
  }

  function getCacheKey_(name) {
    var spreadsheetId = '';
    try {
      spreadsheetId = getSpreadsheet().getId();
    } catch (error) {
      spreadsheetId = 'active';
    }
    return 'racsor:' + spreadsheetId + ':' + name;
  }

  function getFromScriptCache_(name) {
    if (!SCRIPT_CACHE_SHEETS[name]) {
      return null;
    }
    try {
      var raw = CacheService.getScriptCache().get(getCacheKey_(name));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveToScriptCache_(name, rows) {
    if (!SCRIPT_CACHE_SHEETS[name]) {
      return;
    }
    try {
      CacheService.getScriptCache().put(getCacheKey_(name), JSON.stringify(rows || []), CACHE_TTL_SECONDS);
    } catch (error) {
    }
  }

  function cloneRows_(rows) {
    return (rows || []).map(function (row) {
      var clone = {};
      Object.keys(row).forEach(function (key) {
        clone[key] = row[key] instanceof Date ? new Date(row[key].getTime()) : row[key];
      });
      return clone;
    });
  }

  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    ensureSheet: ensureSheet,
    getAll: getAll,
    append: append,
    replaceAll: replaceAll,
    updateById: updateById,
    deleteBy: deleteBy,
    replaceWhere: replaceWhere,
    findBy: findBy,
    findOneBy: findOneBy,
    invalidate: invalidate
  };
})();
