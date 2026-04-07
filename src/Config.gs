var RacsorConfig = (function () {
  var SHEETS = {
    PRODUCTS: 'Products',
    PRICING_RULES: 'Pricing_Rules',
    PRICES: 'Prices',
    TRANSACTIONS: 'Transactions',
    TRANSACTION_ITEMS: 'Transaction_Items',
    STOCK_MOVEMENTS: 'Stock_Movements',
    RETURN_STATES: 'Return_States',
    USERS: 'Users',
    LOGS: 'Logs'
  };

  var COLORS = {
    blue: '#004b93',
    orange: '#ff6f1a',
    red: '#bf1e10',
    green: '#2d8c57',
    ink: '#10233a',
    paper: '#f7f8fb',
    border: '#d7dce5'
  };

  var DEFAULT_STATES = [
    { id: 'STATE_OK', label: 'conforme', sort_order: 1, is_default: true, is_active: true },
    { id: 'STATE_DIRTY', label: 'sale', sort_order: 2, is_default: true, is_active: true },
    { id: 'STATE_DAMAGED', label: 'abime', sort_order: 3, is_default: true, is_active: true },
    { id: 'STATE_BROKEN', label: 'casse', sort_order: 4, is_default: true, is_active: true },
    { id: 'STATE_MISSING', label: 'manquant', sort_order: 5, is_default: true, is_active: true }
  ];

  var DEFAULT_PRODUCTS = [
    { id: 'PROD_TABLE_MULTI', name: 'Table multifonction pliable', stock_max: 20, deposit_amount: 30, is_active: true },
    { id: 'PROD_TABLE_COCKTAIL', name: 'Table cocktail pliable', stock_max: 10, deposit_amount: 30, is_active: true },
    { id: 'PROD_CHAIR_BLACK', name: 'Fauteuil plastique noir', stock_max: 50, deposit_amount: 6, is_active: true }
  ];

  var DEFAULT_PRICING_RULES = [
    { id: 'RULE_WEEKEND', code: 'WEEKEND', type: 'weekend', value: 'FRIDAY_MONDAY', label: 'Forfait week-end', is_active: true },
    { id: 'RULE_LTE_4_DAYS', code: 'LTE_4_DAYS', type: 'lessThanOrEqualDays', value: '4', label: '1 a 4 jours', is_active: true },
    { id: 'RULE_LTE_10_DAYS', code: 'LTE_10_DAYS', type: 'lessThanOrEqualDays', value: '10', label: '5 a 10 jours', is_active: true }
  ];

  var DEFAULT_PRICES = [
    { id: 'PRICE_TABLE_MULTI_4', product_id: 'PROD_TABLE_MULTI', pricing_rule_id: 'RULE_LTE_4_DAYS', unit_price_ttc: 8, is_active: true },
    { id: 'PRICE_TABLE_MULTI_10', product_id: 'PROD_TABLE_MULTI', pricing_rule_id: 'RULE_LTE_10_DAYS', unit_price_ttc: 5, is_active: true },
    { id: 'PRICE_TABLE_MULTI_WE', product_id: 'PROD_TABLE_MULTI', pricing_rule_id: 'RULE_WEEKEND', unit_price_ttc: 13, is_active: true },
    { id: 'PRICE_TABLE_COCKTAIL_4', product_id: 'PROD_TABLE_COCKTAIL', pricing_rule_id: 'RULE_LTE_4_DAYS', unit_price_ttc: 6, is_active: true },
    { id: 'PRICE_TABLE_COCKTAIL_10', product_id: 'PROD_TABLE_COCKTAIL', pricing_rule_id: 'RULE_LTE_10_DAYS', unit_price_ttc: 4, is_active: true },
    { id: 'PRICE_TABLE_COCKTAIL_WE', product_id: 'PROD_TABLE_COCKTAIL', pricing_rule_id: 'RULE_WEEKEND', unit_price_ttc: 10, is_active: true },
    { id: 'PRICE_CHAIR_BLACK_4', product_id: 'PROD_CHAIR_BLACK', pricing_rule_id: 'RULE_LTE_4_DAYS', unit_price_ttc: 1.5, is_active: true },
    { id: 'PRICE_CHAIR_BLACK_WE', product_id: 'PROD_CHAIR_BLACK', pricing_rule_id: 'RULE_WEEKEND', unit_price_ttc: 2, is_active: true }
  ];

  var SHEET_HEADERS = {};
  SHEET_HEADERS[SHEETS.PRODUCTS] = ['id', 'name', 'sku', 'stock_max', 'deposit_amount', 'is_active', 'created_at', 'updated_at'];
  SHEET_HEADERS[SHEETS.PRICING_RULES] = ['id', 'code', 'type', 'value', 'label', 'is_active'];
  SHEET_HEADERS[SHEETS.PRICES] = ['id', 'product_id', 'pricing_rule_id', 'unit_price_ttc', 'is_active', 'created_at', 'updated_at'];
  SHEET_HEADERS[SHEETS.TRANSACTIONS] = ['id', 'contract_number', 'folder_name', 'client_first_name', 'client_last_name', 'client_full_name', 'client_address', 'client_zipcity', 'client_phone', 'client_email', 'pickup_date', 'pickup_hour', 'return_date', 'return_hour', 'status', 'total_amount_ttc', 'total_deposit_amount', 'drive_folder_id', 'generated_contract_file_id', 'signed_contract_file_id', 'pickup_calendar_event_id', 'return_calendar_event_id', 'return_details_json', 'created_by', 'created_at', 'updated_at', 'cancelled_at'];
  SHEET_HEADERS[SHEETS.TRANSACTION_ITEMS] = ['id', 'transaction_id', 'product_id', 'product_label_snapshot', 'quantity', 'pricing_rule_id', 'pricing_rule_code', 'pricing_label_snapshot', 'charged_days', 'unit_price_ttc', 'line_amount_ttc', 'deposit_unit_amount', 'deposit_line_amount'];
  SHEET_HEADERS[SHEETS.STOCK_MOVEMENTS] = ['movement_date', 'product_id', 'transaction_id', 'movement_type', 'quantity_delta', 'balance_after'];
  SHEET_HEADERS[SHEETS.RETURN_STATES] = ['id', 'label', 'sort_order', 'is_default', 'is_active'];
  SHEET_HEADERS[SHEETS.USERS] = ['email', 'role', 'is_active', 'get_alert', 'created_at', 'updated_at'];
  SHEET_HEADERS[SHEETS.LOGS] = ['timestamp', 'user_email', 'action', 'entity_type', 'entity_id', 'details'];

  function getScriptProperties() {
    return PropertiesService.getScriptProperties();
  }

  function getProjectSettings() {
    var props = getScriptProperties();
    return {
      spreadsheetId: props.getProperty('RACSOR_SPREADSHEET_ID') || '',
      driveRootFolderId: props.getProperty('RACSOR_DRIVE_ROOT_FOLDER_ID') || '',
      contractTemplateId: props.getProperty('RACSOR_CONTRACT_TEMPLATE_ID') || '',
      calendarId: props.getProperty('RACSOR_CALENDAR_ID') || '',
      logoUrl: props.getProperty('RACSOR_LOGO_URL') || '',
      appName: 'LOCATION MATERIEL'
    };
  }

  return {
    SHEETS: SHEETS,
    SHEET_HEADERS: SHEET_HEADERS,
    COLORS: COLORS,
    DEFAULT_STATES: DEFAULT_STATES,
    DEFAULT_PRODUCTS: DEFAULT_PRODUCTS,
    DEFAULT_PRICING_RULES: DEFAULT_PRICING_RULES,
    DEFAULT_PRICES: DEFAULT_PRICES,
    getProjectSettings: getProjectSettings
  };
})();
