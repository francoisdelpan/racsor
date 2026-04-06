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
    var pickupStart = RacsorUtils.combineDateAndTime(transaction.pickup_date, transaction.pickup_hour || '09:00');
    var pickupEnd = new Date(pickupStart.getTime() + (30 * 60 * 1000));
    var returnStart = RacsorUtils.combineDateAndTime(transaction.return_date, transaction.return_hour || '09:00');
    var returnEnd = new Date(returnStart.getTime() + (30 * 60 * 1000));
    var pickupEvent = calendar.createEvent(
      '[Retrait] ' + transaction.contract_number + ' - ' + transaction.client_full_name,
      pickupStart,
      pickupEnd,
      { description: description }
    );
    var returnEvent = calendar.createEvent(
      '[Retour] ' + transaction.contract_number + ' - ' + transaction.client_full_name,
      returnStart,
      returnEnd,
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
