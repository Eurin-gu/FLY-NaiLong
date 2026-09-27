/* A single 3D scene owns the character, particles, targets and collision visuals. */
class FlightWorld {
  constructor(canvas) {
    const T = THREE;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#b8dded");
    this.scene.fog = new T.Fog("#cce4e8", 170, 660);
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.camera = new T.PerspectiveCamera(58, 1, 0.1, 2500);
    this.scene.add(new T.HemisphereLight("#f6fbff", "#87a26f", 2.5));
    const sun = new T.DirectionalLight("#fff2cd", 3.2);
    sun.position.set(-30, 70, 40);
    this.scene.add(sun);
    this.sphere = new T.SphereGeometry(1, 20, 14);
    this.box = new T.BoxGeometry(1, 1, 1);
    this.materials = new Map();
    this.hero = this.createDragon();
    this.scene.add(this.hero);
    this.bubble = new T.Mesh(
      new T.SphereGeometry(4.1, 24, 16),
      new T.MeshStandardMaterial({
        color: "#c0f4ff",
        transparent: true,
        opacity: 0.2,
        roughness: 0.1,
        metalness: 0.2,
        side: T.DoubleSide,
      }),
    );
    this.scene.add(this.bubble);
    this.jet = new T.Mesh(
      new T.CylinderGeometry(0.23, 1.25, 7, 12, 1, true),
      new T.MeshBasicMaterial({
        color: "#91d5f3",
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.scene.add(this.jet);
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.nozzle = new T.Vector3();
    this.jetDirection = new T.Vector3(0, -1, 0);
    this.jetStrands = [];
    const strandGeometry = new T.CylinderGeometry(0.08, 0.28, 8, 8, 1, true);
    for (const color of [
      "#ff7e99",
      "#ffd36f",
      "#7eebbb",
      "#73cef8",
      "#c5a1ff",
    ]) {
      const strand = new T.Mesh(
        strandGeometry,
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      this.scene.add(strand);
      this.jetStrands.push(strand);
    }
    this.makeSpeedLines();
    this.makeCity();
    this.makeClouds();
    this.particles = [];
    const poopProfile = [
      [0, -0.55],
      [0.34, -0.55],
      [0.48, -0.42],
      [0.44, -0.24],
      [0.29, -0.18],
      [0.36, -0.03],
      [0.34, 0.13],
      [0.18, 0.21],
      [0.23, 0.34],
      [0.13, 0.51],
      [0.06, 0.6],
      [0, 0.78],
    ].map(([x, y]) => new T.Vector2(x, y));
    this.particleShapes = {
      poop: new T.LatheGeometry(poopProfile, 12),
      water: new T.SphereGeometry(0.24, 7, 5),
      rainbow: new T.SphereGeometry(0.3, 7, 5),
    };
    for (let i = 0; i < 150; i++) {
      const mesh = new T.Mesh(this.particleShapes.poop, this.mat("#795130"));
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, life: 0 });
    }
    this.emitDebt = 0;
    this.camReady = false;
    this.cameraMode = "";
    this.cityCell = "";
    this.cloudCell = "";
    this.pulse = new T.Mesh(
      new T.SphereGeometry(1, 24, 16),
      new T.MeshBasicMaterial({
        color: "#ffe2a8",
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.pulse.visible = false;
    this.scene.add(this.pulse);
    this.pulseTime = 0;
    this.target = new T.Vector3();
    this.resize(canvas.clientWidth, canvas.clientHeight);
  }
  mat(color, roughness = 0.65) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness }),
      );
    return this.materials.get(color);
  }
  ball(parent, color, x, y, z, sx, sy = sx, sz = sx) {
    const m = new THREE.Mesh(this.sphere, this.mat(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  block(parent, color, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(this.box, this.mat(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  createDragon() {
    const T = THREE,
      g = new T.Group();
    // Round yellow body, broad muzzle, green eyes and little brown claws.
    this.body = this.ball(g, "#ffd02b", 0, 0, 0, 1.75, 2.0, 1.35);
    this.ball(g, "#fff1ae", 0, -0.2, 1.06, 1.22, 1.45, 0.48);
    const head = new T.Group();
    head.position.set(0, 1.72, 0.3);
    g.add(head);
    this.head = head;
    this.ball(head, "#ffda30", 0, 0.35, 0, 1.68, 1.46, 1.25);
    this.ball(head, "#ffdb35", 0, -0.27, 1.0, 1.48, 0.81, 0.65);
    for (const side of [-1, 1]) {
      const x = side * 0.64;
      this.ball(head, "#fffdf3", x, 0.65, 1.05, 0.56, 0.7, 0.29);
      this.ball(head, "#4f8455", x + 0.03, 0.64, 1.31, 0.31, 0.42, 0.1);
      this.ball(head, "#273626", x + 0.035, 0.65, 1.4, 0.14, 0.25, 0.06);
      this.ball(head, "#ffffff", x - 0.045, 0.82, 1.445, 0.065, 0.09, 0.03);
      this.ball(head, "#e6a42d", side * 0.63, -0.06, 1.64, 0.085, 0.045, 0.025);
      this.ball(head, "#eeb546", side * 1.15, -0.35, 1.4, 0.28, 0.14, 0.04);
      this.ball(g, "#ffcc24", side * 1.02, -1.65, 0.43, 0.72, 0.48, 0.98);
      for (let j = 0; j < 3; j++)
        this.ball(
          g,
          "#b37a43",
          side * 1.02 + (j - 1) * 0.25,
          -1.68,
          1.26,
          0.105,
          0.12,
          0.23,
        );
      const arm = new T.Group();
      arm.position.set(side * 1.5, 0.22, 0);
      g.add(arm);
      this.ball(arm, "#ffd02b", side * 0.27, 0, 0.13, 0.5, 0.87, 0.48);
      this.ball(arm, "#ffda30", side * 0.52, -0.5, 0.3, 0.45, 0.43, 0.45);
      for (let j = 0; j < 3; j++)
        this.ball(
          arm,
          "#b37a43",
          side * 0.52 + (j - 1) * 0.16,
          -0.73,
          0.55,
          0.07,
          0.12,
          0.1,
        );
      if (side === -1) this.leftArm = arm;
      else this.rightArm = arm;
    }
    this.ball(head, "#654127", 0, -0.58, 1.58, 0.61, 0.31, 0.06);
    this.ball(head, "#ee947d", 0, -0.73, 1.64, 0.35, 0.12, 0.035);
    this.ball(head, "#fffbe1", 0, -0.42, 1.64, 0.42, 0.07, 0.035);
    const tail = this.ball(g, "#f1b620", 0, -1.1, -1.72, 0.64, 0.6, 1.65);
    this.tail = tail;
    tail.rotation.x = -0.27;
    this.eyes = head.children.filter(
      (m) => m.position.y > 0.3 && m.position.z > 1,
    );
    this.eyes.forEach((m) => (m.userData.openScaleY = m.scale.y));
    for (let i = 0; i < 4; i++) {
      const spike = new T.Mesh(
        new T.ConeGeometry(0.24, 0.55, 6),
        this.mat("#c69231"),
      );
      spike.position.set(0, 1.1 - i * 0.6, -1.2 - i * 0.14);
      spike.rotation.x = -0.8;
      g.add(spike);
    }
    return g;
  }
  makeCity() {
    const T = THREE;
    this.city = new T.Group();
    this.scene.add(this.city);
    this.ground = new T.Mesh(
      new T.PlaneGeometry(5000, 5000),
      this.mat("#adc8a1"),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -1;
    this.scene.add(this.ground);
    this.river = this.block(this.city, "#7ec7d8", 0, -0.5, -260, 45, 1, 1300);
    this.buildings = new T.InstancedMesh(
      this.box,
      new T.MeshStandardMaterial({ roughness: 0.85 }),
      230,
    );
    this.city.add(this.buildings);
    this.windows = new T.InstancedMesh(this.box, this.mat("#e4f4ea"), 230 * 6);
    this.city.add(this.windows);
    this.trees = new T.InstancedMesh(
      new T.ConeGeometry(3, 11, 7),
      this.mat("#7ea982"),
      180,
    );
    this.city.add(this.trees);
    this.matrix = new T.Object3D();
    this.roads = [];
    for (let i = 0; i < 9; i++)
      this.roads.push(
        this.block(this.city, "#e5d9b8", 0, 0.05, -i * 120, 1500, 0.1, 9),
      );
    this.mountains = [];
    for (let i = 0; i < 14; i++) {
      const mountain = new T.Mesh(
        new T.ConeGeometry(100 + (i % 3) * 40, 100 + (i % 4) * 28, 5),
        this.mat(i % 2 ? "#8db3a6" : "#a2c4b8"),
      );
      mountain.position.set(
        (i % 2 ? 1 : -1) * (420 + (i % 3) * 50),
        20,
        -i * 95,
      );
      this.city.add(mountain);
      this.mountains.push(mountain);
    }
  }
  makeSpeedLines() {
    const T = THREE;
    this.linePositions = new Float32Array(48 * 6);
    this.lineGeometry = new T.BufferGeometry();
    this.lineGeometry.setAttribute(
      "position",
      new T.BufferAttribute(this.linePositions, 3),
    );
    this.speedLines = new T.LineSegments(
      this.lineGeometry,
      new T.LineBasicMaterial({
        color: "#f4ffff",
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.speedLines.frustumCulled = false;
    this.speedLines.renderOrder = 10;
    this.camera.add(this.speedLines);
    this.scene.add(this.camera);
  }
  updateSpeedLines(s) {
    const intensity =
      s.mode === "running" && !this.reducedMotion
        ? s.dash > 0
          ? 0.58
          : Math.min(0.2, Math.abs(s.vy) / 450)
        : 0;
    this.speedLines.visible = intensity > 0;
    if (!this.speedLines.visible) return;
    this.speedLines.material.opacity = intensity;
    const halfHeight =
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 2;
    for (let i = 0; i < 48; i++) {
      const angle = i * 2.39996,
        phase = (s.time * (s.dash > 0 ? 1.6 : 0.65) + i * 0.317) % 1;
      const radius = 0.62 + phase * 0.65,
        length = (s.dash > 0 ? 0.19 : 0.075) * (1 + phase);
      const x = Math.cos(angle) * halfHeight * this.camera.aspect,
        y = Math.sin(angle) * halfHeight;
      this.linePositions.set(
        [
          x * radius,
          y * radius,
          -2,
          x * (radius + length),
          y * (radius + length),
          -2,
        ],
        i * 6,
      );
    }
    this.lineGeometry.attributes.position.needsUpdate = true;
  }
  cityUpdate(s) {
    const cx = Math.floor(s.x / 48),
      cz = Math.floor(s.distance / 48);
    const cell = cx + "," + cz;
    this.city.position.z = s.distance - cz * 48;
    this.city.position.x = cx * 48;
    this.river.position.x = -cx * 48;
    this.ground.position.set(s.x, -1, 0);
    if (cell === this.cityCell) return;
    this.cityCell = cell;
    let index = 0,
      wi = 0;
    const obj = this.matrix,
      color = new THREE.Color();
    for (let row = 0; row < 23; row++)
      for (let col = 0; col < 10; col++) {
        const seed = Math.abs(
          Math.sin((row + cz - 2) * 37.13 + (col + cx - 5) * 91.7),
        );
        const x = (col - 5) * 48,
          z = (2 - row) * 48;
        const height = 8 + seed * 46,
          bw = Math.abs(x + cx * 48) < 36 ? 0 : 16 + seed * 12;
        obj.position.set(x, height / 2, z);
        obj.scale.set(bw, height, bw);
        obj.updateMatrix();
        this.buildings.setMatrixAt(index, obj.matrix);
        color.set(
          ["#d4ded1", "#e9dfc8", "#d5dedf", "#edcda9", "#b2c9ba"][
            Math.floor(seed * 5) % 5
          ],
        );
        this.buildings.setColorAt(index++, color);
        for (let j = 0; j < 6; j++) {
          obj.position.set(
            x + ((j % 3) - 1) * bw * 0.27,
            height * 0.28 + Math.floor(j / 3) * height * 0.4,
            z + bw / 2 + 0.1,
          );
          obj.scale.set(bw ? 2 : 0, height * 0.13, 0.15);
          obj.updateMatrix();
          this.windows.setMatrixAt(wi++, obj.matrix);
        }
      }
    for (let i = 0; i < 180; i++) {
      obj.position.set(
        ((i % 12) - 6) * 48 + 18,
        4,
        (2 - Math.floor(i / 12)) * 48 + 17,
      );
      obj.scale.setScalar(
        Math.abs(obj.position.x + cx * 48) < 24
          ? 0
          : 0.65 + (((i % 12) + cx + 1200) % 4) * 0.22,
      );
      obj.updateMatrix();
      this.trees.setMatrixAt(i, obj.matrix);
    }
    this.buildings.instanceMatrix.needsUpdate = true;
    this.buildings.instanceColor.needsUpdate = true;
    this.windows.instanceMatrix.needsUpdate = true;
    this.trees.instanceMatrix.needsUpdate = true;
    this.roads.forEach(
      (road, i) => (road.position.z = (((cz % 3) + 3) % 3) * 48 - i * 144),
    );
  }
  makeClouds() {
    this.clouds = [];
    for (let i = 0; i < 32; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++)
        this.ball(
          g,
          "#f6fbf6",
          (j - 1.5) * 7,
          Math.sin(j * 2) * 3,
          0,
          8,
          4 + (j % 2) * 2,
          5,
        );
      this.scene.add(g);
      this.clouds.push(g);
    }
  }
  cloudUpdate(s) {
    const cx = Math.floor(s.x / 110),
      cy = Math.floor(s.altitude / 180),
      cz = Math.floor(s.distance / 120);
    const cell = `${cx},${cy},${cz}`;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      if (cell !== this.cloudCell) {
        const gx = cx + (i % 4) - 2,
          gy = cy + Math.floor(i / 16) - 1,
          gz = cz + (Math.floor(i / 4) % 4);
        const wobble = Math.sin(gx * 17 + gy * 11 + gz * 37);
        c.userData.x = gx * 110 + wobble * 20;
        c.userData.y = gy * 180 + 85 + Math.cos(gx * 7 + gz * 13) * 15;
        c.userData.d = gz * 120 + wobble * 25;
      }
      c.visible = c.userData.y >= 60;
      c.position.set(c.userData.x, c.userData.y, s.distance - c.userData.d);
    }
    this.cloudCell = cell;
  }
  addRing(data) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.75, 10, 40),
      this.mat("#edb951"),
    );
    g.add(ring);
    const frosting = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.38, 8, 40),
      this.mat("#fff0ba"),
    );
    frosting.position.z = 0.6;
    g.add(frosting);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sprinkle = this.block(
        g,
        i % 2 ? "#f7938c" : "#a1d9c4",
        Math.cos(a) * 7.5,
        Math.sin(a) * 7.5,
        0.95,
        0.3,
        0.9,
        0.3,
      );
      sprinkle.rotation.z = a;
    }
    this.scene.add(g);
    data.mesh = g;
    return data;
  }
  addDrone(data) {
    const T = THREE,
      g = new T.Group();
    this.ball(g, "#768eab", 0, 0, 0, 2.1, 0.85, 1.5);
    this.block(g, "#f2f7ed", 0, 0.35, 0.65, 2.4, 0.5, 1.5);
    this.block(g, "#ee765a", -0.5, 0.95, 0, 0.7, 0.25, 0.4);
    this.block(g, "#63bddd", 0.5, 0.95, 0, 0.7, 0.25, 0.4);
    for (const side of [-1, 1]) {
      this.block(g, "#596c82", side * 2.2, 0, 0, 3, 0.15, 0.25);
      const rotor = new T.Mesh(
        new T.CylinderGeometry(1.6, 1.6, 0.06, 16),
        this.mat("#627d8d"),
      );
      rotor.position.set(side * 3.4, 0.4, 0);
      g.add(rotor);
    }
    this.scene.add(g);
    data.mesh = g;
    return data;
  }
  remove(data) {
    if (data.mesh) {
      data.mesh.traverse((m) => {
        if (m.isMesh && m.geometry !== this.box && m.geometry !== this.sphere)
          m.geometry.dispose();
      });
      this.scene.remove(data.mesh);
      data.mesh = null;
    }
  }
  burst(x, y, z, fuel, count = 24) {
    for (let i = 0; i < count; i++) {
      const p = this.particles.find((p) => p.life <= 0);
      if (!p) break;
      this.launchParticle(p, x, y, z, fuel, true);
    }
  }
  launchParticle(p, x, y, z, fuel, burst = false) {
    p.life = burst ? 1.3 : 1.8;
    p.mesh.visible = true;
    p.mesh.geometry = this.particleShapes[fuel];
    const rainbow = ["#fb7896", "#f4c75d", "#72d8b5", "#8dc2f1", "#b59de8"];
    p.mesh.material = this.mat(
      fuel === "poop"
        ? "#8b5a32"
        : fuel === "water"
          ? "#65c9f0"
          : rainbow[Math.floor(Math.random() * 5)],
    );
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(fuel === "poop" ? 1.2 + Math.random() : 1.2);
    p.vx = (Math.random() - 0.5) * (burst ? 36 : 4);
    p.vy = burst ? (Math.random() - 0.4) * 35 : -24 - Math.random() * 22;
    p.vz = (Math.random() - 0.5) * (burst ? 30 : 8);
    p.mesh.rotation.set(Math.random(), 0, Math.random());
  }
  shockwave(s) {
    this.pulseTime = 0.65;
    this.pulse.position.set(s.x, s.altitude, 0);
    this.burst(s.x, s.altitude, 0, s.fuel, 60);
  }
  resize(w, h) {
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
  }
  reset() {
    this.camReady = false;
    this.emitDebt = 0;
    this.pulseTime = 0;
    this.particles.forEach((p) => {
      p.life = 0;
      p.mesh.visible = false;
    });
  }
  render(s, dt, objects) {
    const T = THREE;
    const ready = s.mode === "ready",
      active = s.mode === "running" || ready;
    const visualDt = active ? dt : 0;
    this.cityUpdate(s);
    this.cloudUpdate(s);
    const sky = new T.Color().setHSL(
      0.55 + (Math.min(s.altitude, 1800) / 1800) * 0.03,
      0.44,
      0.82 - Math.min(s.altitude / 3500, 0.24),
    );
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    this.hero.position.set(s.x, s.altitude + Math.sin(s.time * 2.5) * 0.12, 0);
    const modelScale = ready ? (this.width < 500 ? 1.08 : 1.5) : 1;
    const stretch = !this.reducedMotion && s.dash > 0 ? 0.06 : 0;
    this.hero.scale.set(
      modelScale * (1 - stretch),
      modelScale * (1 + stretch),
      modelScale,
    );
    const rollAngle =
      s.roll > 0 && !this.reducedMotion ? Math.PI * 2 * (1 - s.roll / 0.85) : 0;
    this.hero.rotation.set(
      -s.vy * 0.002,
      ready ? -0.3 : -0.2 - s.vx * 0.008,
      -s.vx * 0.008 + rollAngle,
    );
    const pumping = s.thrust > 0 || s.dash > 0 || ready;
    this.leftArm.rotation.z = pumping
      ? -0.65 + Math.sin(s.time * 10) * 0.13
      : -0.1;
    this.rightArm.rotation.z = pumping
      ? 0.65 - Math.sin(s.time * 10) * 0.13
      : 0.1;
    this.head.rotation.z = Math.sin(s.time * 2) * 0.035;
    this.tail.rotation.z = Math.sin(s.time * 7) * (pumping ? 0.22 : 0.08);
    const blink = s.time % 4.7 < 0.13 ? 0.12 : 1;
    this.eyes.forEach((m) => (m.scale.y = m.userData.openScaleY * blink));
    this.bubble.position.copy(this.hero.position);
    this.bubble.visible = s.shield > 0 || s.dash > 0;
    this.bubble.material.opacity = s.dash > 0 ? 0.12 : 0.22;
    this.nozzle
      .set(0, ready ? -3.5 : -2.1, 0.2)
      .applyQuaternion(this.hero.quaternion)
      .add(this.hero.position);
    this.jetDirection.set(0, -1, 0).applyQuaternion(this.hero.quaternion);
    const jetLength = s.dash > 0 ? 1.8 : 1;
    this.jet.position
      .copy(this.nozzle)
      .addScaledVector(this.jetDirection, 3.5 * jetLength);
    this.jet.quaternion.copy(this.hero.quaternion);
    this.jet.visible = pumping;
    this.jet.material.color.set(
      s.fuel === "poop"
        ? "#b29b63"
        : s.fuel === "water"
          ? "#6ecdf6"
          : "#d5a6ed",
    );
    this.jet.scale.set(1, s.dash > 0 ? 1.8 : 1, 1);
    this.jet.material.opacity =
      s.fuel === "poop" ? 0.12 : s.fuel === "water" ? 0.42 : 0.17;
    this.jetStrands.forEach((strand, i) => {
      strand.visible = pumping && s.fuel !== "poop";
      const offset = new T.Vector3(
        (i - 2) * 0.18,
        0,
        Math.sin(s.time * 7 + i) * 0.13,
      ).applyQuaternion(this.hero.quaternion);
      strand.position
        .copy(this.nozzle)
        .add(offset)
        .addScaledVector(this.jetDirection, 4 * jetLength);
      strand.quaternion.copy(this.hero.quaternion);
      strand.scale.set(1, jetLength, 1);
      if (s.fuel === "water")
        strand.material.color.set(i % 2 ? "#e1fbff" : "#5bcbf6");
      else
        strand.material.color.set(
          ["#ff7e99", "#ffd36f", "#7eebbb", "#73cef8", "#c5a1ff"][i],
        );
    });
    if (pumping && active) {
      this.emitDebt += visualDt * (s.dash > 0 ? 65 : 35);
      while (this.emitDebt >= 1) {
        this.emitDebt--;
        const p = this.particles.find((p) => p.life <= 0);
        if (p)
          this.launchParticle(
            p,
            this.nozzle.x + (Math.random() - 0.5) * 0.7,
            this.nozzle.y,
            this.nozzle.z,
            s.fuel,
          );
        if (p) {
          const force = s.dash > 0 ? 62 : 38;
          p.vx = this.jetDirection.x * force + (Math.random() - 0.5) * 3;
          p.vy = this.jetDirection.y * force;
          p.vz = this.jetDirection.z * force + (Math.random() - 0.5) * 4;
        }
      }
    }
    for (const p of this.particles)
      if (p.life > 0) {
        p.life -= visualDt;
        p.mesh.visible = p.life > 0;
        p.mesh.position.x += p.vx * visualDt;
        p.mesh.position.y += p.vy * visualDt;
        p.mesh.position.z += (p.vz + (ready ? 3 : s.speed * 0.75)) * visualDt;
        // Retire particles near the lens before perspective turns them into screen-filling blobs.
        p.mesh.visible =
          p.life > 0 &&
          p.mesh.position.z < this.camera.position.z - 7 &&
          p.mesh.position.distanceToSquared(this.camera.position) > 100;
        p.mesh.rotation.z += visualDt * 2;
        p.mesh.scale.multiplyScalar(Math.exp(-visualDt * 0.6));
      }
    for (const o of objects) {
      if (o.mesh) {
        o.mesh.position.set(o.x, o.y, s.distance - o.d);
        if (o.type === "ring") o.mesh.rotation.z = s.time * 0.13;
        else o.mesh.rotation.z = Math.sin(s.time * 3 + o.d) * 0.06;
      }
    }
    this.pulseTime = Math.max(0, this.pulseTime - visualDt);
    this.pulse.visible = this.pulseTime > 0;
    this.pulse.scale.setScalar(1 + (1 - this.pulseTime / 0.65) * 65);
    this.pulse.material.opacity = this.pulseTime * 0.6;
    const targetPosition = new T.Vector3(
      s.x + (ready ? 10 : 4.5),
      s.altitude + (ready ? 6 : 6 - s.vy * 0.015),
      ready ? 24 : s.dash > 0 ? 29 : 22,
    );
    if (!this.camReady || (this.cameraMode !== s.mode && ready)) {
      this.camera.position.copy(targetPosition);
      this.camReady = true;
    } else
      this.camera.position.lerp(
        targetPosition,
        1 - Math.exp(-visualDt * (ready ? 3 : 6)),
      );
    this.cameraMode = s.mode;
    this.target.set(
      s.x + (ready ? (this.width < 500 ? -6 : -5) : 0),
      s.altitude + (ready ? 0 : 2),
      ready ? 0 : -27,
    );
    this.camera.lookAt(this.target);
    const fov = s.dash > 0 ? 76 : 58;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-visualDt * 5));
    this.camera.updateProjectionMatrix();
    this.updateSpeedLines(s);
    this.renderer.render(this.scene, this.camera);
  }
  project(x, y, d, distance) {
    const v = new THREE.Vector3(x, y, distance - d).project(this.camera);
    return {
      x: (v.x + 1) * 0.5 * this.width,
      y: (1 - v.y) * 0.5 * this.height,
      visible: v.z > -1 && v.z < 1,
    };
  }
}
window.FlightWorld = FlightWorld;
