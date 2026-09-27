async (page) => {
  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 1440, height: 1040 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/game.js", async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()).replace(
        /  let world,\s*objects\s*=/,
        "  window.__qa={s,update,start,get world(){return world;},get objects(){return objects;}};\n  let world,objects=",
      ),
    });
  });
  await page.reload();
  await page.clock.install();
  await page.getByRole("button", { name: "给天空一点震撼 ↗" }).click();
  await page.keyboard.down("Space");
  await page.clock.runFor(1600);
  await page.keyboard.up("Space");
  const release = await page.evaluate(() => __qa.s.altitude);
  await page.clock.runFor(600);
  const stopped = await page.evaluate(() => ({
    altitude: __qa.s.altitude,
    vy: __qa.s.vy,
  }));
  if (stopped.altitude <= release || stopped.vy <= 0)
    throw Error("Release lost upward inertia: " + JSON.stringify(stopped));
  await page.keyboard.press("KeyE");
  if ((await page.evaluate(() => __qa.s.roll)) <= 0)
    throw Error("Roll input failed");
  const hp = await page.evaluate(() => __qa.s.hp),
    score = await page.evaluate(() => __qa.s.score);
  await page.evaluate(() => {
    const q = __qa;
    q.s.invincible = 0;
    q.s.shield = q.s.dash = 0;
    q.s.vy = q.s.vx = 0;
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
    (await page.evaluate(() => __qa.s.hp)) !== hp ||
    (await page.evaluate(() => __qa.s.score)) !== score + 80
  )
    throw Error("Roll dodge scoring failed");
  await page.clock.runFor(230);
  if ((await page.evaluate(() => __qa.world.jetDirection.y)) > -0.95)
    throw Error("Jet is not directed downward");
  await page.screenshot({ path: "output/playwright/flight-roll.png" });
  const cooldown = await page.evaluate(() => __qa.s.rollCooldown);
  await page.keyboard.press("KeyE");
  if ((await page.evaluate(() => __qa.s.rollCooldown)) > cooldown + 0.05)
    throw Error("Roll cooldown bypass");
  await page.keyboard.press("KeyP");
  const pauseBefore = await page.evaluate(() => ({
    d: __qa.s.distance,
    r: __qa.s.roll,
    cam: __qa.world.camera.position.toArray(),
  }));
  await page.clock.runFor(600);
  const pauseAfter = await page.evaluate(() => ({
    d: __qa.s.distance,
    r: __qa.s.roll,
    cam: __qa.world.camera.position.toArray(),
  }));
  if (JSON.stringify(pauseBefore) !== JSON.stringify(pauseAfter))
    throw Error("Pause changed roll/camera");
  await page.keyboard.press("KeyP");
  await page.evaluate(() => {
    const q = __qa;
    q.s.roll = q.s.invincible = q.s.dash = q.s.shield = 0;
    q.s.hp = 3;
    q.s.vy = q.s.vx = 0;
    q.s.speed = 800;
    q.objects.push(
      q.world.addDrone({
        type: "drone",
        x: q.s.x,
        y: q.s.altitude,
        d: q.s.distance + 12,
      }),
    );
    q.update(0.04);
  });
  if ((await page.evaluate(() => __qa.s.hp)) !== 2)
    throw Error("Swept collision missed high-speed drone");
  const nearBefore = await page.evaluate(() => __qa.s.score);
  await page.evaluate(() => {
    const q = __qa;
    q.s.speed = 88;
    q.objects.push(
      q.world.addDrone({
        type: "drone",
        x: q.s.x + 9,
        y: q.s.altitude,
        d: q.s.distance + 1,
      }),
    );
    q.update(0.02);
  });
  if ((await page.evaluate(() => __qa.s.score)) !== nearBefore + 35)
    throw Error("Near miss scoring failed");
  const environment = await page.evaluate(() => {
    const q = __qa;
    function capture(x, d) {
      q.s.x = x;
      q.s.distance = d;
      q.world.render(q.s, 0, q.objects);
      const found = new Map();
      const m = new THREE.Matrix4(),
        v = new THREE.Vector3(),
        r = new THREE.Quaternion(),
        scale = new THREE.Vector3();
      for (let i = 0; i < 230; i++) {
        q.world.buildings.getMatrixAt(i, m);
        m.decompose(v, r, scale);
        if (scale.x > 0)
          found.set(
            Math.round(v.x + q.world.city.position.x) +
              "," +
              Math.round(d - v.z - q.world.city.position.z),
            scale.y,
          );
      }
      return found;
    }
    const a = capture(47.9, 47.9),
      b = capture(48.1, 48.1);
    let common = 0;
    for (const [key, height] of a)
      if (b.has(key)) {
        common++;
        if (Math.abs(height - b.get(key)) > 0.001)
          throw Error("Building jumped at tile boundary");
      }
    return common;
  });
  if (environment < 150) throw Error("Too few continuous city cells");
  await page.getByRole("button", { name: "🌈 彩虹" }).click();
  await page.keyboard.down("Space");
  await page.keyboard.press("Shift");
  await page.clock.runFor(650);
  if (
    !(await page.evaluate(
      () =>
        __qa.world.speedLines.visible &&
        __qa.world.speedLines.material.opacity > 0.4,
    ))
  )
    throw Error("Boost streaks missing");
  if (
    !(await page.evaluate(() => __qa.world.jetStrands.every((p) => p.visible)))
  )
    throw Error("Rainbow tail missing");
  await page.screenshot({ path: "output/playwright/flight-boost.png" });
  await page.keyboard.up("Space");
  await page.keyboard.press("KeyP");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "继续上天 ↗" }).click();
  await page.screenshot({
    path: "output/playwright/flight-mobile.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile overflow");
  const mobileRoll = await page
    .getByRole("button", { name: /奶龙打滚/ })
    .boundingBox();
  if (mobileRoll.y + mobileRoll.height > 844)
    throw Error("Mobile roll below viewport");
  if (errors.length) throw Error(errors.join("\n"));
  await page.unroute("**/game.js");
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.reload();
  return {
    passed: true,
    inertialRise: stopped.altitude - release,
    cityCellsPreserved: environment,
    checks:
      "upward inertia, barrel roll, nozzle direction, cooldown, pause, swept collisions, near misses, stable scenery, boost streaks, rainbow trail, mobile",
  };
};
