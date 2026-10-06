"use strict";

// Fix back button cache problem
window.onunload = function () { };

// Java runner endpoint, the single place it is defined. Resolved from the book
// root (path_to_root), so it is "<book root>/../_runner/execute": a sibling of
// the book directory, valid under any URL prefix. No hostname or prefix baked in.
const RUNNER_ENDPOINT = new URL("../_runner/execute", new URL(window.path_to_root || "./", location.href)).href;

// Java release the runner compiles and runs with. Also shown on challenge editors.
const JAVA_RELEASE = '25';

// Global variable, shared between modules
function playground_text(playground, hidden = true) {
  let code_block = playground.querySelector("code");

  if (window.ace && code_block.classList.contains("editable")) {
    let editor = window.ace.edit(code_block);
    return editor.getValue();
  } else if (hidden) {
    return code_block.textContent;
  } else {
    return code_block.innerText;
  }
}

(function codeSnippets() {
  function fetch_with_timeout(url, options, timeout = 10000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout),
      ),
    ]);
  }

  var playgrounds = Array.from(document.querySelectorAll(".playground"));
  if (playgrounds.length > 0) {
    fetch_with_timeout("https://play.rust-lang.org/meta/crates", {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      mode: "cors",
    })
      .then((response) => response.json())
      .then((response) => {
        // get list of crates available in the rust playground
        let playground_crates = response.crates.map((item) => item["id"]);
        playgrounds.forEach((block) =>
          handle_crate_list_update(block, playground_crates),
        );
      });
  }

  function handle_crate_list_update(playground_block, playground_crates) {
    // update the play buttons after receiving the response
    update_play_button(playground_block, playground_crates);

    // and install on change listener to dynamically update ACE editors
    if (window.ace) {
      let code_block = playground_block.querySelector("code");
      if (code_block.classList.contains("editable")) {
        let editor = window.ace.edit(code_block);
        editor.addEventListener("change", function (e) {
          update_play_button(playground_block, playground_crates);
        });
        // add Ctrl-Enter command to execute rust code
        editor.commands.addCommand({
          name: "run",
          bindKey: {
            win: "Ctrl-Enter",
            mac: "Ctrl-Enter",
          },
          exec: (_editor) => run_java_code(playground_block),
        });
      }
    }
  }

  // updates the visibility of play button based on `no_run` class and
  // used crates vs ones available on http://play.rust-lang.org
  function update_play_button(pre_block, playground_crates) {
    var play_button = pre_block.querySelector(".play-button");

    // skip if code is `no_run`
    if (pre_block.querySelector("code").classList.contains("no_run")) {
      play_button.classList.add("hidden");
      return;
    }

    // get list of `extern crate`'s from snippet
    var txt = playground_text(pre_block);
    var re = /extern\s+crate\s+([a-zA-Z_0-9]+)\s*;/g;
    var snippet_crates = [];
    var item;
    while ((item = re.exec(txt))) {
      snippet_crates.push(item[1]);
    }

    // check if all used crates are available on play.rust-lang.org
    var all_available = snippet_crates.every(function (elem) {
      return playground_crates.indexOf(elem) > -1;
    });

    if (all_available) {
      play_button.classList.remove("hidden");
    } else {
      play_button.classList.add("hidden");
    }
  }

  async function run_java_code(code_block) {
    var result_block = code_block.querySelector(".result");
    if (!result_block) {
      result_block = document.createElement("code");
      result_block.className = "result hljs language-bash";

      code_block.append(result_block);
    }

    let text = playground_text(code_block);

    var params = {
      release: JAVA_RELEASE,
      runtime: 'latest',
      action: 'run',
      preview: false,
      code: text,
    };

    result_block.innerText = "Running...";

    const response = fetch_with_timeout(RUNNER_ENDPOINT, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      mode: "cors",
      body: JSON.stringify(params),
    })
      .then((response) => response.json())
      .then((response) => {
        console.info(response);

        if (response["success"] != true) {
          result_block.innerText = response["stderr"];
          if (response["stdout"]) {
            result_block.innerText = result_block.innerText + "\n----------\n" + response["stdout"];
          }
        }
        else {
          result_block.innerText = response["stdout"];
        }
        result_block.classList.remove("result-no-output");
      })
      .catch(
        (error) =>
        (result_block.innerText =
          "Playground Communication: " + error.message),
      );
  }

  // Syntax highlighting Configuration
  hljs.configure({
    tabReplace: "    ", // 4 spaces
    languages: [], // Languages used for auto-detection
  });

  let code_nodes = Array.from(document.querySelectorAll("code"))
    // Don't highlight `inline code` blocks in headers.
    .filter(function (node) {
      return !node.parentElement.classList.contains("header");
    });

  if (window.ace) {
    // language-rust class needs to be removed for editable
    // blocks or highlightjs will capture events
    code_nodes
      .filter(function (node) {
        return node.classList.contains("editable");
      })
      .forEach(function (block) {
        block.classList.remove("language-java");
      });

    code_nodes
      .filter(function (node) {
        return !node.classList.contains("editable");
      })
      .forEach(function (block) {
        hljs.highlightBlock(block);
      });
  } else {
    code_nodes.forEach(function (block) {
      hljs.highlightBlock(block);
    });
  }

  // Adding the hljs class gives code blocks the color css
  // even if highlighting doesn't apply
  code_nodes.forEach(function (block) {
    block.classList.add("hljs");
  });

  Array.from(document.querySelectorAll("code.language-java")).forEach(
    function (block) {
      var lines = Array.from(block.querySelectorAll(".boring"));
      // If no lines were hidden, return
      if (!lines.length) {
        return;
      }
      block.classList.add("hide-boring");

      var buttons = document.createElement("div");
      buttons.className = "buttons";
      buttons.innerHTML =
        '<button class="fa fa-eye" title="Show hidden lines" aria-label="Show hidden lines"></button>';

      // add expand button
      var pre_block = block.parentNode;
      pre_block.insertBefore(buttons, pre_block.firstChild);

      pre_block
        .querySelector(".buttons")
        .addEventListener("click", function (e) {
          if (e.target.classList.contains("fa-eye")) {
            e.target.classList.remove("fa-eye");
            e.target.classList.add("fa-eye-slash");
            e.target.title = "Hide lines";
            e.target.setAttribute("aria-label", e.target.title);

            block.classList.remove("hide-boring");
          } else if (e.target.classList.contains("fa-eye-slash")) {
            e.target.classList.remove("fa-eye-slash");
            e.target.classList.add("fa-eye");
            e.target.title = "Show hidden lines";
            e.target.setAttribute("aria-label", e.target.title);

            block.classList.add("hide-boring");
          }
        });
    },
  );

  if (window.playground_copyable) {
    Array.from(document.querySelectorAll("pre code")).forEach(function (block) {
      var pre_block = block.parentNode;
      if (!pre_block.classList.contains("playground")) {
        var buttons = pre_block.querySelector(".buttons");
        if (!buttons) {
          buttons = document.createElement("div");
          buttons.className = "buttons";
          pre_block.insertBefore(buttons, pre_block.firstChild);
        }



        let code_block = pre_block.querySelector("code");
        if (code_block.classList.contains("no_run") == false) {
          var runCodeButton = document.createElement("button");
          runCodeButton.className = "fa fa-play play-button";
          runCodeButton.hidden = true;
          runCodeButton.title = "Run this code";
          runCodeButton.setAttribute("aria-label", runCodeButton.title);

          buttons.insertBefore(runCodeButton, buttons.firstChild);
          runCodeButton.addEventListener("click", function (e) {
            run_java_code(pre_block);
          });
        }
        var clipButton = document.createElement("button");
        clipButton.className = "fa fa-copy clip-button";
        clipButton.title = "Copy to clipboard";
        clipButton.setAttribute("aria-label", clipButton.title);
        clipButton.innerHTML = '<i class="tooltiptext"></i>';

        buttons.insertBefore(clipButton, buttons.firstChild);
      }
    });
  }

  // Process playground code blocks
  Array.from(document.querySelectorAll(".playground")).forEach(
    function (pre_block) {
      // Add play button
      var buttons = pre_block.querySelector(".buttons");
      if (!buttons) {
        buttons = document.createElement("div");
        buttons.className = "buttons";
        pre_block.insertBefore(buttons, pre_block.firstChild);
      }

      var runCodeButton = document.createElement("button");
      runCodeButton.className = "fa fa-play play-button";
      runCodeButton.hidden = true;
      runCodeButton.title = "Run this code";
      runCodeButton.setAttribute("aria-label", runCodeButton.title);

      buttons.insertBefore(runCodeButton, buttons.firstChild);
      runCodeButton.addEventListener("click", function (e) {
        run_java_code(pre_block);
      });

      if (window.playground_copyable) {
        var copyCodeClipboardButton = document.createElement("button");
        copyCodeClipboardButton.className = "fa fa-copy clip-button";
        copyCodeClipboardButton.innerHTML = '<i class="tooltiptext"></i>';
        copyCodeClipboardButton.title = "Copy to clipboard";
        copyCodeClipboardButton.setAttribute(
          "aria-label",
          copyCodeClipboardButton.title,
        );

        buttons.insertBefore(copyCodeClipboardButton, buttons.firstChild);
      }

      let code_block = pre_block.querySelector("code");
      if (window.ace && code_block.classList.contains("editable")) {
        var undoChangesButton = document.createElement("button");
        undoChangesButton.className = "fa fa-history reset-button";
        undoChangesButton.title = "Undo changes";
        undoChangesButton.setAttribute("aria-label", undoChangesButton.title);

        buttons.insertBefore(undoChangesButton, buttons.firstChild);

        undoChangesButton.addEventListener("click", function () {
          let editor = window.ace.edit(code_block);
          editor.setValue(editor.originalCode);
          editor.clearSelection();
        });
      }
    },
  );

  // Challenge pages: blocks render read-only; an Edit button unlocks them with
  // Java completion, and Run executes whatever is in the editor.
  function isChallengePage() {
    return /\/challenges(\.html)?\/?$/.test(location.pathname);
  }

  function currentAceTheme() {
    var html = document.documentElement;
    var dark = ["coal", "navy", "ayu"].some((t) => html.classList.contains(t));
    return dark ? "ace/theme/tomorrow_night" : "ace/theme/dawn";
  }

  function setupChallengeBlock(pre_block) {
    var code_block = pre_block.querySelector("code");
    // Editable blocks lose "language-java" earlier in this file, so accept both.
    if (
      !code_block ||
      !(
        code_block.classList.contains("language-java") ||
        code_block.classList.contains("editable")
      )
    ) {
      return;
    }
    if (code_block.classList.contains("no_run")) return;

    var buttons = pre_block.querySelector(".buttons");
    if (!buttons) return;

    // Always show the Run button here (it is rendered hidden by default).
    var play_button = buttons.querySelector(".play-button");
    if (play_button) play_button.hidden = false;

    if (
      !window.ace ||
      code_block.classList.contains("panics") ||
      code_block.classList.contains("does_not_compile")
    ) {
      return;
    }

    var badge = document.createElement("span");
    badge.className = "java-release-badge";
    badge.textContent = "Java " + JAVA_RELEASE;
    pre_block.appendChild(badge);

    var editor = null;

    function ensureEditor() {
      if (editor) return editor;

      if (code_block.classList.contains("editable")) {
        editor = window.ace.edit(code_block);
      } else {
        // Plain block: swap the highlighted markup for an Ace editor. The
        // text still includes hidden (~) lines so the program stays complete.
        var text = code_block.textContent;
        code_block.classList.remove("hide-boring");
        pre_block
          .querySelectorAll(".fa-eye, .fa-eye-slash")
          .forEach((b) => b.remove());
        code_block.textContent = text;
        code_block.classList.add("editable");
        editor = window.ace.edit(code_block);
        editor.setOptions({
          highlightActiveLine: false,
          showPrintMargin: false,
          showLineNumbers: false,
          showGutter: false,
          maxLines: Infinity,
          fontSize: "0.875em",
        });
        editor.$blockScrolling = Infinity;
        editor.originalCode = text;
        editor.setTheme(currentAceTheme());
        window.editors = window.editors || [];
        window.editors.push(editor);
      }

      editor.getSession().setMode("ace/mode/java");
      editor.commands.addCommand({
        name: "run",
        bindKey: { win: "Ctrl-Enter", mac: "Ctrl-Enter" },
        exec: () => run_java_code(pre_block),
      });
      return editor;
    }

    function setEditing(on) {
      var ed = ensureEditor();
      ed.setReadOnly(!on);
      ed.renderer.$cursorLayer.element.style.display = on ? "" : "none";
      pre_block.classList.toggle("challenge-editing", on);
      edit_button.title = on ? "Lock editing" : "Edit this code";
      edit_button.setAttribute("aria-label", edit_button.title);
      edit_button.setAttribute("aria-pressed", String(on));

      var tools = window.ace.require("ace/ext/language_tools");
      if (on && tools && window.javaCompletions) {
        if (!window.javaCompletionsRegistered) {
          tools.addCompleter(window.javaCompletions.completer);
          window.ace
            .require("ace/snippets")
            .snippetManager.register(window.javaCompletions.snippets, "java");
          window.javaCompletionsRegistered = true;
        }
        ed.setOptions({
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
        });
      } else if (tools) {
        ed.setOptions({
          enableBasicAutocompletion: false,
          enableLiveAutocompletion: false,
          enableSnippets: false,
        });
      }
      if (on) ed.focus();
    }

    var edit_button = document.createElement("button");
    edit_button.className = "fa fa-pencil edit-button";
    edit_button.title = "Edit this code";
    edit_button.setAttribute("aria-label", edit_button.title);
    edit_button.setAttribute("aria-pressed", "false");
    buttons.insertBefore(edit_button, buttons.firstChild);
    edit_button.addEventListener("click", function () {
      setEditing(!pre_block.classList.contains("challenge-editing"));
    });

    var reset_button = document.createElement("button");
    reset_button.className = "fa fa-history reset-button";
    reset_button.title = "Undo changes";
    reset_button.setAttribute("aria-label", reset_button.title);
    buttons.insertBefore(reset_button, buttons.firstChild);
    reset_button.addEventListener("click", function () {
      if (!editor) return;
      editor.setValue(editor.originalCode);
      editor.clearSelection();
      setEditing(false);
    });

    // Editable blocks already have an editor: start them locked.
    if (code_block.classList.contains("editable")) {
      setEditing(false);
    }
  }

  if (isChallengePage()) {
    document.body.classList.add("challenge-page");
    // Run after every additional-js script (mode-java, language_tools) loaded.
    document.addEventListener("DOMContentLoaded", function () {
      Array.from(document.querySelectorAll("pre")).forEach(setupChallengeBlock);
    });
  }
})();

(function themes() {
  var html = document.querySelector("html");
  var themeToggleButton = document.getElementById("theme-toggle");
  var themePopup = document.getElementById("theme-list");
  var themeColorMetaTag = document.querySelector('meta[name="theme-color"]');
  var stylesheets = {
    ayuHighlight: document.querySelector("[href$='ayu-highlight.css']"),
    tomorrowNight: document.querySelector("[href$='tomorrow-night.css']"),
    highlight: document.querySelector("[href$='highlight.css']"),
  };

  function showThemes() {
    themePopup.style.display = "block";
    themeToggleButton.setAttribute("aria-expanded", true);
    themePopup.querySelector("button#" + get_theme()).focus();
  }

  function updateThemeSelected() {
    themePopup.querySelectorAll(".theme-selected").forEach(function (el) {
      el.classList.remove("theme-selected");
    });
    themePopup
      .querySelector("button#" + get_theme())
      .classList.add("theme-selected");
  }

  function hideThemes() {
    themePopup.style.display = "none";
    themeToggleButton.setAttribute("aria-expanded", false);
    themeToggleButton.focus();
  }

  function get_theme() {
    var theme;
    try {
      theme = localStorage.getItem("mdbook-theme");
    } catch (e) { }
    if (theme === null || theme === undefined) {
      return default_theme;
    } else {
      return theme;
    }
  }

  function set_theme(theme, store = true) {
    let ace_theme;

    if (theme == "coal" || theme == "navy") {
      stylesheets.ayuHighlight.disabled = true;
      stylesheets.tomorrowNight.disabled = false;
      stylesheets.highlight.disabled = true;

      ace_theme = "ace/theme/tomorrow_night";
    } else if (theme == "ayu") {
      stylesheets.ayuHighlight.disabled = false;
      stylesheets.tomorrowNight.disabled = true;
      stylesheets.highlight.disabled = true;
      ace_theme = "ace/theme/tomorrow_night";
    } else {
      stylesheets.ayuHighlight.disabled = true;
      stylesheets.tomorrowNight.disabled = true;
      stylesheets.highlight.disabled = false;
      ace_theme = "ace/theme/dawn";
    }

    setTimeout(function () {
      themeColorMetaTag.content = getComputedStyle(
        document.body,
      ).backgroundColor;
    }, 1);

    if (window.ace && window.editors) {
      window.editors.forEach(function (editor) {
        editor.setTheme(ace_theme);
      });
    }

    var previousTheme = get_theme();

    if (store) {
      try {
        localStorage.setItem("mdbook-theme", theme);
      } catch (e) { }
    }

    html.classList.remove(previousTheme);
    html.classList.add(theme);
    updateThemeSelected();
  }

  // Set theme
  var theme = get_theme();

  set_theme(theme, false);

  themeToggleButton.addEventListener("click", function () {
    if (themePopup.style.display === "block") {
      hideThemes();
    } else {
      showThemes();
    }
  });

  themePopup.addEventListener("click", function (e) {
    var theme;
    if (e.target.className === "theme") {
      theme = e.target.id;
    } else if (e.target.parentElement.className === "theme") {
      theme = e.target.parentElement.id;
    } else {
      return;
    }
    set_theme(theme);
  });

  themePopup.addEventListener("focusout", function (e) {
    // e.relatedTarget is null in Safari and Firefox on macOS (see workaround below)
    if (
      !!e.relatedTarget &&
      !themeToggleButton.contains(e.relatedTarget) &&
      !themePopup.contains(e.relatedTarget)
    ) {
      hideThemes();
    }
  });

  // Should not be needed, but it works around an issue on macOS & iOS: https://github.com/rust-lang/mdBook/issues/628
  document.addEventListener("click", function (e) {
    if (
      themePopup.style.display === "block" &&
      !themeToggleButton.contains(e.target) &&
      !themePopup.contains(e.target)
    ) {
      hideThemes();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }
    if (!themePopup.contains(e.target)) {
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        hideThemes();
        break;
      case "ArrowUp":
        e.preventDefault();
        var li = document.activeElement.parentElement;
        if (li && li.previousElementSibling) {
          li.previousElementSibling.querySelector("button").focus();
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        var li = document.activeElement.parentElement;
        if (li && li.nextElementSibling) {
          li.nextElementSibling.querySelector("button").focus();
        }
        break;
      case "Home":
        e.preventDefault();
        themePopup.querySelector("li:first-child button").focus();
        break;
      case "End":
        e.preventDefault();
        themePopup.querySelector("li:last-child button").focus();
        break;
    }
  });
})();

(function sidebar() {
  var html = document.querySelector("html");
  var sidebar = document.getElementById("sidebar");
  var sidebarLinks = document.querySelectorAll("#sidebar a");
  var sidebarToggleButton = document.getElementById("sidebar-toggle");
  var sidebarResizeHandle = document.getElementById("sidebar-resize-handle");
  var firstContact = null;

  function showSidebar() {
    html.classList.remove("sidebar-hidden");
    html.classList.add("sidebar-visible");
    Array.from(sidebarLinks).forEach(function (link) {
      link.setAttribute("tabIndex", 0);
    });
    sidebarToggleButton.setAttribute("aria-expanded", true);
    sidebar.setAttribute("aria-hidden", false);
    try {
      localStorage.setItem("mdbook-sidebar", "visible");
    } catch (e) { }
  }

  var sidebarAnchorToggles = document.querySelectorAll("#sidebar a.toggle");

  function toggleSection(ev) {
    ev.currentTarget.parentElement.classList.toggle("expanded");
  }

  Array.from(sidebarAnchorToggles).forEach(function (el) {
    el.addEventListener("click", toggleSection);
  });

  function hideSidebar() {
    html.classList.remove("sidebar-visible");
    html.classList.add("sidebar-hidden");
    Array.from(sidebarLinks).forEach(function (link) {
      link.setAttribute("tabIndex", -1);
    });
    sidebarToggleButton.setAttribute("aria-expanded", false);
    sidebar.setAttribute("aria-hidden", true);
    try {
      localStorage.setItem("mdbook-sidebar", "hidden");
    } catch (e) { }
  }

  // Toggle sidebar
  sidebarToggleButton.addEventListener("click", function sidebarToggle() {
    if (html.classList.contains("sidebar-hidden")) {
      var current_width = parseInt(
        document.documentElement.style.getPropertyValue("--sidebar-width"),
        10,
      );
      if (current_width < 150) {
        document.documentElement.style.setProperty("--sidebar-width", "150px");
      }
      showSidebar();
    } else if (html.classList.contains("sidebar-visible")) {
      hideSidebar();
    } else {
      if (getComputedStyle(sidebar)["transform"] === "none") {
        hideSidebar();
      } else {
        showSidebar();
      }
    }
  });

  sidebarResizeHandle.addEventListener("mousedown", initResize, false);

  function initResize(e) {
    window.addEventListener("mousemove", resize, false);
    window.addEventListener("mouseup", stopResize, false);
    html.classList.add("sidebar-resizing");
  }
  function resize(e) {
    var pos = e.clientX - sidebar.offsetLeft;
    if (pos < 20) {
      hideSidebar();
    } else {
      if (html.classList.contains("sidebar-hidden")) {
        showSidebar();
      }
      pos = Math.min(pos, window.innerWidth - 100);
      document.documentElement.style.setProperty("--sidebar-width", pos + "px");
    }
  }
  //on mouseup remove windows functions mousemove & mouseup
  function stopResize(e) {
    html.classList.remove("sidebar-resizing");
    window.removeEventListener("mousemove", resize, false);
    window.removeEventListener("mouseup", stopResize, false);
  }

  document.addEventListener(
    "touchstart",
    function (e) {
      firstContact = {
        x: e.touches[0].clientX,
        time: Date.now(),
      };
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    function (e) {
      if (!firstContact) return;

      var curX = e.touches[0].clientX;
      var xDiff = curX - firstContact.x,
        tDiff = Date.now() - firstContact.time;

      if (tDiff < 250 && Math.abs(xDiff) >= 150) {
        if (
          xDiff >= 0 &&
          firstContact.x < Math.min(document.body.clientWidth * 0.25, 300)
        )
          showSidebar();
        else if (xDiff < 0 && curX < 300) hideSidebar();

        firstContact = null;
      }
    },
    { passive: true },
  );

  // Scroll sidebar to current active section
  var activeSection = document
    .getElementById("sidebar")
    .querySelector(".active");
  if (activeSection) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
    activeSection.scrollIntoView({ block: "center" });
  }
})();

(function chapterNavigation() {
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }
    if (window.search && window.search.hasFocus()) {
      return;
    }

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        var nextButton = document.querySelector(".nav-chapters.next");
        if (nextButton) {
          window.location.href = nextButton.href;
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        var previousButton = document.querySelector(".nav-chapters.previous");
        if (previousButton) {
          window.location.href = previousButton.href;
        }
        break;
    }
  });
})();

(function clipboard() {
  var clipButtons = document.querySelectorAll(".clip-button");

  function hideTooltip(elem) {
    elem.firstChild.innerText = "";
    elem.className = "fa fa-copy clip-button";
  }

  function showTooltip(elem, msg) {
    elem.firstChild.innerText = msg;
    elem.className = "fa fa-copy tooltipped";
  }

  var clipboardSnippets = new ClipboardJS(".clip-button", {
    text: function (trigger) {
      hideTooltip(trigger);
      let playground = trigger.closest("pre");
      return playground_text(playground, false);
    },
  });

  Array.from(clipButtons).forEach(function (clipButton) {
    clipButton.addEventListener("mouseout", function (e) {
      hideTooltip(e.currentTarget);
    });
  });

  clipboardSnippets.on("success", function (e) {
    e.clearSelection();
    showTooltip(e.trigger, "Copied!");
  });

  clipboardSnippets.on("error", function (e) {
    showTooltip(e.trigger, "Clipboard error!");
  });
})();

(function scrollToTop() {
  var menuTitle = document.querySelector(".menu-title");

  menuTitle.addEventListener("click", function () {
    document.scrollingElement.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

(function controllMenu() {
  var menu = document.getElementById("menu-bar");

  (function controllPosition() {
    var scrollTop = document.scrollingElement.scrollTop;
    var prevScrollTop = scrollTop;
    var minMenuY = -menu.clientHeight - 50;
    // When the script loads, the page can be at any scroll (e.g. if you reforesh it).
    menu.style.top = scrollTop + "px";
    // Same as parseInt(menu.style.top.slice(0, -2), but faster
    var topCache = menu.style.top.slice(0, -2);
    menu.classList.remove("sticky");
    var stickyCache = false; // Same as menu.classList.contains('sticky'), but faster
    document.addEventListener(
      "scroll",
      function () {
        scrollTop = Math.max(document.scrollingElement.scrollTop, 0);
        // `null` means that it doesn't need to be updated
        var nextSticky = null;
        var nextTop = null;
        var scrollDown = scrollTop > prevScrollTop;
        var menuPosAbsoluteY = topCache - scrollTop;
        if (scrollDown) {
          nextSticky = false;
          if (menuPosAbsoluteY > 0) {
            nextTop = prevScrollTop;
          }
        } else {
          if (menuPosAbsoluteY > 0) {
            nextSticky = true;
          } else if (menuPosAbsoluteY < minMenuY) {
            nextTop = prevScrollTop + minMenuY;
          }
        }
        if (nextSticky === true && stickyCache === false) {
          menu.classList.add("sticky");
          stickyCache = true;
        } else if (nextSticky === false && stickyCache === true) {
          menu.classList.remove("sticky");
          stickyCache = false;
        }
        if (nextTop !== null) {
          menu.style.top = nextTop + "px";
          topCache = nextTop;
        }
        prevScrollTop = scrollTop;
      },
      { passive: true },
    );
  })();
  (function controllBorder() {
    menu.classList.remove("bordered");
    document.addEventListener(
      "scroll",
      function () {
        if (menu.offsetTop === 0) {
          menu.classList.remove("bordered");
        } else {
          menu.classList.add("bordered");
        }
      },
      { passive: true },
    );
  })();
})();
