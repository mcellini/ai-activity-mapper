/**
 * AI Activity Mapper (v4) - backend su Google Sheets.
 * Deploy: Estensioni > Apps Script > incolla questo file >
 * Deploy > Nuova distribuzione > App web (Esegui come: te, Accesso: chiunque).
 * Poi incolla l'URL /exec nelle impostazioni dell'app.
 * Fogli scritti: AppData (JSON grezzo), Attivita, Blocker, MicroTool, Persone, Clienti, Misurato.
 */
function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function doGet() {
  var raw = getSheet_("AppData").getRange("A1").getValue();
  var state = raw ? JSON.parse(raw) : null;
  return json_({ ok: true, state: state });
}

function doPost(e) {
  try {
    var state = JSON.parse(e.postData.contents);
    getSheet_("AppData").getRange("A1").setValue(JSON.stringify(state));
    writeActivities_(state);
    writeBlockers_(state);
    writeTools_(state);
    writePeople_(state);
    writeClients_(state);
    writeActuals_(state);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function names_(items, ids) {
  return (items || []).filter(function (x) { return ids.indexOf(x.id) >= 0; })
    .map(function (x) { return x.name; });
}

function linked_(items, activityId) {
  return (items || []).filter(function (x) { return x.activityIds.indexOf(activityId) >= 0; })
    .map(function (x) { return x.name; }).join(" | ");
}

function writeTable_(sheetName, head, rows) {
  var sh = getSheet_(sheetName);
  sh.clear();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  sh.setFrozenRows(1);
}

function writeActivities_(state) {
  var head = ["Team", "Attivita", "Tipo lavoro", "Ore manuali", "Ore liberate (automation)",
              "Ore reinvestite (augmentation)", "Destinazione ore liberate", "Confidenza",
              "Potenziale residuo ore", "Automatizzabile %", "Aumentabile %", "Umano %",
              "Complessita", "Rischio", "Controllo umano", "Tool", "Dipendenze", "Note",
              "Blocker", "Micro-tool", "Area", "Esecuzioni al mese", "Ore per esecuzione", "Micro-task"];
  var rows = (state.activities || []).map(function (a) {
    var potential = a.hoursManual * (a.pctAutomatable + a.pctAugmentable) / 100;
    var residual = Math.max(0, potential - a.hoursFreed - a.hoursReinvested);
    return [a.teamId, a.name, a.workType, a.hoursManual, a.hoursFreed, a.hoursReinvested,
            a.destination, a.confidence, Math.round(residual * 10) / 10,
            a.pctAutomatable, a.pctAugmentable,
            Math.max(0, 100 - a.pctAutomatable - a.pctAugmentable),
            a.complexity, a.riskLevel, a.humanControl, a.tools, a.dependencies, a.notes,
            linked_(state.blockers, a.id), linked_(state.microTools, a.id),
            a.area || "delivery", a.runsPerMonth || 0, a.hoursPerRun || 0,
            (a.subtasks || []).map(function (s) { return s.name + " (" + s.hours + "h, " + s.treatment + ")"; }).join(" | ")];
  });
  writeTable_("Attivita", head, rows);
}

function writeBlockers_(state) {
  var head = ["Blocker", "Tipo", "Gravita", "Owner", "Attivita collegate", "Cosa serve", "Costo una tantum EUR"];
  var rows = (state.blockers || []).map(function (b) {
    return [b.name, b.kind, b.severity, b.owner, names_(state.activities, b.activityIds).join(" | "), b.need || "altro", b.cost || 0];
  });
  writeTable_("Blocker", head, rows);
}

function writeTools_(state) {
  var head = ["Micro-tool", "Stato", "Utenti attivi", "Costo mensile EUR", "Owner", "Descrizione", "Attivita collegate", "Tipo", "Quando gira", "Cadenza", "Cosa fa di nuovo"];
  var rows = (state.microTools || []).map(function (t) {
    return [t.name, t.status, t.users, t.monthlyCost, t.owner, t.description, names_(state.activities, t.activityIds).join(" | "), t.kind || "one_shot", t.schedule || "", t.cadence || "on_demand", t.newTask || ""];
  });
  writeTable_("MicroTool", head, rows);
}

function writePeople_(state) {
  var head = ["Persona", "Team", "Seniority", "Ore/mese su attivita mappate", "Uso AI % del tempo"];
  var rows = (state.people || []).map(function (p) { return [p.name, p.teamId, p.seniority, p.hours, p.aiShare === null || p.aiShare === undefined ? "" : p.aiShare]; });
  writeTable_("Persone", head, rows);
}

function writeClients_(state) {
  var head = ["Cliente", "Stato", "Probabilita 2027 %", "SEO h", "Content h", "PR h", "Social h", "Design h"];
  var rows = (state.clients || []).map(function (c) {
    var h = c.hoursByTeam || {};
    return [c.name, c.status, c.probability, h.seo || 0, h.content || 0, h.pr || 0, h.social || 0, h.design || 0];
  });
  writeTable_("Clienti", head, rows);
}

function writeActuals_(state) {
  var head = ["Attivita", "Mese", "Ore reali", "Baseline", "Atteso con AI", "Scarto vs atteso"];
  var rows = [];
  (state.activities || []).forEach(function (a) {
    var months = (state.actuals || {})[a.id] || {};
    Object.keys(months).sort().forEach(function (m) {
      var expected = Math.max(0, a.hoursManual - a.hoursFreed);
      rows.push([a.name, m, months[m], a.hoursManual, expected, months[m] - expected]);
    });
  });
  writeTable_("Misurato", head, rows);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
