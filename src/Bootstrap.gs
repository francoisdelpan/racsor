function initializeProject() {
  Object.keys(RacsorConfig.SHEET_HEADERS).forEach(function (sheetName) {
    RacsorRepository.ensureSheet(sheetName, RacsorConfig.SHEET_HEADERS[sheetName]);
  });

  seedDefaultData_();
  RacsorLogService.log('INITIALIZE_PROJECT', 'system', 'setup', {});
  return 'Initialization complete';
}

function seedDefaultData_() {
  if (!RacsorRepository.getAll(RacsorConfig.SHEETS.PRICING_RULES).length) {
    RacsorRepository.append(RacsorConfig.SHEETS.PRICING_RULES, RacsorConfig.DEFAULT_PRICING_RULES);
  }

  if (!RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).length) {
    RacsorRepository.append(RacsorConfig.SHEETS.PRODUCTS, RacsorConfig.DEFAULT_PRODUCTS.map(function (item) {
      item.created_at = RacsorUtils.nowIso();
      item.updated_at = RacsorUtils.nowIso();
      item.sku = '';
      return item;
    }));
  }

  if (!RacsorRepository.getAll(RacsorConfig.SHEETS.PRICES).length) {
    RacsorRepository.append(RacsorConfig.SHEETS.PRICES, RacsorConfig.DEFAULT_PRICES.map(function (item) {
      item.created_at = RacsorUtils.nowIso();
      item.updated_at = RacsorUtils.nowIso();
      return item;
    }));
  }

  if (!RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES).length) {
    RacsorRepository.append(RacsorConfig.SHEETS.RETURN_STATES, RacsorConfig.DEFAULT_STATES);
  }

  if (!RacsorRepository.getAll(RacsorConfig.SHEETS.STOCK_MOVEMENTS).length) {
    initializeStockBase_();
  }
}

function initializeStockBase_() {
  var today = RacsorUtils.toDateOnlyString(new Date());
  var rows = RacsorConfig.DEFAULT_PRODUCTS.map(function (product) {
    return {
      movement_date: today,
      product_id: product.id,
      transaction_id: '',
      movement_type: 'inventory',
      quantity_delta: Number(product.stock_max || 0),
      balance_after: Number(product.stock_max || 0)
    };
  });
  RacsorRepository.append(RacsorConfig.SHEETS.STOCK_MOVEMENTS, rows);
}

function seedDemoUsersIfMissing() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    return 'No active user email available';
  }
  var existing = RacsorRepository.findOneBy(RacsorConfig.SHEETS.USERS, function (user) {
    return user.email === email;
  });
  if (existing) {
    return 'User already exists';
  }
  RacsorRepository.append(RacsorConfig.SHEETS.USERS, [{
    email: email,
    role: 'RESP',
    is_active: true,
    get_alert: true,
    created_at: RacsorUtils.nowIso(),
    updated_at: RacsorUtils.nowIso()
  }]);
  return 'Demo user added';
}

function runDailyChecks() {
  return RacsorNotificationService.runDailyChecks();
}
