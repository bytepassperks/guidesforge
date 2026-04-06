// GuidesForge Chrome Extension - Popup Script

const idleState = document.getElementById("idle-state");
const recordingState = document.getElementById("recording-state");
const doneState = document.getElementById("done-state");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const cancelBtn = document.getElementById("cancel-btn");
const newBtn = document.getElementById("new-btn");
const titleInput = document.getElementById("guide-title");
const stepsCount = document.getElementById("steps-count");
const authLink = document.getElementById("auth-link");

function showState(state) {
  idleState.classList.toggle("hidden", state !== "idle");
  recordingState.classList.toggle("hidden", state !== "recording");
  doneState.classList.toggle("hidden", state !== "done");
}

// Check current state on popup open
chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
  if (response?.isRecording) {
    showState("recording");
    stepsCount.textContent = response.stepsCount || "0";
  } else {
    showState("idle");
  }
});

// Check auth status
chrome.storage.local.get("authToken", (result) => {
  if (result.authToken) {
    authLink.textContent = "Connected to GuidesForge";
    authLink.style.color = "#22c55e";
  }
});

// Start recording
startBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim() || "Untitled Guide";

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Inject content script if not already injected
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  }

  chrome.runtime.sendMessage(
    { type: "START_RECORDING", title, tabId: tab.id },
    () => {
      showState("recording");
      stepsCount.textContent = "0";

      // Start rrweb in content script
      chrome.tabs.sendMessage(tab.id, { type: "START_RRWEB" });
    }
  );
});

// Stop recording
stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (response) => {
    if (response?.success) {
      showState("done");
    } else {
      showState("done");
      // Still show done but with note about local save
    }
  });
});

// Cancel recording
cancelBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CANCEL_RECORDING" }, () => {
    showState("idle");
  });
});

// New recording
newBtn.addEventListener("click", () => {
  showState("idle");
  titleInput.value = "";
});

// Poll for step count updates while recording
setInterval(() => {
  if (!recordingState.classList.contains("hidden")) {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response?.stepsCount !== undefined) {
        stepsCount.textContent = String(response.stepsCount);
      }
    });
  }
}, 1000);
