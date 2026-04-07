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
  return {
    settings: RacsorConfig.getProjectSettings(),
    colors: RacsorConfig.COLORS,
    user: RacsorContractService.getCurrentUserRole(),
    referenceData: RacsorContractService.getReferenceData(),
    dashboard: RacsorContractService.getDashboardData()
  };
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

function apiCloseContract(transactionId) {
  return RacsorContractService.closeContract(transactionId);
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
  return RacsorStockService.getStockMatrix(startDate, days || 45);
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
