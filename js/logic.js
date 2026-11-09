/*
 * Pure logic: filtering, sorting, grouping, merging. No DOM access.
 * Works as a classic <script> (exposes window.MNLogic) and in Node (module.exports),
 * so the app runs from file:// without a server and tests need no dependencies.
 */
(function (root) {
  "use strict";

  var ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000; // Turkey is UTC+3 all year
  var MATCH_VISIBLE_MINUTES = 120; // a match stays listed until ~2h after kickoff
  var DAY_MS = 24 * 60 * 60 * 1000;

  var DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  var MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Date shifted so that UTC getters return Istanbul wall-clock values.
  function istanbulDate(d) { return new Date(new Date(d).getTime() + ISTANBUL_OFFSET_MS); }

  function istanbulDayNumber(d) { return Math.floor(istanbulDate(d).getTime() / DAY_MS); }

  function isVisible(match, now) {
    var end = new Date(match.kickoff).getTime() + MATCH_VISIBLE_MINUTES * 60 * 1000;
    return end > new Date(now).getTime();
  }

  function compareMatches(a, b) {
    var diff = new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  // Upcoming (and currently playing) matches, sorted by kickoff.
  function upcomingMatches(matches, now) {
    return matches.filter(function (m) { return isVisible(m, now); }).sort(compareMatches);
  }

  // Groups: Bugün / Yarın / Bu hafta (next 7 days) / Sonra. Empty groups omitted.
  function groupMatches(matches, now) {
    var today = istanbulDayNumber(now);
    var groups = [
      { key: "today", label: "Bugün", matches: [] },
      { key: "tomorrow", label: "Yarın", matches: [] },
      { key: "week", label: "Bu hafta", matches: [] },
      { key: "later", label: "Sonra", matches: [] }
    ];
    upcomingMatches(matches, now).forEach(function (m) {
      var diff = istanbulDayNumber(m.kickoff) - today;
      var idx = diff <= 0 ? 0 : diff === 1 ? 1 : diff < 7 ? 2 : 3;
      groups[idx].matches.push(m);
    });
    return groups.filter(function (g) { return g.matches.length > 0; });
  }

  function venuesInRegion(venues, regionId) {
    return venues.filter(function (v) { return v.region === regionId; });
  }

  // Venues in the region that marked the match, sorted by name (Turkish collation).
  function venuesForMatch(venues, matchId, regionId) {
    return venuesInRegion(venues, regionId)
      .filter(function (v) { return Array.isArray(v.matchIds) && v.matchIds.indexOf(matchId) !== -1; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "tr"); });
  }

  // ---------- v0.2: default view (İ0) and optional filters (İ1) ----------

  function byName(a, b) { return a.name.localeCompare(b.name, "tr"); }

  function showsAny(venue, matchIds) {
    var ids = Array.isArray(venue.matchIds) ? venue.matchIds : [];
    return ids.some(function (id) { return matchIds.indexOf(id) !== -1; });
  }

  function ids(matches) { return matches.map(function (m) { return m.id; }); }

  // Upcoming matches of one league (all upcoming when league is empty), sorted by kickoff.
  function matchesForLeague(matches, league, now) {
    return upcomingMatches(matches, now).filter(function (m) { return !league || m.league === league; });
  }

  // Default view: venues in the region that show at least one upcoming match, sorted by name.
  function venuesWithUpcoming(venues, matches, regionId, now) {
    var upcomingIds = ids(upcomingMatches(matches, now));
    return venuesInRegion(venues, regionId)
      .filter(function (v) { return showsAny(v, upcomingIds); })
      .sort(byName);
  }

  var FIRST_LEAGUE = "Süper Lig";

  // "Süper Lig" first, then Turkish alphabetical order (PM default, v0.3).
  function compareLeagues(a, b) {
    if (a === b) return 0;
    if (a === FIRST_LEAGUE) return -1;
    if (b === FIRST_LEAGUE) return 1;
    return a.localeCompare(b, "tr");
  }

  // League chips: distinct leagues among upcoming matches.
  function leaguesFromMatches(matches, now) {
    var seen = [];
    upcomingMatches(matches, now).forEach(function (m) {
      if (m.league && seen.indexOf(m.league) === -1) seen.push(m.league);
    });
    return seen.sort(compareLeagues);
  }

  // Venues that show at least one upcoming match of the league. Order is preserved.
  function filterByLeague(venues, matches, league, now) {
    if (!league) return venues.slice();
    var leagueIds = ids(matchesForLeague(matches, league, now));
    return venues.filter(function (v) { return showsAny(v, leagueIds); });
  }

  // Venues that marked the match. Order is preserved.
  function filterByMatch(venues, matchId) {
    if (!matchId) return venues.slice();
    return venues.filter(function (v) { return showsAny(v, [matchId]); });
  }

  // Whole main-screen pipeline: region -> has upcoming match -> league -> match.
  function filterVenues(venues, matches, opts, now) {
    var o = opts || {};
    var list = venuesWithUpcoming(venues, matches, o.region, now);
    list = filterByLeague(list, matches, o.league, now);
    return filterByMatch(list, o.matchId);
  }

  // Upcoming matches a venue shows, sorted by kickoff; optionally limited to one league.
  function nextMatchesForVenue(venue, matches, now, league) {
    var shown = Array.isArray(venue.matchIds) ? venue.matchIds : [];
    return matchesForLeague(matches, league, now).filter(function (m) { return shown.indexOf(m.id) !== -1; });
  }

  function isNonNegInt(x, max) { return typeof x === "number" && isFinite(x) && x % 1 === 0 && x >= 0 && x <= max; }

  // Keep only known, well-typed fields from a stored override; ignore the rest.
  function sanitizeOverride(o) {
    var out = {};
    if (!o || typeof o !== "object") return out;
    if (Array.isArray(o.matchIds)) out.matchIds = o.matchIds.filter(function (id) { return typeof id === "string"; });
    if (isNonNegInt(o.screens, 50)) out.screens = o.screens;
    if (typeof o.soundOn === "boolean") out.soundOn = o.soundOn;
    if (Array.isArray(o.platforms)) out.platforms = PLATFORMS.filter(function (p) { return o.platforms.indexOf(p) !== -1; });
    if (isNonNegInt(o.capacity, 5000)) out.capacity = o.capacity;
    if (typeof o.updatedAt === "string") out.updatedAt = o.updatedAt;
    var res = cleanReservation(o.reservation);
    if (res) out.reservation = res;
    if (Array.isArray(o.menu)) out.menu = o.menu.filter(isMenuPage).slice(0, MAX_MENU_PAGES); // [] = menu removed
    if (Array.isArray(o.customMatches)) {
      out.customMatches = o.customMatches.map(cleanStoredCustom).filter(Boolean).slice(0, MAX_CUSTOM);
    }
    if (Array.isArray(o.features)) out.features = cleanFeatures(o.features); // v0.5, M8
    if (Array.isArray(o.campaigns)) out.campaigns = cleanCampaigns(o.campaigns); // v0.5, M9 ([] = all deleted)
    return out;
  }

  // Returns new venue objects with panel overrides applied. Inputs are not mutated.
  // v0.4: menu = uploaded menu (override, may be empty) or else the sample menu, as an array of image URLs.
  function mergeOverrides(venues, overrides, sampleMenus) {
    var map = overrides && typeof overrides === "object" ? overrides : {};
    var samples = sampleMenus && typeof sampleMenus === "object" ? sampleMenus : {};
    return venues.map(function (v) {
      var o = sanitizeOverride(map[v.id]);
      var merged = Object.assign({}, v, o);
      merged.matchIds = (merged.matchIds || []).slice();
      merged.menu = (o.menu || samples[v.id] || v.menu || []).slice();
      merged.menuIsSample = !o.menu && merged.menu.length > 0;
      merged.features = cleanFeatures(merged.features);
      merged.campaigns = cleanCampaigns(merged.campaigns);
      merged.promoted = v.promoted === true; // sample data only; the panel cannot change it (M10 is design only)
      return merged;
    });
  }

  // ---------- v0.3: proximity sorting (İ7) ----------

  // Great-circle distance in metres between two [lat, lng] points.
  function haversine(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // "450 m", "1,2 km", "12 km" (Turkish decimal comma).
  function formatDistance(metres) {
    var m = Math.max(10, Math.round(metres / 10) * 10);
    if (m < 1000) return m + " m";
    var km = metres / 1000;
    if (km >= 10) return Math.round(km) + " km";
    return km.toFixed(1).replace(/\.0$/, "").replace(".", ",") + " km";
  }

  // Nearest first; equal distance -> name. Returns a new array.
  function sortByDistance(venues, pos) {
    return venues.map(function (v) { return { v: v, d: haversine(pos, [v.lat, v.lng]) }; })
      .sort(function (a, b) { return a.d - b.d || byName(a.v, b.v); })
      .map(function (x) { return x.v; });
  }

  // The venue's next match that fits the league/match filter, or null (v0.4: the one match on a card).
  function nextRelevantMatch(v, matches, now, scope) {
    var s = scope || {};
    return nextMatchesForVenue(v, matches, now, s.league).filter(function (m) {
      return (!s.matchId || m.id === s.matchId) && (!s.matchIds || s.matchIds.indexOf(m.id) !== -1); // v0.5: matchIds = favourite teams' matches
    })[0] || null;
  }

  // Kickoff time of that match (Infinity if none).
  function nextRelevantTime(v, matches, now, scope) {
    var m = nextRelevantMatch(v, matches, now, scope);
    return m ? new Date(m.kickoff).getTime() : Infinity;
  }

  function byTime(a, b) { return a === b ? 0 : a < b ? -1 : 1; }

  // Venue whose next relevant match starts soonest first; ties alphabetical; venues without one last.
  function sortByNextMatch(venues, matches, now, scope) {
    return venues.map(function (v) { return { v: v, t: nextRelevantTime(v, matches, now, scope) }; })
      .sort(function (a, b) { return byTime(a.t, b.t) || byName(a.v, b.v); })
      .map(function (x) { return x.v; });
  }

  var DENSITY_RADIUS_M = 300;

  // How many OTHER venues of the given list are within radius metres of each venue (by id).
  function densityScores(venues, radius) {
    var r = radius || DENSITY_RADIUS_M, out = {};
    venues.forEach(function (v) {
      out[v.id] = venues.filter(function (o) { return o !== v && haversine([v.lat, v.lng], [o.lat, o.lng]) <= r; }).length;
    });
    return out;
  }

  // Default order without location (PM, v0.3): venues in dense clusters first,
  // then soonest relevant match, then alphabetical. Density counts only the given (filtered) list.
  function sortByDensity(venues, matches, now, scope, radius) {
    var dens = densityScores(venues, radius);
    return venues.map(function (v) { return { v: v, d: dens[v.id], t: nextRelevantTime(v, matches, now, scope) }; })
      .sort(function (a, b) { return b.d - a.d || byTime(a.t, b.t) || byName(a.v, b.v); })
      .map(function (x) { return x.v; });
  }

  // ---------- v0.3: broadcasters and venue platforms ----------

  var PLATFORMS = ["beIN SPORTS", "S Sport", "TOD"]; // paid packages a venue may have
  var FREE_PLATFORM = "TRT Spor"; // free-to-air: every venue has it

  // Can a venue with these platforms show the match? Venue-added matches are not checked.
  function canShow(platforms, match) {
    if (!match || match.custom || !match.broadcaster || match.broadcaster === FREE_PLATFORM) return true;
    return (platforms || []).indexOf(match.broadcaster) !== -1;
  }

  // After a platform change: drop ticked matches the venue can no longer show.
  function untickUnavailable(matchIds, matches, platforms) {
    var byId = {};
    matches.forEach(function (m) { byId[m.id] = m; });
    var kept = [], removed = [];
    matchIds.forEach(function (id) { (canShow(platforms, byId[id]) ? kept : removed).push(id); });
    return { matchIds: kept, removed: removed };
  }

  // ---------- v0.3: matches added by venues (M5) ----------

  var MAX_LEAGUE = 40, MAX_TITLE = 80, MAX_BROADCASTER = 40, MAX_CUSTOM = 30, MAX_DAYS_AHEAD = 365;
  var EXTRA_LEAGUES = ["NBA", "EuroLeague", "TFF 1. Lig", "La Liga", "Serie A", "Bundesliga"];

  function cleanText(x) {
    return String(x == null ? "" : x).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Comparison key: Turkish-aware lowercase, any dash -> " - ", whitespace collapsed.
  function normKey(s) {
    return cleanText(s).toLocaleLowerCase("tr").replace(/\s*[-\u2010-\u2015\u2212]\s*/g, " - ");
  }

  function matchTitle(m) { return m.title ? m.title : m.home + " – " + m.away; }

  function matchKey(m) { return normKey(m.league) + "|" + normKey(matchTitle(m)) + "|" + new Date(m.kickoff).getTime(); }

  function istanbulDateString(d) { return istanbulDate(d).toISOString().slice(0, 10); }

  // Panel form -> { ok, errors: {league,title,date,time}, value: {league,title,kickoff} }.
  function validateCustomMatch(input, now) {
    var i = input || {};
    var league = cleanText(i.league), title = cleanText(i.title);
    var date = cleanText(i.date), time = cleanText(i.time), broadcaster = cleanText(i.broadcaster);
    var errors = {};
    if (broadcaster.length > MAX_BROADCASTER) errors.broadcaster = "En fazla " + MAX_BROADCASTER + " karakter olabilir.";
    if (!league) errors.league = "Lig veya spor dalını yazın.";
    else if (league.length > MAX_LEAGUE) errors.league = "En fazla " + MAX_LEAGUE + " karakter olabilir.";
    if (!title) errors.title = "Maç adını yazın.";
    else if (title.length < 3) errors.title = "Maç adı en az 3 karakter olmalı.";
    else if (title.length > MAX_TITLE) errors.title = "En fazla " + MAX_TITLE + " karakter olabilir.";
    var dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;
    var timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    if (!date) errors.date = "Tarih seçin.";
    else if (!dateOk) errors.date = "Geçerli bir tarih seçin.";
    if (!time) errors.time = "Saat seçin.";
    else if (!timeOk) errors.time = "Geçerli bir saat girin (ör. 21:30).";
    var kickoff = null;
    if (dateOk && timeOk) {
      kickoff = date + "T" + time + ":00+03:00";
      var t = new Date(kickoff).getTime(), n = new Date(now).getTime();
      if (date < istanbulDateString(now)) errors.date = "Geçmiş bir tarih seçilemez.";
      else if (t <= n) errors.time = "Bu saat geçti; ileri bir saat seçin.";
      else if (t > n + MAX_DAYS_AHEAD * DAY_MS) errors.date = "En fazla 1 yıl sonrası için maç eklenebilir.";
    }
    var ok = Object.keys(errors).length === 0;
    var value = ok ? { league: league, title: title, kickoff: kickoff } : null;
    if (ok && broadcaster) value.broadcaster = broadcaster; // optional
    return { ok: ok, errors: errors, value: value };
  }

  // A stored custom match is kept only if its shape is valid (no future check: past ones just expire).
  function cleanStoredCustom(c) {
    if (!c || typeof c !== "object" || typeof c.id !== "string" || !/^c[a-z0-9]{1,24}$/.test(c.id)) return null;
    var league = cleanText(c.league), title = cleanText(c.title);
    if (!league || league.length > MAX_LEAGUE || title.length < 3 || title.length > MAX_TITLE) return null;
    if (typeof c.kickoff !== "string" || isNaN(new Date(c.kickoff).getTime())) return null;
    var out = { id: c.id, league: league, title: title, kickoff: c.kickoff };
    var bc = cleanText(c.broadcaster);
    if (bc && bc.length <= MAX_BROADCASTER) out.broadcaster = bc;
    return out;
  }

  // Same event already in a list of matches (fixtures or custom)? Returns it or null.
  function findSameMatch(value, matches) {
    var key = matchKey(value);
    return matches.filter(function (m) { return matchKey(m) === key; })[0] || null;
  }

  function newCustomId() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // Small stable hash so a deduped custom match gets the same id (and URL) everywhere.
  function hashKey(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // League suggestions for the panel <datalist>: Süper Lig first, then alphabetical.
  function leagueSuggestions(fixtures, extra) {
    var seen = {}, out = [];
    fixtures.map(function (m) { return m.league; }).concat(EXTRA_LEAGUES, extra || []).forEach(function (l) {
      var k = normKey(l);
      if (k && !seen[k]) { seen[k] = true; out.push(cleanText(l)); }
    });
    return out.sort(compareLeagues);
  }

  // Viewer data: venues with overrides + fixtures + every venue-added match.
  // Same event added by several venues (or equal to a fixture) becomes one match.
  function buildViewerData(venues, fixtures, overrides, sampleMenus) {
    var merged = mergeOverrides(venues, overrides, sampleMenus);
    var matches = fixtures.slice();
    var idByKey = {}, leagueByKey = {};
    fixtures.forEach(function (m) { idByKey[matchKey(m)] = m.id; });
    fixtures.map(function (m) { return m.league; }).concat(EXTRA_LEAGUES).forEach(function (l) {
      if (!leagueByKey[normKey(l)]) leagueByKey[normKey(l)] = l;
    });
    var outVenues = merged.map(function (v) {
      var local = {};
      (v.customMatches || []).forEach(function (c) {
        var lk = normKey(c.league);
        var league = leagueByKey[lk] || (leagueByKey[lk] = c.league); // "nba" -> "NBA"
        var m = { league: league, title: c.title, kickoff: c.kickoff, custom: true };
        if (c.broadcaster) m.broadcaster = c.broadcaster;
        var key = matchKey(m);
        if (!idByKey[key]) {
          m.id = "x" + hashKey(key);
          idByKey[key] = m.id;
          matches.push(m);
        } else if (c.broadcaster) {
          // Same event added by another venue without a channel: fill it in (fixtures keep theirs).
          var existing = matches.filter(function (x) { return x.id === idByKey[key]; })[0];
          if (existing.custom && !existing.broadcaster) existing.broadcaster = c.broadcaster;
        }
        local[c.id] = idByKey[key];
      });
      var ids = [];
      v.matchIds.forEach(function (id) {
        var real = local[id] || (/^c[a-z0-9]+$/.test(id) ? null : id); // drop ids of deleted custom matches
        if (real && ids.indexOf(real) === -1) ids.push(real);
      });
      // v0.5: a campaign linked to the venue's own added match follows that match's shared id.
      var campaigns = (v.campaigns || []).map(function (k) {
        return k.matchId && local[k.matchId] ? Object.assign({}, k, { matchId: local[k.matchId] }) : k;
      });
      var out = Object.assign({}, v, { matchIds: ids, campaigns: campaigns });
      delete out.customMatches;
      return out;
    });
    return { venues: outVenues, matches: matches };
  }

  // ---------- v0.4: reservation info (İ11 / M6) ----------

  var RES_METHODS = { telefon: "telefonla", whatsapp: "WhatsApp'tan", instagram: "Instagram'dan" };
  var MAX_RES_NOTE = 80;

  // Stored/sample reservation -> { accepts, method, note? } or null when the shape is wrong.
  function cleanReservation(r) {
    if (!r || typeof r !== "object" || typeof r.accepts !== "boolean") return null;
    if (!r.accepts) return { accepts: false, method: null };
    var out = { accepts: true, method: RES_METHODS.hasOwnProperty(r.method) ? r.method : null };
    var note = cleanText(r.note);
    if (note && note.length <= MAX_RES_NOTE) out.note = note;
    return out;
  }

  // Panel input { accepts, method, note } -> { ok, errors: {method, note}, value }.
  function validateReservation(input) {
    var i = input || {}, errors = {};
    var accepts = i.accepts === true, method = cleanText(i.method), note = cleanText(i.note);
    if (accepts && !RES_METHODS.hasOwnProperty(method)) errors.method = "Rezervasyonu nasıl aldığını seçin.";
    if (accepts && note.length > MAX_RES_NOTE) errors.note = "Not en fazla " + MAX_RES_NOTE + " karakter olabilir.";
    var ok = Object.keys(errors).length === 0;
    var value = !ok ? null : accepts ? { accepts: true, method: method } : { accepts: false, method: null };
    if (ok && accepts && note) value.note = note;
    return { ok: ok, errors: errors, value: value };
  }

  // "Alıyor · telefonla" / "Almıyor" (note is shown separately).
  function reservationText(r) {
    var c = cleanReservation(r);
    if (!c || !c.accepts) return "Almıyor";
    return c.method ? "Alıyor · " + RES_METHODS[c.method] : "Alıyor";
  }

  // ---------- v0.4: "Sorun bildir" reports (İ10) ----------

  var REPORT_REASONS = [
    { id: "no-match", label: "Bu maç gösterilmiyor / yayın yok" },
    { id: "closed", label: "Mekan kapalı" },
    { id: "wrong-info", label: "Bilgiler yanlış (ekran, ses, kapasite, platform)" },
    { id: "wrong-location", label: "Adres veya konum yanlış" },
    { id: "wrong-reservation", label: "Rezervasyon bilgisi yanlış" },
    { id: "other", label: "Diğer" }
  ];
  var MAX_REPORT_TEXT = 300;

  function reasonLabel(id) {
    var r = REPORT_REASONS.filter(function (x) { return x.id === id; })[0];
    return r ? r.label : "";
  }

  // Form input { reason, matchId, text } -> { ok, errors: {reason, text}, value: { reason, matchId?, text } }.
  // matchId is kept only for the "no-match" reason.
  function validateReport(input) {
    var i = input || {}, errors = {};
    var reason = cleanText(i.reason), text = cleanText(i.text), matchId = cleanText(i.matchId);
    if (!reasonLabel(reason)) errors.reason = "Lütfen bir neden seçin.";
    if (text.length > MAX_REPORT_TEXT) errors.text = "Açıklama en fazla " + MAX_REPORT_TEXT + " karakter olabilir.";
    var ok = Object.keys(errors).length === 0;
    var value = ok ? { reason: reason, text: text } : null;
    if (ok && reason === "no-match" && matchId) value.matchId = matchId;
    return { ok: ok, errors: errors, value: value };
  }

  // Validated value -> the object that is stored.
  function buildReport(venueId, value, now) {
    var r = { venueId: String(venueId), reason: value.reason, text: value.text || "", createdAt: new Date(now).toISOString() };
    if (value.matchId) r.matchId = value.matchId;
    return r;
  }

  // A stored report is kept only if its shape is valid.
  function cleanStoredReport(r) {
    if (!r || typeof r !== "object" || typeof r.venueId !== "string") return null;
    var v = validateReport(r);
    if (!v.ok || typeof r.createdAt !== "string" || isNaN(new Date(r.createdAt).getTime())) return null;
    return buildReport(r.venueId, v.value, r.createdAt);
  }

  // This venue's valid reports, newest first.
  function reportsForVenue(reports, venueId) {
    return (Array.isArray(reports) ? reports : []).map(cleanStoredReport)
      .filter(function (r) { return r && r.venueId === venueId; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; });
  }

  // ---------- v0.4: venue menu (M7 + İ12) ----------

  var MAX_MENU_PAGES = 12;
  var MAX_MENU_CHARS = 3500000; // ~3.5 MB of data URLs per venue (localStorage holds ~5 MB in total)

  // Only image data URLs are accepted (uploads are JPEG; sample pages are SVG).
  function isMenuPage(s) {
    return typeof s === "string" &&
      (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s) || /^data:image\/svg\+xml;charset=utf-8,[^"<>\s]+$/.test(s));
  }

  function menuSize(pages) { return (pages || []).reduce(function (n, p) { return n + String(p).length; }, 0); }

  function formatMb(chars) { return (chars / 1000000).toFixed(1).replace(".", ",") + " MB"; }

  // Adds pages in order until the page limit or the size budget is hit.
  // -> { pages, added, error } (error explains why some pages were left out).
  function addMenuPages(current, incoming) {
    var out = (current || []).slice(), added = 0, error = null;
    (incoming || []).forEach(function (p) {
      if (error) return;
      if (!isMenuPage(p)) error = "Bu dosya okunamadı.";
      else if (out.length >= MAX_MENU_PAGES) error = "En fazla " + MAX_MENU_PAGES + " menü sayfası yüklenebilir; fazlası eklenmedi.";
      else if (menuSize(out) + p.length > MAX_MENU_CHARS) {
        error = "Menü için ayrılan alan doldu (en fazla " + formatMb(MAX_MENU_CHARS) + "). Bazı sayfalar eklenmedi; bir sayfayı kaldırıp tekrar dene.";
      } else { out.push(p); added++; }
    });
    return { pages: out, added: added, error: error };
  }

  function removeMenuPage(pages, index) {
    return (pages || []).filter(function (p, i) { return i !== index; });
  }

  // ---------- v0.5: venue features (İ14 / M8) and campaigns (İ15 / M9) ----------

  // Order here is the order of chips, panel checkboxes and the detail list.
  var FEATURES = [
    { id: "dis-mekan", label: "Bahçe / dış mekan", short: "Bahçe / dış mekan" },
    { id: "yemek", label: "Yemek servisi", short: "Yemek" },
    { id: "buyuk-ekran", label: "Büyük ekran / projeksiyon", short: "Büyük ekran" },
    { id: "engelli", label: "Engelli erişimi", short: "Engelli erişimi" },
    { id: "sigarasiz", label: "Sigarasız kapalı alan", short: "Sigarasız" },
    { id: "aile", label: "Aile dostu", short: "Aile dostu" }
  ];

  function featureLabel(id) {
    var f = FEATURES.filter(function (x) { return x.id === id; })[0];
    return f ? f.label : "";
  }

  // Known feature ids only, no duplicates, in FEATURES order.
  function cleanFeatures(list) {
    var given = Array.isArray(list) ? list : [];
    return FEATURES.map(function (f) { return f.id; }).filter(function (id) { return given.indexOf(id) !== -1; });
  }

  var MAX_CAMPAIGNS = 3, MAX_CAMPAIGN_TEXT = 80;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isRealDate(s) { return DATE_RE.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s; }

  // Panel input { text, matchId, endDate } -> { ok, errors: {text, matchId, endDate}, value }.
  // allowedMatchIds: the upcoming matches the venue shows (a campaign may be linked to one of them).
  function validateCampaign(input, now, allowedMatchIds) {
    var i = input || {}, errors = {};
    var text = cleanText(i.text), matchId = cleanText(i.matchId), endDate = cleanText(i.endDate);
    if (!text) errors.text = "Kampanya metnini yazın.";
    else if (text.length < 3) errors.text = "Kampanya metni en az 3 karakter olmalı.";
    else if (text.length > MAX_CAMPAIGN_TEXT) errors.text = "En fazla " + MAX_CAMPAIGN_TEXT + " karakter olabilir.";
    if (matchId && (allowedMatchIds || []).indexOf(matchId) === -1) errors.matchId = "Bu maç listende yok; başka bir maç seçin.";
    if (endDate) {
      var today = istanbulDateString(now);
      var limit = istanbulDateString(new Date(new Date(now).getTime() + MAX_DAYS_AHEAD * DAY_MS));
      if (!isRealDate(endDate)) errors.endDate = "Geçerli bir tarih seçin.";
      else if (endDate < today) errors.endDate = "Bitiş tarihi geçmişte olamaz.";
      else if (endDate > limit) errors.endDate = "Bitiş tarihi en fazla 1 yıl sonrası olabilir.";
    }
    var ok = Object.keys(errors).length === 0;
    return { ok: ok, errors: errors, value: ok ? { text: text, matchId: matchId || null, endDate: endDate || null } : null };
  }

  // A stored/sample campaign is kept only if its shape is valid (expiry is checked when showing it).
  function cleanStoredCampaign(k) {
    if (!k || typeof k !== "object" || typeof k.id !== "string" || !/^k[a-z0-9]{1,24}$/.test(k.id)) return null;
    var text = cleanText(k.text);
    if (text.length < 3 || text.length > MAX_CAMPAIGN_TEXT) return null;
    var matchId = typeof k.matchId === "string" && k.matchId ? k.matchId : null;
    var endDate = typeof k.endDate === "string" && isRealDate(k.endDate) ? k.endDate : null;
    return { id: k.id, text: text, matchId: matchId, endDate: endDate };
  }

  function cleanCampaigns(list) {
    return (Array.isArray(list) ? list : []).map(cleanStoredCampaign).filter(Boolean).slice(0, MAX_CAMPAIGNS);
  }

  function newCampaignId() { return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatKickoff(iso) {
    var d = istanbulDate(iso);
    return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] +
      " · " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
  }

  // Card line (v0.4): "Paz 20:00" within the coming week, "Paz 9 Kas 20:00" further away.
  function formatKickoffShort(iso, now) {
    var d = istanbulDate(iso);
    var time = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
    var far = istanbulDayNumber(iso) - istanbulDayNumber(now) >= 7;
    return DAYS[d.getUTCDay()] + " " + (far ? d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " : "") + time;
  }

  // Report date in the panel: "28 Eki 2026 · 14:05".
  function formatDateTime(iso) {
    var d = istanbulDate(iso);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() + " · " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
  }

  function directionsUrl(lat, lng) {
    return "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng;
  }

  function telHref(phone) { return "tel:" + String(phone).replace(/[^\d+]/g, ""); }

  var api = {
    MATCH_VISIBLE_MINUTES: MATCH_VISIBLE_MINUTES,
    upcomingMatches: upcomingMatches,
    groupMatches: groupMatches,
    venuesInRegion: venuesInRegion,
    venuesForMatch: venuesForMatch,
    matchesForLeague: matchesForLeague,
    venuesWithUpcoming: venuesWithUpcoming,
    leaguesFromMatches: leaguesFromMatches,
    filterByLeague: filterByLeague,
    filterByMatch: filterByMatch,
    filterVenues: filterVenues,
    nextMatchesForVenue: nextMatchesForVenue,
    sanitizeOverride: sanitizeOverride,
    mergeOverrides: mergeOverrides,
    formatKickoff: formatKickoff,
    directionsUrl: directionsUrl,
    telHref: telHref,
    compareLeagues: compareLeagues,
    haversine: haversine,
    formatDistance: formatDistance,
    sortByDistance: sortByDistance,
    sortByNextMatch: sortByNextMatch,
    nextRelevantMatch: nextRelevantMatch,
    formatKickoffShort: formatKickoffShort,
    formatDateTime: formatDateTime,
    RES_METHODS: RES_METHODS,
    MAX_RES_NOTE: MAX_RES_NOTE,
    cleanReservation: cleanReservation,
    validateReservation: validateReservation,
    reservationText: reservationText,
    REPORT_REASONS: REPORT_REASONS,
    MAX_REPORT_TEXT: MAX_REPORT_TEXT,
    reasonLabel: reasonLabel,
    validateReport: validateReport,
    buildReport: buildReport,
    cleanStoredReport: cleanStoredReport,
    reportsForVenue: reportsForVenue,
    MAX_MENU_PAGES: MAX_MENU_PAGES,
    MAX_MENU_CHARS: MAX_MENU_CHARS,
    isMenuPage: isMenuPage,
    menuSize: menuSize,
    addMenuPages: addMenuPages,
    removeMenuPage: removeMenuPage,
    densityScores: densityScores,
    sortByDensity: sortByDensity,
    PLATFORMS: PLATFORMS,
    FREE_PLATFORM: FREE_PLATFORM,
    canShow: canShow,
    untickUnavailable: untickUnavailable,
    MAX_CUSTOM: MAX_CUSTOM,
    normKey: normKey,
    matchTitle: matchTitle,
    matchKey: matchKey,
    istanbulDateString: istanbulDateString,
    validateCustomMatch: validateCustomMatch,
    findSameMatch: findSameMatch,
    newCustomId: newCustomId,
    leagueSuggestions: leagueSuggestions,
    buildViewerData: buildViewerData,
    FEATURES: FEATURES,
    featureLabel: featureLabel,
    cleanFeatures: cleanFeatures,
    MAX_CAMPAIGNS: MAX_CAMPAIGNS,
    MAX_CAMPAIGN_TEXT: MAX_CAMPAIGN_TEXT,
    validateCampaign: validateCampaign,
    cleanStoredCampaign: cleanStoredCampaign,
    cleanCampaigns: cleanCampaigns,
    newCampaignId: newCampaignId,
    isVisible: isVisible,
    istanbulDayNumber: istanbulDayNumber,
    escapeHtml: escapeHtml
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MNLogic = api;
})(this);
