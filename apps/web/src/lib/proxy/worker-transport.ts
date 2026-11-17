import type { ProxyTransport, ProxyTransportType } from "@repo/proxy";
import type {
  ConfigureWorkerMessage,
  ConnectWorkerMessage,
  ProxyResponse,
  RawHeaders,
  RequestBody,
  RequestPortCommand,
  RequestPortResponse,
  RequestWorkerMessage,
  SocketData,
  SocketWorkerEvent,
  WorkerControlResponse,
} from "./transport-protocol";
import {
  isRequestPortResponse,
  isSocketWorkerEvent,
  isWorkerControlResponse,
} from "./transport-protocol";

type PendingControl = {
  resolve: () => void;
  reject: (error: Error) => void;
};

type SocketCallbacks = Parameters<ProxyTransport["connect"]>;

async function postRequest(
  worker: Worker,
  port: MessagePort,
  message: Omit<RequestWorkerMessage, "port">,
): Promise<void> {
  const transfer: Transferable[] = [port];
  if (
    message.body instanceof ReadableStream ||
    message.body instanceof ArrayBuffer
  ) {
    transfer.push(message.body);
  }

  try {
    worker.postMessage({ ...message, port }, transfer);
  } catch (error) {
    if (!(message.body instanceof ReadableStream)) throw error;
    const fallbackBody = await new Response(message.body).arrayBuffer();
    worker.postMessage({ ...message, body: fallbackBody, port }, [
      port,
      fallbackBody,
    ]);
  }
}

export class WorkerTransport implements ProxyTransport {
  private worker: Worker | null = null;
  private isReady = false;
  private controlQueue: Promise<void> = Promise.resolve();
  private controlRequestId = 0;
  private requestId = 0;
  private readonly pendingControls = new Map<string, PendingControl>();
  private readonly activePorts = new Set<MessagePort>();

  constructor(
    transportType: ProxyTransportType = "epoxy",
    wispUrl = "",
  ) {
    this.transportType = transportType;
    this.wispUrl = wispUrl;
    this.userAgent = localStorage.getItem("phosium_user_agent_profile") ||
      "default";

    if (typeof window !== "undefined") {
      window.addEventListener("phosium:user-agent-updated", () => {
        this.userAgent = localStorage.getItem("phosium_user_agent_profile") ||
          "default";
        void this.syncUserAgent();
      });
    }
  }

  private transportType: ProxyTransportType;
  private wispUrl: string;
  private userAgent: string;

  get ready(): boolean {
    return this.isReady;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(
      new URL("./transport-worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    this.worker = worker;
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (!isWorkerControlResponse(event.data)) return;
      const message: WorkerControlResponse = event.data;
      const pending = this.pendingControls.get(message.requestId);
      if (!pending) return;
      this.pendingControls.delete(message.requestId);
      if (message.type === "READY") {
        this.isReady = true;
        pending.resolve();
      } else {
        pending.reject(
          new Error(message.error || "Proxy transport initialization failed."),
        );
      }
    });
    worker.addEventListener("error", (event) => {
      this.isReady = false;
      const error = new Error(
        event.message || "Proxy transport worker failed.",
      );
      for (const pending of this.pendingControls.values()) {
        pending.reject(error);
      }
      this.pendingControls.clear();
      for (const port of this.activePorts) port.close();
      this.activePorts.clear();
    });
    return worker;
  }

  private enqueueControl(operation: () => Promise<void>): Promise<void> {
    const result = this.controlQueue.then(operation);
    this.controlQueue = result.catch(() => {});
    return result;
  }

  private sendControl(
    type: ConfigureWorkerMessage["type"],
    transportType?: ProxyTransportType,
    wispUrl?: string,
    userAgent?: string,
  ): Promise<void> {
    const worker = this.ensureWorker();
    const requestId = `control-${++this.controlRequestId}`;
    return new Promise<void>((resolve, reject) => {
      this.pendingControls.set(requestId, { resolve, reject });
      worker.postMessage(
        {
          type,
          requestId,
          transportType,
          wispUrl,
          userAgent,
        } satisfies ConfigureWorkerMessage,
      );
    });
  }

  init(): Promise<void> {
    return this.enqueueControl(async () => {
      if (this.isReady) return;
      await this.sendControl("INIT", this.transportType, this.wispUrl);
      await this.sendControl(
        "SET_USER_AGENT",
        undefined,
        undefined,
        this.userAgent,
      );
    });
  }

  syncUserAgent(): Promise<void> {
    return this.enqueueControl(async () => {
      if (!this.isReady) return;
      await this.sendControl(
        "SET_USER_AGENT",
        undefined,
        undefined,
        this.userAgent,
      );
    });
  }

  setTransport(
    transportType: ProxyTransportType,
    wispUrl: string,
  ): Promise<void> {
    return this.enqueueControl(async () => {
      const changed = this.transportType !== transportType ||
        this.wispUrl !== wispUrl;
      this.transportType = transportType;
      this.wispUrl = wispUrl;
      if (!this.isReady) {
        await this.sendControl("INIT", transportType, wispUrl);
        await this.sendControl(
          "SET_USER_AGENT",
          undefined,
          undefined,
          this.userAgent,
        );
      } else if (changed) {
        await this.sendControl("SET_TRANSPORT", transportType, wispUrl);
      }
    });
  }

  async request(
    remote: URL,
    method: string,
    body: RequestBody,
    headers: RawHeaders,
    signal: AbortSignal | undefined,
  ): Promise<ProxyResponse> {
    await this.init();
    if (signal?.aborted) {
      throw signal.reason ??
        new DOMException("The request was aborted.", "AbortError");
    }

    const worker = this.ensureWorker();
    const channel = new MessageChannel();
    this.activePorts.add(channel.port1);
    return new Promise<ProxyResponse>((resolve, reject) => {
      const requestId = `request-${++this.requestId}`;
      const finish = <T>(callback: (value: T) => void, value: T) => {
        signal?.removeEventListener("abort", abort);
        channel.port1.close();
        this.activePorts.delete(channel.port1);
        callback(value);
      };
      const abort = () => {
        channel.port1.postMessage(
          { type: "ABORT", requestId } satisfies RequestPortCommand,
        );
        signal?.removeEventListener("abort", abort);
        channel.port1.close();
        this.activePorts.delete(channel.port1);
        reject(
          signal?.reason ??
            new DOMException("The request was aborted.", "AbortError"),
        );
      };
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        if (!isRequestPortResponse(event.data)) {
          finish(reject, new Error("Invalid proxy worker response."));
          return;
        }
        const message: RequestPortResponse = event.data;
        if (message.ok) finish(resolve, message.res);
        else {finish(
            reject,
            new Error(message.error || "Proxy transport request failed."),
          );}
      };
      channel.port1.onmessageerror = () =>
        finish(reject, new Error("Invalid proxy worker response."));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        channel.port2.close();
        return;
      }

      const message: Omit<RequestWorkerMessage, "port"> = {
        type: "REQUEST",
        requestId,
        remote: remote.href,
        method,
        body,
        headers,
      };
      void postRequest(worker, channel.port2, message).catch(
        (error: unknown) => {
          finish(
            reject,
            error instanceof Error ? error : new Error(String(error)),
          );
        },
      );
    });
  }

  connect(
    url: URL,
    protocols: string[],
    requestHeaders: RawHeaders,
    onopen: SocketCallbacks[3],
    onmessage: SocketCallbacks[4],
    onclose: SocketCallbacks[5],
    onerror: SocketCallbacks[6],
  ): ReturnType<ProxyTransport["connect"]> {
    const channel = new MessageChannel();
    this.activePorts.add(channel.port1);
    let closed = false;
    const closePort = () => {
      if (closed) return;
      closed = true;
      channel.port1.close();
      this.activePorts.delete(channel.port1);
    };
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      if (!isSocketWorkerEvent(event.data)) {
        onerror("Invalid proxy worker WebSocket response.");
        closePort();
        return;
      }
      const message: SocketWorkerEvent = event.data;
      if (message.type === "SOCKET_OPEN") {
        onopen(message.protocol, message.extensions);
      }
      if (message.type === "SOCKET_MESSAGE") onmessage(message.data);
      if (message.type === "SOCKET_CLOSE") {
        onclose(message.code, message.reason);
        closePort();
      }
      if (message.type === "SOCKET_ERROR") onerror(message.error);
    };
    channel.port1.onmessageerror = () => {
      onerror("Invalid proxy worker WebSocket response.");
      closePort();
    };

    void this.init().then(() => {
      const worker = this.ensureWorker();
      const message: ConnectWorkerMessage = {
        type: "CONNECT",
        url: url.href,
        protocols,
        requestHeaders,
        port: channel.port2,
      };
      worker.postMessage(message, [channel.port2]);
    }).catch((error: unknown) => {
      channel.port2.close();
      onerror(error instanceof Error ? error.message : String(error));
      closePort();
    });

    const send = (data: SocketData) => {
      if (closed) {
        throw new DOMException("WebSocket is closed.", "InvalidStateError");
      }
      const transferable = data instanceof ArrayBuffer ? data.slice(0) : data;
      const command: RequestPortCommand = {
        type: "SEND",
        connectionId: "direct",
        data: transferable,
      };
      channel.port1.postMessage(
        command,
        transferable instanceof ArrayBuffer ? [transferable] : [],
      );
    };
    const close = (code: number, reason: string) => {
      if (closed) return;
      const command: RequestPortCommand = {
        type: "CLOSE",
        connectionId: "direct",
        code,
        reason,
      };
      channel.port1.postMessage(command);
    };
    return [send, close];
  }
}
