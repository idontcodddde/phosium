const transferableBody = (body) => body instanceof ReadableStream || body instanceof ArrayBuffer;

async function postRequest(worker, port, message) {
  const body = message.body;
  const transfer = [port];
  if (transferableBody(body)) transfer.push(body);

  try {
    worker.postMessage({ ...message, port }, transfer);
  } catch (error) {
    if (!(body instanceof ReadableStream)) throw error;
    const fallbackBody = await new Response(body).arrayBuffer();
    worker.postMessage({ ...message, body: fallbackBody, port }, [port, fallbackBody]);
  }
}

export class WorkerTransport {
  constructor(transportType = "epoxy", wispUrl = "") {
    this.transportType = transportType;
    this.wispUrl = wispUrl;
    this.worker = null;
    this.isReady = false;
    this.controlQueue = Promise.resolve();
    this.controlRequestId = 0;
    this.requestId = 0;
    this.pendingControls = new Map();
    this.activePorts = new Set();
  }

  get ready() {
    return this.isReady;
  }

  ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL("./transport-worker.js", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.type !== "READY" && message?.type !== "ERROR") return;
      const pending = this.pendingControls.get(message.requestId);
      if (!pending) return;
      this.pendingControls.delete(message.requestId);
      if (message.type === "READY") {
        this.isReady = true;
        pending.resolve();
      } else {
        pending.reject(new Error(message.error || "Proxy transport initialization failed."));
      }
    });
    this.worker.addEventListener("error", (event) => {
      this.isReady = false;
      const error = new Error(event.message || "Proxy transport worker failed.");
      for (const pending of this.pendingControls.values()) pending.reject(error);
      this.pendingControls.clear();
      for (const port of this.activePorts) port.close();
      this.activePorts.clear();
    });
  }

  enqueueControl(operation) {
    const result = this.controlQueue.then(operation);
    this.controlQueue = result.catch(() => {});
    return result;
  }

  sendControl(type, transportType, wispUrl) {
    this.ensureWorker();
    const requestId = `control-${++this.controlRequestId}`;
    return new Promise((resolve, reject) => {
      this.pendingControls.set(requestId, { resolve, reject });
      this.worker.postMessage({ type, requestId, transportType, wispUrl });
    });
  }

  init() {
    return this.enqueueControl(() => {
      if (this.isReady) return Promise.resolve();
      return this.sendControl("INIT", this.transportType, this.wispUrl);
    });
  }

  setTransport(transportType, wispUrl) {
    return this.enqueueControl(async () => {
      const changed = this.transportType !== transportType || this.wispUrl !== wispUrl;
      this.transportType = transportType;
      this.wispUrl = wispUrl;
      if (!this.isReady) {
        await this.sendControl("INIT", transportType, wispUrl);
      } else if (changed) {
        await this.sendControl("SET_TRANSPORT", transportType, wispUrl);
      }
    });
  }

  async request(remote, method, body, headers, signal) {
    await this.init();
    if (signal?.aborted) throw signal.reason ?? new DOMException("The request was aborted.", "AbortError");

    const channel = new MessageChannel();
    this.activePorts.add(channel.port1);
    return new Promise((resolve, reject) => {
      const requestId = `request-${++this.requestId}`;
      const finish = (callback, value) => {
        signal?.removeEventListener("abort", abort);
        channel.port1.close();
        this.activePorts.delete(channel.port1);
        callback(value);
      };
      const abort = () => {
        channel.port1.postMessage({ type: "ABORT", requestId });
        finish(reject, signal.reason ?? new DOMException("The request was aborted.", "AbortError"));
      };
      channel.port1.onmessage = (event) => {
        const message = event.data;
        if (message?.ok) finish(resolve, message.res);
        else finish(reject, new Error(message?.error || "Proxy transport request failed."));
      };
      channel.port1.onmessageerror = () => finish(reject, new Error("Invalid proxy worker response."));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        channel.port2.close();
        return;
      }

      void postRequest(this.worker, channel.port2, {
        type: "REQUEST",
        requestId,
        remote: remote.href,
        method,
        body,
        headers,
      }).catch((error) => finish(reject, error));
    });
  }

  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    const channel = new MessageChannel();
    this.activePorts.add(channel.port1);
    let closed = false;
    const closePort = () => {
      if (closed) return;
      closed = true;
      channel.port1.close();
      this.activePorts.delete(channel.port1);
    };
    channel.port1.onmessage = (event) => {
      const message = event.data;
      if (message?.type === "SOCKET_OPEN") onopen(message.protocol, message.extensions);
      if (message?.type === "SOCKET_MESSAGE") onmessage(message.data);
      if (message?.type === "SOCKET_CLOSE") {
        onclose(message.code, message.reason);
        closePort();
      }
      if (message?.type === "SOCKET_ERROR") onerror(message.error);
    };
    channel.port1.onmessageerror = () => {
      onerror("Invalid proxy worker WebSocket response.");
      closePort();
    };

    void this.init().then(() => {
      this.worker.postMessage({
        type: "CONNECT",
        url: url.href,
        protocols,
        requestHeaders,
        port: channel.port2,
      }, [channel.port2]);
    }).catch((error) => {
      channel.port2.close();
      onerror(error instanceof Error ? error.message : String(error));
      closePort();
    });

    const send = (data) => {
      if (closed) throw new DOMException("WebSocket is closed.", "InvalidStateError");
      const transferable = data instanceof ArrayBuffer ? data.slice(0) : data;
      channel.port1.postMessage(
        { type: "SEND", connectionId: "direct", data: transferable },
        transferable instanceof ArrayBuffer ? [transferable] : [],
      );
    };
    const close = (code, reason) => {
      if (closed) return;
      channel.port1.postMessage({ type: "CLOSE", connectionId: "direct", code, reason });
    };
    return [send, close];
  }
}
