export type AiWorkerEvent =
    | { type: "status"; status: string }
    | { type: "progress"; progress: number }
    | { type: "ready" }
    | { type: "token"; requestId: string; text: string }
    | { type: "done"; requestId: string }
    | { type: "error"; requestId?: string; error: string };

export type AiWorkerCommand =
    | { type: "init"; modelUrl: string }
    | {
        type: "chat";
        requestId: string;
        prompt: string;
        systemPrompt?: string;
        modelUrl?: string;
    }
    | { type: "abort"; requestId?: string }
    | { type: "reset" };

export type AiEventListener = (event: AiWorkerEvent) => void;
