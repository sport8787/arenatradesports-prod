/**
 * MediaPipe FaceMesh Service
 * Provides real-time facial landmark detection using MediaPipe
 */

import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

// Types
export interface FaceMeshInstance {
  faceMesh: FaceMesh;
  camera: Camera | null;
  isReady: boolean;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export type FaceLandmarks = LandmarkPoint[];

// Callback type for when results are received
export type OnResultsCallback = (landmarks: number[][] | null) => void;

let instance: FaceMeshInstance | null = null;
let onResultsCallback: OnResultsCallback | null = null;

/**
 * Initialize MediaPipe FaceMesh
 */
export async function initializeFaceMesh(): Promise<boolean> {
  if (instance?.isReady) {
    console.log('[FaceMesh] Already initialized');
    return true;
  }

  try {
    console.log('[FaceMesh] Initializing MediaPipe FaceMesh...');

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    // Configure FaceMesh
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // Enable iris tracking (478 landmarks instead of 468)
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Set up results callback
    faceMesh.onResults(handleResults);

    instance = {
      faceMesh,
      camera: null,
      isReady: true,
    };

    console.log('[FaceMesh] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[FaceMesh] Initialization error:', error);
    return false;
  }
}

/**
 * Handle FaceMesh results
 */
function handleResults(results: Results): void {
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    // Convert landmarks to array format [[x, y, z], ...]
    const landmarks = results.multiFaceLandmarks[0].map(
      (point: LandmarkPoint) => [point.x, point.y, point.z]
    );
    
    if (onResultsCallback) {
      onResultsCallback(landmarks);
    }
  } else {
    if (onResultsCallback) {
      onResultsCallback(null);
    }
  }
}

/**
 * Set the callback for receiving landmark results
 */
export function setOnResultsCallback(callback: OnResultsCallback): void {
  onResultsCallback = callback;
}

/**
 * Start camera and face detection
 */
export async function startFaceDetection(
  videoElement: HTMLVideoElement,
  callback: OnResultsCallback
): Promise<boolean> {
  if (!instance) {
    const initialized = await initializeFaceMesh();
    if (!initialized) return false;
  }

  setOnResultsCallback(callback);

  try {
    // Create camera instance
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if (instance?.faceMesh) {
          await instance.faceMesh.send({ image: videoElement });
        }
      },
      width: 1280,
      height: 720,
    });

    await camera.start();
    
    if (instance) {
      instance.camera = camera;
    }

    console.log('[FaceMesh] Camera started');
    return true;
  } catch (error) {
    console.error('[FaceMesh] Camera start error:', error);
    return false;
  }
}

/**
 * Process a single frame (for manual frame processing)
 */
export async function processFrame(videoElement: HTMLVideoElement): Promise<void> {
  if (instance?.faceMesh && instance.isReady) {
    await instance.faceMesh.send({ image: videoElement });
  }
}

/**
 * Stop face detection and cleanup
 */
export function stopFaceDetection(): void {
  if (instance?.camera) {
    instance.camera.stop();
    instance.camera = null;
    console.log('[FaceMesh] Camera stopped');
  }
  onResultsCallback = null;
}

/**
 * Cleanup and destroy FaceMesh instance
 */
export function destroyFaceMesh(): void {
  stopFaceDetection();
  
  if (instance?.faceMesh) {
    instance.faceMesh.close();
    instance = null;
    console.log('[FaceMesh] Instance destroyed');
  }
}

/**
 * Check if FaceMesh is ready
 */
export function isFaceMeshReady(): boolean {
  return instance?.isReady || false;
}

// Key facial landmark indices for quick reference
export const FACE_LANDMARKS = {
  // Iris (only available with refineLandmarks: true)
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,
  
  // Eyes
  LEFT_EYE_INNER: 133,
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  
  // Eyebrows
  LEFT_BROW_INNER: 107,
  LEFT_BROW_OUTER: 70,
  RIGHT_BROW_INNER: 336,
  RIGHT_BROW_OUTER: 300,
  
  // Nose
  NOSE_TIP: 4,
  NOSE_BASE: 168,
  
  // Lips
  UPPER_LIP_TOP: 13,
  LOWER_LIP_BOTTOM: 14,
  LEFT_LIP_CORNER: 61,
  RIGHT_LIP_CORNER: 291,
  
  // Jaw/Chin
  JAW_LEFT: 172,
  JAW_RIGHT: 397,
  CHIN: 152,
  
  // Face oval (for face detection)
  FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
};
