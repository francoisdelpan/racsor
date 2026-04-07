var RacsorStockService = (function () {
  function getProducts_() {
    return RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).filter(function (item) {
      return String(item.is_active) !== 'false';
    }).map(function (item) {
      item.stock_max = Number(item.stock_max || 0);
      return item;
    });
  }

  function ensureStockSheetExists() {
    var sheet = RacsorRepository.ensureSheet(RacsorConfig.SHEETS.STOCK_MOVEMENTS, ['date']);
    if (String(sheet.getRange(1, 1).getValue()) !== 'date') {
      sheet.clearContents();
      sheet.getRange(1, 1).setValue('date');
      sheet.setFrozenRows(1);
    }
    syncProductColumns_();
    return sheet;
  }

  function initializeStockBase_(baseDate) {
    var sheet = ensureStockSheetExists();
    var products = getProducts_();
    var firstDate = RacsorUtils.toDateOnlyString(baseDate || new Date());
    syncProductColumns_();
    if (sheet.getLastRow() < 2) {
      var firstRow = [firstDate];
      products.forEach(function (product) {
        firstRow.push(Number(product.stock_max || 0));
      });
      sheet.getRange(2, 1, 1, firstRow.length).setValues([firstRow]);
    }
    return sheet;
  }

  function syncProductColumns_() {
    var sheet = RacsorRepository.getSheet(RacsorConfig.SHEETS.STOCK_MOVEMENTS);
    var products = getProducts_();
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    if (!headers[0]) {
      headers[0] = 'date';
      sheet.getRange(1, 1).setValue('date');
    }
    var headerMap = {};
    headers.forEach(function (header, index) {
      if (header) {
        headerMap[String(header)] = index + 1;
      }
    });
    var lastRow = sheet.getLastRow();
    products.forEach(function (product) {
      if (headerMap[product.id]) {
        return;
      }
      var newColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColumn).setValue(product.id);
      if (lastRow >= 2) {
        sheet.getRange(2, newColumn).setValue(Number(product.stock_max || 0));
      }
      if (lastRow >= 3) {
        var formulas = [];
        for (var row = 3; row <= lastRow; row += 1) {
          formulas.push(['=' + getCellA1_(row - 1, newColumn)]);
        }
        sheet.getRange(3, newColumn, formulas.length, 1).setFormulas(formulas);
      }
    });
    return getProductColumnMap_(sheet);
  }

  function ensureDatesUntil(targetDate) {
    var sheet = ensureStockSheetExists();
    var normalizedTargetDate = RacsorUtils.toDateOnlyString(targetDate);
    initializeStockBase_(normalizedTargetDate);
    var dates = getSheetDates_(sheet);
    var lastKnownDate = dates.length ? dates[dates.length - 1] : '';
    if (!lastKnownDate) {
      return sheet;
    }
    if (lastKnownDate >= normalizedTargetDate) {
      return sheet;
    }

    var productColumnMap = getProductColumnMap_(sheet);
    var productIds = Object.keys(productColumnMap);
    var currentDate = RacsorUtils.parseDate(lastKnownDate);
    var target = RacsorUtils.parseDate(normalizedTargetDate);
    var rows = [];
    while (currentDate.getTime() < target.getTime()) {
      currentDate.setDate(currentDate.getDate() + 1);
      rows.push([RacsorUtils.toDateOnlyString(currentDate)]);
    }
    if (!rows.length) {
      return sheet;
    }

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, 1).setValues(rows);
    productIds.forEach(function (productId) {
      var column = productColumnMap[productId];
      var formulas = [];
      for (var index = 0; index < rows.length; index += 1) {
        var rowNumber = startRow + index;
        formulas.push(['=' + getCellA1_(rowNumber - 1, column)]);
      }
      sheet.getRange(startRow, column, formulas.length, 1).setFormulas(formulas);
    });
    return sheet;
  }

  function getDateRow(dateString) {
    var sheet = ensureDatesUntil(dateString);
    var dates = getSheetDates_(sheet);
    var normalizedDate = RacsorUtils.toDateOnlyString(dateString);
    for (var index = 0; index < dates.length; index += 1) {
      if (dates[index] === normalizedDate) {
        return index + 2;
      }
    }
    throw new Error('Date de stock introuvable: ' + normalizedDate);
  }

  function getProductColumn(productId) {
    var map = syncProductColumns_();
    var column = map[productId];
    if (!column) {
      throw new Error('Produit introuvable dans Stock_Mouvement: ' + productId);
    }
    return column;
  }

  function applyStockOut(items, pickupDate) {
    applyStockDelta_(items, pickupDate, -1);
  }

  function applyStockIn(items, returnDate) {
    applyStockDelta_(items, returnDate, 1);
  }

  function applyInventoryOverride(payload) {
    var sheet = ensureDatesUntil(payload.movement_date);
    var row = getDateRow(payload.movement_date);
    var column = getProductColumn(payload.product_id);
    var cell = sheet.getRange(row, column);
    cell.setFormula('');
    cell.setValue(Number(payload.quantity || 0));
    cell.setFontWeight('bold');
  }

  function recordInventory(payload) {
    applyInventoryOverride(payload);
    return getStockSnapshot(payload.movement_date);
  }

  function recordInventoryBulk(payload) {
    ensureDatesUntil(payload.movement_date);
    (payload.items || []).forEach(function (item) {
      applyInventoryOverride({
        movement_date: payload.movement_date,
        product_id: item.product_id,
        quantity: item.quantity
      });
    });
    return getStockSnapshot(payload.movement_date);
  }

  function getMinimumAvailableStock(productId, pickupDate, returnDate) {
    var sheet = ensureDatesUntil(returnDate);
    var startRow = getDateRow(pickupDate);
    var endRow = getDateRow(returnDate);
    var column = getProductColumn(productId);
    var values = sheet.getRange(startRow, column, endRow - startRow + 1, 1).getValues();
    var minValue = null;
    values.forEach(function (row) {
      var value = Number(row[0] || 0);
      minValue = minValue === null ? value : Math.min(minValue, value);
    });
    return minValue === null ? 0 : minValue;
  }

  function assertAvailabilityOrThrow(items, pickupDate, returnDate) {
    var errors = [];
    (items || []).forEach(function (item) {
      var available = getMinimumAvailableStock(item.product_id, pickupDate, returnDate);
      var requested = Number(item.quantity || 0);
      if (available < requested) {
        errors.push(findProductName_(item.product_id) + ' disponible ' + available + ' / demande ' + requested);
      }
    });
    if (errors.length) {
      throw new Error('Stock insuffisant: ' + errors.join(' ; '));
    }
  }

  function getStockSnapshot(dateString) {
    var sheet = ensureDatesUntil(dateString);
    var row = getDateRow(dateString);
    var products = getProducts_();
    var lastColumn = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    var rowValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];
    var productColumnMap = getProductColumnMapFromHeaders_(headers);
    return products.map(function (product) {
      var column = productColumnMap[product.id];
      return {
        product_id: product.id,
        product_name: product.name,
        available: column ? Number(rowValues[column - 1] || 0) : 0
      };
    });
  }

  function getStockLedger(productId, startDate, days) {
    var matrix = getStockMatrix(startDate, days);
    return matrix.rows.map(function (row) {
      return {
        date: row.date,
        available: Number(row.products[productId] || 0),
        movements: []
      };
    });
  }

  function getPeriodAvailability(pickupDate, returnDate) {
    if (!pickupDate || !returnDate) {
      return [];
    }
    return getProducts_().map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        available: getMinimumAvailableStock(product.id, pickupDate, returnDate)
      };
    });
  }

  function getStockMatrix(startDate, days) {
    var normalizedStartDate = RacsorUtils.toDateOnlyString(startDate);
    var start = RacsorUtils.parseDate(normalizedStartDate);
    var end = new Date(start.getTime());
    end.setDate(end.getDate() + Number(days || 0) - 1);
    var endDate = RacsorUtils.toDateOnlyString(end);
    var sheet = ensureDatesUntil(endDate);
    var startRow = getDateRow(normalizedStartDate);
    var endRow = getDateRow(endDate);
    var products = getProducts_();
    var lastColumn = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    var values = sheet.getRange(startRow, 1, endRow - startRow + 1, lastColumn).getValues();
    var productColumnMap = getProductColumnMapFromHeaders_(headers);
    var rows = [];

    for (var index = 0; index < values.length; index += 1) {
      var rowValues = values[index];
      var dateValue = rowValues[0];
      var dateString = RacsorUtils.toDateOnlyString(dateValue);
      var dateObject = RacsorUtils.parseDate(dateString);
      var row = {
        date: dateString,
        is_monday: dateObject.getDay() === 1,
        is_first_of_month: dateObject.getDate() === 1,
        products: {}
      };
      products.forEach(function (product) {
        var column = productColumnMap[product.id];
        row.products[product.id] = column ? Number(rowValues[column - 1] || 0) : 0;
      });
      rows.push(row);
    }

    return {
      products: products.map(function (product) {
        return { product_id: product.id, product_name: product.name };
      }),
      rows: rows
    };
  }

  function getNegativeAlerts_() {
    var today = RacsorUtils.toDateOnlyString(new Date());
    return getStockSnapshot(today).filter(function (item) {
      return item.available < 0;
    });
  }

  function getStockSetupSummary() {
    var sheet = ensureStockSheetExists();
    return {
      sheetName: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn()
    };
  }

  function applyStockDelta_(items, dateString, sign) {
    ensureDatesUntil(dateString);
    var grouped = {};
    (items || []).forEach(function (item) {
      var productId = item.product_id;
      grouped[productId] = Number(grouped[productId] || 0) + (Number(item.quantity || 0) * sign);
    });
    Object.keys(grouped).forEach(function (productId) {
      applyDeltaForProduct_(dateString, productId, grouped[productId]);
    });
  }

  function applyDeltaForProduct_(dateString, productId, delta) {
    if (!delta) {
      return;
    }
    var sheet = ensureDatesUntil(dateString);
    var row = getDateRow(dateString);
    var column = getProductColumn(productId);
    var cell = sheet.getRange(row, column);
    var formula = String(cell.getFormula() || '');
    var signedDelta = delta >= 0 ? '+' + delta : String(delta);
    if (formula) {
      cell.setFormula(formula + signedDelta);
    } else {
      var currentValue = Number(cell.getValue() || 0);
      cell.setFormula('=' + currentValue + signedDelta);
      cell.setFontWeight('normal');
    }
  }

  function getProductColumnMap_(sheet) {
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    return getProductColumnMapFromHeaders_(headers);
  }

  function getProductColumnMapFromHeaders_(headers) {
    var map = {};
    for (var index = 1; index < headers.length; index += 1) {
      if (headers[index]) {
        map[String(headers[index])] = index + 1;
      }
    }
    return map;
  }

  function getSheetDates_(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }
    return sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function (row) {
      return row[0] ? RacsorUtils.toDateOnlyString(row[0]) : '';
    }).filter(Boolean);
  }

  function getCellA1_(row, column) {
    return columnToLetter_(column) + row;
  }

  function columnToLetter_(column) {
    var letter = '';
    var current = column;
    while (current > 0) {
      var remainder = (current - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      current = Math.floor((current - 1) / 26);
    }
    return letter;
  }

  function findProductName_(productId) {
    var product = getProducts_().find(function (item) {
      return item.id === productId;
    });
    return product ? product.name : productId;
  }

  return {
    ensureStockSheetExists: ensureStockSheetExists,
    initializeStockBase_: initializeStockBase_,
    ensureDatesUntil: ensureDatesUntil,
    getDateRow: getDateRow,
    getProductColumn: getProductColumn,
    applyStockOut: applyStockOut,
    applyStockIn: applyStockIn,
    applyInventoryOverride: applyInventoryOverride,
    recordInventory: recordInventory,
    recordInventoryBulk: recordInventoryBulk,
    getMinimumAvailableStock: getMinimumAvailableStock,
    assertAvailabilityOrThrow: assertAvailabilityOrThrow,
    getStockSnapshot: getStockSnapshot,
    getStockLedger: getStockLedger,
    getPeriodAvailability: getPeriodAvailability,
    getStockMatrix: getStockMatrix,
    getNegativeAlerts_: getNegativeAlerts_,
    getStockSetupSummary: getStockSetupSummary
  };
})();
