// Sidebar fix for mdBook books whose custom theme renders the table of
// contents inline ({{#toc}}) instead of via mdBook 0.4.4x+'s toc.js.
// Shipped with the book (book.toml additional-js); relies only on
// path_to_root, so it works under any URL prefix.
//
// That helper emits links relative to the book root and marks no page as
// current, relying on a <base>/toc.js the theme doesn't provide. So on pages
// below the root the links resolve wrongly (time/time/...) and nothing is
// highlighted. This does what toc.js would: prefix path_to_root, mark the
// current page "active", expand its folded sections and scroll it into view.
// No-op when the sidebar already has an active link (stock toc.js themes).
(function () {
  "use strict";

  var box = document.querySelector(".sidebar-scrollbox");
  if (!box || box.querySelector("a.active")) return;
  var root = typeof window.path_to_root === "string" ? window.path_to_root : "";

  var here = location.href.split("#")[0].split("?")[0];
  var links = Array.prototype.slice.call(box.querySelectorAll("a[href]"));
  var current = null;

  links.forEach(function (link) {
    var href = link.getAttribute("href");
    // Only rewrite root-relative page links; leave absolute/anchor links alone.
    if (root && !/^([a-z]+:|\/|#|\.\.\/)/i.test(href)) {
      link.setAttribute("href", root + href);
    }
    if (!current && link.href.split("#")[0] === here) current = link;
  });

  // index.html is a copy of the first chapter.
  if (!current && /\/(index\.html)?$/.test(location.pathname)) current = links[0] || null;
  if (!current) return;

  current.classList.add("active");

  // Expand folded ancestors: each section <ol> sits in an <li> right after
  // its chapter's <li class="chapter-item">.
  for (var node = current.parentElement; node && node !== box; node = node.parentElement) {
    if (node.tagName === "LI") {
      if (node.classList.contains("chapter-item")) node.classList.add("expanded");
      var prev = node.previousElementSibling;
      if (prev && prev.classList.contains("chapter-item") && node.querySelector("ol.section")) {
        prev.classList.add("expanded");
      }
    }
  }

  // Scroll only the sidebar (not the page) so the current entry is visible.
  var boxRect = box.getBoundingClientRect();
  var linkRect = current.getBoundingClientRect();
  if (linkRect.top < boxRect.top || linkRect.bottom > boxRect.bottom) {
    box.scrollTop += linkRect.top - boxRect.top - box.clientHeight / 2;
  }
})();
