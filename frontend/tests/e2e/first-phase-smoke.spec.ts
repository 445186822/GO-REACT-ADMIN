import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  if (await page.locator('input[type="text"]').count()) {
    await page.locator('input[type="text"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill(process.env.E2E_ADMIN_PASSWORD ?? 'admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard/);
  }
}

test('first phase enterprise UX smoke', async ({ page }) => {
  await login(page);

  await page.goto('/knowledge-base');
  await expect(page.getByRole('heading', { name: '知识库' })).toBeVisible();
  await expect(page.getByText('分类导航')).toBeVisible();
  await expect(page.getByRole('tab', { name: '文章' })).toBeVisible();
  await page.getByRole('tab', { name: 'FAQ' }).click();
  await expect(page.getByRole('button', { name: /新增 FAQ/ })).toBeVisible();
  await page.getByRole('tab', { name: '分类维护' }).click();
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
  await page.getByLabel('名称').fill('请假');
  await page.getByRole('button', { name: '查 询' }).click();
  await expect(page.getByText('请假审批流程')).toBeVisible();
});
