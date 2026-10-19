import type { BareHeaders, BareTransport } from "@mercuryworkshop/bare-mux";
import type EpoxyTransport from "@mercuryworkshop/epoxy-transport";

type CompatibleTransport = Pick<
  EpoxyTransport,
  "ready" | "init" | "request" | "connect"
>;

function toHeaderPairs(headers: BareHeaders): [string, string][] {
  return Object.entries(headers).flatMap(([name, value]) =>
    Array.isArray(value)
      ? value.map((entry) => [name, entry] as [string, string])
      : [[name, value] as [string, string]],
  );
}

export function createBareMuxCompatibleTransport(
  transport: CompatibleTransport,
): BareTransport {
  return {
    get ready() {
      return transport.ready;
    },
    init: () => transport.init(),
    meta: () => ({}),
    async request(remote, method, body, headers, signal) {
      const response = await transport.request(
        remote,
        method,
        body,
        toHeaderPairs(headers),
        signal,
      );
      return { ...response, headers: Object.fromEntries(response.headers) };
    },
    connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
      return transport.connect(
        url,
        protocols,
        toHeaderPairs(requestHeaders),
        (protocol) => onopen(protocol),
        onmessage,
        onclose,
        onerror,
      );
    },
  };
}
