export interface TextDeltaEvent {
  type: "text-delta";
  text: string;
}

export interface StreamStopEvent {
  type: "message-stop";
  stopReason?: string;
}

export interface StreamMetadataEvent {
  type: "metadata";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
}

export type TextStreamEvent = TextDeltaEvent | StreamStopEvent | StreamMetadataEvent;
