async (page) => {
  await page.route("**/game.js", async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()).replace(
        /  let world,\s*objects\s*=/,
        "  window.__qa={s,update,input,trackFlap,get world(){return world;}};\n  let world,objects=",
      ),
    });
  });
  await page.reload();
  await page.clock.install();
  await page.getByRole("button", { name: "给天空一点震撼 ↗" }).click();
  const checks = await page.evaluate(() => {
    const q = __qa,
      s = q.s;
    s.camera = true;
    s.altitude = 300;
    const lm = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 1,
    }));
    lm[11].x = 0.7;
    lm[12].x = 0.3;
    let now = performance.now();
    const feed = (height, tilt = 0) => {
      lm[11].y = 0.5 - tilt * 0.2;
      lm[12].y = 0.5 + tilt * 0.2;
      lm[15].y = lm[11].y + height * 0.4;
      lm[16].y = lm[12].y + height * 0.4;
      now += 65;
      return q.trackFlap(lm, now);
    };
    for (let i = 0; i < 20; i++) feed(0.5 + (i % 2 ? 0.012 : -0.012));
    if (s.flapUntil) throw Error("Jitter caused lift");
    for (const h of [0.45, 0.35, 0.25, 0.15, 0.2, 0.3, 0.4, 0.5]) feed(h);
    if (!s.flapUntil) throw Error("Small flap below shoulders not detected");
    const first = s.flapUntil;
    for (const h of [0.5, 0.45, 0.35, 0.25, 0.15, 0.2, 0.3, 0.4, 0.5]) feed(h);
    if (s.flapUntil <= first) throw Error("Second flap not detected");
    for (let i = 0; i < 12; i++) feed(0.5, 0.4);
    if (s.steer < 0.85 || q.input().x < 0.85)
      throw Error("Right lean did not steer right");
    q.update(0.15);
    q.world.render(s, 0.016, []);
    if (
      s.vx <= 0 ||
      q.world.hero.rotation.z >= 0 ||
      q.world.head.rotation.y <= 0
    )
      throw Error("Right bank animation missing");
    for (let i = 0; i < 18; i++) feed(0.5, -0.4);
    if (s.steer > -0.85 || q.input().x > -0.85)
      throw Error("Left lean did not steer left");
    document.getElementById("recenterBtn").click();
    for (let i = 0; i < 12; i++) feed(0.5, -0.4);
    if (Math.abs(s.steer) > 0.05) throw Error("Recenter failed");
    q.trackFlap(null, now + 65);
    if (s.steer || s.flapUntil || s.gesture)
      throw Error("Tracking loss leaves stuck input");
    // Missing wrists can use visible elbows without creating a false stroke on source change.
    lm[15].visibility = lm[16].visibility = 0.1;
    lm[13].y = lm[14].y = 0.7;
    q.trackFlap(lm, now + 130);
    if (s.flapUntil) throw Error("Elbow fallback caused false stroke");
    return [
      "small flaps below shoulders",
      "repeat flaps",
      "jitter rejection",
      "left/right lean",
      "bank and head animation",
      "recenter",
      "tracking loss",
      "elbow fallback",
    ];
  });
  await page.unroute("**/game.js");
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.screenshot({ path: "output/playwright/nailong-pose-final.png" });
  return { passed: true, checks };
};
