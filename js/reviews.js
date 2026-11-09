/*
 * v0.5 pure logic for ratings and reviews (İ13, decision #23). No DOM.
 * Sample reviews come from data/reviews.js (synthetic). The viewer's own reviews are kept in this
 * browser only, at most one per venue (saving again replaces it).
 * Reviewers are never named: they are shown as "Kullanıcı · Eki 2026".
 * NOTE: ratings do NOT affect sorting in this version (a later version, see backlog "Sonraki sürüm").
 */
(function (root) {
  "use strict";
  var MAX_REVIEW_TEXT = 300;
  var MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var RATING_WORDS = ["", "Kötü", "Zayıf", "İdare eder", "İyi", "Çok iyi"];

  function cleanText(x) {
    return String(x == null ? "" : x).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function isRating(r) { return typeof r === "number" && r % 1 === 0 && r >= 1 && r <= 5; }

  // Form input { rating, text } -> { ok, errors: {rating, text}, value: {rating, text} }.
  function validateReview(input) {
    var i = input || {}, errors = {};
    var rating = typeof i.rating === "string" ? parseInt(i.rating, 10) : i.rating;
    var text = cleanText(i.text);
    if (!isRating(rating)) errors.rating = "Lütfen 1 ile 5 arasında bir puan seçin.";
    if (text.length > MAX_REVIEW_TEXT) errors.text = "Yorum en fazla " + MAX_REVIEW_TEXT + " karakter olabilir.";
    var ok = Object.keys(errors).length === 0;
    return { ok: ok, errors: errors, value: ok ? { rating: rating, text: text } : null };
  }

  function isDate(s) { return typeof s === "string" && !isNaN(new Date(s).getTime()); }

  // Stored own review or sample review -> clean object, or null.
  function cleanReview(r) {
    if (!r || typeof r !== "object") return null;
    var v = validateReview(r);
    var date = r.createdAt || r.date;
    if (!v.ok || !isDate(date)) return null;
    return { rating: v.value.rating, text: v.value.text, date: new Date(date).toISOString() };
  }

  // One own review per venue: saving replaces, returns a new map (input not mutated).
  function setMyReview(mine, venueId, value, now) {
    var out = Object.assign({}, mine && typeof mine === "object" ? mine : {});
    out[venueId] = { rating: value.rating, text: value.text || "", createdAt: new Date(now).toISOString() };
    return out;
  }

  function removeMyReview(mine, venueId) {
    var out = Object.assign({}, mine && typeof mine === "object" ? mine : {});
    delete out[venueId];
    return out;
  }

  // Sample + own review of a venue, newest first. The own one is tagged own: true.
  function reviewsForVenue(samples, mine, venueId) {
    var list = ((samples && samples[venueId]) || []).map(cleanReview).filter(Boolean);
    var own = mine && mine[venueId] ? cleanReview(mine[venueId]) : null;
    if (own) list.push(Object.assign(own, { own: true }));
    return list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.own ? -1 : b.own ? 1 : 0; });
  }

  // { count, avg } with avg rounded to one decimal; null when there are no reviews.
  function summarize(list) {
    if (!list || !list.length) return null;
    var sum = list.reduce(function (n, r) { return n + r.rating; }, 0);
    return { count: list.length, avg: Math.round((sum / list.length) * 10) / 10 };
  }

  function summaries(samples, mine) {
    var out = {};
    Object.keys(Object.assign({}, samples || {}, mine || {})).forEach(function (id) {
      var s = summarize(reviewsForVenue(samples, mine, id));
      if (s) out[id] = s;
    });
    return out;
  }

  // 4.3 -> "4,3", 4 -> "4,0" (Turkish decimal comma).
  function formatRating(avg) { return avg.toFixed(1).replace(".", ","); }

  // Anonymous label: "Kullanıcı · Eki 2026" (Istanbul month).
  function reviewerLabel(iso) {
    var d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
    return "Kullanıcı · " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  function ratingWord(r) { return RATING_WORDS[r] || ""; }

  var api = {
    MAX_REVIEW_TEXT: MAX_REVIEW_TEXT,
    validateReview: validateReview,
    cleanReview: cleanReview,
    setMyReview: setMyReview,
    removeMyReview: removeMyReview,
    reviewsForVenue: reviewsForVenue,
    summarize: summarize,
    summaries: summaries,
    formatRating: formatRating,
    reviewerLabel: reviewerLabel,
    ratingWord: ratingWord
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MNReviews = api;
})(this);
