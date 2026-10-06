// Reading-position resume, shipped with the book (book.toml additional-js).
// Works under any URL prefix: the book root is derived from mdBook's
// path_to_root, never from a hard-coded path.
//
// - Records the current page + scroll position in localStorage
//   (key "books:resume:modern-java"; the hosting site's list page reads the
//   stored path/title/ts fields).
// - When the reader enters a book at its root from outside that book, takes
//   them back to the saved page/scroll and shows a "start from the beginning"
//   notice. In-book navigation and direct chapter links are never redirected.
// - Any storage failure (private mode, blocked site data) disables all of it.
(function () {
  "use strict";

  // The 404 page is served for arbitrary URLs, so its path_to_root is meaningless.
  if (document.querySelector('meta[name="mdbook-404"]')) return;

  var BOOK_ID = "modern-java";
  var bookRoot = new URL(window.path_to_root || "./", location.href).pathname;
  var KEY = "books:resume:" + BOOK_ID;
  var RESUMED_FLAG = "books:resumed";

  function isRoot(path) {
    return path === bookRoot || path === bookRoot + "index.html";
  }

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      return saved && typeof saved.path === "string" ? saved : null;
    } catch (e) {
      return null;
    }
  }

  function scrollMax() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function save() {
    if (location.pathname.slice(-"/print.html".length) === "/print.html") return;
    var max = scrollMax();
    try {
      localStorage.setItem(KEY, JSON.stringify({
        path: location.pathname,
        scrollRatio: max > 0 ? Math.min(1, window.scrollY / max) : 0,
        title: document.title,
        ts: Date.now()
      }));
    } catch (e) { /* storage unavailable: no resume */ }
  }

  function enteredFromOutside() {
    var ref = document.referrer;
    if (!ref) return true;
    try {
      var url = new URL(ref);
      return url.origin !== location.origin || url.pathname.indexOf(bookRoot) !== 0;
    } catch (e) {
      return true;
    }
  }

  function takeResumedFlag() {
    try {
      var ratio = sessionStorage.getItem(RESUMED_FLAG);
      sessionStorage.removeItem(RESUMED_FLAG);
      return ratio === null ? null : Number(ratio);
    } catch (e) {
      return null;
    }
  }

  function showNotice() {
    var box = document.createElement("div");
    box.setAttribute("role", "status");
    box.style.cssText = [
      "position:fixed", "left:50%", "bottom:16px", "transform:translateX(-50%)",
      "z-index:1000", "max-width:calc(100% - 32px)", "padding:10px 14px",
      "border-radius:8px", "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "background:var(--sidebar-bg,#333)", "color:var(--sidebar-fg,#fff)",
      "box-shadow:0 4px 16px rgba(0,0,0,.25)", "display:flex", "gap:12px", "align-items:center"
    ].join(";");

    var text = document.createElement("span");
    text.textContent = "Resumed where you left off ·";
    var start = document.createElement("a");
    start.href = bookRoot;
    start.textContent = "Start from the beginning";
    start.style.cssText = "color:inherit;text-decoration:underline";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.style.cssText = "background:none;border:0;color:inherit;font-size:18px;cursor:pointer;padding:0 2px";
    close.onclick = function () { box.remove(); };

    box.appendChild(text);
    box.appendChild(start);
    box.appendChild(close);
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 10000);
  }

  function restore(ratio) {
    window.scrollTo(0, Math.round(ratio * scrollMax()));
    showNotice();
  }

  function whenLoaded(fn) {
    if (document.readyState === "complete") fn();
    else window.addEventListener("load", fn, { once: true });
  }

  // 1. Resume on entry: at the book root, no #anchor, arriving from outside the book.
  var saved = load();
  if (saved && isRoot(location.pathname) && !location.hash && enteredFromOutside()) {
    if (!isRoot(saved.path)) {
      try {
        sessionStorage.setItem(RESUMED_FLAG, String(saved.scrollRatio || 0));
        location.replace(saved.path);
        return;
      } catch (e) { /* sessionStorage unavailable: stay on the root page */ }
    } else if (saved.scrollRatio > 0) {
      whenLoaded(function () { restore(saved.scrollRatio); });
    }
  }

  // 2. Arrived here via a resume redirect: restore the scroll position.
  var resumedRatio = takeResumedFlag();
  if (resumedRatio !== null) {
    // Images change the page height, so wait for load before scrolling.
    whenLoaded(function () { restore(resumedRatio); });
  }

  // 3. Record progress while reading.
  var pending = false;
  window.addEventListener("scroll", function () {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; save(); }, 1000);
  }, { passive: true });
  window.addEventListener("pagehide", save);
  whenLoaded(function () { setTimeout(save, 1500); });
})();
