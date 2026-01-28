/**
 * MediaPipe FaceMesh Service
 * Provides real-time facial landmark detection using MediaPipe.
 *
 * Uses CDN script injection for reliable loading across all environments.
 */

// Types
export interface FaceMeshInstance {
  faceMesh: any;
  camera: any;
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
let scriptsLoaded = false;
let loadingPromise: Promise<boolean> | null = null;

// CDN URLs for MediaPipe
const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js';
const CAMERA_UTILS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js';

/**
 * Load a script from CDN and wait for it to be ready
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      console.log(`[FaceMesh] Script already loaded: ${src}`);
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      console.log(`[FaceMesh] ✅ Script loaded: ${src}`);
      resolve();
    };
    script.onerror = (err) => {
      console.error(`[FaceMesh] ❌ Script failed: ${src}`, err);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * Load MediaPipe scripts from CDN
 */
async function loadMediaPipeScripts(): Promise<boolean> {
  if (scriptsLoaded) {
    return true;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      console.log('[FaceMesh] 📦 Loading MediaPipe scripts from CDN...');
      
      // Load scripts sequentially (camera_utils depends on face_mesh patterns)
      await loadScript(FACE_MESH_CDN);
      await loadScript(CAMERA_UTILS_CDN);
      
      // Wait a bit for globals to be registered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify constructors are available
      const win = window as any;
      if (typeof win.FaceMesh !== 'function') {
        console.error('[FaceMesh] FaceMesh constructor not found after loading');
        return false;
      }
      if (typeof win.Camera !== 'function') {
        console.error('[FaceMesh] Camera constructor not found after loading');
        return false;
      }
      
      console.log('[FaceMesh] ✅ All MediaPipe scripts loaded successfully');
      scriptsLoaded = true;
      return true;
    } catch (error) {
      console.error('[FaceMesh] ❌ Failed to load MediaPipe scripts:', error);
      return false;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Initialize MediaPipe FaceMesh
 */
export async function initializeFaceMesh(): Promise<boolean> {
  if (instance?.isReady) {
    console.log('[FaceMesh] Already initialized');
    return true;
  }

  try {
    console.log('[FaceMesh] 🚀 Initializing MediaPipe FaceMesh...');

    // Load scripts from CDN
    const loaded = await loadMediaPipeScripts();
    if (!loaded) {
      console.error('[FaceMesh] Failed to load MediaPipe scripts');
      return false;
    }

    const win = window as any;
    const FaceMeshCtor = win.FaceMesh;

    const faceMesh = new FaceMeshCtor({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
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

    console.log('[FaceMesh] ✅ Initialized successfully');
    return true;
  } catch (error) {
    console.error('[FaceMesh] ❌ Initialization error:', error);
    return false;
  }
}

/**
 * Handle FaceMesh results
 */
function handleResults(results: any): void {
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
    // Load scripts if not already loaded
    const loaded = await loadMediaPipeScripts();
    if (!loaded) {
      console.error('[FaceMesh] Failed to load MediaPipe scripts for camera');
      return false;
    }

    const win = window as any;
    const CameraCtor = win.Camera;

    if (!CameraCtor) {
      console.error('[FaceMesh] Global Camera constructor not found.');
      return false;
    }

    // Create camera instance
    // Create camera instance
    const camera = new CameraCtor(videoElement, {
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
