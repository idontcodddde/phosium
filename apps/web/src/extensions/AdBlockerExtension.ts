function installPhosiumAdBlocker(): void {
  const globalWindow = window as typeof window & {
    __phosiumAdBlockerCleanup?: () => void;
  };
  globalWindow.__phosiumAdBlockerCleanup?.();

  const blockedDomains = [
    "doubleclick.net",
    "googlesyndication.com",
    "googletagservices.com",
    "adservice.google.com",
    "adnxs.com",
    "adsrvr.org",
    "taboola.com",
    "outbrain.com",
    "amazon-adsystem.com",
    "criteo.com",
    "pubmatic.com",
    "rubiconproject.com",
    "openx.net",
    "sharethrough.com",
    "serving-sys.com",
    "scorecardresearch.com",
  ];
  const adSelectors = [
    "ins.adsbygoogle",
    "iframe[src*='doubleclick.net']",
    "iframe[src*='googlesyndication.com']",
    "iframe[src*='amazon-adsystem.com']",
    "[id^='google_ads_']",
    "[id*='ad-container']",
    "[class~='ad-container']",
    "[data-ad]",
    "[data-ad-slot]",
  ].join(",");
  const isBlockedUrl = (value: string | URL | null | undefined): boolean => {
    if (value == null) return false;
    try {
      const hostname = new URL(String(value), location.href).hostname.toLowerCase();
      return blockedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  };
  const hideAds = (root: ParentNode): void => {
    root.querySelectorAll(adSelectors).forEach((element) => element.remove());
  };

  const style = document.createElement("style");
  style.id = "phosium-ad-blocker-style";
  style.textContent = `${adSelectors} { display:none !important; visibility:hidden !important; }`;
  (document.head ?? document.documentElement).appendChild(style);
  hideAds(document);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(adSelectors)) {
          node.remove();
        } else {
          hideAds(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const requestUrl = input instanceof Request ? input.url : input;
    if (isBlockedUrl(requestUrl)) {
      return Promise.reject(new DOMException("Blocked by Phosium Ad Blocker.", "AbortError"));
    }
    return originalFetch.call(this, input, init);
  };

  const originalBeacon = navigator.sendBeacon;
  navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
    if (isBlockedUrl(url)) return false;
    return originalBeacon.call(this, url, data);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const blockedRequests = new WeakSet<XMLHttpRequest>();
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    blockedRequests.delete(this);
    if (isBlockedUrl(url)) blockedRequests.add(this);
    return originalXhrOpen.call(this, method, url, async ?? true, username, password);
  };
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    if (blockedRequests.has(this)) {
      queueMicrotask(() => {
        this.dispatchEvent(new ProgressEvent("error"));
        this.dispatchEvent(new ProgressEvent("loadend"));
      });
      return;
    }
    return originalXhrSend.call(this, body);
  };

  globalWindow.__phosiumAdBlockerCleanup = () => {
    observer.disconnect();
    style.remove();
    window.fetch = originalFetch;
    navigator.sendBeacon = originalBeacon;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    XMLHttpRequest.prototype.send = originalXhrSend;
    delete globalWindow.__phosiumAdBlockerCleanup;
  };
}

export const adBlockerExtensionCode = installPhosiumAdBlocker.toString();
