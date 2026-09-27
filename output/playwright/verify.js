async (page) => {
  page.setDefaultTimeout(6000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.unroute("**/game.js");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/game.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: source.replace(
        "  new ResizeObserver(resize)",
        "  window.__qa={s,update,getStars:()=>stars,getEnemies:()=>enemies};\n  new ResizeObserver(resize)",
      ),
    });
  });
  await page.reload();
  await page.clock.install();
  await page.getByRole("button", { name: "憋不住了，起飞 ↗" }).click();
  const before = await page.evaluate(() => ({ ...window.__qa.s }));
  await page.keyboard.down("Space");
  await page.clock.runFor(350);
  await page.keyboard.up("Space");
  const after = await page.evaluate(() => ({ ...window.__qa.s }));
  if (!(after.y < before.y)) throw Error("Hold-to-fly failed");
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(150);
  await page.keyboard.up("ArrowRight");
  if (!((await page.evaluate(() => window.__qa.s.x)) > after.x))
    throw Error("Horizontal motion failed");
  await page.keyboard.press("Digit2");
  let dash = await page.evaluate(() => window.__qa.s.dash);
  if (dash <= 0) throw Error("Dash not active");
  await page.clock.runFor(150);
  await page.keyboard.press("Digit2");
  if ((await page.evaluate(() => window.__qa.s.dash)) >= dash)
    throw Error("Cooldown bypass");
  await page.keyboard.press("Digit3");
  if ((await page.evaluate(() => window.__qa.s.shield)) <= 0)
    throw Error("Shield not active");
  await page.keyboard.press("KeyP");
  const paused = await page.evaluate(() => window.__qa.s.distance);
  await page.clock.runFor(1200);
  if ((await page.evaluate(() => window.__qa.s.distance)) !== paused)
    throw Error("Pause does not freeze");
  await page.keyboard.press("KeyP");
  await page.evaluate(() => {
    const q = window.__qa;
    q.s.x = 180;
    q.s.y = 180;
    q.s.vy = 0;
    q.getEnemies().push({ x: 250, y: 180, baseY: 180, phase: 0 });
  });
  await page.keyboard.press("Digit1");
  if (
    await page.evaluate(() => window.__qa.getEnemies().some((e) => e.x === 250))
  )
    throw Error("Clear skill did not clear drone");
  await page.evaluate(() => {
    const q = window.__qa;
    q.getStars().push({ x: q.s.x, y: q.s.y });
    q.update(0);
  });
  if ((await page.evaluate(() => window.__qa.s.score)) < 65)
    throw Error("Collection score failed");
  await page.evaluate(() => {
    const q = window.__qa;
    q.s.distance = 1199.99;
    q.update(0.02);
  });
  if (
    !(await page
      .getByRole("heading", { name: "洗白成功！ 依然有味。" })
      .isVisible())
  )
    throw Error("Win screen missing");
  if (
    (await page.evaluate(() =>
      Number(localStorage.getItem("pooperman-best")),
    )) < 415
  )
    throw Error("Record not stored");
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  await page.evaluate(() => {
    const q = window.__qa;
    q.s.hp = 1;
    q.s.invincible = 0;
    q.s.y = 999;
    q.update(0.016);
  });
  if ((await page.evaluate(() => window.__qa.s.mode)) !== "ended")
    throw Error("Loss screen failed");
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  const fly = page.getByRole("button", { name: /↟ 按住，给点底气/ });
  const box = await fly.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(250);
  if (!(await page.evaluate(() => window.__qa.s.pointer)))
    throw Error("Pointer hold failed");
  await page.mouse.up();
  if (await page.evaluate(() => window.__qa.s.pointer))
    throw Error("Pointer release failed");
  await page.getByRole("button", { name: "? 新屎入门" }).click();
  if ((await page.evaluate(() => window.__qa.s.mode)) !== "paused")
    throw Error("Help should pause");
  await page.getByRole("button", { name: "关闭指南" }).click();
  await page.getByRole("button", { name: "继续整活 ↗" }).click();
  await page.keyboard.press("Digit2");
  await page.clock.runFor(120);
  await page.screenshot({ path: "output/playwright/desktop-playing.png" });
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/mobile-ready.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile horizontal overflow");
  await page.getByRole("button", { name: "憋不住了，起飞 ↗" }).click();
  await page.clock.runFor(100);
  await page.screenshot({
    path: "output/playwright/mobile-playing.png",
    fullPage: true,
  });
  const mobileFly = await fly.boundingBox();
  if (mobileFly.y + mobileFly.height > 844)
    throw Error("Mobile flight control below viewport");
  await page.context().clearPermissions();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "◎ 肢体施法" }).click();
  if (await page.evaluate(() => window.__qa.s.camera))
    throw Error("Denied camera activated");
  if (errors.length) throw Error(errors.join("\n"));
  await page.unroute("**/game.js");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.screenshot({ path: "output/playwright/desktop-ready.png" });
  console.log(
    "PASS: flight, horizontal motion, touch hold/release, 3 skills, cooldown, collection, pause/resume, win/loss, record, help, camera denial fallback, mobile overflow and controls. No page errors.",
  );
};
