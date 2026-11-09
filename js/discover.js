/*
 * v0.5 pure logic for the viewer (no DOM): feature filters (İ14), campaigns (İ15),
 * favourite teams + Google Calendar links (İ16), the promoted slot (M10, design only)
 * and the two entry-flow variants for usability testing (decision #30).
 * Classic <script> (window.MNDiscover) and Node module, like logic.js.
 */
(function (root) {
  "use strict";
  var Logic = typeof module !== "undefined" && module.exports ? require("./logic.js") : root.MNLogic;
  var DAY_MS = 24 * 60 * 60 * 1000;

  // ---------- Feature filters (İ14) ----------
  // "kampanya" is not a venue feature but lives in the same chip row (PM, v0.5).
  var CAMPAIGN_FILTER = "kampanya";
  var FILTER_CHIPS = Logic.FEATURES.map(function (f) { return { id: f.id, label: f.short }; })
    .concat({ id: CAMPAIGN_FILTER, label: "Kampanyalı" });

  // URL value "yemek,dis-mekan" -> known ids in chip order, no duplicates.
  function parseFilterParam(s) {
    var given = String(s || "").split(",");
    return FILTER_CHIPS.map(function (c) { return c.id; }).filter(function (id) { return given.indexOf(id) !== -1; });
  }

  // AND logic: the venue must have every selected feature.
  function hasFeatures(venue, featureIds) {
    var own = Array.isArray(venue.features) ? venue.features : [];
    return (featureIds || []).every(function (id) { return own.indexOf(id) !== -1; });
  }

  function filterByFeatures(venues, featureIds) {
    return venues.filter(function (v) { return hasFeatures(v, featureIds); });
  }

  // ---------- Campaigns (İ15) ----------

  // Active = not past its end date (Istanbul calendar day) and, when linked to a match,
  // that match is still listed and the venue still shows it.
  function isCampaignActive(c, venue, matches, now) {
    if (!c) return false;
    if (c.endDate && c.endDate < Logic.istanbulDateString(now)) return false;
    if (!c.matchId) return true;
    var m = (matches || []).filter(function (x) { return x.id === c.matchId; })[0];
    return !!m && Logic.isVisible(m, now) && (venue.matchIds || []).indexOf(c.matchId) !== -1;
  }

  // Active campaigns of a venue; with matchId only those that apply to that match ("her maçta" or linked to it).
  function activeCampaigns(venue, matches, now, matchId) {
    return (venue.campaigns || []).filter(function (c) {
      return isCampaignActive(c, venue, matches, now) && (!matchId || !c.matchId || c.matchId === matchId);
    });
  }

  function filterByCampaign(venues, matches, now, matchId) {
    return venues.filter(function (v) { return activeCampaigns(v, matches, now, matchId).length > 0; });
  }

  // Features and the "Kampanyalı" chip together (AND).
  function applyFilterChips(venues, chipIds, matches, now, matchId) {
    var ids = chipIds || [];
    var list = filterByFeatures(venues, ids.filter(function (id) { return id !== CAMPAIGN_FILTER; }));
    return ids.indexOf(CAMPAIGN_FILTER) !== -1 ? filterByCampaign(list, matches, now, matchId) : list;
  }

  // ---------- Favourite teams (İ16) ----------
  var MAX_FAV_TEAMS = 30;

  // Team names from fixtures (venue-added matches only have a free-text title, so they are skipped).
  function teamsFromMatches(matches) {
    var seen = [];
    (matches || []).forEach(function (m) {
      if (m.custom) return;
      [m.home, m.away].forEach(function (t) { if (typeof t === "string" && t && seen.indexOf(t) === -1) seen.push(t); });
    });
    return seen.sort(function (a, b) { return a.localeCompare(b, "tr"); });
  }

  // Stored list -> strings only, unique, limited; optionally only teams that still exist.
  function cleanFavTeams(list, known) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (t) {
      if (typeof t !== "string" || !t || t.length > 60 || out.indexOf(t) !== -1) return;
      if (known && known.indexOf(t) === -1) return;
      out.push(t);
    });
    return out.slice(0, MAX_FAV_TEAMS);
  }

  function isFavMatch(m, favs) {
    return !!m && !m.custom && (favs || []).some(function (t) { return t === m.home || t === m.away; });
  }

  // Upcoming matches involving a favourite team, by kickoff.
  function favMatches(matches, favs, now) {
    return Logic.upcomingMatches(matches, now).filter(function (m) { return isFavMatch(m, favs); });
  }

  // Search key: Turkish-aware lowercase, then letters folded so "besiktas" finds "Beşiktaş"
  // and "inter" finds "Inter" (Turkish lowercase of "I" is "ı").
  var FOLD = { "ı": "i", "ş": "s", "ç": "c", "ğ": "g", "ö": "o", "ü": "u", "â": "a", "î": "i", "û": "u", "é": "e" };
  function searchKey(s) {
    return Logic.normKey(s).replace(/i\u0307/g, "i").replace(/[ışçğöüâîûé]/g, function (c) { return FOLD[c]; });
  }

  // Search box in the team picker: case-insensitive "contains".
  function teamMatchesQuery(team, query) {
    var q = searchKey(query);
    return !q || searchKey(team).indexOf(q) !== -1;
  }

  // ---------- Google Calendar link (İ16) ----------
  var MATCH_MINUTES = 120;

  function utcStamp(t) { return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }

  // "20261101T170000Z/20261101T190000Z" for an Istanbul kickoff "2026-11-01T20:00:00+03:00".
  function calendarDates(kickoff, minutes) {
    var start = new Date(kickoff).getTime();
    return utcStamp(start) + "/" + utcStamp(start + (minutes || MATCH_MINUTES) * 60000);
  }

  function googleCalendarUrl(match, venue) {
    var title = Logic.matchTitle(match) + " · " + venue.name;
    var details = [match.league, match.broadcaster].filter(Boolean).join(" · ") + " · Maç Nerede? (prototip, sentetik veri)";
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(title) +
      "&dates=" + calendarDates(match.kickoff, MATCH_MINUTES) +
      "&details=" + encodeURIComponent(details) +
      "&location=" + encodeURIComponent(venue.name + ", " + venue.address);
  }

  // ---------- Promoted slot (M10, design only) ----------

  // At most one promoted venue from the already filtered + sorted list goes into the slot.
  // Several candidates rotate by Istanbul calendar day, in id order (deterministic).
  // `rest` keeps the original order and never repeats the pinned venue.
  function pickPromoted(sortedVenues, now) {
    var list = sortedVenues || [];
    var candidates = list.filter(function (v) { return v.promoted === true; })
      .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    if (!candidates.length) return { pinned: null, rest: list.slice() };
    var pinned = candidates[((Logic.istanbulDayNumber(now) % candidates.length) + candidates.length) % candidates.length];
    return { pinned: pinned, rest: list.filter(function (v) { return v !== pinned; }) };
  }

  // Package shown as active in the panel (no payment in the prototype).
  function packageFor(venue) { return venue && venue.promoted ? "one-cikan" : "ucretsiz"; }

  // ---------- Entry-flow variants (decision #30) ----------
  var VARIANTS = { a: "Mekan önce", b: "Maç önce" };

  // Only the exact hashes "#akis-a" / "#akis-b" select a variant.
  function variantFromHash(hash) {
    var m = /^#akis-([ab])$/.exec(String(hash || ""));
    return m ? m[1] : null;
  }

  // Hash wins over the stored choice; default is "a" (current behaviour).
  function resolveVariant(hash, stored) {
    return variantFromHash(hash) || (VARIANTS.hasOwnProperty(stored) ? stored : "a");
  }

  // Match list rows for variant B: groups (Bugün/Yarın/Bu hafta/Sonra) with venue counts in the region.
  function matchListGroups(matches, regionVenues, now) {
    return Logic.groupMatches(matches, now).map(function (g) {
      return {
        key: g.key, label: g.label, matches: g.matches.map(function (m) {
          return { match: m, venueCount: Logic.filterByMatch(regionVenues, m.id).length };
        })
      };
    });
  }

  // Moderated tests: "1 dk 05 sn" / "42 sn".
  function formatDuration(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + " sn";
    var r = s % 60;
    return Math.floor(s / 60) + " dk " + (r < 10 ? "0" : "") + r + " sn";
  }

  var api = {
    CAMPAIGN_FILTER: CAMPAIGN_FILTER,
    FILTER_CHIPS: FILTER_CHIPS,
    parseFilterParam: parseFilterParam,
    hasFeatures: hasFeatures,
    filterByFeatures: filterByFeatures,
    isCampaignActive: isCampaignActive,
    activeCampaigns: activeCampaigns,
    filterByCampaign: filterByCampaign,
    applyFilterChips: applyFilterChips,
    MAX_FAV_TEAMS: MAX_FAV_TEAMS,
    teamsFromMatches: teamsFromMatches,
    cleanFavTeams: cleanFavTeams,
    isFavMatch: isFavMatch,
    favMatches: favMatches,
    searchKey: searchKey,
    teamMatchesQuery: teamMatchesQuery,
    MATCH_MINUTES: MATCH_MINUTES,
    calendarDates: calendarDates,
    googleCalendarUrl: googleCalendarUrl,
    pickPromoted: pickPromoted,
    packageFor: packageFor,
    VARIANTS: VARIANTS,
    variantFromHash: variantFromHash,
    resolveVariant: resolveVariant,
    matchListGroups: matchListGroups,
    formatDuration: formatDuration,
    DAY_MS: DAY_MS
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MNDiscover = api;
})(this);
