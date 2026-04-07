// GuidesForge Chrome Extension - Content Script
// Passive DOM recording using rrweb + click capture for step screenshots
// Includes floating recording widget, step annotations, and input tracking

(function () {
  "use strict";

  let rrwebStopFn = null;
  let isRecording = false;
  let isPaused = false;
  let clickListener = null;
  let inputListener = null;
  let navigationListener = null;
  let stepNumber = 0;
  let floatingWidget = null;
  let countdownOverlay = null;
  let lastUrl = window.location.href;

  function getUniqueSelector(element) {
    if (element.id) return "#" + CSS.escape(element.id);
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = "#" + CSS.escape(current.id);
        path.unshift(selector);
        break;
      }
      if (current.className && typeof current.className === "string") {
        const classes = current.className.trim().split(/\s+/)
          .filter(function(c) { return c && !c.startsWith("rrweb") && !c.startsWith("gf-"); })
          .slice(0, 3);
        if (classes.length > 0) {
          selector += "." + classes.map(function(c) { return CSS.escape(c); }).join(".");
        }
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(function(c) { return c.tagName === current.tagName; });
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += ":nth-of-type(" + index + ")";
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  function describeClick(element) {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent || "").trim().slice(0, 100);
    const ariaLabel = element.getAttribute("aria-label");
    const title = element.getAttribute("title");
    const placeholder = element.getAttribute("placeholder");
    const alt = element.getAttribute("alt");
    const type = element.getAttribute("type");
    const name = element.getAttribute("name");

    let action = "Click on";
    if (tag === "input") {
      if (type === "submit") action = "Click the submit button";
      else if (type === "checkbox") action = "Toggle the checkbox";
      else if (type === "radio") action = "Select the radio option";
      else action = "Click the " + (type || "input") + " field";
    } else if (tag === "button") {
      action = "Click the button";
    } else if (tag === "a") {
      action = "Click the link";
    } else if (tag === "select") {
      action = "Open the dropdown";
    } else if (tag === "textarea") {
      action = "Click the text area";
    }

    const label = ariaLabel || title || alt || placeholder || name || (text.length > 0 ? text : tag);
    return action + ' "' + label + '"';
  }

  function describeInput(element, value) {
    const type = element.getAttribute("type") || "text";
    const name = element.getAttribute("name");
    const placeholder = element.getAttribute("placeholder");
    const ariaLabel = element.getAttribute("aria-label");
    const label = ariaLabel || placeholder || name || type;

    if (type === "password") {
      return 'Type password in "' + label + '" field';
    }
    const displayValue = value.length > 50 ? value.slice(0, 50) + "..." : value;
    return 'Type "' + displayValue + '" in "' + label + '" field';
  }

  // COUNTDOWN OVERLAY (3, 2, 1)
  function showCountdown() {
    return new Promise(function(resolve) {
      countdownOverlay = document.createElement("div");
      countdownOverlay.setAttribute("data-guidesforge-ui", "true");
      Object.assign(countdownOverlay.style, {
        position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
        background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: "2147483647",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      });
      document.body.appendChild(countdownOverlay);

      let count = 3;
      const numEl = document.createElement("div");
      Object.assign(numEl.style, {
        fontSize: "120px", fontWeight: "800", color: "#fff",
        textShadow: "0 0 40px rgba(99,102,241,0.8)",
        animation: "gf-countdown-pop 0.8s ease-out"
      });
      numEl.textContent = count;
      countdownOverlay.appendChild(numEl);

      const interval = setInterval(function() {
        count--;
        if (count <= 0) {
          clearInterval(interval);
          if (countdownOverlay) { countdownOverlay.remove(); countdownOverlay = null; }
          resolve();
        } else {
          numEl.textContent = count;
          numEl.style.animation = "none";
          void numEl.offsetHeight;
          numEl.style.animation = "gf-countdown-pop 0.8s ease-out";
        }
      }, 800);
    });
  }

  // FLOATING RECORDING WIDGET
  function createFloatingWidget() {
    if (floatingWidget) floatingWidget.remove();

    floatingWidget = document.createElement("div");
    floatingWidget.setAttribute("data-guidesforge-ui", "true");
    floatingWidget.id = "gf-recording-widget";
    floatingWidget.innerHTML = '<div class="gf-widget-inner">' +
      '<div class="gf-widget-left">' +
        '<div class="gf-rec-dot"></div>' +
        '<span class="gf-rec-label">Recording</span>' +
        '<span class="gf-step-count">0 steps</span>' +
      '</div>' +
      '<div class="gf-widget-right">' +
        '<button class="gf-btn gf-btn-pause" title="Pause recording">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>' +
        '</button>' +
        '<button class="gf-btn gf-btn-stop" title="Stop and Upload">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>' +
          '<span>Stop &amp; Upload</span>' +
        '</button>' +
        '<button class="gf-btn gf-btn-cancel" title="Cancel recording">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(floatingWidget);

    // Make widget draggable
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    const inner = floatingWidget.querySelector(".gf-widget-inner");

    inner.addEventListener("mousedown", function(e) {
      if (e.target.closest(".gf-btn")) return;
      isDragging = true;
      const rect = floatingWidget.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      floatingWidget.style.transition = "none";
      e.preventDefault();
    });

    document.addEventListener("mousemove", function(e) {
      if (!isDragging) return;
      floatingWidget.style.left = (e.clientX - dragOffsetX) + "px";
      floatingWidget.style.right = "auto";
      floatingWidget.style.top = (e.clientY - dragOffsetY) + "px";
      floatingWidget.style.bottom = "auto";
      floatingWidget.style.transform = "none";
    });

    document.addEventListener("mouseup", function() {
      if (isDragging) { isDragging = false; floatingWidget.style.transition = "all 0.2s ease"; }
    });

    floatingWidget.querySelector(".gf-btn-pause").addEventListener("click", function(e) {
      e.stopPropagation(); togglePause();
    });
    floatingWidget.querySelector(".gf-btn-stop").addEventListener("click", function(e) {
      e.stopPropagation(); chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
    });
    floatingWidget.querySelector(".gf-btn-cancel").addEventListener("click", function(e) {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "CANCEL_RECORDING" });
      removeFloatingWidget(); removeAllAnnotations();
      isRecording = false; isPaused = false;
    });
  }

  function updateWidgetStepCount(count) {
    if (!floatingWidget) return;
    var el = floatingWidget.querySelector(".gf-step-count");
    if (el) {
      el.textContent = count + " step" + (count !== 1 ? "s" : "");
      el.style.animation = "none"; void el.offsetHeight;
      el.style.animation = "gf-step-bump 0.3s ease";
    }
  }

  function updateWidgetPauseState() {
    if (!floatingWidget) return;
    var pauseBtn = floatingWidget.querySelector(".gf-btn-pause");
    var recDot = floatingWidget.querySelector(".gf-rec-dot");
    var recLabel = floatingWidget.querySelector(".gf-rec-label");

    if (isPaused) {
      pauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
      pauseBtn.title = "Resume recording";
      recDot.classList.add("gf-paused");
      recLabel.textContent = "Paused";
    } else {
      pauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      pauseBtn.title = "Pause recording";
      recDot.classList.remove("gf-paused");
      recLabel.textContent = "Recording";
    }
  }

  function removeFloatingWidget() {
    if (floatingWidget) { floatingWidget.remove(); floatingWidget = null; }
  }

  // STEP NUMBER ANNOTATIONS ON PAGE
  function showStepAnnotation(element, num) {
    var rect = element.getBoundingClientRect();

    var highlight = document.createElement("div");
    highlight.setAttribute("data-guidesforge-ui", "true");
    highlight.classList.add("gf-step-highlight");
    Object.assign(highlight.style, {
      position: "fixed",
      left: (rect.left - 3) + "px", top: (rect.top - 3) + "px",
      width: (rect.width + 6) + "px", height: (rect.height + 6) + "px",
      border: "2px solid #6366F1", borderRadius: "8px",
      pointerEvents: "none", zIndex: "2147483646",
      animation: "gf-highlight-fade 1.5s ease-out forwards",
      boxShadow: "0 0 20px rgba(99, 102, 241, 0.3)"
    });

    var annotation = document.createElement("div");
    annotation.setAttribute("data-guidesforge-ui", "true");
    annotation.classList.add("gf-step-annotation");
    Object.assign(annotation.style, {
      position: "fixed",
      left: (rect.left - 12) + "px", top: (rect.top - 12) + "px",
      width: "24px", height: "24px",
      background: "#6366F1", color: "#fff", borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "11px", fontWeight: "700",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      zIndex: "2147483647", pointerEvents: "none",
      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.5)",
      animation: "gf-annotation-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
    });
    annotation.textContent = num;

    document.body.appendChild(highlight);
    document.body.appendChild(annotation);
    setTimeout(function() { highlight.remove(); }, 1500);
    setTimeout(function() { annotation.remove(); }, 5000);
  }

  function removeAllAnnotations() {
    document.querySelectorAll(".gf-step-highlight, .gf-step-annotation").forEach(function(el) { el.remove(); });
  }

  function togglePause() {
    isPaused = !isPaused;
    chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE", isPaused: isPaused });
    updateWidgetPauseState();
  }

  // CLICK HANDLER
  async function handleClick(event) {
    if (!isRecording || isPaused) return;
    var target = event.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.closest("[data-guidesforge-ui]")) return;

    var selector = getUniqueSelector(target);
    var description = describeClick(target);

    await new Promise(function(r) { setTimeout(r, 300); });

    stepNumber++;
    var currentStep = stepNumber;

    chrome.runtime.sendMessage({
      type: "STEP_CAPTURED",
      selector: selector,
      description: description,
      url: window.location.href,
      pageTitle: document.title,
      elementText: (target.textContent || "").trim().slice(0, 200),
      elementTag: target.tagName.toLowerCase(),
      stepNumber: currentStep,
    });

    showStepAnnotation(target, currentStep);
    updateWidgetStepCount(currentStep);
  }

  // INPUT CHANGE HANDLER
  var inputDebounceTimers = new WeakMap();

  function handleInputChange(event) {
    if (!isRecording || isPaused) return;
    var target = event.target;
    if (!target || target.closest("[data-guidesforge-ui]")) return;

    var tag = target.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && tag !== "select") return;

    var type = target.getAttribute("type") || "text";
    if (["checkbox", "radio", "submit", "button", "file", "hidden", "image", "reset"].indexOf(type) !== -1) return;

    if (inputDebounceTimers.has(target)) { clearTimeout(inputDebounceTimers.get(target)); }

    inputDebounceTimers.set(target, setTimeout(function() {
      inputDebounceTimers.delete(target);
      var value = target.value || "";
      if (!value.trim()) return;

      stepNumber++;
      var currentStep = stepNumber;
      var selector = getUniqueSelector(target);
      var description = describeInput(target, value);

      chrome.runtime.sendMessage({
        type: "STEP_CAPTURED",
        selector: selector, description: description,
        url: window.location.href, pageTitle: document.title,
        elementText: type === "password" ? "********" : value.slice(0, 200),
        elementTag: tag, stepNumber: currentStep,
      });

      showStepAnnotation(target, currentStep);
      updateWidgetStepCount(currentStep);
    }, 1000));
  }

  // PAGE NAVIGATION HANDLER
  function handleNavigation() {
    if (!isRecording || isPaused) return;
    var currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    stepNumber++;
    var currentStep = stepNumber;

    chrome.runtime.sendMessage({
      type: "STEP_CAPTURED", selector: "",
      description: 'Navigate to "' + (document.title || currentUrl) + '"',
      url: currentUrl, pageTitle: document.title,
      elementText: "", elementTag: "navigation", stepNumber: currentStep,
    });
    updateWidgetStepCount(currentStep);
  }

  // RRWEB RECORDING
  function startRrweb() {
    if (typeof rrweb === "undefined") {
      var script = document.createElement("script");
      script.src = chrome.runtime.getURL("rrweb.min.js");
      script.onload = function() { initRrweb(); };
      document.head.appendChild(script);
    } else {
      initRrweb();
    }
  }

  function initRrweb() {
    if (typeof rrweb !== "undefined" && rrweb.record) {
      rrwebStopFn = rrweb.record({
        emit: function(event) {
          if (!isPaused) { chrome.runtime.sendMessage({ type: "RRWEB_EVENT", event: event }); }
        },
        sampling: { mousemove: false, mouseInteraction: true, scroll: 150, media: 800, input: "last" },
        blockClass: "guidesforge-block",
        ignoreClass: "guidesforge-ignore",
        maskInputOptions: { password: true },
      });
    }
  }

  function stopRrweb() {
    if (rrwebStopFn) { rrwebStopFn(); rrwebStopFn = null; }
  }

  // START / STOP RECORDING
  async function startRecordingFlow(withCountdown) {
    if (withCountdown) { await showCountdown(); }
    isRecording = true;
    isPaused = false;
    stepNumber = 0;
    lastUrl = window.location.href;

    createFloatingWidget();
    startRrweb();

    clickListener = handleClick;
    document.addEventListener("click", clickListener, true);
    inputListener = handleInputChange;
    document.addEventListener("input", inputListener, true);
    navigationListener = setInterval(handleNavigation, 500);
  }

  function stopRecordingFlow() {
    isRecording = false;
    isPaused = false;
    stopRrweb();
    if (clickListener) { document.removeEventListener("click", clickListener, true); clickListener = null; }
    if (inputListener) { document.removeEventListener("input", inputListener, true); inputListener = null; }
    if (navigationListener) { clearInterval(navigationListener); navigationListener = null; }
    removeFloatingWidget();
    setTimeout(removeAllAnnotations, 2000);
  }

  // MESSAGE LISTENER
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    switch (message.type) {
      case "START_RRWEB":
        startRecordingFlow(message.withCountdown !== false);
        sendResponse({ started: true });
        break;
      case "STOP_RRWEB":
        stopRecordingFlow();
        sendResponse({ stopped: true });
        break;
      case "CANCEL_RRWEB":
        stopRecordingFlow();
        removeAllAnnotations();
        sendResponse({ cancelled: true });
        break;
      case "PING":
        sendResponse({ alive: true, isRecording: isRecording, isPaused: isPaused, stepNumber: stepNumber });
        break;
      case "GET_RECORDING_STATE":
        sendResponse({ isRecording: isRecording, isPaused: isPaused, stepNumber: stepNumber });
        break;
    }
    return true;
  });

  // INJECT STYLES
  var style = document.createElement("style");
  style.setAttribute("data-guidesforge-ui", "true");
  style.textContent = [
    "@keyframes gf-countdown-pop { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }",
    "@keyframes gf-highlight-fade { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }",
    "@keyframes gf-annotation-pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }",
    "@keyframes gf-step-bump { 0% { transform: scale(1); } 50% { transform: scale(1.2); color: #818cf8; } 100% { transform: scale(1); } }",
    "@keyframes gf-rec-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }",
    "#gf-recording-widget { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; transition: all 0.2s ease; pointer-events: auto; }",
    "#gf-recording-widget .gf-widget-inner { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: rgba(12, 13, 20, 0.95); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.1); cursor: grab; user-select: none; }",
    "#gf-recording-widget .gf-widget-inner:active { cursor: grabbing; }",
    "#gf-recording-widget .gf-widget-left { display: flex; align-items: center; gap: 8px; }",
    "#gf-recording-widget .gf-rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; animation: gf-rec-pulse 1.5s ease-in-out infinite; flex-shrink: 0; }",
    "#gf-recording-widget .gf-rec-dot.gf-paused { background: #f59e0b; animation: none; }",
    "#gf-recording-widget .gf-rec-label { color: #fff; font-size: 13px; font-weight: 600; white-space: nowrap; }",
    "#gf-recording-widget .gf-step-count { color: #818cf8; font-size: 12px; font-weight: 500; white-space: nowrap; padding: 2px 8px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; }",
    "#gf-recording-widget .gf-widget-right { display: flex; align-items: center; gap: 6px; margin-left: 4px; }",
    "#gf-recording-widget .gf-btn { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border: none; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 500; font-family: inherit; transition: all 0.15s ease; white-space: nowrap; }",
    "#gf-recording-widget .gf-btn-pause { background: rgba(255, 255, 255, 0.08); color: #d1d5db; }",
    "#gf-recording-widget .gf-btn-pause:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }",
    "#gf-recording-widget .gf-btn-stop { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }",
    "#gf-recording-widget .gf-btn-stop:hover { background: rgba(239, 68, 68, 0.25); }",
    "#gf-recording-widget .gf-btn-cancel { background: rgba(255, 255, 255, 0.05); color: #6b7280; padding: 6px; }",
    "#gf-recording-widget .gf-btn-cancel:hover { background: rgba(255, 255, 255, 0.1); color: #9ca3af; }",
  ].join("\n");
  document.head.appendChild(style);
})();
