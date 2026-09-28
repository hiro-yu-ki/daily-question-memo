import { test,expect } from '@playwright/test';

test('login, import, list, and detail',async({page})=>{
  const password=process.env.E2E_WEB_PASSWORD;if(!password)test.skip(true,'Set E2E_WEB_PASSWORD for a running local Worker');
  await page.goto('/');await page.getByLabel('パスワード').fill(password);await page.getByRole('button',{name:'ログイン'}).click();
  await page.getByRole('link',{name:'会話を取り込む'}).click();await page.getByLabel('会話テキスト').fill('毎朝の時間を有効に使いたい。最初の15分で計画する。');await page.getByRole('button',{name:'AI整理して保存'}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('毎朝の時間を有効に使いたい');await expect(page.getByText('取り込み原文')).toBeVisible();
});

test('failed AI capture remains visible and can retry',async({page})=>{
  const password=process.env.E2E_WEB_PASSWORD;if(!password)test.skip(true,'Set E2E_WEB_PASSWORD for a running local Worker');
  await page.goto('/');await page.getByLabel('パスワード').fill(password);await page.getByRole('button',{name:'ログイン'}).click();await page.getByRole('link',{name:'会話を取り込む'}).click();await page.getByLabel('会話テキスト').fill('[[MOCK_ERROR]] 原文を保持する');await page.getByRole('button',{name:'AI整理して保存'}).click();await page.getByRole('link',{name:'アイデア'}).click();await expect(page.getByText('AI整理に失敗しました')).toBeVisible();await expect(page.getByText('[[MOCK_ERROR]] 原文を保持する')).toBeVisible();
});
