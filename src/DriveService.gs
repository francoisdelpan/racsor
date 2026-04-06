var RacsorDriveService = (function () {
  function getRootFolder() {
    var settings = RacsorConfig.getProjectSettings();
    if (!settings.driveRootFolderId) {
      return null;
    }
    return DriveApp.getFolderById(settings.driveRootFolderId);
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
    var folder = DriveApp.getFolderById(transaction.drive_folder_id);
    var fileName = transaction.folder_name + '_autoGenerate';

    if (settings.contractTemplateId) {
      var file = DriveApp.getFileById(settings.contractTemplateId).makeCopy(fileName, folder);
      var doc = DocumentApp.openById(file.getId());
      var body = doc.getBody();
      body.replaceText('{{CONTRACT_NUMBER}}', transaction.contract_number);
      body.replaceText('{{CLIENT_NAME}}', transaction.client_full_name);
      body.replaceText('{{CLIENT_PHONE}}', transaction.client_phone || '');
      body.replaceText('{{CLIENT_EMAIL}}', transaction.client_email || '');
      body.replaceText('{{PICKUP_DATE}}', transaction.pickup_date);
      body.replaceText('{{RETURN_DATE}}', transaction.return_date);
      body.replaceText('{{TOTAL_AMOUNT_TTC}}', String(transaction.total_amount_ttc));
      body.replaceText('{{TOTAL_DEPOSIT_AMOUNT}}', String(transaction.total_deposit_amount));
      body.replaceText('{{ITEMS}}', items.map(function (item) {
        return '- ' + item.product_label_snapshot + ' x ' + item.quantity + ' : ' + item.line_amount_ttc + ' EUR TTC';
      }).join('\n'));
      doc.saveAndClose();
      return { id: file.getId(), name: file.getName(), url: file.getUrl() };
    }

    var lines = [
      'Contrat ' + transaction.contract_number,
      'Client: ' + transaction.client_full_name,
      'Telephone: ' + (transaction.client_phone || ''),
      'Email: ' + (transaction.client_email || ''),
      'Retrait: ' + transaction.pickup_date,
      'Retour: ' + transaction.return_date,
      '',
      'Produits:',
      items.map(function (item) {
        return '- ' + item.product_label_snapshot + ' x ' + item.quantity + ' : ' + item.line_amount_ttc + ' EUR TTC';
      }).join('\n'),
      '',
      'Montant TTC: ' + transaction.total_amount_ttc,
      'Caution: ' + transaction.total_deposit_amount
    ].join('\n');
    var blob = Utilities.newBlob(lines, 'text/plain', fileName + '.txt');
    var textFile = folder.createFile(blob);
    return { id: textFile.getId(), name: textFile.getName(), url: textFile.getUrl() };
  }

  function saveSignedDocument(transaction, filePayload) {
    if (!transaction.drive_folder_id) {
      throw new Error('Drive root folder non configure.');
    }
    var folder = DriveApp.getFolderById(transaction.drive_folder_id);
    var contentType = filePayload.mimeType || 'application/octet-stream';
    var extension = filePayload.name && filePayload.name.indexOf('.') > -1 ? filePayload.name.split('.').pop() : 'bin';
    var blob = Utilities.newBlob(Utilities.base64Decode(filePayload.base64), contentType, transaction.folder_name + '_signed.' + extension);
    var file = folder.createFile(blob);
    return { id: file.getId(), name: file.getName(), url: file.getUrl() };
  }

  return {
    ensureContractFolder: ensureContractFolder,
    createGeneratedContractFile: createGeneratedContractFile,
    saveSignedDocument: saveSignedDocument
  };
})();
