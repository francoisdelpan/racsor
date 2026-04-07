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
    var normalizedDate = RacsorUtils.toDateOnlyString(dateString);
    var row = getStockContext_(dateString).rowByDate[normalizedDate];
    if (!row) {
      throw new Error('Date de stock introuvable: ' + normalizedDate);
    }
    return row;
  }

  function getProductColumn(productId) {
    var column = getStockContext_().productColumnMap[productId];
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
    var context = getStockContext_(payload.movement_date);
    var sheet = context.sheet;
    var row = context.rowByDate[RacsorUtils.toDateOnlyString(payload.movement_date)];
    var column = context.productColumnMap[payload.product_id];
    var cell = sheet.getRange(row, column);
    cell.setFormula('');
    cell.setValue(Number(payload.quantity || 0));
    cell.setFontWeight('bold');
  }

  function recordInventory(payload) {
    applyInventoryOverride(payload);
    return { ok: true };
  }

  function recordInventoryBulk(payload) {
    var context = getStockContext_(payload.movement_date);
    var sheet = context.sheet;
    var row = context.rowByDate[RacsorUtils.toDateOnlyString(payload.movement_date)];
    (payload.items || []).forEach(function (item) {
      var column = context.productColumnMap[item.product_id];
      if (!column) {
        return;
      }
      var cell = sheet.getRange(row, column);
      cell.setFormula('');
      cell.setValue(Number(item.quantity || 0));
      cell.setFontWeight('bold');
    });
    return { ok: true };
  }

  function getMinimumAvailableStock(productId, pickupDate, returnDate) {
    var context = getStockContext_(returnDate);
    var sheet = context.sheet;
    var startRow = context.rowByDate[RacsorUtils.toDateOnlyString(pickupDate)];
    var endRow = context.rowByDate[RacsorUtils.toDateOnlyString(returnDate)];
    var column = context.productColumnMap[productId];
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
    var context = getStockContext_(dateString);
    var sheet = context.sheet;
    var row = context.rowByDate[RacsorUtils.toDateOnlyString(dateString)];
    var products = getProducts_();
    var rowValues = sheet.getRange(row, 1, 1, context.lastColumn).getValues()[0];
    return products.map(function (product) {
      var column = context.productColumnMap[product.id];
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
    var context = getStockContext_(returnDate);
    var products = getProducts_();
    var startRow = context.rowByDate[RacsorUtils.toDateOnlyString(pickupDate)];
    var endRow = context.rowByDate[RacsorUtils.toDateOnlyString(returnDate)];
    var height = endRow - startRow + 1;
    var ranges = [];
    products.forEach(function (product) {
      var column = context.productColumnMap[product.id];
      if (column) {
        ranges.push({
          product: product,
          values: context.sheet.getRange(startRow, column, height, 1).getValues()
        });
      }
    });
    return ranges.map(function (entry) {
      var minValue = null;
      entry.values.forEach(function (row) {
        var value = Number(row[0] || 0);
        minValue = minValue === null ? value : Math.min(minValue, value);
      });
      return {
        product_id: entry.product.id,
        product_name: entry.product.name,
        available: minValue === null ? 0 : minValue
      };
    });
  }

  function getStockMatrix(startDate, days) {
    var normalizedStartDate = RacsorUtils.toDateOnlyString(startDate);
    var start = RacsorUtils.parseDate(normalizedStartDate);
    var end = new Date(start.getTime());
    end.setDate(end.getDate() + Number(days || 0) - 1);
    var endDate = RacsorUtils.toDateOnlyString(end);
    var context = getStockContext_(endDate);
    var sheet = context.sheet;
    var startRow = context.rowByDate[normalizedStartDate];
    var endRow = context.rowByDate[endDate];
    var products = getProducts_();
    var values = sheet.getRange(startRow, 1, endRow - startRow + 1, context.lastColumn).getValues();
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
        var column = context.productColumnMap[product.id];
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
    var context = getStockContext_(dateString);
    var grouped = {};
    (items || []).forEach(function (item) {
      var productId = item.product_id;
      grouped[productId] = Number(grouped[productId] || 0) + (Number(item.quantity || 0) * sign);
    });
    Object.keys(grouped).forEach(function (productId) {
      applyDeltaForProduct_(context, dateString, productId, grouped[productId]);
    });
  }

  function applyDeltaForProduct_(context, dateString, productId, delta) {
    if (!delta) {
      return;
    }
    var sheet = context.sheet;
    var row = context.rowByDate[RacsorUtils.toDateOnlyString(dateString)];
    var column = context.productColumnMap[productId];
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

  function getStockContext_(targetDate) {
    if (targetDate) {
      ensureDatesUntil(targetDate);
    } else {
      ensureStockSheetExists();
    }
    var sheet = RacsorRepository.getSheet(RacsorConfig.SHEETS.STOCK_MOVEMENTS);
    var lastRow = sheet.getLastRow();
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    var dates = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    var rowByDate = {};
    dates.forEach(function (row, index) {
      if (row[0]) {
        rowByDate[RacsorUtils.toDateOnlyString(row[0])] = index + 2;
      }
    });
    return {
      sheet: sheet,
      lastRow: lastRow,
      lastColumn: lastColumn,
      headers: headers,
      productColumnMap: getProductColumnMapFromHeaders_(headers),
      rowByDate: rowByDate
    };
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
