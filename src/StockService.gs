var RacsorStockService = (function () {
  function getProducts_() {
    return RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).filter(function (item) {
      return String(item.is_active) !== 'false';
    });
  }

  function getAllMovements_() {
    return RacsorRepository.getAll(RacsorConfig.SHEETS.STOCK_MOVEMENTS);
  }

  function sortMovements_(movements) {
    return movements.slice().sort(function (a, b) {
      var left = String(a.movement_date) + '|' + String(a.transaction_id || '') + '|' + String(a.movement_type || '');
      var right = String(b.movement_date) + '|' + String(b.transaction_id || '') + '|' + String(b.movement_type || '');
      return left.localeCompare(right);
    });
  }

  function rebuildBalances_() {
    var products = getProducts_();
    var balanceByProduct = {};
    products.forEach(function (product) {
      balanceByProduct[product.id] = 0;
    });

    var movements = sortMovements_(getAllMovements_()).map(function (movement) {
      var productId = movement.product_id;
      var delta = Number(movement.quantity_delta || 0);
      balanceByProduct[productId] = Number(balanceByProduct[productId] || 0) + delta;
      return {
        movement_date: movement.movement_date,
        product_id: movement.product_id,
        transaction_id: movement.transaction_id || '',
        movement_type: movement.movement_type,
        quantity_delta: delta,
        balance_after: balanceByProduct[productId]
      };
    });

    RacsorRepository.replaceAll(RacsorConfig.SHEETS.STOCK_MOVEMENTS, movements);
    return movements;
  }

  function appendMovements_(rows) {
    RacsorRepository.append(RacsorConfig.SHEETS.STOCK_MOVEMENTS, rows);
    return rebuildBalances_();
  }

  function getBalanceAsOf(productId, dateString) {
    var movements = sortMovements_(getAllMovements_()).filter(function (movement) {
      return movement.product_id === productId && movement.movement_date <= dateString;
    });
    if (!movements.length) {
      return 0;
    }
    return Number(movements[movements.length - 1].balance_after || 0);
  }

  function getNegativeAlerts_() {
    return getProducts_().map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        available: getBalanceAsOf(product.id, RacsorUtils.toDateOnlyString(new Date()))
      };
    }).filter(function (item) {
      return item.available < 0;
    });
  }

  function reserveStock(transactionId, items, pickupDate) {
    var rows = (items || []).map(function (item) {
      return {
        movement_date: pickupDate,
        product_id: item.product_id,
        transaction_id: transactionId,
        movement_type: 'reservation',
        quantity_delta: -Math.abs(Number(item.quantity || 0)),
        balance_after: ''
      };
    });
    appendMovements_(rows);
  }

  function releaseReservation(transactionId, pickupDate) {
    var items = RacsorRepository.findBy(RacsorConfig.SHEETS.TRANSACTION_ITEMS, function (item) {
      return item.transaction_id === transactionId;
    });
    var rows = items.map(function (item) {
      return {
        movement_date: pickupDate,
        product_id: item.product_id,
        transaction_id: transactionId,
        movement_type: 'reservation',
        quantity_delta: Math.abs(Number(item.quantity || 0)),
        balance_after: ''
      };
    });
    appendMovements_(rows);
  }

  function recordReturn(transactionId, returnDate, items) {
    var rows = (items || []).map(function (item) {
      return {
        movement_date: returnDate,
        product_id: item.product_id,
        transaction_id: transactionId,
        movement_type: 'return',
        quantity_delta: Math.abs(Number(item.quantity || 0)),
        balance_after: ''
      };
    });
    appendMovements_(rows);
  }

  function recordInventory(payload) {
    var currentBalance = getBalanceAsOf(payload.product_id, payload.movement_date);
    var targetQty = Number(payload.quantity || 0);
    var delta = targetQty - currentBalance;
    appendMovements_([{
      movement_date: payload.movement_date,
      product_id: payload.product_id,
      transaction_id: '',
      movement_type: 'inventory',
      quantity_delta: delta,
      balance_after: ''
    }]);
    return getStockSnapshot(payload.movement_date);
  }

  function getStockSnapshot(dateString) {
    return getProducts_().map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        available: getBalanceAsOf(product.id, dateString)
      };
    });
  }

  function getStockLedger(productId, startDate, days) {
    var output = [];
    var start = RacsorUtils.parseDate(startDate);
    var movements = sortMovements_(getAllMovements_()).filter(function (movement) {
      return movement.product_id === productId;
    });
    for (var i = 0; i < days; i += 1) {
      var current = new Date(start.getTime());
      current.setDate(start.getDate() + i);
      var dateString = RacsorUtils.toDateOnlyString(current);
      output.push({
        date: dateString,
        available: getBalanceAsOf(productId, dateString),
        movements: movements.filter(function (movement) {
          return movement.movement_date === dateString;
        })
      });
    }
    return output;
  }

  function getPeriodAvailability(pickupDate, returnDate) {
    if (!pickupDate || !returnDate) {
      return [];
    }
    return getProducts_().map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        available: getBalanceAsOf(product.id, pickupDate)
      };
    });
  }

  function getStockMatrix(startDate, days) {
    var products = getProducts_();
    var start = RacsorUtils.parseDate(startDate);
    var rows = [];
    for (var i = 0; i < days; i += 1) {
      var current = new Date(start.getTime());
      current.setDate(start.getDate() + i);
      var dateString = RacsorUtils.toDateOnlyString(current);
      var row = {
        date: dateString,
        is_monday: current.getDay() === 1,
        is_first_of_month: current.getDate() === 1,
        products: {}
      };
      products.forEach(function (product) {
        row.products[product.id] = getBalanceAsOf(product.id, dateString);
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

  return {
    reserveStock: reserveStock,
    releaseReservation: releaseReservation,
    recordReturn: recordReturn,
    recordInventory: recordInventory,
    getStockSnapshot: getStockSnapshot,
    getStockLedger: getStockLedger,
    getPeriodAvailability: getPeriodAvailability,
    getStockMatrix: getStockMatrix,
    getNegativeAlerts_: getNegativeAlerts_
  };
})();
