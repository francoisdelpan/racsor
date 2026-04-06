var RacsorLogService = (function () {
  function log(action, entityType, entityId, details) {
    var user = '';
    try {
      user = Session.getActiveUser().getEmail();
    } catch (error) {
      user = '';
    }
    RacsorRepository.append(RacsorConfig.SHEETS.LOGS, [{
      timestamp: RacsorUtils.nowIso(),
      user_email: user,
      action: action,
      entity_type: entityType || '',
      entity_id: entityId || '',
      details: details ? JSON.stringify(details) : ''
    }]);
  }

  return {
    log: log
  };
})();
