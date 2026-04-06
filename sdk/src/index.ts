/**
 * GuidesForge SDK
 * Provides in-app interactive tours (Driver.js), help widget, and semantic search
 */

import { driver, type DriveStep, type Config as DriverConfig } from "driver.js";

// Types
interface GuidesForgeConfig {
  apiKey: string;
  apiUrl?: string;
  theme?: "dark" | "light";
  position?: "bottom-right" | "bottom-left";
  primaryColor?: string;
  zIndex?: number;
}

interface Guide {
  id: string;
  title: string;
  description: string | null;
  steps: GuideStep[];
  video_url: string | null;
}

interface GuideStep {
  id: string;
  step_number: number;
  description: string;
  narration_script: string | null;
  dom_selector: string | null;
  screenshot_url: string | null;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  score: number;
}

// SDK Class
class GuidesForgeSDK {
  private config: GuidesForgeConfig;
  private sessionId: string | null = null;
  private widget: HTMLElement | null = null;
  private isOpen = false;
  private guides: Guide[] = [];

  constructor(config: GuidesForgeConfig) {
    this.config = {
      apiUrl: "https://guidesforge.org/api",
      theme: "dark",
      position: "bottom-right",
      primaryColor: "#6366F1",
      zIndex: 99999,
      ...config,
    };

    this.init();
  }

  private async init() {
    // Initialize session
    try {
      const res = await this.apiCall("/sdk/init", "POST", {
        sdk_key: this.config.apiKey,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
      });
      this.sessionId = res.session_id;
    } catch (e) {
      console.warn("[GuidesForge] Failed to initialize:", e);
    }

    // Create widget
    this.createWidget();

    // Track page views
    this.trackEvent("page_view", { url: window.location.href });
  }

  // API helper
  private async apiCall(path: string, method: string = "GET", body?: unknown) {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  // Track events
  async trackEvent(event: string, data?: Record<string, unknown>) {
    try {
      await this.apiCall("/sdk/event", "POST", {
        sdk_key: this.config.apiKey,
        session_id: this.sessionId,
        event,
        data: { ...data, url: window.location.href },
      });
    } catch {
      // Silent fail for analytics
    }
  }

  // Search guides
  async search(query: string): Promise<SearchResult[]> {
    try {
      const res = await this.apiCall("/sdk/search", "POST", {
        sdk_key: this.config.apiKey,
        query,
        limit: 10,
      });
      return res.results || [];
    } catch {
      return [];
    }
  }

  // Start an interactive tour
  startTour(guide: Guide) {
    const steps: DriveStep[] = guide.steps
      .filter((s) => s.dom_selector)
      .map((step) => ({
        element: step.dom_selector!,
        popover: {
          title: `Step ${step.step_number}`,
          description: step.narration_script || step.description,
        },
      }));

    if (steps.length === 0) {
      console.warn("[GuidesForge] No interactive steps found for this guide");
      return;
    }

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0, 0, 0, 0.6)",
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "guidesforge-popover",
      steps,
      onDestroyStarted: () => {
        this.trackEvent("tour_complete", { guide_id: guide.id });
        driverObj.destroy();
      },
    });

    this.trackEvent("tour_start", { guide_id: guide.id });
    driverObj.drive();
  }

  // Create the help widget
  private createWidget() {
    // Inject styles
    const style = document.createElement("style");
    style.textContent = this.getWidgetStyles();
    document.head.appendChild(style);

    // Create widget container
    this.widget = document.createElement("div");
    this.widget.id = "guidesforge-widget";
    this.widget.className = `gf-widget gf-${this.config.position} gf-${this.config.theme}`;
    this.widget.innerHTML = this.getWidgetHTML();
    document.body.appendChild(this.widget);

    // Event listeners
    const trigger = this.widget.querySelector(".gf-trigger");
    trigger?.addEventListener("click", () => this.toggle());

    const searchInput = this.widget.querySelector(
      ".gf-search-input"
    ) as HTMLInputElement;
    let searchTimeout: ReturnType<typeof setTimeout>;
    searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.handleSearch(searchInput.value);
      }, 300);
    });

    const closeBtn = this.widget.querySelector(".gf-close");
    closeBtn?.addEventListener("click", () => this.close());
  }

  private toggle() {
    this.isOpen ? this.close() : this.open();
  }

  private open() {
    this.isOpen = true;
    const panel = this.widget?.querySelector(".gf-panel");
    panel?.classList.add("gf-panel-open");
    this.trackEvent("widget_open");
  }

  private close() {
    this.isOpen = false;
    const panel = this.widget?.querySelector(".gf-panel");
    panel?.classList.remove("gf-panel-open");
  }

  private async handleSearch(query: string) {
    const resultsEl = this.widget?.querySelector(".gf-results");
    if (!resultsEl) return;

    if (query.length < 2) {
      resultsEl.innerHTML = '<div class="gf-empty">Type to search guides...</div>';
      return;
    }

    resultsEl.innerHTML = '<div class="gf-loading">Searching...</div>';

    const results = await this.search(query);
    if (results.length === 0) {
      resultsEl.innerHTML =
        '<div class="gf-empty">No guides found. Try different keywords.</div>';
      return;
    }

    resultsEl.innerHTML = results
      .map(
        (r) => `
        <div class="gf-result" data-guide-id="${r.id}">
          <div class="gf-result-title">${r.title}</div>
          <div class="gf-result-desc">${r.description}</div>
        </div>
      `
      )
      .join("");

    // Add click handlers
    resultsEl.querySelectorAll(".gf-result").forEach((el) => {
      el.addEventListener("click", () => {
        const guideId = (el as HTMLElement).dataset.guideId;
        if (guideId) this.openGuide(guideId);
      });
    });
  }

  private async openGuide(guideId: string) {
    try {
      const guide = await this.apiCall(
        `/sdk/guides/${guideId}?sdk_key=${this.config.apiKey}`
      );
      this.close();

      // If guide has DOM selectors, start interactive tour
      if (guide.steps?.some((s: GuideStep) => s.dom_selector)) {
        this.startTour(guide);
      } else {
        // Open in new tab
        window.open(
          `${this.config.apiUrl?.replace("/api", "")}/embed/${guideId}`,
          "_blank"
        );
      }
    } catch {
      console.warn("[GuidesForge] Failed to load guide");
    }
  }

  private getWidgetHTML(): string {
    return `
      <button class="gf-trigger" aria-label="Help">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </button>
      <div class="gf-panel">
        <div class="gf-panel-header">
          <span class="gf-panel-title">Help Center</span>
          <button class="gf-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="gf-search">
          <svg class="gf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="gf-search-input" placeholder="Search for help..." />
        </div>
        <div class="gf-results">
          <div class="gf-empty">Type to search guides...</div>
        </div>
        <div class="gf-footer">
          Powered by <a href="https://guidesforge.org" target="_blank">GuidesForge</a>
        </div>
      </div>
    `;
  }

  private getWidgetStyles(): string {
    const color = this.config.primaryColor || "#6366F1";
    const z = this.config.zIndex || 99999;
    const pos = this.config.position || "bottom-right";
    const posX = pos.includes("right") ? "right: 20px" : "left: 20px";

    return `
      #guidesforge-widget { position: fixed; bottom: 20px; ${posX}; z-index: ${z}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .gf-trigger { width: 52px; height: 52px; border-radius: 50%; background: ${color}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.3); transition: transform 0.2s, box-shadow 0.2s; }
      .gf-trigger:hover { transform: scale(1.05); box-shadow: 0 4px 25px rgba(99,102,241,0.4); }
      .gf-panel { position: absolute; bottom: 64px; ${pos.includes("right") ? "right" : "left"}: 0; width: 360px; max-height: 480px; border-radius: 16px; overflow: hidden; opacity: 0; transform: translateY(10px) scale(0.95); pointer-events: none; transition: all 0.2s ease; }
      .gf-panel-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
      .gf-dark .gf-panel { background: #1A1B23; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 60px rgba(0,0,0,0.5); color: #fff; }
      .gf-light .gf-panel { background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 20px 60px rgba(0,0,0,0.15); color: #111; }
      .gf-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .gf-light .gf-panel-header { border-color: #e5e7eb; }
      .gf-panel-title { font-weight: 600; font-size: 15px; }
      .gf-close { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
      .gf-dark .gf-close { color: #6b7280; }
      .gf-light .gf-close { color: #9ca3af; }
      .gf-close:hover { background: rgba(255,255,255,0.05); }
      .gf-search { position: relative; padding: 12px 16px; }
      .gf-search-icon { position: absolute; left: 28px; top: 50%; transform: translateY(-50%); }
      .gf-dark .gf-search-icon { color: #6b7280; }
      .gf-light .gf-search-icon { color: #9ca3af; }
      .gf-search-input { width: 100%; padding: 10px 12px 10px 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); font-size: 13px; outline: none; }
      .gf-dark .gf-search-input { background: rgba(255,255,255,0.05); color: #fff; }
      .gf-light .gf-search-input { background: #f9fafb; border-color: #e5e7eb; color: #111; }
      .gf-search-input:focus { border-color: ${color}; }
      .gf-results { max-height: 300px; overflow-y: auto; padding: 8px 16px; }
      .gf-result { padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background 0.15s; margin-bottom: 4px; }
      .gf-dark .gf-result:hover { background: rgba(255,255,255,0.05); }
      .gf-light .gf-result:hover { background: #f3f4f6; }
      .gf-result-title { font-weight: 500; font-size: 13px; margin-bottom: 2px; }
      .gf-result-desc { font-size: 12px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .gf-empty, .gf-loading { text-align: center; padding: 20px; font-size: 13px; opacity: 0.5; }
      .gf-footer { padding: 10px 16px; text-align: center; font-size: 11px; opacity: 0.4; border-top: 1px solid rgba(255,255,255,0.05); }
      .gf-footer a { color: ${color}; text-decoration: none; }
      .gf-footer a:hover { text-decoration: underline; }
      .gf-light .gf-footer { border-color: #e5e7eb; }
      .guidesforge-popover { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    `;
  }

  // Public API
  destroy() {
    this.widget?.remove();
    this.widget = null;
  }
}

// Auto-initialize from script tag
function autoInit() {
  const scripts = document.querySelectorAll(
    'script[data-key][src*="guidesforge"]'
  );
  scripts.forEach((script) => {
    const key = script.getAttribute("data-key");
    if (key) {
      (window as unknown as Record<string, unknown>).__guidesforge = new GuidesForgeSDK({ apiKey: key });
    }
  });
}

// Run auto-init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInit);
} else {
  autoInit();
}

// Export for module usage
export { GuidesForgeSDK };
export default GuidesForgeSDK;
