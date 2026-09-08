import {test,expect} from "@playwright/test";
test("catalog has clear Indonesian heading",async({page})=>{await page.goto("/templates");await expect(page.getByRole("heading",{level:1})).toContainText("Pilih desain")});
