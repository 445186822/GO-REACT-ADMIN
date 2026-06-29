import { expect, test, type Page } from '@playwright/test';

async function solveSliderCaptcha(page: Page) {
  const captcha = page.getByTestId('slider-captcha');
  if (!(await captcha.count())) {
    return;
  }

  const handle = captcha.getByRole('button', { name: '拖动滑块' });
  await expect(handle).toBeVisible();

  const targetX = Number(await captcha.getAttribute('data-captcha-target-x'));
  const box = await handle.boundingBox();
  if (!box || Number.isNaN(targetX)) {
    throw new Error('Slider captcha is not ready');
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + targetX, startY, { steps: 16 });
  await page.mouse.up();
  await expect(captcha).toHaveClass(/slider-captcha-verified/);
}

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const passwordInput = page.locator('input[type="password"]').first();
  const needsLogin = await passwordInput.isVisible({ timeout: 5_000 }).catch(() => false);
  if (needsLogin) {
    await page.locator('input[type="text"]').first().fill('admin');
    await passwordInput.fill(process.env.E2E_ADMIN_PASSWORD ?? 'admin123');
    await solveSliderCaptcha(page);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard/);
  }
}

test('first phase enterprise UX smoke', async ({ page }) => {
  await login(page);

  await page.goto('/knowledge-base');
  await expect(page.getByRole('heading', { name: '知识库' })).toBeVisible();
  await expect(page.getByText('文章管理').first()).toBeVisible();
  await expect(page.getByText('FAQ 管理').first()).toBeVisible();
  await expect(page.getByText('分类管理').first()).toBeVisible();
  await page.locator('.ant-card').filter({ hasText: 'FAQ 管理' }).first().click();
  await expect(page.getByRole('button', { name: /新增 FAQ/ })).toBeVisible();
  await page.locator('.ant-card').filter({ hasText: '分类管理' }).first().click();
  await expect(page.getByRole('button', { name: '新增分类' })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '系统配置' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /基础信息/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /安全策略/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /AI 设置/ })).toBeVisible();

  await page.getByLabel('全局外观').click();
  await expect(page.getByText('布局模式')).toBeVisible();
  await page.getByText('顶部菜单').click();
  await expect(page.locator('.app-top-menu')).toBeVisible();
  await page.keyboard.press('Escape');

  const aiButton = page.locator('.ai-float-trigger');
  await expect(aiButton).toBeVisible();
  const box = await aiButton.boundingBox();
  expect(box?.width).toBeCloseTo(box?.height ?? 0, 1);

  await page.goto('/collaboration/workflows');
  await expect(page.locator('.ant-table-row').filter({ hasText: 'approval' })).toBeVisible();
});
