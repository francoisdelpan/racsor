var RacsorPricingService = (function () {
  function getRuleCode(pickupDate, returnDate) {
    if (RacsorUtils.isWeekendRule(pickupDate, returnDate)) {
      return 'WEEKEND';
    }
    var days = RacsorUtils.diffDays(pickupDate, returnDate);
    if (days <= 0) {
      throw new Error('La date de retour doit etre posterieure a la date de retrait.');
    }
    if (days <= 4) {
      return 'LTE_4_DAYS';
    }
    if (days <= 10) {
      return 'LTE_10_DAYS';
    }
    throw new Error('Location impossible au-dela de 10 jours.');
  }

  function computeQuote(payload) {
    var products = RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).filter(function (item) {
      return String(item.is_active) !== 'false';
    });
    var productMap = {};
    products.forEach(function (product) {
      productMap[product.id] = product;
    });

    var prices = RacsorRepository.getAll(RacsorConfig.SHEETS.PRICES).filter(function (item) {
      return String(item.is_active) !== 'false';
    });
    var ruleCode = getRuleCode(payload.pickup_date, payload.return_date);
    var days = RacsorUtils.diffDays(payload.pickup_date, payload.return_date);

    var totals = {
      rule_code: ruleCode,
      charged_days: ruleCode === 'WEEKEND' ? 1 : days,
      total_amount_ttc: 0,
      total_deposit_amount: 0,
      items: []
    };

    (payload.items || []).forEach(function (item) {
      var product = productMap[item.product_id];
      if (!product) {
        throw new Error('Produit introuvable: ' + item.product_id);
      }
      var price = prices.filter(function (entry) {
        return entry.product_id === item.product_id;
      }).find(function (entry) {
        var rule = RacsorRepository.findOneBy(RacsorConfig.SHEETS.PRICING_RULES, function (candidate) {
          return candidate.id === entry.pricing_rule_id;
        });
        return rule && rule.code === ruleCode;
      });
      if (!price) {
        throw new Error('Tarif manquant pour ' + product.name + ' et la regle ' + ruleCode);
      }
      var quantity = Number(item.quantity || 0);
      var unitPrice = Number(price.unit_price_ttc || 0);
      var lineAmount = ruleCode === 'WEEKEND' ? unitPrice * quantity : unitPrice * quantity * days;
      var depositUnit = Number(product.deposit_amount || 0);
      var depositLine = depositUnit * quantity;
      totals.items.push({
        product_id: item.product_id,
        product_label_snapshot: product.name,
        quantity: quantity,
        pricing_rule_id: price.pricing_rule_id,
        unit_price_ttc: unitPrice,
        line_amount_ttc: lineAmount,
        deposit_unit_amount: depositUnit,
        deposit_line_amount: depositLine
      });
      totals.total_amount_ttc += lineAmount;
      totals.total_deposit_amount += depositLine;
    });

    return totals;
  }

  return {
    getRuleCode: getRuleCode,
    computeQuote: computeQuote
  };
})();
