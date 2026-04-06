var RacsorStockService = (function () {
  function getStockAvailabilityByDate(productId, dateString) {
    var product = RacsorRepository.findOneBy(RacsorConfig.SHEETS.PRODUCTS, function (item) {
      return item.id === productId;
    });
    if (!product) {
      throw new Error('Produit introuvable: ' + productId);
    }
    var movements = RacsorRepository.findBy(RacsorConfig.SHEETS.STOCK_MOVEMENTS, function (item) {
      return item.product_id === productId && item.movement_date === dateString;
    });
    var delta = RacsorUtils.sum(movements, function (item) {
      return Number(item.quantity_delta);
    });
    return Number(product.stock_max || 0) + delta;
  }

  function assertAvailability(items, pickupDate, returnDate) {
    var dates = RacsorUtils.enumerateDateStrings(pickupDate, returnDate);
    (items || []).forEach(function (item) {
      dates.forEach(function (dateString) {
        var available = getStockAvailabilityByDate(item.product_id, dateString);
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
    var products = RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).filter(function (item) {
      return String(item.is_active) !== 'false';
    });
    return products.map(function (product) {
      return {
        product_id: product.id,
        product_name: product.name,
        stock_max: Number(product.stock_max || 0),
        available: getStockAvailabilityByDate(product.id, dateString)
      };
    });
  }

  function getStockLedger(productId, startDate, days) {
    var output = [];
    var start = RacsorUtils.parseDate(startDate);
    for (var i = 0; i < days; i += 1) {
      var current = new Date(start.getTime());
      current.setDate(start.getDate() + i);
      var dateString = RacsorUtils.toDateOnlyString(current);
      var movements = RacsorRepository.findBy(RacsorConfig.SHEETS.STOCK_MOVEMENTS, function (item) {
        return item.product_id === productId && item.movement_date === dateString;
      });
      output.push({
        date: dateString,
        available: getStockAvailabilityByDate(productId, dateString),
        movements: movements
      });
    }
    return output;
  }

  return {
    assertAvailability: assertAvailability,
    reserveStock: reserveStock,
    releaseReservation: releaseReservation,
    getStockSnapshot: getStockSnapshot,
    getStockLedger: getStockLedger
  };
})();
