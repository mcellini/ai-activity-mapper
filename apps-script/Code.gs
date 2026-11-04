/**
 * AI Activity Mapper — backend su Google Sheets + Drive.
 *
 * Deploy: il file va incollato in un Apps Script collegato al foglio
 * (Estensioni > Apps Script). Esegui come: te. Accesso: Chiunque.
 * «Chiunque» serve solo perché il browser possa chiamare l'URL.
 * Ogni POST deve portare la password nel corpo (proprietà APP_PASSWORD).
 * doGet non accetta la password nell'indirizzo e risponde con un errore.
 *
 * Proprietà dello script (Impostazioni progetto > Proprietà dello script):
 *   APP_PASSWORD   password condivisa del team
 *
 * Sorgente dei dati: foglio Entita, una riga per elemento (niente JSON unico in A1).
 * I fogli Attivita, Blocker, MicroTool, Persone, Clienti, Misurato sono report
 * e si aggiornano al massimo una volta al minuto, oppure subito su snapshot e ripristino.
 * Lo storico esplicito è una serie di file JSON nella cartella Drive «AI Activity Mapper/Storico».
 */
var REPORT_INTERVAL_MS = 60 * 1000;
var MAX_HISTORY = 30;
var CELL_LIMIT = 45000;

var TEAMS = ["seo", "content", "pr", "social", "design"];
var WORK = ["analisi", "scrittura", "creativita", "relazione", "produzione", "strategia"];
var AREAS = ["delivery", "gare", "rnd"];
var DESTS = ["nuovi_servizi", "qualita", "capacita_clienti", "non_allocata"];
var CONF = ["stima", "misurato", "validato"];
var COMPLEX = ["low", "medium", "high"];
var RISK = ["nd", "basso", "medio", "alto"];
var TREAT = ["umano", "automazione", "augmentation", "nuovo"];
var BKIND = ["dati", "tool", "competenze", "processo", "cliente"];
var SEV = ["bassa", "media", "alta"];
var NEED = ["connettore", "account", "formazione", "budget", "dati", "processo", "altro"];
var TSTATUS = ["idea", "prototipo", "in_uso", "adottato"];
var TKIND = ["one_shot", "ricorrente", "agente"];
var CAD = ["on_demand", "giornaliera", "settimanale", "mensile"];
var SEN = ["junior", "mid", "senior", "lead"];
var CSTAT = ["attivo", "gara", "prospect"];

function doGet() {
  return json_({ ok: false, error: "La lettura avviene con POST: la password va nel corpo, non nell'indirizzo." });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    checkPassword_(body && body.password);
    var actor = "";
    if (body.action === "pull") return json_(withLock_(pull_));
    if (body.action === "push") return json_(withLock_(function () { return push_(body, actor); }));
    if (body.action === "snapshot") return json_(withLock_(function () { return snapshot_(body, actor); }));
    if (body.action === "listSnapshots") return json_(withLock_(listSnapshots_));
    if (body.action === "restore") return json_(withLock_(function () { return restore_(body, actor); }));
    return json_({ ok: false, error: "Azione sconosciuta" });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

var PW_FAILS = "aam-pw-fails";
var PW_LOCK_SECONDS = 180;

function checkPassword_(given) {
  var expected = String(PropertiesService.getScriptProperties().getProperty("APP_PASSWORD") || "");
  if (!expected) throw new Error("Manca APP_PASSWORD nelle proprietà dello script");
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get(PW_FAILS) || "0");
  if (fails >= 10) throw new Error("Troppi tentativi falliti. Riprova tra qualche minuto.");
  if (!constantEquals_(String(given || ""), expected)) {
    Utilities.sleep(Math.min(8, fails + 1) * 250);
    cache.put(PW_FAILS, String(fails + 1), PW_LOCK_SECONDS);
    throw new Error("Password non corretta");
  }
  cache.remove(PW_FAILS);
}

function constantEquals_(given, expected) {
  var len = Math.max(given.length, expected.length);
  var diff = given.length === expected.length ? 0 : 1;
  for (var i = 0; i < len; i++) {
    var a = i < given.length ? given.charCodeAt(i) : 0;
    var b = i < expected.length ? expected.charCodeAt(i) : 0;
    diff |= a ^ b;
  }
  return diff === 0;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: "Un altro salvataggio è in corso, riprova" };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function pull_() {
  var doc = readDoc_();
  if (!doc.state) return { ok: true, empty: true, revision: 0 };
  var errors = validateState_(doc.state);
  if (errors.length) return { ok: false, error: "Dati non validi sul foglio: " + errors.slice(0, 3).join("; ") };
  return {
    ok: true, empty: false, revision: doc.revision, state: doc.state,
    updatedAt: doc.updatedAt, updatedBy: doc.updatedBy,
  };
}

function push_(body, email) {
  var errors = validateState_(body.state);
  if (errors.length) return { ok: false, error: "Dati non validi: " + errors.slice(0, 5).join("; ") };
  var doc = readDoc_();
  var expected = Number(body.expectedRevision || 0);
  var next;
  var merged = false;
  if (body.force) {
    if (doc.state) writeHistory_(email, "Prima di una sovrascrittura", doc);
    next = body.state;
  } else if (!doc.state && expected === 0) {
    next = body.state;
  } else if (doc.revision === expected) {
    next = body.state;
  } else if (!doc.state) {
    return conflict_({ revision: 0, state: emptyState_(), updatedAt: "", updatedBy: "" }, ["Il foglio è vuoto"]);
  } else {
    if (!body.baseState || validateState_(body.baseState).length) return conflict_(doc, ["Base locale non valida"]);
    var result = mergeState_(body.baseState, doc.state, body.state);
    if (result.conflicts.length) return conflict_(doc, result.conflicts);
    next = result.state;
    merged = true;
  }
  next = JSON.parse(JSON.stringify(next));
  next.updatedAt = new Date().toISOString();
  next.version = 6;
  var reportsAt = doc.reportsAt || "";
  if (reportsDue_(doc, !!body.force)) {
    refreshReports_(next);
    reportsAt = new Date().toISOString();
  }
  var revision = (doc.revision || 0) + 1;
  writeDoc_(revision, next, email, reportsAt);
  return { ok: true, revision: revision, state: next, updatedAt: next.updatedAt, updatedBy: email, merged: merged };
}

function snapshot_(body, email) {
  var doc = readDoc_();
  if (!doc.state) return { ok: false, error: "Niente da salvare: il foglio è vuoto" };
  var label = String(body.label || "").slice(0, 140) || defaultLabel_();
  if (reportsDue_(doc, true)) {
    refreshReports_(doc.state);
    doc.reportsAt = new Date().toISOString();
    writeDoc_(doc.revision, doc.state, doc.updatedBy || email, doc.reportsAt);
  }
  var written = writeHistory_(email, label, doc);
  return {
    ok: true,
    snapshot: { id: written.file.getId(), label: label, savedAt: written.savedAt, email: email, revision: doc.revision },
  };
}

function restore_(body, email) {
  var folder = historyFolder_();
  var file;
  try {
    file = DriveApp.getFileById(String(body.fileId || ""));
  } catch (err) {
    return { ok: false, error: "Snapshot non trovato" };
  }
  if (!fileInFolder_(file, folder)) return { ok: false, error: "Snapshot non trovato" };
  var data;
  try {
    data = JSON.parse(file.getBlob().getDataAsString());
  } catch (err) {
    return { ok: false, error: "Snapshot illeggibile" };
  }
  var errors = validateState_(data.state);
  if (errors.length) return { ok: false, error: "Snapshot non valido: " + errors.slice(0, 3).join("; ") };
  var doc = readDoc_();
  var expected = Number(body.expectedRevision || 0);
  if (!body.force && doc.revision !== expected) return conflict_(doc, ["Il foglio è cambiato"]);
  if (doc.state) writeHistory_(email, "Prima del ripristino", doc);
  var next = JSON.parse(JSON.stringify(data.state));
  next.updatedAt = new Date().toISOString();
  next.version = 6;
  refreshReports_(next);
  var revision = (doc.revision || 0) + 1;
  writeDoc_(revision, next, email, new Date().toISOString());
  return { ok: true, revision: revision, state: next, updatedAt: next.updatedAt, updatedBy: email };
}

function listSnapshots_() {
  var folder = historyFolder_();
  var files = folder.getFiles();
  var out = [];
  while (files.hasNext()) {
    var file = files.next();
    if (!/\.json$/.test(file.getName())) continue;
    try {
      var data = JSON.parse(file.getBlob().getDataAsString());
      out.push({
        id: file.getId(),
        label: String(data.label || file.getName()),
        savedAt: String(data.savedAt || file.getDateCreated().toISOString()),
        email: String(data.email || ""),
        revision: Number(data.revision || 0),
      });
    } catch (err) { /* file danneggiato: si salta */ }
  }
  out.sort(function (a, b) { return a.savedAt < b.savedAt ? 1 : -1; });
  return { ok: true, snapshots: out };
}

function conflict_(doc, conflicts) {
  return {
    ok: false,
    conflict: true,
    conflicts: conflicts || [],
    revision: doc.revision || 0,
    state: doc.state,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
  };
}

function reportsDue_(doc, force) {
  if (force || !doc.reportsAt) return true;
  var then = new Date(doc.reportsAt).getTime();
  if (!then) return true;
  return Date.now() - then >= REPORT_INTERVAL_MS;
}

function defaultLabel_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Europe/Rome", "dd/MM/yyyy HH:mm");
}

/* ---------- unione per id (stessa regola di src/lib/merge.ts) ---------- */

function mergeState_(base, server, client) {
  var conflicts = [];
  var state = {
    version: 6,
    example: mergeFlag_(base, server, client, conflicts),
    updatedAt: server.updatedAt,
    activities: mergeById_("Attività", base.activities, server.activities, client.activities, conflicts),
    tasks: mergeById_("Task", base.tasks, server.tasks, client.tasks, conflicts),
    blockers: mergeById_("Blocker", base.blockers, server.blockers, client.blockers, conflicts),
    microTools: mergeById_("Micro-tool", base.microTools, server.microTools, client.microTools, conflicts),
    people: mergeById_("Persona", base.people, server.people, client.people, conflicts),
    clients: mergeById_("Cliente", base.clients, server.clients, client.clients, conflicts),
    workflows: mergeById_("Workflow", base.workflows, server.workflows, client.workflows, conflicts),
    actuals: mergeActuals_(base.actuals || {}, server.actuals || {}, client.actuals || {}, conflicts),
    settings: mergeSettings_(base.settings, server.settings, client.settings, conflicts),
  };
  return { state: state, conflicts: conflicts };
}

function mergeFlag_(base, server, client, conflicts) {
  var b = !!base.example, s = !!server.example, c = !!client.example;
  if (c !== b && s !== b && c !== s) { conflicts.push("Dati di esempio"); return s; }
  return c !== b ? c : s;
}

function mergeSettings_(base, server, client, conflicts) {
  var b = stable_(base), s = stable_(server), c = stable_(client);
  if (c !== b && s !== b && c !== s) { conflicts.push("Impostazioni"); return server; }
  return c !== b ? client : server;
}

function mergeActuals_(base, server, client, conflicts) {
  var ids = {};
  Object.keys(base).concat(Object.keys(server), Object.keys(client)).forEach(function (id) { ids[id] = true; });
  var out = {};
  Object.keys(ids).forEach(function (id) {
    var bs = stable_(base[id]), ss = stable_(server[id]), cs = stable_(client[id]);
    if (cs !== bs && ss !== bs && cs !== ss) {
      conflicts.push("Ore reali «" + id + "»");
      if (server[id]) out[id] = server[id];
      return;
    }
    var chosen = cs !== bs ? client[id] : server[id];
    if (chosen && Object.keys(chosen).length) out[id] = chosen;
  });
  return out;
}

function mergeById_(label, base, server, client, conflicts) {
  base = base || []; server = server || []; client = client || [];
  var bm = index_(base), sm = index_(server), cm = index_(client);
  var chosen = {};
  var ids = {};
  Object.keys(bm).concat(Object.keys(sm), Object.keys(cm)).forEach(function (id) { ids[id] = true; });
  Object.keys(ids).forEach(function (id) {
    var b = bm[id], s = sm[id], c = cm[id];
    var bs = stable_(b), ss = stable_(s), cs = stable_(c);
    if (cs !== bs && ss !== bs && cs !== ss) {
      conflicts.push(label + " «" + nameOf_(c || s || b) + "»");
      if (s) chosen[id] = s;
      return;
    }
    if (cs !== bs) { if (c) chosen[id] = c; return; }
    if (s) chosen[id] = s;
  });
  var out = [], seen = {};
  server.concat(client).forEach(function (item) {
    if (chosen[item.id] && !seen[item.id]) {
      out.push(chosen[item.id]);
      seen[item.id] = true;
    }
  });
  return out;
}

function index_(list) {
  var map = {};
  (list || []).forEach(function (item) { if (item && item.id) map[item.id] = item; });
  return map;
}

function nameOf_(item) {
  if (!item) return "";
  return (item.name && String(item.name).trim()) || item.id || "";
}

function stable_(value) {
  return JSON.stringify(sort_(value));
}

function sort_(value) {
  if (Object.prototype.toString.call(value) === "[object Array]") return value.map(sort_);
  if (value && typeof value === "object") {
    var out = {};
    Object.keys(value).sort().forEach(function (key) { out[key] = sort_(value[key]); });
    return out;
  }
  return value;
}

/* ---------- validazione (stessi vincoli di src/lib/validate.ts) ---------- */

function validateState_(state) {
  var errors = [];
  function push(message) { if (errors.length < 30) errors.push(message); }
  if (!state || typeof state !== "object" || isArray_(state)) return ["Lo stato non è un oggetto"];
  if (state.version !== 6 && state.version !== 5) push("Versione non supportata (attesa la 6)");
  if (state.version === 6) checkList_(state.tasks, "task", push, checkTask_);
  if (state.example !== undefined && typeof state.example !== "boolean") push("example non è un booleano");
  if (typeof state.updatedAt !== "string") push("Manca updatedAt");
  checkList_(state.activities, "attività", push, checkActivity_);
  checkList_(state.workflows, "workflow", push, checkWorkflow_);
  checkList_(state.blockers, "blocker", push, checkBlocker_);
  checkList_(state.microTools, "micro-tool", push, checkTool_);
  checkList_(state.people, "persona", push, checkPerson_);
  checkList_(state.clients, "cliente", push, checkClient_);
  if (!state.actuals || typeof state.actuals !== "object" || isArray_(state.actuals)) push("actuals non è un oggetto");
  else {
    Object.keys(state.actuals).forEach(function (id) {
      var months = state.actuals[id];
      if (!months || typeof months !== "object" || isArray_(months)) { push("Ore reali di " + id + " non valide"); return; }
      Object.keys(months).forEach(function (month) {
        if (!/^\d{4}-\d{2}$/.test(month) || !isNum_(months[month], 0, 1e12)) push("Ore reali non valide per " + id);
      });
    });
  }
  if (!state.settings || !isNum_(state.settings.hourlyCost, 0, 1e12) || !isNum_(state.settings.worstThreshold, 0, 100)) {
    push("Impostazioni non valide");
  }
  return errors;
}

function checkList_(list, kind, push, each) {
  if (!isArray_(list)) { push(kind + " non è una lista"); return; }
  var seen = {};
  list.forEach(function (item, i) {
    var label = kind + " #" + (i + 1);
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim()) {
      push(label + ": manca l'id");
      return;
    }
    if (seen[item.id]) push(label + ": id duplicato");
    seen[item.id] = true;
    each(item, kind + " «" + (item.name || item.id) + "»", push);
  });
}

function checkTask_(t, label, push) {
  if (typeof t.activityId !== "string" || !t.activityId) push(label + ": attività mancante");
  if (typeof t.name !== "string" || typeof t.notes !== "string" || typeof t.tools !== "string" || typeof t.owner !== "string") {
    push(label + ": campi di testo mancanti");
  }
  if (!has_(TEAMS, t.teamId) || !has_(TREAT, t.treatment)) push(label + ": team o trattamento non valido");
  if (!isNum_(t.hours, 0, 1e9) || !isNum_(t.pctSaved, 0, 100) || !isNum_(t.runsPerMonth, 0, 1e9) || !isNum_(t.order, 0, 1e9)) {
    push(label + ": numeri non validi");
  }
}

function checkActivity_(a, label, push) {
  if (!has_(TEAMS, a.teamId)) push(label + ": team non valido");
  if (typeof a.name !== "string") push(label + ": nome mancante");
  if (!has_(WORK, a.workType) || !has_(AREAS, a.area) || !has_(DESTS, a.destination)) push(label + ": classificazione non valida");
  if (!has_(CONF, a.confidence) || !has_(COMPLEX, a.complexity) || !has_(RISK, a.riskLevel)) push(label + ": classificazione non valida");
  ["runsPerMonth", "hoursPerRun", "hoursManual", "hoursFreed", "hoursReinvested"].forEach(function (key) {
    if (!isNum_(a[key], 0, 1e9)) push(label + ": " + key + " non valido");
  });
  if (!isNum_(a.pctAutomatable, 0, 100) || !isNum_(a.pctAugmentable, 0, 100)) push(label + ": percentuali non valide");
  if (typeof a.humanControl !== "string" || typeof a.tools !== "string" || typeof a.dependencies !== "string" || typeof a.notes !== "string") {
    push(label + ": campi di testo mancanti");
  }
  if (!isStringList_(a.dependsOn)) push(label + ": dependsOn non valido");
  if (!isArray_(a.subtasks)) push(label + ": subtasks mancanti");
  else a.subtasks.forEach(function (s) {
    if (!s || typeof s.id !== "string" || typeof s.name !== "string" || !has_(TREAT, s.treatment)) push(label + ": micro-task non valido");
    else if (!isNum_(s.hours, 0, 1e9) || !isNum_(s.pctSaved, 0, 100)) push(label + ": micro-task non valido");
  });
}

function checkWorkflow_(w, label, push) {
  if (typeof w.name !== "string") push(label + ": nome mancante");
  if (!isArray_(w.steps)) { push(label + ": steps mancanti"); return; }
  w.steps.forEach(function (s) {
    if (!s || typeof s.id !== "string" || typeof s.name !== "string") { push(label + ": passo non valido"); return; }
    if (!isArray_(s.teams) || s.teams.some(function (t) { return !has_(TEAMS, t); })) push(label + ": team del passo non validi");
    if (typeof s.tools !== "string" || typeof s.automationNote !== "string" || typeof s.augmentationNote !== "string" || typeof s.dependencies !== "string") {
      push(label + ": passo incompleto");
    }
  });
}

function checkBlocker_(b, label, push) {
  if (typeof b.name !== "string" || typeof b.owner !== "string") push(label + ": nome o owner mancante");
  if (!has_(BKIND, b.kind) || !has_(SEV, b.severity) || !has_(NEED, b.need)) push(label + ": classificazione non valida");
  if (!isNum_(b.cost, 0, 1e12)) push(label + ": costo non valido");
  if (!isStringList_(b.activityIds)) push(label + ": activityIds non valido");
}

function checkTool_(t, label, push) {
  ["name", "description", "schedule", "newTask", "owner"].forEach(function (key) {
    if (typeof t[key] !== "string") push(label + ": campo " + key + " mancante");
  });
  if (!has_(TSTATUS, t.status) || !has_(TKIND, t.kind) || !has_(CAD, t.cadence)) push(label + ": classificazione non valida");
  if (!isNum_(t.users, 0, 1e9) || !isNum_(t.monthlyCost, 0, 1e12)) push(label + ": utenti o costo non validi");
  if (!isStringList_(t.activityIds)) push(label + ": activityIds non valido");
}

function checkPerson_(p, label, push) {
  if (typeof p.name !== "string") push(label + ": nome mancante");
  if (!has_(TEAMS, p.teamId) || !has_(SEN, p.seniority)) push(label + ": team o seniority non validi");
  if (!isNum_(p.hours, 0, 1e9)) push(label + ": ore non valide");
  if (!(p.aiShare === null || isNum_(p.aiShare, 0, 100))) push(label + ": uso AI non valido");
}

function checkClient_(c, label, push) {
  if (typeof c.name !== "string") push(label + ": nome mancante");
  if (!has_(CSTAT, c.status) || !isNum_(c.probability, 0, 100)) push(label + ": stato o probabilità non validi");
  if (!c.hoursByTeam || typeof c.hoursByTeam !== "object") { push(label + ": hoursByTeam mancante"); return; }
  TEAMS.forEach(function (team) {
    if (!isNum_(c.hoursByTeam[team], 0, 1e9)) push(label + ": ore " + team + " non valide");
  });
}

function has_(list, value) { return list.indexOf(value) >= 0; }
function isArray_(value) { return Object.prototype.toString.call(value) === "[object Array]"; }
function isStringList_(value) {
  return isArray_(value) && value.every(function (item) { return typeof item === "string"; });
}
function isNum_(value, min, max) {
  return typeof value === "number" && isFinite(value) && value >= min && value <= max;
}

/* ---------- foglio Entita: una riga per elemento ---------- */

function readDoc_() {
  var sh = getSheet_("Entita");
  var values = sh.getDataRange().getValues();
  var doc = { revision: 0, updatedAt: "", updatedBy: "", reportsAt: "", example: false, state: null };
  if (!values || values.length < 2) return doc;
  var buckets = { activity: [], task: [], workflow: [], blocker: [], microTool: [], person: [], client: [] };
  var actuals = {};
  var settings = null;
  for (var i = 1; i < values.length; i++) {
    var kind = String(values[i][0] || "");
    var id = String(values[i][1] || "");
    if (!values[i][2]) continue;
    var parsed;
    try { parsed = JSON.parse(values[i][2]); } catch (err) { continue; }
    if (kind === "meta" && id === "root") {
      doc.revision = Number(parsed.revision || 0);
      doc.updatedAt = parsed.updatedAt || "";
      doc.updatedBy = parsed.updatedBy || "";
      doc.reportsAt = parsed.reportsAt || "";
      doc.example = !!parsed.example;
      doc.version = parsed.version;
    } else if (buckets[kind]) buckets[kind].push(parsed);
    else if (kind === "actual") actuals[id] = parsed;
    else if (kind === "settings") settings = parsed;
  }
  if (!doc.revision) return doc;
  doc.example = doc.example;
  doc.state = {
    version: Number(doc.version || (buckets.task.length ? 6 : 5)),
    example: doc.example,
    updatedAt: doc.updatedAt,
    activities: buckets.activity,
    tasks: buckets.task,
    workflows: buckets.workflow,
    blockers: buckets.blocker,
    microTools: buckets.microTool,
    people: buckets.person,
    clients: buckets.client,
    actuals: actuals,
    settings: settings || { hourlyCost: 40, worstThreshold: 80 },
  };
  return doc;
}

function writeDoc_(revision, state, email, reportsAt) {
  var rows = [["Kind", "Id", "Json"]];
  rows.push(["meta", "root", JSON.stringify({
    revision: revision,
    updatedAt: state.updatedAt,
    updatedBy: email,
    reportsAt: reportsAt || "",
    example: !!state.example,
    version: state.version || 6,
  })]);
  pushKind_(rows, "activity", state.activities);
  pushKind_(rows, "task", state.tasks);
  pushKind_(rows, "workflow", state.workflows);
  pushKind_(rows, "blocker", state.blockers);
  pushKind_(rows, "microTool", state.microTools);
  pushKind_(rows, "person", state.people);
  pushKind_(rows, "client", state.clients);
  Object.keys(state.actuals || {}).forEach(function (id) {
    rows.push(["actual", id, cell_(JSON.stringify(state.actuals[id]), "ore " + id)]);
  });
  rows.push(["settings", "main", cell_(JSON.stringify(state.settings), "impostazioni")]);
  var sh = getSheet_("Entita");
  sh.clear();
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.setFrozenRows(1);
}

function pushKind_(rows, kind, list) {
  (list || []).forEach(function (item) {
    rows.push([kind, item.id, cell_(JSON.stringify(item), kind + " " + item.id)]);
  });
}

function cell_(text, label) {
  if (text.length > CELL_LIMIT) throw new Error("L'elemento " + label + " supera il limite di una cella");
  return text;
}

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/* ---------- storico su Drive ---------- */

function appFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("DRIVE_FOLDER_ID");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* ricrea */ }
  }
  var folder = DriveApp.createFolder("AI Activity Mapper");
  props.setProperty("DRIVE_FOLDER_ID", folder.getId());
  return folder;
}

function historyFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("HISTORY_FOLDER_ID");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* ricrea */ }
  }
  var folder = appFolder_().createFolder("Storico");
  props.setProperty("HISTORY_FOLDER_ID", folder.getId());
  return folder;
}

function writeHistory_(email, label, doc) {
  var savedAt = new Date().toISOString();
  var payload = {
    savedAt: savedAt,
    email: email,
    label: label,
    revision: doc.revision,
    state: doc.state,
  };
  var folder = historyFolder_();
  var file = folder.createFile(
    "snapshot-" + savedAt.replace(/[:.]/g, "-") + ".json",
    JSON.stringify(payload),
    MimeType.PLAIN_TEXT
  );
  pruneHistory_(folder);
  return { file: file, savedAt: savedAt };
}

function emptyState_() {
  return {
    version: 6, example: false, updatedAt: new Date().toISOString(),
    activities: [], tasks: [], workflows: [], blockers: [], microTools: [], people: [], clients: [],
    actuals: {}, settings: { hourlyCost: 40, worstThreshold: 80 },
  };
}

function pruneHistory_(folder) {
  var files = folder.getFiles();
  var list = [];
  while (files.hasNext()) list.push(files.next());
  list.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  for (var i = MAX_HISTORY; i < list.length; i++) list[i].setTrashed(true);
}

function fileInFolder_(file, folder) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) return true;
  }
  return false;
}

/* ---------- fogli di report, aggiornati meno spesso della sorgente ---------- */

function refreshReports_(state) {
  writeActivities_(state);
  writeTasks_(state);
  writeBlockers_(state);
  writeTools_(state);
  writePeople_(state);
  writeClients_(state);
  writeActuals_(state);
}

function names_(items, ids) {
  return (items || []).filter(function (x) { return ids.indexOf(x.id) >= 0; }).map(function (x) { return x.name; });
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
      (state.tasks || []).filter(function (t) { return t.activityId === a.id; }).map(function (t) { return t.name + " (" + t.hours + "h, " + t.treatment + ")"; }).join(" | ")];
  });
  writeTable_("Attivita", head, rows);
}

function writeTasks_(state) {
  var names = {};
  (state.activities || []).forEach(function (a) { names[a.id] = a.name; });
  var head = ["Attivita", "Task", "Descrizione", "Team", "Uso AI", "Ore/mese", "% risparmiata", "Esecuzioni al mese", "Tool", "Owner"];
  var rows = (state.tasks || []).map(function (t) {
    return [names[t.activityId] || t.activityId, t.name, t.notes || "", t.teamId, t.treatment, t.hours, t.pctSaved, t.runsPerMonth || 0, t.tools || "", t.owner || ""];
  });
  writeTable_("Task", head, rows);
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
  var rows = (state.people || []).map(function (p) {
    return [p.name, p.teamId, p.seniority, p.hours, p.aiShare === null || p.aiShare === undefined ? "" : p.aiShare];
  });
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
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
