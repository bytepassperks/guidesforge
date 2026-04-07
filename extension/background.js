// GuidesForge Chrome Extension - Background Service Worker
// Manages recording state, receives events from content scripts,
// and uploads completed recordings to the GuidesForge API.

const API_BASE = "https://guidesforge-api.onrender.com/api";

// Recording state
let isRecording = false;
let isPaused = false;
let currentRecording = {
  id: null,
  title: "",
  steps: [],
  events: [],
  startTime: null,
  tabId: null,
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_STATE":
      sendResponse({
        isRecording,
        isPaused,
        stepsCount: currentRecording.steps.length,
        title: currentRecording.title,
        tabId: currentRecording.tabId,
      });
      return true;

    case "START_RECORDING":
      startRecording(message.title, message.tabId || sender.tab?.id).then(function() {
        sendResponse({ success: true });
      });
      return true;

    case "STOP_RECORDING":
      // Respond immediately so the floating widget can show "Uploading..." state
      // The upload happens in the background
      stopRecording().then(function(result) {
        // Notify popup if it's open
        try {
          chrome.runtime.sendMessage({ type: "UPLOAD_COMPLETE", result: result });
        } catch (e) { /* popup might not be open */ }
      });
      sendResponse({ success: true, uploading: true });
      return true;

    case "CANCEL_RECORDING":
      cancelRecording();
      sendResponse({ success: true });
      return true;

    case "TOGGLE_PAUSE":
      isPaused = !!message.isPaused;
      if (isPaused) {
        chrome.action.setBadgeText({ text: "||" });
        chrome.action.setBadgeBackgroundColor({ color: "#F59E0B" });
      } else {
        chrome.action.setBadgeText({ text: String(currentRecording.steps.length) });
        chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      }
      sendResponse({ success: true, isPaused });
      return true;

    case "RRWEB_EVENT":
      if (isRecording && !isPaused) {
        currentRecording.events.push(message.event);
      }
      sendResponse({ received: true });
      return true;

    case "STEP_CAPTURED":
      if (isRecording && !isPaused) {
        const stepNum = message.stepNumber || currentRecording.steps.length + 1;
        currentRecording.steps.push({
          step_number: stepNum,
          screenshot_data_url: message.screenshot || null,
          description: message.description || "",
          dom_selector: message.selector || null,
          page_url: message.url || "",
          page_title: message.pageTitle || "",
          element_text: message.elementText || "",
          element_tag: message.elementTag || "",
          timestamp: Date.now(),
        });
        // Update badge with step count
        chrome.action.setBadgeText({
          text: String(currentRecording.steps.length),
        });
      }
      sendResponse({ stepNumber: currentRecording.steps.length });
      return true;

    case "SET_AUTH_TOKEN":
      chrome.storage.local.set({ authToken: message.token });
      sendResponse({ success: true });
      return true;

    case "CAPTURE_TAB":
      chrome.tabs.captureVisibleTab(null, { format: "png", quality: 80 }, (dataUrl) => {
        sendResponse({ dataUrl: dataUrl || null });
      });
      return true;

    default:
      return false;
  }
});

async function startRecording(title, tabId) {
  isRecording = true;
  isPaused = false;
  currentRecording = {
    id: crypto.randomUUID(),
    title: title || "Untitled Guide",
    steps: [],
    events: [],
    startTime: Date.now(),
    tabId: tabId || null,
  };

  // Set recording indicator
  chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
  chrome.action.setBadgeText({ text: "REC" });

  // Inject content script and start recording on the tab
  if (tabId) {
    // First try to ping the content script to see if it's already loaded
    let contentScriptReady = false;
    try {
      await new Promise(function(resolve, reject) {
        chrome.tabs.sendMessage(tabId, { type: "PING" }, function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            contentScriptReady = true;
            resolve(response);
          }
        });
      });
    } catch (e) {
      console.log("GuidesForge: Content script not found, injecting...");
    }

    // If content script is not loaded, inject it
    if (!contentScriptReady) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        });
        // Wait for content script to initialize
        await new Promise(function(r) { setTimeout(r, 300); });
      } catch (e) {
        console.log("GuidesForge: Could not inject content script:", e.message);
      }
    }

    // Send START_RRWEB to content script (shows countdown + floating widget)
    try {
      await new Promise(function(resolve, reject) {
        chrome.tabs.sendMessage(tabId, { type: "START_RRWEB", withCountdown: true }, function(response) {
          if (chrome.runtime.lastError) {
            console.log("GuidesForge: START_RRWEB failed:", chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log("GuidesForge: START_RRWEB sent successfully:", JSON.stringify(response));
            resolve(response);
          }
        });
      });
    } catch (e) {
      console.log("GuidesForge: Could not send START_RRWEB:", e.message);
    }
  }
}

async function stopRecording() {
  if (!isRecording) return { success: false, error: "Not recording" };

  const tabId = currentRecording.tabId;
  isRecording = false;
  isPaused = false;
  chrome.action.setBadgeText({ text: "" });

  // Stop rrweb and floating widget in content script
  if (tabId) {
    try {
      await new Promise(function(resolve) {
        chrome.tabs.sendMessage(tabId, { type: "STOP_RRWEB" }, function() {
          if (chrome.runtime.lastError) {
            console.log("GuidesForge: STOP_RRWEB error:", chrome.runtime.lastError.message);
          }
          resolve();
        });
      });
    } catch (e) {
      // Tab might be closed
    }
  }

  const recording = { ...currentRecording };
  currentRecording = {
    id: null,
    title: "",
    steps: [],
    events: [],
    startTime: null,
    tabId: null,
  };

  // Upload to GuidesForge API
  try {
    const result = await uploadRecording(recording);
    return { success: true, guideId: result.guide_id };
  } catch (error) {
    // Store locally if upload fails
    await chrome.storage.local.set({
      ["pending_" + recording.id]: recording,
    });
    return {
      success: false,
      error: "Upload failed. Recording saved locally.",
      localId: recording.id,
    };
  }
}

function cancelRecording() {
  const tabId = currentRecording.tabId;
  isRecording = false;
  isPaused = false;
  currentRecording = {
    id: null,
    title: "",
    steps: [],
    events: [],
    startTime: null,
    tabId: null,
  };
  chrome.action.setBadgeText({ text: "" });

  // Tell content script to cancel
  if (tabId) {
    try {
      chrome.tabs.sendMessage(tabId, { type: "CANCEL_RRWEB" });
    } catch (e) {
      // Tab might be closed
    }
  }
}

async function uploadRecording(recording) {
  const { authToken } = await chrome.storage.local.get("authToken");
  if (!authToken) throw new Error("Not authenticated");

  const guideRes = await fetch(API_BASE + "/pipeline/upload-recording", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + authToken,
    },
    body: JSON.stringify({
      title: recording.title,
      steps: recording.steps.map(function(step) {
        return {
          step_number: step.step_number,
          screenshot_data_url: step.screenshot_data_url,
          description: step.description,
          dom_selector: step.dom_selector,
          page_url: step.page_url,
          page_title: step.page_title,
          element_text: step.element_text,
          element_tag: step.element_tag,
        };
      }),
      rrweb_events: recording.events,
      duration_ms: Date.now() - recording.startTime,
    }),
  });

  if (!guideRes.ok) {
    throw new Error("Upload failed: " + guideRes.status);
  }

  return await guideRes.json();
}

// Retry pending uploads periodically
chrome.alarms.create("retryUploads", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "retryUploads") {
    const storage = await chrome.storage.local.get(null);
    for (const [key, value] of Object.entries(storage)) {
      if (key.startsWith("pending_")) {
        try {
          await uploadRecording(value);
          await chrome.storage.local.remove(key);
        } catch {
          // Will retry next time
        }
      }
    }
  }
});
