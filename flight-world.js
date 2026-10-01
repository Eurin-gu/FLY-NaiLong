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
    this.makeCop();
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
    // 0 = 面向镜头（开局待机），1 = 背对镜头向前飞；开局后平滑过渡
    this.turn = 0;
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
    const T = THREE, dragon = new T.Group();
    const skinColor = new T.Color('#ffb51b');
    const skin = new T.MeshStandardMaterial({ color: skinColor, roughness: .57 });
    const nail = new T.MeshStandardMaterial({ color: '#785848', roughness: .76 });
    const pink = new T.MeshStandardMaterial({ color: '#e79193', roughness: .7 });
    const ivory = new T.MeshStandardMaterial({ color: '#fff7db', roughness: .4 });
    const green = new T.MeshStandardMaterial({ color: '#477c35', roughness: .32 });
    const pupil = new T.MeshStandardMaterial({ color: '#101b15', roughness: .19 });
    const glint = new T.MeshBasicMaterial({ color: '#fffdf3' });
    const sphere = new T.SphereGeometry(1, 40, 28);
    const oval = (parent, material, position, scale) => {
      const mesh = new T.Mesh(sphere, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      parent.add(mesh);
      return mesh;
    };
    const smoothNormals = geometry => {
      geometry.computeVertexNormals();
      const n=geometry.attributes.normal, rows=geometry.userData.radialRows;
      const end=geometry.userData.radialSegments*rows;
      for(let j=0;j<rows;j++){
        const normal=new T.Vector3(n.getX(j)+n.getX(end+j),n.getY(j)+n.getY(end+j),n.getZ(j)+n.getZ(end+j)).normalize();
        n.setXYZ(j,normal.x,normal.y,normal.z);n.setXYZ(end+j,normal.x,normal.y,normal.z);
      }
      n.needsUpdate=true;
    };
    const lathe = (profile, depth, segments = 64) => {
      const curve = new T.CatmullRomCurve3(profile.map(([r, y]) => new T.Vector3(r, y, 0)));
      const points = curve.getPoints(96).map(p => new T.Vector2(Math.max(.001, p.x), p.y));
      const geometry = new T.LatheGeometry(points, segments);
      geometry.scale(1, 1, depth);
      // Lathe vertices wrap around, but the seam has duplicate positions.
      // Average their normals after sculpting so the face has no vertical crease.
      geometry.userData.radialRows=points.length;
      geometry.userData.radialSegments=segments;
      smoothNormals(geometry);
      return { geometry, points };
    };

    // Pear-shaped torso: broad hips and shoulders overlap the short legs.
    const torso = lathe([[.001,-2.56],[.72,-2.49],[1.18,-2.23],[1.49,-1.78],
      [1.62,-1.19],[1.60,-.64],[1.45,-.05],[1.16,.45],[.72,.7],[.001,.78]], .79);
    const colors = [], pos = torso.geometry.attributes.position;
    const bellyColor = new T.Color('#fff0d0');
    for (let i = 0; i < pos.count; i++) {
      const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
      const patch = Math.hypot(x/1.08, (y+.99)/1.33);
      const blend=(1-T.MathUtils.smoothstep(patch,.89,1.04))*T.MathUtils.smoothstep(z,.5,.83);
      // Subtle occlusion under the chin gives the neck a soft, continuous join.
      const occlusion=1-.11*T.MathUtils.smoothstep(y,-.2,.55);
      const c=skinColor.clone().lerp(bellyColor,blend).multiplyScalar(occlusion);
      colors.push(c.r,c.g,c.b);
    }
    torso.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    this.body=new T.Mesh(torso.geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.64}));
    dragon.add(this.body);

    // Domed forehead and rounded cheeks, with no superellipse's flat chin.
    this.head=new T.Group();this.head.position.set(0,1.32,.30);dragon.add(this.head);
    const headShape=lathe([[.001,-1.47],[.55,-1.43],[1.05,-1.27],[1.46,-.97],
      [1.70,-.55],[1.76,-.04],[1.73,.48],[1.58,.97],[1.28,1.39],
      [.88,1.66],[.43,1.82],[.001,1.88]],.83);
    const faceDepth=(x,y)=>{
      let radius=.01;
      for(let i=1;i<headShape.points.length;i++){
        const a=headShape.points[i-1],b=headShape.points[i];
        if(y>=a.y&&y<=b.y){radius=T.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y));break;}
      }
      return .83*Math.sqrt(Math.max(.001,radius*radius-x*x));
    };
    // Soft cheek volume is sculpted into the surface, including the smile's muzzle.
    const cheekDepth=(x,y)=>.11*Math.exp(-Math.pow((y+.47)/.39,2))*Math.exp(-Math.pow(x/1.13,4));
    const hp=headShape.geometry.attributes.position;
    for(let i=0;i<hp.count;i++){
      const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i);
      if(z>0)hp.setZ(i,z+cheekDepth(x,y)*T.MathUtils.smoothstep(z,.3,.9));
    }
    smoothNormals(headShape.geometry);
    this.head.add(new T.Mesh(headShape.geometry,skin));
    const surface=(x,y)=>faceDepth(x,y)+cheekDepth(x,y);
    this.eyes=[];
    for(const side of [-1,1]){
      const eye=new T.Group();const ex=side*.78,ey=.21;
      eye.position.set(ex,ey,surface(ex,ey)-.055);eye.rotation.y=side*.21;
      this.head.add(eye);
      oval(eye,ivory,[0,0,0],[.325,.354,.10]);
      oval(eye,green,[side*-.013,.012,.074],[.272,.313,.069]);
      oval(eye,pupil,[side*-.013,.012,.13],[.221,.264,.046]);
      oval(eye,glint,[-.065,.099,.171],[.043,.047,.014]);
      oval(eye,glint,[.061,-.09,.174],[.017,.02,.009]);
      // The eye is partially embedded in the cheek surface.
      eye.userData.openScaleY=1;this.eyes.push(eye);

      const arm=new T.Group();arm.position.set(side*1.24,.17,.02);dragon.add(arm);
      const armShape=lathe([[.001,-1.43],[.21,-1.39],[.35,-1.25],[.41,-.94],
        [.43,-.53],[.39,-.17],[.27,.10],[.001,.22]],.96,40).geometry;
      // Bend each arm smoothly away from the torso; hand and arm are one mesh.
      const ap=armShape.attributes.position;
      for(let i=0;i<ap.count;i++)ap.setX(i,ap.getX(i)+side*.22*Math.sin((-ap.getY(i)+.2)*1.1));
      smoothNormals(armShape);arm.add(new T.Mesh(armShape,skin));
      for(let j=0;j<3;j++)oval(arm,nail,[side*.20+(j-1)*.16,-1.37,.18],[.081,.096,.12]);
      oval(arm,pink,[side*.20,-1.08,.366],[.17,.20,.022]);
      if(side<0)this.leftArm=arm;else this.rightArm=arm;

      const leg=lathe([[.001,-.53],[.30,-.52],[.49,-.46],[.51,-.27],
        [.50,.05],[.54,.36],[.47,.58],[.001,.69]],1.02,40).geometry;
      const foot=new T.Mesh(leg,skin);foot.position.set(side*.78,-2.32,.14);dragon.add(foot);
      for(let j=0;j<3;j++)oval(dragon,nail,[side*.78+(j-1)*.23,-2.76,.61],[.106,.115,.137]);
    }
    const smile=[];
    for(let i=0;i<=40;i++){
      const x=-.56+i*.028, y=-.58+.125*Math.pow(x/.56,2);
      smile.push(new T.Vector3(x,y,surface(x,y)+.006));
    }
    this.mouth=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(smile),40,.018,8,false),
      new T.MeshStandardMaterial({color:'#c48a25',roughness:.85}));
    this.head.add(this.mouth);

    // Tapered tail, rooted into the hips instead of a constant-width tube.
    this.tail=new T.Group();this.tail.position.set(0,-1.62,-.84);dragon.add(this.tail);
    const tailPath=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(0,-.12,-.7),
      new T.Vector3(0,-.03,-1.4),new T.Vector3(0,.23,-1.94)]);
    const tailGeo=new T.TubeGeometry(tailPath,32,1,20,false), tp=tailGeo.attributes.position;
    for(let i=0;i<=32;i++){
      const t=i/32, center=tailPath.getPointAt(t),radius=.43*Math.pow(1-t,.8)+.015;
      for(let j=0;j<=20;j++){
        const k=i*21+j;tp.setXYZ(k,center.x+(tp.getX(k)-center.x)*radius,
          center.y+(tp.getY(k)-center.y)*radius,center.z+(tp.getZ(k)-center.z)*radius);
      }
    }
    tailGeo.computeVertexNormals();this.tail.add(new T.Mesh(tailGeo,skin));
    const ridge=new T.MeshStandardMaterial({color:'#e6a722',roughness:.72});
    for(let i=0;i<4;i++){
      const spike=new T.Mesh(new T.ConeGeometry(.17,.30,16),ridge);
      const y=.3-i*.54;
      let radius=1;
      for(let j=1;j<torso.points.length;j++){
        const a=torso.points[j-1],b=torso.points[j];
        if(y>=a.y&&y<=b.y){radius=T.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y));break;}
      }
      spike.position.set(0,y,-radius*.79-.035);spike.rotation.x=-Math.PI/2;dragon.add(spike);
    }
    // 一对小翅膀。奶龙本体原本没有翅膀，补上之后背对镜头飞行时一眼能看出来。
    // 三片羽瓣由内到外变小、颜色比身体浅，免得糊成一团。
    this.wings = [];
    const wingSkin = new T.MeshStandardMaterial({ color: '#fff1c2', roughness: .58 });
    const wingTip = new T.MeshStandardMaterial({ color: '#f6d68a', roughness: .66 });
    for (const side of [-1, 1]) {
      const wing = new T.Group();
      wing.position.set(side * .84, .42, -.62);   // 肩后，根部略埋进身体
      dragon.add(wing);
      oval(wing, wingSkin, [side * .45, .02, .04], [.74, .32, .26]);
      oval(wing, wingTip, [side * 1.06, .13, .01], [.62, .27, .22]);
      oval(wing, wingSkin, [side * 1.58, .25, -.03], [.44, .21, .17]);
      this.wings.push(wing);
    }
    return dragon;
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
  /**
   * The traffic officer who shows up whenever 奶龙 touches the ground or a
   * rooftop. Built from the same primitives as everything else; the roof
   * beacon is flashed from render() so it always reads as "on duty".
   */
  makeCop() {
    const T = THREE,
      g = new T.Group();
    // Navy tunic with reflective bands and a duty belt.
    this.ball(g, "#a6c9e5", 0, 0, 0, 1.3, 1.65, .8);
    this.block(g, "#cee858", 0, .1, .79, 2.2, 2.5, .15);
    this.block(g, "#25324b", 0, .65, .91, .16, 1.8, .08);
    this.block(g, "#23334a", -.65, .5, .97, .4, .65, .16);
    this.block(g, "#e8edf2", .66, .68, .97, .55, .23, .08);
    this.block(g, "#eaf2ff", 0, 0.55, 0.82, 2.4, 0.34, 0.2);
    this.block(g, "#eaf2ff", 0, -0.65, 0.82, 2.4, 0.34, 0.2);
    this.block(g, "#22324a", 0, -1.55, 0, 2.75, 0.44, 1.75);
    // Head, peaked cap and badge.
    this.ball(g, "#dcb393", 0, 1.73, 0, .37, .5, .38);
    this.ball(g, "#f0c9a0", 0, 2.55, 0, .83, 1.05, .78);
    this.ball(g, "#fffdf5", 0, 3.42, 0, 1, .42, .95);
    this.ball(g, "#d9a782", 0, 2.45, .83, .16, .22, .22);
    this.copLegs = [];
    this.copKnees = [];
    for (const side of [-1,1]) {
      const leg = new T.Group(); leg.position.set(side*.62,-1.4,0); g.add(leg);
      this.ball(leg,"#25324b",0,-.57,0,.43,.72,.43);
      const knee = new T.Group(); knee.position.y=-1.14; leg.add(knee);
      this.ball(knee,"#25324b",0,-.48,0,.36,.60,.36);
      this.ball(knee,"#151a23",0,-1.11,.27,.44,.30,.68);
      this.copKnees.push(knee);
      this.copLegs.push(leg);
      this.ball(g,"#dcb393",side*.83,2.55,0,.17,.27,.16);
    }
    this.block(g, "#0f2344", 0, 3.2, 1.25, 2.6, 0.3, 0.9);
    this.block(g, "#f2c94c", 0, 3.72, 1.12, 0.55, 0.5, 0.2);
    for (const side of [-1, 1]) {
      this.ball(g, "#ffffff", side * 0.32, 2.68, .70, .19,.11,.08);
      this.ball(g, "#22324a", side * 0.32, 2.68, .78, .075,.08,.04);
    }
    this.block(g, "#8a4a3a", 0, 2.08, .74, 0.40, 0.06, 0.06);
    this.copArms = []; this.copElbows = [];
    for (const side of [-1, 1]) {
      const arm = new T.Group(); arm.position.set(side*1.32,1.1,0); g.add(arm);
      this.ball(arm,"#a6c9e5",0,-.52,0,.33,.67,.34);
      const elbow = new T.Group(); elbow.position.y=-1.04; arm.add(elbow);
      this.ball(elbow,"#a6c9e5",0,-.43,0,.28,.54,.29);
      this.ball(elbow,"#f4f7ff",0,-.95,.05,.30,.38,.25);
      this.copArms.push(arm); this.copElbows.push(elbow);
    }
    const beacon = new T.Group();
    beacon.position.set(0, -1.3, -1);
    this.copRed = this.block(beacon, "#e8453c", -0.62, 0, 0, 1.15, 0.5, 1.15);
    this.copBlue = this.block(beacon, "#3d7ce8", 0.62, 0, 0, 1.15, 0.5, 1.15);
    g.add(beacon);
    g.scale.setScalar(0.9);
    g.visible = false;
    this.scene.add(g);
    this.cop = g;
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
        obj.scale.set(bw, bw ? height : 0, bw);
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
          obj.scale.set(bw ? 2 : 0, bw ? height * 0.13 : 0, bw ? 0.15 : 0);
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
  /**
   * Collision test against the instanced city.
   *
   * Buildings are placed deterministically from a (row, col, cell) hash, so the
   * very same maths that positions them can test them without reading back the
   * instance buffers. The hero always sits at world z = 0; it is the city group
   * that slides past, so "distance" is measured in the city's local frame.
   */
  buildingHit(x, altitude, distance, radius = 5) {
    if (altitude - radius > 54) return false; // clears the tallest tower
    const cx = Math.floor(x / 48),
      cz = Math.floor(distance / 48);
    const originX = cx * 48,
      originZ = distance - cz * 48;
    // Only a couple of rows can ever straddle z = 0; the bounds checks below
    // reject everything else after one cheap comparison.
    for (let row = 0; row <= 22; row++) {
      const worldZ = originZ + (2 - row) * 48;
      if (Math.abs(worldZ) > 16 + radius) continue;
      for (let col = 0; col <= 9; col++) {
        const bx = (col - 5) * 48;
        const worldX = originX + bx;
        if (Math.abs(worldX - x) > 16 + radius) continue;
        const seed = Math.abs(
          Math.sin((row + cz - 2) * 37.13 + (col + cx - 5) * 91.7),
        );
        const width = Math.abs(bx + originX) < 36 ? 0 : 16 + seed * 12;
        if (!width) continue; // the river corridor stays clear
        if (altitude - radius >= 8 + seed * 46) continue; // flying over the roof
        if (
          Math.abs(worldX - x) < width / 2 + radius &&
          Math.abs(worldZ) < width / 2 + radius
        )
          return true;
      }
    }
    return false;
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
      new THREE.MeshBasicMaterial({color:"#ffd14a"}),
    );
    g.add(ring);
    const frosting = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.38, 8, 40),
      new THREE.MeshBasicMaterial({color:"#fff7cf"}),
    );
    frosting.position.z = 0.6;
    g.add(frosting);
    const glow=new THREE.Mesh(new THREE.TorusGeometry(7.5,1.3,10,40),
      new THREE.MeshBasicMaterial({color:"#ffcc33",transparent:true,opacity:.16,depthWrite:false}));
    g.add(glow);
    data.ownedMaterials=[ring.material,frosting.material,glow.material];
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
  addBird(data) {
    const T=THREE, g=new T.Group();
    this.ball(g,"#f6f2e9",0,0,0,1.1,.8,1.8);
    this.ball(g,"#ffffff",0,.6,1.25,.7,.7,.8);
    const beak=new T.Mesh(new T.ConeGeometry(.32,1,8),this.mat("#f2ae36"));
    beak.rotation.x=Math.PI/2;beak.position.set(0,.5,2.2);g.add(beak);
    for(const side of [-1,1]) this.ball(g,"#1f2c39",side*.48,.8,1.67,.13);
    data.wings=[];
    for(const side of [-1,1]) {
      const wing=new T.Group();wing.position.set(side*.8,.2,0);g.add(wing);
      this.ball(wing,"#ced9e1",side*1.5,0,-.1,2,.16,.8);
      this.ball(wing,"#485968",side*2.8,0,-.2,.7,.13,.55);
      data.wings.push(wing);
    }
    data.mesh=g;this.scene.add(g);return data;
  }
  remove(data) {
    if (data.mesh) {
      data.ownedMaterials?.forEach(material=>material.dispose());
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
    p.vz = (Math.random() - 0.5) * (burst ? 30 : 8) - (this.frameSpeed || 0);
    p.gravity = 42;
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
    if (this.cop) this.cop.visible = false;
    this.particles.forEach((p) => {
      p.life = 0;
      p.mesh.visible = false;
    });
  }
  render(s, dt, objects) {
    const T = THREE;
    const ready = s.mode === "ready" || s.menuPreview,
      active = s.mode === "running" || ready;
    const visualDt = active ? dt : 0;
    this.frameSpeed = ready ? 0 : s.speed;
    this.cityUpdate(s);
    this.cloudUpdate(s);
    // The pursuer is driven entirely from game state: the chase object holds
    // his absolute position, render() only mirrors it into the scene.
    const chase = s.chase;
    this.cop.visible = Boolean(chase && (s.mode === "running" || chase.caught));
    if (this.cop.visible) {
      const gap = Math.min(14, Math.max(3, s.distance - chase.d));
      const closeness = (14 - gap) / 11;
      const reach = T.MathUtils.smoothstep(closeness, .82, 1) *
        (chase.reason === "ground" && s.altitude > 10 ? 0 : 1);
      const stride = (14-gap)*Math.PI/2.6;
      const running = (1-reach)*(this.reducedMotion ? 0 : 1);
      const airborne = chase.reason !== "ground";
      const bob = airborne ? 0 : Math.abs(Math.sin(stride))*0.12*running;
      this.cop.position.set(
        chase.x - 1.2 + closeness*.4,
        airborne ? chase.y + .1 : 3.45 + bob,
        gap,
      );
      this.cop.rotation.set((airborne?.35:.12)*running,
        Math.atan2(s.x-this.cop.position.x,-gap),
        Math.sin(stride)*.025*running);
      this.copLegs.forEach((leg,i)=>{
        const phase=stride+i*Math.PI;
        leg.rotation.x=airborne ? .25*running : Math.sin(phase)*.65*running;
        this.copKnees[i].rotation.x=(airborne?.7:Math.max(0,-Math.sin(phase))*1.0)*running;
        this.copArms[i].rotation.x=-Math.sin(phase)*.5*running-reach*1.25;
        this.copArms[i].rotation.z=(i===0?-.08:.08)*(1-reach);
        this.copElbows[i].rotation.x=-.8*(1-reach)-.2*reach;
      });
      const blink = Math.sin(s.time * 20) > 0;
      this.copRed.visible = blink;
      this.copBlue.visible = !blink;
    }
    const sky = new T.Color().setHSL(
      0.55 + (Math.min(s.altitude, 1800) / 1800) * 0.03,
      0.44,
      0.82 - Math.min(s.altitude / 3500, 0.24),
    );
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    this.hero.position.set(s.x, s.altitude + Math.sin(s.time * 2.5) * 0.12, 0);
    const modelScale = ready ? (this.width < 761 ? 1.3 : 1.7) : 1;
    const stretch = !this.reducedMotion && s.dash > 0 ? 0.06 : 0;
    this.hero.scale.set(
      modelScale * (1 - stretch),
      modelScale * (1 + stretch),
      modelScale,
    );
    const rollAngle =
      s.roll > 0 && !this.reducedMotion ? Math.PI * 2 * (1 - s.roll / 0.85) : 0;
    // 开局待机时面向镜头，点开始后丝滑转身背对镜头向前飞。
    // 转身过程中朝向系数 facing 从 1 渐变到 -1：俯仰、侧倾、滚转、转头
    // 都要乘上它，否则转过 180° 之后这些动作在世界坐标里会反掉。
    const turnTarget = ready ? 0 : 1;
    this.turn += (turnTarget - this.turn) * (1 - Math.exp(-visualDt * 2.4));
    const turnEase = this.turn * this.turn * (3 - 2 * this.turn);
    const facing = 1 - 2 * turnEase;
    const yaw = Math.PI * turnEase;
    const steerYaw =
      Math.max(-0.65, Math.min(0.65, s.vx * 0.012)) * facing;
    const bank = Math.max(-0.5, Math.min(0.5, s.vx * 0.009)) * facing;
    this.hero.rotation.set(
      -s.vy * 0.002 * facing,
      yaw + steerYaw,
      -bank + rollAngle * facing + (s.calibrating ? -s.steer * 0.25 : 0),
    );
    const pumping = s.calibrating || (s.thrust > 0 && !ready);
    this.leftArm.rotation.z = pumping
      ? -0.65 + Math.sin(s.time * 10) * 0.13
      : -0.1;
    this.rightArm.rotation.z = pumping
      ? 0.65 - Math.sin(s.time * 10) * 0.13
      : 0.1;
    // 小翅膀：用 rotation.z 做真正的上下扑扇，rotation.y 只做小幅前后扫动
    this.wings.forEach((wing, i) => {
      const side = i === 0 ? -1 : 1;
      const beat = s.time * 13 + i * 0.45;
      // 待机时也慢慢扇，并且抬起来一点：不然从正面会被手臂挡住，看不出是翅膀
      const idle = Math.sin(s.time * 3.2 + i * 0.9) * 0.16;
      wing.rotation.y = side * (pumping ? 0.3 + Math.sin(beat) * 0.42 : 0.5);
      wing.rotation.z =
        side * (pumping ? 0.22 + Math.cos(beat) * 0.6 : 0.3 + idle);
    });
    this.head.rotation.z = Math.sin(s.time * 2) * 0.035;
    // 准备界面：每隔几秒举起右爪打招呼，爪子左右摆 + 歪头 + 眯眼
    let greeting = false;
    if (ready && !s.calibrating && !this.reducedMotion) {
      greeting = s.time % 6.4 < 2.8 || s.time < (s.greetUntil || 0);
      if (greeting) {
        this.rightArm.rotation.z = 2.28 + Math.sin(s.time * 11) * 0.3;
        this.rightArm.rotation.x = Math.sin(s.time * 11 + 1.2) * 0.24;
        this.leftArm.rotation.z = -0.42 - Math.sin(s.time * 11) * 0.06;
        this.head.rotation.z = Math.sin(s.time * 1.6) * 0.1;
      } else {
        this.rightArm.rotation.z = 0.15;
        this.rightArm.rotation.x = 0;
        this.leftArm.rotation.z = -0.15 - Math.sin(s.time * 2) * 0.08;
        this.head.rotation.z = Math.sin(s.time * 1.6) * 0.025;
      }
      this.mouth.scale.y = 1;
    } else this.mouth.scale.y = 1;
    this.head.rotation.y = ready
      ? 0
      : Math.max(-0.22, Math.min(0.22, s.vx * 0.004)) * facing;
    this.leftArm.rotation.z -= Math.max(0, s.vx) * 0.007;
    this.rightArm.rotation.z -= Math.min(0, s.vx) * 0.007;
    this.tail.rotation.z = Math.sin(s.time * 7) * (pumping ? 0.22 : 0.08);
    const blink = s.time % 4.7 < 0.13 ? 0.12 : 1;
    this.eyes.forEach((m, i) => {
      const wink =
        ready && i < 5
          ? s.time < (s.greetUntil || 0)
            ? 0.14
            : greeting
              ? 0.55
              : 1
          : 1;
      m.scale.y = m.userData.openScaleY * blink * wink;
    });
    this.bubble.position.copy(this.hero.position);
    this.bubble.visible = s.shield > 0 || s.dash > 0;
    this.bubble.material.opacity = s.dash > 0 ? 0.12 : 0.22;
    this.nozzle
      .set(0, -1.9 * modelScale, -0.92 * modelScale)
      .applyQuaternion(this.hero.quaternion)
      .add(this.hero.position);
    // Downwards in world space, slightly towards the back; never aim the stream at the camera.
    this.jetDirection.set(0, -1, -0.12).normalize();
    const jetLength = s.dash > 0 ? 1.8 : 1;
    this.jet.position
      .copy(this.nozzle)
      .addScaledVector(this.jetDirection, 3.5 * jetLength);
    this.jet.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      this.jetDirection.clone().negate(),
    );
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
      strand.quaternion.copy(this.jet.quaternion);
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
          const force = s.dash > 0 ? 205 : 120;
          p.vx = s.vx + this.jetDirection.x * force + (Math.random() - 0.5) * 2;
          p.vy = (ready ? 0 : s.vy) + this.jetDirection.y * force;
          p.vz =
            this.jetDirection.z * force -
            this.frameSpeed +
            (Math.random() - 0.5) * 2;
        }
      }
    }
    for (const p of this.particles)
      if (p.life > 0) {
        p.life -= visualDt;
        p.mesh.visible = p.life > 0;
        p.mesh.position.x += p.vx * visualDt;
        p.vy -= p.gravity * visualDt;
        p.mesh.position.y += p.vy * visualDt;
        p.mesh.position.z += (p.vz + this.frameSpeed) * visualDt;
        if (p.mesh.position.y < 0.2) p.life = 0;
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
        else if(o.type === "bird") {
          o.wings.forEach((wing,i)=>wing.rotation.z=(i===0?-1:1)*Math.sin(s.time*9+o.d)*.5);
          o.mesh.rotation.z = Math.sin(s.time*3+o.d)*.05;
        } else o.mesh.rotation.z = Math.sin(s.time * 3 + o.d) * 0.06;
      }
    }
    this.pulseTime = Math.max(0, this.pulseTime - visualDt);
    this.pulse.visible = this.pulseTime > 0;
    this.pulse.scale.setScalar(1 + (1 - this.pulseTime / 0.65) * 65);
    this.pulse.material.opacity = this.pulseTime * 0.6;
    const targetPosition = new T.Vector3(
      s.x + (ready ? 0 : chase ? 10 : 4.5),
      s.altitude + (ready ? 2 : chase ? 8 : 6 - s.vy * 0.015),
      ready ? 24 : chase ? 29 : s.dash > 0 ? 29 : 22,
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
      s.x + (ready ? (this.width < 761 ? 0 : -5.4) : 0),
      s.altitude + (ready ? (this.width < 761 ? -4.8 : 1) : 2),
      ready ? 0 : chase ? 5 : -27,
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
