import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { normalizeSerialCandidate } from "./serialLookup";

type CameraScannerCallbacks = {
  onDecode: (serial: string) => void;
  onError: (message: string) => void;
};

export type CameraScannerSession = {
  stop: () => void;
};

// Native BarcodeDetector type (Chrome/Edge)
interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
}

function getNativeBarcodeDetector(): NativeBarcodeDetectorConstructor | null {
  const w = globalThis as unknown as Record<string, unknown>;
  return (w.BarcodeDetector as NativeBarcodeDetectorConstructor) ?? null;
}

function stopVideoTracks(videoElement: HTMLVideoElement) {
  const mediaStream = videoElement.srcObject;
  if (!(mediaStream instanceof MediaStream)) return;
  for (const track of mediaStream.getTracks()) track.stop();
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

function createZxingReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
};

// ── Native BarcodeDetector scanner (Chrome/Edge — fast & reliable) ──────────

function startNativeScan(
  videoElement: HTMLVideoElement,
  detector: NativeBarcodeDetector,
  callbacks: CameraScannerCallbacks,
): CameraScannerSession {
  let stopped = false;
  let rafId = 0;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    stopVideoTracks(videoElement);
  };

  void navigator.mediaDevices
    .getUserMedia(CAMERA_CONSTRAINTS)
    .then((stream) => {
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      videoElement.srcObject = stream;
      return videoElement.play();
    })
    .then(() => {
      if (stopped) return;

      const scanFrame = async () => {
        if (stopped) return;
        try {
          if (videoElement.readyState >= videoElement.HAVE_ENOUGH_DATA) {
            const results = await detector.detect(videoElement);
            if (results.length > 0 && !stopped) {
              callbacks.onDecode(normalizeSerialCandidate(results[0].rawValue));
              stop();
              return;
            }
          }
        } catch {
          // detect() can throw on invalid frames — ignore and retry
        }
        if (!stopped) rafId = requestAnimationFrame(scanFrame);
      };

      rafId = requestAnimationFrame(scanFrame);
    })
    .catch((error) => {
      callbacks.onError(getScannerErrorMessage(error));
      stop();
    });

  return { stop };
}

// ── Zxing fallback scanner (Firefox / older browsers) ───────────────────────

function startZxingScan(
  videoElement: HTMLVideoElement,
  callbacks: CameraScannerCallbacks,
): CameraScannerSession {
  const reader = createZxingReader();
  let controls: IScannerControls | null = null;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    controls?.stop();
    controls = null;
    stopVideoTracks(videoElement);
  };

  void navigator.mediaDevices
    .getUserMedia(CAMERA_CONSTRAINTS)
    .then((stream) => {
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return Promise.reject(new Error("stopped")); }
      videoElement.srcObject = stream;
      return videoElement.play();
    })
    .then(() => {
      if (stopped) return;
      return reader.decodeFromVideoElement(videoElement, (result, error) => {
        if (stopped) return;
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
      });
    })
    .then((nextControls) => {
      if (!nextControls) return;
      controls = nextControls;
      if (stopped) { controls.stop(); controls = null; }
    })
    .catch((error) => {
      if (error instanceof Error && error.message === "stopped") return;
      callbacks.onError(getScannerErrorMessage(error));
      stop();
    });

  return { stop };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startCameraSerialScan(
  videoElement: HTMLVideoElement,
  callbacks: CameraScannerCallbacks,
): CameraScannerSession {
  if (!navigator.mediaDevices?.getUserMedia) {
    callbacks.onError("Camera access is not available in this browser. Try a different browser or use the image upload option.");
    return { stop: () => {} };
  }

  const BarcodeDetectorCtor = getNativeBarcodeDetector();
  if (BarcodeDetectorCtor) {
    const detector = new BarcodeDetectorCtor({ formats: ["code_128", "code_39", "itf"] });
    return startNativeScan(videoElement, detector, callbacks);
  }

  return startZxingScan(videoElement, callbacks);
}

export async function decodeSerialFromImageFile(file: File) {
  const fileUrl = URL.createObjectURL(file);

  try {
    // Try native BarcodeDetector first (much more reliable for images too)
    const BarcodeDetectorCtor = getNativeBarcodeDetector();
    if (BarcodeDetectorCtor) {
      const detector = new BarcodeDetectorCtor({ formats: ["code_128", "code_39", "itf"] });
      const img = new Image();
      img.src = fileUrl;
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
      const results = await detector.detect(img);
      if (results.length > 0) return normalizeSerialCandidate(results[0].rawValue);
      throw new Error("No barcode detected in the image. Ensure the barcode is clearly visible.");
    }

    // Fallback to zxing
    const reader = createZxingReader();
    const result = await reader.decodeFromImageUrl(fileUrl);
    return normalizeSerialCandidate(result.getText());
  } catch (error) {
    throw new Error(getScannerErrorMessage(error));
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
}
