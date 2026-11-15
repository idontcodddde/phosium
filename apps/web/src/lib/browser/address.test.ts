import { describe, expect, it } from "vitest";
import { decodeScramjetAddress, resolveAddress } from "./address";

describe("resolveAddress", () => {
  it("normalizes explicit web URLs and host names", () => {
    expect(resolveAddress(" https://example.com/path ", "google"))
      .toBe("https://example.com/path");
    expect(resolveAddress("example.com", "google")).toBe("https://example.com/");
  });

  it("sends non-host input to the selected search engine", () => {
    expect(resolveAddress("hello world", "duckduckgo"))
      .toBe("https://duckduckgo.com/?q=hello%20world");
    expect(resolveAddress("hello world", "yahoo"))
      .toBe("https://search.yahoo.com/search?q=hello%20world");
  });

  it("accepts bare IPv6 addresses", () => {
    expect(resolveAddress("2001:db8::1", "google")).toBe("https://[2001:db8::1]/");
  });

  it("rejects empty input and non-web protocols", () => {
    expect(() => resolveAddress("   ", "google"))
      .toThrow("Enter a web address or search.");
    expect(() => resolveAddress("ftp://example.com", "google"))
      .toThrow("Only HTTP and HTTPS addresses are supported.");
  });
});

describe("decodeScramjetAddress", () => {
  it("unwraps a service route while preserving the target query and fragment", () => {
    expect(decodeScramjetAddress(
      "https://app.example/service/https://target.example/path?x=1#section",
      "https://app.example/",
      "/service/",
      (value) => value,
    )).toBe("https://target.example/path?x=1#section");
  });

  it("decodes nested route data and stops when the route repeats", () => {
    expect(decodeScramjetAddress(
      "https://app.example/service/encoded-target",
      "https://app.example/",
      "/service/",
      (value) => value === "encoded-target" ? "https://target.example/" : value,
    )).toBe("https://target.example/");
  });
});
