// MP4 encoding in the browser: WebCodecs via Mediabunny (H.264 where available, else VP9 or AV1).

import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, getFirstEncodableVideoCodec } from 'mediabunny';

export const canEncodeVideo = () => typeof VideoEncoder !== 'undefined';

/**
 * canvas: the canvas each frame is drawn into (even width and height).
 * draw(i, seconds): draws frame i (may be async). Returns {blob, codec, frames}.
 */
export async function encodeFrames({ canvas, fps = 24, count, draw, onProgress, signal }) {
  if (!canEncodeVideo()) throw new Error('This browser cannot encode video (no WebCodecs). Use a current Chrome or Edge.');
  const { width, height } = canvas;
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height, quality: QUALITY_HIGH });
  if (!codec) throw new Error(`No video encoder available for ${width}×${height}.`);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  try {
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      await draw(i, i / fps);
      await source.add(i / fps, 1 / fps);
      onProgress?.((i + 1) / count);
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), codec, frames: count };
}
