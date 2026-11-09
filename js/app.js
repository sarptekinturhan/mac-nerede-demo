/*
 * Viewer screen (v0.3). Routes live in the URL hash so the back button works
 * and a filtered view can be shared as a link:
 *   #/<region>                          -> all venues showing an upcoming match (İ0)
 *   #/<region>?lig=<league>&mac=<id>    -> same, with optional filters (İ1)
 *   #/<region>/v/<venueId>?lig=..&mac=.. -> venue detail (filters kept for "back")
 * Old v0.1 links (#/<region>/m/<matchId>[/v/<venueId>]) still work as a match filter,
 * old "#/bolge2" links open Fatih.
 * v0.4: simpler cards (one next match, badges), reservation info and an inline "Sorun bildir" form
 * whose reports are stored on this device only; an in-page menu viewer (İ12).
 * Location (İ7) is asked only when the user taps the map's "Konumumu kullan" button and is kept
 * in memory only. Without location, venues in dense clusters come first (PM, v0.3).
 * v0.5: ratings/reviews (viewer-reviews.js), feature chips + "Kampanyalı" (?oz=yemek,kampanya),
 * campaigns, "Takımlarım" (viewer-teams.js, ?takim=1), Google Calendar links, one "Öne çıkan" slot,
 * and two entry flows for usability tests (decision #30): A "Mekan önce" (default), B "Maç önce"
 * (start screen = match list). "#akis-a" / "#akis-b" on load selects a variant.
 */
(function () {
  "use strict";
  var Logic = window.MNLogic;
  var REGIONS = window.MN_REGIONS;
  var REGION_ALIASES = { bolge2: "fatih" }; // v0.1/v0.2 placeholder id
  var TYPE_LABELS = { bar: "Bar", kafe: "Kafe", "kıraathane": "Kıraathane", restoran: "Restoran", "nargile kafe": "Nargile kafe" };
  var esc = Logic.escapeHtml;
  var D = window.MNDiscover;
  var Store = window.MNStorage;
  var Teams = window.MNViewerTeams;
  var Reviews = window.MNViewerReviews;
  var MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  var viewEl = document.getElementById("view");
  var resultsEl = document.getElementById("results");
  var mapWrap = document.getElementById("map-wrap");
  var regionSelect = document.getElementById("region");

  var mapErrorEl = document.getElementById("map-error");
  var geoMsgEl = document.getElementById("geo-msg");
  var map = null;
  var markerLayer = null;
  var geoMsgTimer = null;
  var lastViewKey = null;
  // status: idle | pending | granted | denied | unavailable
  var geo = { status: navigator.geolocation ? "idle" : "unavailable", pos: null };
  // Report form on the detail page: state survives re-renders of the same venue.
  var report = { venueId: null, state: "closed" }; // closed | open | sent
  var featuresOpen = false; // "Özellikler" chip row expanded (memory only)

  // ---------- Entry-flow variant (decision #30) ----------
  // Exactly "#akis-a" / "#akis-b" on load picks the variant, stores it and continues with normal routing.
  var flow = D.resolveVariant(location.hash, Store.loadFlow());
  applyHashVariant();

  // Also used when the hash changes on an open page (e.g. a tester pastes "#akis-b").
  function applyHashVariant() {
    var v = D.variantFromHash(location.hash);
    if (!v) return false;
    flow = v;
    Store.saveFlow(v);
    try { history.replaceState(null, "", location.pathname + location.search + "#/" + REGIONS[0].id); }
    catch (e) { location.hash = "#/" + REGIONS[0].id; }
    return true;
  }
  // Moderated tests: optional timer, started by hand, stops when a venue detail opens.
  // Memory only: nothing is stored or sent.
  var timer = { start: 0, running: false };

  // Always read fresh so panel edits (same browser) show up immediately.
  function currentData() {
    return Logic.buildViewerData(window.MN_VENUES, window.MN_MATCHES, window.MNStorage.loadOverrides(), window.MN_MENUS);
  }

  function findRegion(id) { return REGIONS.filter(function (r) { return r.id === id; })[0]; }
  function findIn(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

  // ---------- Routing ----------
  function parseRoute() {
    var raw = location.hash.replace(/^#\/?/, "");
    var q = raw.indexOf("?");
    var params = new URLSearchParams(q === -1 ? "" : raw.slice(q + 1));
    var parts = (q === -1 ? raw : raw.slice(0, q)).split("/");
    var regionId = REGION_ALIASES[parts[0]] || parts[0];
    var route = {
      region: findRegion(regionId) ? regionId : REGIONS[0].id,
      league: params.get("lig") || "",
      matchId: params.get("mac") || "",
      features: D.parseFilterParam(params.get("oz")),
      fav: params.get("takim") === "1",
      venueId: null
    };
    var i = 1;
    if (parts[i] === "m") { route.matchId = parts[i + 1] || ""; i += 2; } // v0.1 link
    if (parts[i] === "v") route.venueId = parts[i + 1] || null;
    return route;
  }

  // Drops filters that do not apply now (unknown league, past/unknown match, match outside league).
  // v0.5: "Takımlarım" (fav) replaces the league filter and needs at least one favourite.
  function cleanFilters(route, matches, now, favs) {
    var leagues = Logic.leaguesFromMatches(matches, now);
    var fav = !!route.fav && favs.length > 0;
    var league = !fav && leagues.indexOf(route.league) !== -1 ? route.league : "";
    var options = fav ? D.favMatches(matches, favs, now) : Logic.matchesForLeague(matches, league, now);
    var match = options.filter(function (m) { return m.id === route.matchId; })[0] || null;
    return { leagues: leagues, league: league, fav: fav, options: options, match: match, features: route.features || [] };
  }

  function filtersOf(c) {
    return { league: c.league, matchId: c.match ? c.match.id : "", features: c.features, fav: c.fav };
  }

  function href(region, f, venueId) {
    var h = "#/" + region + (venueId ? "/v/" + venueId : "");
    var q = [];
    if (f && f.league) q.push("lig=" + encodeURIComponent(f.league));
    if (f && f.matchId) q.push("mac=" + encodeURIComponent(f.matchId));
    if (f && f.features && f.features.length) q.push("oz=" + f.features.join(","));
    if (f && f.fav) q.push("takim=1");
    return q.length ? h + "?" + q.join("&") : h;
  }

  function go(region, f) { location.hash = href(region, f); }

  function matchTitle(m) { return esc(Logic.matchTitle(m)); }
  function customTag(m) { return m.custom ? ' <span class="tag" title="Bu maçı mekan kendisi ekledi">mekan ekledi</span>' : ""; }
  function typeLabel(v) { return TYPE_LABELS[v.type] || ""; }
  function distanceTo(v) { return geo.pos ? Logic.haversine(geo.pos, [v.lat, v.lng]) : null; }

  function emptyRegionNotice(region) {
    return '<div class="empty"><p><strong>' + esc(region.label) + "</strong> için henüz mekan eklenmedi.</p>" +
      '<p>Şimdilik <a href="' + href(REGIONS[0].id) + '">' + esc(REGIONS[0].label) + "</a> bölgesine bakabilirsin.</p></div>";
  }

  // ---------- Location (İ7) ----------
  function requestLocation() {
    if (geo.status === "pending") return;
    if (!navigator.geolocation) { locationFailed(); return; }
    geo.status = "pending";
    render();
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        geo = { status: "granted", pos: [p.coords.latitude, p.coords.longitude] };
        geoMsgEl.hidden = true;
        render();
      }, locationFailed, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    } catch (e) {
      locationFailed();
    }
  }

  // Denied, timeout or unavailable: never block, just say so near the map for a few seconds.
  function locationFailed() {
    geo = { status: "denied", pos: null };
    render();
    geoMsgEl.textContent = "Konum izni alınamadı. Mekanlar yoğun bölgeye göre sıralı.";
    geoMsgEl.hidden = false;
    clearTimeout(geoMsgTimer);
    geoMsgTimer = setTimeout(function () { geoMsgEl.hidden = true; geoMsgEl.textContent = ""; }, 6000);
  }

  function sortLine(pinned) {
    var dense = "Sıralama: mekanların yoğun olduğu bölgeler önce";
    var text = geo.status === "granted" ? "Sıralama: sana yakınlığa göre"
      : geo.status === "pending" ? dense + " · Konumun alınıyor…"
      : geo.status === "denied" ? dense + " · Konum izni alınamadı"
      : geo.status === "unavailable" ? dense + " · Bu tarayıcı konum paylaşmayı desteklemiyor"
      : dense + " · Konum izni verirsen yakınlığa göre sıralarım";
    // Ratings do not change the order in v0.5 (later version). The promoted slot is labelled honestly.
    if (pinned) text += " · En üstteki “Öne çıkan” mekan ücretli listelemedir";
    return '<p class="sort-line" id="sort-info" aria-live="polite">' + text + "</p>";
  }

  // ---------- "Konumumu kullan" button on the map (Leaflet control, bottom-right) ----------
  var CROSSHAIR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
    '<path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function locateButtonHtml() {
    return '<button type="button" class="locate-btn" data-locate aria-label="Konumumu kullan" title="Konumumu kullan">' + CROSSHAIR + "</button>";
  }

  function updateLocateButton() {
    var b = document.querySelector("[data-locate]");
    if (!b) return;
    b.setAttribute("aria-busy", geo.status === "pending" ? "true" : "false");
    b.setAttribute("aria-pressed", geo.status === "granted" ? "true" : "false");
  }

  // ---------- Map ----------
  function ensureMap() {
    if (map) return map;
    if (typeof window.L === "undefined") {
      document.getElementById("map").hidden = true;
      mapErrorEl.hidden = false;
      // Keep location usable even without the map.
      if (!mapErrorEl.querySelector("[data-locate]")) mapErrorEl.insertAdjacentHTML("beforeend", " " + locateButtonHtml());
      return null;
    }
    map = L.map("map", { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    map.createPane("user").style.zIndex = 650; // user's dot above venue pins
    var Locate = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: function () {
        var box = L.DomUtil.create("div", "leaflet-bar locate-control");
        box.innerHTML = locateButtonHtml();
        L.DomEvent.disableClickPropagation(box);
        L.DomEvent.on(box.firstChild, "click", requestLocation);
        return box;
      }
    });
    new Locate().addTo(map);
    return map;
  }

  function showOnMap(region, f, venues) {
    mapWrap.hidden = false;
    var m = ensureMap();
    if (!m) return;
    m.invalidateSize();
    markerLayer.clearLayers();
    var points = venues.map(function (v) {
      L.marker([v.lat, v.lng], { title: v.name, alt: v.name })
        .bindPopup("<strong>" + esc(v.name) + '</strong><br><a href="' + href(region.id, f, v.id) + '">Detay</a>')
        .addTo(markerLayer);
      return [v.lat, v.lng];
    });
    if (geo.pos) {
      L.circleMarker(geo.pos, { pane: "user", radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 })
        .bindTooltip("Konumun").addTo(markerLayer);
      // Include the user in the view only when nearby, otherwise the map zooms out to the whole country.
      var near = points.some(function (p) { return Logic.haversine(geo.pos, p) < 3000; });
      if (near) points.push(geo.pos);
    }
    if (points.length) m.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    else m.setView(region.center, region.zoom);
  }

  // ---------- Main view: all venues + optional filters ----------
  var CAL_CHECK = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">' +
    '<rect x="1.5" y="2.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M5.5 10l2 2 3-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  function acceptsReservation(v) { var r = Logic.cleanReservation(v.reservation); return !!(r && r.accepts); }

  // Paid packages only on cards; the detail also lists free-to-air TRT Spor.
  function platformBadges(v, withFree) {
    var list = (v.platforms || []).concat(withFree ? [Logic.FREE_PLATFORM] : []);
    return list.map(function (p) { return '<span class="pf">' + esc(p) + "</span>"; }).join("");
  }

  function ratingSmall(sum) {
    return sum ? ' · <span class="rating-sm"><span aria-hidden="true">★</span> ' + window.MNReviews.formatRating(sum.avg) +
      '<span class="sr-only"> puan,</span> (' + sum.count + '<span class="sr-only"> yorum</span>)</span>' : "";
  }

  var PROMO_BADGE = '<span class="promo-badge">Öne çıkan</span>';

  // Card (decision #19): name + distance, type (+ v0.5 small rating, "Öne çıkan" label), the single next
  // relevant match, one row of badges ("Kampanya" first when a campaign applies to the selected match).
  function venueCard(region, f, v, scope, matches, now) {
    var m = scope.match || Logic.nextRelevantMatch(v, matches, now, { league: scope.league, matchIds: scope.matchIds });
    var d = distanceTo(v);
    var hasCampaign = D.activeCampaigns(v, matches, now, scope.match ? scope.match.id : "").length > 0;
    var badges = (hasCampaign ? '<span class="camp-badge">Kampanya</span>' : "") +
      (acceptsReservation(v) ? '<span class="res-badge">' + CAL_CHECK + "Rezervasyon</span>" : "") + platformBadges(v);
    return '<li><a class="card venue" href="' + href(region.id, f, v.id) + '">' +
      '<span class="card-head"><span class="title">' + esc(v.name) + "</span>" +
      (d !== null ? '<span class="dist">' + Logic.formatDistance(d) + "</span>" : "") + "</span>" +
      '<span class="meta type-line"><span>' + (typeLabel(v) || "&nbsp;") + ratingSmall(scope.ratings[v.id]) + "</span>" +
      (v.promoted ? PROMO_BADGE : "") + "</span>" +
      '<span class="next-line">' + (m ? '<span class="when">' + Logic.formatKickoffShort(m.kickoff, now) + "</span> · " + favStar(m, scope.favs) + matchTitle(m) : "&nbsp;") + "</span>" +
      '<span class="badges">' + badges + "</span></a></li>";
  }

  function favStar(m, favs) {
    return D.isFavMatch(m, favs) ? '<span class="fav-star" title="Takımın oynuyor">★</span><span class="sr-only">Takımın: </span>' : "";
  }

  // League chips row, with "Takımlarım" first (v0.5), the favourites line and the inline team picker.
  function chipsHtml(c, favs, teams) {
    var chips = [{ value: "", label: "Tümü" }].concat(c.leagues.map(function (l) { return { value: l, label: l }; }));
    return '<div class="chips" role="group" aria-label="Lig filtresi">' + Teams.chipHtml(favs, c.fav) +
      chips.map(function (ch) {
        var on = !c.fav && ch.value === c.league;
        return '<button type="button" class="chip" data-league="' + esc(ch.value) + '" aria-pressed="' + on + '">' + esc(ch.label) + "</button>";
      }).join("") + "</div>" +
      (c.fav && !Teams.isOpen() ? Teams.lineHtml(favs) : "") + Teams.pickerHtml(teams);
  }

  function featureRowHtml(f) {
    return '<div class="chips feature-row" id="feature-row" role="group" aria-label="Özellik filtresi (seçilenlerin hepsi)"' + (featuresOpen ? "" : " hidden") + ">" +
      D.FILTER_CHIPS.map(function (ch) {
        var on = f.features.indexOf(ch.id) !== -1;
        return '<button type="button" class="chip small' + (ch.id === D.CAMPAIGN_FILTER ? " camp-chip" : "") + '" data-feature="' + ch.id + '" aria-pressed="' + on + '">' + esc(ch.label) + "</button>";
      }).join("") + "</div>";
  }

  function isFiltered(f) { return !!(f.league || f.matchId || f.fav || (f.features && f.features.length)); }

  function renderMain(region, route, data, now, favs, teams) {
    var matches = data.matches;
    var c = cleanFilters(route, matches, now, favs);
    var f = filtersOf(c);
    if (flow === "b" && !c.match) { renderMatchList(region, c, f, data, now, favs, teams); return; }
    var base = Logic.venuesWithUpcoming(data.venues, matches, region.id, now);
    var scopeIds = c.options.map(function (m) { return m.id; });
    var scoped = c.fav ? base.filter(function (v) { return v.matchIds.some(function (id) { return scopeIds.indexOf(id) !== -1; }); })
      : Logic.filterByLeague(base, matches, f.league, now);
    var venues = D.applyFilterChips(Logic.filterByMatch(scoped, f.matchId), f.features, matches, now, f.matchId);
    var sortScope = { league: f.league, matchId: f.matchId, matchIds: c.fav ? scopeIds : null };
    // NOTE: ratings do not affect sorting in v0.5 (decision #23; "Puanın sıralamaya etkisi" is a later version).
    venues = geo.pos ? Logic.sortByDistance(venues, geo.pos) : Logic.sortByDensity(venues, matches, now, sortScope);
    var slot = D.pickPromoted(venues, now); // at most one pinned "Öne çıkan" venue, never repeated below
    var filtered = isFiltered(f);

    var html = '<h1 class="sr-only">Maç izlenecek mekanlar</h1>' +
      (flow === "b" ? '<a class="back" href="' + href(region.id, { league: f.league, fav: f.fav }) + '">← Maçlar</a>' : "") +
      '<div class="filters">' + chipsHtml(c, favs, teams);

    // Match select, grouped by day (İ5: sorted by time, past matches hidden); ★ = favourite team plays
    html += '<label class="sr-only" for="match-filter">Maç filtresi</label><select id="match-filter">' +
      '<option value="">' + (c.fav ? "Takımlarımın tüm maçları" : f.league ? "Tüm " + esc(f.league) + " maçları" : "Tüm maçlar") + "</option>";
    Logic.groupMatches(c.options, now).forEach(function (g) {
      html += '<optgroup label="' + g.label + '">' + g.matches.map(function (m) {
        var n = D.applyFilterChips(Logic.filterByMatch(base, m.id), f.features, matches, now, m.id).length;
        return '<option value="' + esc(m.id) + '"' + (m.id === f.matchId ? " selected" : "") + ">" + (D.isFavMatch(m, favs) ? "★ " : "") +
          matchTitle(m) + " · " + Logic.formatKickoff(m.kickoff) + (m.broadcaster ? " · " + esc(m.broadcaster) : "") +
          " (" + (n ? n + " mekan" : "mekan yok") + ")" + (m.custom ? " · mekan ekledi" : "") + "</option>";
      }).join("") + "</optgroup>";
    });
    html += "</select>";

    // Result line + "Özellikler" toggle + clear, the feature chips, then the sort explanation
    var label = c.match ? matchTitle(c.match) : c.fav ? "Takımlarım" : f.league ? esc(f.league) : "Tüm maçlar";
    var nFeat = f.features.length;
    html += '<div class="result-line"><p id="result-count" aria-live="polite"><strong>' + venues.length + " mekan</strong> · " + label + "</p>" +
      '<div class="result-actions"><button type="button" class="feat-toggle" id="features-toggle" aria-expanded="' + featuresOpen + '" aria-controls="feature-row">' +
      "Özellikler" + (nFeat ? " · " + nFeat : "") + '<span class="caret" aria-hidden="true">' + (featuresOpen ? "▴" : "▾") + "</span></button>" +
      (filtered ? '<button type="button" class="link-btn" id="clear-filters">Filtreleri temizle</button>' : "") +
      "</div></div>" + featureRowHtml(f) + sortLine(!!slot.pinned) + "</div>";
    viewEl.innerHTML = html;

    showOnMap(region, f, venues);
    updateLocateButton();

    var clearBtn = '<p><button type="button" class="link-btn" data-clear>Filtreleri temizle</button></p>';
    if (!Logic.venuesInRegion(data.venues, region.id).length) { resultsEl.innerHTML = emptyRegionNotice(region); return; }
    if (!venues.length) {
      var msg = nFeat && scoped.length ? "Seçtiğin özelliklere uyan mekan bulunamadı."
        : c.match ? "Bu maçı gösteren mekan bulunamadı."
        : c.fav ? "Takımlarının yaklaşan maçlarını gösteren mekan bulunamadı."
        : f.league ? "Bu ligden maç gösteren mekan bulunamadı."
        : "Bu bölgede yaklaşan maç gösteren mekan yok.";
      resultsEl.innerHTML = '<div class="empty"><p><strong>' + msg + "</strong></p>" + (filtered ? clearBtn : "") + "</div>";
      return;
    }
    var cardScope = { league: f.league, match: c.match, matchIds: sortScope.matchIds, favs: favs, ratings: ratingSummaries() };
    var card = function (v) { return venueCard(region, f, v, cardScope, matches, now); };
    resultsEl.innerHTML = (slot.pinned
      ? '<section class="promo-slot" aria-labelledby="promo-title"><p class="promo-title" id="promo-title">Öne çıkan <span class="hint">· ücretli listeleme</span></p>' +
        '<ul class="cards">' + card(slot.pinned) + "</ul></section>" : "") +
      (slot.rest.length ? '<ul class="cards">' + slot.rest.map(card).join("") + "</ul>" : "");
  }

  function ratingSummaries() { return window.MNReviews.summaries(window.MN_REVIEWS || {}, Store.loadMyReviews()); }

  // ---------- Variant B "Maç önce" (decision #30): start screen = upcoming matches ----------
  function renderMatchList(region, c, f, data, now, favs, teams) {
    mapWrap.hidden = true;
    var base = Logic.venuesWithUpcoming(data.venues, data.matches, region.id, now);
    var label = c.fav ? "Takımlarım" : f.league ? esc(f.league) : "Tüm maçlar";
    var filtered = !!(f.league || f.fav);
    viewEl.innerHTML = '<h1 class="sr-only">Yaklaşan maçlar</h1><div class="filters">' + chipsHtml(c, favs, teams) +
      '<div class="result-line"><p id="result-count" aria-live="polite"><strong>' + c.options.length + " maç</strong> · " + label + "</p>" +
      (filtered ? '<button type="button" class="link-btn" id="clear-filters">Filtreleri temizle</button>' : "") + "</div>" +
      '<p class="sort-line">Bir maça dokun, onu gösteren mekanları gör.</p></div>';
    if (!Logic.venuesInRegion(data.venues, region.id).length) { resultsEl.innerHTML = emptyRegionNotice(region); return; }
    var groups = D.matchListGroups(c.options, base, now);
    if (!groups.length) {
      resultsEl.innerHTML = '<div class="empty"><p><strong>' + (c.fav ? "Takımlarının yaklaşan maçı yok." : "Yaklaşan maç yok.") + "</strong></p></div>";
      return;
    }
    resultsEl.innerHTML = groups.map(function (g) {
      return '<h2 class="group">' + g.label + '</h2><ul class="cards">' + g.matches.map(function (row) {
        var m = row.match;
        return '<li><a class="card match-row" href="' + href(region.id, { league: f.league, fav: f.fav, matchId: m.id }) + '">' +
          '<span class="mr-top"><span class="meta">' + esc(m.league) + "</span>" +
          '<span class="when">' + Logic.formatKickoffShort(m.kickoff, now) + "</span></span>" +
          '<span class="title">' + favStar(m, favs) + matchTitle(m) + customTag(m) + "</span>" +
          '<span class="mr-bottom"><span class="meta">' + (m.broadcaster ? esc(m.broadcaster) : "&nbsp;") + "</span>" +
          '<span class="count' + (row.venueCount ? "" : " zero") + '">' + (row.venueCount ? row.venueCount + " mekan" : "Mekan yok") + "</span></span></a></li>";
      }).join("") + "</ul>";
    }).join("");
  }

  // ---------- Venue detail ----------
  function dayLabel(ymd) {
    var p = ymd.split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1];
  }

  // "Kampanyalar" (İ15): only active ones; each says which match it is for and until when.
  function campaignsHtml(venue, matches, now) {
    var list = D.activeCampaigns(venue, matches, now);
    if (!list.length) return "";
    return '<h2 class="section">Kampanyalar</h2><ul class="campaigns">' + list.map(function (k) {
      var m = k.matchId && findIn(matches, k.matchId);
      return '<li><span class="camp-badge">Kampanya</span> <strong>' + esc(k.text) + "</strong>" +
        '<span class="meta">' + (m ? "Sadece " + matchTitle(m) + " · " + Logic.formatKickoffShort(m.kickoff, now) : "Her maçta") +
        (k.endDate ? " · son gün " + dayLabel(k.endDate) : "") + "</span></li>";
    }).join("") + "</ul>";
  }

  function featuresHtml(venue) {
    return venue.features.length
      ? '<span class="badges">' + venue.features.map(function (id) { return '<span class="feat">' + esc(Logic.featureLabel(id)) + "</span>"; }).join("") + "</span>"
      : '<span class="meta">Belirtilmemiş</span>';
  }

  function renderDetail(region, route, venue, data, now, favs) {
    mapWrap.hidden = true;
    resultsEl.innerHTML = "";
    var c = cleanFilters(route, data.matches, now, favs);
    var f = filtersOf(c);
    var upcoming = Logic.nextMatchesForVenue(venue, data.matches, now);
    var list = upcoming.length
      ? '<ul class="match-list">' + upcoming.map(function (m) {
        var picked = c.match && m.id === c.match.id;
        return "<li" + (picked ? ' class="picked"' : "") + '><span class="when">' + Logic.formatKickoff(m.kickoff) + "</span>" +
          '<span class="title">' + favStar(m, favs) + matchTitle(m) + (picked ? ' <span class="badge">Seçtiğin maç</span>' : "") + "</span>" +
          '<span class="meta-row"><span class="meta">' + esc(m.league) + (m.broadcaster ? " · " + esc(m.broadcaster) : "") + customTag(m) + "</span>" +
          '<a class="cal-link" target="_blank" rel="noopener" href="' + esc(D.googleCalendarUrl(m, venue)) + '" aria-label="Takvime ekle: ' + matchTitle(m) + '">Takvime ekle</a></span></li>';
      }).join("") + "</ul>"
      : '<p class="sub">Bu mekan henüz yaklaşan bir maç işaretlemedi.</p>';
    var notShown = c.match && venue.matchIds.indexOf(c.match.id) === -1
      ? '<p class="notice">Seçtiğin maçı (' + matchTitle(c.match) + ") göstermiyor.</p>" : "";
    var d = distanceTo(venue);

    viewEl.innerHTML = '<a class="back" href="' + href(region.id, f) + '">← Mekanlar</a>' +
      '<article class="detail"><h1>' + esc(venue.name) + "</h1>" +
      (venue.promoted ? '<p class="promo-line">' + PROMO_BADGE + ' <span class="hint">Bu mekan ücretli paketle öne çıkıyor.</span></p>' : "") +
      Reviews.summaryLine(venue) + notShown +
      '<dl class="facts-list">' +
      (typeLabel(venue) ? "<dt>Tür</dt><dd>" + typeLabel(venue) + "</dd>" : "") +
      "<dt>Adres</dt><dd>" + esc(venue.address) + "</dd>" +
      (d !== null ? "<dt>Uzaklık</dt><dd>" + Logic.formatDistance(d) + "</dd>" : "") +
      "<dt>Ekran sayısı</dt><dd>" + venue.screens + "</dd>" +
      "<dt>Ses</dt><dd>" + (venue.soundOn ? "Açık" : "Kapalı") + "</dd>" +
      "<dt>Kapasite</dt><dd>" + venue.capacity + " kişi</dd>" +
      '<dt>Platformlar</dt><dd><span class="badges">' + platformBadges(venue, true) + "</span></dd>" +
      "<dt>Rezervasyon</dt><dd>" + reservationLine(venue) + "</dd>" +
      "<dt>Özellikler</dt><dd>" + featuresHtml(venue) + "</dd>" +
      "<dt>Telefon</dt><dd>" + esc(venue.phone) + "</dd></dl>" +
      '<div class="actions">' +
      '<a class="btn primary" target="_blank" rel="noopener" href="' + Logic.directionsUrl(venue.lat, venue.lng) + '">Yol tarifi</a>' +
      '<a class="btn" href="' + Logic.telHref(venue.phone) + '">Ara</a></div>' +
      '<p class="hint">Telefon numaraları sentetiktir, arama gerçek bir mekana gitmez.</p>' +
      (venue.menu.length
        ? '<button type="button" class="btn menu-open" data-menu-open>Menüyü gör (' + venue.menu.length + " sayfa)</button>"
        : '<p class="sub menu-none">Menü eklenmemiş</p>') +
      campaignsHtml(venue, data.matches, now) +
      '<h2 class="section">Gösterdiği maçlar (' + upcoming.length + ")</h2>" + list +
      Reviews.html(venue) +
      '<div id="report-box" class="report-box"></div></article>';

    if (report.venueId !== venue.id) report = { venueId: venue.id, state: "closed" };
    renderReport(venue, upcoming, c.match);
  }

  function reservationLine(v) {
    var r = Logic.cleanReservation(v.reservation);
    return esc(Logic.reservationText(r)) + (r && r.note ? '<br><span class="meta">' + esc(r.note) + "</span>" : "");
  }

  // ---------- Menu viewer (İ12): in-page dialog, pages side by side (swipe) ----------
  var menuViewer = document.getElementById("menu-viewer");
  var menuOpener = null;

  function openMenu(opener) {
    var d = currentDetail();
    if (!d || !d.venue.menu.length) return;
    var pages = d.venue.menu;
    menuOpener = opener;
    menuViewer.innerHTML = '<div class="mv-bar"><h2 id="menu-viewer-title">' + esc(d.venue.name) + " · Menü</h2>" +
      '<span class="mv-count" aria-live="polite">1 / ' + pages.length + "</span>" +
      '<button type="button" class="mv-close" data-menu-close>Kapat</button></div>' +
      '<div class="mv-pages" tabindex="0" aria-label="Menü sayfaları, kaydırarak geç">' + pages.map(function (src, i) {
        return '<div class="mv-page"><img src="' + esc(src) + '" alt="Menü sayfası ' + (i + 1) + " / " + pages.length + '"></div>';
      }).join("") + "</div>" +
      (pages.length > 1 ? '<div class="mv-nav"><button type="button" class="btn" data-menu-step="-1">Önceki</button>' +
        '<button type="button" class="btn" data-menu-step="1">Sonraki</button></div>' : "");
    menuViewer.hidden = false;
    document.body.classList.add("no-scroll");
    menuViewer.querySelector(".mv-pages").addEventListener("scroll", updateMenuCount);
    menuViewer.querySelector("[data-menu-close]").focus();
  }

  function menuIndex() {
    var box = menuViewer.querySelector(".mv-pages");
    return box ? Math.round(box.scrollLeft / Math.max(1, box.clientWidth)) : 0;
  }

  function updateMenuCount() {
    var n = menuViewer.querySelectorAll(".mv-page").length;
    menuViewer.querySelector(".mv-count").textContent = Math.min(n, menuIndex() + 1) + " / " + n;
  }

  function stepMenu(dir) {
    var box = menuViewer.querySelector(".mv-pages");
    var n = menuViewer.querySelectorAll(".mv-page").length;
    var i = Math.max(0, Math.min(n - 1, menuIndex() + dir));
    box.scrollTo({ left: i * box.clientWidth, behavior: "smooth" });
  }

  function closeMenu() {
    if (menuViewer.hidden) return;
    menuViewer.hidden = true;
    menuViewer.innerHTML = "";
    document.body.classList.remove("no-scroll");
    var back = menuOpener && document.contains(menuOpener) ? menuOpener : document.querySelector("[data-menu-open]");
    if (back) back.focus();
    menuOpener = null;
  }

  menuViewer.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-menu-close")) closeMenu();
    else if (t.hasAttribute("data-menu-step")) stepMenu(parseInt(t.getAttribute("data-menu-step"), 10));
  });
  // Escape closes, arrow keys page, Tab stays inside the dialog.
  menuViewer.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); closeMenu(); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); stepMenu(e.key === "ArrowRight" ? 1 : -1); return; }
    if (e.key !== "Tab") return;
    var f = menuViewer.querySelectorAll("button, [tabindex='0']");
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---------- "Sorun bildir" (İ10): inline form, stored on this device only ----------
  function renderReport(venue, upcoming, pickedMatch) {
    var box = document.getElementById("report-box");
    if (!box) return;
    if (report.state === "sent") {
      box.innerHTML = '<div class="report-thanks" tabindex="-1" role="status"><p><strong>Teşekkürler, bildirimin alındı.</strong></p>' +
        '<p class="hint">Prototip: bildirimler yalnızca bu cihazda saklanır.</p></div>';
      return;
    }
    if (report.state !== "open") {
      box.innerHTML = '<button type="button" class="btn secondary report-open" data-report-open>Sorun bildir</button>';
      return;
    }
    // The "no-match" option names the selected match, or offers an optional select of this venue's matches.
    var matchField = pickedMatch
      ? '<input type="hidden" name="matchId" value="' + esc(pickedMatch.id) + '"><span class="meta">Maç: ' + matchTitle(pickedMatch) + "</span>"
      : upcoming.length
        ? '<label class="sub-field">Hangi maç? <span class="optional">(isteğe bağlı)</span><select name="matchId"><option value="">Seçmeden devam et</option>' +
          upcoming.map(function (m) {
            return '<option value="' + esc(m.id) + '">' + matchTitle(m) + " · " + Logic.formatKickoffShort(m.kickoff, new Date()) + "</option>";
          }).join("") + "</select></label>"
        : "";
    var options = Logic.REPORT_REASONS.map(function (r) {
      return '<label class="radio-row"><input type="radio" name="reason" value="' + r.id + '"><span>' + esc(r.label) + "</span></label>" +
        (r.id === "no-match" && matchField ? '<div class="match-field" data-match-field hidden>' + matchField + "</div>" : "");
    }).join("");
    box.innerHTML = '<form class="report-form" id="report-form" novalidate>' +
      '<fieldset><legend>Sorun bildir</legend>' + options +
      '<p id="report-reason-err" class="error field-err" role="alert" hidden></p>' +
      '<label class="field" for="report-text">Açıklama <span class="optional">(isteğe bağlı)</span></label>' +
      '<textarea id="report-text" name="text" rows="3" maxlength="' + Logic.MAX_REPORT_TEXT + '" aria-describedby="report-count"></textarea>' +
      '<p id="report-count" class="hint counter">0/' + Logic.MAX_REPORT_TEXT + "</p>" +
      '<p id="report-text-err" class="error field-err" role="alert" hidden></p>' +
      '<div class="actions"><button type="submit" class="btn primary">Gönder</button>' +
      '<button type="button" class="btn" data-report-cancel>Vazgeç</button></div></fieldset></form>';
  }

  function currentDetail() {
    var route = parseRoute();
    var data = currentData();
    var venue = route.venueId && findIn(data.venues, route.venueId);
    if (!venue) return null;
    var c = cleanFilters(route, data.matches, new Date(), Teams.favs(D.teamsFromMatches(data.matches)));
    return { venue: venue, upcoming: Logic.nextMatchesForVenue(venue, data.matches, new Date()), match: c.match };
  }

  function setReportState(state) {
    var d = currentDetail();
    if (!d) return;
    report = { venueId: d.venue.id, state: state };
    renderReport(d.venue, d.upcoming, d.match);
    var focus = state === "open" ? 'input[name="reason"]' : state === "sent" ? ".report-thanks" : "[data-report-open]";
    var el = document.querySelector("#report-box " + focus);
    if (el) el.focus();
  }

  function showReportError(id, msg) {
    var el = document.getElementById(id);
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function submitReport(form) {
    var d = currentDetail();
    if (!d) return;
    var checked = form.querySelector('input[name="reason"]:checked');
    var matchEl = form.querySelector('[name="matchId"]');
    var res = Logic.validateReport({ reason: checked ? checked.value : "", matchId: matchEl ? matchEl.value : "", text: form.text.value });
    showReportError("report-reason-err", res.errors.reason);
    showReportError("report-text-err", res.errors.text);
    if (!res.ok) {
      (res.errors.reason ? form.querySelector('input[name="reason"]') : form.text).focus();
      return;
    }
    if (!window.MNStorage.addReport(Logic.buildReport(d.venue.id, res.value, new Date()))) {
      showReportError("report-text-err", "Kaydedilemedi: tarayıcı depolamaya izin vermiyor (ör. gizli sekme).");
      return;
    }
    setReportState("sent");
  }

  function render() {
    var now = new Date();
    var route = parseRoute();
    var region = findRegion(route.region);
    regionSelect.value = region.id;
    var data = currentData();
    var venue = route.venueId && findIn(data.venues, route.venueId);
    var teams = D.teamsFromMatches(data.matches);
    var favs = Teams.favs(teams);

    // Re-rendering replaces the filter controls; keep keyboard focus on the same control.
    var active = document.activeElement;
    var focusKey = active && viewEl.contains(active)
      ? (active.id ? "#" + active.id
        : active.hasAttribute("data-league") ? '[data-league="' + active.getAttribute("data-league") + '"]'
        : active.hasAttribute("data-feature") ? '[data-feature="' + active.getAttribute("data-feature") + '"]' : null)
      : null;

    if (venue) renderDetail(region, route, venue, data, now, favs);
    else renderMain(region, route, data, now, favs, teams);
    if (venue) stopTimer();

    var viewKey = venue ? "detail:" + venue.id : "main";
    if (viewKey !== lastViewKey) window.scrollTo(0, 0); // filter changes keep the scroll position
    lastViewKey = viewKey;
    if (focusKey) {
      var el = viewEl.querySelector(focusKey) || document.getElementById("match-filter");
      if (el) el.focus();
    }
  }

  // ---------- Init ----------
  regionSelect.innerHTML = REGIONS.map(function (r) {
    return '<option value="' + r.id + '">' + esc(r.label) + "</option>";
  }).join("");

  // Changing region keeps the filters, so the list and map update in place (İ3).
  regionSelect.addEventListener("change", function () {
    go(regionSelect.value, parseRoute());
  });

  // Filter controls are re-rendered on every change, so listen on stable containers.
  function teamsNow() { return D.teamsFromMatches(currentData().matches); }

  function focusSoon(selector) {
    var el = document.querySelector(selector);
    if (el) el.focus();
  }

  function onClick(e) {
    var t = e.target.closest("button");
    if (!t) return;
    var route = parseRoute();
    if (Reviews.handleClick(t)) return;
    if (t.hasAttribute("data-league")) {
      var league = t.getAttribute("data-league");
      var current = findIn(currentData().matches, route.matchId);
      var keep = league && current && current.league === league ? route.matchId : "";
      go(route.region, { league: league, matchId: keep, features: route.features });
    } else if (t.id === "fav-chip") {
      var favs = Teams.favs(teamsNow());
      if (!favs.length) {
        if (Teams.isOpen()) Teams.close(); else Teams.open([]);
        render();
        focusSoon(Teams.isOpen() ? "#fav-search" : "#fav-chip");
      } else {
        Teams.close();
        // "Takımlarım" replaces the league filter; a selected match stays only if a favourite plays in it.
        var cur = findIn(currentData().matches, route.matchId);
        var on = !(route.fav && favs.length);
        go(route.region, { fav: on, matchId: on && D.isFavMatch(cur, favs) ? route.matchId : "", features: route.features });
      }
    } else if (t.hasAttribute("data-fav-edit")) {
      Teams.open(Teams.favs(teamsNow()));
      render();
      focusSoon("#fav-search");
    } else if (t.hasAttribute("data-fav-cancel")) {
      Teams.close();
      render();
      focusSoon("#fav-chip");
    } else if (t.hasAttribute("data-fav-save")) {
      var saved = Teams.save(teamsNow());
      if (!saved) { document.getElementById("fav-count").textContent = "Kaydedilemedi: tarayıcı depolamaya izin vermiyor."; return; }
      var next = { fav: saved.length > 0, features: route.features, matchId: "" };
      if (!saved.length) { next.league = route.league; next.matchId = route.matchId; }
      var target = href(route.region, next);
      if (location.hash === target) render(); else location.hash = target;
      focusSoon("#fav-chip");
    } else if (t.id === "features-toggle") {
      featuresOpen = !featuresOpen;
      render();
    } else if (t.hasAttribute("data-feature")) {
      var id = t.getAttribute("data-feature");
      var feats = route.features.indexOf(id) === -1 ? route.features.concat(id) : route.features.filter(function (x) { return x !== id; });
      go(route.region, { league: route.league, matchId: route.matchId, fav: route.fav, features: D.parseFilterParam(feats.join(",")) });
    } else if (t.id === "clear-filters" || t.hasAttribute("data-clear")) {
      go(route.region, null);
    } else if (t.hasAttribute("data-menu-open")) {
      openMenu(t);
    } else if (t.hasAttribute("data-report-open")) {
      setReportState("open");
    } else if (t.hasAttribute("data-report-cancel")) {
      setReportState("closed");
    }
  }
  viewEl.addEventListener("click", onClick);
  mapErrorEl.addEventListener("click", function (e) { if (e.target.closest("[data-locate]")) requestLocation(); });
  resultsEl.addEventListener("click", onClick);
  viewEl.addEventListener("submit", function (e) {
    if (e.target.id === "review-form") { e.preventDefault(); Reviews.handleSubmit(e.target); return; }
    if (e.target.id !== "report-form") return;
    e.preventDefault();
    submitReport(e.target);
  });
  viewEl.addEventListener("input", function (e) {
    if (Teams.handleInput(e) || Reviews.handleInput(e)) return;
    if (e.target.id === "report-text") {
      document.getElementById("report-count").textContent = e.target.value.length + "/" + Logic.MAX_REPORT_TEXT;
    }
  });
  viewEl.addEventListener("change", function (e) {
    if (e.target.name === "fav-team" || e.target.name === "rating") return; // handled on "input"
    if (e.target.name === "reason") {
      var mf = viewEl.querySelector("[data-match-field]");
      if (mf) mf.hidden = e.target.value !== "no-match";
      showReportError("report-reason-err", "");
      return;
    }
    if (e.target.id !== "match-filter") return;
    var route = parseRoute();
    go(route.region, { league: route.league, matchId: e.target.value, features: route.features, fav: route.fav });
  });

  // Navigating closes the menu viewer and resets the report form.
  window.addEventListener("hashchange", function () {
    if (applyHashVariant()) renderFlowSwitch();
    closeMenu(); report.state = "closed"; Reviews.reset(null); render();
  });
  // Returning from the panel via the back button may restore a cached page.
  window.addEventListener("pageshow", function (e) { if (e.persisted) render(); });
  // Edits made in the panel in another tab of the same browser.
  window.addEventListener("storage", function (e) {
    if ([Store.KEY, Store.MYREVIEWS_KEY, Store.FAVS_KEY].indexOf(e.key) !== -1) render();
  });

  // ---------- Footer: flow switch (A/B test), optional task timer, viewer reset ----------
  var flowEl = document.getElementById("flow-switch");
  var timerBtn = document.getElementById("timer-btn");
  var timerOut = document.getElementById("timer-out");
  var footerStatus = document.getElementById("footer-status");

  function renderFlowSwitch() {
    flowEl.querySelectorAll("[data-flow]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-flow") === flow ? "true" : "false"); });
  }

  function stopTimer() {
    if (!timer.running) return;
    timer.running = false;
    timerOut.textContent = "Görev süresi: " + D.formatDuration(Date.now() - timer.start) + " (kaydedilmedi)";
    timerBtn.textContent = "Yeniden ölç";
  }

  flowEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-flow]");
    if (!b) return;
    flow = b.getAttribute("data-flow");
    Store.saveFlow(flow);
    renderFlowSwitch();
    var target = "#/" + parseRoute().region; // start screen of the chosen flow
    if (location.hash === target) render(); else location.hash = target;
  });
  timerBtn.addEventListener("click", function () {
    if (timer.running) {
      timer.running = false;
      timerOut.textContent = "Ölçüm durduruldu.";
      timerBtn.textContent = "Görev süresini ölç";
      return;
    }
    timer = { start: Date.now(), running: true };
    timerOut.textContent = "Süre ölçülüyor… Bir mekan detayı açılınca durur.";
    timerBtn.textContent = "Durdur";
  });
  document.getElementById("reset-viewer").addEventListener("click", function () {
    var ok = Store.clearViewerData();
    Teams.close();
    footerStatus.textContent = ok ? "Yorumların ve takımların sıfırlandı." : "Sıfırlanamadı: tarayıcı depolamaya izin vermiyor.";
    render(); // a "takim=1" link without favourites simply shows everything
  });

  Reviews.init({ rerender: render });
  renderFlowSwitch();
  render();
})();
