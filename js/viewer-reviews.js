/*
 * v0.5 viewer: "Puan ve yorumlar" section on the venue detail (İ13, decision #23).
 * Sample reviews (data/reviews.js, synthetic) + the viewer's own review, stored in this browser only.
 * One review per venue per browser: saving again replaces it; the viewer can delete it.
 * All text is escaped. Ratings do NOT change the list order (later version).
 * app.js calls html(venue) when rendering the detail and forwards clicks/submits/inputs here.
 */
(function () {
  "use strict";
  var R = window.MNReviews;
  var Store = window.MNStorage;
  var esc = window.MNLogic.escapeHtml;
  var SHOW_FIRST = 3;

  var ui = { venueId: null, showAll: false, formOpen: false, status: "" };
  var rerender = function () {};

  function init(opts) { rerender = opts.rerender; }

  // A new venue (or navigation) starts with a collapsed list and a closed form.
  function reset(venueId) { ui = { venueId: venueId, showAll: false, formOpen: false, status: "" }; }

  function reviewsOf(venueId) { return R.reviewsForVenue(window.MN_REVIEWS || {}, Store.loadMyReviews(), venueId); }

  function starsStatic(n) {
    return '<span class="stars-static" aria-hidden="true">' + "★★★★★".slice(0, n) + '<span class="off">' + "★★★★★".slice(n) + "</span></span>" +
      '<span class="sr-only">5 üzerinden ' + n + " puan</span>";
  }

  // "★ 4,3 · 12 yorum" line under the venue name (links to the section).
  function summaryLine(venue) {
    var s = R.summarize(reviewsOf(venue.id));
    return s
      ? '<p class="rating-line"><button type="button" class="link-btn rating-link" data-review-jump><span class="star" aria-hidden="true">★</span> <strong>' + R.formatRating(s.avg) + "</strong>" +
        '<span class="sr-only"> / 5 ortalama puan</span> · ' + s.count + " yorum</button></p>"
      : '<p class="rating-line sub">Henüz yorum yok</p>';
  }

  function reviewItem(r) {
    return '<li class="review' + (r.own ? " own" : "") + '"><div class="review-head">' + starsStatic(r.rating) +
      '<span class="meta">' + esc(R.reviewerLabel(r.date)) + "</span>" +
      (r.own ? ' <span class="badge own-tag">Senin yorumun</span>' : "") + "</div>" +
      (r.text ? '<p class="review-text">' + esc(r.text) + "</p>" : "") +
      (r.own ? '<div class="review-actions"><button type="button" class="link-btn" data-review-open>Düzenle</button>' +
        '<button type="button" class="link-btn danger" data-review-delete>Sil</button></div>' : "") + "</li>";
  }

  function formHtml(mine) {
    var current = mine ? mine.rating : 0;
    var radios = [1, 2, 3, 4, 5].map(function (n) {
      return '<input type="radio" class="star-radio" name="rating" id="rate-' + n + '" value="' + n + '"' + (n === current ? " checked" : "") + ">" +
        '<label for="rate-' + n + '" class="star-label' + (n <= current ? " on" : "") + '" title="' + n + " – " + R.ratingWord(n) + '">' +
        '<span aria-hidden="true">★</span><span class="sr-only">' + n + " yıldız, " + R.ratingWord(n) + "</span></label>";
    }).join("");
    var text = mine ? mine.text : "";
    return '<form class="review-form" id="review-form" novalidate><fieldset><legend>' + (mine ? "Yorumunu düzenle" : "Puan ver") + "</legend>" +
      '<fieldset class="star-input"><legend class="field">Puanın</legend><div class="star-row">' + radios +
      '<span class="star-word" id="star-word" aria-hidden="true">' + (current ? R.ratingWord(current) : "") + "</span></div></fieldset>" +
      '<p id="review-rating-err" class="error field-err" role="alert" hidden></p>' +
      '<label class="field" for="review-text">Yorum <span class="optional">(isteğe bağlı)</span></label>' +
      '<textarea id="review-text" name="text" rows="3" maxlength="' + R.MAX_REVIEW_TEXT + '" aria-describedby="review-count">' + esc(text) + "</textarea>" +
      '<p id="review-count" class="hint counter">' + text.length + "/" + R.MAX_REVIEW_TEXT + "</p>" +
      '<p id="review-text-err" class="error field-err" role="alert" hidden></p>' +
      '<p class="hint">Adın gösterilmez ("Kullanıcı · ay yıl"). Prototip: yorumun yalnızca bu tarayıcıda saklanır.</p>' +
      '<div class="actions"><button type="submit" class="btn primary">Kaydet</button>' +
      '<button type="button" class="btn" data-review-cancel>Vazgeç</button></div></fieldset></form>';
  }

  function html(venue) {
    if (ui.venueId !== venue.id) reset(venue.id);
    var all = reviewsOf(venue.id);
    var s = R.summarize(all);
    var mine = all.filter(function (r) { return r.own; })[0];
    var shown = ui.showAll ? all : all.slice(0, SHOW_FIRST);
    var out = '<section class="reviews" id="reviews" tabindex="-1" aria-labelledby="reviews-title"><h2 class="section" id="reviews-title">Puan ve yorumlar</h2>' +
      (s ? '<p class="rating-big"><span class="star" aria-hidden="true">★</span> <strong>' + R.formatRating(s.avg) + "</strong>" +
        '<span class="sr-only"> / 5</span> <span class="meta">· ' + s.count + " yorum</span></p>"
        : '<p class="sub">Henüz yorum yok. İlk puanı sen ver.</p>') +
      '<p class="status" id="review-status" role="status" tabindex="-1">' + esc(ui.status) + "</p>";
    if (shown.length) out += '<ul class="review-list">' + shown.map(reviewItem).join("") + "</ul>";
    if (!ui.showAll && all.length > SHOW_FIRST) {
      out += '<button type="button" class="link-btn" data-review-all>Tümünü gör (' + all.length + ")</button>";
    }
    out += ui.formOpen ? formHtml(mine)
      : '<button type="button" class="btn review-open" data-review-open>' + (mine ? "Yorumunu düzenle" : "Puan ver") + "</button>";
    return out + "</section>";
  }

  function focusIn(selector) {
    var el = document.querySelector(selector);
    if (el) el.focus();
  }

  function showError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  // Returns true when the click belonged to this section.
  function handleClick(t) {
    if (t.hasAttribute("data-review-open")) {
      ui.formOpen = true; ui.status = "";
      rerender();
      focusIn(document.querySelector('#review-form input[name="rating"]:checked') ? '#review-form input[name="rating"]:checked' : "#rate-1");
      return true;
    }
    if (t.hasAttribute("data-review-jump")) {
      var sec = document.getElementById("reviews");
      if (sec) { sec.scrollIntoView({ block: "start" }); sec.focus({ preventScroll: true }); }
      return true;
    }
    if (t.hasAttribute("data-review-cancel")) {
      ui.formOpen = false;
      rerender();
      focusIn("[data-review-open]");
      return true;
    }
    if (t.hasAttribute("data-review-all")) {
      ui.showAll = true;
      rerender();
      focusIn("#reviews");
      return true;
    }
    if (t.hasAttribute("data-review-delete")) {
      var ok = Store.saveMyReviews(R.removeMyReview(Store.loadMyReviews(), ui.venueId));
      ui.formOpen = false;
      ui.status = ok ? "Yorumun silindi." : "Silinemedi: tarayıcı depolamaya izin vermiyor.";
      rerender();
      focusIn("[data-review-open]");
      return true;
    }
    return false;
  }

  function handleSubmit(form) {
    var checked = form.querySelector('input[name="rating"]:checked');
    var res = R.validateReview({ rating: checked ? checked.value : "", text: form.text.value });
    showError("review-rating-err", res.errors.rating);
    showError("review-text-err", res.errors.text);
    if (!res.ok) {
      (res.errors.rating ? form.querySelector('input[name="rating"]') : form.text).focus();
      return;
    }
    if (!Store.saveMyReviews(R.setMyReview(Store.loadMyReviews(), ui.venueId, res.value, new Date()))) {
      showError("review-text-err", "Kaydedilemedi: tarayıcı depolamaya izin vermiyor (ör. gizli sekme).");
      return;
    }
    ui.formOpen = false;
    ui.status = "Yorumun kaydedildi. Ortalamaya eklendi.";
    rerender();
    focusIn("#review-status");
  }

  // Star highlight + word, counter.
  function handleInput(e) {
    if (e.target.name === "rating") {
      var n = parseInt(e.target.value, 10);
      document.querySelectorAll("#review-form .star-label").forEach(function (l, i) { l.classList.toggle("on", i < n); });
      document.getElementById("star-word").textContent = R.ratingWord(n);
      showError("review-rating-err", "");
      return true;
    }
    if (e.target.id === "review-text") {
      document.getElementById("review-count").textContent = e.target.value.length + "/" + R.MAX_REVIEW_TEXT;
      return true;
    }
    return false;
  }

  window.MNViewerReviews = {
    init: init, reset: reset, html: html, summaryLine: summaryLine,
    handleClick: handleClick, handleSubmit: handleSubmit, handleInput: handleInput
  };
})();
