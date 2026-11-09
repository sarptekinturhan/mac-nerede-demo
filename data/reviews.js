/*
 * SENTETİK VERİ / SYNTHETIC DATA (v0.5, İ13, karar #23)
 * Örnek puan ve yorumlar UYDURMADIR; gerçek kişilere veya gerçek deneyimlere ait değildir.
 * Yorum yapanlar adsızdır, ekranda "Kullanıcı · Ay Yıl" olarak gösterilir. Bazı mekanların
 * bilerek yorumu yok ("Henüz yorum yok" durumunu göstermek için).
 * Biçim: { venueId: [{ id, rating: 1-5, date: "YYYY-MM-DD", text }] }
 */
window.MN_REVIEWS = {
  v01: [
    { id: "r01a", rating: 5, date: "2026-10-18", text: "Derbide atmosfer harikaydı, ses tam açıktı." },
    { id: "r01b", rating: 3, date: "2026-08-26", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r01c", rating: 5, date: "2026-09-20", text: "Kalabalık ama keyifli, tribün havası var." },
    { id: "r01d", rating: 4, date: "2026-09-02", text: "Küçük ama samimi bir yer." }
  ],
  v02: [
    { id: "r02a", rating: 5, date: "2026-09-12", text: "Kalabalık ama keyifli, tribün havası var." },
    { id: "r02b", rating: 5, date: "2026-10-08", text: "Avrupa maçında bile yer bulduk, çok memnun kaldık." },
    { id: "r02c", rating: 5, date: "2026-10-15", text: "Ekran büyük, her yerden rahat görünüyor." }
  ],
  v03: [
    { id: "r03a", rating: 5, date: "2026-08-20", text: "Derbide atmosfer harikaydı, ses tam açıktı." },
    { id: "r03b", rating: 4, date: "2026-09-10", text: "Fiyatlar makul, ekran sayısı yeterli." },
    { id: "r03c", rating: 5, date: "2026-09-29", text: "Erken gittik, bize yer ayırdılar. Tavsiye ederim." }
  ],
  v04: [
    { id: "r04a", rating: 5, date: "2026-09-14", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r04b", rating: 3, date: "2026-09-27", text: "Ses kapalıydı, sadece görüntü vardı." },
    { id: "r04c", rating: 5, date: "2026-09-22", text: "Ekran büyük, her yerden rahat görünüyor." },
    { id: "r04d", rating: 4, date: "2026-10-01", text: "Biraz kalabalık ama görüş iyi." },
    { id: "r04e", rating: 4, date: "2026-10-02", text: "Maç sesi açıktı, yemekler fena değil." },
    { id: "r04f", rating: 5, date: "2026-09-28", text: "Derbide atmosfer harikaydı, ses tam açıktı." }
  ],
  v06: [
    { id: "r06a", rating: 3, date: "2026-10-19", text: "Ses kapalıydı, sadece görüntü vardı." },
    { id: "r06b", rating: 4, date: "2026-08-27", text: "Fiyatlar makul, ekran sayısı yeterli." },
    { id: "r06c", rating: 4, date: "2026-10-04", text: "Küçük ama samimi bir yer." },
    { id: "r06d", rating: 5, date: "2026-08-22", text: "Ailecek gittik, sigara içilmeyen bölüm iyiydi." }
  ],
  v07: [
    { id: "r07a", rating: 4, date: "2026-10-16", text: "Maç sesi açıktı, yemekler fena değil." },
    { id: "r07b", rating: 5, date: "2026-09-12", text: "Derbide atmosfer harikaydı, ses tam açıktı." },
    { id: "r07c", rating: 3, date: "2026-09-20", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." },
    { id: "r07d", rating: 3, date: "2026-10-03", text: "Sigara dumanı rahatsız etti." },
    { id: "r07e", rating: 3, date: "2026-10-18", text: "Ses kapalıydı, sadece görüntü vardı." }
  ],
  v08: [
    { id: "r08a", rating: 3, date: "2026-10-06", text: "Yoğunlukta servis aksıyor." },
    { id: "r08b", rating: 4, date: "2026-09-15", text: "Biraz kalabalık ama görüş iyi." },
    { id: "r08c", rating: 3, date: "2026-10-24", text: "İdare eder, fiyatlar biraz yüksek." },
    { id: "r08d", rating: 2, date: "2026-09-24", text: "Çok gürültülü, maçı takip etmek zordu." },
    { id: "r08e", rating: 2, date: "2026-09-28", text: "Söylenen maçı açmadılar, başka mekana geçtik." },
    { id: "r08f", rating: 3, date: "2026-09-08", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." }
  ],
  v09: [
    { id: "r09a", rating: 3, date: "2026-08-26", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r09b", rating: 5, date: "2026-08-24", text: "Ailecek gittik, sigara içilmeyen bölüm iyiydi." },
    { id: "r09c", rating: 5, date: "2026-10-03", text: "Ekran büyük, her yerden rahat görünüyor." },
    { id: "r09d", rating: 5, date: "2026-09-07", text: "Kalabalık ama keyifli, tribün havası var." },
    { id: "r09e", rating: 3, date: "2026-08-24", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." }
  ],
  v10: [
    { id: "r10a", rating: 5, date: "2026-10-11", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r10b", rating: 4, date: "2026-09-10", text: "Biraz kalabalık ama görüş iyi." },
    { id: "r10c", rating: 4, date: "2026-10-12", text: "Ses biraz kısıktı, onun dışında iyi." },
    { id: "r10d", rating: 5, date: "2026-09-07", text: "Erken gittik, bize yer ayırdılar. Tavsiye ederim." }
  ],
  v11: [
    { id: "r11a", rating: 5, date: "2026-10-21", text: "Avrupa maçında bile yer bulduk, çok memnun kaldık." },
    { id: "r11b", rating: 3, date: "2026-09-29", text: "Yoğunlukta servis aksıyor." },
    { id: "r11c", rating: 4, date: "2026-09-07", text: "Küçük ama samimi bir yer." },
    { id: "r11d", rating: 5, date: "2026-10-07", text: "Derbide atmosfer harikaydı, ses tam açıktı." },
    { id: "r11e", rating: 5, date: "2026-10-22", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r11f", rating: 4, date: "2026-10-02", text: "Ses biraz kısıktı, onun dışında iyi." }
  ],
  v12: [
    { id: "r12a", rating: 3, date: "2026-10-23", text: "Sigara dumanı rahatsız etti." },
    { id: "r12b", rating: 4, date: "2026-08-28", text: "Rezervasyonla gittik, sorun yaşamadık." }
  ],
  v13: [
    { id: "r13a", rating: 3, date: "2026-09-24", text: "İdare eder, fiyatlar biraz yüksek." },
    { id: "r13b", rating: 3, date: "2026-09-22", text: "Sigara dumanı rahatsız etti." },
    { id: "r13c", rating: 4, date: "2026-10-02", text: "Avrupa maçlarını da açıyorlar, güzel." },
    { id: "r13d", rating: 3, date: "2026-08-21", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r13e", rating: 3, date: "2026-09-24", text: "Ses kapalıydı, sadece görüntü vardı." },
    { id: "r13f", rating: 4, date: "2026-09-25", text: "Servis yavaştı ama maç keyfi yerindeydi." }
  ],
  v14: [
    { id: "r14a", rating: 4, date: "2026-10-03", text: "Küçük ama samimi bir yer." },
    { id: "r14b", rating: 5, date: "2026-10-16", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r14c", rating: 5, date: "2026-09-07", text: "Çay taze, ses yerinde. Mahallenin en iyisi." },
    { id: "r14d", rating: 4, date: "2026-09-10", text: "Avrupa maçlarını da açıyorlar, güzel." }
  ],
  v16: [
    { id: "r16a", rating: 5, date: "2026-10-12", text: "Ekran büyük, her yerden rahat görünüyor." },
    { id: "r16b", rating: 4, date: "2026-10-25", text: "Fiyatlar makul, ekran sayısı yeterli." },
    { id: "r16c", rating: 3, date: "2026-09-23", text: "Sigara dumanı rahatsız etti." },
    { id: "r16d", rating: 3, date: "2026-09-14", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." }
  ],
  v17: [
    { id: "r17a", rating: 3, date: "2026-09-12", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r17b", rating: 4, date: "2026-10-19", text: "Maç sesi açıktı, yemekler fena değil." },
    { id: "r17c", rating: 4, date: "2026-09-03", text: "Fiyatlar makul, ekran sayısı yeterli." },
    { id: "r17d", rating: 4, date: "2026-09-12", text: "Avrupa maçlarını da açıyorlar, güzel." },
    { id: "r17e", rating: 3, date: "2026-10-18", text: "Sigara dumanı rahatsız etti." },
    { id: "r17f", rating: 4, date: "2026-10-07", text: "Rezervasyonla gittik, sorun yaşamadık." }
  ],
  v18: [
    { id: "r18a", rating: 4, date: "2026-08-20", text: "Rezervasyonla gittik, sorun yaşamadık." },
    { id: "r18b", rating: 4, date: "2026-10-10", text: "Fiyatlar makul, ekran sayısı yeterli." }
  ],
  v19: [
    { id: "r19a", rating: 5, date: "2026-08-24", text: "Çay taze, ses yerinde. Mahallenin en iyisi." },
    { id: "r19b", rating: 3, date: "2026-09-27", text: "Sigara dumanı rahatsız etti." },
    { id: "r19c", rating: 5, date: "2026-09-26", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r19d", rating: 5, date: "2026-09-05", text: "Erken gittik, bize yer ayırdılar. Tavsiye ederim." },
    { id: "r19e", rating: 3, date: "2026-10-06", text: "Yoğunlukta servis aksıyor." }
  ],
  v20: [
    { id: "r20a", rating: 5, date: "2026-10-07", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r20b", rating: 2, date: "2026-08-31", text: "Söylenen maçı açmadılar, başka mekana geçtik." },
    { id: "r20c", rating: 4, date: "2026-08-20", text: "Rezervasyonla gittik, sorun yaşamadık." }
  ],
  v21: [
    { id: "r21a", rating: 4, date: "2026-09-30", text: "Fiyatlar makul, ekran sayısı yeterli." },
    { id: "r21b", rating: 5, date: "2026-10-13", text: "Ailecek gittik, sigara içilmeyen bölüm iyiydi." }
  ],
  v22: [
    { id: "r22a", rating: 3, date: "2026-10-07", text: "Yoğunlukta servis aksıyor." },
    { id: "r22b", rating: 5, date: "2026-09-09", text: "Ailecek gittik, sigara içilmeyen bölüm iyiydi." },
    { id: "r22c", rating: 4, date: "2026-10-22", text: "Avrupa maçlarını da açıyorlar, güzel." }
  ],
  v23: [
    { id: "r23a", rating: 4, date: "2026-09-29", text: "Maç sesi açıktı, yemekler fena değil." },
    { id: "r23b", rating: 5, date: "2026-09-07", text: "Kalabalık ama keyifli, tribün havası var." },
    { id: "r23c", rating: 4, date: "2026-08-23", text: "Avrupa maçlarını da açıyorlar, güzel." },
    { id: "r23d", rating: 5, date: "2026-09-20", text: "Erken gittik, bize yer ayırdılar. Tavsiye ederim." },
    { id: "r23e", rating: 5, date: "2026-08-25", text: "Personel çok ilgili, devre arasında hızlı servis." }
  ],
  v25: [
    { id: "r25a", rating: 5, date: "2026-09-20", text: "Kalabalık ama keyifli, tribün havası var." },
    { id: "r25b", rating: 4, date: "2026-08-24", text: "Ses biraz kısıktı, onun dışında iyi." },
    { id: "r25c", rating: 4, date: "2026-09-25", text: "Biraz kalabalık ama görüş iyi." },
    { id: "r25d", rating: 5, date: "2026-10-22", text: "Personel çok ilgili, devre arasında hızlı servis." },
    { id: "r25e", rating: 3, date: "2026-09-04", text: "Yoğunlukta servis aksıyor." }
  ],
  v26: [
    { id: "r26a", rating: 3, date: "2026-09-25", text: "İdare eder, fiyatlar biraz yüksek." },
    { id: "r26b", rating: 3, date: "2026-10-26", text: "Ses kapalıydı, sadece görüntü vardı." },
    { id: "r26c", rating: 3, date: "2026-10-18", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." }
  ],
  v27: [
    { id: "r27a", rating: 4, date: "2026-08-24", text: "Fiyatlar makul, ekran sayısı yeterli." },
    { id: "r27b", rating: 3, date: "2026-09-21", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." },
    { id: "r27c", rating: 3, date: "2026-09-13", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r27d", rating: 4, date: "2026-10-13", text: "Maç sesi açıktı, yemekler fena değil." }
  ],
  v28: [
    { id: "r28a", rating: 3, date: "2026-10-20", text: "Yoğunlukta servis aksıyor." },
    { id: "r28b", rating: 4, date: "2026-10-19", text: "Küçük ama samimi bir yer." },
    { id: "r28c", rating: 3, date: "2026-09-26", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r28d", rating: 5, date: "2026-08-28", text: "Avrupa maçında bile yer bulduk, çok memnun kaldık." },
    { id: "r28e", rating: 4, date: "2026-10-14", text: "Ses biraz kısıktı, onun dışında iyi." },
    { id: "r28f", rating: 5, date: "2026-09-25", text: "Kalabalık ama keyifli, tribün havası var." }
  ],
  v30: [
    { id: "r30a", rating: 5, date: "2026-10-01", text: "Avrupa maçında bile yer bulduk, çok memnun kaldık." },
    { id: "r30b", rating: 5, date: "2026-09-08", text: "Kalabalık ama keyifli, tribün havası var." },
    { id: "r30c", rating: 3, date: "2026-08-28", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." },
    { id: "r30d", rating: 5, date: "2026-09-18", text: "Ailecek gittik, sigara içilmeyen bölüm iyiydi." }
  ],
  v31: [
    { id: "r31a", rating: 5, date: "2026-10-01", text: "Derbide atmosfer harikaydı, ses tam açıktı." },
    { id: "r31b", rating: 3, date: "2026-10-13", text: "Yoğunlukta servis aksıyor." }
  ],
  v32: [
    { id: "r32a", rating: 3, date: "2026-09-17", text: "Ekranlar küçük kalıyor, arka masalardan zor görünüyor." },
    { id: "r32b", rating: 3, date: "2026-09-03", text: "Yoğunlukta servis aksıyor." },
    { id: "r32c", rating: 3, date: "2026-10-15", text: "Ses kapalıydı, sadece görüntü vardı." },
    { id: "r32d", rating: 3, date: "2026-09-12", text: "Maç günü çok kalabalık, yer bulmak zor." },
    { id: "r32e", rating: 3, date: "2026-08-28", text: "İdare eder, fiyatlar biraz yüksek." }
  ],
  v33: [
    { id: "r33a", rating: 4, date: "2026-09-02", text: "Maç sesi açıktı, yemekler fena değil." },
    { id: "r33b", rating: 4, date: "2026-08-27", text: "Servis yavaştı ama maç keyfi yerindeydi." },
    { id: "r33c", rating: 3, date: "2026-09-04", text: "Sigara dumanı rahatsız etti." }
  ],
  v35: [
    { id: "r35a", rating: 5, date: "2026-10-21", text: "Çay taze, ses yerinde. Mahallenin en iyisi." },
    { id: "r35b", rating: 5, date: "2026-10-04", text: "Erken gittik, bize yer ayırdılar. Tavsiye ederim." },
    { id: "r35c", rating: 5, date: "2026-09-06", text: "Derbide atmosfer harikaydı, ses tam açıktı." },
    { id: "r35d", rating: 4, date: "2026-09-08", text: "Avrupa maçlarını da açıyorlar, güzel." },
    { id: "r35e", rating: 3, date: "2026-09-17", text: "İdare eder, fiyatlar biraz yüksek." },
    { id: "r35f", rating: 4, date: "2026-08-28", text: "Fiyatlar makul, ekran sayısı yeterli." }
  ]
};
