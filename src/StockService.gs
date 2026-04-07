var RacsorStockService = (function () {
  function getProducts_() {
    return RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).filter(function (item) {
      return String(item.is_active) !== 'false';
    });
  }

  function buildAvailabilityContext_(startDate, endDate) {
    var products = getProducts_();
    var dates = startDate && endDate ? RacsorUtils.enumerateDateStrings(startDate, endDate) : [];
    var dateMap = {};
    dates.forEach(function (dateString) {
      dateMap[dateString] = true;
    });

    var movementIndex = {};
    var movements = RacsorRepository.getAll(RacsorConfig.SHEETS.STOCK_MOVEMENTS);
    movements.forEach(function (movement) {
      if (dates.length && !dateMap[movement.movement_date]) {
        return;
      }
      var key = movement.product_id + '|' + movement.movement_date;
      movementIndex[key] = (movementIndex[key] || 0) + Number(movement.quantity_delta || 0);
    });

    return {
      products: products,
      movementIndex: movementIndex
    };
  }

  function getAvailabilityFromContext_(context, productId, dateString) {
    var product = context.products.find(function (item) {
      return item.id === productId;
    });
    if (!product) {
      throw new Error('Produit introuvable: ' + productId);
    }
    var key = productId + '|' + dateString;
    return Number(product.stock_max || 0) + Number(context.movementIndex[key] || 0);
  }

  function getStockAvailabilityByDate(productId, dateString) {
    var context = buildAvailabilityContext_(dateString, dateString);
    return getAvailabilityFromContext_(context, productId, dateString);
  }

  function assertAvailability(items, pickupDate, returnDate) {
    var dates = RacsorUtils.enumerateDateStrings(pickupDate, returnDate);
    var context = buildAvailabilityContext_(pickupDate, returnDate);
    (items || []).forEach(function (item) {
      dates.forEach(function (dateString) {
        var available = getAvailabilityFromContext_(context, item.product_id, dateString);
        if (available < Number(item.quantity)) {
          throw new Error('Stock insuffisant pour ' + item.product_id + ' le ' + dateString + ' (disponible: ' + available + ')');
        }
      });
    });
  }

  function reserveStock(transactionId, status, items, pickupDate, returnDate) {
    var dates = RacsorUtils.enumerateDateStrings(pickupDate, returnDate);
    var records = [];
    (items || []).forEach(function (item) {
      dates.forEach(function (dateString) {
        records.push({
          id: RacsorUtils.createId('MOV'),
          movement_date: dateString,
          product_id: item.product_id,
          transaction_id: transactionId,
          movement_type: 'reservation',
          quantity_delta: -Math.abs(Number(item.quantity)),
          source_status: status,
          note: 'Reservation de contrat',
          created_at: RacsorUtils.nowIso()
        });
      });
    });
    RacsorRepository.append(RacsorConfig.SHEETS.STOCK_MOVEMENTS, records);
  }

  function releaseReservation(transactionId) {
    var items = RacsorRepository.findBy(RacsorConfig.SHEETS.TRANSACTION_ITEMS, function (item) {
      return item.transaction_id === transactionId;
    });
    var transaction = RacsorRepository.findOneBy(RacsorConfig.SHEETS.TRANSACTIONS, function (item) {
      return item.id === transactionId;
    });
    if (!transaction) {
      throw new Error('Contrat introuvable.');
    }
    var dates = RacsorUtils.enumerateDateStrings(transaction.pickup_date, transaction.return_date);
    var records = [];
    items.forEach(function (item) {
      dates.forEach(function (dateString) {
        records.push({
          id: RacsorUtils.createId('MOV'),
          movement_date: dateString,
          product_id: item.product_id,
          transaction_id: transactionId,
          movement_type: 'reservation_cancel',
          quantity_delta: Math.abs(Number(item.quantity)),
          source_status: 'cancelled',
          note: 'Annulation de reservation',
          created_at: RacsorUtils.nowIso()
        });
      });
    });
    RacsorRepository.append(RacsorConfig.SHEETS.STOCK_MOVEMENTS, records);
  }

  function getStockSnapshot(dateString) {
    var context = buildAvailabilityContext_(dateString, dateString);
    return context.products.map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        available: getAvailabilityFromContext_(context, product.id, dateString)
      };
    });
  }

  function getStockLedger(productId, startDate, days) {
    var output = [];
    var start = RacsorUtils.parseDate(startDate);
    var end = new Date(start.getTime());
    end.setDate(start.getDate() + days - 1);
    var context = buildAvailabilityContext_(RacsorUtils.toDateOnlyString(start), RacsorUtils.toDateOnlyString(end));
    var allMovements = RacsorRepository.getAll(RacsorConfig.SHEETS.STOCK_MOVEMENTS).filter(function (item) {
      return item.product_id === productId;
    });
    for (var i = 0; i < days; i += 1) {
      var current = new Date(start.getTime());
      current.setDate(start.getDate() + i);
      var dateString = RacsorUtils.toDateOnlyString(current);
      output.push({
        date: dateString,
        available: getAvailabilityFromContext_(context, productId, dateString),
        movements: allMovements.filter(function (item) {
          return item.movement_date === dateString;
        })
      });
    }
    return output;
  }

  function getPeriodAvailability(pickupDate, returnDate) {
    if (!pickupDate || !returnDate) {
      return [];
    }
    var dates = RacsorUtils.enumerateDateStrings(pickupDate, returnDate);
    var context = buildAvailabilityContext_(pickupDate, returnDate);
    return context.products.map(function (product) {
      var available = Number(context.products.find(function (item) {
        return item.id === product.id;
      }).stock_max || 0);
      dates.forEach(function (dateString) {
        available = Math.min(available, getAvailabilityFromContext_(context, product.id, dateString));
      });
      return {
        product_id: product.id,
        product_name: product.name,
        available: available
      };
    });
  }

  function getStockMatrix(startDate, days) {
    var start = RacsorUtils.parseDate(startDate);
    var end = new Date(start.getTime());
    end.setDate(start.getDate() + days - 1);
    var context = buildAvailabilityContext_(RacsorUtils.toDateOnlyString(start), RacsorUtils.toDateOnlyString(end));
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
      context.products.forEach(function (product) {
        row.products[product.id] = getAvailabilityFromContext_(context, product.id, dateString);
      });
      rows.push(row);
    }
    return {
      products: context.products.map(function (product) {
        return { product_id: product.id, product_name: product.name };
      }),
      rows: rows
    };
  }

  return {
    assertAvailability: assertAvailability,
    reserveStock: reserveStock,
    releaseReservation: releaseReservation,
    getStockSnapshot: getStockSnapshot,
    getStockLedger: getStockLedger,
    getPeriodAvailability: getPeriodAvailability,
    getStockMatrix: getStockMatrix
  };
})();
