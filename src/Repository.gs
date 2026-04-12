var RacsorRepository = (function () {
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
    var currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var headersMatch = headers.every(function (header, index) {
      return String(currentHeaders[index] || '') === String(header);
    });
    if (!headersMatch && sheet.getLastRow() <= 1) {
      sheet.clearContents();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function getAll(name) {
    var sheet = getSheet(name);
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return [];
    }
    return RacsorUtils.mapRows(values[0], values.slice(1)).filter(function (row) {
      return row[values[0][0]] !== '';
    });
  }

  function append(name, records) {
    if (!records || !records.length) {
      return;
    }
    var headers = RacsorConfig.SHEET_HEADERS[name];
    var rows = records.map(function (record) {
      return RacsorUtils.objectToRow(headers, record);
    });
    var sheet = getSheet(name);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
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
  }

  function updateById(name, idField, idValue, patch) {
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

  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    ensureSheet: ensureSheet,
    getAll: getAll,
    append: append,
    replaceAll: replaceAll,
    updateById: updateById,
    findBy: findBy,
    findOneBy: findOneBy
  };
})();
