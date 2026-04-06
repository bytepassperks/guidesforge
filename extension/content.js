// GuidesForge Chrome Extension - Content Script
// Passive DOM recording using rrweb + click capture for step screenshots

(function () {
  "use strict";

  let rrwebStopFn = null;
  let isRecording = false;
  let clickListener = null;

  // Unique CSS selector generator
  function getUniqueSelector(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;

    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("rrweb"))
          .slice(0, 3);
        if (classes.length > 0) {
          selector += "." + classes.map((c) => CSS.escape(c)).join(".");
        }
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  // Generate a description of what was clicked
  function describeClick(element) {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent || "").trim().slice(0, 100);
    const ariaLabel = element.getAttribute("aria-label");
    const title = element.getAttribute("title");
    const placeholder = element.getAttribute("placeholder");
    const alt = element.getAttribute("alt");
    const type = element.getAttribute("type");

    let action = "Click on";
    if (tag === "input") {
      if (type === "submit") action = "Click the submit button";
      else if (type === "checkbox") action = "Toggle the checkbox";
      else if (type === "radio") action = "Select the radio option";
      else action = `Click the ${type || "input"} field`;
    } else if (tag === "button") {
      action = "Click the button";
    } else if (tag === "a") {
      action = "Click the link";
    } else if (tag === "select") {
      action = "Open the dropdown";
    } else if (tag === "textarea") {
      action = "Click the text area";
    }

    const label =
      ariaLabel || title || alt || placeholder || (text.length > 0 ? text : tag);
    return `${action} "${label}"`;
  }

  // Capture screenshot of visible viewport
  async function captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CAPTURE_TAB" }, (response) => {
        resolve(response?.dataUrl || null);
      });
    });
  }

  // Handle click events for step capture
  async function handleClick(event) {
    if (!isRecording) return;

    const target = event.target;
    if (!target || target === document.body || target === document.documentElement)
      return;

    // Ignore clicks on the GuidesForge recorder UI
    if (target.closest("[data-guidesforge-ui]")) return;

    const selector = getUniqueSelector(target);
    const description = describeClick(target);

    // Small delay to let any UI changes settle
    await new Promise((r) => setTimeout(r, 300));

    // Request screenshot capture from background
    chrome.runtime.sendMessage({
      type: "STEP_CAPTURED",
      selector: selector,
      description: description,
      url: window.location.href,
      pageTitle: document.title,
      elementText: (target.textContent || "").trim().slice(0, 200),
      elementTag: target.tagName.toLowerCase(),
    });

    // Show visual feedback
    showStepIndicator(target);
  }

  // Visual feedback when a step is captured
  function showStepIndicator(element) {
    const rect = element.getBoundingClientRect();
    const indicator = document.createElement("div");
    indicator.setAttribute("data-guidesforge-ui", "true");
    indicator.style.cssText = `
      position: fixed;
      left: ${rect.left - 4}px;
      top: ${rect.top - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 2px solid #6366F1;
      border-radius: 8px;
      pointer-events: none;
      z-index: 2147483647;
      animation: guidesforge-pulse 0.6s ease-out;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
    `;
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 600);
  }

  // Start rrweb recording
  function startRrweb() {
    if (typeof rrweb === "undefined") {
      // Load rrweb dynamically
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("rrweb.min.js");
      script.onload = () => initRrweb();
      document.head.appendChild(script);
    } else {
      initRrweb();
    }
  }

  function initRrweb() {
    if (typeof rrweb !== "undefined" && rrweb.record) {
      rrwebStopFn = rrweb.record({
        emit(event) {
          chrome.runtime.sendMessage({ type: "RRWEB_EVENT", event });
        },
        sampling: {
          mousemove: false,
          mouseInteraction: true,
          scroll: 150,
          media: 800,
          input: "last",
        },
        blockClass: "guidesforge-block",
        ignoreClass: "guidesforge-ignore",
        maskInputOptions: {
          password: true,
        },
      });
    }
  }

  // Stop rrweb recording
  function stopRrweb() {
    if (rrwebStopFn) {
      rrwebStopFn();
      rrwebStopFn = null;
    }
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "START_RRWEB":
        isRecording = true;
        startRrweb();
        clickListener = handleClick;
        document.addEventListener("click", clickListener, true);
        sendResponse({ started: true });
        break;

      case "STOP_RRWEB":
        isRecording = false;
        stopRrweb();
        if (clickListener) {
          document.removeEventListener("click", clickListener, true);
          clickListener = null;
        }
        sendResponse({ stopped: true });
        break;

      case "PING":
        sendResponse({ alive: true });
        break;
    }
    return true;
  });

  // Inject animation style
  const style = document.createElement("style");
  style.textContent = `
    @keyframes guidesforge-pulse {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
})();
