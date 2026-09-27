async (page) => {
  await page.unroute("**/game.js");
  await page.route("**/game.js", async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()).replace(
        /  let world,\s*objects\s*=/,
        "  window.__qa={s,update,start,trackFlap,get world(){return world;}};\n  let world,objects=",
      ),
    });
  });
  await page.reload();
  await page.clock.install();
  await page.getByRole("button", { name: "给天空一点震撼 ↗" }).click();
  const result = await page.evaluate(() => {
    const q = __qa,
      s = q.s;
    s.altitude = 300;
    s.vy = 0;
    q.update(0.1);
    if (s.vy >= 0 || s.altitude >= 300) throw Error("No gravity at rest");
    s.altitude = 4;
    s.vy = -40;
    q.update(0.1);
    q.update(0.1);
    if (s.altitude !== 4 || s.vy !== 0)
      throw Error("Automatic bounce on landing");
    s.altitude = 300;
    s.vy = 0;
    s.dash = 2;
    q.update(0.1);
    q.world.render(s, 0.016, []);
    if (s.vy >= 0 || q.world.jet.visible)
      throw Error("Boost generated uncommanded lift/jet");
    s.dash = 0;
    s.camera = true;
    const lm = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0.5,
      visibility: 1,
    }));
    lm[11].x = 0.3;
    lm[12].x = 0.7;
    const now = performance.now();
    lm[15].y = lm[16].y = 0.15;
    for (let i = 0; i < 10; i++) q.trackFlap(lm, now - 600 + i * 60);
    if (s.flapUntil !== 0) throw Error("Static raised hands generated lift");
    lm[15].y = lm[16].y = 0.4;
    q.trackFlap(lm, now);
    if (!s.gesture || s.flapUntil !== now + 200)
      throw Error("Downstroke not recognized");
    const deadline = s.flapUntil;
    lm[15].y = lm[16].y = 0.5;
    q.trackFlap(lm, now + 60);
    if (s.flapUntil !== deadline) throw Error("Same stroke retriggered");
    return {
      gravity: true,
      landing: true,
      boostRequiresFlap: true,
      staticHands: true,
      downstroke: true,
    };
  });
  await page.clock.runFor(600);
  if (await page.evaluate(() => __qa.s.gesture))
    throw Error("Lift persisted after flapping stopped");
  await page.evaluate(() => __qa.trackFlap(null, performance.now()));
  if (await page.evaluate(() => __qa.s.flapUntil !== 0))
    throw Error("Lost tracking kept lift");
  await page.unroute("**/game.js");
  await page.reload();
  return { ...result, stoppedFlapExpires: true, lostTracking: true };
};
