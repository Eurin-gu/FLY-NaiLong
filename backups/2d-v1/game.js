(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("gameCanvas"),
    ctx = canvas.getContext("2d");
  const keys = new Set();
  const skillButtons = [...document.querySelectorAll("[data-skill]")];
  const cooldowns = [7, 10, 12];
  const s = {
    mode: "ready",
    x: 180,
    y: 210,
    vy: 0,
    distance: 0,
    score: 0,
    hp: 3,
    time: 0,
    invincible: 0,
    shield: 0,
    dash: 0,
    cooldown: [0, 0, 0],
    combo: 0,
    best: 0,
    muted: true,
    pointer: false,
    gesture: false,
    camera: false,
  };
  let w = 800,
    h = 440,
    last = 0,
    spawn = 1.8,
    stars = [],
    enemies = [],
    particles = [],
    drops = [],
    toastTimer,
    audio,
    pose = null,
    stream = null,
    cameraGeneration = 0,
    poseScript = null,
    gestureSeen = 0,
    radioTime = 0,
    radioNext = 5,
    radioIndex = 0;
  const radioLines = [
    "前方那坨！你没有飞行许可证！",
    "报告总部，目标有点上头。",
    "他烧的什么燃料？怎么有生活气息？",
    "别追太近！保持一个鼻子的安全距离！",
    "总部问：这算交通问题还是卫生问题？",
    "你有权保持沉默，但请停止排气。",
    "我是来上班的，不是来渡劫的。",
    "目标正在升空，我的职业信仰正在落地。",
  ];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  try {
    s.best = Number(localStorage.getItem("pooperman-best")) || 0;
  } catch {}
  $("bestText").innerHTML = `${s.best} <em>分</em>`;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const random = (a, b) => a + Math.random() * (b - a);
  function resize() {
    const r = canvas.getBoundingClientRect(),
      oldH = h,
      oldW = w;
    w = r.width;
    h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.y = clamp((s.y / oldH) * h, 78, h - 63);
    s.x = clamp((s.x / oldW) * w, 45, w * 0.7);
    stars.forEach((a) => {
      a.y = (a.y / oldH) * h;
    });
    enemies.forEach((a) => {
      a.y = (a.y / oldH) * h;
      a.baseY = (a.baseY / oldH) * h;
    });
  }
  new ResizeObserver(resize).observe($("stage"));
  function rounded(x, y, width, height, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
  }
  function cloud(x, y, k = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = "#fffef4";
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(-13, -9, 20, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -14, 23, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function scenery() {
    const sunset = s.distance >= 400 && s.distance < 850;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, sunset ? "#f4e7d3" : "#e5eddb");
    sky.addColorStop(1, "#eff0d9");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f5edb2";
    ctx.beginPath();
    ctx.arc(w * 0.77, h * 0.22, 34, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++)
      cloud(
        ((((i * 229 - s.distance * 0.3) % (w + 190)) + w + 190) % (w + 190)) -
          80,
        55 + (i % 3) * 42,
        0.65 + (i % 2) * 0.4,
      );
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? "#c7d2b5" : "#d8dfc6";
      ctx.beginPath();
      ctx.moveTo(-40, h);
      for (let x = -40; x < w + 80; x += 40)
        ctx.lineTo(
          x,
          h * 0.6 +
            Math.sin((x + s.distance * 0.15 * (layer + 1)) / 125 + layer * 2) *
              27 +
            layer * 42,
        );
      ctx.lineTo(w + 80, h);
      ctx.fill();
    }
    for (let i = 0; i < Math.ceil(w / 65) + 3; i++) {
      let x =
        ((((i * 75 - s.distance * 0.45) % (w + 180)) + w + 180) % (w + 180)) -
        90;
      const bh = 53 + ((i * 43) % 102),
        by = h - 40 - bh;
      rounded(x, by, 48 + (i % 3) * 8, bh, 3, i % 2 ? "#bbc8ab" : "#b0c1a1");
      ctx.fillStyle = "#dde5cd";
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < Math.floor(bh / 24) - 1; b++)
          ctx.fillRect(x + 9 + a * 14, by + 13 + b * 23, 5, 9);
      ctx.fillStyle = "#a4b995";
      ctx.fillRect(x - 3, by, 56, 4);
      if (i % 4 === 2) {
        rounded(x - 2, by + 13, 54, 19, 2, "#e6e5c9");
        ctx.fillStyle = "#889670";
        ctx.font = '9px "Microsoft YaHei",sans-serif';
        ctx.fillText(
          ["带薪摸鱼", "禁止内卷", "绝不加班"][i % 3],
          x + 7,
          by + 26,
        );
      }
    }
    if (s.distance >= 400 && s.distance < 850) {
      ctx.strokeStyle = "#94ab8a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, h - 62);
      ctx.lineTo(w, h - 62);
      ctx.stroke();
      for (let x = 50; x < w; x += 160) {
        ctx.fillStyle = "#94ab8a";
        ctx.fillRect(x, h - 145, 7, 110);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, h - 143);
        ctx.quadraticCurveTo(x + 80, h - 20, x + 160, h - 143);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#9caf8c";
    ctx.fillRect(0, h - 33, w, 33);
    ctx.fillStyle = "#c1cea9";
    ctx.fillRect(0, h - 34, w, 5);
    ctx.fillStyle = "#e7e9cf";
    for (let i = 0; i < w / 46 + 2; i++)
      ctx.fillRect(i * 46 - ((s.distance * 2) % 46), h - 15, 19, 2);
    if (s.distance > 1000) {
      const x = w - ((s.distance - 1000) * w) / 250;
      rounded(x, h - 107, 108, 73, 3, "#e2e6ce");
      rounded(x + 10, h - 84, 88, 50, 2, "#99b9ab");
      ctx.fillStyle = "#fffcec";
      ctx.font = 'bold 12px "Microsoft YaHei",sans-serif';
      ctx.fillText("上 岸 洗 车", x + 17, h - 91);
    }
    if (s.mode === "ready") {
      const hx = w * (w < 500 ? 0.79 : 0.71),
        hy = h * 0.53;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(-0.12);
      drawHero(0, 0, Math.min(2.1, w / 340), false);
      ctx.restore();
      ctx.strokeStyle = "#9fad8990";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(hx - 85, h * 0.54 + i * 18 - 20);
        ctx.lineTo(hx - 125 - i * 10, h * 0.54 + i * 18 - 20);
        ctx.stroke();
      }
      if (w > 500) {
        bubble(hx - 34, hy - 121, "妈，我出息了！");
        drawStar(hx + 92, hy - 34, 12);
        drawStar(hx - 68, hy - 90, 8);
        drawDrone(w * 0.9, h * 0.76, 0.8);
        bubble(w * 0.9 - 35, h * 0.76 - 50, "这谁顶得住");
      }
    }
  }
  function bubble(x, y, text) {
    ctx.font = '11px "Microsoft YaHei",sans-serif';
    const bw = ctx.measureText(text).width + 20;
    rounded(x - bw / 2, y, bw, 28, 7, "#fffdf1");
    ctx.fillStyle = "#fffdf1";
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 27);
    ctx.lineTo(x + 3, y + 36);
    ctx.lineTo(x + 8, y + 27);
    ctx.fill();
    ctx.fillStyle = "#7a8867";
    ctx.fillText(text, x - bw / 2 + 10, y + 18);
  }
  function drawHero(x, y, k = 1, flapping = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(
      s.mode === "running"
        ? clamp(s.vy / 1300, -0.22, 0.25)
        : Math.sin(s.time * 2) * 0.035,
    );
    const wave = Math.sin(s.time * 10) * 5;
    ctx.fillStyle = "#db7551";
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.quadraticCurveTo(-42, 17 + wave, -65, 2 + wave);
    ctx.lineTo(-54, 28 + wave);
    ctx.quadraticCurveTo(-28, 38, -3, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#bc6447";
    ctx.beginPath();
    ctx.moveTo(-12, 7);
    ctx.lineTo(-54, 28 + wave);
    ctx.lineTo(-28, 23);
    ctx.fill();
    ctx.strokeStyle = "#72563d";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-12, 14);
    ctx.lineTo(-27, flapping ? -9 : 18);
    ctx.moveTo(18, 10);
    ctx.lineTo(32, flapping ? -14 : 1);
    ctx.stroke();
    rounded(-23, 3, 52, 23, 12, "#8c6646");
    rounded(-17, -12, 40, 25, 13, "#98704c");
    rounded(-9, -26, 25, 23, 12, "#a27a50");
    ctx.fillStyle = "#a27a50";
    ctx.beginPath();
    ctx.moveTo(-6, -24);
    ctx.quadraticCurveTo(11, -32, 6, -43);
    ctx.quadraticCurveTo(31, -20, 10, -14);
    ctx.fill();
    rounded(-19, -7, 44, 15, 5, "#e7ac64");
    ctx.fillStyle = "#fffcef";
    ctx.beginPath();
    ctx.ellipse(-5, 0, 7, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(13, -1, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d4431";
    ctx.beginPath();
    ctx.arc(-3, 0, 2.7, 0, Math.PI * 2);
    ctx.arc(15, -1, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#493d2c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(6, 9, 6, 0.05, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = "#efbb64";
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(7, 17);
    ctx.lineTo(15, 22);
    ctx.lineTo(7, 30);
    ctx.fill();
    ctx.fillStyle = "#a77848";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText("P", 4, 26);
    ctx.restore();
  }
  function drawDrone(x, y, k = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.strokeStyle = "#7c8c80";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-31, -3);
    ctx.lineTo(31, -3);
    ctx.stroke();
    rounded(-23, -8, 46, 22, 9, "#788f83");
    rounded(-15, -4, 29, 10, 4, "#d6e1cf");
    rounded(
      -7,
      -13,
      14,
      5,
      2,
      Math.sin(s.time * 7) > 0 ? "#de9271" : "#b4c5cd",
    );
    ctx.fillStyle = "#64796a";
    ctx.fillRect(-34, -12, 3, 10);
    ctx.fillRect(31, -12, 3, 10);
    ctx.strokeStyle = "#8d9e87";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, -13);
    ctx.lineTo(-22, -13);
    ctx.moveTo(21, -13);
    ctx.lineTo(44, -13);
    ctx.stroke();
    ctx.restore();
  }
  function drawStar(x, y, r = 10) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#eac16b";
    ctx.strokeStyle = "#cfa150";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++)
      particles.push({
        x,
        y,
        vx: random(-110, 110),
        vy: random(-100, 100),
        life: random(0.35, 0.7),
        color,
      });
  }
  function draw() {
    scenery();
    if (s.mode !== "ready") {
      stars.forEach((a) =>
        drawStar(a.x, a.y, 10 + Math.sin(s.time * 3 + a.x) * 1.5),
      );
      enemies.forEach((a) => drawDrone(a.x, a.y));
      if (s.shield > 0 || s.dash > 0) {
        ctx.fillStyle = s.dash > 0 ? "#ffe1a75c" : "#e8f5e566";
        ctx.strokeStyle = s.dash > 0 ? "#eac574" : "#a2bdb1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 6, 43, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = s.invincible > 0 && Math.sin(s.time * 28) > 0 ? 0.4 : 1;
      drawHero(s.x, s.y, 1, isFlying());
      ctx.globalAlpha = 1;
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      rounded(p.x, p.y, 5, 5, 2, p.color);
    }
    ctx.globalAlpha = 1;
    for (const d of drops) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.font = "30px sans-serif";
      ctx.fillText("💩", -15, 10);
      ctx.restore();
    }
  }
  function isFlying() {
    return (
      s.pointer ||
      s.gesture ||
      keys.has("Space") ||
      keys.has("ArrowUp") ||
      keys.has("KeyW")
    );
  }
  function clearInput() {
    keys.clear();
    s.pointer = false;
    s.gesture = false;
    $("flyBtn").classList.remove("held");
  }
  function toast(text) {
    $("toast").textContent = text;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2400);
  }
  function radio(text) {
    $("radio").hidden = false;
    $("radioText").textContent = text;
    radioTime = 4;
  }
  function beep(f = 440, kind = "sine") {
    if (s.muted) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const osc = audio.createOscillator(),
        gain = audio.createGain();
      osc.type = kind;
      osc.frequency.setValueAtTime(f, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        f / 2,
        audio.currentTime + 0.16,
      );
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.19);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.2);
    } catch {}
  }
  function hud() {
    $("scoreText").textContent = String(Math.floor(s.score)).padStart(4, "0");
    $("distanceText").textContent = Math.floor(s.distance).toLocaleString();
    $("distanceBar").style.width = s.distance / 12 + "%";
    $("healthText").textContent = "♥ ".repeat(s.hp) + "♡ ".repeat(3 - s.hp);
    $("healthText").setAttribute("aria-label", `${s.hp} 点耐久`);
    $("comboText").textContent = s.combo > 1 ? `✦ 星途无量 ×${s.combo}` : "";
    $("zoneText").textContent =
      s.distance < 400
        ? "01 / 带薪摸鱼街"
        : s.distance < 850
          ? "02 / 破防大桥"
          : "03 / 上岸洗车站";
    skillButtons.forEach((b, i) => {
      b.disabled = s.mode !== "running" || s.cooldown[i] > 0;
      b.querySelector(".skill-key").textContent =
        s.cooldown[i] > 0 ? Math.ceil(s.cooldown[i]) + "s" : i + 1;
    });
  }
  function start() {
    clearInput();
    Object.assign(s, {
      mode: "running",
      distance: 0,
      score: 0,
      hp: 3,
      vy: 0,
      invincible: 2,
      shield: 0,
      dash: 0,
      cooldown: [0, 0, 0],
      combo: 0,
    });
    s.x = w * 0.24;
    s.y = h * 0.48;
    stars = [];
    enemies = [];
    particles = [];
    drops = [];
    spawn = 1.8;
    radioTime = 0;
    radioNext = 5;
    radioIndex = 0;
    $("radio").hidden = true;
    $("gameOverlay").hidden = true;
    $("pauseBtn").disabled = false;
    $("pauseBtn").textContent = "Ⅱ";
    $("pauseBtn").setAttribute("aria-label", "暂停游戏");
    document.body.classList.add("playing");
    $("startBtn").blur();
    hud();
    toast("按住空格 / 飞行按钮上升，松开下降。别紧张，先憋住。");
    beep(520);
  }
  function showOverlay(tag, title, description, button) {
    $("overlayTag").textContent = tag;
    $("overlayTitle").innerHTML = title;
    $("overlayDescription").textContent = description;
    $("startBtn").innerHTML = button + " <span>↗</span>";
    $("startTip").innerHTML =
      s.mode === "paused"
        ? "<kbd>P / ESC</kbd> 也可以继续飞行"
        : "<kbd>SPACE</kbd> 按住上升，松开下降";
    $("gameOverlay").hidden = false;
    $("radio").hidden = true;
  }
  function pause() {
    if (s.mode === "running") {
      s.mode = "paused";
      clearInput();
      showOverlay(
        "正在假装是一个正经网页",
        "暂停排气。",
        "追兵也想喘口气。虽然他们不太敢。",
        "继续整活",
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
    if (win) s.score += 350;
    if (s.score > s.best) {
      s.best = Math.floor(s.score);
      try {
        localStorage.setItem("pooperman-best", String(s.best));
      } catch {}
      $("bestText").innerHTML = `${s.best} <em>分</em>`;
    }
    const title = win
      ? "洗白成功！<br>依然有味。"
      : pick([
          "出师未捷，<br>先糊地上。",
          "体面归零。<br>但味道还在。",
          "飞得挺好，<br>下次别飞了？",
        ]);
    showOverlay(
      win
        ? "通关认证 / 今天也是有用的一坨"
        : "本局称号 / " +
            (s.distance < 200
              ? "低空抛物艺术家"
              : s.distance < 600
                ? "半空中的显眼包"
                : "差一点就洗白"),
      title,
      `飞行 ${Math.floor(s.distance)} 米 · 震撼值 ${Math.floor(s.score)}${win ? "（含通关 +350）。洗车师傅：这单得加钱。" : "。短按稳住高度，3 键护盾可以保住体面。"}`,
      win ? "再臭名远扬一次" : "不服，再来一坨",
    );
    $("pauseBtn").disabled = true;
    hud();
  }
  function damage(reason) {
    if (s.invincible > 0 || s.shield > 0 || s.dash > 0) return;
    s.hp--;
    s.combo = 0;
    s.invincible = 1.8;
    burst(s.x, s.y, "#dd8866", 18);
    beep(150);
    if (s.hp <= 0) finish(false);
    else
      toast(
        reason === "ground"
          ? pick([
              "与大地亲密接触。大地：你不要过来啊！",
              "差点回归土壤。按住飞行按钮，争点气！",
            ])
          : reason === "ceiling"
            ? "天花板：我招谁惹谁了？松手降一降。"
            : pick([
                "无人机：工伤，这绝对算工伤！",
                "撞机了！对方要求赔偿精神和嗅觉损失。",
              ]),
      );
  }
  function useSkill(i) {
    if (s.mode !== "running" || s.cooldown[i] > 0) return;
    s.cooldown[i] = cooldowns[i];
    if (i === 0) {
      const targets = enemies.filter(
        (e) => e.x > s.x - 30 && e.x < s.x + w * 0.65,
      );
      targets.forEach((e) => burst(e.x, e.y, "#aa855e", 24));
      enemies = enemies.filter((e) => !targets.includes(e));
      s.score += targets.length * 40;
      for (let j = 0; j < 7; j++)
        drops.push({
          x: s.x + j * w * 0.08,
          y: -random(20, 150),
          vy: random(370, 510),
          angle: random(-0.5, 0.5),
        });
      toast(
        targets.length
          ? `天降正义！${targets.length} 位追兵当场申请调岗 +${targets.length * 40}`
          : "天降正义！空气无辜，但空气不说。",
      );
      radio("报告！这不是演习！是有机物袭击！");
      beep(190, "triangle");
    } else if (i === 1) {
      s.dash = 2;
      toast("尾气检测：不合格。起飞速度：很合格。");
      radio("他没有加油，他加的是昨天的红薯！");
      beep(95, "sawtooth");
    } else {
      s.shield = 5;
      toast("脸皮厚度 +999，保护 5 秒。只要我不尴尬…");
      radio("目标的脸皮突破了我们的检测上限。");
      beep(730);
    }
    hud();
  }
  function update(dt) {
    if (s.mode === "ready") {
      s.time += dt;
      return;
    }
    if (s.mode !== "running") return;
    s.time += dt;
    if (s.gesture && performance.now() - gestureSeen > 650) s.gesture = false;
    const flying = isFlying();
    $("flyBtn").classList.toggle("held", flying);
    s.vy += (flying ? -680 : 490) * dt;
    s.vy = clamp(s.vy, -215, 240);
    s.y += s.vy * dt;
    const horizontal =
      (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    s.x = clamp(s.x + horizontal * 170 * dt, 45, w * 0.7);
    const speed = s.dash > 0 ? 370 : 145 + s.distance * 0.025;
    s.distance = Math.min(1200, s.distance + speed * 0.15 * dt);
    s.invincible = Math.max(0, s.invincible - dt);
    s.shield = Math.max(0, s.shield - dt);
    s.dash = Math.max(0, s.dash - dt);
    s.cooldown = s.cooldown.map((c) => Math.max(0, c - dt));
    radioTime -= dt;
    radioNext -= dt;
    if (radioTime <= 0) $("radio").hidden = true;
    if (radioNext <= 0) {
      radio(radioLines[radioIndex++ % radioLines.length]);
      radioNext = 9;
    }
    if (s.y < 78 || s.y > h - 63) {
      const ceiling = s.y < 78;
      s.y = clamp(s.y, 78, h - 63);
      s.vy = ceiling ? 70 : -100;
      damage(ceiling ? "ceiling" : "ground");
      if (s.mode !== "running") return;
    }
    spawn -= dt;
    if (spawn <= 0) {
      spawn = random(1.7, 2.6);
      const ey = random(105, h - 95);
      enemies.push({ x: w + 55, y: ey, phase: random(0, 6), baseY: ey });
      const starY = clamp(ey + (ey > h * 0.5 ? -90 : 90), 90, h - 75);
      for (let i = 0; i < 3; i++)
        stars.push({ x: w + 80 + i * 42, y: starY + Math.sin(i) * 10 });
    }
    for (const e of enemies) {
      e.x -= speed * dt;
      e.y = e.baseY + Math.sin(s.time * 1.5 + e.phase) * 12;
      if (Math.abs(e.x - s.x) < 43 && Math.abs(e.y - s.y) < 33) {
        if (s.shield > 0 || s.dash > 0) {
          e.x = -100;
          burst(s.x, s.y, "#b7c8a4");
          s.score += 15;
        } else {
          damage("drone");
          e.x = -100;
        }
        if (s.mode !== "running") return;
      }
    }
    enemies = enemies.filter((e) => e.x > -70);
    for (const a of stars) {
      a.x -= speed * dt;
      if (Math.hypot(a.x - s.x, a.y - s.y) < 36) {
        s.combo++;
        s.score += 25 + Math.min(s.combo - 1, 10) * 5;
        burst(a.x, a.y, "#e1b75f", 8);
        a.collected = true;
        beep(600 + Math.min(s.combo, 10) * 40);
        if (s.combo === 5) toast("五星好评！一颗冉冉升起的屎界新星。");
      } else if (a.x < 0 && !a.collected) {
        s.combo = 0;
        a.collected = true;
      }
    }
    stars = stars.filter((a) => !a.collected);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const d of drops) {
      d.y += d.vy * dt;
      d.angle += dt;
    }
    drops = drops.filter((d) => d.y < h + 40);
    if (s.dash > 0 && Math.random() < 0.6)
      burst(s.x - 30, s.y + 10, "#c0c68c", 2);
    if (s.distance >= 1200) finish(true);
    hud();
  }
  function loop(t) {
    const dt = Math.min((t - last) / 1000 || 0, 0.035);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  hud();
  $("startBtn").addEventListener("click", () =>
    s.mode === "paused" ? pause() : start(),
  );
  $("restartBtn").addEventListener("click", start);
  $("pauseBtn").addEventListener("click", pause);
  skillButtons.forEach((b, i) =>
    b.addEventListener("click", () => useSkill(i)),
  );
  const inputCodes = [
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
  ];
  window.addEventListener("keydown", (e) => {
    if ($("helpDialog").open) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (inputCodes.includes(e.code)) {
      e.preventDefault();
      if (s.mode === "running") keys.add(e.code);
    }
    if (e.repeat) return;
    if (e.code === "Enter" && s.mode === "ready" && e.target === document.body)
      start();
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      pause();
    }
    if (/^Digit[123]$/.test(e.code)) useSkill(Number(e.code.at(-1)) - 1);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  function pointerDown(e) {
    if (s.mode !== "running") return;
    e.preventDefault();
    s.pointer = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerUp() {
    s.pointer = false;
    $("flyBtn").classList.remove("held");
  }
  [$("flyBtn"), canvas].forEach((el) => {
    el.addEventListener("pointerdown", pointerDown);
    el.addEventListener("pointerup", pointerUp);
    el.addEventListener("pointercancel", pointerUp);
    el.addEventListener("lostpointercapture", pointerUp);
  });
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
    if (!s.muted) beep();
  });
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
            : "双手放下 · 自然下降"
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
