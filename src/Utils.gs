var RacsorUtils = (function () {
  function nowIso() {
    return new Date().toISOString();
  }

  function toDateOnlyString(value) {
    var date = value instanceof Date ? value : new Date(value);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  function toDisplayDate(value) {
    var date = value instanceof Date ? value : new Date(value);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  function toContractDate(value) {
    var date = value instanceof Date ? value : new Date(value);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MM-yyyy');
  }

  function parseDate(value) {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    var parts = String(value).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function diffDays(startDate, endDate) {
    var msPerDay = 24 * 60 * 60 * 1000;
    var start = parseDate(startDate);
    var end = parseDate(endDate);
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
  }

  function inclusiveDays(startDate, endDate) {
    return enumerateDateStrings(startDate, endDate).length;
  }

  function enumerateDateStrings(startDate, endDate) {
    var start = parseDate(startDate);
    var end = parseDate(endDate);
    var dates = [];
    var cursor = new Date(start.getTime());
    while (cursor.getTime() <= end.getTime()) {
      dates.push(toDateOnlyString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function combineDateAndTime(dateValue, timeValue) {
    var date = parseDate(dateValue);
    var time = String(timeValue || '09:00').split(':');
    date.setHours(Number(time[0] || 0), Number(time[1] || 0), 0, 0);
    return date;
  }

  function isWeekendRule(pickupDate, returnDate) {
    var start = parseDate(pickupDate);
    var end = parseDate(returnDate);
    return start.getDay() === 5 && end.getDay() === 1 && diffDays(start, end) === 3;
  }

  function createId(prefix) {
    return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
  }

  function createContractNumber(existingNumbers) {
    var today = new Date();
    var prefix = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyMMdd');
    var maxCounter = 0;
    (existingNumbers || []).forEach(function (value) {
      if (value && String(value).indexOf(prefix) === 0) {
        var num = Number(String(value).slice(6));
        if (num > maxCounter) {
          maxCounter = num;
        }
      }
    });
    return prefix + ('0' + (maxCounter + 1)).slice(-2);
  }

  function slugifyName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  function mapRows(headers, values) {
    return values.map(function (row) {
      var obj = {};
      headers.forEach(function (header, index) {
        obj[header] = row[index];
      });
      return obj;
    });
  }

  function objectToRow(headers, object) {
    return headers.map(function (header) {
      return object[header] !== undefined ? object[header] : '';
    });
  }

  function groupBy(items, key) {
    return items.reduce(function (acc, item) {
      var bucket = item[key];
      if (!acc[bucket]) {
        acc[bucket] = [];
      }
      acc[bucket].push(item);
      return acc;
    }, {});
  }

  function sum(items, selector) {
    return items.reduce(function (acc, item) {
      return acc + Number(selector(item) || 0);
    }, 0);
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return {
    nowIso: nowIso,
    parseDate: parseDate,
    toDateOnlyString: toDateOnlyString,
    toDisplayDate: toDisplayDate,
    toContractDate: toContractDate,
    diffDays: diffDays,
    inclusiveDays: inclusiveDays,
    enumerateDateStrings: enumerateDateStrings,
    combineDateAndTime: combineDateAndTime,
    isWeekendRule: isWeekendRule,
    createId: createId,
    createContractNumber: createContractNumber,
    slugifyName: slugifyName,
    mapRows: mapRows,
    objectToRow: objectToRow,
    groupBy: groupBy,
    sum: sum,
    safeJsonParse: safeJsonParse
  };
})();
