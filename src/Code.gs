function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LOCATION MATERIEL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppBootstrapData() {
  seedDefaultRespUsers_();
  return {
    settings: RacsorConfig.getProjectSettings(),
    colors: RacsorConfig.COLORS,
    user: RacsorContractService.getCurrentUserRole(),
    referenceData: RacsorContractService.getReferenceData(false),
    dashboard: RacsorContractService.getDashboardData()
  };
}

function apiGetAdminData() {
  return RacsorContractService.getAdminData();
}

function apiCreateContract(payload) {
  return RacsorContractService.createContract(payload);
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
