var RacsorNotificationService = (function () {
  function getAlertRecipients() {
    return RacsorRepository.findBy(RacsorConfig.SHEETS.USERS, function (user) {
      return String(user.is_active) !== 'false' && String(user.get_alert) === 'true';
    }).map(function (user) {
      return user.email;
    }).filter(Boolean);
  }

  function sendMail(subject, body) {
    var recipients = getAlertRecipients();
    if (!recipients.length) {
      return;
    }
    MailApp.sendEmail(recipients.join(','), subject, body);
  }

  function runDailyChecks() {
    var today = RacsorUtils.toDateOnlyString(new Date());
    var contracts = RacsorRepository.getAll(RacsorConfig.SHEETS.TRANSACTIONS);
    var lateContracts = [];
    contracts.forEach(function (contract) {
      if (['cancelled', 'closed', 'returned'].indexOf(contract.status) !== -1) {
        return;
      }
      if (contract.return_date < today) {
        if (contract.status !== 'late') {
          RacsorRepository.updateById(RacsorConfig.SHEETS.TRANSACTIONS, 'id', contract.id, {
            status: 'late',
            updated_at: RacsorUtils.nowIso()
          });
          RacsorLogService.log('MARK_LATE', 'transaction', contract.id, { contract_number: contract.contract_number });
        }
        lateContracts.push(contract);
      }
    });

    if (lateContracts.length) {
      sendMail(
        '[RacsoR] Contrats en retard',
        lateContracts.map(function (contract) {
          return contract.contract_number + ' - ' + contract.client_full_name + ' - retour prevu le ' + contract.return_date;
        }).join('\n')
      );
    }

    var incidents = contracts.filter(function (contract) {
      return contract.status === 'incident';
    });
    if (incidents.length) {
      sendMail(
        '[RacsoR] Incidents ouverts',
        incidents.map(function (contract) {
          return contract.contract_number + ' - ' + contract.client_full_name;
        }).join('\n')
      );
    }

    return {
      lateCount: lateContracts.length,
      incidentCount: incidents.length
    };
  }

  return {
    runDailyChecks: runDailyChecks
  };
})();
