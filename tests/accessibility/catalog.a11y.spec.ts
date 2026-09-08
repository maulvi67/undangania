import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("template catalog has no automatically detectable critical accessibility violations",async({page})=>{await page.goto("/templates");const result=await new AxeBuilder({page}).analyze();expect(result.violations.filter(v=>["critical","serious"].includes(v.impact??""))).toEqual([])});
