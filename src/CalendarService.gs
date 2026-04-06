var RacsorCalendarService = (function () {
  function getCalendar() {
    var settings = RacsorConfig.getProjectSettings();
    if (!settings.calendarId) {
      return null;
    }
    return CalendarApp.getCalendarById(settings.calendarId);
  }

  function createContractEvents(transaction, items, folderUrl) {
    var calendar = getCalendar();
    if (!calendar) {
      return { pickupEventId: '', returnEventId: '' };
    }
    var itemSummary = items.map(function (item) {
      return item.product_label_snapshot + ' x ' + item.quantity;
    }).join(', ');
    var description = [
      'Contrat: ' + transaction.contract_number,
      'Client: ' + transaction.client_full_name,
      'Produits: ' + itemSummary,
      'Dossier: ' + folderUrl
    ].join('\n');
    var pickupEvent = calendar.createAllDayEvent(
      '[Retrait] ' + transaction.contract_number + ' - ' + transaction.client_full_name,
      RacsorUtils.parseDate(transaction.pickup_date),
      { description: description }
    );
    var returnEvent = calendar.createAllDayEvent(
      '[Retour] ' + transaction.contract_number + ' - ' + transaction.client_full_name,
      RacsorUtils.parseDate(transaction.return_date),
      { description: description }
    );
    return {
      pickupEventId: pickupEvent.getId(),
      returnEventId: returnEvent.getId()
    };
  }

  return {
    createContractEvents: createContractEvents
  };
})();
