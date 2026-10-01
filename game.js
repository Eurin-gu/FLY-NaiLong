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
    rings: 0,
    best: 0,
    muted: true,
    pointer: false,
    gesture: false,
    flapUntil: 0,
    steer: 0,
    camera: false,
    chase: null,
    chaseCooldown: 0,
    groundTime: 0,
    spawnProtection: 0,
  };
  if (matchMedia("(max-width: 760px)").matches) {
    $("cameraBtn").textContent = "开启体感";
  }
  let world,
    objects = [],
    last = 0,
    nextGate = 160,
    nextRadio = 7,
    radioTime = 0,
    radioIndex = 0,
    recordTime = 0,
    toastTimer,
    hitTimer,
    audio,
    pose = null,
    stream = null,
    cameraGeneration = 0,
    poseScript = null,
    gestureSeen = 0;
  let previousHands = null,
    gestureArmed = false,
    lastGestureFlap = -1000,
    neutralTilt = 0,
    currentTilt = 0;
  // 体感技能手势：定型动作要"摆住"一段时间才触发，并有重触发间隔。
  const poseHold = { shield: 0, roll: 0, clear: 0 };
  const poseFired = { shield: -1e9, roll: -1e9, clear: -1e9 };
  let lastPoseAt = 0;
  let poseNoticeUntil = 0;
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
    // 闪电时打一声低沉的雷
    world.onLightning = () => beep(64);
    // 一局之内换天气时提示一下
    world.onWeatherChange = (preset) => toast("天气变了 · " + preset.label);
    // 调试/自检用的小钩子：读当前天气与闪电强度
    window.__nailong = () => ({
      weather: world.weatherLabel,
      flash: Number((world.flash || 0).toFixed(3)),
      rain: world.weather ? Number(world.weather.rain.toFixed(2)) : 0,
      hold: Number((world.weatherHold || 0).toFixed(1)),
      step: world.weatherStep,
      queue: world.weatherQueue.length,
      mode: s.mode,
      calibrating: Boolean(s.calibrating),
    });
  } catch (error) {
    console.error("3D 初始化失败", error);
    const missingEngine = typeof THREE === "undefined" || typeof FlightWorld === "undefined";
    const graphicsError = /webgl|context|gpu/i.test(String(error.message));
    $("renderErrorTitle").textContent = missingEngine ? "游戏资源未加载完整" : graphicsError ? "浏览器无法启动 3D 画面" : "游戏启动遇到了错误";
    $("renderErrorMessage").textContent = missingEngine
      ? "3D 引擎文件没有加载成功，请检查网络并刷新。若持续出现，请联系游戏发布者检查资源文件。"
      : graphicsError ? "请关闭多余的游戏标签后重试；仍无法启动时，可启用硬件加速或使用新版 Edge / Chrome。"
      : "请刷新后重试。错误信息：" + String(error.message);
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
    $("renderErrorTitle").textContent = "3D 画面暂时中断";
    $("renderErrorMessage").textContent = "显卡资源可能不足，请关闭多余的游戏标签，再重新加载。";
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
  // ---- 新手教程：只给第一次进游戏的人看，跟着动作自动推进 ----
  const TUTORIAL_KEY = "nailong-tutorial-v2-done";
  let tutorialSeen = false;
  try {
    tutorialSeen = localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {}
  let tutorialStep = -1;
  let practiceX = 0;
  const tutorialSteps = [
    { text: "扇动双臂，让奶龙飞起来 ↑", done: () => s.altitude > 40 },
    { text: "身体往左歪一下 ←", done: () => s.x < practiceX - 10 },
    { text: "再往右歪一下 →", done: () => s.x > practiceX + 10 },
    { text: "对准金色光环，穿过去！", done: () => s.rings > 0 },
  ];
  function endTutorial() {
    tutorialSeen = true;
    tutorialStep = -1;
    document.body.classList.remove("learning");
    $("tutorial").hidden = true;
    s.spawnProtection = 3;
    try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch {}
  }
  function startTutorial() {
    if (tutorialSeen) return;
    const mobile = matchMedia("(max-width: 760px)").matches;
    tutorialSteps[0].text = s.camera ? "扇动双臂，让奶龙飞起来 ↑" : mobile ? "按住画面，让奶龙飞起来 ↑" : "按住空格，让奶龙飞起来 ↑";
    tutorialSteps[1].text = s.camera ? "身体往左歪一下 ←" : mobile ? "按住画面，向左拖动 ←" : "按 A 或 ←，往左飞";
    tutorialSteps[2].text = s.camera ? "再往右歪一下 →" : mobile ? "按住画面，向右拖动 →" : "按 D 或 →，往右飞";
    tutorialStep = 0;
    document.body.classList.add("learning");
    $("tutorialStep").textContent = "1 / 4";
    $("tutorialText").textContent = tutorialSteps[0].text;
    $("tutorial").hidden = false;
  }
  function updateTutorial() {
    if (tutorialStep < 0 || s.mode !== "running") return;
    if (!tutorialSteps[tutorialStep].done()) return;
    tutorialStep += 1;
    practiceX = s.x;
    if (tutorialStep >= tutorialSteps.length) {
      endTutorial();
      toast("会飞了！！！三秒后正式出发，技能按钮已解锁。");
      return;
    }
    if (tutorialStep === 3) {
      objects.forEach((o) => world.remove(o));
      objects = [];
      nextGate = s.distance;
    }
    $("tutorialStep").textContent = String(tutorialStep + 1) + " / 4";
    $("tutorialText").textContent = tutorialSteps[tutorialStep].text;
    beep(560);
  }
  function clearInput() {
    keys.clear();
    touch.clear();
    s.pointer = false;
    s.gesture = false;
    s.flapUntil = 0;
    s.steer = 0;
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
    $("missionText").textContent = s.rings >= 3 ? `目标达成！已穿 ${s.rings} 环` : `穿过光环 ${s.rings} / 3`;
    $("flightMission").classList.toggle("complete", s.rings >= 3);
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
      `${s.hp} / 3 点生命值`,
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
      const left = Math.max(0, s.cooldown[i]);
      b.disabled = s.mode !== "running" || left > 0;
      b.querySelector(".skill-key").textContent =
        left > 0 ? Math.ceil(left) + "s" : i + 1;
      // 冷却进度写进 CSS 变量，手机端用它画扇形扫除：1 = 刚放完，0 = 已就绪
      b.style.setProperty("--cd", String(cooldowns[i] ? left / cooldowns[i] : 0));
    });
    document
      .querySelectorAll("[data-flight]")
      .forEach(
        (b) => (b.disabled = s.mode === "running" || s.mode === "paused"),
      );
    $("flyBtn").classList.toggle("held", s.mode === "running" && s.thrust > 0);
    const rollLeft = Math.max(0, s.rollCooldown);
    $("rollBtn").disabled = s.mode !== "running" || rollLeft > 0;
    $("rollBtn").querySelector(".skill-key").textContent =
      rollLeft > 0 ? Math.ceil(rollLeft) + "s" : "E";
    $("rollBtn").style.setProperty("--cd", String(rollLeft / 4));
    updateTutorial();
    $("stage").classList.toggle("boosting", s.mode === "running" && s.dash > 0);
    $("stage").classList.toggle(
      "celebrating",
      s.mode === "running" && s.celebration > 0,
    );
  }
  function start() {
    if (!world || !cameraAvailable) return;
    overlayStep = "done";
    saveRecord();
    clearInput();
    objects.forEach((o) => world.remove(o));
    objects = [];
    Object.assign(s, {
      mode: "running",
      calibrating: false,
      menuPreview: false,
      rings: 0,
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
      spawnProtection: tutorialSeen ? 10 : 30,
      shield: 0,
      dash: 0,
      roll: 0,
      rollCooldown: 0,
      celebration: 0,
      altitudeBadge: 0,
      cooldown: [0, 0, 0],
      combo: 0,
      thrust: 0,
      chase: null,
      chaseCooldown: 2.5,
      groundTime: 0,
    });
    $("chase").hidden = true;
    setChaseFlash(false);
    nextGate = 160;
    nextRadio = 7;
    radioTime = 0;
    radioIndex = 0;
    world.reset();
    // 每一局都从晴空开始，之后按 晴 → 雷雨 → 彩虹 → 落日 → 星夜 → 飘雪 推进
    world.startWeatherRun();
    $("gameOverlay").hidden = true;
    $("radio").hidden = true;
    $("pauseBtn").disabled = false;
    $("pauseBtn").textContent = "Ⅱ";
    $("pauseBtn").setAttribute("aria-label", "暂停游戏");
    document.body.classList.add("playing");
    document.body.dataset.screen = "playing";
    $("flightMission").hidden = false;
    document.body.classList.remove("preflight");
    document.body.classList.remove("choosing-mode");
    $("startBtn").blur();
    toast(matchMedia("(max-width: 760px)").matches && !s.camera
      ? "按住画面上升，左右拖动转向。"
      : "开局保护 10 秒，扇翅起飞！");
    startTutorial();
    hud();
    beep(300);
  }
  // 开局分两步：先「开始游戏」，再选飞行方式，最后「一键起飞」。
  // 结算 / 暂停复用同一个浮层，所以 overlay() 会把模式选择收起来。
  let overlayStep = "intro";
  document.body.dataset.screen = "intro";
  document.body.classList.add("preflight");
  let setupControl = "camera";
  let poseReady = false;
  const calibration = { step: 0, flaps: 0, since: 0, hold: 0, last: 0 };
  $("manualStart").addEventListener("click", () => {
    launching = false;
    stopCamera();
    setupControl = "manual";
    s.calibrating = false;
    s.flight = "free";
    $("startBtn").disabled = false;
    start();
  });
  async function beginCalibration() {
    if (launching) return;
    launching = true;
    setupControl = "camera";
    s.flight = "free";
    overlayStep = "calibration";
    s.calibrating = true;
    document.body.dataset.screen = "calibration";
    $("overlayModes").hidden = true;
    $("overlayTag").textContent = "起飞前 · 跟着做";
    $("overlayTitle").textContent = "跟我扇两下翅膀";
    $("overlayDescription").textContent = "双手抬起，再放下。识别到动作就会亮灯。";
    $("startBtn").disabled = true;
    $("startBtn").textContent = "等待你的动作…";
    $("setupCameraView").hidden = false;
    Object.assign(calibration, { step: 0, flaps: 0, since: 0, hold: 0, last: 0 });
    const ready = await enableCamera();
    launching = false;
    if (overlayStep !== "calibration") return;
    if (!ready) {
      $("overlayTitle").textContent = "先用手指飞一圈";
      $("overlayDescription").textContent = "摄像头未能连接。可以直接使用触屏或键盘试玩。";
      $("startBtn").disabled = false;
      $("startBtn").textContent = "重新开启摄像头";
      overlayStep = "intro";
    }
  }
  function updateCalibration(now, framed) {
    if (overlayStep !== "calibration") return;
    const delta = calibration.last ? Math.min(now - calibration.last, 150) : 0;
    calibration.last = now;
    if (!framed) { calibration.hold = 0; calibration.since = 0; return; }
    if (calibration.step === 0 && calibration.flaps >= 2) {
      calibration.step = 1;
      neutralTilt = currentTilt;
      $("overlayTitle").textContent = "会飞了！往左歪一下";
      $("overlayDescription").textContent = "肩膀轻轻往左倾，保持一小会儿。";
      $("guideDemo").dataset.demo = "steer";
      beep(660);
    } else if (calibration.step === 1 || calibration.step === 2) {
      const correct = calibration.step === 1 ? s.steer < -0.25 : s.steer > 0.25;
      calibration.hold = correct ? calibration.hold + delta : 0;
      if (calibration.hold > 450) {
        calibration.step += 1;
        calibration.hold = 0;
        $("overlayTitle").textContent = calibration.step === 2 ? "再往右歪一下" : "完美，准备出发！";
        $("overlayDescription").textContent = calibration.step === 2 ? "肩膀往右倾，奶龙就往右飞。" : "接下来放心练习，先学会飞，再遇到敌人。";
        beep(760);
      }
    } else if (calibration.step === 3) {
      calibration.since ||= now;
      const left = 3 - Math.floor((now - calibration.since) / 1000);
      $("startBtn").textContent = left > 0 ? String(left) + " · 准备起飞" : "起飞！";
      if (left <= 0) { overlayStep = "done"; start(); }
    }
    $("guideStatus").textContent = calibration.step === 0 ? "扇翅 " + Math.min(2, calibration.flaps) + " / 2" : calibration.step === 1 ? "左倾 ←" : calibration.step === 2 ? "右倾 →" : "动作完成 ✓";
  }
  function syncSetupControl() {
    $("setupManual").setAttribute("aria-pressed", String(setupControl === "manual"));
    $("setupCamera").setAttribute("aria-pressed", String(setupControl === "camera"));
    $("setupControlHint").textContent = setupControl === "camera"
      ? (poseReady ? "体感已就绪。双臂完整入镜，连续上下扇动。" : s.camera ? "摄像头已连接，正在确认动作识别…" : "选中后开启摄像头；让肩膀和双手都进入画面。")
      : (matchMedia("(max-width: 760px)").matches ? "按住画面上升，左右拖动转向。" : "按空格反复扇翅，A / D 转向。按下更快地升高。")
  }
  function showModeStep() {
    $("changeModeBtn").hidden = true;
    $("resultGoal").hidden = true;
    s.menuPreview = true;
    s.calibrating = false;
    document.body.dataset.screen = "setup";
    $("setupBack").hidden = false;
    $("resultStats").hidden = true;
    overlayStep = "modes";
    s.flight = null;
    document.body.classList.add("choosing-mode");
    document.body.classList.add("preflight");
    $("overlayTag").textContent = "02 / 选择玩法";
    $("overlayTitle").textContent = "今天怎么飞？";
    $("overlayDescription").textContent = "选好模式，马上起飞。";
    $("overlayModes").hidden = false;
    syncSetupControl();
    $("overlayModeNote").textContent = "选一个玩法，再起飞。";
    document.querySelectorAll("[data-flight]").forEach((button) => {
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    });
    $("startBtn").disabled = true;
    $("startBtn").innerHTML = "选择玩法 <span aria-hidden=\"true\">↗</span>";
    beep(660);
  }
  function overlay(tag, title, description, label) {
    $("changeModeBtn").hidden = true;
    $("resultGoal").hidden = true;
    clearTimeout(toastTimer);
    $("toast").classList.remove("show");
    document.body.dataset.screen = s.mode === "paused" ? "paused" : "result";
    $("setupBack").hidden = true;
    $("resultStats").hidden = true;
    $("flightMission").hidden = true;
    overlayStep = "done";
    document.body.classList.remove("choosing-mode");
    document.body.classList.remove("preflight");
    $("overlayModes").hidden = true;
    $("startBtn").disabled = false;
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
      setChaseFlash(false);
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
      document.body.dataset.screen = "playing";
      $("flightMission").hidden = false;
      s.mode = "running";
      $("gameOverlay").hidden = true;
      $("pauseBtn").textContent = "Ⅱ";
      $("pauseBtn").setAttribute("aria-label", "暂停游戏");
    }
    hud();
  }
  function finish(win) {
    setupControl = s.camera ? "camera" : "manual";
    s.mode = "ended";
    clearInput();
    $("tutorial").hidden = true;
    tutorialStep = -1;
    saveRecord();
    if (win) s.score += 500;
    overlay(
      win ? "挑战完成" : "本局战绩",
      win ? "奶龙上岸！<br>尾气留名。" : "被抓住了！",
      `飞行 ${Math.floor(s.distance)} m · 最高纪录 ${s.best} m · 得分 ${s.score}`,
      "再喷一趟",
    );
    if (win) s.chase = null;
    $("overlayDescription").textContent = win ? "这回，天空记住你了。" : "人被抓了，纪录留下了。";
    $("resultStats").innerHTML = `<div><strong>${s.score}</strong><span>本局得分</span></div><div><strong>${Math.floor(s.peak)}<small>m</small></strong><span>最高飞行</span></div><div><strong>${s.rings}</strong><span>穿过光环</span></div>`;
    $("resultStats").hidden = false;
    $("changeModeBtn").hidden = false;
    $("resultGoal").hidden = false;
    $("resultGoal").textContent = s.rings >= 3
      ? "✓ 三环目标达成 · 奖励 300 分已计入战绩"
      : `还差 ${3 - s.rings} 个光环，下一趟把 300 分带走。`;
    s.groundTime = 0;
    $("chase").hidden = true;
    $("groundWarning").hidden = true;
    setChaseFlash(false);
    $("pauseBtn").disabled = true;
    document.body.classList.remove("playing");
    stopCamera();
    hud();
  }
  // Returns true when the hit actually landed. Shields, dashes, rolls and the
  // short grace window after a previous hit all make 奶龙 immune.
  function damage(message) {
    if (s.spawnProtection > 0 || s.invincible > 0 || s.dash > 0 || s.shield > 0 || s.roll > 0)
      return false;
    s.hp--;
    s.invincible = 2.3;
    s.combo = 0;
    world.burst(s.x, s.altitude, 0, s.fuel, 25);
    beep(90);
    // Make the hit impossible to miss: a short red vignette + heart pulse.
    $("hitFlash").classList.add("on");
    $("healthText").classList.add("hit");
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => {
      $("hitFlash").classList.remove("on");
      $("healthText").classList.remove("hit");
    }, 280);
    if (s.hp <= 0) startChase("health");
    else toast(message || `撞到巡逻无人机！生命 -1，剩余 ${s.hp} / 3。`);
    hud();
    return true;
  }
  // 交警在场时全场红灯。只在状态真正变化时碰 DOM，避免每帧写 classList。
  let chaseFlashOn = false;
  function setChaseFlash(on) {
    if (on === chaseFlashOn) return;
    chaseFlashOn = on;
    $("chaseFlash").classList.toggle("on", on);
  }
  // ---- 交警追捕 ----
  // The ground and the rooftops are traps: touching either one puts a traffic
  // officer on your tail. Getting caught is what costs a heart, so the health
  // system is something the player can see coming and dodge.
  function startChase(reason) {
    if (s.mode !== "running" || s.chase || s.spawnProtection > 0) return false;
    s.chase = { d: s.distance - 14, x: s.x, y: s.altitude, t: 0, reason };
    if (reason !== "ground") {
      clearInput();
      s.vx = s.vy = s.speed = s.thrust = 0;
      s.shield = s.dash = s.roll = 0;
    }
    s.groundTime = 0;
    $("groundWarning").hidden = true;
    $("chase").hidden = false;
    beep(180);
    toast(
      reason === "building"
        ? "🚨 撞上楼体！交警正在靠近，准备接受检查。"
        : reason === "health" ? "🚨 生命耗尽！交警正在将你带离空域。" : "🚨 交警来了！继续扇翅，升到 25 米就能逃脱！",
    );
    return true;
  }
  function endChase(caught) {
    if (!s.chase) return;
    if (!caught) {
      s.chase = null;
      s.groundTime = 0;
      $("chase").hidden = true;
      toast("成功逃脱！交警：下次落地记得打转向灯！");
      return;
    }
    s.hp = 0;
    s.chase.caught = true;
    finish(false);
  }
  function updateChase(dt) {
    setChaseFlash(Boolean(s.chase) && s.mode === "running");
    if (s.chaseCooldown > 0) s.chaseCooldown = Math.max(0, s.chaseCooldown - dt);
    const c = s.chase;
    if (!c || s.mode !== "running") {
      $("chase").hidden = true;
      return;
    }
    c.t += dt;
    // He trails the player's line of flight with a little lag so the catch
    // reads as a chase rather than a teleport.
    c.x += (s.x - c.x) * Math.min(1, dt * 1.6);
    if (c.reason !== "ground") c.y += (s.altitude - c.y) * Math.min(1, dt * 1.8);
    if (c.reason === "ground" && s.altitude >= 25) { endChase(false); return; }
    // Ease into the run, brake before contact, then let the reach animation finish.
    const approach = Math.min(1, c.t / (c.reason === "ground" ? 3 : 1.7));
    const eased = approach * approach * (3 - 2 * approach);
    c.d = s.distance - (14 - 11 * eased);
    const gap = s.distance - c.d;
    if (c.t >= (c.reason === "ground" ? 3.5 : 2.2) && (c.reason !== "ground" || s.altitude <= 10)) {
      endChase(true);
      return;
    }
    $("chaseBar").style.width = `${Math.min(100, c.t / 2.2 * 100)}%`;
    $("chaseText").textContent =
      c.reason === "ground" ? `快扇翅！升到 25 米逃脱 · 当前 ${Math.floor(s.altitude)} 米` : gap > 10 ? "交警正在从后方追近" : gap > 4 ? "请停止飞行，接受检查！" : "已被抓获";
  }
  function useSkill(i) {
    if (s.mode !== "running" || s.chase || s.cooldown[i] > 0) return;
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
        (right ? 1 : 0) -
          (left ? 1 : 0) +
          (s.pointer ? drag.axisX : 0) +
          (s.camera && performance.now() - gestureSeen < 350 ? s.steer : 0),
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
    if (s.mode !== "running" || s.chase || s.rollCooldown > 0) return;
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
  // A free-falling dragon covers a lot of ground per frame, so the whole
  // movement segment is sampled rather than just its end point.
  function sweptBuildingHit(from, to) {
    const span =
      Math.abs(to.x - from.x) +
      Math.abs(to.y - from.y) +
      Math.abs(to.d - from.d);
    const steps = Math.min(8, Math.max(1, Math.ceil(span / 5)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (
        world.buildingHit(
          from.x + (to.x - from.x) * t,
          from.y + (to.y - from.y) * t,
          from.d + (to.d - from.d) * t,
        )
      )
        return true;
    }
    return false;
  }
  function spawnTargets() {
    const d = s.distance + 240;
    const targetY = Math.max(18, s.altitude + s.vy * 1.8 + 18);
    const targetX = tutorialStep >= 0 ? s.x : s.x + Math.sin(s.distance * 0.002) * 18;
    const ring = world.addRing({ type: "ring", x: targetX, y: targetY, d });
    if (tutorialStep >= 0) ring.mesh.scale.setScalar(2);
    objects.push(ring);
    if (tutorialStep < 0) for (let i = 0; i < 3; i++)
      objects.push(world.addBird({type: "bird", x: targetX + (i-1)*12,
        y: Math.max(10,targetY + (i%2 ? 8 : -8)), d: d+28+i*22}));
    if (tutorialStep < 0) for (let i = 0; i < 2; i++)
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
    if (s.mode === "ready" || s.menuPreview) {
      s.time += dt;
      return;
    }
    if (s.mode !== "running") return;
    s.time += dt;
    if (tutorialStep >= 0) s.spawnProtection = 30;
    const protectedFrame = s.spawnProtection > 0;
    s.spawnProtection = Math.max(0, s.spawnProtection - dt);
    if (s.chase && s.chase.reason !== "ground") { updateChase(dt); hud(); return; }
    s.gesture =
      s.camera &&
      performance.now() < s.flapUntil &&
      performance.now() - gestureSeen < 500;
    const control = input();
    const before = { x: s.x, y: s.altitude, d: s.distance };
    s.thrust = control.y;
    const maxRise = s.dash > 0 ? 65 : 40;
    // Lift exists only during wingbeats. Releasing preserves velocity; gravity then reverses it.
    const lift =
      Math.max(0, control.y) *
      (s.dash > 0 ? 210 : 145) *
      (0.82 + 0.18 * Math.cos(s.time * 14));
    // Honest free fall: a constant downward acceleration with no drag and no
    // terminal velocity, so v = v0 + g·t exactly. Only the *ascent* is capped,
    // which is what keeps a held wingbeat flyable. The weakest wingbeat still
    // out-pulls gravity, so holding flap always climbs.
    const diving = control.y < 0;
    // Six-times Earth gravity gives the fast ascent a matching, accelerating fall.
    const gravity = 9.81 * 6 + (diving ? -control.y * 40 : 0);
    const previousVy = s.vy;
    s.vy += (lift - gravity) * dt;
    if (s.vy > maxRise) s.vy = maxRise;
    const targetVx = control.x * 65;
    if (control.x === 0) s.vx *= Math.exp(-13 * dt);
    else s.vx += clamp(targetVx - s.vx, -170 * dt, 170 * dt);
    if (Math.abs(s.vx) < 0.05) s.vx = 0;
    s.altitude += (previousVy + s.vy) * 0.5 * dt;
    s.peak = Math.max(s.peak, s.altitude);
    s.x += s.vx * dt;
    // Altitude is world space: there is deliberately no upper clamp.
    if (s.altitude < 4) {
      s.altitude = 4;
      s.vy = 0;
      // Touching down, or loitering on the deck, gets the traffic officer
      // airborne. It is the chase — not a flat -1 — that costs the heart.
    }
    // Rooftops are traps too.
    if (
      s.mode === "running" &&
      sweptBuildingHit(before, { x: s.x, y: s.altitude, d: s.distance + s.speed * dt })
    ) {
      startChase("building");
    }
    if (s.chase && s.chase.reason !== "ground") { hud(); return; }
    if (s.mode !== "running") return;
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
        if (Math.hypot(crossX - o.x, crossY - o.y) < (tutorialStep >= 0 ? 14.4 : 7.2)) {
          s.combo++;
          s.rings++;
          s.celebration = 0.7;
          s.score += 100 + Math.min(s.combo - 1, 6) * 20;
          if (s.rings === 3) s.score += 300;
          world.burst(o.x, o.y, 0, "rainbow", 30);
          toast(
            s.rings === 3 ? "三环达成！额外 +300 分，奶龙申请加餐！" : s.combo > 1
              ? `光环连穿 ×${s.combo}！+${100 + Math.min(s.combo-1,6)*20} 分！`
              : "穿过光环 +100！奶龙：这圈怎么不能吃？",
          );
          beep(650);
          o.collected = true;
        } else s.combo = 0;
      }
      if (o.type === "bird" && !o.collected &&
        sweptDroneHit(before,{x:s.x,y:s.altitude,d:s.distance},o)) {
        o.collected = true;
        if (s.spawnProtection > 0 || s.shield > 0 || s.dash > 0 || s.roll > 0) {
          toast("成功避开飞鸟，分数保住了！");
        } else {
          s.score -= 50;
          s.combo = 0;
          toast("撞到飞鸟 -50！鸟：你考过飞行驾照吗？！");
          beep(120);
          world.burst(o.x,o.y,s.distance-o.d,"rainbow",10);
        }
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
        if (s.mode !== "running" || s.chase) break;
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
    // Loitering on the deck is just as illegal as crashing into it.
    if (!protectedFrame && !s.chase && s.altitude <= 4.5) {
      s.groundTime += dt;
      if (s.groundTime >= 3) startChase("ground");
    } else if (!s.chase) s.groundTime = 0;
    updateChase(dt);
    if (!s.chase && s.mode === "running") {
      const warning = s.groundTime > 0;
      $("chase").hidden = !(s.spawnProtection > 0 || warning);
      if (s.spawnProtection > 0) {
        $("chaseText").textContent = `${tutorialStep >= 0 ? "练习中 · 不会掉血，放心试" : "起飞保护 " + Math.ceil(s.spawnProtection) + " 秒"}`;
        $("chaseBar").style.width = `${s.spawnProtection * 10}%`;
      } else if (warning) {
        const seconds = Math.max(1, Math.ceil(3 - s.groundTime));
        $("chaseText").textContent = `触地警告！${seconds} 秒后交警出现，快起飞！`;
        $("chaseBar").style.width = `${s.groundTime / 3 * 100}%`;
        $("groundWarning").hidden = false;
        $("groundWarningCount").textContent = seconds;
      }
    } else {
      $("groundWarning").hidden = true;
    }
    if (s.mode !== "running") return;
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
  let launching = false;
  $("changeModeBtn").addEventListener("click", () => {
    if (!launching) showModeStep();
  });
  let greetingIndex = 0;
  $("dragonHello").addEventListener("click", () => {
    s.greetUntil = s.time + 1.8;
    const lines = ["先说好，别问动力来源。", "看我这身材，续航能差吗？", "翅膀你来扇，风头我来出。", "交警叔叔今天应该休息吧？"];
    $("dragonSpeech").textContent = lines[greetingIndex++ % lines.length];
    beep(520);
  });
  $("setupBack").addEventListener("click", () => {
    stopCamera();
    overlayStep = "intro";
    s.mode = "ready";
    s.menuPreview = false;
    s.x = 0;
    s.altitude = 18;
    s.vy = 0;
    s.vx = 0;
    document.body.dataset.screen = "intro";
    document.body.classList.remove("choosing-mode");
    $("overlayModes").hidden = true;
    $("setupBack").hidden = true;
    $("overlayTag").textContent = "今日宜：一飞冲天";
    $("overlayTitle").innerHTML = "举起双手，<br />一起飞。";
    $("overlayDescription").innerHTML = "你负责扇，我负责飞。<br />至于怎么飞的……别问。";
    $("startBtn").disabled = false;
    $("startBtn").innerHTML = "开启摄像头 <span aria-hidden=\"true\">↗</span>";
  });
  $("startBtn").addEventListener("click", async () => {
    if (s.mode === "paused") {
      pause();
      return;
    }
    // 开局第一步是摄像头校准；校准走完才会进入选玩法。
    if (overlayStep === "intro") {
      await beginCalibration();
      return;
    }
    if (overlayStep === "calibration") return;
    // A replay keeps the last flight and control choices; changing them is a
    // separate action on the result card.
    if (!s.flight || launching) return;
    launching = true;
    $("startBtn").disabled = true;
    $("changeModeBtn").disabled = true;
    if (setupControl === "camera" && !s.camera) {
      const ready = await enableCamera();
      if (!ready) {
        setupControl = "manual";
        if (overlayStep === "done") showModeStep();
        syncSetupControl();
        $("setupControlHint").textContent = "摄像头未就绪。已切到键盘 / 触屏，确认后再开始飞行。";
        launching = false;
        $("changeModeBtn").disabled = false;
        $("startBtn").disabled = !s.flight;
        return;
      }
    }
    launching = false;
    $("changeModeBtn").disabled = false;
    $("startBtn").disabled = false;
    start();
  });
  $("rollBtn").addEventListener("click", barrelRoll);
  $("tutorialSkip").addEventListener("click", endTutorial);
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
      const modeNote =
        s.flight === "free"
          ? "无限航程 · 体面自动恢复 · 撞地或撞楼会被抓。"
          : "挑战 6 km · 三颗心 · 善用护盾和冲刺。";
      $("flightModeHint").textContent = modeNote;
      $("overlayModeNote").textContent =
        s.flight === "free" ? "没有终点，刷新自己的最高纪录。" : "飞满 6 公里，就算赢。";
      $("startBtn").disabled = false;
      $("startBtn").innerHTML = "开始飞行 <span aria-hidden=\"true\">↗</span>";
    }),
  );
  $("setupManual").addEventListener("click", () => {
    setupControl = "manual";
    stopCamera();
    syncSetupControl();
  });
  $("setupCamera").addEventListener("click", async () => {
    setupControl = "camera";
    syncSetupControl();
    $("setupCamera").disabled = true;
    const ready = await enableCamera();
    $("setupCamera").disabled = false;
    if (!ready) setupControl = "manual";
    syncSetupControl();
  });
  const guideCopy = {
    flap: "双臂上下反复扇动，每扇一次就补一点升力。扇得越勤，飞得越稳。",
    steer: "肩膀和身体一起向左或向右倾斜，奶龙就会跟着偏航。",
    fall: "双臂停下，升力消失；奶龙会按重力加速下坠。快继续扇动！",
  };
  document.querySelectorAll("[data-guide]").forEach((button) => button.addEventListener("click", () => {
    const demo = button.dataset.guide;
    $("guideDemo").dataset.demo = demo;
    $("guideDemo").querySelector("svg").setAttribute("aria-label", {
      flap: "火柴人示范双臂反复上下扇动",
      steer: "火柴人示范身体左右倾斜",
      fall: "火柴人示范停扇后加速下坠",
    }[demo]);
    $("guideExplain").textContent = guideCopy[demo];
    document.querySelectorAll("[data-guide]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
  }));
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
    if (e.code === "KeyT") toast("天气切换 · " + world.cycleWeather().label);
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
    poseReady = false;
    $("poseLive").hidden = true;
    s.camera = false;
    s.gesture = false;
    s.flapUntil = 0;
    s.steer = 0;
    previousHands = null;
    gestureArmed = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    $("cameraPreview").srcObject = null;
    $("setupCameraPreview").srcObject = null;
    $("setupCameraView").hidden = true;
    $("setupCameraView").dataset.poseReady = "false";
    $("setupCameraView").classList.remove("pose-found");
    $("setupCameraFeedback").textContent = "让肩膀和双手入镜";
    $("guideStatus").textContent = "HOW TO FLY";
    $("guideStatus").classList.remove("ready");
    $("cameraView").hidden = true;
    $("cameraBtn").disabled = false;
    $("cameraBtn").classList.remove("selected");
    $("keyboardBtn").classList.add("selected");
    $("keyboardBtn").setAttribute("aria-pressed", "true");
    $("cameraBtn").setAttribute("aria-pressed", "false");
    if (matchMedia("(max-width: 760px)").matches) $("cameraBtn").textContent = "开启体感";
    $("modeText").textContent = "键盘模式";
    $("steerReadout").textContent = "左倾向左 · 右倾向右";
    $("steerDot").style.left = "50%";
    if (pose) {
      pose.close().catch(() => {});
      pose = null;
    }
  }
  // ---- 体感技能手势 ----
  // 和"扇动"不同，这些是"摆住一个造型"：
  //   双手交叉抱胸   → 脸皮护盾
  //   单臂高举过顶   → 奶龙打滚（奥特曼 / 上课举手）
  //   双臂向两侧张开 → 全场洗礼
  // 去抖：造型保持 0.3 秒才触发，同一个造型 1.1 秒内不重复触发。
  function detectSkillPose(lm, width, now) {
    const ok = (i) => lm && lm[i] && lm[i].visibility > 0.4;
    const dt = lastPoseAt ? Math.min(200, now - lastPoseAt) : 33;
    lastPoseAt = now;
    if (!ok(11) || !ok(12) || !ok(15) || !ok(16)) {
      poseHold.shield = poseHold.roll = poseHold.clear = 0;
      return null;
    }
    const shoulderY = (lm[11].y + lm[12].y) / 2;
    const hipY =
      ok(23) && ok(24) ? (lm[23].y + lm[24].y) / 2 : shoulderY + width * 1.25;
    const headY = ok(0) ? lm[0].y : shoulderY - width * 0.95;
    const wl = lm[15],
      wr = lm[16];
    const wristSpan = Math.abs(wl.x - wr.x);
    const wristGap = Math.hypot(wl.x - wr.x, wl.y - wr.y);
    const elbowSpan = ok(13) && ok(14) ? Math.abs(lm[13].x - lm[14].x) : 0;
    const chestLow = shoulderY + (hipY - shoulderY) * 0.95;
    const atChest = (p) => p.y > shoulderY - width * 0.2 && p.y < chestLow;
    const poses = {
      // 双手交叉：手腕贴在一起、落在胸口高度、肘部比手腕张得更开（X 形）。
      shield:
        wristGap < width * 0.6 &&
        atChest(wl) &&
        atChest(wr) &&
        elbowSpan > width * 1.0,
      // 单臂高举过顶：超过鼻子的高度。
      roll: wl.y < headY || wr.y < headY,
      // 双臂向两侧张开：横向跨度远大于肩宽，且大致停在肩高。
      clear:
        wristSpan > width * 2.4 &&
        Math.abs(wl.y - shoulderY) < width * 0.95 &&
        Math.abs(wr.y - shoulderY) < width * 0.95,
    };
    let fired = null;
    for (const key of ["shield", "roll", "clear"]) {
      poseHold[key] = poses[key] ? poseHold[key] + dt : 0;
      if (poseHold[key] >= 300 && now - poseFired[key] >= 1100) {
        poseFired[key] = now;
        poseHold[key] = 0;
        fired = key;
      }
    }
    return fired;
  }
  function trackFlap(lm, now) {
    const overlay = $("poseOverlay"),
      ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const seen = (i) => lm && lm[i] && lm[i].visibility > 0.4;
    if (!seen(11) || !seen(12)) {
      previousHands = null;
      s.steer = 0;
      s.gesture = false;
      s.flapUntil = 0;
      $("steerReadout").textContent = "等待肩膀进入画面";
      return "请退后一点，让肩膀和双臂进入画面";
    }
    gestureSeen = now;
    const width = Math.max(0.12, Math.abs(lm[11].x - lm[12].x));
    currentTilt = -(lm[11].y - lm[12].y) / (lm[11].x - lm[12].x || width);
    const tilt = currentTilt - neutralTilt;
    const target =
      Math.sign(tilt) * clamp((Math.abs(tilt) - 0.08) / 0.32, 0, 1);
    const dt = previousHands
      ? clamp((now - previousHands.time) / 1000, 0.016, 0.2)
      : 0.065;
    s.steer += (target - s.steer) * (1 - Math.exp(-dt * 12));
    $("steerReadout").textContent =
      Math.abs(s.steer) < 0.12
        ? "● 保持直飞"
        : s.steer < 0
          ? "← 左倾转向"
          : "右倾转向 →";
    $("steerDot").style.left = 50 + s.steer * 44 + "%";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffca48";
    ctx.fillStyle = "#ffffff";
    for (const [i, j] of [
      [11, 12],
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
    ])
      if (seen(i) && seen(j)) {
        ctx.beginPath();
        ctx.moveTo((1 - lm[i].x) * 320, lm[i].y * 240);
        ctx.lineTo((1 - lm[j].x) * 320, lm[j].y * 240);
        ctx.stroke();
      }
    for (const i of [11, 12, 13, 14, 15, 16])
      if (seen(i)) {
        ctx.beginPath();
        ctx.arc((1 - lm[i].x) * 320, lm[i].y * 240, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    // Elbows remain useful when the wrists briefly leave the frame.
    const left = seen(15) ? 15 : seen(13) ? 13 : null,
      right = seen(16) ? 16 : seen(14) ? 14 : null;
    if (left === null || right === null) {
      previousHands = null;
      s.flapUntil = 0;
      s.gesture = false;
      return "转向已就绪 · 请让双臂入镜后扇动";
    }
    // 技能造型优先于扇翅：命中时清掉扇翅累计，避免"举手"被读成"扇动"。
    const skillPose = s.mode === "running" && tutorialStep < 0 ? detectSkillPose(lm, width, now) : null;
    if (skillPose) {
      previousHands = null;
      gestureArmed = false;
      s.flapUntil = 0;
      s.gesture = false;
      const ready = (i) => s.mode === "running" && !s.chase && s.cooldown[i] <= 0;
      if (skillPose === "shield") {
        if (!ready(2)) return "脸皮护盾冷却中 · 双手交叉暂时无效";
        useSkill(2);
        return "🛡 双手交叉 → 脸皮护盾";
      }
      if (skillPose === "clear") {
        if (!ready(0)) return "全场洗礼冷却中 · 双臂张开暂时无效";
        useSkill(0);
        return "💥 双臂张开 → 全场洗礼";
      }
      if (s.mode !== "running" || s.rollCooldown > 0)
        return "奶龙打滚冷却中 · 单臂高举暂时无效";
      barrelRoll();
      return "🌀 单臂高举 → 奶龙打滚";
    }
    const kind = left + "," + right;
    const raw =
      (lm[left].y - lm[11].y + (lm[right].y - lm[12].y)) / (2 * width);
    if (
      !previousHands ||
      now - previousHands.time > 400 ||
      previousHands.kind !== kind
    ) {
      previousHands = { height: raw, time: now, peak: raw, trough: raw, kind };
      gestureArmed = raw < -0.15;
      return "上下扇动升空 · 身体左倾 / 右倾转向";
    }
    const height =
      previousHands.height +
      (raw - previousHands.height) * (1 - Math.exp(-dt * 15));
    const rate = (height - previousHands.height) / dt;
    const peak = Math.min(previousHands.peak, height),
      trough = Math.max(previousHands.trough, height);
    if (trough - height > 0.13 && rate < -0.2) gestureArmed = true;
    let fired = false;
    if (
      gestureArmed &&
      height - peak > 0.17 &&
      rate > 0.28 &&
      now - lastGestureFlap > 260
    ) {
      if (s.mode === "running") {
        s.flapUntil = now + 250;
        s.gesture = true;
        fired = true;
      }
      if (overlayStep === "calibration" && calibration.step === 0) calibration.flaps += 1;
      lastGestureFlap = now;
      gestureArmed = false;
    }
    previousHands = {
      height,
      time: now,
      peak: gestureArmed ? peak : height,
      trough: gestureArmed ? height : trough,
      kind,
    };
    return fired ? "扇到了！继续扇动才能升高" : "连续扇翅爬升 · 慢扇或停扇会下坠";
  }
  $("recenterBtn").addEventListener("click", () => {
    neutralTilt = currentTilt;
    s.steer = 0;
    previousHands = null;
    $("cameraStatus").textContent = "已校准中立姿势，左右倾斜试试看";
  });
  // Prefer the self-hosted bundle; fall back to the CDN when it is absent.
  const POSE_VERSION = "0.5.1675469404";
  const POSE_SOURCES = [
    `vendor/mediapipe/${POSE_VERSION}/`,
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}/`,
  ];
  let poseBase = POSE_SOURCES[0];
  function loadScript(src, timeoutMs) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      const timer = setTimeout(() => {
        script.remove();
        reject(Error("load timeout"));
      }, timeoutMs);
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(Error("load error"));
      };
      document.head.appendChild(script);
    });
  }
  function loadPose() {
    if (window.Pose) return Promise.resolve();
    if (poseScript) return poseScript;
    poseScript = (async () => {
      let lastError = null;
      for (const source of POSE_SOURCES) {
        try {
          await loadScript(source + "pose.js", 18000);
          if (window.Pose) {
            poseBase = source;
            return;
          }
          lastError = Error("pose.js loaded without registering Pose");
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || Error("no pose source available");
    })().catch((e) => {
      poseScript = null;
      throw e;
    });
    return poseScript;
  }
  let cameraLoadingPromise = null;
  function enableCamera() {
    if (cameraLoadingPromise) return cameraLoadingPromise;
    if (s.camera) return Promise.resolve(true);
    cameraLoadingPromise = activateCamera().finally(() => { cameraLoadingPromise = null; });
    return cameraLoadingPromise;
  }
  async function activateCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast("摄像头需要 HTTPS 或 localhost，可用触屏继续玩");
      return false;
    }
    const generation = ++cameraGeneration;
    const loader = $("poseLoader");
    const loaderBar = $("poseLoaderBar");
    const loaderText = $("poseLoaderText");
    loader.hidden = false;
    loaderBar.style.width = "8%";
    loaderText.textContent = "正在申请摄像头权限…";
    $("cameraView").hidden = false;
    $("cameraStatus").textContent = "正在申请摄像头权限…";
    $("cameraBtn").disabled = true;
    if (matchMedia("(max-width: 760px)").matches) $("cameraBtn").textContent = "加载中";
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 },
        audio: false,
      });
      if (generation !== cameraGeneration) {
        incoming.getTracks().forEach((t) => t.stop());
        return false;
      }
      stream = incoming;
      loaderBar.style.width = "28%";
      loaderText.textContent = "摄像头已连接，正在加载识别模型…";
      $("cameraPreview").srcObject = stream;
      await $("cameraPreview").play();
      $("setupCameraPreview").srcObject = stream;
      $("setupCameraView").hidden = false;
      $("setupCameraPreview").play().catch(() => {});
      $("cameraStatus").textContent = "正在加载动作识别…";
      await loadPose();
      loaderBar.style.width = "72%";
      loaderText.textContent = "正在初始化动作识别…";
      if (generation !== cameraGeneration) return false;
      const currentPose = new window.Pose({
        locateFile: (f) => poseBase + f,
      });
      pose = currentPose;
      currentPose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      let poseFirstResult = false;
      let resolveFirstResult;
      const firstResult = new Promise((resolve) => { resolveFirstResult = resolve; });
      currentPose.onResults((result) => {
        if (generation !== cameraGeneration) return;
        if (!poseFirstResult) {
          poseFirstResult = true;
          poseReady = true;
          $("setupCameraView").dataset.poseReady = "true";
          syncSetupControl();
          resolveFirstResult(true);
          loaderBar.style.width = "100%";
          loaderText.textContent = "体感已开启";
          setTimeout(() => { loader.hidden = true; }, 500);
        }
        const now = performance.now();
        const text = trackFlap(result.poseLandmarks, now);
        const landmarks = result.poseLandmarks;
        const shoulderSeen = landmarks?.[11]?.visibility > 0.4 && landmarks?.[12]?.visibility > 0.4;
        const handsSeen = landmarks?.[15]?.visibility > 0.4 && landmarks?.[16]?.visibility > 0.4;
        $("setupCameraView").classList.toggle("pose-found", Boolean(shoulderSeen && handsSeen));
        const framing = !shoulderSeen
          ? "请退后，让肩膀入镜"
          : !handsSeen ? "再退后，让双手入镜" : "双臂已入镜 · 可以起飞";
        $("setupCameraFeedback").textContent = framing;
        $("poseLive").hidden = s.mode !== "running";
        $("poseLive").textContent = shoulderSeen && handsSeen ? text : framing;
        const leftSeen = landmarks?.[15]?.visibility > 0.4;
        const rightSeen = landmarks?.[16]?.visibility > 0.4;
        $("poseSignals").textContent = (shoulderSeen ? "● 肩膀" : "○ 肩膀") + "  " + (leftSeen ? "● 左手" : "○ 左手") + "  " + (rightSeen ? "● 右手" : "○ 右手");
        $("poseSignals").dataset.ready = String(Boolean(shoulderSeen && handsSeen));
        updateCalibration(now, shoulderSeen && handsSeen);
        if (overlayStep === "modes" && setupControl === "camera") {
          const hint = !shoulderSeen
            ? "识别已启动，但没看到肩膀；请后退一步。"
            : !handsSeen ? "肩膀已入镜，再后退一点露出双手。" : "动作识别成功。上下扇动双臂，就能起飞。";
          if ($("setupControlHint").textContent !== hint) $("setupControlHint").textContent = hint;
          $("guideStatus").textContent = shoulderSeen && handsSeen ? "姿态就绪 ✓" : "调整站位 ↗";
          $("guideStatus").classList.toggle("ready", Boolean(shoulderSeen && handsSeen));
        }
        // 技能手势的提示停留一下，别被下一帧的扇翅提示立刻盖掉。
        if (/^[🛡💥🌀]/.test(text)) {
          poseNoticeUntil = now + 1400;
          $("cameraStatus").textContent = text;
        } else if (now >= poseNoticeUntil) {
          $("cameraStatus").textContent = text;
        }
      });
      loaderBar.style.width = "92%";
      loaderText.textContent = "马上就绪…";
      s.camera = true;
      $("modeText").textContent = "体感模式";
      $("cameraBtn").disabled = false;
      $("cameraBtn").classList.add("selected");
      $("keyboardBtn").classList.remove("selected");
      $("keyboardBtn").setAttribute("aria-pressed", "false");
      $("cameraBtn").setAttribute("aria-pressed", "true");
      if (matchMedia("(max-width: 760px)").matches) $("cameraBtn").textContent = "体感已开";
      syncSetupControl();
      const process = async () => {
        if (generation !== cameraGeneration || !s.camera) return;
        try {
          await currentPose.send({ image: $("cameraPreview") });
        } catch {
          if (generation === cameraGeneration) {
            stopCamera();
            resolveFirstResult(false);
            loader.hidden = true;
            toast("动作识别暂不可用，请使用键盘 / 触屏");
          }
          return;
        }
        if (generation === cameraGeneration) setTimeout(process, 16);
      };
      process();
      const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 20000));
      const ready = await Promise.race([firstResult, timeout]);
      if (!ready && generation === cameraGeneration) {
        stopCamera();
        loader.hidden = true;
        toast("识别模型加载超时，已切换触屏操作");
      }
      return ready;
    } catch (e) {
      if (generation !== cameraGeneration) return false;
      stopCamera();
      loader.hidden = true;
      toast(
        e.name === "NotAllowedError"
          ? "未获得摄像头权限，可继续使用键盘 / 触屏"
          : "摄像头或识别组件未就绪，可继续使用键盘 / 触屏",
      );
      return false;
    }
  }
  $("cameraBtn").addEventListener("click", enableCamera);
  $("keyboardBtn").addEventListener("click", stopCamera);
  window.addEventListener("pagehide", stopCamera);
})();
