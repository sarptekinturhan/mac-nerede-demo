/*
 * v0.5 viewer: "Takımlarım" (İ16, decision #26).
 * A chip at the start of the league row. Without favourites it opens an inline picker
 * (searchable checkbox list of fixture teams + "Kaydet"); with favourites it is a filter toggle.
 * Favourites are stored in this browser only. Picker state lives here so re-renders keep it.
 */
(function () {
  "use strict";
  var D = window.MNDiscover;
  var Store = window.MNStorage;
  var esc = window.MNLogic.escapeHtml;

  var picker = { open: false, selected: [], query: "" };

  function favs(teams) { return D.cleanFavTeams(Store.loadFavTeams(), teams); }

  function open(current) { picker = { open: true, selected: current.slice(), query: "" }; }
  function close() { picker.open = false; }
  function isOpen() { return picker.open; }
  function selected() { return picker.selected.slice(); }

  function chipHtml(current, active) {
    if (!current.length) {
      return '<button type="button" class="chip fav-chip" id="fav-chip" aria-expanded="' + picker.open + '" aria-controls="fav-picker">☆ Takımlarım</button>';
    }
    return '<button type="button" class="chip fav-chip" id="fav-chip" aria-pressed="' + !!active + '">★ Takımlarım</button>';
  }

  // Shown under the chips while the "Takımlarım" filter is on.
  function lineHtml(current) {
    return '<p class="fav-line"><span class="fav-names"><span aria-hidden="true">★</span> ' + current.map(esc).join(", ") + "</span>" +
      '<button type="button" class="link-btn" data-fav-edit>Takımlarımı düzenle</button></p>';
  }

  function pickerHtml(teams) {
    if (!picker.open) return "";
    var rows = teams.map(function (t) {
      var on = picker.selected.indexOf(t) !== -1;
      return '<li data-team-row="' + esc(t) + '"' + (D.teamMatchesQuery(t, picker.query) ? "" : " hidden") + '><label class="check-row">' +
        '<input type="checkbox" name="fav-team" value="' + esc(t) + '"' + (on ? " checked" : "") + "><span>" + esc(t) + "</span></label></li>";
    }).join("");
    var none = teams.every(function (t) { return !D.teamMatchesQuery(t, picker.query); });
    return '<div class="fav-picker" id="fav-picker" role="group" aria-labelledby="fav-picker-title">' +
      '<p id="fav-picker-title" class="fav-title"><strong>Takımlarını seç</strong></p>' +
      '<p class="hint">Seçtiğin takımların maçları ★ ile işaretlenir ve "Takımlarım" ile süzülür. Yalnızca bu tarayıcıda saklanır.</p>' +
      '<label class="sr-only" for="fav-search">Takım ara</label>' +
      '<input type="search" id="fav-search" placeholder="Takım ara…" autocomplete="off" value="' + esc(picker.query) + '">' +
      '<ul class="fav-list">' + rows + "</ul>" +
      '<p class="hint" id="fav-none"' + (none ? "" : " hidden") + ">Takım bulunamadı.</p>" +
      '<p class="hint" id="fav-count" aria-live="polite">' + picker.selected.length + " takım seçili</p>" +
      '<div class="actions"><button type="button" class="btn primary" data-fav-save>Kaydet</button>' +
      '<button type="button" class="btn" data-fav-cancel>Vazgeç</button></div></div>';
  }

  // Search and ticks update in place (no re-render), so typing is not interrupted.
  function handleInput(e) {
    if (e.target.id === "fav-search") {
      picker.query = e.target.value;
      var any = false;
      document.querySelectorAll("#fav-picker [data-team-row]").forEach(function (li) {
        var show = D.teamMatchesQuery(li.getAttribute("data-team-row"), picker.query);
        li.hidden = !show;
        any = any || show;
      });
      document.getElementById("fav-none").hidden = any;
      return true;
    }
    if (e.target.name === "fav-team") {
      var t = e.target.value;
      picker.selected = picker.selected.filter(function (x) { return x !== t; });
      if (e.target.checked) picker.selected.push(t);
      document.getElementById("fav-count").textContent = picker.selected.length + " takım seçili";
      return true;
    }
    return false;
  }

  // Saves the picker's selection; returns the saved list (or null when storage failed).
  function save(teams) {
    var list = D.cleanFavTeams(picker.selected, teams);
    if (!Store.saveFavTeams(list)) return null;
    close();
    return list;
  }

  window.MNViewerTeams = {
    favs: favs, open: open, close: close, isOpen: isOpen, selected: selected,
    chipHtml: chipHtml, lineHtml: lineHtml, pickerHtml: pickerHtml, handleInput: handleInput, save: save
  };
})();
