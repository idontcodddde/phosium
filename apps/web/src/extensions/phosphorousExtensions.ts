import type { ExtensionConfig, Phosphorus } from "phosphorous";
import { adBlockerExtensionCode } from "./AdBlockerExtension";
import { gamingToolsExtensionCode } from "./GamingToolsExtension";

export interface ExternalPhosiumExtension extends ExtensionConfig {
  enabled: boolean;
}

const manifestFields = new Set([
  "manifest_version",
  "id",
  "name",
  "type",
  "match",
  "hook",
  "position",
  "code",
  "html",
  "css",
]);
const maximumManifestCodeLength = 256 * 1024;

export function parseExternalPhosiumExtension(value: unknown): ExternalPhosiumExtension {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("The manifest must be a JSON object.");
  }

  const manifest = value as Record<string, unknown>;
  const unsupportedField = Object.keys(manifest).find((field) => !manifestFields.has(field));
  if (unsupportedField) {
    throw new TypeError(`The manifest contains an unsupported field: ${unsupportedField}.`);
  }
  if (manifest.manifest_version !== 1) {
    throw new TypeError("The manifest must have manifest_version set to 1.");
  }

  const id = manifest.id;
  if (
    typeof id !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)
    || id.toLowerCase().startsWith("phosium-")
  ) {
    throw new TypeError("Extension id must be 1-64 letters, numbers, dots, underscores or hyphens, and cannot start with phosium-.");
  }

  const name = manifest.name;
  if (typeof name !== "string" || !name.trim() || name.length > 80) {
    throw new TypeError("Extension name must contain 1-80 characters.");
  }

  const type = manifest.type;
  if (type !== "javascript" && type !== "html" && type !== "css") {
    throw new TypeError("Extension type must be javascript, html or css.");
  }

  const rawMatch = manifest.match ?? "*://*/*";
  const matches = Array.isArray(rawMatch) ? rawMatch : [rawMatch];
  if (
    matches.length < 1
    || matches.length > 20
    || matches.some((match) =>
      typeof match !== "string"
      || match.length > 256
      || !/^[a-z\d*:/._?=&%+#-]+$/i.test(match)
    )
  ) {
    throw new TypeError("Match must be a URL pattern or an array of up to 20 URL patterns.");
  }

  const hook = manifest.hook ?? "DOMContentLoaded";
  if (hook !== "beforeLoad" && hook !== "DOMContentLoaded" && hook !== "load") {
    throw new TypeError("Hook must be beforeLoad, DOMContentLoaded or load.");
  }

  const position = manifest.position ?? "head";
  if (position !== "head" && position !== "body") {
    throw new TypeError("Position must be head or body.");
  }

  const content = manifest[type === "javascript" ? "code" : type];
  if (typeof content !== "string" || !content.trim()) {
    throw new TypeError(`A non-empty ${type === "javascript" ? "code" : type} field is required.`);
  }
  if (content.length > maximumManifestCodeLength) {
    throw new TypeError("Extension content must be 256 KB or smaller.");
  }

  const normalizedMatches = matches as string[];
  return {
    id,
    name: name.trim(),
    type,
    match: normalizedMatches.length === 1 ? normalizedMatches[0] : normalizedMatches,
    hook,
    position,
    ...(type === "javascript" ? { code: content } : {}),
    ...(type === "html" ? { html: content } : {}),
    ...(type === "css" ? { css: content } : {}),
    enabled: true,
  };
}

export function parseSavedExternalPhosiumExtensions(value: string | null): ExternalPhosiumExtension[] {
  if (!value) return [];

  const saved: unknown = JSON.parse(value);
  if (!Array.isArray(saved)) {
    throw new TypeError("Saved external extensions must be a JSON array.");
  }

  return saved.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError(`Saved external extension ${index + 1} is invalid.`);
    }

    const { enabled, ...manifest } = item as Record<string, unknown>;
    if (typeof enabled !== "boolean") {
      throw new TypeError(`Saved external extension ${index + 1} has an invalid enabled state.`);
    }
    const extension = { ...parseExternalPhosiumExtension({ ...manifest, manifest_version: 1 }), enabled };
    if (saved.slice(0, index).some((previous) =>
      previous && typeof previous === "object" && !Array.isArray(previous)
      && (previous as Record<string, unknown>).id === extension.id
    )) {
      throw new TypeError(`Saved external extension id "${extension.id}" is duplicated.`);
    }
    return extension;
  });
}

export interface PhosiumExtensionStates {
  enhancementsEnabled: boolean;
  gamingToolsEnabled: boolean;
  adBlockerEnabled: boolean;
  phosphorousEnabled: boolean;
  externalExtensions: ExternalPhosiumExtension[];
}

export function registerPhosiumExtensions(
  phosphorus: Phosphorus,
  externalExtensions: ExternalPhosiumExtension[] = [],
) {
  phosphorus.register({
    id: "phosium-page-enhancements",
    name: "Phosium Page Enhancements",
    type: "css",
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

  for (const extension of externalExtensions) {
    phosphorus.register(extension);
  }
}

export function applyPhosiumExtensionStates(
  phosphorus: Phosphorus,
  {
    enhancementsEnabled,
    gamingToolsEnabled,
    adBlockerEnabled,
    phosphorousEnabled,
    externalExtensions,
  }: PhosiumExtensionStates,
) {
  phosphorus.setExtensionState("phosium-page-enhancements", enhancementsEnabled);
  phosphorus.setExtensionState("phosium-gaming-tools", gamingToolsEnabled);
  phosphorus.setExtensionState("phosium-ad-blocker", adBlockerEnabled);
  for (const extension of externalExtensions) {
    phosphorus.setExtensionState(extension.id, phosphorousEnabled && extension.enabled);
  }
}
