import type { ProxyTransport, ProxyTransportType } from "@repo/proxy";

export type RequestBody = Parameters<ProxyTransport["request"]>[2];
export type RawHeaders = Parameters<ProxyTransport["request"]>[3];
export type ProxyResponse = Awaited<ReturnType<ProxyTransport["request"]>>;
export type SocketData = Parameters<ProxyTransport["connect"]>[4] extends
  (data: infer T) => void ? T : never;

export type ConfigureWorkerMessage = {
  type: "INIT" | "SET_TRANSPORT" | "SET_USER_AGENT";
  requestId: string;
  transportType?: ProxyTransportType;
  wispUrl?: string;
  userAgent?: string;
} & ({ type: "INIT" } | { type: "SET_TRANSPORT" } | { type: "SET_USER_AGENT" });

export type RequestWorkerMessage = {
  type: "REQUEST";
  requestId: string;
  remote: string;
  method: string;
  body: RequestBody | undefined;
  headers: RawHeaders;
  port: MessagePort;
};

export type ConnectWorkerMessage = {
  type: "CONNECT";
  url: string;
  protocols: string[];
  requestHeaders: RawHeaders;
  port: MessagePort;
};

export type TransportWorkerMessage =
  | ConfigureWorkerMessage
  | RequestWorkerMessage
  | ConnectWorkerMessage;

export type WorkerControlResponse =
  | { type: "READY"; requestId: string }
  | { type: "ERROR"; requestId: string; error: string };

export type RequestPortCommand =
  | { type: "ABORT"; requestId: string }
  | { type: "SEND"; connectionId: string; data: SocketData }
  | { type: "CLOSE"; connectionId: string; code: number; reason: string };

export type RequestPortResponse =
  | { type: "RESULT"; requestId: string; ok: true; res: ProxyResponse }
  | { type: "RESULT"; requestId: string; ok: false; error: string };

export type SocketWorkerEvent =
  | {
    type: "SOCKET_OPEN";
    connectionId: string;
    protocol: string;
    extensions: string;
  }
  | { type: "SOCKET_MESSAGE"; connectionId: string; data: SocketData }
  | { type: "SOCKET_CLOSE"; connectionId: string; code: number; reason: string }
  | { type: "SOCKET_ERROR"; connectionId: string; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHeaders(value: unknown): value is RawHeaders {
  return Array.isArray(value) &&
    value.every((header) =>
      Array.isArray(header) &&
      header.length === 2 &&
      typeof header[0] === "string" &&
      typeof header[1] === "string"
    );
}

function isRequestBody(value: unknown): value is RequestBody {
  return value === null ||
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ReadableStream;
}

function isResponseBody(value: unknown): value is ProxyResponse["body"] {
  return typeof value === "string" ||
    value instanceof ArrayBuffer ||
    value instanceof Blob ||
    value instanceof ReadableStream;
}

function isSocketData(value: unknown): value is SocketData {
  return typeof value === "string" ||
    value instanceof ArrayBuffer ||
    value instanceof Blob;
}

function isTransportType(value: unknown): value is ProxyTransportType {
  return value === "epoxy" || value === "libcurl";
}

export function isTransportWorkerMessage(
  value: unknown,
): value is TransportWorkerMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  if (value.type === "INIT" || value.type === "SET_TRANSPORT") {
    return typeof value.requestId === "string" &&
      isTransportType(value.transportType as unknown) &&
      typeof value.wispUrl === "string";
  }
  if (value.type === "SET_USER_AGENT") {
    return typeof value.requestId === "string" &&
      (typeof value.userAgent === "string" || value.userAgent === undefined);
  }
  if (value.type === "REQUEST") {
    return typeof value.requestId === "string" &&
      typeof value.remote === "string" &&
      typeof value.method === "string" &&
      (value.body === undefined || isRequestBody(value.body)) &&
      isHeaders(value.headers) &&
      value.port instanceof MessagePort;
  }
  if (value.type === "CONNECT") {
    return typeof value.url === "string" &&
      Array.isArray(value.protocols) &&
      value.protocols.every((protocol) => typeof protocol === "string") &&
      isHeaders(value.requestHeaders) &&
      value.port instanceof MessagePort;
  }
  return false;
}

export function isWorkerControlResponse(
  value: unknown,
): value is WorkerControlResponse {
  if (!isRecord(value) || typeof value.requestId !== "string") return false;
  return value.type === "READY" ||
    (value.type === "ERROR" && typeof value.error === "string");
}

export function isRequestPortCommand(
  value: unknown,
): value is RequestPortCommand {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "ABORT") return typeof value.requestId === "string";
  if (value.type === "SEND") {
    return typeof value.connectionId === "string" && isRequestBody(value.data);
  }
  return value.type === "CLOSE" &&
    typeof value.connectionId === "string" &&
    typeof value.code === "number" &&
    typeof value.reason === "string";
}

export function isRequestPortResponse(
  value: unknown,
): value is RequestPortResponse {
  if (
    !isRecord(value) ||
    value.type !== "RESULT" ||
    typeof value.requestId !== "string" ||
    typeof value.ok !== "boolean"
  ) {
    return false;
  }
  if (!value.ok) return typeof value.error === "string";

  const response = value.res;
  return isRecord(response) &&
    typeof response.status === "number" &&
    typeof response.statusText === "string" &&
    isHeaders(response.headers) &&
    isResponseBody(response.body);
}

export function isSocketWorkerEvent(
  value: unknown,
): value is SocketWorkerEvent {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    typeof value.connectionId !== "string"
  ) {
    return false;
  }
  if (value.type === "SOCKET_OPEN") {
    return typeof value.protocol === "string" &&
      typeof value.extensions === "string";
  }
  if (value.type === "SOCKET_MESSAGE") return isSocketData(value.data);
  if (value.type === "SOCKET_CLOSE") {
    return typeof value.code === "number" && typeof value.reason === "string";
  }
  return value.type === "SOCKET_ERROR" && typeof value.error === "string";
}
