/*
 * SENTETİK VERİ / SYNTHETIC DATA (v0.4, M7 + İ12)
 * Örnek menüler UYDURMADIR: ürünler ve fiyatlar gerçek bir işletmeye ait değildir.
 * Her menü sayfası küçük bir SVG resmi olarak üretilir (data URL). Mekan panelinden
 * yüklenen bir menü (veya "Menüyü kaldır") bu örneğin yerine geçer.
 */
(function () {
  "use strict";

  function xml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // One A5-like page: venue name, a section title and "Ürün  Fiyat" rows.
  function page(venueName, section, items) {
    var rows = items.map(function (it, i) {
      var y = 170 + i * 44;
      return '<text x="40" y="' + y + '" font-size="22">' + xml(it[0]) + "</text>" +
        '<text x="380" y="' + y + '" font-size="22" text-anchor="end" font-weight="bold">' + xml(it[1]) + " TL</text>" +
        '<line x1="40" y1="' + (y + 14) + '" x2="380" y2="' + (y + 14) + '" stroke="#e3ded3"/>';
    }).join("");
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="600" viewBox="0 0 420 600" font-family="Georgia, serif" fill="#2b2620">' +
      '<rect width="420" height="600" fill="#fbf8f1"/><rect x="12" y="12" width="396" height="576" fill="none" stroke="#0b6e3d" stroke-width="3"/>' +
      '<text x="210" y="70" font-size="28" text-anchor="middle" font-weight="bold">' + xml(venueName) + "</text>" +
      '<text x="210" y="112" font-size="20" text-anchor="middle" fill="#0b6e3d">' + xml(section) + "</text>" + rows +
      '<text x="210" y="570" font-size="15" text-anchor="middle" fill="#7a7266">Örnek menü · sentetik veri</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  var DRINKS = [["Çay", 30], ["Türk kahvesi", 70], ["Ayran", 45], ["Gazoz", 60], ["Limonata", 90]];

  window.MN_MENUS = {
    v01: [
      page("Korner Bar", "Atıştırmalıklar", [["Patates tava", 160], ["Çıtır tavuk", 240], ["Karışık kuruyemiş", 150], ["Nachos", 190]]),
      page("Korner Bar", "İçecekler", DRINKS)
    ],
    v06: [
      page("Taç Atışı Pub", "Maç menüsü", [["Burger", 320], ["Kanat (8 adet)", 280], ["Soğan halkası", 150], ["Tost", 120], ["Paylaşım tabağı", 450]])
    ],
    v10: [
      page("Tek Forvet Bar", "Yiyecekler", [["Kaşarlı tost", 120], ["Sucuklu tost", 150], ["Patates tava", 150]]),
      page("Tek Forvet Bar", "İçecekler", DRINKS)
    ],
    v14: [
      page("Golcü Kahvehanesi", "Sıcak / soğuk", [["Çay", 25], ["Türk kahvesi", 65], ["Sahlep", 80], ["Tost", 110]])
    ],
    v21: [
      page("Penaltı Kıraathanesi", "Menü", [["Çay", 20], ["Oralet", 25], ["Türk kahvesi", 55], ["Kaşarlı tost", 90]])
    ],
    v26: [
      page("Kaleci Lokantası", "Günün yemekleri", [["Mercimek çorbası", 90], ["Kuru fasulye", 160], ["Pilav", 70], ["Tavuk sote", 210], ["Sütlaç", 100]])
    ]
  };
})();
