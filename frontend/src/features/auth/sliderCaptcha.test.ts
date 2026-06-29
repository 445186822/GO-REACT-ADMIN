import { describe, expect, it } from 'vitest';
import { clampSliderX, toTrackPoint } from './sliderCaptchaUtils';

describe('slider captcha helpers', () => {
  it('clamps drag offsets inside the slider track', () => {
    expect(clampSliderX(-12, 260, 44)).toBe(0);
    expect(clampSliderX(120, 260, 44)).toBe(120);
    expect(clampSliderX(260, 260, 44)).toBe(216);
  });

  it('stores integer x coordinates in track points', () => {
    expect(toTrackPoint(42.7, 1000)).toEqual({ x: 43, t: 1000 });
  });
});
