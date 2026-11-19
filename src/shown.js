// Only what's shown (docs/PERFORMANCE.md, "Stutter"): every frame, three.js works out where every
// object in the scene is in the world, all 15,700 of them, though at any moment nine in ten are
// hidden (townsfolk out of sight, rooms you're not in, boats laid up, things far off) and none of
// those is drawn. It was the biggest single cost in a frame. So the scene's world matrices are
// worked out here instead, for what's shown; anything hidden is marked to be worked out the moment
// it's shown again. (Code that asks where something is, getWorldPosition and the like, works it
// out itself, shown or not.)

// The same sum as three.js's Object3D.updateMatrixWorld, but not into hidden things.
export function updateShown(o, force = false) {
  if (o.matrixAutoUpdate) o.updateMatrix();
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.parent === null) o.matrixWorld.copy(o.matrix);
    else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
    o.matrixWorldNeedsUpdate = false;
    // (A camera in the scene: its view from there, as three.js's own Camera keeps it.)
    if (o.isCamera) o.matrixWorldInverse.copy(o.matrixWorld).invert();
    force = true;
  }
  const kids = o.children;
  for (let i = 0, n = kids.length; i < n; i++) {
    const c = kids[i];
    if (!c.visible) {
      c.matrixWorldNeedsUpdate = true;
      continue;
    }
    if (c.matrixWorldAutoUpdate === true || force) updateShown(c, force);
  }
}

// The scene's matrices from now on worked out this way, at the start of each time it's drawn (the
// main view, the water's reflection), after everything in the frame has moved.
export function onlyShown(scene) {
  scene.matrixWorldAutoUpdate = false;
  scene.onBeforeRender = () => updateShown(scene);
}
