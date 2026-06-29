import { describe, expect, it } from 'vitest';
import { shouldEnableSliderCaptcha } from './loginValidation';

describe('login validation helpers', () => {
  it('enables slider captcha only after username and password are filled', () => {
    expect(shouldEnableSliderCaptcha('', '')).toBe(false);
    expect(shouldEnableSliderCaptcha('admin', '')).toBe(false);
    expect(shouldEnableSliderCaptcha('', 'admin123')).toBe(false);
    expect(shouldEnableSliderCaptcha(' admin ', ' admin123 ')).toBe(true);
  });
});
