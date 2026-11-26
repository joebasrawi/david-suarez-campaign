// Photorealistic engine: Google Photorealistic 3D Tiles in CesiumJS, with the Live Local overlays on top.
// Loaded only when the page has a Google Maps key; any failure falls back to the stylized MapLibre engine.
const BASE = 'https://cdn.jsdelivr.net/npm/cesium@1.123.0/Build/Cesium/';
const CORAL = '#ff6a45', MINT = '#78d6c8', AMBER = '#edbd79', TALLER = '#bfefff';

const loadScript = src => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src)); document.head.appendChild(s); });
const loadCss = href => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); };
const ring = g => (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function create({ data, apps, byId, cb, key }) {
  window.CESIUM_BASE_URL = BASE;
  loadCss(BASE + 'Widgets/widgets.css');
  await loadScript(BASE + 'Cesium.js');
  const C = window.Cesium;
  C.GoogleMaps.defaultApiKey = key;

  const state = { active: null };
  const container = document.getElementById('map');
  const viewer = new C.Viewer(container, {
    globe: false, baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false
  });
  const scene = viewer.scene;
  scene.screenSpaceCameraController.minimumZoomDistance = 60;
  scene.screenSpaceCameraController.maximumZoomDistance = 40000;

  const tileset = await C.createGooglePhotorealistic3DTileset(undefined, { showCreditsOnScreen: true });
  scene.primitives.add(tileset);
  container.classList.add('is-photo');

  // Ground level: sample the sea surface just off the beach (ellipsoid height) and add ~1.5 m for street level.
  let ground = -24.5;
  try {
    const [sea] = await Promise.race([
      scene.sampleHeightMostDetailed([C.Cartographic.fromDegrees(-80.1165, 25.8005)], [tileset]),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 6000))
    ]);
    if (Number.isFinite(sea?.height) && sea.height < 0 && sea.height > -40) ground = sea.height + 1.5;
  } catch { /* keep the estimate */ }

  const feet = ft => ft * 0.3048;
  const projM = a => (a.heightFt ? feet(a.heightFt) : 0);
  const fromRing = r => C.Cartesian3.fromDegreesArray(r.flat());
  let grow = cb.reduced ? 1 : 0;

  // Parcels: approved = translucent coral volume (grows to height) + draped coral; review = pulsing mint drape on the real ground.
  const entities = [];
  const seen = new Set();
  for (const f of data.parcels.features) {
    const a = byId.get(f.properties.id); if (!a) continue;
    const k = JSON.stringify(ring(f.geometry)[0]); if (seen.has(k)) continue; seen.add(k);
    const dev = a.layer === 'dev', main = dev ? AMBER : CORAL;
    const hierarchy = new C.PolygonHierarchy(fromRing(ring(f.geometry)));
    if (a.stage === 'approved' && projM(a) > 0) {
      entities.push(viewer.entities.add({ id: `ll:${a.id}:vol:${entities.length}`, polygon: {
        hierarchy, height: ground, extrudedHeight: new C.CallbackProperty(() => ground + Math.max(0.5, projM(a) * grow), false),
        material: new C.ColorMaterialProperty(new C.CallbackProperty(() => C.Color.fromCssColorString(main).withAlpha(state.active === a.id ? .72 : dev ? .42 : .5), false)),
        outline: true, outlineColor: C.Color.fromCssColorString(dev ? '#f8e4bd' : '#ffd2c4'), outlineWidth: 1 }, properties: { app: a.id, stage: a.stage, layer: a.layer } }));
    }
    entities.push(viewer.entities.add({ id: `ll:${a.id}:drape:${entities.length}`, polygon: {
      hierarchy, classificationType: C.ClassificationType.CESIUM_3D_TILE,
      material: new C.ColorMaterialProperty(new C.CallbackProperty(t => {
        if (dev) return C.Color.fromCssColorString(AMBER).withAlpha(state.active === a.id ? .7 : a.stage === 'approved' ? .38 : .26);
        if (a.stage === 'approved') return C.Color.fromCssColorString(CORAL).withAlpha(.35);
        const p = cb.reduced ? .5 : (Math.sin(performance.now() / 520) + 1) / 2;
        return C.Color.fromCssColorString(MINT).withAlpha(state.active === a.id ? .7 : .28 + p * .3);
      }, false)) }, properties: { app: a.id, stage: a.stage, layer: a.layer } }));
  }

  // HTML pins that ride on top of each site.
  const layer = document.createElement('div'); layer.className = 'pin-layer'; container.appendChild(layer);
  const pins = new Map();
  for (const a of apps) {
    if (!a.center) continue;
    const el = document.createElement('button');
    el.type = 'button'; el.className = `pin ${a.stage} ${a.layer}`; el.dataset.id = a.id; el.dataset.layer = a.layer;
    el.setAttribute('aria-label', `${cb.title(a.location)}, ${a.stage === 'approved' ? 'approved' : 'under review'}`);
    el.innerHTML = a.layer === 'str' ? `<b>${a.licensed}</b>` : ['city', 'road', 'park'].includes(a.layer) ? '<i></i>' : a.layer === 'dev' ? (a.stories >= 5 ? `<b>${a.stories}</b>` : '<i></i>') : a.stories ? `<b>${a.stories}</b>` : '<i></i>';
    const wrap = document.createElement('div'); wrap.className = 'pin-wrap pin-abs'; wrap.appendChild(el); layer.appendChild(wrap);
    el.addEventListener('click', ev => { ev.stopPropagation(); cb.pick(a.id); });
    el.addEventListener('mouseenter', () => cb.hover(a.id, true));
    el.addEventListener('mouseleave', () => cb.hover(a.id, false));
    pins.set(a.id, { el, wrap, a });
  }
  const toWindow = C.SceneTransforms.worldToWindowCoordinates || C.SceneTransforms.wgs84ToWindowCoordinates;
  const scratch = new C.Cartesian2();
  scene.postRender.addEventListener(() => {
    const camPos = scene.camera.positionWC;
    for (const { wrap, a, el } of pins.values()) {
      if (el.classList.contains('is-dim')) { wrap.style.opacity = '0'; wrap.style.pointerEvents = 'none'; continue; }
      wrap.style.pointerEvents = '';
      const top = C.Cartesian3.fromDegrees(a.center[0], a.center[1], ground + (a.stage === 'approved' ? projM(a) : 0) * grow + 12);
      const p = toWindow(scene, top, scratch);
      const behind = C.Cartesian3.dot(C.Cartesian3.subtract(top, camPos, new C.Cartesian3()), scene.camera.directionWC) < 0;
      if (!p || behind) { wrap.style.opacity = '0'; continue; }
      wrap.style.opacity = '';
      wrap.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
  });

  // Flood risk overlay (FEMA zones + City tidal flooding spots), draped on the 3D tiles; built on first use.
  let floodEntities = null;
  function buildFlood() {
    floodEntities = [];
    if (!cb.flood) return;
    const colors = { VE: ['#3d7bff', .4], AE: ['#43a6e8', .28], X: ['#8fd0ef', .12] };
    const polys = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
    const hier = rings => new C.PolygonHierarchy(fromRing(rings[0]), rings.slice(1).map(h => new C.PolygonHierarchy(fromRing(h))));
    for (const f of cb.flood.zones.features) {
      const [col, alpha] = colors[f.properties.zone] || colors.X;
      for (const rings of polys(f.geometry)) floodEntities.push(viewer.entities.add({ show: false, polygon: { hierarchy: hier(rings), classificationType: C.ClassificationType.CESIUM_3D_TILE, material: C.Color.fromCssColorString(col).withAlpha(alpha) } }));
    }
    const fa = { Frequently: .75, Occasionally: .5, Rarely: .3 };
    for (const f of cb.flood.tidal.features) for (const rings of polys(f.geometry))
      floodEntities.push(viewer.entities.add({ show: false, polygon: { hierarchy: hier(rings), classificationType: C.ClassificationType.CESIUM_3D_TILE, material: C.Color.fromCssColorString('#6fe3ff').withAlpha(fa[f.properties.freq] || .4) } }));
  }

  // Overlays for the extra views, built on first use and draped on the tiles.
  const ovEntities = {};
  function buildOverlay(name) {
    const OV = cb.overlays || {}; const list = (ovEntities[name] = []);
    const polys = g => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
    const lines = g => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
    const area = (fc, col, alpha) => { for (const f of fc?.features || []) for (const rings of polys(f.geometry)) list.push(viewer.entities.add({ polygon: { hierarchy: new C.PolygonHierarchy(fromRing(rings[0])), classificationType: C.ClassificationType.CESIUM_3D_TILE, material: C.Color.fromCssColorString(col).withAlpha(typeof alpha === 'function' ? alpha(f) : alpha) } })); };
    const line = (fc, col, width, alpha = .95) => { for (const f of fc?.features || []) for (const c of lines(f.geometry)) list.push(viewer.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(c.flat()), width: typeof width === 'function' ? width(f) : width, clampToGround: true, classificationType: C.ClassificationType.CESIUM_3D_TILE, material: C.Color.fromCssColorString(typeof col === 'function' ? col(f) : col).withAlpha(alpha) } })); };
    if (name === 'parks') area(OV.parks, '#5fd38a', .4);
    if (name === 'beaches') area(OV.beaches, '#f4dca0', .3);
    if (name === 'str') area(OV.str, '#c18cff', f => Math.min(.75, .3 + f.properties.licensed / 60));
    if (name === 'bikeways') line(OV.bikeways, '#9be564', f => (f.properties.protected ? 5 : 3.5));
    if (name === 'trolley') line(OV.trolleyRoutes, '#ffd166', 5);
    if (name === 'closures') line(OV.closures, f => ((f.properties.expires || '') >= new Date().toISOString().slice(0, 10) ? '#ff8a3d' : '#a3654a'), 6);
  }

  // Rings (¼ mile, 1 mile) draped on the real ground, and tinted "taller than this project" buildings.
  const circle = (c, r, n = 160) => { const k = Math.PI / 180, out = []; for (let i = 0; i <= n; i++) { const t = (i / n) * 2 * Math.PI; out.push(c[0] + (r / (111320 * Math.cos(c[1] * k))) * Math.sin(t), c[1] + (r / 110540) * Math.cos(t)); } return out; };
  let ringEntities = [], tallerEntities = [], buildingsCache = null;
  const clearRings = () => { ringEntities.forEach(e => viewer.entities.remove(e)); ringEntities = []; };
  const clearTaller = () => { tallerEntities.forEach(e => viewer.entities.remove(e)); tallerEntities = []; };
  const ringLabel = r => (r === 402 ? cb.L('¼ mile', '¼ milla') : cb.L('1 mile', '1 milla'));
  function showRings(a) {
    clearRings();
    for (const r of [402, 1609]) {
      const pts = circle(a.center, r);
      ringEntities.push(viewer.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(pts), width: 2.5, clampToGround: true, classificationType: C.ClassificationType.BOTH,
        material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString('#d6f5ec').withAlpha(.9), dashLength: 18 }) } }));
      ringEntities.push(viewer.entities.add({ position: C.Cartesian3.fromDegrees(pts[0], pts[1], ground + 25), label: {
        text: ringLabel(r), font: '700 13px Inter, system-ui, sans-serif', fillColor: C.Color.fromCssColorString('#d6f5ec'),
        outlineColor: C.Color.fromCssColorString('#071c25'), outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY, pixelOffset: new C.Cartesian2(0, -6) }, properties: { ring: r } }));
    }
  }
  async function showTaller(a) {
    clearTaller();
    if (!a.heightFt) return;
    buildingsCache ||= await fetch('../data/mb-buildings.json').then(r => r.json()).catch(() => null);
    if (!buildingsCache) return;
    const k = Math.PI / 180, R = 6371000;
    const near = buildingsCache.features.filter(f => f.properties.h > a.heightFt).filter(f => {
      const c = ring(f.geometry)[0], dLat = (c[1] - a.center[1]) * k, dLng = (c[0] - a.center[0]) * k;
      return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.center[1] * k) * Math.cos(c[1] * k) * Math.sin(dLng / 2) ** 2)) <= 1609;
    }).slice(0, 400);
    if (state.active !== a.id) return;
    for (const f of near) {
      tallerEntities.push(viewer.entities.add({ polygon: {
        hierarchy: new C.PolygonHierarchy(fromRing(ring(f.geometry))), height: ground - 3, extrudedHeight: ground + feet(f.properties.h) + 4,
        classificationType: C.ClassificationType.CESIUM_3D_TILE, material: C.Color.fromCssColorString(TALLER).withAlpha(.42) } }));
    }
  }

  // Camera
  const H = C.Math.toRadians;
  const home = () => cb.phone()
    ? { destination: C.Cartesian3.fromDegrees(-80.1345, 25.615, 34000), orientation: { heading: H(0), pitch: H(-74), roll: 0 } }
    : { destination: C.Cartesian3.fromDegrees(-80.1985, 25.7385, 3900), orientation: { heading: H(36), pitch: H(-22), roll: 0 } };
  const fly = (view, duration) => (cb.reduced ? scene.camera.setView(view) : scene.camera.flyTo({ ...view, duration, easingFunction: C.EasingFunction.CUBIC_IN_OUT }));

  // Picking + hover tooltip
  const tip = document.createElement('div'); tip.className = 'tip tip-float'; tip.hidden = true; container.appendChild(tip);
  const handler = new C.ScreenSpaceEventHandler(scene.canvas);
  const appAt = pos => { const picked = scene.pick(pos); const id = picked?.id?.id; return typeof id === 'string' && id.startsWith('ll:') ? byId.get(id.split(':')[1]) : null; };
  handler.setInputAction(e => { const a = appAt(e.position); if (a) cb.pick(a.id); }, C.ScreenSpaceEventType.LEFT_CLICK);
  let lastHover = null;
  handler.setInputAction(e => {
    const a = appAt(e.endPosition);
    scene.canvas.style.cursor = a ? 'pointer' : '';
    if (a) { tip.innerHTML = cb.tip(a); tip.hidden = false; tip.style.transform = `translate(${e.endPosition.x + 14}px, ${e.endPosition.y + 14}px)`; }
    else tip.hidden = true;
    if ((a?.id || null) !== lastHover) { lastHover = a?.id || null; cb.hover(lastHover, !!lastHover); }
  }, C.ScreenSpaceEventType.MOUSE_MOVE);

  const animateGrow = (ms = 2200) => {
    if (cb.reduced) { grow = 1; return; }
    const t0 = performance.now();
    (function step(now) { grow = ease(Math.min(1, (now - t0) / ms)); if (grow < 1) requestAnimationFrame(step); })(t0);
  };

  return {
    intro() {
      scene.camera.setView({ destination: C.Cartesian3.fromDegrees(-80.135, 25.80, 30000), orientation: { heading: 0, pitch: H(-89), roll: 0 } });
      fly(home(), 4.2);
      setTimeout(animateGrow, cb.reduced ? 0 : 3000);
    },
    hover(id) { pins.forEach(({ el }, k) => el.classList.toggle('is-hover', k === id)); },
    select(a, { fly: go = true } = {}) {
      state.active = a.id;
      pins.forEach(({ el }, k) => el.classList.toggle('is-active', k === a.id));
      if (a.center) { showRings(a); showTaller(a); }
      if (go && a.center) {
        const h = Math.max(projM(a), 30);
        // On phones the drawer covers the lower ~70%, so aim the camera a little south of the site to push it up the screen.
        const aim = cb.phone() ? [a.center[0], a.center[1] - 0.0068] : a.center;
        const target = new C.BoundingSphere(C.Cartesian3.fromDegrees(aim[0], aim[1], ground + h * .45), Math.max(h * .7, 50));
        const heading = scene.camera.heading + H(cb.phone() ? 0 : -14);
        const range = cb.phone() ? Math.max(900, h * 6.5) : Math.max(760, h * 4.6);
        const offset = new C.HeadingPitchRange(heading, H(cb.phone() ? -40 : -34), range);
        cb.reduced ? scene.camera.viewBoundingSphere(target, offset) : scene.camera.flyToBoundingSphere(target, { offset, duration: 2.6, easingFunction: C.EasingFunction.CUBIC_IN_OUT });
        if (cb.reduced) scene.camera.lookAtTransform(C.Matrix4.IDENTITY);
      }
    },
    clear() {
      state.active = null;
      pins.forEach(({ el }) => el.classList.remove('is-active'));
      clearRings(); clearTaller();
      fly(home(), 2.4);
    },
    filter(f) {
      for (const e of entities) e.show = cb.matches({ layer: e.properties.layer.getValue(), stage: e.properties.stage.getValue() }, f);
      pins.forEach(({ el, a }) => el.classList.toggle('is-dim', !cb.matches(a, f)));
    },
    // Keyboard flying: move along the ground relative to where the camera faces; speed scales with altitude.
    move({ forward, right, turn, up }, dt, fast) {
      const cam = scene.camera; cam.cancelFlight();
      const pos = cam.positionWC, normal = C.Ellipsoid.WGS84.geodeticSurfaceNormal(pos, new C.Cartesian3());
      const height = Math.max(40, cam.positionCartographic.height - ground);
      const speed = Math.min(2500, Math.max(35, height * 0.32)) * (fast ? 3 : 1) * dt;
      const flat = v => { const d = C.Cartesian3.subtract(v, C.Cartesian3.multiplyByScalar(normal, C.Cartesian3.dot(v, normal), new C.Cartesian3()), new C.Cartesian3()); return C.Cartesian3.magnitude(d) < 1e-6 ? d : C.Cartesian3.normalize(d, d); };
      if (forward) cam.move(flat(cam.directionWC), forward * speed);
      if (right) cam.move(flat(cam.rightWC), right * speed);
      if (up) { const h = cam.positionCartographic.height; if (!(up < 0 && h - ground < 45)) cam.move(normal, up * speed); }
      if (turn) cam.look(normal, -turn * C.Math.toRadians(48) * (fast ? 2 : 1) * dt);
    },
    overlays(on) { for (const name of ['parks', 'beaches', 'str', 'bikeways', 'trolley', 'closures']) { if (on.includes(name) && !ovEntities[name]) buildOverlay(name); for (const e of ovEntities[name] || []) e.show = on.includes(name); } },
    flood(on) { if (!floodEntities) buildFlood(); for (const e of floodEntities) e.show = on; },
    relabel() { for (const e of ringEntities) if (e.label) e.label.text = ringLabel(e.properties.ring.getValue()); }
  };
}
