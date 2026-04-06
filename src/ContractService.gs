var RacsorContractService = (function () {
  function getCurrentUserRole() {
    var email = '';
    try {
      email = Session.getActiveUser().getEmail();
    } catch (error) {
      email = '';
    }
    var user = email ? RacsorRepository.findOneBy(RacsorConfig.SHEETS.USERS, function (candidate) {
      return String(candidate.email).toLowerCase() === String(email).toLowerCase();
    }) : null;
    return {
      email: email,
      role: user ? user.role : 'RESP'
    };
  }

  function getReferenceData() {
    return {
      products: RacsorRepository.getAll(RacsorConfig.SHEETS.PRODUCTS).filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      pricingRules: RacsorRepository.getAll(RacsorConfig.SHEETS.PRICING_RULES).filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      prices: RacsorRepository.getAll(RacsorConfig.SHEETS.PRICES).filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      returnStates: RacsorRepository.getAll(RacsorConfig.SHEETS.RETURN_STATES).filter(function (item) {
        return String(item.is_active) !== 'false';
      }),
      users: RacsorRepository.getAll(RacsorConfig.SHEETS.USERS)
    };
  }

  function getDashboardData() {
    var today = RacsorUtils.toDateOnlyString(new Date());
    var transactions = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS);
    return {
      today: today,
      stock: RacsorStockService.getStockSnapshot(today),
      pickups: transactions.filter(function (item) {
        return item.pickup_date >= today && ['signed', 'draft'].indexOf(item.status) !== -1;
      }).slice(0, 10),
      returns: transactions.filter(function (item) {
        return item.return_date >= today && ['picked_up', 'late', 'incident', 'signed'].indexOf(item.status) !== -1;
      }).slice(0, 10),
      incidents: transactions.filter(function (item) {
        return item.status === 'incident';
      }).slice(0, 10),
      late: transactions.filter(function (item) {
        return item.status === 'late';
      }).slice(0, 10)
    };
  }

  function createContract(payload) {
    if (!payload || !payload.items || !payload.items.length) {
      throw new Error('Le contrat doit contenir au moins un produit.');
    }
    var existingNumbers = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS).map(function (item) {
      return item.contract_number;
    });
    var contractNumber = RacsorUtils.createContractNumber(existingNumbers);
    var customerSlug = RacsorUtils.slugifyName((payload.client_last_name || '') + '_' + (payload.client_first_name || 'CLIENT'));
    var folderName = contractNumber + '_' + customerSlug;
    var quote = RacsorPricingService.computeQuote(payload);
    RacsorStockService.assertAvailability(payload.items, payload.pickup_date, payload.return_date);

    var folder = RacsorDriveService.ensureContractFolder(folderName);
    var userContext = getCurrentUserRole();
    var transactionId = RacsorUtils.createId('TRX');
    var transaction = {
      id: transactionId,
      contract_number: contractNumber,
      folder_name: folderName,
      client_first_name: payload.client_first_name || '',
      client_last_name: payload.client_last_name || '',
      client_full_name: ((payload.client_first_name || '') + ' ' + (payload.client_last_name || '')).trim(),
      client_phone: payload.client_phone || '',
      client_email: payload.client_email || '',
      pickup_date: payload.pickup_date,
      return_date: payload.return_date,
      status: 'draft',
      total_amount_ttc: quote.total_amount_ttc,
      total_deposit_amount: quote.total_deposit_amount,
      drive_folder_id: folder.id,
      generated_contract_file_id: '',
      signed_contract_file_id: '',
      pickup_calendar_event_id: '',
      return_calendar_event_id: '',
      created_by: userContext.email || '',
      created_at: RacsorUtils.nowIso(),
      updated_at: RacsorUtils.nowIso(),
      cancelled_at: ''
    };

    RacsorRepository.append(RacsorConfig.SHEETS.TRANSACTIONS, [transaction]);
    RacsorRepository.append(RacsorConfig.SHEETS.TRANSACTION_ITEMS, quote.items.map(function (item) {
      item.id = RacsorUtils.createId('ITM');
      item.transaction_id = transactionId;
      return item;
    }));
    RacsorStockService.reserveStock(transactionId, 'draft', quote.items, payload.pickup_date, payload.return_date);

    var generatedFile = RacsorDriveService.createGeneratedContractFile(transaction, quote.items);
    var events = RacsorCalendarService.createContractEvents(transaction, quote.items, folder.url || '');
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
      generated_contract_file_id: generatedFile.id,
      pickup_calendar_event_id: events.pickupEventId,
      return_calendar_event_id: events.returnEventId,
      updated_at: RacsorUtils.nowIso()
    });

    RacsorLogService.log('CREATE_CONTRACT', 'transaction', transactionId, {
      contract_number: contractNumber,
      amount: quote.total_amount_ttc
    });

    return getContractById(transactionId);
  }

  function getContractById(transactionId) {
    var transaction = RacsorRepository.findOneBy(RacsorConfig.SHEETS.TRANSACTIONS, function (item) {
      return item.id === transactionId;
    });
    if (!transaction) {
      throw new Error('Contrat introuvable.');
    }
    var items = RacsorRepository.findBy(RacsorConfig.SHEETS.TRANSACTION_ITEMS, function (item) {
      return item.transaction_id === transactionId;
    });
    var returns = RacsorRepository.findBy(RacsorConfig.SHEETS.RETURN_ITEMS, function (item) {
      return item.transaction_id === transactionId;
    });
    return {
      transaction: enrichTransactionFiles_(transaction),
      items: items,
      returns: returns
    };
  }

  function enrichTransactionFiles_(transaction) {
    var enriched = JSON.parse(JSON.stringify(transaction));
    enriched.drive_folder_url = transaction.drive_folder_id ? DriveApp.getFolderById(transaction.drive_folder_id).getUrl() : '';
    enriched.generated_contract_url = transaction.generated_contract_file_id ? DriveApp.getFileById(transaction.generated_contract_file_id).getUrl() : '';
    enriched.signed_contract_url = transaction.signed_contract_file_id ? DriveApp.getFileById(transaction.signed_contract_file_id).getUrl() : '';
    return enriched;
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
    var data = getContractById(transactionId);
    var file = RacsorDriveService.saveSignedDocument(data.transaction, filePayload);
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
      status: 'signed',
      signed_contract_file_id: file.id,
      updated_at: RacsorUtils.nowIso()
    });
    RacsorLogService.log('SIGN_CONTRACT', 'transaction', transactionId, { file_id: file.id });
    return getContractById(transactionId);
  }

  function markPickedUp(transactionId) {
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
  }

  function cancelContract(transactionId) {
    var data = getContractById(transactionId);
    if (['cancelled', 'returned', 'closed'].indexOf(data.transaction.status) !== -1) {
      throw new Error('Ce contrat ne peut plus etre annule.');
    }
    RacsorStockService.releaseReservation(transactionId);
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
      status: 'cancelled',
      updated_at: RacsorUtils.nowIso(),
      cancelled_at: RacsorUtils.nowIso()
    });
    RacsorLogService.log('CANCEL_CONTRACT', 'transaction', transactionId, {});
    return getContractById(transactionId);
  }

  function recordReturn(payload) {
    var data = getContractById(payload.transaction_id);
    var itemMap = {};
    data.items.forEach(function (item) {
      itemMap[item.product_id] = item;
    });

    var hasIncident = false;
    var rows = [];
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
        if (Number(stateEntry.quantity || 0) <= 0) {
          return;
        }
        rows.push({
          id: RacsorUtils.createId('RET'),
          transaction_id: payload.transaction_id,
          product_id: entry.product_id,
          state_id: stateEntry.state_id,
          quantity: Number(stateEntry.quantity),
          comment: entry.comment || ''
        });
        if (String(stateEntry.state_label || '').toLowerCase() !== 'conforme') {
          hasIncident = true;
        }
      });
    });

    RacsorRepository.append(RacsorConfig.SHEETS.RETURN_ITEMS, rows);
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', payload.transaction_id, {
      status: hasIncident ? 'incident' : 'returned',
      updated_at: RacsorUtils.nowIso()
    });
    RacsorLogService.log('RECORD_RETURN', 'transaction', payload.transaction_id, { has_incident: hasIncident });
    return getContractById(payload.transaction_id);
  }

  function closeContract(transactionId) {
    RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', transactionId, {
      status: 'closed',
      updated_at: RacsorUtils.nowIso()
    });
    RacsorLogService.log('CLOSE_CONTRACT', 'transaction', transactionId, {});
    return getContractById(transactionId);
  }

  return {
    getCurrentUserRole: getCurrentUserRole,
    getReferenceData: getReferenceData,
    getDashboardData: getDashboardData,
    createContract: createContract,
    getContractById: getContractById,
    findContractByNumber: findContractByNumber,
    markContractSigned: markContractSigned,
    markPickedUp: markPickedUp,
    cancelContract: cancelContract,
    recordReturn: recordReturn,
    closeContract: closeContract
  };
})();
