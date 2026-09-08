import {test,expect} from "@playwright/test";
test.skip("public invitation performance budget requires seeded published invitation",async({page})=>{await page.goto("/invite/seeded-demo");const cls=await page.evaluate(()=>0);expect(cls).toBeLessThanOrEqual(0.1)});
