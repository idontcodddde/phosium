import { describe, expect, it } from "vitest";
import {
  parseExternalPhosiumExtension,
  parseSavedExternalPhosiumExtensions,
} from "./phosphorousExtensions";

describe("external Phosium extensions", () => {
  it("normalizes a valid JavaScript extension manifest", () => {
    expect(parseExternalPhosiumExtension({
      manifest_version: 1,
      id: "my-extension",
      name: "  My Extension  ",
      type: "javascript",
      code: "window.example = true;",
    })).toEqual({
      id: "my-extension",
      name: "My Extension",
      type: "javascript",
      match: "*://*/*",
      hook: "DOMContentLoaded",
      position: "head",
      code: "window.example = true;",
      enabled: true,
    });
  });

  it("rejects unsupported fields, reserved IDs, and missing content", () => {
    expect(() => parseExternalPhosiumExtension({
      manifest_version: 1,
      id: "my-extension",
      name: "My Extension",
      type: "javascript",
      code: "void 0;",
      permissions: ["tabs"],
    })).toThrow("The manifest contains an unsupported field: permissions.");

    expect(() => parseExternalPhosiumExtension({
      manifest_version: 1,
      id: "phosium-custom",
      name: "Reserved",
      type: "css",
      css: "body { color: red; }",
    })).toThrow("Extension id must be");

    expect(() => parseExternalPhosiumExtension({
      manifest_version: 1,
      id: "empty-code",
      name: "Empty",
      type: "javascript",
      code: " ",
    })).toThrow("A non-empty code field is required.");
  });

  it("validates saved enabled states and duplicate IDs", () => {
    const manifest = {
      id: "saved-extension",
      name: "Saved Extension",
      type: "css",
      css: "body { color: red; }",
    };

    expect(parseSavedExternalPhosiumExtensions(JSON.stringify([
      { ...manifest, enabled: false },
    ]))).toMatchObject([{ id: "saved-extension", enabled: false }]);

    expect(() => parseSavedExternalPhosiumExtensions(JSON.stringify([
      { ...manifest, enabled: true },
      { ...manifest, enabled: false },
    ]))).toThrow('Saved external extension id "saved-extension" is duplicated.');
    expect(() => parseSavedExternalPhosiumExtensions(JSON.stringify([
      { ...manifest, enabled: "yes" },
    ]))).toThrow("Saved external extension 1 has an invalid enabled state.");
  });
});
