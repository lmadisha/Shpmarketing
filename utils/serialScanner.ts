import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { normalizeSerialCandidate } from "./serialLookup";

type CameraScannerCallbacks = {
  onDecode: (serial: string) => void;
  onError: (message: string) => void;
};

export type CameraScannerSession = {
  stop: () => void;
};

function stopVideoTracks(videoElement: HTMLVideoElement) {
  const mediaStream = videoElement.srcObject;
  if (!(mediaStream instanceof MediaStream)) {
    return;
  }

  for (const track of mediaStream.getTracks()) {
    track.stop();
  }

  videoElement.srcObject = null;
}

function getScannerErrorMessage(error: unknown) {
  const name = typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name || "")
    : "";
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was denied. Allow camera access and try again.";
  }

  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
    return "Camera is busy or unavailable. Close other camera apps and try again.";
  }

  if (name === "NotFoundException") {
    return "No barcode detected yet. Keep the barcode centered in view.";
  }

  return message || "Scanner failed. Try again.";
}

export function startCameraSerialScan(
  videoElement: HTMLVideoElement,
  callbacks: CameraScannerCallbacks,
): CameraScannerSession {
  const reader = new BrowserMultiFormatReader();
  let controls: IScannerControls | null = null;
  let stopped = false;

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    controls?.stop();
    controls = null;
    stopVideoTracks(videoElement);
  };

  void reader
    .decodeFromVideoDevice(undefined, videoElement, (result, error) => {
      if (stopped) {
        return;
      }

      if (result) {
        callbacks.onDecode(normalizeSerialCandidate(result.getText()));
        stop();
        return;
      }

      if (error) {
        const errorName = typeof error === "object" && error !== null && "name" in error
          ? String((error as { name?: unknown }).name || "")
          : "";
        if (errorName && errorName !== "NotFoundException") {
          callbacks.onError(getScannerErrorMessage(error));
        }
      }
    })
    .then((nextControls) => {
      controls = nextControls;
      if (stopped) {
        controls.stop();
        controls = null;
      }
    })
    .catch((error) => {
      callbacks.onError(getScannerErrorMessage(error));
      stop();
    });

  return { stop };
}

export async function decodeSerialFromImageFile(file: File) {
  const fileUrl = URL.createObjectURL(file);
  const reader = new BrowserMultiFormatReader();

  try {
    const result = await reader.decodeFromImageUrl(fileUrl);
    return normalizeSerialCandidate(result.getText());
  } catch (error) {
    throw new Error(getScannerErrorMessage(error));
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
}
