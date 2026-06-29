export function shouldEnableSliderCaptcha(username?: string, password?: string) {
  return Boolean(username?.trim() && password?.trim());
}
