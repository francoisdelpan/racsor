var RacsorContractService = (function () {
  function getActiveUserEmail_() {
    try {
      return RacsorUtils.normalizeEmail(Session.getActiveUser().getEmail());
    } catch (error) {
      return '';
    }
  }

  function getCurrentUserRole() {
    var email = getActiveUserEmail_();
    var user = email ? RacsorRepository.findOneBy(RacsorConfig.SHEETS.USERS, function (candidate) {
      return RacsorUtils.normalizeEmail(candidate.email) === email;
    }) : null;
    var isActive = user && String(user.is_active) !== 'false';
    return {
      email: email,
      role: isActive ? user.role : 'NO_ACCESS',
      is_authorized: Boolean(isActive),
      reason: !email ? 'EMAIL_UNAVAILABLE' : !user ? 'USER_NOT_DECLARED' : !isActive ? 'USER_INACTIVE' : ''
    };
  }

  function assertAuthorized_() {
    var user = getCurrentUserRole();
    if (!user.is_authorized) {
      throw new Error('Acces refuse. Ton compte doit etre ajoute comme utilisateur actif dans Racsor.');
    }
    return user;
  }

  function assertRole_(roles) {
    var user = assertAuthorized_();
    if (roles.indexOf(user.role) === -1) {
      throw new Error('Action non autorisee pour le role ' + user.role + '.');
    }
    return user;
  }

  function normalizeUserPayload_(payload) {
    var clean = payload || {};
    clean.email = RacsorUtils.normalizeEmail(clean.email);
    clean.role = clean.role || 'DRIVE';
    clean.is_active = clean.is_active !== false && String(clean.is_active) !== 'false';
    clean.get_alert = clean.get_alert === true || String(clean.get_alert) === 'true';
    return clean;
  }

  function getReferenceData(includeUsers) {
    var products = RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS);
    var pricingRules = RacsorRepository.getAll(RacsorConfig.SHEETS.PRICING_RULES);
    var prices = RacsorRepository.getAll(RacsorConfig.SHEETS.PRICES);
    var returnStates = RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES);

    if (!products.length || !pricingRules.length || !prices.length || !returnStates.length) {
      try {
        ensureRuntimeProjectSetup_();
      } catch (error) {
      }
      products = RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS);
      pricingRules = RacsorRepository.getAll(RacsorConfig.SHEETS.PRICING_RULES);
      prices = RacsorRepository.getAll(RacsorConfig.SHEETS.PRICES);
      returnStates = RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES);
    }

    if (!products.length) {
      products = RacsorConfig.DEFAULT_PRODUCTS.map(function (item) {
        return {
          id: item.id,
          name: item.name,
          sku: '',
          stock_max: item.stock_max,
          deposit_amount: item.deposit_amount,
          is_active: item.is_active
        };
      });
    }
    if (!pricingRules.length) {
      pricingRules = RacsorConfig.DEFAULT_PRICING_RULES.slice();
    }
    if (!prices.length) {
      prices = RacsorConfig.DEFAULT_PRICES.slice();
    }
    if (!returnStates.length) {
      returnStates = RacsorConfig.DEFAULT_STATES.slice();
    }

    var data = {
      products: products.filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      pricingRules: pricingRules.filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      prices: prices.filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      returnStates: returnStates.filter(function (item) {
        return String(item.is_active) !== 'false';
      })
    };
    if (includeUsers) {
      data.users = RacsorRepository.getAll(RacsorConfig.SHEETS.USERS);
    }
    return data;
  }

  function getAdminData() {
    assertRole_(['RESP']);
    return {
      referenceData: getReferenceData(true),
      closedContracts: getDashboardData().closedContracts || []
    };
  }

  function getDashboardData() {
    var user = assertAuthorized_();
    var today = RacsorUtils.toDateOnlyString(new Date());
    var transactions = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS).map(function (item) {
      var cloned = JSON.parse(JSON.stringify(item));
      cloned.pickup_date = item.pickup_date ? RacsorUtils.toDateOnlyString(item.pickup_date) : '';
      cloned.return_date = item.return_date ? RacsorUtils.toDateOnlyString(item.return_date) : '';
      return cloned;
    });
    var stockSnapshot = RacsorStockService.getStockSnapshot(today);
    var pickupContracts = transactions.filter(function (item) {
      return item.pickup_date >= today && ['signed', 'draft'].indexOf(item.status) !== -1;
    });
    var returnContracts = transactions.filter(function (item) {
      return item.return_date >= today && ['picked_up', 'late', 'incident', 'signed'].indexOf(item.status) !== -1;
    });
    var pickupsToday = pickupContracts.filter(function (item) {
      return item.pickup_date === today;
    });
    var returnsToday = returnContracts.filter(function (item) {
      return item.return_date === today;
    });
    var pickupsFuture = pickupContracts.filter(function (item) {
      return item.pickup_date > today;
    });
    var returnsFuture = returnContracts.filter(function (item) {
      return item.return_date > today;
    });
    var stockAlerts = stockSnapshot.filter(function (item) {
      return item.available < 0;
    }).map(function (item) {
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        available: item.available
      };
    });
    var incidents = transactions.filter(function (item) {
      return item.status === 'incident';
    }).slice(0, 10);
    var late = transactions.filter(function (item) {
      return item.status === 'late';
    }).slice(0, 10);
    return {
      today: today,
      stock: stockSnapshot,
      pickups: pickupContracts.slice(0, 10),
      returns: returnContracts.slice(0, 10),
      pickupsTodayCount: pickupsToday.length,
      returnsTodayCount: returnsToday.length,
      pickupsFutureCount: pickupsFuture.length,
      returnsFutureCount: returnsFuture.length,
      incidents: incidents,
      late: late,
      stockAlerts: stockAlerts,
      openAlertCount: incidents.length + late.length + stockAlerts.length,
      recentContracts: transactions.filter(function (item) {
        return item.status !== 'closed';
      }).slice().sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      }).slice(0, 12).map(enrichTransactionFiles_),
      closedContracts: user.role === 'RESP' ? transactions.filter(function (item) {
        return item.status === 'closed';
      }).slice().sort(function (a, b) {
        return String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));
      }).slice(0, 30).map(enrichTransactionFiles_) : []
    };
  }

  function createContract(payload) {
    return RacsorUtils.withScriptLock('CREATE_CONTRACT', function () {
      assertRole_(['RESP', 'SAV']);
      if (!payload || !payload.items || !payload.items.length) {
        throw new Error('Le contrat doit contenir au moins un produit.');
      }
      var existingNumbers = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS).map(function (item) {
        return item.contract_number;
      });
      var contractNumber = RacsorUtils.createContractNumber(existingNumbers);
      var customerSlug = RacsorUtils.slugifyName(payload.client_last_name || 'CLIENT');
      var folderName = contractNumber + '_' + customerSlug;
      var quote = RacsorPricingService.computeQuote(payload);
      if (!payload.force_stock_override) {
        RacsorStockService.assertAvailabilityOrThrow(quote.items, payload.pickup_date, payload.return_date);
      }
      var userContext = getCurrentUserRole();
      var transactionId = RacsorUtils.createId('TRX');
      var transaction = {
        id: transactionId,
        contract_number: contractNumber,
        folder_name: folderName,
        client_first_name: payload.client_first_name || '',
        client_last_name: payload.client_last_name || '',
        client_full_name: ((payload.client_first_name || '') + ' ' + (payload.client_last_name || '')).trim(),
        client_address: payload.client_address || '',
        client_zipcity: payload.client_zipcity || '',
        client_phone: payload.client_phone || '',
        client_email: payload.client_email || '',
        pickup_date: payload.pickup_date,
        pickup_hour: payload.pickup_hour || '09:00',
        return_date: payload.return_date,
        return_hour: payload.return_hour || '09:00',
        status: 'draft',
        total_amount_ttc: quote.total_amount_ttc,
        total_deposit_amount: quote.total_deposit_amount,
        drive_folder_id: '',
        generated_contract_file_id: '',
        signed_contract_file_id: '',
        pickup_calendar_event_id: '',
        return_calendar_event_id: '',
        return_details_json: '',
        created_by: userContext.email || '',
        created_at: RacsorUtils.nowIso(),
        updated_at: RacsorUtils.nowIso(),
        cancelled_at: '',
        asset_generation_status: 'pending',
        asset_generation_error: ''
      };

      RacsorRepository.append(RacsorConfig.SHEETS.TRANSACTIONS, [transaction]);
      RacsorRepository.append(RacsorConfig.SHEETS.TRANSACTION_ITEMS, quote.items.map(function (item) {
        item.id = RacsorUtils.createId('ITM');
        item.transaction_id = transactionId;
        return item;
      }));
      RacsorStockService.applyStockOut(quote.items, payload.pickup_date, transactionId, 'Creation contrat');

      RacsorLogService.log('CREATE_CONTRACT', 'transaction', transactionId, {
        contract_number: contractNumber,
        amount: quote.total_amount_ttc,
        forced_stock_override: Boolean(payload.force_stock_override),
        forced_by: payload.force_stock_override_name || ''
      });

      return getContractById(transactionId);
    });
  }

  function prepareContractAssets(transactionId) {
    return RacsorUtils.withScriptLock('PREPARE_CONTRACT_ASSETS', function () {
      assertRole_(['RESP', 'SAV']);
      var data = getContractById(transactionId);
      var transaction = data.transaction;
      if (['cancelled', 'closed'].indexOf(transaction.status) !== -1) {
        throw new Error('Les documents ne peuvent pas etre prepares pour ce statut.');
      }
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        asset_generation_status: 'generating',
        asset_generation_error: '',
        updated_at: RacsorUtils.nowIso()
      });
      try {
        var folderInfo = transaction.drive_folder_id && RacsorDriveService.getFolderSafe_(transaction.drive_folder_id)
          ? {
              id: transaction.drive_folder_id,
              url: RacsorDriveService.getFolderSafe_(transaction.drive_folder_id).getUrl()
            }
          : RacsorDriveService.ensureContractFolder(transaction.folder_name);
        if (!transaction.generated_contract_file_id) {
          transaction.drive_folder_id = folderInfo.id;
          var generatedFile = RacsorDriveService.createGeneratedContractFile(transaction, data.items);
          transaction.generated_contract_file_id = generatedFile.id;
          RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
            drive_folder_id: folderInfo.id || '',
            generated_contract_file_id: generatedFile.id || '',
            updated_at: RacsorUtils.nowIso()
          });
        }
        var events = {
          pickupEventId: transaction.pickup_calendar_event_id || '',
          returnEventId: transaction.return_calendar_event_id || ''
        };
        if (!events.pickupEventId || !events.returnEventId) {
          RacsorCalendarService.deleteContractEvents(transaction);
          events = RacsorCalendarService.createContractEvents(transaction, data.items, folderInfo.url || '');
        }
        RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
          drive_folder_id: folderInfo.id || '',
          generated_contract_file_id: transaction.generated_contract_file_id || '',
          pickup_calendar_event_id: events.pickupEventId || '',
          return_calendar_event_id: events.returnEventId || '',
          asset_generation_status: 'ready',
          asset_generation_error: '',
          updated_at: RacsorUtils.nowIso()
        });
        RacsorLogService.log('PREPARE_CONTRACT_ASSETS', 'transaction', transactionId, {});
        return getContractById(transactionId);
      } catch (error) {
        RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
          asset_generation_status: 'error',
          asset_generation_error: String(error && error.message ? error.message : error),
          updated_at: RacsorUtils.nowIso()
        });
        RacsorLogService.log('PREPARE_CONTRACT_ASSETS_ERROR', 'transaction', transactionId, {
          error: String(error && error.message ? error.message : error)
        });
        throw error;
      }
    });
  }

  function updateContract(payload) {
    return RacsorUtils.withScriptLock('UPDATE_CONTRACT', function () {
      assertRole_(['RESP', 'SAV']);
      if (!payload || !payload.transaction_id) {
        throw new Error('Contrat a modifier introuvable.');
      }
      var data = getContractById(payload.transaction_id);
      var transaction = data.transaction;
      if (['draft', 'signed'].indexOf(transaction.status) === -1) {
        throw new Error('Modification autorisee uniquement avant retrait Drive.');
      }
      var quote = RacsorPricingService.computeQuote(payload);
      var oldItems = data.items.map(function (item) {
        return { product_id: item.product_id, quantity: Number(item.quantity || 0) };
      });
      RacsorStockService.applyStockIn(oldItems, transaction.pickup_date, transaction.id, 'reservation_update_reverse', 'Modification contrat');
      try {
        if (!payload.force_stock_override) {
          RacsorStockService.assertAvailabilityOrThrow(quote.items, payload.pickup_date, payload.return_date);
        }
        RacsorStockService.applyStockOut(quote.items, payload.pickup_date, transaction.id, 'Modification contrat');
      } catch (error) {
        RacsorStockService.applyStockOut(oldItems, transaction.pickup_date, transaction.id, 'Rollback modification contrat');
        throw error;
      }
      RacsorRepository.replaceWhere(RacsorConfig.SHEETS.TRANSACTION_ITEMS, function (item) {
        return item.transaction_id === transaction.id;
      }, quote.items.map(function (item) {
        item.id = RacsorUtils.createId('ITM');
        item.transaction_id = transaction.id;
        return item;
      }));
      RacsorCalendarService.deleteContractEvents(transaction);
      var becomesDraft = transaction.status === 'signed';
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transaction.id, {
        client_first_name: payload.client_first_name || '',
        client_last_name: payload.client_last_name || '',
        client_full_name: ((payload.client_first_name || '') + ' ' + (payload.client_last_name || '')).trim(),
        client_address: payload.client_address || '',
        client_zipcity: payload.client_zipcity || '',
        client_phone: payload.client_phone || '',
        client_email: payload.client_email || '',
        pickup_date: payload.pickup_date,
        pickup_hour: payload.pickup_hour || '09:00',
        return_date: payload.return_date,
        return_hour: payload.return_hour || '09:00',
        status: becomesDraft ? 'draft' : transaction.status,
        total_amount_ttc: quote.total_amount_ttc,
        total_deposit_amount: quote.total_deposit_amount,
        generated_contract_file_id: '',
        signed_contract_file_id: becomesDraft ? '' : transaction.signed_contract_file_id,
        pickup_calendar_event_id: '',
        return_calendar_event_id: '',
        asset_generation_status: 'pending',
        asset_generation_error: '',
        updated_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('UPDATE_CONTRACT', 'transaction', transaction.id, {
        reverted_to_draft: becomesDraft
      });
      return getContractById(transaction.id);
    });
  }

  function getContractById(transactionId) {
    assertAuthorized_();
    var transaction = RacsorRepository.findOneBy(RacsorConfig.SHEETS.TRANSACTIONS, function (item) {
      return item.id === transactionId;
    });
    if (!transaction) {
      throw new Error('Contrat introuvable.');
    }
    var items = RacsorRepository.findBy(RacsorConfig.SHEETS.TRANSACTION_ITEMS, function (item) {
      return item.transaction_id === transactionId;
    });
    var returns = RacsorUtils.safeJsonParse(transaction.return_details_json || '[]', []);
    return {
      transaction: enrichTransactionFiles_(transaction),
      items: items,
      returns: returns
    };
  }

  function buildReturnSummaryRows_(contractData) {
    var productMap = {};
    var stateMap = {};
    (contractData.items || []).forEach(function (item) {
      productMap[item.product_id] = item.product_label_snapshot || item.product_id;
    });
    RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES).forEach(function (item) {
      stateMap[item.id] = item.label || item.id;
    });
    return (contractData.returns || []).map(function (entry) {
      return {
        product_id: entry.product_id,
        product_label: productMap[entry.product_id] || entry.product_id,
        state_id: entry.state_id,
        state_label: stateMap[entry.state_id] || entry.state_id,
        quantity: entry.quantity,
        comment: entry.comment || ''
      };
    });
  }

  function getReturnStateMap_() {
    var map = {};
    RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES).forEach(function (state) {
      var reintegrates = state.reintegrates_stock === '' || state.reintegrates_stock === undefined
        ? String(state.label || '').toLowerCase() !== 'manquant'
        : RacsorUtils.isTruthy(state.reintegrates_stock);
      map[state.id] = {
        label: state.label || state.id,
        reintegrates_stock: reintegrates
      };
    });
    return map;
  }

  function enrichTransactionFiles_(transaction) {
    var enriched = JSON.parse(JSON.stringify(transaction));
    enriched.drive_folder_url = transaction.drive_folder_id ? ('https://drive.google.com/drive/folders/' + transaction.drive_folder_id) : '';
    enriched.generated_contract_url = transaction.generated_contract_file_id ? ('https://drive.google.com/file/d/' + transaction.generated_contract_file_id + '/view') : '';
    enriched.signed_contract_url = transaction.signed_contract_file_id ? ('https://drive.google.com/file/d/' + transaction.signed_contract_file_id + '/view') : '';
    return enriched;
  }

  function listContractsByStatuses(statuses) {
    assertAuthorized_();
    return RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS)
      .filter(function (item) {
        return statuses.indexOf(item.status) !== -1;
      })
      .sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      })
      .map(enrichTransactionFiles_);
  }

  function upsertUser(payload) {
    assertRole_(['RESP']);
    payload = normalizeUserPayload_(payload);
    var existing = RacsorRepository.findOneBy(RacsorConfig.SHEETS.USERS, function (user) {
      return RacsorUtils.normalizeEmail(user.email) === payload.email;
    });
    if (existing) {
      RacsorRepository.updateById(RacsorConfig.SHEETS.USERS, 'email', existing.email, {
        role: payload.role,
        is_active: payload.is_active,
        get_alert: payload.get_alert,
        updated_at: RacsorUtils.nowIso()
      });
    } else {
      RacsorRepository.append(RacsorConfig.SHEETS.USERS, [{
        email: payload.email,
        role: payload.role,
        is_active: payload.is_active,
        get_alert: payload.get_alert,
        created_at: RacsorUtils.nowIso(),
        updated_at: RacsorUtils.nowIso()
      }]);
    }
    return getReferenceData(true);
  }

  function updateProductAdmin(payload) {
    assertRole_(['RESP']);
    RacsorRepository.updateById(RacsorConfig.SHEETS.PRODUCTS, 'id', payload.id, {
      stock_max: payload.stock_max,
      deposit_amount: payload.deposit_amount,
      is_active: payload.is_active,
      updated_at: RacsorUtils.nowIso()
    });
    RacsorStockService.ensureStockSheetExists();
    return getReferenceData(true);
  }

  function updatePriceAdmin(payload) {
    assertRole_(['RESP']);
    RacsorRepository.updateById(RacsorConfig.SHEETS.PRICES, 'id', payload.id, {
      unit_price_ttc: payload.unit_price_ttc,
      is_active: payload.is_active,
      updated_at: RacsorUtils.nowIso()
    });
    return getReferenceData(true);
  }

  function addProductAdmin(payload) {
    assertRole_(['RESP']);
    var productId = RacsorUtils.createId('PROD');
    RacsorRepository.append(RacsorConfig.SHEETS.PRODUCTS, [{
      id: productId,
      name: payload.name,
      sku: payload.sku || '',
      stock_max: payload.stock_max,
      deposit_amount: payload.deposit_amount,
      is_active: true,
      created_at: RacsorUtils.nowIso(),
      updated_at: RacsorUtils.nowIso()
    }]);
    RacsorStockService.ensureStockSheetExists();
    return getReferenceData(true);
  }

  function updatePricingRuleAdmin(payload) {
    assertRole_(['RESP']);
    RacsorRepository.updateById(RacsorConfig.SHEETS.PRICING_RULES, 'id', payload.id, {
      code: payload.code,
      type: payload.type,
      value: payload.value,
      label: payload.label,
      is_active: payload.is_active
    });
    return getReferenceData(true);
  }

  function addPricingRuleAdmin(payload) {
    assertRole_(['RESP']);
    RacsorRepository.append(RacsorConfig.SHEETS.PRICING_RULES, [{
      id: RacsorUtils.createId('RULE'),
      code: payload.code,
      type: payload.type,
      value: payload.value,
      label: payload.label,
      is_active: payload.is_active
    }]);
    return getReferenceData(true);
  }

  function findContractByNumber(contractNumber) {
    var transaction = RacsorRepository.findOneBy(RacsorConfig.SHEETS.TRANSACTIONS, function (item) {
      return item.contract_number === contractNumber;
    });
    if (!transaction) {
      throw new Error('Numero de contrat introuvable.');
    }
    return getContractById(transaction.id);
  }

  function markContractSigned(transactionId, filePayload) {
    assertRole_(['RESP', 'SAV']);
    var data = getContractById(transactionId);
    if (!data.transaction.drive_folder_id || !RacsorDriveService.getFolderSafe_(data.transaction.drive_folder_id)) {
      var folder = RacsorDriveService.ensureContractFolder(data.transaction.folder_name);
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        drive_folder_id: folder.id,
        updated_at: RacsorUtils.nowIso()
      });
      data = getContractById(transactionId);
    }
    var file = RacsorDriveService.saveSignedDocument(data.transaction, filePayload);
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
      status: 'signed',
      signed_contract_file_id: file.id,
      updated_at: RacsorUtils.nowIso()
    });
    RacsorLogService.log('SIGN_CONTRACT', 'transaction', transactionId, { file_id: file.id });
    return getContractById(transactionId);
  }

  function forceContractSigned(transactionId) {
    assertRole_(['RESP', 'SAV']);
    var data = getContractById(transactionId);
    if (['cancelled', 'closed'].indexOf(data.transaction.status) !== -1) {
      throw new Error('Ce contrat ne peut pas passer en signed.');
    }
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
      status: 'signed',
      updated_at: RacsorUtils.nowIso()
    });
    RacsorLogService.log('FORCE_SIGN_CONTRACT', 'transaction', transactionId, {});
    return getContractById(transactionId);
  }

  function uploadContractDocument(transactionId, filePayload) {
    assertAuthorized_();
    var data = getContractById(transactionId);
    if (!data.transaction.drive_folder_id || !RacsorDriveService.getFolderSafe_(data.transaction.drive_folder_id)) {
      var folder = RacsorDriveService.ensureContractFolder(data.transaction.folder_name);
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        drive_folder_id: folder.id,
        updated_at: RacsorUtils.nowIso()
      });
      data = getContractById(transactionId);
    }
    var file = RacsorDriveService.saveDocumentToContractFolder(data.transaction, filePayload);
    RacsorLogService.log('UPLOAD_DOCUMENT', 'transaction', transactionId, { file_id: file.id, name: file.name });
    return getContractById(transactionId);
  }

  function markPickedUp(transactionId) {
    return RacsorUtils.withScriptLock('PICKUP_CONTRACT', function () {
      assertRole_(['RESP', 'DRIVE']);
      var data = getContractById(transactionId);
      if (data.transaction.status !== 'signed') {
        throw new Error('Le retrait est autorise uniquement pour un contrat signed.');
      }
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        status: 'picked_up',
        updated_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('PICKUP_CONTRACT', 'transaction', transactionId, {});
      return getContractById(transactionId);
    });
  }

  function cancelContract(transactionId) {
    return RacsorUtils.withScriptLock('CANCEL_CONTRACT', function () {
      assertRole_(['RESP', 'SAV']);
      var data = getContractById(transactionId);
      if (['draft', 'signed'].indexOf(data.transaction.status) === -1) {
        throw new Error('Annulation autorisee uniquement avant retrait Drive.');
      }
      RacsorStockService.applyStockIn(data.items.map(function (item) {
        return {
          product_id: item.product_id,
          quantity: Number(item.quantity || 0)
        };
      }), data.transaction.pickup_date, transactionId, 'reservation_cancel', 'Annulation contrat');
      RacsorCalendarService.deleteContractEvents(data.transaction);
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        status: 'cancelled',
        pickup_calendar_event_id: '',
        return_calendar_event_id: '',
        asset_generation_status: 'cancelled',
        updated_at: RacsorUtils.nowIso(),
        cancelled_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('CANCEL_CONTRACT', 'transaction', transactionId, {});
      return getContractById(transactionId);
    });
  }

  function recordReturn(payload) {
    return RacsorUtils.withScriptLock('RECORD_RETURN', function () {
      assertRole_(['RESP', 'DRIVE']);
      var data = getContractById(payload.transaction_id);
      var actualReturnDate = payload.actual_return_date ? RacsorUtils.toDateOnlyString(payload.actual_return_date) : data.transaction.return_date;
      var stateMap = getReturnStateMap_();
      var itemMap = {};
      data.items.forEach(function (item) {
        itemMap[item.product_id] = item;
      });

      var hasIncident = false;
      var rows = [];
      var stockRows = [];
      (payload.items || []).forEach(function (entry) {
        var transactionItem = itemMap[entry.product_id];
        if (!transactionItem) {
          throw new Error('Produit de retour invalide.');
        }
        var totalByStates = RacsorUtils.sum(entry.states || [], function (stateEntry) {
          return Number(stateEntry.quantity || 0);
        });
        if (totalByStates !== Number(transactionItem.quantity)) {
          throw new Error('Le total par etat doit correspondre a la quantite louee pour ' + transactionItem.product_label_snapshot);
        }
        (entry.states || []).forEach(function (stateEntry) {
          var quantity = Number(stateEntry.quantity || 0);
          if (quantity <= 0) {
            return;
          }
          var state = stateMap[stateEntry.state_id] || {};
          rows.push({
            transaction_id: payload.transaction_id,
            product_id: entry.product_id,
            state_id: stateEntry.state_id,
            quantity: quantity,
            comment: entry.comment || ''
          });
          if (String(state.label || stateEntry.state_label || '').toLowerCase() !== 'conforme') {
            hasIncident = true;
          }
          if (state.reintegrates_stock !== false) {
            stockRows.push({
              product_id: entry.product_id,
              quantity: quantity
            });
          }
        });
      });

      RacsorStockService.applyStockIn(stockRows, actualReturnDate, payload.transaction_id, 'return', 'Retour Drive');
      var clearReturnEvent = actualReturnDate < RacsorUtils.toDateOnlyString(data.transaction.return_date);
      if (clearReturnEvent) {
        RacsorCalendarService.deleteEventSafe(data.transaction.return_calendar_event_id);
      }
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', payload.transaction_id, {
        status: hasIncident ? 'incident' : 'returned',
        return_date: actualReturnDate,
        return_calendar_event_id: clearReturnEvent ? '' : data.transaction.return_calendar_event_id,
        return_details_json: JSON.stringify(rows),
        updated_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('RECORD_RETURN', 'transaction', payload.transaction_id, {
        has_incident: hasIncident,
        stock_reintegrated: stockRows
      });
      var updatedContract = getContractById(payload.transaction_id);
      RacsorDriveService.saveFinalStateSummary(updatedContract.transaction, updatedContract.items, buildReturnSummaryRows_(updatedContract));
      return updatedContract;
    });
  }

  function closeContract(payload) {
    return RacsorUtils.withScriptLock('CLOSE_CONTRACT', function () {
      assertRole_(['RESP']);
      var transactionId = typeof payload === 'string' ? payload : payload.transaction_id;
      var data = getContractById(transactionId);
      if (data.transaction.status !== 'ready_to_close') {
        throw new Error('Le dossier doit etre valide par le SAV avant cloture.');
      }
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        status: 'closed',
        updated_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('CLOSE_CONTRACT', 'transaction', transactionId, {});
      return getContractById(transactionId);
    });
  }

  function finalizeSavReturn(payload) {
    return RacsorUtils.withScriptLock('FINALIZE_SAV_RETURN', function () {
      assertRole_(['RESP', 'SAV']);
      var transactionId = payload.transaction_id;
      var closePayload = payload || {};
      var data = getContractById(transactionId);
      if (['returned', 'incident', 'late'].indexOf(data.transaction.status) === -1) {
        throw new Error('Le dossier ne peut pas encore etre valide par le SAV.');
      }
      var ticketFile = null;
      if (closePayload.ticket_file && closePayload.ticket_file.base64) {
        ticketFile = RacsorDriveService.saveDocumentToContractFolder(data.transaction, closePayload.ticket_file);
      }
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        status: 'ready_to_close',
        updated_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('FINALIZE_SAV_RETURN', 'transaction', transactionId, {
        refund_amount: closePayload.refund_amount || 0
      });
      var updatedContract = getContractById(transactionId);
      RacsorDriveService.saveFinalStateSummary(updatedContract.transaction, updatedContract.items, buildReturnSummaryRows_(updatedContract));
      RacsorDriveService.saveSavClosureSummary(updatedContract.transaction, {
        refund_amount: closePayload.refund_amount || 0,
        reason: closePayload.reason || '',
        comment: closePayload.comment || '',
        ticket_file_url: ticketFile ? ticketFile.url : ''
      });
      return updatedContract;
    });
  }

  function reopenContract(payload) {
    return RacsorUtils.withScriptLock('REOPEN_CONTRACT', function () {
      assertRole_(['RESP']);
      var transactionId = typeof payload === 'string' ? payload : payload.transaction_id;
      var reason = typeof payload === 'string' ? '' : (payload.reason || '');
      var data = getContractById(transactionId);
      if (data.transaction.status !== 'closed') {
        throw new Error('Seul un dossier cloture peut etre decloture.');
      }
      RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
        status: 'ready_to_close',
        updated_at: RacsorUtils.nowIso()
      });
      RacsorLogService.log('REOPEN_CONTRACT', 'transaction', transactionId, {
        reason: reason || ''
      });
      return getContractById(transactionId);
    });
  }

  return {
    getCurrentUserRole: getCurrentUserRole,
    getReferenceData: getReferenceData,
    getAdminData: getAdminData,
    getDashboardData: getDashboardData,
    listContractsByStatuses: listContractsByStatuses,
    upsertUser: upsertUser,
    updateProductAdmin: updateProductAdmin,
    updatePriceAdmin: updatePriceAdmin,
    addProductAdmin: addProductAdmin,
    updatePricingRuleAdmin: updatePricingRuleAdmin,
    addPricingRuleAdmin: addPricingRuleAdmin,
    createContract: createContract,
    updateContract: updateContract,
    prepareContractAssets: prepareContractAssets,
    getContractById: getContractById,
    findContractByNumber: findContractByNumber,
    markContractSigned: markContractSigned,
    forceContractSigned: forceContractSigned,
    uploadContractDocument: uploadContractDocument,
    markPickedUp: markPickedUp,
    cancelContract: cancelContract,
    recordReturn: recordReturn,
    finalizeSavReturn: finalizeSavReturn,
    closeContract: closeContract,
    reopenContract: reopenContract
  };
})();
