function initializeProject() {
  Object.keys(RacsorConfig.SHEET_HEADERS).forEach(function (sheetName) {
    RacsorRepository.ensureSheet(sheetName, RacsorConfig.SHEET_HEADERS[sheetName]);
  });

  seedDefaultData_();
  RacsorStockService.ensureStockSheetExists();
  if (!hasStockBaseData_()) {
    RacsorStockService.initializeStockBase_(new Date());
  } else {
    RacsorStockService.ensureDatesUntil(new Date());
  }
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

  RacsorStockService.ensureStockSheetExists();
  seedDefaultRespUsers_();
}

function hasStockBaseData_() {
  var sheet = RacsorRepository.getSheet(RacsorConfig.SHEETS.STOCK_MOVEMENTS);
  return sheet.getLastRow() >= 2;
}

function seedDefaultRespUsers_() {
  var defaultEmails = [
    'francois_pannier@franchise.carrefour.com',
    'gaelle_botineau@franchise.carrefour.com',
    'emmanuel_denelle@franchise.carrefour.com'
  ];
  var existingUsers = RacsorRepository.getAll(RacsorConfig.SHEETS.USERS);
  var existingByEmail = {};
  existingUsers.forEach(function (user) {
    existingByEmail[String(user.email || '').toLowerCase()] = true;
  });

  var rowsToInsert = defaultEmails.filter(function (email) {
    return !existingByEmail[String(email).toLowerCase()];
  }).map(function (email) {
    return {
      email: email,
      role: 'RESP',
      is_active: true,
      get_alert: true,
      created_at: RacsorUtils.nowIso(),
      updated_at: RacsorUtils.nowIso()
    };
  });

  if (rowsToInsert.length) {
    RacsorRepository.append(RacsorConfig.SHEETS.USERS, rowsToInsert);
  }
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
