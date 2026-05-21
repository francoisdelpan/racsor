function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialParams = JSON.stringify((e && e.parameter) || {});
  return template
    .evaluate()
    .setTitle('LOCATION MATERIEL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppBootstrapData() {
  ensureRuntimeProjectSetup_();
  seedDefaultRespUsers_();
  var user = RacsorContractService.getCurrentUserRole();
  if (!user.is_authorized) {
    return {
      settings: RacsorConfig.getProjectSettings(),
      colors: RacsorConfig.COLORS,
      user: user,
      referenceData: { products: [], pricingRules: [], prices: [], returnStates: [], users: [] },
      dashboard: { today: RacsorUtils.toDateOnlyString(new Date()), stock: [], pickups: [], returns: [], incidents: [], late: [], stockAlerts: [], recentContracts: [], closedContracts: [], pickupsTodayCount: 0, returnsTodayCount: 0, pickupsFutureCount: 0, returnsFutureCount: 0 }
    };
  }
  var payload = {
    settings: RacsorConfig.getProjectSettings(),
    colors: RacsorConfig.COLORS,
    user: user,
    referenceData: RacsorContractService.getReferenceData(false),
    dashboard: RacsorContractService.getDashboardData()
  };
  if (!payload.referenceData || !payload.referenceData.products || !payload.referenceData.products.length) {
    throw new Error('Aucun produit charge. Verifie l initialisation du projet et la feuille Products.');
  }
  return payload;
}

function apiWhoAmI() {
  return RacsorContractService.getCurrentUserRole();
}

function apiGetAdminData() {
  return RacsorContractService.getAdminData();
}

function apiCreateContract(payload) {
  return RacsorContractService.createContract(payload);
}

function apiUpdateContract(payload) {
  return RacsorContractService.updateContract(payload);
}

function apiPrepareContractAssets(transactionId) {
  return RacsorContractService.prepareContractAssets(transactionId);
}

function apiFindContractByNumber(contractNumber) {
  return RacsorContractService.findContractByNumber(contractNumber);
}

function apiGetContractById(transactionId) {
  return RacsorContractService.getContractById(transactionId);
}

function apiMarkContractSigned(transactionId, filePayload) {
  return RacsorContractService.markContractSigned(transactionId, filePayload);
}

function apiForceContractSigned(transactionId) {
  return RacsorContractService.forceContractSigned(transactionId);
}

function apiUploadContractDocument(transactionId, filePayload) {
  return RacsorContractService.uploadContractDocument(transactionId, filePayload);
}

function apiMarkPickedUp(transactionId) {
  return RacsorContractService.markPickedUp(transactionId);
}

function apiCancelContract(transactionId) {
  return RacsorContractService.cancelContract(transactionId);
}

function apiRecordReturn(payload) {
  return RacsorContractService.recordReturn(payload);
}

function apiCloseContract(payload) {
  return RacsorContractService.closeContract(payload);
}

function apiReopenContract(payload) {
  return RacsorContractService.reopenContract(payload);
}

function apiFinalizeSavReturn(payload) {
  return RacsorContractService.finalizeSavReturn(payload);
}

function apiGetDashboardData() {
  return RacsorContractService.getDashboardData();
}

function apiGetStockLedger(productId, startDate, days) {
  return RacsorStockService.getStockLedger(productId, startDate, days || 14);
}

function apiGetPeriodAvailability(pickupDate, returnDate) {
  return RacsorStockService.getPeriodAvailability(pickupDate, returnDate);
}

function apiGetStockMatrix(startDate, days) {
  return RacsorStockService.getStockMatrix(startDate, days || 14);
}

function apiListContractsByStatuses(statuses) {
  return RacsorContractService.listContractsByStatuses(statuses || []);
}

function apiUpsertUser(payload) {
  return RacsorContractService.upsertUser(payload);
}

function apiUpdateProductAdmin(payload) {
  return RacsorContractService.updateProductAdmin(payload);
}

function apiUpdatePriceAdmin(payload) {
  return RacsorContractService.updatePriceAdmin(payload);
}

function apiRecordInventory(payload) {
  return RacsorStockService.recordInventory(payload);
}

function apiRecordInventoryBulk(payload) {
  return RacsorStockService.recordInventoryBulk(payload);
}

function apiAddProductAdmin(payload) {
  return RacsorContractService.addProductAdmin(payload);
}

function apiUpdatePricingRuleAdmin(payload) {
  return RacsorContractService.updatePricingRuleAdmin(payload);
}

function apiAddPricingRuleAdmin(payload) {
  return RacsorContractService.addPricingRuleAdmin(payload);
}

function debugRuntimeSetup() {
  var settings = RacsorConfig.getProjectSettings();
  var activeSpreadsheet = null;
  try {
    activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    activeSpreadsheet = null;
  }

  var runtimeSpreadsheet = null;
  try {
    runtimeSpreadsheet = RacsorRepository.getSpreadsheet();
  } catch (error) {
    runtimeSpreadsheet = null;
  }

  var sheets = {};
  Object.keys(RacsorConfig.SHEETS).forEach(function (key) {
    var name = RacsorConfig.SHEETS[key];
    try {
      var sheet = runtimeSpreadsheet ? runtimeSpreadsheet.getSheetByName(name) : null;
      sheets[name] = sheet ? {
        exists: true,
        lastRow: sheet.getLastRow(),
        lastColumn: sheet.getLastColumn(),
        headers: sheet.getLastRow() >= 1 ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] : []
      } : {
        exists: false,
        lastRow: 0,
        lastColumn: 0,
        headers: []
      };
    } catch (error) {
      sheets[name] = {
        exists: false,
        error: String(error && error.message ? error.message : error)
      };
    }
  });

  var result = {
    settingsSpreadsheetId: settings.spreadsheetId || '',
    activeSpreadsheetId: activeSpreadsheet ? activeSpreadsheet.getId() : '',
    activeSpreadsheetName: activeSpreadsheet ? activeSpreadsheet.getName() : '',
    runtimeSpreadsheetId: runtimeSpreadsheet ? runtimeSpreadsheet.getId() : '',
    runtimeSpreadsheetName: runtimeSpreadsheet ? runtimeSpreadsheet.getName() : '',
    currentUser: RacsorContractService.getCurrentUserRole(),
    productCount: RacsorContractService.getReferenceData(false).products.length,
    sheets: sheets
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
