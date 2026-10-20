// Takes single pictures (frames) from the live video, for the decoder worker.

/** Larger frames are scaled down: they decode slowly and rarely help. */
const MAX_SIDE = 1920;

export interface FrameGrabber {
  /**
   * The canvas holding the last frame taken. After a successful read it still shows
   * exactly the picture that was decoded, so it becomes the frozen picture.
   */
  canvas: HTMLCanvasElement;
  /** Copies the video's current picture into pixels, or null if the video isn't ready. */
  grab(video: HTMLVideoElement): ImageData | null;
}

export function createFrameGrabber(): FrameGrabber {
  const canvas = document.createElement('canvas');
  // willReadFrequently: we read the pixels back every time, so keep them in memory.
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return {
    canvas,
    grab(video) {
      const { videoWidth, videoHeight } = video;
      if (!context || videoWidth === 0 || videoHeight === 0) return null;
      const scale = Math.min(1, MAX_SIDE / Math.max(videoWidth, videoHeight));
      const width = Math.round(videoWidth * scale);
      const height = Math.round(videoHeight * scale);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      return context.getImageData(0, 0, width, height);
    },
  };
}

/**
 * Waits until the camera shows a new picture. Browsers without that signal wait for
 * the next screen refresh instead.
 */
export function nextFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => resolve());
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
}
