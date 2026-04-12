var RacsorDriveService = (function () {
  function getRootFolder() {
    var settings = RacsorConfig.getProjectSettings();
    if (!settings.driveRootFolderId) {
      return getOrCreateDefaultRootFolder_();
    }
    return getFolderSafe_(settings.driveRootFolderId) || getOrCreateDefaultRootFolder_();
  }

  function ensureContractFolder(folderName) {
    var root = getRootFolder();
    if (!root) {
      return { id: '', url: '', name: folderName };
    }
    var iterator = root.getFoldersByName(folderName);
    var folder = iterator.hasNext() ? iterator.next() : root.createFolder(folderName);
    return { id: folder.getId(), url: folder.getUrl(), name: folder.getName() };
  }

  function createGeneratedContractFile(transaction, items) {
    var settings = RacsorConfig.getProjectSettings();
    if (!transaction.drive_folder_id) {
      return { id: '', name: '', url: '' };
    }
    var folder = getFolderSafe_(transaction.drive_folder_id);
    if (!folder) {
      throw new Error('Dossier Drive du contrat introuvable ou inaccessible.');
    }
    var fileName = transaction.folder_name + '_autoGenerate';

    if (settings.contractTemplateId) {
      var templateFile = getFileSafe_(settings.contractTemplateId);
      if (!templateFile) {
        throw new Error('Template Google Docs introuvable ou inaccessible.');
      }
      var file = templateFile.makeCopy(fileName, folder);
      var doc = DocumentApp.openById(file.getId());
      var body = doc.getBody();
      var itemLines = buildItemLines_(items);
      body.replaceText('{{CONTRACT_NUMBER}}', transaction.contract_number);
      body.replaceText('{{CLIENT_NAME}}', transaction.client_first_name || '');
      body.replaceText('{{CLIENT_SURNAME}}', transaction.client_last_name || '');
      body.replaceText('{{CLIENT_PHONE}}', transaction.client_phone || '');
      body.replaceText('{{CLIENT_EMAIL}}', transaction.client_email || '');
      body.replaceText('{{CLIENT_ADDRESS}}', transaction.client_address || '');
      body.replaceText('{{CLIENT_ZIPCITY}}', transaction.client_zipcity || '');
      body.replaceText('{{PICKUP_DATE}}', RacsorUtils.toContractDate(transaction.pickup_date));
      body.replaceText('{{PICKUP_HOUR}}', transaction.pickup_hour || '');
      body.replaceText('{{RETURN_DATE}}', RacsorUtils.toContractDate(transaction.return_date));
      body.replaceText('{{RETURN_HOUR}}', transaction.return_hour || '');
      body.replaceText('{{TOTAL_AMOUNT_TTC}}', String(transaction.total_amount_ttc) + ' €');
      body.replaceText('{{TOTAL}}', String(transaction.total_amount_ttc) + ' €');
      body.replaceText('{{TOTAL_DEPOSIT_AMOUNT}}', String(transaction.total_deposit_amount) + ' €');
      body.replaceText('{{ITEMS}}', itemLines);
      doc.saveAndClose();
      return { id: file.getId(), name: file.getName(), url: file.getUrl() };
    }

    var lines = [
      'Contrat ' + transaction.contract_number,
      'Client: ' + transaction.client_first_name + ' ' + transaction.client_last_name,
      'Telephone: ' + (transaction.client_phone || ''),
      'Email: ' + (transaction.client_email || ''),
      'Adresse: ' + (transaction.client_address || ''),
      'Code postal / Ville: ' + (transaction.client_zipcity || ''),
      'Retrait: ' + RacsorUtils.toContractDate(transaction.pickup_date) + ' ' + (transaction.pickup_hour || ''),
      'Retour: ' + RacsorUtils.toContractDate(transaction.return_date) + ' ' + (transaction.return_hour || ''),
      '',
      'Produits:',
      buildItemLines_(items),
      '',
      'Montant TTC: ' + transaction.total_amount_ttc + ' €',
      'Caution: ' + transaction.total_deposit_amount + ' €'
    ].join('\n');
    var blob = Utilities.newBlob(lines, 'text/plain', fileName + '.txt');
    var textFile = folder.createFile(blob);
    return { id: textFile.getId(), name: textFile.getName(), url: textFile.getUrl() };
  }

  function buildItemLines_(items) {
    return items.map(function (item) {
      var ruleDetail = item.pricing_label_snapshot || item.pricing_rule_code || '';
      var dayDetail = item.pricing_rule_code === 'WEEKEND' ? '' : ' x nombre de jours: ' + item.charged_days;
      return item.product_label_snapshot
        + ' -> Qté: ' + item.quantity
        + ' x forfait TTC: ' + ruleDetail + ' (' + item.unit_price_ttc + ' €)'
        + dayDetail
        + ' x total: ' + item.line_amount_ttc + ' €';
    }).join('\n');
  }

  function saveSignedDocument(transaction, filePayload) {
    var folder = getFolderSafe_(transaction.drive_folder_id);
    if (!folder) {
      folder = ensureContractFolder(transaction.folder_name);
      folder = folder.id ? getFolderSafe_(folder.id) : null;
    }
    if (!folder) {
      throw new Error('Dossier Drive du contrat introuvable ou inaccessible.');
    }
    var contentType = filePayload.mimeType || 'application/octet-stream';
    var extension = filePayload.name && filePayload.name.indexOf('.') > -1 ? filePayload.name.split('.').pop() : 'bin';
    var blob = Utilities.newBlob(Utilities.base64Decode(filePayload.base64), contentType, transaction.folder_name + '_signed.' + extension);
    var file = folder.createFile(blob);
    return { id: file.getId(), name: file.getName(), url: file.getUrl() };
  }

  function saveDocumentToContractFolder(transaction, filePayload) {
    var folder = getFolderSafe_(transaction.drive_folder_id);
    if (!folder) {
      folder = ensureContractFolder(transaction.folder_name);
      folder = folder.id ? getFolderSafe_(folder.id) : null;
    }
    if (!folder) {
      throw new Error('Dossier Drive du contrat introuvable ou inaccessible.');
    }
    var contentType = filePayload.mimeType || 'application/octet-stream';
    var fileName = filePayload.name || ('piece_' + transaction.contract_number);
    var blob = Utilities.newBlob(Utilities.base64Decode(filePayload.base64), contentType, fileName);
    var file = folder.createFile(blob);
    return { id: file.getId(), name: file.getName(), url: file.getUrl() };
  }

  function saveFinalStateSummary(transaction, items, returns) {
    var folder = getFolderSafe_(transaction.drive_folder_id);
    if (!folder) {
      folder = ensureContractFolder(transaction.folder_name);
      folder = folder.id ? getFolderSafe_(folder.id) : null;
    }
    if (!folder) {
      return { id: '', name: '', url: '' };
    }
    var fileName = transaction.folder_name + '_etatFinal.txt';
    trashExistingFilesByName_(folder, fileName);
    var lines = [
      'Contrat: ' + (transaction.contract_number || ''),
      'Client: ' + (transaction.client_full_name || ''),
      'Statut: ' + (transaction.status || ''),
      'Retrait: ' + (transaction.pickup_date ? RacsorUtils.toContractDate(transaction.pickup_date) : '') + ' ' + (transaction.pickup_hour || ''),
      'Retour: ' + (transaction.return_date ? RacsorUtils.toContractDate(transaction.return_date) : '') + ' ' + (transaction.return_hour || ''),
      'Montant TTC: ' + (transaction.total_amount_ttc || 0) + ' €',
      'Caution: ' + (transaction.total_deposit_amount || 0) + ' €',
      ''
    ];

    if (items && items.length) {
      lines.push('Produits loues:');
      items.forEach(function (item) {
        lines.push('- ' + item.product_label_snapshot + ' | Qté: ' + item.quantity);
      });
      lines.push('');
    }

    if (returns && returns.length) {
      lines.push('Etat final:');
      returns.forEach(function (entry) {
        lines.push('- ' + (entry.product_label || entry.product_id) + ' | ' + (entry.state_label || entry.state_id) + ' | Qté: ' + entry.quantity + (entry.comment ? ' | ' + entry.comment : ''));
      });
    } else {
      lines.push('Etat final: aucun detail de retour saisi.');
    }

    var blob = Utilities.newBlob(lines.join('\n'), 'text/plain', fileName);
    var file = folder.createFile(blob);
    return { id: file.getId(), name: file.getName(), url: file.getUrl() };
  }

  function saveSavClosureSummary(transaction, payload) {
    var folder = getFolderSafe_(transaction.drive_folder_id);
    if (!folder) {
      folder = ensureContractFolder(transaction.folder_name);
      folder = folder.id ? getFolderSafe_(folder.id) : null;
    }
    if (!folder) {
      return { id: '', name: '', url: '' };
    }
    var fileName = transaction.folder_name + '_cloture_sav.txt';
    trashExistingFilesByName_(folder, fileName);
    var lines = [
      'Contrat: ' + (transaction.contract_number || ''),
      'Client: ' + (transaction.client_full_name || ''),
      'Statut final: ' + (transaction.status || ''),
      'Caution remboursee: ' + (payload.refund_amount || 0) + ' €',
      'Motif: ' + (payload.reason || ''),
      'Commentaire SAV: ' + (payload.comment || ''),
      payload.ticket_file_url ? 'Ticket de caisse: ' + payload.ticket_file_url : ''
    ].filter(Boolean);
    var blob = Utilities.newBlob(lines.join('\n'), 'text/plain', fileName);
    var file = folder.createFile(blob);
    return { id: file.getId(), name: file.getName(), url: file.getUrl() };
  }

  function getFolderSafe_(folderId) {
    if (!folderId) {
      return null;
    }
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      return null;
    }
  }

  function getOrCreateDefaultRootFolder_() {
    var iterator = DriveApp.getFoldersByName('RacsoR_Contrats');
    return iterator.hasNext() ? iterator.next() : DriveApp.createFolder('RacsoR_Contrats');
  }

  function getFileSafe_(fileId) {
    if (!fileId) {
      return null;
    }
    try {
      return DriveApp.getFileById(fileId);
    } catch (error) {
      return null;
    }
  }

  function trashExistingFilesByName_(folder, fileName) {
    var iterator = folder.getFilesByName(fileName);
    while (iterator.hasNext()) {
      iterator.next().setTrashed(true);
    }
  }

  return {
    ensureContractFolder: ensureContractFolder,
    createGeneratedContractFile: createGeneratedContractFile,
    saveSignedDocument: saveSignedDocument,
    saveDocumentToContractFolder: saveDocumentToContractFolder,
    saveFinalStateSummary: saveFinalStateSummary,
    saveSavClosureSummary: saveSavClosureSummary,
    getFolderSafe_: getFolderSafe_,
    getFileSafe_: getFileSafe_
  };
})();
