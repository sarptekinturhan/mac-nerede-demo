/*
 * Venue panel changes (incl. venue-added matches, v0.3; reservation info and reports, v0.4;
 * features and campaigns, v0.5) are stored in this browser's localStorage only (prototype).
 * v0.5 viewer-side data: own reviews, favourite teams and the entry-flow variant (A/B test).
 * All access is wrapped in try/catch: private mode or blocked storage must not break the app.
 */
(function (root) {
  "use strict";
  var KEY = "macNerede.overrides.v1";

  function loadOverrides() {
    try {
      var raw = root.localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(all) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Merges into the venue's stored record, so saving the form keeps custom matches (v0.3).
  function saveOverride(venueId, data) {
    var all = loadOverrides();
    var prev = all[venueId] && typeof all[venueId] === "object" ? all[venueId] : {};
    all[venueId] = Object.assign({}, prev, data, { updatedAt: new Date().toISOString() });
    return writeAll(all);
  }

  function clearOverride(venueId) {
    var all = loadOverrides();
    delete all[venueId];
    return writeAll(all);
  }

  // ---------- v0.4: "Sorun bildir" reports, kept on this device only ----------
  var REPORTS_KEY = "macNerede.reports.v1";
  var MAX_REPORTS = 200; // oldest dropped first

  function loadReports() {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(REPORTS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeReports(list) {
    try {
      root.localStorage.setItem(REPORTS_KEY, JSON.stringify(list.slice(-MAX_REPORTS)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function addReport(report) { return writeReports(loadReports().concat(report)); }

  function clearReports(venueId) {
    return writeReports(loadReports().filter(function (r) { return !r || r.venueId !== venueId; }));
  }

  // ---------- v0.5: viewer-side data (never sent anywhere) ----------
  var MYREVIEWS_KEY = "macNerede.myReviews.v1"; // { venueId: { rating, text, createdAt } }
  var FAVS_KEY = "macNerede.favTeams.v1"; // ["Galatasaray", ...]
  var FLOW_KEY = "macNerede.flow.v1"; // "a" | "b"

  function readJson(key, fallback, check) {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(key) || "null");
      return check(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function isMap(x) { return !!x && typeof x === "object" && !Array.isArray(x); }

  function loadMyReviews() { return readJson(MYREVIEWS_KEY, {}, isMap); }
  function saveMyReviews(map) { return writeJson(MYREVIEWS_KEY, map); }
  function loadFavTeams() { return readJson(FAVS_KEY, [], Array.isArray); }
  function saveFavTeams(list) { return writeJson(FAVS_KEY, list); }

  // Footer link "Yorumlarımı ve takımlarımı sıfırla".
  function clearViewerData() {
    try {
      root.localStorage.removeItem(MYREVIEWS_KEY);
      root.localStorage.removeItem(FAVS_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadFlow() {
    try { return root.localStorage.getItem(FLOW_KEY); } catch (e) { return null; }
  }
  function saveFlow(v) {
    try { root.localStorage.setItem(FLOW_KEY, v); return true; } catch (e) { return false; }
  }

  root.MNStorage = {
    MYREVIEWS_KEY: MYREVIEWS_KEY, loadMyReviews: loadMyReviews, saveMyReviews: saveMyReviews,
    FAVS_KEY: FAVS_KEY, loadFavTeams: loadFavTeams, saveFavTeams: saveFavTeams, clearViewerData: clearViewerData,
    FLOW_KEY: FLOW_KEY, loadFlow: loadFlow, saveFlow: saveFlow,
    KEY: KEY, loadOverrides: loadOverrides, saveOverride: saveOverride, clearOverride: clearOverride,
    REPORTS_KEY: REPORTS_KEY, loadReports: loadReports, addReport: addReport, clearReports: clearReports
  };
})(this);
