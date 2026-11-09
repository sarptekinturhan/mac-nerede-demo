/*
 * v0.5 venue panel sections (split from panel.js to keep it short):
 *  - "Özellikler" (M8): checkboxes, saved on every change.
 *  - "Kampanyalar" (M9): up to 3, text + optional match ("Her maçta" otherwise) + optional end date;
 *    saved immediately on add/delete. Inactive (expired) ones are tagged and dropped on the next add.
 *  - "Öne çık" (M10): package cards with example prices, design only (no payment, buttons disabled).
 * panel.js calls MNPanelExtras.fill(venue, editableMatches) whenever the selected venue is (re)loaded.
 */
(function () {
  "use strict";
  var Logic = window.MNLogic;
  var D = window.MNDiscover;
  var Store = window.MNStorage;
  var esc = Logic.escapeHtml;

  var PACKAGES = [
    { id: "ucretsiz", name: "Ücretsiz", price: "0 TL", text: "Profil + haftada 6 maç" },
    { id: "standart", name: "Standart", price: "499 TL/ay", text: "Sınırsız maç, kampanya" },
    { id: "one-cikan", name: "Öne Çıkan", price: "1.499 TL/ay", text: "Listede üst sırada, “Öne çıkan” etiketi" }
  ];

  var el = {
    features: document.getElementById("feature-checks"),
    featureStatus: document.getElementById("feature-status"),
    list: document.getElementById("camp-list"),
    add: document.getElementById("camp-add"),
    text: document.getElementById("camp-text"),
    match: document.getElementById("camp-match"),
    end: document.getElementById("camp-end"),
    full: document.getElementById("camp-full"),
    status: document.getElementById("camp-status"),
    boost: document.getElementById("boost"),
    packages: document.getElementById("packages")
  };
  var current = { venue: null, matches: [] };

  function venueNow() {
    var id = current.venue && current.venue.id;
    return Logic.mergeOverrides(window.MN_VENUES, Store.loadOverrides(), window.MN_MENUS).filter(function (v) { return v.id === id; })[0];
  }

  // ---------- Features ----------
  function renderFeatures(v) {
    el.features.innerHTML = Logic.FEATURES.map(function (f) {
      return '<label class="check-row"><input type="checkbox" name="feature" value="' + f.id + '"' +
        (v.features.indexOf(f.id) !== -1 ? " checked" : "") + "><span>" + esc(f.label) + "</span></label>";
    }).join("");
  }

  el.features.addEventListener("change", function () {
    var v = current.venue;
    if (!v) return;
    var ids = Array.prototype.slice.call(el.features.querySelectorAll('input[name="feature"]:checked')).map(function (x) { return x.value; });
    var ok = Store.saveOverride(v.id, { features: Logic.cleanFeatures(ids) });
    el.featureStatus.innerHTML = ok ? 'Özellikler kaydedildi. <a href="index.html">İzleyici ekranında gör</a>'
      : "Kaydedilemedi: tarayıcı depolamaya izin vermiyor (ör. gizli sekme).";
  });

  // ---------- Campaigns ----------
  // Upcoming matches the venue currently shows (saved ticks), for the "Hangi maçta?" select.
  function shownMatches(v) {
    return current.matches.filter(function (m) { return v.matchIds.indexOf(m.id) !== -1; });
  }

  function campaignLine(k, v) {
    var m = k.matchId && current.matches.filter(function (x) { return x.id === k.matchId; })[0];
    var active = D.isCampaignActive(k, v, current.matches, new Date());
    return "<li><span><strong>" + esc(k.text) + "</strong><br><small class=\"meta\">" +
      (k.matchId ? (m ? "Sadece " + esc(Logic.matchTitle(m)) + " · " + Logic.formatKickoff(m.kickoff) : "Bağlı olduğu maç geçti veya listende yok") : "Her maçta") +
      (k.endDate ? " · son gün " + esc(k.endDate.split("-").reverse().join(".")) : "") + "</small>" +
      (active ? "" : ' <span class="tag">Görünmüyor (süresi doldu)</span>') + "</span>" +
      '<button type="button" class="link-btn danger" data-camp-delete="' + esc(k.id) + '">Sil</button></li>';
  }

  function activeOnly(v) {
    return v.campaigns.filter(function (k) { return D.isCampaignActive(k, v, current.matches, new Date()); });
  }

  function renderCampaigns(v) {
    el.list.innerHTML = v.campaigns.map(function (k) { return campaignLine(k, v); }).join("");
    el.list.hidden = !v.campaigns.length;
    var full = activeOnly(v).length >= Logic.MAX_CAMPAIGNS;
    el.add.hidden = full;
    el.full.hidden = !full;
    var keep = el.match.value;
    el.match.innerHTML = '<option value="">Her maçta</option>' + shownMatches(v).map(function (m) {
      return '<option value="' + esc(m.id) + '">' + esc(Logic.matchTitle(m)) + " · " + Logic.formatKickoff(m.kickoff) + "</option>";
    }).join("");
    if (el.match.querySelector('option[value="' + CSS.escape(keep) + '"]')) el.match.value = keep;
    el.end.min = Logic.istanbulDateString(new Date());
  }

  function showErrors(errors) {
    var first = null;
    [["text", el.text], ["matchId", el.match], ["endDate", el.end]].forEach(function (pair) {
      var id = pair[0] === "matchId" ? "camp-match-err" : pair[0] === "endDate" ? "camp-end-err" : "camp-text-err";
      var errEl = document.getElementById(id);
      var msg = errors[pair[0]];
      errEl.textContent = msg || "";
      errEl.hidden = !msg;
      if (msg) pair[1].setAttribute("aria-invalid", "true"); else pair[1].removeAttribute("aria-invalid");
      if (msg && !first) first = pair[1];
    });
    if (first) first.focus();
  }

  function addCampaign() {
    var v = venueNow();
    if (!v) return;
    el.status.textContent = "";
    var allowed = shownMatches(v).map(function (m) { return m.id; });
    var res = Logic.validateCampaign({ text: el.text.value, matchId: el.match.value, endDate: el.end.value }, new Date(), allowed);
    if (!res.ok) { showErrors(res.errors); return; }
    var kept = activeOnly(v); // expired campaigns are dropped when a new one is added
    if (kept.length >= Logic.MAX_CAMPAIGNS) { showErrors({ text: "En fazla " + Logic.MAX_CAMPAIGNS + " kampanya olabilir. Önce birini sil." }); return; }
    var added = Object.assign({ id: Logic.newCampaignId() }, res.value);
    if (!Store.saveOverride(v.id, { campaigns: kept.concat(added) })) {
      showErrors({ text: "Kaydedilemedi: tarayıcı depolamaya izin vermiyor (ör. gizli sekme)." });
      return;
    }
    el.text.value = ""; el.end.value = ""; el.match.value = "";
    showErrors({});
    current.venue = venueNow();
    renderCampaigns(current.venue);
    el.status.innerHTML = "Kampanya eklendi: " + esc(added.text) + '. <a href="index.html">İzleyici ekranında gör</a>';
  }

  function deleteCampaign(id) {
    var v = venueNow();
    if (!v) return;
    var gone = v.campaigns.filter(function (k) { return k.id === id; })[0];
    if (!gone) return;
    Store.saveOverride(v.id, { campaigns: v.campaigns.filter(function (k) { return k.id !== id; }) });
    current.venue = venueNow();
    renderCampaigns(current.venue);
    el.status.textContent = "Kampanya silindi: " + gone.text;
    var next = el.list.querySelector("button") || el.text;
    if (next && !next.closest("[hidden]")) next.focus();
  }

  document.getElementById("camp-add-btn").addEventListener("click", addCampaign);
  el.add.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); addCampaign(); }
  });
  el.list.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-camp-delete]");
    if (b) deleteCampaign(b.getAttribute("data-camp-delete"));
  });

  // ---------- "Öne çık" packages (design only) ----------
  function renderPackages(v) {
    var active = D.packageFor(v);
    el.packages.innerHTML = PACKAGES.map(function (p) {
      var on = p.id === active;
      return '<div class="package' + (on ? " active" : "") + '"><h3><span>' + esc(p.name) + '</span><span class="price">' + esc(p.price) + "</span></h3>" +
        "<p>" + esc(p.text) + "</p>" +
        (on ? '<p><span class="badge">Şu anki paketin</span></p>'
          : '<button type="button" class="btn" disabled aria-disabled="true">Yakında</button>') + "</div>";
    }).join("");
    el.boost.hidden = false;
  }

  function fill(v, upcomingMatches) {
    current = { venue: v, matches: upcomingMatches };
    renderFeatures(v);
    el.featureStatus.textContent = "";
    el.text.value = ""; el.end.value = ""; el.match.value = "";
    showErrors({});
    el.status.textContent = "";
    renderCampaigns(v);
    renderPackages(v);
  }

  // After "Kaydet" in the main form the shown matches may have changed: refresh the select and tags only.
  function refresh(v, upcomingMatches) {
    current = { venue: v, matches: upcomingMatches };
    renderCampaigns(v);
  }

  function hide() { el.boost.hidden = true; }

  window.MNPanelExtras = { PACKAGES: PACKAGES, fill: fill, refresh: refresh, hide: hide };
})();
