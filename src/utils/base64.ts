import type { AIImageContentPart } from "../types/multimodal.js";

export function bytesToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

export function imageToDataURL(image: AIImageContentPart): string {
  return `data:${image.mediaType};base64,${bytesToBase64(image.data)}`;
}
