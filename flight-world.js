/* 天气 / 时段预设。每套定义天空渐变、雾、光照、云色，外加降水与闪电强度；
   切换时整套参数在 updateWeather() 里插值过渡，所以是渐变而不是硬切。 */
const WEATHER_PRESETS = [
  { key: "clear", label: "晴空",
    skyTop: "#4f9fe0", skyBottom: "#d3ecf4", fogColor: "#cce4e8", fogNear: 170, fogFar: 680,
    hemiSky: "#f6fbff", hemiGround: "#87a26f", hemiPower: 2.5,
    sunColor: "#fff2cd", sunPower: 3.2, sunDir: [-30, 70, 40],
    cloudColor: "#f6fbf6", discColor: "#fff6d8", disc: 0.35, discSize: 90,
    stars: 0, rain: 0, rainSpeed: 0, rainLen: 0, rainDrift: 0, rainColor: "#cfe6ff", lightning: 0 },
  { key: "sunset", label: "落日",
    skyTop: "#2f4f92", skyBottom: "#ffb173", fogColor: "#f2bd90", fogNear: 150, fogFar: 600,
    hemiSky: "#ffd9ac", hemiGround: "#7a5a46", hemiPower: 2.1,
    sunColor: "#ffb765", sunPower: 3.8, sunDir: [-210, 30, -140],
    cloudColor: "#ffe2c8", discColor: "#ffd08a", disc: 1, discSize: 150,
    stars: 0.1, rain: 0, rainSpeed: 0, rainLen: 0, rainDrift: 0, rainColor: "#cfe6ff", lightning: 0 },
  { key: "storm", label: "雷雨",
    skyTop: "#232c3b", skyBottom: "#5d6a7e", fogColor: "#5f6b7d", fogNear: 70, fogFar: 380,
    hemiSky: "#9fb0c6", hemiGround: "#4a5563", hemiPower: 1.5,
    sunColor: "#b9c6d8", sunPower: 1.1, sunDir: [-90, 60, -80],
    cloudColor: "#6d7787", discColor: "#cfd8e6", disc: 0, discSize: 90,
    stars: 0, rain: 1, rainSpeed: 120, rainLen: 6.5, rainDrift: 6, rainColor: "#e2efff", lightning: 0.55 },
  { key: "rainbow", label: "彩虹",
    skyTop: "#3f8fd8", skyBottom: "#e2f2f7", fogColor: "#dcf0f4", fogNear: 200, fogFar: 720,
    hemiSky: "#f8feff", hemiGround: "#8fae7e", hemiPower: 2.6,
    sunColor: "#fff6d6", sunPower: 3.4, sunDir: [-130, 48, -170],
    cloudColor: "#ffffff", discColor: "#fff3cf", disc: 0.7, discSize: 110,
    stars: 0, rain: 0, rainSpeed: 0, rainLen: 0, rainDrift: 0, rainColor: "#cfe6ff",
    lightning: 0, rainbow: 1 },
  { key: "night", label: "星夜",
    skyTop: "#081129", skyBottom: "#2b3f68", fogColor: "#22304f", fogNear: 150, fogFar: 620,
    hemiSky: "#8fa6d8", hemiGround: "#2a3348", hemiPower: 1.1,
    sunColor: "#cfe0ff", sunPower: 0.9, sunDir: [120, 90, -150],
    cloudColor: "#9aa8c4", discColor: "#eef3ff", disc: 0.9, discSize: 70,
    stars: 1, rain: 0, rainSpeed: 0, rainLen: 0, rainDrift: 0, rainColor: "#cfe6ff", lightning: 0 },
  { key: "snow", label: "飘雪",
    skyTop: "#8fa8bf", skyBottom: "#dfe9ef", fogColor: "#dbe6ee", fogNear: 90, fogFar: 430,
    hemiSky: "#f2f8ff", hemiGround: "#9fae9a", hemiPower: 2.4,
    sunColor: "#eaf2ff", sunPower: 2.2, sunDir: [-60, 80, -40],
    cloudColor: "#eef4fa", discColor: "#ffffff", disc: 0.2, discSize: 90,
    stars: 0, rain: 1, rainSpeed: 16, rainLen: 0.8, rainDrift: 5, rainColor: "#ffffff", lightning: 0 },
];
/* 地标主题：换一套就换地面、水体、山脊、建筑配色，以及沿航线出现的地标。
   地标全部用现有的方块 / 球体拼出来，风格和游戏一致，不需要外部模型。 */
/* 地形的滚动周期：山脉铺两个周期，且形状只取决于 k % 14，
   所以每次回绕（偏移归零）画面完全一致，循环点看不出来。 */
const TERRAIN_PERIOD = 14 * 95;
const SCENE_THEMES = [
  { key: "city", label: "摩天都市",
    ground: "#adc8a1", water: "#7ec7d8", waterWidth: 45, tree: "#7ea982", trees: true,
    palette: ["#d4ded1", "#e9dfc8", "#d5dedf", "#edcda9", "#b2c9ba"],
    roads: true, blocks: true, wall: false, mountains: 14, mountainSpread: 420,
    rock: "#8db3a6", rockAlt: "#a2c4b8",
    build: { minH: 10, maxH: 56, minW: 16, wVar: 12, tall: 0.5, roof: "unit" },
    landmarks: ["tower", "eiffel"] },
  { key: "wall", label: "长城",
    ground: "#a8b483", water: null, tree: "#6f8f5f", trees: false,
    palette: ["#c9c3a6", "#bdb596", "#d3ccb0", "#b5ac8c", "#c6bfa2"],
    roads: false, blocks: false, wall: true, wallColor: "#b9ae94", wallTop: "#a89d84",
    // blocks 关掉了，但 cityUpdate 的循环照跑（只是不可见），所以必须也有 build，
    // 否则 theme.build 是 undefined，会直接抛异常把整个渲染循环打断。
    build: { minH: 8, maxH: 30, minW: 18, wVar: 12, tall: 0.3, roof: "unit" },
    mountains: 34, mountainSpread: 150,
    rock: "#8fa07a", rockAlt: "#9db08a",
    landmarks: ["watchtower", "watchtower", "bigben"] },
  { key: "london", label: "伦敦",
    ground: "#9fb894", water: "#6f9fc0", waterWidth: 60, tree: "#6f9a6a", trees: true,
    palette: ["#cbb79c", "#dcc7a6", "#b9a894", "#e0d2b6", "#a9b3a5"],
    roads: true, blocks: true, wall: false, mountains: 6, mountainSpread: 520,
    rock: "#8aa39a", rockAlt: "#9db5ac",
    // 伦敦：低而宽的联排房 + 烟囱，天际线压得低，泰晤士河才显得开阔
    build: { minH: 8, maxH: 28, minW: 23, wVar: 14, tall: 0.2, roof: "chimney" },
    landmarks: ["bigben", "eye", "towerbridge"] },
  { key: "sydney", label: "悉尼",
    ground: "#b6c6a8", water: "#5fb4cf", waterWidth: 78, tree: "#7fae7a", trees: true,
    palette: ["#e2e0d4", "#cfd6d2", "#e8dcc4", "#c3ccc9", "#dcd3c0"],
    roads: true, blocks: true, wall: false, mountains: 5, mountainSpread: 560,
    rock: "#93b0a4", rockAlt: "#a6c2b6",
    // 悉尼：高瘦的玻璃塔 + 楼顶桅杆，天际线拔高
    build: { minH: 14, maxH: 66, minW: 15, wVar: 13, tall: 0.62, roof: "mast" },
    landmarks: ["opera", "harbourbridge", "tower"] },
];
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
    // 光源要留着引用：天气系统会按预设改颜色、强度和太阳方向
    this.hemi = new T.HemisphereLight("#f6fbff", "#87a26f", 2.5);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight("#fff2cd", 3.2);
    this.sun.position.set(-30, 70, 40);
    this.scene.add(this.sun);
    this.makeWeather(T);
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
      eye.userData.openScaleY=1;eye.userData.side=side;this.eyes.push(eye);

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
    // 鬼脸用的舌头：平时藏起来，做鬼脸时伸出来晃两下
    this.tongue=new T.Mesh(sphere,new T.MeshStandardMaterial({color:'#ef7d97',roughness:.5}));
    this.tongue.scale.set(.19,.12,.14);
    this.tongue.position.set(0,-.72,surface(0,-.72)+.10);
    this.tongue.visible=false;
    this.head.add(this.tongue);

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
    // 一对翅膀。奶龙本体原本没有翅膀，补上之后背对镜头飞行时一眼能看出来。
    // 做成 根 → 中段 → 翼尖 三层嵌套：上层转动时下层可以滞后一拍再追上，
    // 扇起来才有"甩"的韧性，而不是一块硬板子在摆。五片羽瓣由内到外变小。
    this.wings = [];
    const wingSkin = new T.MeshStandardMaterial({ color: '#fff1c2', roughness: .58 });
    const wingTip = new T.MeshStandardMaterial({ color: '#f6d68a', roughness: .66 });
    const wingEdge = new T.MeshStandardMaterial({ color: '#ffe9a8', roughness: .62 });
    for (const side of [-1, 1]) {
      const wing = new T.Group();
      wing.position.set(side * .84, .42, -.62);   // 肩后，根部略埋进身体
      dragon.add(wing);
      const mid = new T.Group();
      mid.position.set(side * .85, .06, 0);
      wing.add(mid);
      const tip = new T.Group();
      tip.position.set(side * .85, .08, -.02);
      mid.add(tip);
      oval(wing, wingSkin, [side * .42, .02, .04], [.76, .33, .27]);
      oval(mid, wingSkin, [side * .06, .03, .02], [.56, .30, .24]);
      oval(mid, wingTip, [side * .62, .14, -.01], [.52, .25, .21]);
      oval(tip, wingEdge, [side * .18, .12, -.02], [.46, .22, .18]);
      oval(tip, wingSkin, [side * .74, .24, -.04], [.36, .17, .14]);
      wing.userData.mid = mid;
      wing.userData.tip = tip;
      this.wings.push(wing);
    }
    return dragon;
  }

  makeCity() {
    const T = THREE;
    this.city = new T.Group();
    this.scene.add(this.city);
    this.ground = new T.Mesh(new T.PlaneGeometry(5000, 5000), this.mat("#adc8a1"));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -1;
    this.scene.add(this.ground);
    this.buildings = new T.InstancedMesh(
      this.box,
      new T.MeshStandardMaterial({ roughness: 0.85 }),
      230,
    );
    this.city.add(this.buildings);
    this.windows = new T.InstancedMesh(this.box, this.mat("#e4f4ea"), 230 * 6);
    this.city.add(this.windows);
    // 压顶（楼顶那圈浅色薄板）：主要作用是把轮廓勾清楚，比纯方块"精致"很多
    this.caps = new T.InstancedMesh(
      this.box,
      new T.MeshStandardMaterial({ roughness: 0.8 }),
      230,
    );
    this.city.add(this.caps);
    // 高楼退台：天际线不至于全是等宽方柱
    this.tiers = new T.InstancedMesh(
      this.box,
      new T.MeshStandardMaterial({ roughness: 0.82 }),
      230,
    );
    this.city.add(this.tiers);
    // 楼顶细节：桅杆 / 烟囱 / 设备房
    this.roofs = new T.InstancedMesh(
      new T.ConeGeometry(1, 1, 6),
      new T.MeshStandardMaterial({ roughness: 0.7 }),
      230,
    );
    this.city.add(this.roofs);
    this.trees = new T.InstancedMesh(
      new T.ConeGeometry(3, 11, 7),
      this.mat("#7ea982"),
      180,
    );
    this.city.add(this.trees);
    // 穿环时炸开的冲击环（环是一颗一颗过的，一个就够）
    this.ringWave = new T.Mesh(
      new T.TorusGeometry(1, 0.055, 8, 48),
      new T.MeshBasicMaterial({
        color: "#fff3b0",
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.ringWave.visible = false;
    this.scene.add(this.ringWave);
    this.ringWaveTime = 0;
    this.matrix = new T.Object3D();
    this.roads = [];
    for (let i = 0; i < 9; i++)
      this.roads.push(
        this.block(this.city, "#e5d9b8", 0, 0.05, -i * 120, 1500, 0.1, 9),
      );
    // 随主题重建的部分（水体 / 山脊 / 长城）单独放一组，换主题时整组清掉
    // 山脊 / 水体 / 长城单独放一组，挂在场景根上而不是 city 组里。
    // city 是靠 position.z = distance - cz*48 这种锯齿滚动的（建筑本身 48 周期，
    // 所以看不出跳）；地形不是 48 周期，跟着它就会每 48 单位抖一下 —— 飞行时
    // 约 0.58 秒一次，就是"画面跳变"的来源。这里改成按地形自己的周期无缝滚动。
    this.terrain = new T.Group();
    this.scene.add(this.terrain);
    this.river = null;
    this.mountains = [];
    this.landmarks = [];
    this.landCell = -1;
    this.sceneTheme = -1;
    this.setScene(0, true);
  }

  /** 换地标主题：重铺地面、水体、山脊，并重建地标池。 */
  setScene(index) {
    const T = THREE,
      n = SCENE_THEMES.length;
    const i = ((index % n) + n) % n;
    const theme = SCENE_THEMES[i];
    this.sceneTheme = i;
    while (this.terrain.children.length) {
      const child = this.terrain.children.pop();
      child.parent = null;
    }
    this.mountains = [];
    this.ground.material = this.mat(theme.ground);
    this.trees.visible = theme.trees;
    this.trees.material = this.mat(theme.tree);
    this.buildings.visible = theme.blocks;
    this.windows.visible = theme.blocks;
    this.roads.forEach((r) => (r.visible = theme.roads !== false));
    if (theme.water) {
      // 要盖住"地形偏移 + 雾距"的整段可视范围，短了会看见河尽头
      this.river = this.block(
        this.terrain, theme.water, 0, -0.5, -1100, theme.waterWidth || 45, 1, 3200,
      );
    } else this.river = null;
    // 山脊按 TERRAIN_PERIOD 精确铺两个周期：滚动到下一个周期时画面完全一致，
    // 所以循环点看不出来。形状只取决于 k % PER_MOUNTAINS，保证真的周期。
    const PER_MOUNTAINS = 14;
    const gap = theme.key === "wall" ? 62 : 95;
    const count = Math.max(PER_MOUNTAINS, theme.mountains) * 2;
    for (let k = 0; k < count; k++) {
      const m = k % PER_MOUNTAINS;
      const rock = new T.Mesh(
        new T.ConeGeometry(100 + (m % 3) * 44, 100 + (m % 4) * 30, 5),
        this.mat(m % 2 ? theme.rock : theme.rockAlt),
      );
      rock.position.set(
        (m % 2 ? 1 : -1) * (theme.mountainSpread + (m % 3) * 52),
        20,
        -k * gap,
      );
      this.terrain.add(rock);
      this.mountains.push(rock);
    }
    if (theme.wall) {
      for (const side of [-1, 1]) {
        const x = side * 78;
        // 墙体分两段收分，看起来是垒起来的石墙而不是一块板
        this.block(this.terrain, theme.wallColor, x, 11, -1100, 26, 22, 3200);
        this.block(this.terrain, theme.wallTop, x, 26, -1100, 19, 9, 3200);
        this.block(this.terrain, theme.wallColor, x, 34, -1100, 24, 7, 3200);
        // 密集垛口（内外两侧都要，飞过去才有连续的齿）
        for (let k = 0; k < 130; k++) {
          const z = 40 - k * 24;
          this.block(this.terrain, theme.wallTop, x - 9, 40, z, 5, 7, 11);
          this.block(this.terrain, theme.wallTop, x + 9, 40, z, 5, 7, 11);
        }
      }
    }
    for (const old of this.landmarks) this.scene.remove(old);
    this.landmarks = [];
    const kinds = theme.landmarks;
    for (let k = 0; k < 4; k++) {
      const group = new T.Group();
      this.buildLandmark(kinds[k % kinds.length], group);
      group.visible = false;
      this.scene.add(group);
      this.landmarks.push(group);
    }
    this.landCell = -1;
    return theme;
  }

  cycleScene() {
    return this.setScene((this.sceneTheme || 0) + 1);
  }

  get sceneLabel() {
    return (SCENE_THEMES[this.sceneTheme] || SCENE_THEMES[0]).label;
  }

  /* 地标全部用方块 / 球体拼，和游戏其它部分同一套语汇 */
  buildLandmark(kind, g) {
    const box = (c, x, y, z, sx, sy, sz) => this.block(g, c, x, y, z, sx, sy, sz);
    const T = THREE;
    if (kind === "tower") {
      box("#cfd9d6", 0, 55, 0, 26, 110, 26);
      box("#b9c6c3", 0, 116, 0, 36, 12, 36);
      box("#9fb0ad", 0, 128, 0, 10, 26, 10);
      this.ball(g, "#ffd23f", 0, 144, 0, 7);
    } else if (kind === "eiffel") {
      box("#8a7f6d", 0, 24, 0, 34, 48, 34);
      box("#8a7f6d", 0, 60, 0, 16, 32, 16);
      box("#6f6656", 0, 88, 0, 7, 28, 7);
      this.ball(g, "#ffd23f", 0, 104, 0, 4);
    } else if (kind === "bigben") {
      box("#c9b189", 0, 42, 0, 20, 84, 20);
      box("#b39a70", 0, 88, 0, 25, 8, 25);
      for (const face of [[0, 10.3, 15, 1.6], [0, -10.3, 15, 1.6], [10.3, 0, 1.6, 15], [-10.3, 0, 1.6, 15]])
        box("#fdf7e2", face[0], 64, face[1], face[2], 15, face[3]);
      box("#d8b24a", 0, 104, 0, 13, 24, 13);
      box("#d8b24a", 0, 122, 0, 6, 14, 6);
    } else if (kind === "eye") {
      const R = 46;
      const ring = new T.Mesh(new T.TorusGeometry(R, 2.8, 8, 44), this.mat("#e8eef2"));
      ring.position.set(0, R + 10, 0);
      g.add(ring);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const spoke = box("#dbe3e8", 0, R + 10, 0, 1.4, R * 2, 1.4);
        spoke.rotation.z = a;
        box("#8fd6ff", Math.cos(a) * R, R + 10 + Math.sin(a) * R, 0, 7, 7, 5);
      }
      box("#c9d2d6", -36, R / 2 + 6, 0, 8, R + 12, 10);
      box("#c9d2d6", 36, R / 2 + 6, 0, 8, R + 12, 10);
    } else if (kind === "towerbridge") {
      for (const sx of [-32, 32]) {
        box("#b7a184", sx, 30, 0, 20, 60, 20);
        box("#8fa9c4", sx, 66, 0, 25, 12, 25);
        box("#6f8fae", sx, 80, 0, 10, 18, 10);
      }
      box("#9fb6cd", 0, 22, 0, 46, 8, 14);
      box("#c8d4de", 0, 58, 0, 62, 4, 6);
    } else if (kind === "opera") {
      const shell = new T.SphereGeometry(1, 16, 10, 0, Math.PI, 0, Math.PI / 2);
      const shellMat = new T.MeshStandardMaterial({ color: "#f7faf6", roughness: 0.3 });
      for (let k = 0; k < 4; k++) {
        const sh = new T.Mesh(shell, shellMat);
        sh.scale.set(17 + k * 2, 27 - k * 3, 21);
        sh.position.set(-26 + k * 17, 6, 0);
        sh.rotation.y = -0.36;
        g.add(sh);
      }
      box("#dfe7e2", 0, 3, 0, 80, 6, 34);
    } else if (kind === "harbourbridge") {
      const arch = new T.Mesh(new T.TorusGeometry(58, 3.6, 8, 44, Math.PI), this.mat("#8d9aa6"));
      arch.position.set(0, 4, 0);
      g.add(arch);
      box("#7f8b96", 0, 44, 0, 152, 5, 16);
      for (const sx of [-58, 58]) box("#a8b3bd", sx, 26, 0, 12, 52, 12);
    } else if (kind === "watchtower") {
      box("#b9ae94", 0, 14, 0, 22, 28, 22);
      box("#a89d84", 0, 30, 0, 27, 5, 27);
      for (let k = 0; k < 5; k++)
        box("#9c9179", -10 + k * 5, 35, -10, 4, 6, 4);
      box("#b9ae94", 0, 8, 21, 14, 16, 26);
    }
    return g;
  }

  /** 地形按自己的周期滚动，和 city 的 48 锯齿解耦，这样山脊不会一格一跳。 */
  terrainUpdate(s) {
    this.terrain.position.z = s.distance % TERRAIN_PERIOD;
  }

  /** 地标沿航线周期性出现，越过头顶就绕到最远处（和云的回收方式一致）。 */
  landmarkUpdate(s) {
    // 世界是朝相机流动的：z = 里程 - 地标里程，所以槽号要随里程递增。
    // 之前写成 (cell - i) 会让地标往远处飘，永远掠不过来。
    const SPACING = 260, N = this.landmarks.length;
    if (!N) return;
    const cell = Math.floor(s.distance / SPACING);
    const fresh = cell !== this.landCell;
    this.landmarks.forEach((g, i) => {
      if (fresh) {
        const slot = cell + i + 1;
        const seed = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
        const seed2 = Math.abs(Math.sin(slot * 78.233) * 12345.678) % 1;
        const side = seed > 0.5 ? 1 : -1;
        g.userData.side = side;
        // 相机水平半视角约 38°，120 距离处只看得见 ±94。原来偏到 ±240 全飞在画面外，
        // 收窄到紧贴航线两侧，才能真的从旁边掠过。
        g.position.x = side * (52 + seed2 * 56);
        g.rotation.y = (seed2 - 0.5) * 1.1 + (side > 0 ? Math.PI : 0);
      }
      g.position.z = s.distance - (cell + i + 1) * SPACING;
      g.visible = g.position.z < 60;
    });
    this.landCell = cell;
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
  /**
   * 建筑参数。渲染（cityUpdate）和碰撞（buildingHit）都调这里，
   * 免得两处算法各写一遍、改动之后走偏（走偏了就会出现看不见的墙）。
   */
  buildingSpec(theme, row, col, cz, cx, originX) {
    const b = theme.build || { minH: 8, maxH: 44, minW: 16, wVar: 12, tall: 0.4, roof: "unit" };
    const seed = Math.abs(Math.sin((row + cz - 2) * 37.13 + (col + cx - 5) * 91.7));
    const seed2 = Math.abs(Math.sin((row + cz) * 12.9898 + (col + cx) * 78.233)) % 1;
    const bx = (col - 5) * 48;
    const tall = seed2 > 1 - b.tall;
    const height = b.minH + seed * (b.maxH - b.minH) * (tall ? 1 : 0.55);
    const width = Math.abs(bx + originX) < 36 ? 0 : b.minW + seed2 * b.wVar;
    const tier = Boolean(width && tall && height > b.minH + (b.maxH - b.minH) * 0.55);
    return { seed, seed2, bx, tall, height, width, tier, top: height + (tier ? 16 : 0) };
  }

  cityUpdate(s) {
    const cx = Math.floor(s.x / 48),
      cz = Math.floor(s.distance / 48);
    const cell = cx + "," + cz;
    this.city.position.z = s.distance - cz * 48;
    this.city.position.x = cx * 48;
    if (this.river) this.river.position.x = -cx * 48;
    this.ground.position.set(s.x, -1, 0);
    if (cell === this.cityCell) return;
    this.cityCell = cell;
    let index = 0,
      wi = 0;
    const obj = this.matrix,
      color = new THREE.Color(),
      capColor = new THREE.Color();
    const theme = SCENE_THEMES[this.sceneTheme] || SCENE_THEMES[0];
    const palette = theme.palette;
    for (let row = 0; row < 23; row++)
      for (let col = 0; col < 10; col++) {
        const spec = this.buildingSpec(theme, row, col, cz, cx, cx * 48);
        const x = spec.bx,
          z = (2 - row) * 48,
          bw = spec.width,
          height = spec.height;
        obj.position.set(x, height / 2, z);
        obj.scale.set(bw, bw ? height : 0, bw);
        obj.updateMatrix();
        this.buildings.setMatrixAt(index, obj.matrix);
        color.set(palette[Math.floor(spec.seed * palette.length) % palette.length]);
        this.buildings.setColorAt(index, color);
        // 压顶：比楼身略宽一点点的浅色薄板
        obj.position.set(x, height + 1.3, z);
        obj.scale.set(bw ? bw + 1.8 : 0, bw ? 2.6 : 0, bw ? bw + 1.8 : 0);
        obj.updateMatrix();
        this.caps.setMatrixAt(index, obj.matrix);
        capColor.copy(color).offsetHSL(0, -0.05, 0.1);
        this.caps.setColorAt(index, capColor);
        // 退台
        obj.position.set(x, height + (spec.tier ? 8 : -999), z);
        obj.scale.set(spec.tier ? bw * 0.6 : 0, spec.tier ? 16 : 0, spec.tier ? bw * 0.6 : 0);
        obj.updateMatrix();
        this.tiers.setMatrixAt(index, obj.matrix);
        this.tiers.setColorAt(index, color);
        // 楼顶细节：悉尼用细桅杆，伦敦用矮烟囱，都市用设备房
        const kind = (theme.build || {}).roof || "unit";
        const rh = kind === "mast" ? 22 + spec.seed2 * 18 : kind === "chimney" ? 5 : 4;
        const rw = kind === "mast" ? 1.4 : kind === "chimney" ? 3.6 : 6;
        obj.position.set(
          x + (spec.seed - 0.5) * bw * 0.35,
          height + (spec.tier ? 16 : 2) + rh / 2,
          z + (spec.seed2 - 0.5) * bw * 0.3,
        );
        obj.scale.set(bw ? rw : 0, bw ? rh : 0, bw ? rw : 0);
        obj.updateMatrix();
        this.roofs.setMatrixAt(index, obj.matrix);
        index++;
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
    this.caps.instanceMatrix.needsUpdate = true;
    this.caps.instanceColor.needsUpdate = true;
    this.tiers.instanceMatrix.needsUpdate = true;
    this.tiers.instanceColor.needsUpdate = true;
    this.roofs.instanceMatrix.needsUpdate = true;
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
    const theme = SCENE_THEMES[this.sceneTheme] || SCENE_THEMES[0];
    const b = theme.build || { maxH: 44 };
    if (altitude - radius > b.maxH + 16) return false; // 高过最高塔（含退台）
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
        if (Math.abs(worldX - x) > 24 + radius) continue;
        // 和 cityUpdate 用同一个函数算参数，两边永远不会走偏
        const spec = this.buildingSpec(theme, row, col, cz, cx, originX);
        if (!spec.width) continue; // the river corridor stays clear
        if (altitude - radius >= spec.top) continue; // flying over the roof
        if (
          Math.abs(worldX - x) < spec.width / 2 + radius &&
          Math.abs(worldZ) < spec.width / 2 + radius
        )
          return true;
      }
    }
    return false;
  }
  /* ---- 天气系统 ----------------------------------------------------------
     天空渐变穹顶 + 日月精灵 + 星空 + 降水线段 + 闪电，五套预设之间整套插值。 */
  makeWeather(T) {
    this.skyUniforms = {
      topColor: { value: new T.Color("#4f9fe0") },
      bottomColor: { value: new T.Color("#d3ecf4") },
      flash: { value: 0 },
    };
    this.skyDome = new T.Mesh(
      new T.SphereGeometry(1600, 24, 16),
      new T.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader:
          "varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: [
          "uniform vec3 topColor;",
          "uniform vec3 bottomColor;",
          "uniform float flash;",
          "varying vec3 vPos;",
          "void main(){",
          "  float h = normalize(vPos).y;",
          "  float t = smoothstep(-0.14, 0.62, h);",
          "  gl_FragColor = vec4(mix(bottomColor, topColor, t) + flash, 1.0);",
          "}",
        ].join("\n"),
      }),
    );
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    // 太阳 / 月亮：径向渐变贴图做成精灵，永远正对镜头
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.32, "rgba(255,246,214,0.9)");
    grad.addColorStop(1, "rgba(255,238,196,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    this.sunSprite = new T.Sprite(
      new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }),
    );
    this.sunSprite.visible = false;
    this.scene.add(this.sunSprite);

    // 星空
    const starPos = [];
    for (let i = 0; i < 620; i++) {
      const phi = Math.random() * Math.PI * 2;
      const cosT = 0.06 + Math.random() * 0.9;
      const sinT = Math.sqrt(1 - cosT * cosT);
      starPos.push(Math.cos(phi) * sinT * 1450, cosT * 1450, Math.sin(phi) * sinT * 1450);
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute("position", new T.Float32BufferAttribute(starPos, 3));
    this.starMaterial = new T.PointsMaterial({
      color: "#ffffff", size: 5, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.stars = new T.Points(starGeo, this.starMaterial);
    this.stars.visible = false;
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // 降水：一套线段系统，雨和雪只是参数不同（快 + 长 = 雨，慢 + 短 = 雪）
    const COUNT = 1100;
    this.rainCount = COUNT;
    this.rainPos = new Float32Array(COUNT * 6);
    this.rainSeed = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      this.rainSeed[i * 3] = Math.random();
      this.rainSeed[i * 3 + 1] = Math.random();
      this.rainSeed[i * 3 + 2] = Math.random();
    }
    const rainGeo = new T.BufferGeometry();
    rainGeo.setAttribute("position", new T.BufferAttribute(this.rainPos, 3));
    this.rainMaterial = new T.LineBasicMaterial({
      color: "#c8dcf5", transparent: true, opacity: 0, depthWrite: false,
    });
    this.rain = new T.LineSegments(rainGeo, this.rainMaterial);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    // 雨后彩虹：七个同心半环，摆在前方远处，正对镜头
    this.rainbowGroup = new T.Group();
    ["#ff5f6d", "#ffa03e", "#ffe45c", "#69d16f", "#5cc6f0", "#7d8bf0", "#b07bea"].forEach(
      (color, i) => {
        const band = new T.Mesh(
          new T.TorusGeometry(168 + i * 13, 6.5, 6, 72, Math.PI),
          new T.MeshBasicMaterial({
            color, transparent: true, opacity: 0, depthWrite: false, fog: false,
          }),
        );
        this.rainbowGroup.add(band);
      },
    );
    this.rainbowGroup.visible = false;
    this.scene.add(this.rainbowGroup);

    this.weather = null;
    this.weatherTarget = null;
    this.weatherIndex = -1;
    this.weatherQueue = [];
    this.weatherStep = 0;
    this.weatherHold = 0;
    this.onWeatherChange = null;
    this.flash = 0;
    this.nextBolt = 3;
    this.onLightning = null;
  }

  buildWeather(preset) {
    const T = THREE;
    return {
      skyTop: new T.Color(preset.skyTop),
      skyBottom: new T.Color(preset.skyBottom),
      fogColor: new T.Color(preset.fogColor),
      fogNear: preset.fogNear,
      fogFar: preset.fogFar,
      hemiSky: new T.Color(preset.hemiSky),
      hemiGround: new T.Color(preset.hemiGround),
      hemiPower: preset.hemiPower,
      sunColor: new T.Color(preset.sunColor),
      sunPower: preset.sunPower,
      sunDir: new T.Vector3(preset.sunDir[0], preset.sunDir[1], preset.sunDir[2]).normalize(),
      cloudColor: new T.Color(preset.cloudColor),
      discColor: new T.Color(preset.discColor),
      disc: preset.disc,
      discSize: preset.discSize,
      stars: preset.stars,
      rain: preset.rain,
      rainSpeed: preset.rainSpeed,
      rainLen: preset.rainLen,
      rainDrift: preset.rainDrift,
      rainColor: new T.Color(preset.rainColor),
      lightning: preset.lightning,
      rainbow: preset.rainbow || 0,
    };
  }

  setWeather(index, instant) {
    const n = WEATHER_PRESETS.length;
    this.weatherIndex = ((index % n) + n) % n;
    const preset = WEATHER_PRESETS[this.weatherIndex];
    this.weatherTarget = this.buildWeather(preset);
    if (instant || !this.weather) this.weather = this.buildWeather(preset);
    return preset;
  }

  /* 一局之内的天气推进。顺序是「晴 → 雷雨 → 彩虹 → 落日 → 星夜 → 飘雪」，
     每 weatherHold 秒换一次，所以飞得越久看到的天气越多。
     每套之间是插值过渡，不会有硬切。 */
  startWeatherRun() {
    const order = ["clear", "storm", "rainbow", "sunset", "night", "snow"];
    this.weatherQueue = order
      .map((key) => WEATHER_PRESETS.findIndex((p) => p.key === key))
      .filter((i) => i >= 0);
    this.weatherStep = 0;
    this.weatherHold = 24;
    return this.setWeather(this.weatherQueue[0], true);
  }

  cycleWeather() {
    if (this.weatherQueue.length) {
      this.weatherStep = (this.weatherStep + 1) % this.weatherQueue.length;
      this.weatherHold = 24;
      return this.setWeather(this.weatherQueue[this.weatherStep]);
    }
    return this.setWeather(this.weatherIndex + 1);
  }

  get weatherLabel() {
    return (WEATHER_PRESETS[this.weatherIndex] || WEATHER_PRESETS[0]).label;
  }

  applyWeather() {
    const w = this.weather;
    if (!w) return;
    this.scene.background.copy(w.fogColor);
    this.scene.fog.color.copy(w.fogColor);
    this.scene.fog.near = w.fogNear;
    this.scene.fog.far = w.fogFar;
    this.hemi.color.copy(w.hemiSky);
    this.hemi.groundColor.copy(w.hemiGround);
    this.hemi.intensity = w.hemiPower + this.flash * 2.6;
    this.sun.color.copy(w.sunColor);
    this.sun.intensity = w.sunPower + this.flash * 1.8;
    this.sun.position.copy(w.sunDir).multiplyScalar(140);
    this.skyUniforms.topColor.value.copy(w.skyTop);
    this.skyUniforms.bottomColor.value.copy(w.skyBottom);
    this.skyUniforms.flash.value = this.flash * 0.75;
    if (this.cloudMaterial) this.cloudMaterial.color.copy(w.cloudColor);
    this.starMaterial.opacity = w.stars;
    this.rainMaterial.color.copy(w.rainColor);
    this.rainMaterial.opacity = w.rain * 0.95;
  }

  updateWeather(s, dt) {
    if (!this.weather) this.setWeather(0, true);

    // 一局之内按时间推进天气
    if (this.weatherHold > 0 && s.mode === "running" && !s.calibrating) {
      this.weatherHold -= dt;
      if (this.weatherHold <= 0) {
        const total = Math.max(1, this.weatherQueue.length);
        this.weatherStep = (this.weatherStep + 1) % total;
        const preset = this.setWeather(this.weatherQueue[this.weatherStep]);
        this.weatherHold = 24;
        if (this.onWeatherChange) this.onWeatherChange(preset);
      }
    }

    const cur = this.weather, tgt = this.weatherTarget;
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 0.9);
    for (const key of ["skyTop", "skyBottom", "fogColor", "hemiSky", "hemiGround",
      "sunColor", "cloudColor", "discColor", "rainColor"]) {
      cur[key].lerp(tgt[key], k);
    }
    for (const key of ["fogNear", "fogFar", "hemiPower", "sunPower", "disc", "discSize",
      "stars", "rain", "rainSpeed", "rainLen", "rainDrift", "lightning", "rainbow"]) {
      cur[key] += (tgt[key] - cur[key]) * k;
    }
    cur.sunDir.lerp(tgt.sunDir, k).normalize();

    // 闪电：随机间隔打一下，顺便通知外部放雷声
    this.flash *= Math.exp(-dt * 3.6);
    if (cur.lightning > 0.05) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.flash = 1;
        this.nextBolt = 2.4 + Math.random() * 5.5;
        if (this.onLightning) this.onLightning();
      }
    }

    // 越高天空越深、雾越薄 —— 保留原来"往上蹿就是上天"的感觉
    const high = Math.min(s.altitude / 3200, 0.3);
    this.skyUniforms.topColor.value.copy(cur.skyTop).multiplyScalar(1 - high * 0.45);
    this.skyUniforms.bottomColor.value.copy(cur.skyBottom).multiplyScalar(1 - high * 0.18);

    this.applyWeather();

    // 穹顶 / 星空 / 日月是"贴在天上"的，必须挂在相机身上。
    // 注意不能用 s.distance：它是累计里程，几秒后就把整片天推到相机背后了。
    this.skyDome.position.set(s.x, s.altitude, 0);
    this.stars.position.set(s.x, s.altitude, 0);
    this.stars.visible = cur.stars > 0.02;
    if (this.stars.visible) this.stars.rotation.y += dt * 0.012;

    const discX = s.x + cur.sunDir.x * 1250;
    const discY = s.altitude + cur.sunDir.y * 1250;
    const discZ = cur.sunDir.z * 1250;
    this.sunSprite.position.set(discX, discY, discZ);
    this.sunSprite.material.color.copy(cur.discColor);
    this.sunSprite.material.opacity = cur.disc;
    this.sunSprite.scale.setScalar(cur.discSize);
    this.sunSprite.visible = cur.disc > 0.02;

    // 彩虹
    this.rainbowGroup.visible = cur.rainbow > 0.02;
    if (this.rainbowGroup.visible) {
      this.rainbowGroup.position.set(s.x, s.altitude + 22, -860);
      for (const band of this.rainbowGroup.children) {
        band.material.opacity = cur.rainbow * 0.6;
      }
    }

    // 降水
    this.rain.visible = cur.rain > 0.02;
    if (this.rain.visible) {
      const SPAN_X = 160, SPAN_Y = 170, SPAN_Z = 240;
      // 世界是朝相机流动的，雨幕也要跟着流：z 每帧朝镜头推进，越过就绕回远处。
      // 用每滴自己的随机 z，所以不会有"整片雨一起跳"的破绽。
      const worldSpeed = Math.min(400, Math.max(0, (s.distance - (this.lastDistance ?? s.distance)) / Math.max(dt, 1e-3)));
      this.lastDistance = s.distance;
      const fall = (cur.rainSpeed * dt) / SPAN_Y;
      const flow = (worldSpeed * dt) / SPAN_Z;
      const arr = this.rainPos, seed = this.rainSeed;
      for (let i = 0; i < this.rainCount; i++) {
        const b = i * 6;
        let y = seed[i * 3 + 1] - fall;
        if (y < 0) y += 1;
        seed[i * 3 + 1] = y;
        let zr = seed[i * 3 + 2] - flow;
        if (zr < 0) zr += 1;
        seed[i * 3 + 2] = zr;
        const drift = Math.sin(s.time * 1.3 + i * 0.7) * cur.rainDrift;
        const x = s.x + (seed[i * 3] - 0.5) * SPAN_X + drift;
        const z = -10 - zr * SPAN_Z;
        const py = s.altitude - 45 + y * SPAN_Y;
        arr[b] = x;
        arr[b + 1] = py;
        arr[b + 2] = z;
        arr[b + 3] = x + drift * 0.05;
        arr[b + 4] = py + cur.rainLen;
        arr[b + 5] = z + (cur.rainSpeed > 40 ? 1.4 : 0.15);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }

  makeClouds() {
    // 云单独用一个材质实例，天气系统才能整体染色（雨云发灰、落日发暖）
    this.cloudMaterial = new THREE.MeshStandardMaterial({ color: "#f6fbf6", roughness: 0.9 });
    this.clouds = [];
    for (let i = 0; i < 32; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(this.sphere, this.cloudMaterial);
        puff.position.set((j - 1.5) * 7, Math.sin(j * 2) * 3, 0);
        puff.scale.set(8, 4 + (j % 2) * 2, 5);
        g.add(puff);
      }
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
  /**
   * 光环被穿过：碎成一片玻璃雨 + 一圈冲击波，环体本身放大淡出。
   * 碎片是沿环的半径向外飞的（不是随机四散），看起来才像"被撞碎"。
   */
  breakRing(o, distance) {
    if (!o || o.shatter > 0) return;
    o.shatterTotal = 0.55;
    o.shatter = o.shatterTotal;
    const z = distance - o.d;
    const ringR = 7.5;
    for (let i = 0; i < 26; i++) {
      const p = this.particles.find((q) => q.life <= 0);
      if (!p) break;
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.22;
      this.launchParticle(
        p,
        o.x + Math.cos(a) * ringR,
        o.y + Math.sin(a) * ringR,
        z,
        "rainbow",
        true,
      );
      const out = 24 + Math.random() * 22;
      p.vx = Math.cos(a) * out;
      p.vy = Math.sin(a) * out;
      p.vz = (Math.random() - 0.5) * 18 - (this.frameSpeed || 0) * 0.25;
      p.gravity = 10;
      p.life = 1.1;
    }
    this.ringWave.position.set(o.x, o.y, z);
    this.ringWave.rotation.set(0, 0, 0);
    this.ringWaveTime = 0.5;
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
    this.landmarkUpdate(s);
    this.terrainUpdate(s);
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
    this.updateWeather(s, visualDt);
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
    // 穿环时来一个快速侧滚当庆祝动作
    const ringSpin =
      s.ringSpin > 0 && !this.reducedMotion
        ? Math.PI * 2 * (1 - s.ringSpin / 0.6)
        : 0;
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
      -bank +
        (rollAngle + ringSpin) * facing +
        (s.calibrating ? -s.steer * 0.25 : 0),
    );
    const pumping = s.calibrating || (s.thrust > 0 && !ready);
    this.leftArm.rotation.z = pumping
      ? -0.65 + Math.sin(s.time * 10) * 0.13
      : -0.1;
    this.rightArm.rotation.z = pumping
      ? 0.65 - Math.sin(s.time * 10) * 0.13
      : 0.1;
    // ---- 大厅待机小动作：轮流做，让奶龙看起来是活的 ----
    let waveK = 0, faceK = 0, stretchK = 0;
    if (ready && !s.calibrating && !this.reducedMotion) {
      if (!this.idlePlan) {
        this.idlePlan = [
          ["rest", 2.0], ["wave", 3.0], ["face", 2.4],
          ["rest", 1.4], ["stretch", 2.8], ["wave", 2.4], ["face", 2.0],
        ];
      }
      if (this.idleUntil === undefined || s.time >= this.idleUntil) {
        this.idleStep = ((this.idleStep === undefined ? -1 : this.idleStep) + 1) % this.idlePlan.length;
        const [name, hold] = this.idlePlan[this.idleStep];
        this.idleName = name;
        this.idleFrom = s.time;
        this.idleUntil = s.time + hold;
      }
      // 戳一下优先用挥手回应
      const name = s.time < (s.greetUntil || 0) ? "wave" : this.idleName;
      const span = Math.max(0.2, this.idleUntil - this.idleFrom);
      const at = Math.min(1, Math.max(0, (s.time - this.idleFrom) / span));
      const env = Math.pow(Math.sin(Math.PI * at), 0.7); // 起手 → 收势的包络
      if (name === "wave") waveK = env;
      else if (name === "face") faceK = env;
      else if (name === "stretch") stretchK = env;
    }

    // ---- 翅膀：多频率叠加 + 平滑追赶 + 末端滞后，扇起来有惯性也有韧性 ----
    if (!this.wingAngle) {
      this.wingAngle = [0, 0];
      this.wingSweep = [0, 0];
    }
    const wingBeat = s.time * 12.5;
    this.wings.forEach((wing, i) => {
      const side = i === 0 ? -1 : 1;
      const phase = wingBeat + i * 0.55;
      const swing =
        Math.sin(phase) * 0.5 +
        Math.sin(phase * 0.43 + i * 1.7) * 0.19 +
        Math.sin(phase * 2.7 + i) * 0.05;
      let targetZ, targetY, targetX;
      if (pumping) {
        targetZ = 0.28 + swing;
        targetY = 0.30 + Math.sin(phase + 1.1) * 0.36;
        targetX = Math.sin(phase * 0.8 + i * 2.1) * 0.26;
      } else {
        // 待机：微微上扬 + 慢呼吸 + 一点小抖；展翅动作时高高张开
        const breathe = Math.sin(s.time * 2.6 + i * 1.1) * 0.22;
        const jitter = Math.sin(s.time * 5.1 + i * 2.3) * 0.08;
        targetZ = 0.34 + breathe + jitter + stretchK * 0.6;
        targetY = 0.50 - stretchK * 0.42 + Math.sin(s.time * 1.7 + i) * 0.14;
        targetX = Math.sin(s.time * 1.9 + i * 2.4) * 0.12 - stretchK * 0.12;
      }
      const k = 1 - Math.exp(-visualDt * (pumping ? 22 : 9));
      this.wingAngle[i] += (targetZ - this.wingAngle[i]) * k;
      this.wingSweep[i] += (targetY - this.wingSweep[i]) * k;
      // 还没追上的差值就代表当前转速：中段和翼尖按它反向滞后，形成鞭甩
      const remain = targetZ - this.wingAngle[i];
      const whip = Math.max(-0.45, Math.min(0.45, remain * 0.9));
      wing.rotation.z = side * this.wingAngle[i];
      wing.rotation.y = side * this.wingSweep[i];
      wing.rotation.x = targetX;
      const mid = wing.userData.mid, tip = wing.userData.tip;
      if (mid) mid.rotation.z = -side * whip * 0.55;
      if (tip)
        tip.rotation.z =
          -side * whip * 1.05 + side * Math.sin(phase * 1.7 + i) * 0.06;
    });

    // ---- 手臂 / 头：待机放松、挥手、展翅 ----
    if (ready && !s.calibrating && !this.reducedMotion) {
      this.rightArm.rotation.z =
        0.15 + waveK * (2.13 + Math.sin(s.time * 11) * 0.3) + stretchK * 2.2;
      this.rightArm.rotation.x = waveK * Math.sin(s.time * 11 + 1.2) * 0.24;
      this.leftArm.rotation.z =
        -0.15 - Math.sin(s.time * 2) * 0.08 - waveK * 0.27 - stretchK * 2.2;
      this.head.rotation.z =
        Math.sin(s.time * 1.6) * 0.025 +
        waveK * Math.sin(s.time * 1.6) * 0.075 +
        faceK * Math.sin(s.time * 9) * 0.05;
      this.head.rotation.y = 0;
      this.head.rotation.x = faceK * -0.06;
    } else {
      this.head.rotation.y = Math.max(-0.22, Math.min(0.22, s.vx * 0.004)) * facing;
      this.head.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
    this.leftArm.rotation.z -= Math.max(0, s.vx) * 0.007;
    this.rightArm.rotation.z -= Math.min(0, s.vx) * 0.007;
    this.tail.rotation.z = Math.sin(s.time * 7) * (pumping ? 0.22 : 0.08);

    // ---- 鬼脸：斗鸡眼 + 吐舌头 + 脸被挤扁 ----
    this.head.scale.set(1 + faceK * 0.06, 1 - faceK * 0.08, 1);
    this.tongue.visible = faceK > 0.12;
    this.tongue.scale.set(0.19, 0.12 * (0.5 + faceK * 0.8), 0.14);
    this.tongue.rotation.z = Math.sin(s.time * 13) * 0.25 * faceK;
    const blink = s.time % 4.7 < 0.13 ? 0.12 : 1;
    this.eyes.forEach((m) => {
      const side = m.userData.side || 1;
      m.rotation.y = side * (0.21 - faceK * 0.85); // 眼珠往里转 = 斗鸡眼
      const wink =
        ready && !s.calibrating
          ? s.time < (s.greetUntil || 0)
            ? 0.14
            : faceK > 0.3
              ? 0.3
              : waveK > 0.3
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
        if (o.type === "ring") {
          if (o.shatter > 0) {
            // 碎裂：一边转一边放大一边淡出，转完就藏起来等回收
            o.shatter = Math.max(0, o.shatter - visualDt);
            const k = 1 - o.shatter / o.shatterTotal;
            o.mesh.rotation.z = s.time * 0.13 + k * 2.6;
            o.mesh.scale.setScalar(1 + k * 1.9);
            for (const m of o.ownedMaterials || []) {
              m.transparent = true;
              m.opacity = 1 - k;
            }
            if (o.shatter <= 0) o.mesh.visible = false;
          } else o.mesh.rotation.z = s.time * 0.13;
        }
        else if(o.type === "bird") {
          o.wings.forEach((wing,i)=>wing.rotation.z=(i===0?-1:1)*Math.sin(s.time*9+o.d)*.5);
          o.mesh.rotation.z = Math.sin(s.time*3+o.d)*.05;
        } else o.mesh.rotation.z = Math.sin(s.time * 3 + o.d) * 0.06;
      }
    }
    this.ringWaveTime = Math.max(0, this.ringWaveTime - visualDt);
    this.ringWave.visible = this.ringWaveTime > 0;
    if (this.ringWave.visible) {
      const k = 1 - this.ringWaveTime / 0.5;
      this.ringWave.scale.setScalar(7.5 * (1 + k * 2.8));
      this.ringWave.material.opacity = 0.75 * (1 - k) * (1 - k);
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
