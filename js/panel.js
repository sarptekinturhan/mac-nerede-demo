/*
 * Venue panel: demo login, tick matches, edit screens/sound/capacity (M1-M2)
 * and add/delete matches that are not in the fixture list (M5, v0.3).
 * Platforms (beIN SPORTS, S Sport, TOD) decide which fixture matches can be ticked.
 * Added/deleted matches are saved immediately; ticks, platforms, venue info and reservation (v0.4) with "Kaydet".
 * v0.4: menu upload (saved immediately, like added matches) and a read-only list of "Sorun bildir" reports sent from this browser.
 * v0.5: features, campaigns and the "Öne çık" packages live in panel-extras.js.
 */
(function () {
  "use strict";
  var Logic = window.MNLogic;
  var Store = window.MNStorage;
  var FIXTURES = window.MN_MATCHES;
  var esc = Logic.escapeHtml;

  var select = document.getElementById("venue-select");
  var form = document.getElementById("venue-form");
  var checksEl = document.getElementById("match-checks");
  var screensEl = document.getElementById("screens");
  var soundEl = document.getElementById("soundOn");
  var capacityEl = document.getElementById("capacity");
  var errorEl = document.getElementById("form-error");
  var statusEl = document.getElementById("status");
  var cm = {
    league: document.getElementById("cm-league"),
    title: document.getElementById("cm-title"),
    date: document.getElementById("cm-date"),
    time: document.getElementById("cm-time"),
    broadcaster: document.getElementById("cm-broadcaster")
  };
  var platformEl = document.getElementById("platform-checks");
  var platformNote = document.getElementById("platform-note");
  var cmFormErr = document.getElementById("cm-form-err");
  var cmStatus = document.getElementById("cm-status");
  var res = {
    accepts: document.getElementById("res-accepts"),
    method: document.getElementById("res-method"),
    note: document.getElementById("res-note"),
    fields: document.getElementById("res-fields")
  };
  var menu = {
    file: document.getElementById("menu-file"),
    sample: document.getElementById("menu-sample"),
    busy: document.getElementById("menu-busy"),
    error: document.getElementById("menu-error"),
    thumbs: document.getElementById("menu-thumbs"),
    clear: document.getElementById("menu-clear")
  };
  var reportsEl = document.getElementById("reports");
  var reportsList = document.getElementById("reports-list");

  function regionLabel(id) {
    var r = window.MN_REGIONS.filter(function (x) { return x.id === id; })[0];
    return r ? r.label : id;
  }

  function venues() { return Logic.mergeOverrides(window.MN_VENUES, Store.loadOverrides(), window.MN_MENUS); }
  function selectedVenue() { return venues().filter(function (v) { return v.id === select.value; })[0]; }

  // Upcoming fixtures + this venue's own added matches, by kickoff.
  function editableMatches(v) {
    var own = (v.customMatches || []).map(function (c) { return Object.assign({ custom: true }, c); });
    return Logic.upcomingMatches(FIXTURES.concat(own), new Date());
  }

  function tickedInForm() {
    return Array.prototype.slice.call(checksEl.querySelectorAll('input[name="match"]:checked'))
      .map(function (el) { return el.value; });
  }

  function platformsInForm() {
    return Array.prototype.slice.call(platformEl.querySelectorAll('input[name="platform"]:checked'))
      .map(function (el) { return el.value; });
  }

  function renderPlatforms(platforms) {
    platformEl.innerHTML = Logic.PLATFORMS.map(function (p) {
      return '<label class="check-row"><input type="checkbox" name="platform" value="' + esc(p) + '"' +
        (platforms.indexOf(p) !== -1 ? " checked" : "") + "><span>" + esc(p) + "</span></label>";
    }).join("");
  }

  // Rows whose broadcaster is not among the venue's platforms are disabled.
  function renderChecks(v, ticked) {
    var platforms = platformsInForm();
    checksEl.innerHTML = editableMatches(v).map(function (m) {
      var allowed = Logic.canShow(platforms, m);
      var checked = allowed && ticked.indexOf(m.id) !== -1 ? " checked" : "";
      return '<div class="check-row' + (allowed ? "" : " disabled") + '"><label><input type="checkbox" name="match" value="' + esc(m.id) + '"' + checked + (allowed ? "" : " disabled") + ">" +
        "<span><strong>" + esc(Logic.matchTitle(m)) + "</strong>" + (m.custom ? ' <span class="tag">mekan ekledi</span>' : "") + "<br>" +
        "<small>" + esc(m.league) + " · " + Logic.formatKickoff(m.kickoff) + (m.broadcaster ? " · " + esc(m.broadcaster) : "") +
        (allowed ? "" : " (bu platform sende yok)") + "</small></span></label>" +
        (m.custom ? '<button type="button" class="link-btn danger" data-delete="' + esc(m.id) + '">Sil</button>' : "") + "</div>";
    }).join("");
  }

  function fillLeagueList() {
    var custom = [];
    venues().forEach(function (v) { (v.customMatches || []).forEach(function (c) { custom.push(c.league); }); });
    document.getElementById("league-list").innerHTML = Logic.leagueSuggestions(FIXTURES, custom)
      .map(function (l) { return '<option value="' + esc(l) + '"></option>'; }).join("");
  }

  function showFieldErrors(errors) {
    var first = null;
    Object.keys(cm).forEach(function (k) {
      var errEl = document.getElementById("cm-" + k + "-err");
      errEl.textContent = errors[k] || "";
      errEl.hidden = !errors[k];
      if (errors[k]) cm[k].setAttribute("aria-invalid", "true"); else cm[k].removeAttribute("aria-invalid");
      if (errors[k] && !first) first = cm[k];
    });
    cmFormErr.textContent = errors.form || "";
    cmFormErr.hidden = !errors.form;
    if (first) first.focus();
  }

  function resetAddForm() {
    Object.keys(cm).forEach(function (k) { cm[k].value = ""; });
    showFieldErrors({});
    cm.date.min = Logic.istanbulDateString(new Date());
  }

  function fillForm(v) {
    renderPlatforms(v.platforms || []);
    platformNote.textContent = "";
    renderChecks(v, v.matchIds);
    screensEl.value = v.screens;
    soundEl.checked = v.soundOn;
    capacityEl.value = v.capacity;
    fillReservation(v);
    renderMenu(v);
    menuMessage("");
    menu.busy.textContent = "";
    renderReports(v);
    errorEl.hidden = true;
    resetAddForm();
    cmStatus.textContent = "";
    fillLeagueList();
    window.MNPanelExtras.fill(v, editableMatches(v));
    form.hidden = false;
  }

  // Method and note only matter when the venue takes reservations.
  function syncReservationFields() {
    var on = res.accepts.checked;
    res.method.disabled = !on;
    res.note.disabled = !on;
    res.fields.setAttribute("aria-disabled", on ? "false" : "true");
  }

  function fillReservation(v) {
    var r = Logic.cleanReservation(v.reservation) || { accepts: false, method: null };
    res.accepts.checked = r.accepts;
    res.method.value = r.method || "";
    res.note.value = r.note || "";
    syncReservationFields();
  }

  // ---------- Menu (M7) ----------
  function menuMessage(text) {
    menu.error.textContent = text || "";
    menu.error.hidden = !text;
  }

  function renderMenu(v) {
    menu.sample.hidden = !v.menuIsSample;
    menu.clear.hidden = !v.menu.length;
    menu.thumbs.innerHTML = v.menu.map(function (src, i) {
      return '<li><img src="' + esc(src) + '" alt="Menü sayfası ' + (i + 1) + '">' +
        '<button type="button" class="link-btn danger" data-menu-remove="' + i + '">Kaldır</button></li>';
    }).join("");
  }

  function saveMenu(v, pages, okText) {
    if (!Store.saveOverride(v.id, { menu: pages })) {
      menuMessage("Kaydedilemedi: tarayıcının depolama alanı dolu veya kapalı (ör. gizli sekme). Daha az sayfa yükle ya da başka bir mekanın menüsünü kaldır.");
      return false;
    }
    renderMenu(selectedVenue());
    menu.busy.textContent = okText;
    return true;
  }

  function uploadMenu() {
    var v = selectedVenue();
    var files = menu.file.files;
    if (!v || !files.length) return;
    var current = v.menuIsSample ? [] : v.menu; // an upload replaces the sample menu
    menuMessage("");
    menu.busy.textContent = "Menü hazırlanıyor…";
    menu.file.disabled = true;
    window.MNMenuUpload.filesToPages(files, Math.max(0, Logic.MAX_MENU_PAGES - current.length)).then(function (r) {
      menu.file.disabled = false;
      menu.file.value = "";
      if (selectedVenue().id !== v.id) return; // venue changed meanwhile
      var res = Logic.addMenuPages(current, r.pages);
      var messages = r.errors.slice();
      if (res.error) messages.push(res.error);
      else if (r.skipped) messages.push("En fazla " + Logic.MAX_MENU_PAGES + " menü sayfası yüklenebilir; fazlası eklenmedi.");
      menu.busy.textContent = "";
      if (res.added && !saveMenu(v, res.pages, res.added + " sayfa eklendi.")) return;
      menuMessage(messages.join(" "));
    });
  }

  function renderReports(v) {
    var list = Logic.reportsForVenue(Store.loadReports(), v.id);
    var titles = {};
    Logic.buildViewerData(window.MN_VENUES, FIXTURES, Store.loadOverrides()).matches
      .forEach(function (m) { titles[m.id] = Logic.matchTitle(m); });
    reportsList.innerHTML = list.length
      ? '<ul class="reports-list">' + list.map(function (r) {
        return "<li><strong>" + esc(Logic.reasonLabel(r.reason)) + "</strong>" +
          (r.matchId && titles[r.matchId] ? " · " + esc(titles[r.matchId]) : "") +
          '<br><small class="meta">' + Logic.formatDateTime(r.createdAt) + "</small>" +
          (r.text ? "<br>" + esc(r.text) : "") + "</li>";
      }).join("") + "</ul>"
      : '<p class="sub">Bu cihazdan bu mekan için gönderilmiş bildirim yok.</p>';
    reportsEl.hidden = false;
  }

  function readInt(el) {
    var s = el.value.trim();
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }

  function addMatch() {
    var v = selectedVenue();
    if (!v) return;
    cmStatus.textContent = "";
    var res = Logic.validateCustomMatch({ league: cm.league.value, title: cm.title.value, date: cm.date.value, time: cm.time.value, broadcaster: cm.broadcaster.value }, new Date());
    if (!res.ok) { showFieldErrors(res.errors); return; }
    var own = v.customMatches || [];
    if (Logic.findSameMatch(res.value, FIXTURES)) {
      showFieldErrors({ form: "Bu maç zaten listede. Yukarıdan işaretleyip Kaydet'e basman yeterli." });
      return;
    }
    if (Logic.findSameMatch(res.value, own)) { showFieldErrors({ form: "Bu maçı zaten eklemişsin." }); return; }
    if (own.length >= Logic.MAX_CUSTOM) { showFieldErrors({ form: "En fazla " + Logic.MAX_CUSTOM + " maç ekleyebilirsin. Eskilerden silebilirsin." }); return; }

    var added = Object.assign({ id: Logic.newCustomId() }, res.value);
    var ticked = tickedInForm().concat(added.id); // keep unsaved ticks in the form
    var ok = Store.saveOverride(v.id, { customMatches: own.concat(added), matchIds: v.matchIds.concat(added.id) });
    if (!ok) { showFieldErrors({ form: "Kaydedilemedi: tarayıcı depolamaya izin vermiyor (ör. gizli sekme)." }); return; }
    renderChecks(selectedVenue(), ticked);
    resetAddForm();
    fillLeagueList();
    cmStatus.innerHTML = "Eklendi: " + esc(added.title) + '. <a href="index.html">İzleyici ekranında gör</a>';
  }

  function deleteMatch(id) {
    var v = selectedVenue();
    if (!v) return;
    var gone = (v.customMatches || []).filter(function (c) { return c.id === id; })[0];
    if (!gone) return;
    var ticked = tickedInForm().filter(function (x) { return x !== id; });
    Store.saveOverride(v.id, {
      customMatches: v.customMatches.filter(function (c) { return c.id !== id; }),
      matchIds: v.matchIds.filter(function (x) { return x !== id; })
    });
    renderChecks(selectedVenue(), ticked);
    fillLeagueList();
    cmStatus.textContent = "Silindi: " + gone.title;
  }

  select.innerHTML += window.MN_VENUES.map(function (v) {
    return '<option value="' + v.id + '">' + esc(v.name) + " (" + esc(regionLabel(v.region)) + ")</option>";
  }).join("");

  select.addEventListener("change", function () {
    statusEl.textContent = "";
    var v = selectedVenue();
    if (v) fillForm(v); else { form.hidden = true; reportsEl.hidden = true; window.MNPanelExtras.hide(); }
  });

  res.accepts.addEventListener("change", syncReservationFields);
  menu.file.addEventListener("change", uploadMenu);
  menu.thumbs.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-menu-remove]");
    var v = selectedVenue();
    if (!b || !v) return;
    menuMessage("");
    saveMenu(v, Logic.removeMenuPage(v.menu, parseInt(b.getAttribute("data-menu-remove"), 10)), "Sayfa kaldırıldı.");
  });
  menu.clear.addEventListener("click", function () {
    var v = selectedVenue();
    if (!v) return;
    menuMessage("");
    saveMenu(v, [], "Menü kaldırıldı.");
  });
  // Reports sent from the viewer in another tab of this browser.
  window.addEventListener("storage", function (e) {
    var v = selectedVenue();
    if (e.key === Store.REPORTS_KEY && v) renderReports(v);
  });
  document.getElementById("cm-add").addEventListener("click", addMatch);
  // Enter inside the add-match fields adds the match instead of submitting the whole form.
  document.getElementById("add-match").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); addMatch(); }
  });
  // Removing a platform unticks the matches that need it (saved with "Kaydet").
  platformEl.addEventListener("change", function () {
    var v = selectedVenue();
    if (!v) return;
    var before = tickedInForm();
    var res = Logic.untickUnavailable(before, editableMatches(v), platformsInForm());
    renderChecks(v, res.matchIds);
    platformNote.textContent = res.removed.length
      ? res.removed.length + " maçın işareti kaldırıldı, çünkü yayıncısı artık platformlarında yok. Kaydet'e basmayı unutma."
      : "";
  });

  checksEl.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-delete]");
    if (b) deleteMatch(b.getAttribute("data-delete"));
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = selectedVenue();
    if (!v) return;
    var screens = readInt(screensEl);
    var capacity = readInt(capacityEl);
    if (isNaN(screens) || screens > 50 || isNaN(capacity) || capacity > 5000) {
      errorEl.textContent = "Ekran sayısı 0-50, kapasite 0-5000 arasında tam sayı olmalı.";
      errorEl.hidden = false;
      statusEl.textContent = "";
      return;
    }
    var r = Logic.validateReservation({ accepts: res.accepts.checked, method: res.method.value, note: res.note.value });
    if (!r.ok) {
      errorEl.textContent = r.errors.method || r.errors.note;
      errorEl.hidden = false;
      statusEl.textContent = "";
      (r.errors.method ? res.method : res.note).focus();
      return;
    }
    errorEl.hidden = true;

    // Keep past matches as they were; only upcoming ones are editable here.
    var editableIds = editableMatches(v).map(function (m) { return m.id; });
    var kept = v.matchIds.filter(function (id) { return editableIds.indexOf(id) === -1; });

    var platforms = platformsInForm();
    var ok = Store.saveOverride(v.id, {
      platforms: platforms,
      matchIds: kept.concat(Logic.untickUnavailable(tickedInForm(), editableMatches(v), platforms).matchIds),
      screens: screens,
      soundOn: soundEl.checked,
      capacity: capacity,
      reservation: r.value
    });
    var saved = selectedVenue();
    window.MNPanelExtras.refresh(saved, editableMatches(saved)); // campaign match list follows the saved ticks
    statusEl.innerHTML = ok
      ? 'Kaydedildi. <a href="index.html">İzleyici ekranında gör</a>'
      : "Kaydedilemedi: tarayıcı depolamaya izin vermiyor (ör. gizli sekme).";
  });

  document.getElementById("reset").addEventListener("click", function () {
    var v = selectedVenue();
    if (!v) return;
    Store.clearOverride(v.id);
    Store.clearReports(v.id);
    fillForm(selectedVenue());
    statusEl.textContent = "Bu mekan örnek (sentetik) verisine döndürüldü. Eklediğin maçlar, yüklediğin menü, rezervasyon, özellik ve kampanya değişikliklerin ve bu mekan hakkında bu cihazdaki bildirimler de silindi.";
  });
})();
