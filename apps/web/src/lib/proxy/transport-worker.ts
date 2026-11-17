import {
  createProxyTransport,
  type ProxyTransport,
  type ProxyTransportType,
} from "@repo/proxy";
import type {
  ConfigureWorkerMessage,
  ConnectWorkerMessage,
  ProxyResponse,
  RawHeaders,
  RequestBody,
  RequestPortResponse,
  RequestWorkerMessage,
  SocketData,
  SocketWorkerEvent,
  TransportWorkerMessage,
} from "./transport-protocol";
import {
  isRequestPortCommand,
  isTransportWorkerMessage,
} from "./transport-protocol";

interface RequestContext {
  remote: URL;
  method: string;
  body: RequestBody;
  headers: RawHeaders;
  signal: AbortSignal;
}

type BeforeRequestHook = (
  context: RequestContext,
) => RequestContext | void | Promise<RequestContext | void>;
type AfterResponseHook = (
  response: ProxyResponse,
  context: RequestContext,
) => ProxyResponse | void | Promise<ProxyResponse | void>;
type SocketHandlers = ReturnType<ProxyTransport["connect"]>;

type TransportWorkerScope = typeof globalThis & {
  proxyTransportHooks?: {
    beforeRequest: BeforeRequestHook[];
    afterResponse: AfterResponseHook[];
  };
};

const workerScope: TransportWorkerScope = globalThis;
const beforeRequest: BeforeRequestHook[] = [];
const afterResponse: AfterResponseHook[] = [];
const activeRequests = new WeakMap<MessagePort, Map<string, AbortController>>();
const activeSockets = new WeakMap<MessagePort, Map<string, SocketHandlers>>();
let transport: ProxyTransport | null = null;
let activeTransportType: ProxyTransportType | null = null;
let controlQueue: Promise<void> = Promise.resolve();

// Expanded User-Agent presets mapping
const userAgentPresets: Record<string, string> = {
  // Desktop Browsers
  "chrome-windows":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "chrome-mac":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "chrome-linux":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

  "firefox-windows":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "firefox-mac":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",

  "safari-mac":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",

  "edge-windows":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.51",

  // Mobile Browsers
  "iphone":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "ipad":
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "android-chrome":
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  "android-firefox":
    "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
};

let activeUserAgent: string | null = null;

// Register User-Agent middleware hook
beforeRequest.push((context) => {
  if (!activeUserAgent) return;
  const headers = new Headers(context.headers);
  headers.set("User-Agent", activeUserAgent);
  context.headers = Array.from(headers.entries());
});

workerScope.proxyTransportHooks = { beforeRequest, afterResponse };

function postSocketMessage(
  port: MessagePort,
  message: SocketWorkerEvent,
): void {
  if (
    message.type === "SOCKET_MESSAGE" && message.data instanceof ArrayBuffer
  ) {
    const copy = message.data.slice(0);
    port.postMessage({ ...message, data: copy }, [copy]);
    return;
  }
  port.postMessage(message);
}

async function postResponse(
  port: MessagePort,
  message: Pick<RequestWorkerMessage, "requestId">,
  response: ProxyResponse,
): Promise<void> {
  const payload: RequestPortResponse = {
    type: "RESULT",
    requestId: message.requestId,
    ok: true,
    res: response,
  };
  const body = response.body;
  if (!(body instanceof ReadableStream) && !(body instanceof ArrayBuffer)) {
    port.postMessage(payload);
    return;
  }

  try {
    port.postMessage(payload, [body]);
  } catch (error) {
    let fallbackBody: ReadableStream<Uint8Array> | ArrayBuffer = body;
    if (body instanceof ReadableStream) {
      try {
        fallbackBody = await new Response(body).arrayBuffer();
      } catch (fallbackError) {
        const failure: RequestPortResponse = {
          type: "RESULT",
          requestId: message.requestId,
          ok: false,
          error: `Unable to transfer the proxy response body: ${
            String(fallbackError)
          }`,
        };
        port.postMessage(failure);
        return;
      }
    } else {
      fallbackBody = body.slice(0);
    }

    try {
      port.postMessage({
        ...payload,
        res: { ...response, body: fallbackBody },
      }, [fallbackBody]);
    } catch {
      try {
        port.postMessage({
          ...payload,
          res: { ...response, body: fallbackBody },
        });
      } catch (finalError) {
        const failure: RequestPortResponse = {
          type: "RESULT",
          requestId: message.requestId,
          ok: false,
          error: `Unable to send the proxy response: ${
            String(finalError ?? error)
          }`,
        };
        port.postMessage(failure);
      }
    }
  }
}

function postError(port: MessagePort, requestId: string, error: unknown): void {
  const message: RequestPortResponse = {
    type: "RESULT",
    requestId,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
  port.postMessage(message);
}

function getTransport(): ProxyTransport {
  if (!transport) throw new Error("Proxy transport has not been initialized.");
  return transport;
}

async function runRequest(
  port: MessagePort,
  request: RequestWorkerMessage,
): Promise<void> {
  const controller = new AbortController();
  const requestMap = activeRequests.get(port) ??
    new Map<string, AbortController>();
  activeRequests.set(port, requestMap);
  requestMap.set(request.requestId, controller);

  const listener = (event: MessageEvent<unknown>) => {
    if (!isRequestPortCommand(event.data)) return;
    if (
      event.data.type === "ABORT" && event.data.requestId === request.requestId
    ) {
      controller.abort();
    }
  };
  port.addEventListener("message", listener);

  try {
    let context: RequestContext = {
      remote: new URL(request.remote),
      method: request.method,
      body: request.body ?? null,
      headers: request.headers,
      signal: controller.signal,
    };
    for (const hook of beforeRequest) {
      context = (await hook(context)) ?? context;
    }

    let response = await getTransport().request(
      context.remote,
      context.method,
      context.body,
      context.headers,
      context.signal,
    );
    for (const hook of afterResponse) {
      response = (await hook(response, context)) ?? response;
    }
    await postResponse(port, request, response);
  } catch (error) {
    if (!controller.signal.aborted) postError(port, request.requestId, error);
  } finally {
    port.removeEventListener("message", listener);
    requestMap.delete(request.requestId);
    port.close();
  }
}

function connectSocket(port: MessagePort, request: ConnectWorkerMessage): void {
  const connectionId = "direct";
  const socketMap = activeSockets.get(port) ??
    new Map<string, SocketHandlers>();
  activeSockets.set(port, socketMap);

  try {
    const [send, close] = getTransport().connect(
      new URL(request.url),
      request.protocols,
      request.requestHeaders,
      (protocol, extensions) =>
        postSocketMessage(port, {
          type: "SOCKET_OPEN",
          connectionId,
          protocol,
          extensions,
        }),
      (data: SocketData) =>
        postSocketMessage(port, {
          type: "SOCKET_MESSAGE",
          connectionId,
          data,
        }),
      (code, reason) => {
        postSocketMessage(port, {
          type: "SOCKET_CLOSE",
          connectionId,
          code,
          reason,
        });
        socketMap.delete(connectionId);
        port.close();
      },
      (error) =>
        postSocketMessage(port, {
          type: "SOCKET_ERROR",
          connectionId,
          error,
        }),
    );
    socketMap.set(connectionId, [send, close]);

    const listener = (event: MessageEvent<unknown>) => {
      if (
        !isRequestPortCommand(event.data) ||
        event.data.type === "ABORT" ||
        event.data.connectionId !== connectionId
      ) return;
      const socket = socketMap.get(connectionId);
      if (!socket) return;
      if (event.data.type === "SEND") socket[0](event.data.data);
      if (event.data.type === "CLOSE") {
        socket[1](event.data.code, event.data.reason);
        socketMap.delete(connectionId);
        port.removeEventListener("message", listener);
      }
    };
    port.addEventListener("message", listener);
    port.start();
  } catch (error) {
    postSocketMessage(port, {
      type: "SOCKET_ERROR",
      connectionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function configure(message: ConfigureWorkerMessage): Promise<void> {
  if (message.type === "SET_USER_AGENT") {
    activeUserAgent = message.userAgent && userAgentPresets[message.userAgent]
      ? userAgentPresets[message.userAgent]
      : null;
    workerScope.postMessage({ type: "READY", requestId: message.requestId });
    return;
  }

  if (!message.transportType || !message.wispUrl) return;

  const nextTransport = createProxyTransport({
    transport: message.transportType,
    wispUrl: message.wispUrl,
  });
  await nextTransport.init();
  transport = nextTransport;
  if (message.type === "SET_TRANSPORT") {
    if (activeTransportType && activeTransportType !== message.transportType) {
      console.info(
        `[Proxy worker] Transport switched from ${activeTransportType} to ${message.transportType}.`,
      );
    } else {
      console.info(
        `[Proxy worker] Transport reconfigured: ${message.transportType}.`,
      );
    }
  }
  activeTransportType = message.transportType;
  workerScope.postMessage({ type: "READY", requestId: message.requestId });
}

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isTransportWorkerMessage(event.data)) return;
  const message: TransportWorkerMessage = event.data;

  switch (message.type) {
    case "INIT":
    case "SET_TRANSPORT":
    case "SET_USER_AGENT":
      controlQueue = controlQueue
        .then(() => configure(message))
        .catch((error: unknown) => {
          workerScope.postMessage({
            type: "ERROR",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return;
    case "REQUEST":
      void runRequest(message.port, message);
      return;
    case "CONNECT":
      connectSocket(message.port, message);
      return;
  }
});
