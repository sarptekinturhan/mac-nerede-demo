/*
 * v0.4 (M7): turns chosen menu files into small JPEG data URLs in the browser.
 * - Images: downscaled with a canvas (long side max 1000 px, JPEG quality 0.65).
 * - PDF: pages rendered with pdf.js, loaded from cdnjs only when a PDF is chosen.
 *   pdf.js first tries its Web Worker; if the worker cannot start (or hangs) we load the
 *   worker code with a plain <script> tag, which makes pdf.js run on the main thread.
 *   (Our publish host allows <script> from cdnjs but blocks fetch/XHR to CDNs.)
 */
(function (root) {
  "use strict";
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var MAX_SIDE = 1000, QUALITY = 0.65, WORKER_TIMEOUT_MS = 8000;
  var PDF_ERROR = "PDF işlenemedi. Menüyü fotoğraf olarak yükleyebilirsin.";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  var pdfjsPromise = null;
  function loadPdfJs() {
    if (!pdfjsPromise) {
      pdfjsPromise = (root.pdfjsLib ? Promise.resolve() : loadScript(PDFJS + "pdf.min.js")).then(function () {
        if (!root.pdfjsLib) throw new Error("pdf.js missing");
        root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
        return root.pdfjsLib;
      });
      pdfjsPromise.catch(function () { pdfjsPromise = null; }); // allow a retry later
    }
    return pdfjsPromise;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("timeout")); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  // getDocument transfers the buffer, so each attempt gets its own copy.
  function openPdf(lib, bytes) {
    var task = lib.getDocument({ data: bytes.slice(0), isEvalSupported: false });
    return withTimeout(task.promise, WORKER_TIMEOUT_MS).catch(function (e) {
      try { task.destroy(); } catch (ignore) { /* already gone */ }
      throw e;
    });
  }

  function openPdfWithoutWorker(lib, bytes) {
    var ready = root.pdfjsWorker ? Promise.resolve() : loadScript(PDFJS + "pdf.worker.min.js");
    return ready.then(function () { return openPdf(lib, bytes); });
  }

  function canvasToJpeg(draw, w, h) {
    var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return Promise.resolve(draw(ctx, canvas, scale)).then(function () { return canvas.toDataURL("image/jpeg", QUALITY); });
  }

  function imageToPage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        canvasToJpeg(function (ctx, canvas) { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); }, img.naturalWidth, img.naturalHeight)
          .then(resolve, reject)
          .then(function () { URL.revokeObjectURL(url); });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image")); };
      img.src = url;
    });
  }

  function pdfToPages(file, maxPages) {
    return Promise.all([loadPdfJs(), file.arrayBuffer()]).then(function (r) {
      var lib = r[0], bytes = new Uint8Array(r[1]);
      return openPdf(lib, bytes).catch(function () { return openPdfWithoutWorker(lib, bytes); }).then(function (pdf) {
        var pages = [], count = Math.min(pdf.numPages, maxPages);
        var chain = Promise.resolve();
        for (var i = 1; i <= count; i++) {
          chain = chain.then(renderPage.bind(null, pdf, i)).then(function (p) { pages.push(p); });
        }
        return chain.then(function () {
          var more = pdf.numPages > count;
          pdf.destroy();
          return { list: pages, more: more };
        });
      });
    });
  }

  function renderPage(pdf, n) {
    return pdf.getPage(n).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var scale = MAX_SIDE / Math.max(base.width, base.height);
      var vp = page.getViewport({ scale: scale });
      return canvasToJpeg(function (ctx) {
        return page.render({ canvasContext: ctx, viewport: vp }).promise;
      }, vp.width, vp.height);
    });
  }

  // files -> Promise<{ pages: [dataUrl], errors: [text], skipped: bool }>. Never rejects.
  // skipped = some pages were not processed because maxPages was reached.
  function filesToPages(files, maxPages) {
    var pages = [], errors = [], skipped = false;
    var chain = Promise.resolve();
    Array.prototype.forEach.call(files, function (file) {
      chain = chain.then(function () {
        var room = maxPages - pages.length;
        if (room <= 0) { skipped = true; return; }
        var isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        var job = isPdf ? pdfToPages(file, room)
          : /^image\//.test(file.type) ? imageToPage(file).then(function (p) { return { list: [p], more: false }; })
          : Promise.reject(new Error("type"));
        return job.then(function (r) { pages = pages.concat(r.list); if (r.more) skipped = true; }, function () {
          errors.push(isPdf ? PDF_ERROR : "\"" + file.name + "\" okunamadı. Fotoğraf (JPG, PNG) veya PDF seç.");
        });
      });
    });
    return chain.then(function () { return { pages: pages, errors: errors, skipped: skipped }; });
  }

  root.MNMenuUpload = { filesToPages: filesToPages, PDF_ERROR: PDF_ERROR };
})(this);
