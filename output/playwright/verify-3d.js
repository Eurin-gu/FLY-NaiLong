async (page) => {
  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.unroute("**/game.js");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/game.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: source.replace(
        /  let world,\s*objects\s*=/,
        "  window.__qa={s,update,start,get world(){return world;},get objects(){return objects;}};\n  let world,objects=",
      ),
    });
  });
  await page.reload();
  if (!(await page.evaluate(() => window.__qa.world?.renderer.getContext())))
    throw Error("WebGL not available");
  await page.screenshot({ path: "output/playwright/3d-desktop-ready.png" });
  await page.clock.install();
  await page.getByRole("button", { name: "给天空一点震撼 ↗" }).click();
  await page.keyboard.down("Space");
  await page.clock.runFor(8500);
  await page.keyboard.up("Space");
  const climb = await page.evaluate(() => ({
    altitude: __qa.s.altitude,
    vy: __qa.s.vy,
    cameraY: __qa.world.camera.position.y,
  }));
  if (climb.altitude < 650)
    throw Error("Not enough vertical freedom: " + JSON.stringify(climb));
  if (Math.abs(climb.cameraY - climb.altitude) > 50)
    throw Error("Camera did not follow climb");
  await page.clock.runFor(150);
  if ((await page.evaluate(() => __qa.s.altitude)) <= climb.altitude)
    throw Error("Release lost inertia");
  await page.clock.runFor(2400);
  const falling = await page.evaluate(() => ({
    h: __qa.s.altitude,
    v: __qa.s.vy,
  }));
  if (falling.v >= 0) throw Error("Gravity did not reverse ascent");
  await page.clock.runFor(500);
  if ((await page.evaluate(() => __qa.s.altitude)) >= falling.h)
    throw Error("Not falling");
  await page.getByRole("button", { name: "💦 水柱" }).click();
  await page.keyboard.down("Space");
  await page.clock.runFor(1000);
  await page.screenshot({
    path: "output/playwright/3d-water-high-altitude.png",
  });
  await page.keyboard.up("Space");
  if (
    !(await page.evaluate(() =>
      __qa.world.particles.some(
        (p) =>
          p.life > 0 && p.mesh.geometry === __qa.world.particleShapes.water,
      ),
    ))
  )
    throw Error("Water particles missing");
  await page.keyboard.press("KeyQ");
  if ((await page.evaluate(() => __qa.s.fuel)) !== "rainbow")
    throw Error("Fuel cycle failed");
  await page.keyboard.down("KeyD");
  await page.clock.runFor(1200);
  await page.keyboard.up("KeyD");
  if ((await page.evaluate(() => __qa.s.x)) < 40)
    throw Error("3D lateral motion failed");
  const height = await page.evaluate(() => __qa.s.altitude);
  await page.keyboard.down("KeyS");
  await page.clock.runFor(2000);
  await page.keyboard.up("KeyS");
  if ((await page.evaluate(() => __qa.s.altitude)) > height - 100)
    throw Error("Dive failed");
  await page.keyboard.press("Shift");
  await page.clock.runFor(600);
  if ((await page.evaluate(() => __qa.s.speed)) < 180)
    throw Error("Boost speed not applied");
  if ((await page.evaluate(() => __qa.world.camera.fov)) < 68)
    throw Error("Boost FOV missing");
  const cooldown = await page.evaluate(() => __qa.s.cooldown[1]);
  await page.keyboard.press("Digit2");
  if ((await page.evaluate(() => __qa.s.cooldown[1])) > cooldown + 0.05)
    throw Error("Cooldown bypass");
  await page.keyboard.press("Digit3");
  if ((await page.evaluate(() => __qa.s.shield)) < 5)
    throw Error("Shield missing");
  await page.keyboard.press("KeyP");
  const paused = await page.evaluate(() => ({
    d: __qa.s.distance,
    h: __qa.s.altitude,
  }));
  await page.clock.runFor(1000);
  if (
    (await page.evaluate(() => __qa.s.distance)) !== paused.d ||
    (await page.evaluate(() => __qa.s.altitude)) !== paused.h
  )
    throw Error("Pause failed");
  await page.keyboard.press("KeyP");
  await page.evaluate(() => {
    const q = __qa;
    const ring = q.world.addRing({
      type: "ring",
      x: q.s.x,
      y: q.s.altitude,
      d: q.s.distance + 1,
    });
    q.objects.push(ring);
    q.s.vy = 0;
    q.update(0.02);
  });
  if ((await page.evaluate(() => __qa.s.score)) < 100)
    throw Error("3D ring scoring failed");
  await page.evaluate(() => {
    const q = __qa;
    q.s.dash = 0;
    q.s.shield = 0;
    q.s.invincible = 0;
    q.s.hp = 1;
    q.objects.push(
      q.world.addDrone({
        type: "drone",
        x: q.s.x,
        y: q.s.altitude,
        d: q.s.distance + 1,
      }),
    );
    q.update(0.02);
  });
  if (
    (await page.evaluate(() => __qa.s.mode)) !== "running" ||
    (await page.evaluate(() => __qa.s.hp)) !== 3
  )
    throw Error("Free flight recovery failed");
  await page.evaluate(() => {
    const q = __qa;
    q.objects.push(
      q.world.addDrone({
        type: "drone",
        x: q.s.x,
        y: q.s.altitude,
        d: q.s.distance + 50,
      }),
    );
  });
  await page.keyboard.press("Digit1");
  if (
    await page.evaluate(() =>
      __qa.objects.some(
        (o) =>
          o.type === "drone" &&
          o.d > __qa.s.distance &&
          o.d < __qa.s.distance + 60 &&
          Math.abs(o.x - __qa.s.x) < 1,
      ),
    )
  )
    throw Error("Shockwave did not clear");
  await page.evaluate(() => {
    const q = __qa;
    q.s.flight = "challenge";
    q.s.hp = 1;
    q.s.invincible = 0;
    q.s.shield = 0;
    q.s.dash = 0;
    q.objects.push(
      q.world.addDrone({
        type: "drone",
        x: q.s.x,
        y: q.s.altitude,
        d: q.s.distance + 1,
      }),
    );
    q.update(0.02);
  });
  if ((await page.evaluate(() => __qa.s.mode)) !== "ended")
    throw Error("Challenge loss failed");
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  await page.evaluate(() => {
    __qa.s.distance = 5999.9;
    __qa.update(0.02);
  });
  if (
    !(await page
      .getByRole("heading", { name: "奶龙上岸， 尾气留名。" })
      .isVisible())
  )
    throw Error("Challenge win failed");
  await page.unroute("**/game.js");
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/3d-mobile-ready.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile overflow");
  await page.getByRole("button", { name: "给天空一点震撼 ↗" }).click();
  const up = page.getByRole("button", { name: "喷射上升", exact: true });
  const box = await up.boundingBox();
  if (box.y + box.height > 844) throw Error("Mobile controls below viewport");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(1400);
  await page.mouse.up();
  await page.screenshot({
    path: "output/playwright/3d-mobile-playing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "全屏飞行", exact: true }).click();
  if (!(await page.evaluate(() => !!document.fullscreenElement)))
    throw Error("Fullscreen not active");
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole("button", { name: "飞行指南", exact: true }).click();
  if (!(await page.getByRole("dialog").isVisible()))
    throw Error("Help missing");
  await page.getByRole("button", { name: "关闭指南" }).click();
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1040 });
  if (errors.length) throw Error(errors.join("\n"));
  return {
    passed: true,
    climb,
    checks:
      "WebGL, 650m+ ascent, camera tracking, inertia and gravity, diving, lateral movement, 3D jets, boost FOV, cooldowns, pause, ring scoring, free recovery, challenge win/loss, mobile controls, fullscreen, help",
  };
};
