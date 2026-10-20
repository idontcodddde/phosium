import type { Phosphorus } from "phosphorous";
import { adBlockerExtensionCode } from "./AdBlockerExtension";
import { gamingToolsExtensionCode } from "./GamingToolsExtension";

export interface PhosiumExtensionStates {
  enhancementsEnabled: boolean;
  gamingToolsEnabled: boolean;
  adBlockerEnabled: boolean;
}

export function registerPhosiumExtensions(phosphorus: Phosphorus) {
  phosphorus.register({
    id: "phosium-page-enhancements",
    name: "Phosium Page Enhancements",
    match: "*://*/*",
    hook: "DOMContentLoaded",
    position: "head",
    css: "html { scrollbar-color: #8b8cf7 transparent; }",
  });
  phosphorus.register({
    id: "phosium-gaming-tools",
    name: "Phosium Gaming Tools",
    type: "javascript",
    match: "*://*/*",
    hook: "DOMContentLoaded",
    position: "body",
    code: `(${gamingToolsExtensionCode})();`,
  });
  phosphorus.register({
    id: "phosium-ad-blocker",
    name: "Phosium Ad Blocker",
    type: "javascript",
    match: "*://*/*",
    hook: "DOMContentLoaded",
    position: "head",
    code: `(${adBlockerExtensionCode})();`,
  });
}

export function applyPhosiumExtensionStates(
  phosphorus: Phosphorus,
  { enhancementsEnabled, gamingToolsEnabled, adBlockerEnabled }: PhosiumExtensionStates,
) {
  phosphorus.setExtensionState("phosium-page-enhancements", enhancementsEnabled);
  phosphorus.setExtensionState("phosium-gaming-tools", gamingToolsEnabled);
  phosphorus.setExtensionState("phosium-ad-blocker", adBlockerEnabled);
}
