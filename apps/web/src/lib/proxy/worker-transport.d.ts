import type { ProxyTransport, ProxyTransportType } from "@repo/proxy";

export declare class WorkerTransport implements ProxyTransport {
  constructor(transportType?: ProxyTransportType, wispUrl?: string);
  readonly ready: boolean;
  init(): Promise<void>;
  setTransport(transportType: ProxyTransportType, wispUrl: string): Promise<void>;
  request(
    remote: URL,
    method: string,
    body: BodyInit | null,
    headers: [string, string][],
    signal: AbortSignal | undefined,
  ): Promise<import("@mercuryworkshop/proxy-transports").TransferrableResponse>;
  connect(
    url: URL,
    protocols: string[],
    requestHeaders: [string, string][],
    onopen: (protocol: string, extensions: string) => void,
    onmessage: (data: Blob | ArrayBuffer | string) => void,
    onclose: (code: number, reason: string) => void,
    onerror: (error: string) => void,
  ): [(data: Blob | ArrayBuffer | string) => void, (code: number, reason: string) => void];
}
