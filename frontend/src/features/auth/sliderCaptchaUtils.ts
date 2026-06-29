export type SliderTrackPoint = {
  x: number;
  t: number;
};

export function clampSliderX(value: number, trackWidth: number, pieceSize: number) {
  const max = Math.max(0, trackWidth - pieceSize);
  return Math.min(Math.max(Math.round(value), 0), max);
}

export function toTrackPoint(x: number, elapsedMs: number): SliderTrackPoint {
  return {
    x: Math.round(x),
    t: Math.max(0, Math.round(elapsedMs)),
  };
}
