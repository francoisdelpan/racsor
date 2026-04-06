function doGet() {
  return HtmlService.createTemplateFromFile('ui/Index')
    .evaluate()
    .setTitle('RacsoR')
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

function apiMarkContractSigned(transactionId, filePayload) {
  return RacsorContractService.markContractSigned(transactionId, filePayload);
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
