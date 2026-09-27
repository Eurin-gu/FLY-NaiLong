(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("gameCanvas"),
    keys = new Set(),
    touch = new Set();
  const skillButtons = [...document.querySelectorAll("[data-skill]")];
  const fuels = ["poop", "water", "rainbow"],
    cooldowns = [8, 9, 12];
  const fuelNotes = {
    poop: "有机推进，环保部门暂未回复。",
    water: "自带移动洗车业务，楼下请收衣服。",
    rainbow: "看起来很梦幻，成分不方便细说。",
  };
  const s = {
    mode: "ready",
    flight: "free",
    fuel: "poop",
    peak: 18,
    x: 0,
    altitude: 18,
    vx: 0,
    vy: 0,
    speed: 0,
    thrust: 0,
    distance: 0,
    score: 0,
    hp: 3,
    time: 0,
    invincible: 0,
    shield: 0,
    dash: 0,
    roll: 0,
    rollCooldown: 0,
    celebration: 0,
    altitudeBadge: 0,
    cooldown: [0, 0, 0],
    combo: 0,
    best: 0,
    muted: true,
    pointer: false,
    gesture: false,
    camera: false,
  };
  let world,
    objects = [],
    last = 0,
    nextGate = 160,
    nextRadio = 7,
    radioTime = 0,
    radioIndex = 0,
    recordTime = 0,
    toastTimer,
    audio,
    pose = null,
    stream = null,
    cameraGeneration = 0,
    poseScript = null,
    gestureSeen = 0;
  let drag = { x: 0, y: 0, axisX: 0, axisY: 0 },
    cameraAvailable = true;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const radioLines = [
    "总部，目标不是胖，是自带燃料箱。",
    "他越飞越高，我的工资纹丝不动。",
    "前面的奶龙！不许在云里加料！",
    "请求调岗，哪怕去闻榴莲也行。",
    "目标已进入云层，云表示不愿透露姓名。",
    "高度很科学，动力很不科学。",
    "我追的到底是恐龙还是移动花洒？",
  ];
  try {
    s.best = Math.max(
      0,
      Number(localStorage.getItem("nailong-altitude-best")) || 0,
    );
  } catch {}
  try {
    world = new FlightWorld(canvas);
  } catch (error) {
    console.error("3D 初始化失败", error);
    $("renderError").hidden = false;
    $("startBtn").disabled = true;
    cameraAvailable = false;
  }
  if (world)
    new ResizeObserver(() =>
      world.resize(canvas.clientWidth, canvas.clientHeight),
    ).observe($("stage"));
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (s.mode === "running") pause();
    $("renderError").hidden = false;
    $("startBtn").disabled = true;
    cameraAvailable = false;
  });
  $("reloadBtn").addEventListener("click", () => location.reload());
  function toast(text) {
    $("toast").textContent = text;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2700);
  }
  function radio(text) {
    $("radioText").textContent = text;
    $("radio").hidden = false;
    radioTime = 4.5;
  }
  function beep(freq = 440) {
    if (s.muted) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type =
        s.fuel === "poop"
          ? "sawtooth"
          : s.fuel === "water"
            ? "sine"
            : "triangle";
      o.frequency.setValueAtTime(freq, audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        freq * 0.4,
        audio.currentTime + 0.22,
      );
      g.gain.setValueAtTime(0.025, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.24);
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.25);
    } catch {}
  }
  function saveRecord() {
    if (s.peak > s.best) {
      s.best = Math.floor(s.peak);
      try {
        localStorage.setItem("nailong-altitude-best", String(s.best));
      } catch {}
    }
  }
  function clearInput() {
    keys.clear();
    touch.clear();
    s.pointer = false;
    s.gesture = false;
    drag.axisX = drag.axisY = 0;
    document
      .querySelectorAll(".held")
      .forEach((b) => b.classList.remove("held"));
  }
  function setFuel(fuel) {
    s.fuel = fuel;
    document.querySelectorAll("[data-fuel]").forEach((b) => {
      const selected = b.dataset.fuel === fuel;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    $("fuelNote").textContent = fuelNotes[fuel];
    if (s.mode === "running")
      toast(
        fuel === "poop"
          ? "切换便便动力：有点重量，也有点分量。"
          : fuel === "water"
            ? "切换水柱：我不是漏水，我在起飞！"
            : "切换彩虹：谁还不是个梦幻小龙了。",
      );
  }
  function hud() {
    const altitude = Math.floor(s.altitude);
    $("altitudeText").innerHTML =
      `${altitude.toLocaleString()}<small>m</small>`;
    $("heightScale").textContent = altitude + " m";
    $("verticalText").innerHTML =
      `${s.vy > 1 ? "+" : ""}${Math.round(s.vy)}<small>m/s</small>`;
    $("speedText").innerHTML =
      `${Math.round(s.speed * 3.6)}<small>km/h</small>`;
    $("bestText").innerHTML =
      `${Math.max(s.best, altitude).toLocaleString()} <em>m</em>`;
    $("scoreText").textContent = String(s.score).padStart(4, "0");
    $("healthText").textContent = "♥ ".repeat(s.hp) + "♡ ".repeat(3 - s.hp);
    $("healthText").setAttribute(
      "aria-label",
      s.flight === "free" ? "自由模式，耐久自动恢复" : `${s.hp} 点耐久`,
    );
    $("distanceText").textContent = Math.floor(s.distance).toLocaleString();
    $("distanceTotal").textContent =
      s.flight === "free" ? "m / ∞" : "/ 6,000 m";
    $("distanceBar").style.width =
      (s.flight === "free"
        ? (s.distance % 6000) / 60
        : Math.min(100, s.distance / 60)) + "%";
    $("routeTitle").textContent =
      s.flight === "free"
        ? "自由飞行 · 想飞多久飞多久"
        : "挑战任务 · 飞满 6 km";
    const layer =
      altitude < 120
        ? "楼顶起步区"
        : altitude < 450
          ? "云层蹦迪区"
          : altitude < 1000
            ? "高空显眼包"
            : "平流层申请中";
    $("zoneText").textContent = layer;
    $("layerText").textContent = layer;
    $("comboText").textContent = s.combo > 1 ? "甜甜圈连吃 ×" + s.combo : "";
    skillButtons.forEach((b, i) => {
      b.disabled = s.mode !== "running" || s.cooldown[i] > 0;
      b.querySelector(".skill-key").textContent =
        s.cooldown[i] > 0 ? Math.ceil(s.cooldown[i]) + "s" : i + 1;
    });
    document
      .querySelectorAll("[data-flight]")
      .forEach(
        (b) => (b.disabled = s.mode === "running" || s.mode === "paused"),
      );
    $("flyBtn").classList.toggle("held", s.mode === "running" && s.thrust > 0);
    $("rollBtn").disabled = s.mode !== "running" || s.rollCooldown > 0;
    $("rollBtn").querySelector(".skill-key").textContent =
      s.rollCooldown > 0 ? Math.ceil(s.rollCooldown) + "s" : "E";
    $("stage").classList.toggle("boosting", s.mode === "running" && s.dash > 0);
    $("stage").classList.toggle(
      "celebrating",
      s.mode === "running" && s.celebration > 0,
    );
  }
  function start() {
    if (!world || !cameraAvailable) return;
    saveRecord();
    clearInput();
    objects.forEach((o) => world.remove(o));
    objects = [];
    Object.assign(s, {
      mode: "running",
      peak: 18,
      x: 0,
      altitude: 18,
      vx: 0,
      vy: 0,
      speed: 82,
      distance: 0,
      score: 0,
      hp: 3,
      invincible: 2,
      shield: 0,
      dash: 0,
      roll: 0,
      rollCooldown: 0,
      celebration: 0,
      altitudeBadge: 0,
      cooldown: [0, 0, 0],
      combo: 0,
      thrust: 0,
    });
    nextGate = 160;
    nextRadio = 7;
    radioTime = 0;
    radioIndex = 0;
    world.reset();
    $("gameOverlay").hidden = true;
    $("radio").hidden = true;
    $("pauseBtn").disabled = false;
    $("pauseBtn").textContent = "Ⅱ";
    $("pauseBtn").setAttribute("aria-label", "暂停游戏");
    document.body.classList.add("playing");
    $("startBtn").blur();
    toast("按住喷射往上冲！松手悬停，↓ 俯冲，A / D 转向。");
    hud();
    beep(300);
  }
  function overlay(tag, title, description, label) {
    $("overlayTag").textContent = tag;
    $("overlayTitle").innerHTML = title;
    $("overlayDescription").textContent = description;
    $("startBtn").innerHTML = label + " <span>↗</span>";
    $("gameOverlay").hidden = false;
    $("radio").hidden = true;
    $("targetHint").hidden = true;
  }
  function pause() {
    if (s.mode === "running") {
      s.mode = "paused";
      clearInput();
      saveRecord();
      overlay(
        "空域保留中 · 奶龙歇口气",
        "暂停输出。",
        "放心，刚才喷出去的东西也暂停了。",
        "继续上天",
      );
      $("pauseBtn").textContent = "▷";
      $("pauseBtn").setAttribute("aria-label", "继续游戏");
    } else if (s.mode === "paused") {
      s.mode = "running";
      $("gameOverlay").hidden = true;
      $("pauseBtn").textContent = "Ⅱ";
      $("pauseBtn").setAttribute("aria-label", "暂停游戏");
    }
    hud();
  }
  function finish(win) {
    s.mode = "ended";
    clearInput();
    saveRecord();
    if (win) s.score += 500;
    overlay(
      win ? "6 KM 挑战完成 · 航空界沉默了" : "这次落地 · 下次起飞",
      win ? "奶龙上岸，<br>尾气留名。" : "体面掉线，<br>可爱还在线。",
      `飞行 ${Math.floor(s.distance)} m · 最高纪录 ${s.best} m · 得分 ${s.score}。${win ? "本次通关 +500。洗车师傅：这单得加钱。" : "试试 3 键护盾，或者切换自由模式尽情飞。"}`,
      "再喷一趟",
    );
    $("pauseBtn").disabled = true;
    hud();
  }
  function damage() {
    if (s.invincible > 0 || s.dash > 0 || s.shield > 0 || s.roll > 0) return;
    s.hp--;
    s.invincible = 2.3;
    s.combo = 0;
    world.burst(s.x, s.altitude, 0, s.fuel, 25);
    beep(90);
    if (s.hp <= 0) {
      if (s.flight === "free") {
        s.hp = 3;
        toast("自由模式：体面自动续费，继续浪！");
      } else finish(false);
    } else toast("追兵：工伤！连我的无人机都要洗澡！");
  }
  function useSkill(i) {
    if (s.mode !== "running" || s.cooldown[i] > 0) return;
    s.cooldown[i] = cooldowns[i];
    if (i === 0) {
      world.shockwave(s);
      let count = 0;
      objects = objects.filter((o) => {
        if (
          o.type === "drone" &&
          Math.hypot(o.x - s.x, o.y - s.altitude) < 70 &&
          o.d - s.distance < 180 &&
          o.d > s.distance - 20
        ) {
          world.burst(o.x, o.y, s.distance - o.d, s.fuel, 10);
          world.remove(o);
          count++;
          return false;
        }
        return true;
      });
      s.score += count * 60;
      toast(
        `全场洗礼！${count ? count + " 架追兵申请调岗 +" + count * 60 : "空气无辜，但空气不说。"}`,
      );
      radio(
        s.fuel === "water"
          ? "报告！我在天上被强制洗车了！"
          : "报告！目标在空中进行不明物质广播！",
      );
      beep(130);
    } else if (i === 1) {
      s.dash = 2.5;
      toast("超频喷射！引擎没有，气势必须有。");
      radio("他不是超速，他是肠道超频！");
      beep(70);
    } else {
      s.shield = 6;
      toast("脸皮护盾已开：只要我不尴尬…");
      beep(700);
    }
    hud();
  }
  function input() {
    const up =
      keys.has("Space") ||
      keys.has("KeyW") ||
      keys.has("ArrowUp") ||
      touch.has("up") ||
      s.gesture;
    const down = keys.has("KeyS") || keys.has("ArrowDown") || touch.has("down");
    const right =
      keys.has("KeyD") || keys.has("ArrowRight") || touch.has("right");
    const left = keys.has("KeyA") || keys.has("ArrowLeft") || touch.has("left");
    return {
      x: clamp(
        (right ? 1 : 0) - (left ? 1 : 0) + (s.pointer ? drag.axisX : 0),
        -1,
        1,
      ),
      y: clamp(
        (up ? 1 : 0) - (down ? 1 : 0) + (s.pointer ? drag.axisY : 0),
        -1,
        1,
      ),
    };
  }
  function barrelRoll() {
    if (s.mode !== "running" || s.rollCooldown > 0) return;
    s.roll = 0.85;
    s.rollCooldown = 4;
    toast("奶龙打滚！0.85 秒闪避，胖也有胖的身法。");
    beep(280);
    hud();
  }
  // Sweep the whole movement segment so fast dives and boosts cannot tunnel through drones.
  function sweptDroneHit(before, after, drone) {
    let enter = 0,
      leave = 1;
    for (const [a, b, c, r] of [
      [before.x, after.x, drone.x, 4.7],
      [before.y, after.y, drone.y, 3.5],
      [before.d, after.d, drone.d, 6],
    ]) {
      const delta = b - a;
      if (Math.abs(delta) < 1e-8) {
        if (Math.abs(a - c) > r) return false;
        continue;
      }
      const t1 = (c - r - a) / delta,
        t2 = (c + r - a) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return false;
    }
    return true;
  }
  function spawnTargets() {
    const d = s.distance + 240;
    const targetY = Math.max(18, s.altitude + s.vy * 1.8 + 18);
    const targetX = s.x + Math.sin(s.distance * 0.002) * 18;
    const ring = world.addRing({ type: "ring", x: targetX, y: targetY, d });
    objects.push(ring);
    for (let i = 0; i < 2; i++)
      objects.push(
        world.addDrone({
          type: "drone",
          x: targetX + (i ? 16 : -16),
          y: Math.max(10, targetY + (i ? 18 : -15)),
          d: d + 55 + i * 35,
        }),
      );
    nextGate = s.distance + 230;
  }
  function update(dt) {
    if (s.mode === "ready") {
      s.time += dt;
      return;
    }
    if (s.mode !== "running") return;
    s.time += dt;
    if (s.gesture && performance.now() - gestureSeen > 650) s.gesture = false;
    const control = input();
    const before = { x: s.x, y: s.altitude, d: s.distance };
    s.thrust = control.y;
    const maxRise = s.dash > 0 ? 150 : 95;
    const targetVy = control.y * (control.y > 0 ? maxRise : 105);
    const acceleration = 150;
    if (control.y === 0) s.vy *= Math.exp(-12 * dt);
    else s.vy += clamp(targetVy - s.vy, -acceleration * dt, acceleration * dt);
    if (Math.abs(s.vy) < 0.05) s.vy = 0;
    const targetVx = control.x * 65;
    if (control.x === 0) s.vx *= Math.exp(-13 * dt);
    else s.vx += clamp(targetVx - s.vx, -170 * dt, 170 * dt);
    if (Math.abs(s.vx) < 0.05) s.vx = 0;
    s.altitude += s.vy * dt;
    s.peak = Math.max(s.peak, s.altitude);
    s.x += s.vx * dt;
    // Altitude is world space: there is deliberately no upper clamp.
    if (s.altitude < 5) {
      s.altitude = 5;
      s.vy = Math.max(s.vy, 9);
      if (s.time > 1 && s.invincible <= 0) {
        s.invincible = 1.5;
        toast("地面自动拉起：奶龙可以皮，不能糊地。");
      }
    }
    const targetSpeed = s.dash > 0 ? 235 : 88 + (control.y < 0 ? 25 : 0);
    s.speed += (targetSpeed - s.speed) * (1 - Math.exp(-dt * 4));
    const previous = s.distance;
    s.distance += s.speed * dt;
    s.invincible = Math.max(0, s.invincible - dt);
    s.dash = Math.max(0, s.dash - dt);
    s.shield = Math.max(0, s.shield - dt);
    s.roll = Math.max(0, s.roll - dt);
    s.rollCooldown = Math.max(0, s.rollCooldown - dt);
    s.celebration = Math.max(0, s.celebration - dt);
    const badge =
      s.peak >= 1000
        ? Math.floor(s.peak / 1000) * 1000
        : s.peak >= 500
          ? 500
          : s.peak >= 100
            ? 100
            : 0;
    if (badge > s.altitudeBadge) {
      s.altitudeBadge = badge;
      s.celebration = 1.1;
      toast(
        badge === 100
          ? "海拔 100 m！楼下：谁把奶龙放天上了？"
          : badge === 500
            ? "海拔 500 m！云朵：你最好喷的是水。"
            : `海拔 ${badge.toLocaleString()} m！奶龙：体重不是我的上限！`,
      );
    }
    s.cooldown = s.cooldown.map((v) => Math.max(0, v - dt));
    if (s.distance >= nextGate) spawnTargets();
    for (const o of objects) {
      const crossing = previous < o.d && s.distance >= o.d;
      const fraction = crossing
        ? (o.d - previous) / (s.distance - previous)
        : 1;
      const crossX = before.x + (s.x - before.x) * fraction;
      const crossY = before.y + (s.altitude - before.y) * fraction;
      if (o.type === "ring" && crossing) {
        if (Math.hypot(crossX - o.x, crossY - o.y) < 7.2) {
          s.combo++;
          s.celebration = 0.7;
          s.score += 100 + Math.min(s.combo - 1, 6) * 20;
          world.burst(o.x, o.y, 0, "rainbow", 30);
          toast(
            s.combo > 1
              ? `甜甜圈连吃 ×${s.combo}！奶龙：这是飞行还是自助餐？`
              : "甜甜圈 +100！燃料补给，全靠嘴。",
          );
          beep(650);
          o.collected = true;
        } else s.combo = 0;
      }
      if (
        o.type === "drone" &&
        sweptDroneHit(before, { x: s.x, y: s.altitude, d: s.distance }, o)
      ) {
        if (s.roll > 0) {
          s.score += 80;
          s.celebration = 0.6;
          world.burst(o.x, o.y, s.distance - o.d, "rainbow", 12);
          toast("翻滚闪避 +80！追兵：这肚子怎么还能漂移？！");
        } else if (s.dash > 0 || s.shield > 0) {
          s.score += 30;
          world.burst(o.x, o.y, s.distance - o.d, s.fuel, 14);
        } else damage();
        o.collected = true;
        if (s.mode !== "running") break;
      } else if (
        o.type === "drone" &&
        crossing &&
        !o.collected &&
        Math.hypot(crossX - o.x, crossY - o.y) < 13
      ) {
        s.score += 35;
        s.celebration = 0.45;
        toast("擦边飞过 +35！差点就要写情况说明了。");
        beep(520);
      }
    }
    objects = objects.filter((o) => {
      if (o.collected || o.d < s.distance - 45) {
        world.remove(o);
        return false;
      }
      return true;
    });
    radioTime -= dt;
    nextRadio -= dt;
    if (radioTime <= 0) $("radio").hidden = true;
    if (nextRadio <= 0) {
      radio(radioLines[radioIndex++ % radioLines.length]);
      nextRadio = 12;
    }
    recordTime += dt;
    if (recordTime > 3) {
      saveRecord();
      recordTime = 0;
    }
    if (s.flight === "challenge" && s.distance >= 6000) {
      s.distance = 6000;
      finish(true);
    }
    hud();
  }
  function targetIndicator() {
    if (s.mode !== "running") {
      $("targetHint").hidden = true;
      return;
    }
    const ring = objects.find(
      (o) => o.type === "ring" && o.d > s.distance + 20,
    );
    if (!ring) {
      $("targetHint").hidden = true;
      return;
    }
    const p = world.project(ring.x, ring.y, ring.d, s.distance);
    $("targetHint").hidden = !p.visible;
    const x = clamp(p.x, 70, canvas.clientWidth - 70),
      y = clamp(p.y - 42, 110, canvas.clientHeight - 110);
    $("targetHint").style.left = x + "px";
    $("targetHint").style.top = y + "px";
    const dy = Math.round(ring.y - s.altitude);
    const dx = Math.round(ring.x - s.x);
    $("targetHint").classList.toggle("aligned", Math.hypot(dx, dy) < 7.2);
    $("targetHint").textContent =
      `◎ ${Math.round(ring.d - s.distance)} m · ${Math.hypot(dx, dy) < 7.2 ? "已对准，保持！" : [Math.abs(dx) > 3 ? (dx > 0 ? "→ " : "← ") + Math.abs(dx) + " m" : "", Math.abs(dy) > 3 ? (dy > 0 ? "↑ " : "↓ ") + Math.abs(dy) + " m" : ""].filter(Boolean).join(" · ")}`;
  }
  function loop(t) {
    const dt = Math.min(0.04, (t - last) / 1000 || 0);
    last = t;
    if (world && cameraAvailable) {
      update(dt);
      world.render(s, dt, objects);
      targetIndicator();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  hud();
  $("startBtn").addEventListener("click", () =>
    s.mode === "paused" ? pause() : start(),
  );
  $("restartBtn").addEventListener("click", start);
  $("rollBtn").addEventListener("click", barrelRoll);
  $("pauseBtn").addEventListener("click", pause);
  skillButtons.forEach((b, i) =>
    b.addEventListener("click", () => useSkill(i)),
  );
  document
    .querySelectorAll("[data-fuel]")
    .forEach((b) => b.addEventListener("click", () => setFuel(b.dataset.fuel)));
  document.querySelectorAll("[data-flight]").forEach((b) =>
    b.addEventListener("click", () => {
      if (s.mode === "running" || s.mode === "paused") return;
      s.flight = b.dataset.flight;
      document.querySelectorAll("[data-flight]").forEach((el) => {
        el.classList.toggle("selected", el === b);
        el.setAttribute("aria-pressed", String(el === b));
      });
      $("flightModeHint").textContent =
        s.flight === "free"
          ? "自由模式自动补充体面，放心往上蹿。"
          : "挑战 6 km，三颗心。善用护盾和冲刺。";
      hud();
    }),
  );
  const controls = [
    "Space",
    "KeyW",
    "KeyS",
    "KeyA",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  window.addEventListener("keydown", (e) => {
    if ($("helpDialog").open || e.target instanceof HTMLInputElement) return;
    if (controls.includes(e.code)) {
      e.preventDefault();
      if (s.mode === "running") keys.add(e.code);
    }
    if (e.repeat) return;
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      pause();
    }
    if (e.code === "KeyQ") setFuel(fuels[(fuels.indexOf(s.fuel) + 1) % 3]);
    if (e.code === "KeyE") barrelRoll();
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") useSkill(1);
    if (/^Digit[123]$/.test(e.code)) useSkill(Number(e.code.at(-1)) - 1);
    if (e.code === "KeyF") fullscreen();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  function bindHold(el, control) {
    el.addEventListener("pointerdown", (e) => {
      if (s.mode !== "running") return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      touch.add(control);
      el.classList.add("held");
    });
    const release = () => {
      touch.delete(control);
      el.classList.remove("held");
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) =>
      el.addEventListener(name, release),
    );
  }
  bindHold($("flyBtn"), "up");
  document
    .querySelectorAll("[data-control]")
    .forEach((b) => bindHold(b, b.dataset.control));
  canvas.addEventListener("pointerdown", (e) => {
    if (s.mode !== "running") return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    s.pointer = true;
    drag = { x: e.clientX, y: e.clientY, axisX: 0, axisY: 0.8 };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!s.pointer) return;
    drag.axisX = clamp((e.clientX - drag.x) / 60, -1, 1);
    drag.axisY = clamp((drag.y - e.clientY) / 65, -1, 1);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) =>
    canvas.addEventListener(name, () => {
      s.pointer = false;
      drag.axisX = drag.axisY = 0;
    }),
  );
  window.addEventListener("blur", () => {
    clearInput();
    if (s.mode === "running") pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && s.mode === "running") pause();
  });
  $("helpBtn").addEventListener("click", () => {
    if (s.mode === "running") pause();
    $("helpDialog").showModal();
  });
  $("closeHelp").addEventListener("click", () => $("helpDialog").close());
  $("gotItBtn").addEventListener("click", () => $("helpDialog").close());
  $("soundBtn").addEventListener("click", () => {
    s.muted = !s.muted;
    $("soundBtn").setAttribute("aria-pressed", String(!s.muted));
    $("soundBtn").setAttribute("aria-label", s.muted ? "开启声音" : "关闭声音");
    $("soundBtn").innerHTML = `♪<span>声音${s.muted ? "关" : "开"}</span>`;
    beep();
  });
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector(".flight-panel").requestFullscreen();
    } catch {
      toast("此浏览器不支持全屏，仍可正常飞行。");
    }
  }
  $("fullscreenBtn").addEventListener("click", fullscreen);
  // Camera lifecycle is appended from the previous version, retaining local-only pose processing.
  function stopCamera() {
    cameraGeneration++;
    s.camera = false;
    s.gesture = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    $("cameraPreview").srcObject = null;
    $("cameraView").hidden = true;
    $("cameraBtn").disabled = false;
    $("cameraBtn").classList.remove("selected");
    $("keyboardBtn").classList.add("selected");
    $("keyboardBtn").setAttribute("aria-pressed", "true");
    $("cameraBtn").setAttribute("aria-pressed", "false");
    $("modeText").textContent = "键盘模式";
    if (pose) {
      pose.close().catch(() => {});
      pose = null;
    }
  }
  function loadPose() {
    if (window.Pose) return Promise.resolve();
    if (poseScript) return poseScript;
    poseScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js";
      const timeout = setTimeout(() => {
        script.remove();
        reject(Error("load timeout"));
      }, 18000);
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(Error("load error"));
      };
      document.head.appendChild(script);
    }).catch((e) => {
      poseScript = null;
      throw e;
    });
    return poseScript;
  }
  async function enableCamera() {
    if (s.camera) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast("摄像头需要 HTTPS 或 localhost，仍可使用键盘 / 触屏");
      return;
    }
    const generation = ++cameraGeneration;
    $("cameraView").hidden = false;
    $("cameraStatus").textContent = "正在申请摄像头权限…";
    $("cameraBtn").disabled = true;
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 },
        audio: false,
      });
      if (generation !== cameraGeneration) {
        incoming.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = incoming;
      $("cameraPreview").srcObject = stream;
      await $("cameraPreview").play();
      $("cameraStatus").textContent = "正在加载动作识别…";
      await loadPose();
      if (generation !== cameraGeneration) return;
      const currentPose = new window.Pose({
        locateFile: (f) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`,
      });
      pose = currentPose;
      currentPose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      currentPose.onResults((result) => {
        if (generation !== cameraGeneration) return;
        const lm = result.poseLandmarks,
          visible =
            lm && [11, 12, 15, 16].every((i) => lm[i].visibility > 0.55);
        s.gesture = Boolean(
          visible && lm[15].y < lm[11].y && lm[16].y < lm[12].y,
        );
        gestureSeen = performance.now();
        $("cameraStatus").textContent = visible
          ? s.gesture
            ? "双手抬起 · 正在上升"
            : "双手放下 · 平稳悬停"
          : "请后退一点，让肩膀和双手进入画面";
      });
      s.camera = true;
      $("modeText").textContent = "体感模式";
      $("cameraBtn").disabled = false;
      $("cameraBtn").classList.add("selected");
      $("keyboardBtn").classList.remove("selected");
      $("keyboardBtn").setAttribute("aria-pressed", "false");
      $("cameraBtn").setAttribute("aria-pressed", "true");
      const process = async () => {
        if (generation !== cameraGeneration || !s.camera) return;
        try {
          await currentPose.send({ image: $("cameraPreview") });
        } catch {
          if (generation === cameraGeneration) {
            stopCamera();
            toast("动作识别暂不可用，请使用键盘 / 触屏");
          }
          return;
        }
        if (generation === cameraGeneration) setTimeout(process, 65);
      };
      process();
    } catch (e) {
      if (generation !== cameraGeneration) return;
      stopCamera();
      toast(
        e.name === "NotAllowedError"
          ? "未获得摄像头权限，可继续使用键盘 / 触屏"
          : "摄像头或识别组件未就绪，可继续使用键盘 / 触屏",
      );
    }
  }
  $("cameraBtn").addEventListener("click", enableCamera);
  $("keyboardBtn").addEventListener("click", stopCamera);
  window.addEventListener("pagehide", stopCamera);
})();
