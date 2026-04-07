// GuidesForge Chrome Extension - Background Service Worker
// Manages recording state, receives events from content scripts,
// and uploads completed recordings to the GuidesForge API.

const API_BASE = "https://guidesforge-api.onrender.com/api";

// Recording state
let isRecording = false;
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
        stepsCount: currentRecording.steps.length,
        title: currentRecording.title,
      });
      return true;

    case "START_RECORDING":
      startRecording(message.title, message.tabId || sender.tab?.id);
      sendResponse({ success: true });
      return true;

    case "STOP_RECORDING":
      stopRecording().then((result) => sendResponse(result));
      return true;

    case "CANCEL_RECORDING":
      cancelRecording();
      sendResponse({ success: true });
      return true;

    case "RRWEB_EVENT":
      if (isRecording) {
        currentRecording.events.push(message.event);
      }
      sendResponse({ received: true });
      return true;

    case "STEP_CAPTURED":
      if (isRecording) {
        currentRecording.steps.push({
          step_number: currentRecording.steps.length + 1,
          screenshot_data_url: message.screenshot,
          description: message.description || "",
          dom_selector: message.selector || null,
          page_url: message.url || "",
          page_title: message.pageTitle || "",
          element_text: message.elementText || "",
          element_tag: message.elementTag || "",
          timestamp: Date.now(),
        });
        // Update badge
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

function startRecording(title, tabId) {
  isRecording = true;
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

  // Inject recording into active tab
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: "START_RRWEB" });
  }
}

async function stopRecording() {
  if (!isRecording) return { success: false, error: "Not recording" };

  isRecording = false;
  chrome.action.setBadgeText({ text: "" });

  // Stop rrweb in content script
  if (currentRecording.tabId) {
    try {
      chrome.tabs.sendMessage(currentRecording.tabId, { type: "STOP_RRWEB" });
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
      [`pending_${recording.id}`]: recording,
    });
    return {
      success: false,
      error: "Upload failed. Recording saved locally.",
      localId: recording.id,
    };
  }
}

function cancelRecording() {
  isRecording = false;
  currentRecording = {
    id: null,
    title: "",
    steps: [],
    events: [],
    startTime: null,
    tabId: null,
  };
  chrome.action.setBadgeText({ text: "" });
}

async function uploadRecording(recording) {
  const { authToken } = await chrome.storage.local.get("authToken");
  if (!authToken) throw new Error("Not authenticated");

  // First, create the guide
  const guideRes = await fetch(`${API_BASE}/pipeline/upload-recording`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      title: recording.title,
      steps: recording.steps.map((step) => ({
        step_number: step.step_number,
        screenshot_data_url: step.screenshot_data_url,
        description: step.description,
        dom_selector: step.dom_selector,
        page_url: step.page_url,
        page_title: step.page_title,
        element_text: step.element_text,
        element_tag: step.element_tag,
      })),
      rrweb_events: recording.events,
      duration_ms: Date.now() - recording.startTime,
    }),
  });

  if (!guideRes.ok) {
    throw new Error(`Upload failed: ${guideRes.status}`);
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
