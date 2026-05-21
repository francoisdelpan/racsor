var RacsorStockService = (function () {
  var migrationRunning = false;

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
    ensureStockLedgerExists();
    return sheet;
  }

  function ensureStockLedgerExists() {
    var sheet = RacsorRepository.ensureSheet(RacsorConfig.SHEETS.STOCK_LEDGER, RacsorConfig.SHEET_HEADERS[RacsorConfig.SHEETS.STOCK_LEDGER]);
    migrateStockLedgerFromExistingData_();
    return sheet;
  }

  function initializeStockBase_(baseDate) {
    var sheet = ensureStockSheetExists();
    ensureDatesUntil(baseDate || new Date());
    return sheet;
  }

  function syncProductColumns_() {
    return {};
  }

  function ensureDatesUntil(targetDate) {
    var sheet = RacsorRepository.ensureSheet(RacsorConfig.SHEETS.STOCK_MOVEMENTS, ['date']);
    var normalizedTargetDate = RacsorUtils.toDateOnlyString(targetDate || new Date());
    var dates = getSheetDates_(sheet);
    var lastKnownDate = dates.length ? dates[dates.length - 1] : '';
    if (!lastKnownDate) {
      sheet.getRange(2, 1).setValue(normalizedTargetDate);
      return sheet;
    }
    if (lastKnownDate >= normalizedTargetDate) {
      return sheet;
    }
    var currentDate = RacsorUtils.parseDate(lastKnownDate);
    var target = RacsorUtils.parseDate(normalizedTargetDate);
    var rows = [];
    while (currentDate.getTime() < target.getTime()) {
      currentDate.setDate(currentDate.getDate() + 1);
      rows.push([RacsorUtils.toDateOnlyString(currentDate)]);
    }
    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 1).setValues(rows);
    }
    return sheet;
  }

  function getDateRow(dateString) {
    var normalizedDate = RacsorUtils.toDateOnlyString(dateString);
    var sheet = ensureDatesUntil(normalizedDate);
    var dates = getSheetDates_(sheet);
    for (var index = 0; index < dates.length; index += 1) {
      if (dates[index] === normalizedDate) {
        return index + 2;
      }
    }
    throw new Error('Date de stock introuvable: ' + normalizedDate);
  }

  function getProductColumn(productId) {
    var products = getProducts_();
    for (var index = 0; index < products.length; index += 1) {
      if (products[index].id === productId) {
        return index + 2;
      }
    }
    throw new Error('Produit introuvable: ' + productId);
  }

  function applyStockOut(items, pickupDate, transactionId, note) {
    applyStockDelta_(items, pickupDate, -1, transactionId, 'reservation', note || '');
  }

  function applyStockIn(items, returnDate, transactionId, movementType, note) {
    applyStockDelta_(items, returnDate, 1, transactionId, movementType || 'return', note || '');
  }

  function applyInventoryOverride(payload) {
    var snapshot = getStockSnapshot(payload.movement_date);
    var current = 0;
    snapshot.forEach(function (item) {
      if (item.product_id === payload.product_id) {
        current = Number(item.available || 0);
      }
    });
    var delta = Number(payload.quantity || 0) - current;
    appendLedgerRows_([{
      movement_date: payload.movement_date,
      product_id: payload.product_id,
      transaction_id: '',
      movement_type: 'manual_adjustment',
      quantity_delta: delta,
      note: 'Inventaire manuel'
    }]);
  }

  function recordInventory(payload) {
    applyInventoryOverride(payload);
    return { ok: true };
  }

  function recordInventoryBulk(payload) {
    var date = payload.movement_date;
    var snapshot = getStockSnapshot(date);
    var currentByProduct = {};
    snapshot.forEach(function (item) {
      currentByProduct[item.product_id] = Number(item.available || 0);
    });
    var rows = [];
    (payload.items || []).forEach(function (item) {
      var delta = Number(item.quantity || 0) - Number(currentByProduct[item.product_id] || 0);
      rows.push({
        movement_date: date,
        product_id: item.product_id,
        transaction_id: '',
        movement_type: 'manual_adjustment',
        quantity_delta: delta,
        note: 'Inventaire manuel'
      });
    });
    appendLedgerRows_(rows);
    return { ok: true };
  }

  function getMinimumAvailableStock(productId, pickupDate, returnDate) {
    var values = getAvailabilityByDate_(pickupDate, returnDate, [productId]);
    var minValue = null;
    values.forEach(function (row) {
      var value = Number(row.products[productId] || 0);
      minValue = minValue === null ? value : Math.min(minValue, value);
    });
    return minValue === null ? 0 : minValue;
  }

  function assertAvailabilityOrThrow(items, pickupDate, returnDate) {
    var errors = [];
    var productIds = (items || []).map(function (item) {
      return item.product_id;
    });
    var rows = getAvailabilityByDate_(pickupDate, returnDate, productIds);
    var minByProduct = {};
    rows.forEach(function (row) {
      productIds.forEach(function (productId) {
        var value = Number(row.products[productId] || 0);
        minByProduct[productId] = minByProduct[productId] === undefined ? value : Math.min(minByProduct[productId], value);
      });
    });
    (items || []).forEach(function (item) {
      var available = Number(minByProduct[item.product_id] || 0);
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
    var normalizedDate = RacsorUtils.toDateOnlyString(dateString || new Date());
    var products = getProducts_();
    var productIds = products.map(function (product) {
      return product.id;
    });
    var snapshots = computeSnapshotsForDates_([normalizedDate], productIds);
    var values = snapshots[normalizedDate] || {};
    return products.map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        available: Number(values[product.id] || 0)
      };
    });
  }

  function getStockLedger(productId, startDate, days) {
    var matrix = getStockMatrix(startDate, days);
    var movements = getLedgerMovements_().filter(function (row) {
      return row.product_id === productId;
    });
    var movementsByDate = RacsorUtils.groupBy(movements, 'movement_date');
    return matrix.rows.map(function (row) {
      return {
        date: row.date,
        available: Number(row.products[productId] || 0),
        movements: movementsByDate[row.date] || []
      };
    });
  }

  function getPeriodAvailability(pickupDate, returnDate) {
    if (!pickupDate || !returnDate) {
      return [];
    }
    var products = getProducts_();
    var productIds = products.map(function (product) {
      return product.id;
    });
    var rows = getAvailabilityByDate_(pickupDate, returnDate, productIds);
    return products.map(function (product) {
      var minValue = null;
      rows.forEach(function (row) {
        var value = Number(row.products[product.id] || 0);
        minValue = minValue === null ? value : Math.min(minValue, value);
      });
      return {
        product_id: product.id,
        product_name: product.name,
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
    var products = getProducts_();
    var productIds = products.map(function (product) {
      return product.id;
    });
    return {
      products: products.map(function (product) {
        return { product_id: product.id, product_name: product.name };
      }),
      rows: getAvailabilityByDate_(normalizedStartDate, endDate, productIds)
    };
  }

  function getNegativeAlerts_() {
    var today = RacsorUtils.toDateOnlyString(new Date());
    return getStockSnapshot(today).filter(function (item) {
      return item.available < 0;
    });
  }

  function getStockSetupSummary() {
    var sheet = ensureStockLedgerExists();
    return {
      sheetName: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn()
    };
  }

  function applyStockDelta_(items, dateString, sign, transactionId, movementType, note) {
    var rows = [];
    (items || []).forEach(function (item) {
      var quantity = Number(item.quantity || 0);
      if (!quantity) {
        return;
      }
      rows.push({
        movement_date: dateString,
        product_id: item.product_id,
        transaction_id: transactionId || '',
        movement_type: movementType || (sign < 0 ? 'reservation' : 'return'),
        quantity_delta: quantity * sign,
        note: note || ''
      });
    });
    appendLedgerRows_(rows);
  }

  function appendLedgerRows_(rows) {
    ensureStockLedgerExists();
    var records = (rows || []).filter(function (row) {
      return Number(row.quantity_delta || 0) !== 0;
    }).map(function (row) {
      return {
        id: RacsorUtils.createId('STK'),
        movement_date: RacsorUtils.toDateOnlyString(row.movement_date || new Date()),
        product_id: row.product_id || '',
        transaction_id: row.transaction_id || '',
        movement_type: row.movement_type || '',
        quantity_delta: Number(row.quantity_delta || 0),
        note: row.note || '',
        created_at: RacsorUtils.nowIso()
      };
    });
    if (records.length) {
      RacsorRepository.append(RacsorConfig.SHEETS.STOCK_LEDGER, records);
    }
  }

  function getAvailabilityByDate_(startDate, endDate, productIds) {
    var dates = RacsorUtils.enumerateDateStrings(startDate, endDate);
    var snapshots = computeSnapshotsForDates_(dates, productIds);
    return dates.map(function (dateString) {
      var dateObject = RacsorUtils.parseDate(dateString);
      return {
        date: dateString,
        is_monday: dateObject.getDay() === 1,
        is_first_of_month: dateObject.getDate() === 1,
        products: snapshots[dateString] || {}
      };
    });
  }

  function computeSnapshotsForDates_(dates, productIds) {
    ensureStockLedgerExists();
    var baseByProduct = getProductBaseMap_();
    var wanted = {};
    (productIds || Object.keys(baseByProduct)).forEach(function (productId) {
      wanted[productId] = true;
    });
    var sortedDates = dates.slice().sort();
    var movements = getLedgerMovements_().filter(function (row) {
      return wanted[row.product_id];
    }).sort(function (a, b) {
      return String(a.movement_date).localeCompare(String(b.movement_date));
    });
    var current = {};
    Object.keys(wanted).forEach(function (productId) {
      current[productId] = Number(baseByProduct[productId] || 0);
    });
    var snapshots = {};
    var movementIndex = 0;
    sortedDates.forEach(function (dateString) {
      while (movementIndex < movements.length && String(movements[movementIndex].movement_date) <= dateString) {
        var movement = movements[movementIndex];
        current[movement.product_id] = Number(current[movement.product_id] || 0) + Number(movement.quantity_delta || 0);
        movementIndex += 1;
      }
      snapshots[dateString] = {};
      Object.keys(wanted).forEach(function (productId) {
        snapshots[dateString][productId] = Number(current[productId] || 0);
      });
    });
    return snapshots;
  }

  function getProductBaseMap_() {
    var map = {};
    getProducts_().forEach(function (product) {
      map[product.id] = Number(product.stock_max || 0);
    });
    return map;
  }

  function getLedgerMovements_() {
    ensureStockLedgerExists();
    return RacsorRepository.getAll(RacsorConfig.SHEETS.STOCK_LEDGER).map(function (row) {
      row.movement_date = RacsorUtils.toDateOnlyString(row.movement_date);
      row.quantity_delta = Number(row.quantity_delta || 0);
      return row;
    });
  }

  function migrateStockLedgerFromExistingData_() {
    if (migrationRunning) {
      return;
    }
    var sheet = RacsorRepository.getSheet(RacsorConfig.SHEETS.STOCK_LEDGER);
    if (sheet.getLastRow() > 1) {
      return;
    }
    migrationRunning = true;
    try {
      var transactions = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS);
      if (!transactions.length) {
        return;
      }
      var items = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTION_ITEMS);
      var itemsByTransaction = RacsorUtils.groupBy(items, 'transaction_id');
      var stateReintegration = getReturnStateReintegrationMap_();
      var rows = [];
      transactions.forEach(function (transaction) {
        var status = String(transaction.status || '');
        var transactionItems = itemsByTransaction[transaction.id] || [];
        if (!transactionItems.length || status === 'cancelled' || !transaction.pickup_date) {
          return;
        }
        transactionItems.forEach(function (item) {
          rows.push({
            movement_date: transaction.pickup_date,
            product_id: item.product_id,
            transaction_id: transaction.id,
            movement_type: 'migration_reservation',
            quantity_delta: -Number(item.quantity || 0),
            note: 'Migration depuis Transactions'
          });
        });
        if (transaction.return_date && ['returned', 'incident', 'ready_to_close', 'closed'].indexOf(status) !== -1) {
          var returnedByProduct = getReintegratedReturnQuantities_(transaction, transactionItems, stateReintegration);
          Object.keys(returnedByProduct).forEach(function (productId) {
            rows.push({
              movement_date: transaction.return_date,
              product_id: productId,
              transaction_id: transaction.id,
              movement_type: 'migration_return',
              quantity_delta: Number(returnedByProduct[productId] || 0),
              note: 'Migration depuis retour contrat'
            });
          });
        }
      });
      if (rows.length) {
        appendLedgerRows_(rows);
      }
    } finally {
      migrationRunning = false;
    }
  }

  function getReintegratedReturnQuantities_(transaction, transactionItems, stateReintegration) {
    var returns = RacsorUtils.safeJsonParse(transaction.return_details_json || '[]', []);
    var quantities = {};
    if (returns.length) {
      returns.forEach(function (entry) {
        if (stateReintegration[entry.state_id] === false) {
          return;
        }
        quantities[entry.product_id] = Number(quantities[entry.product_id] || 0) + Number(entry.quantity || 0);
      });
      return quantities;
    }
    transactionItems.forEach(function (item) {
      quantities[item.product_id] = Number(item.quantity || 0);
    });
    return quantities;
  }

  function getReturnStateReintegrationMap_() {
    var map = {};
    RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES).forEach(function (state) {
      var label = String(state.label || '').toLowerCase();
      map[state.id] = state.reintegrates_stock === '' || state.reintegrates_stock === undefined
        ? label !== 'manquant'
        : RacsorUtils.isTruthy(state.reintegrates_stock);
    });
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

  function findProductName_(productId) {
    var product = getProducts_().find(function (item) {
      return item.id === productId;
    });
    return product ? product.name : productId;
  }

  return {
    ensureStockSheetExists: ensureStockSheetExists,
    ensureStockLedgerExists: ensureStockLedgerExists,
    initializeStockBase_: initializeStockBase_,
    syncProductColumns_: syncProductColumns_,
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
