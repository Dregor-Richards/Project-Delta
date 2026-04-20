// camera.js
export function createCamera({
  x = 0,
  y = 0,
  speed = 300,
  worldWidth,
  worldHeight,
  viewWidth,
  viewHeight,
  edgeSize = 20,
  edgeSpeedMultiplier = 1.0,
  zoom = 1.0,          // 1 = default, >1 = zoom in, <1 = zoom out
  minZoom = 0.5,
  maxZoom = 2.5,
}) {
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
  };

  let mouseX = viewWidth / 2;
  let mouseY = viewHeight / 2;
  let hasMouse = false;

  const camera = {
    x,
    y,
    speed,
    worldWidth,
    worldHeight,
    viewWidth,
    viewHeight,
    edgeSize,
    edgeSpeedMultiplier,
    zoom,
    minZoom,
    maxZoom,

    setWorldSize(w, h) {
      this.worldWidth = w;
      this.worldHeight = h;
      this.clamp();
    },

    setViewSize(w, h) {
      this.viewWidth = w;
      this.viewHeight = h;
      this.clamp();
    },

    updateMousePosition(localX, localY) {
      mouseX = localX;
      mouseY = localY;
      hasMouse = true;
    },

    clearMousePosition() {
      hasMouse = false;
    },

    clamp() {
      if (this.worldWidth != null && this.viewWidth != null) {
        const maxX = Math.max(0, this.worldWidth - this.viewWidth / this.zoom);
        this.x = Math.min(Math.max(this.x, 0), maxX);
      }
      if (this.worldHeight != null && this.viewHeight != null) {
        const maxY = Math.max(0, this.worldHeight - this.viewHeight / this.zoom);
        this.y = Math.min(Math.max(this.y, 0), maxY);
      }
    },

    update(dt) {
      let dx = 0;
      let dy = 0;

      // Keyboard pan
      if (keys.w) dy -= 1;
      if (keys.s) dy += 1;
      if (keys.a) dx -= 1;
      if (keys.d) dx += 1;

      // Edge panning
      if (hasMouse) {
        const es = this.edgeSize;
        const w = this.viewWidth;
        const h = this.viewHeight;

        if (mouseX <= es) dx -= 1;
        else if (mouseX >= w - es) dx += 1;

        if (mouseY <= es) dy -= 1;
        else if (mouseY >= h - es) dy += 1;
      }

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const effectiveSpeed = this.speed * this.edgeSpeedMultiplier;
        // Move speed should feel consistent across zooms, so divide by zoom a bit
        const zoomFactor = 1 / this.zoom;
        this.x += dx * effectiveSpeed * dt * zoomFactor;
        this.y += dy * effectiveSpeed * dt * zoomFactor;
        this.clamp();
      }
    },

    // Zoom towards a screen point (screenX, screenY in view coords)
    zoomAt(screenX, screenY, zoomFactor) {
      const oldZoom = this.zoom;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * zoomFactor));
      if (newZoom === oldZoom) return;

      // Convert screen point to world before zoom
      const worldBefore = this.screenToWorld(screenX, screenY);

      this.zoom = newZoom;
      this.clamp();

      // After zoom, adjust x/y so the same world point stays under the cursor
      const worldAfter = this.screenToWorld(screenX, screenY);
      this.x += worldBefore.x - worldAfter.x;
      this.y += worldBefore.y - worldAfter.y;
      this.clamp();
    },

    zoomIn(centerX, centerY) {
      this.zoomAt(centerX, centerY, 1.1);
    },

    zoomOut(centerX, centerY) {
      this.zoomAt(centerX, centerY, 1 / 1.1);
    },

    // World -> screen with zoom
    worldToScreen(x, y) {
      return {
        x: (x - this.x) * this.zoom,
        y: (y - this.y) * this.zoom,
      };
    },

    // Screen -> world with zoom
    screenToWorld(x, y) {
      return {
        x: x / this.zoom + this.x,
        y: y / this.zoom + this.y,
      };
    },
  };

  // Keyboard hooks
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;

    // Keyboard zoom: '+' / '=' to zoom in, '-' to zoom out
    if (e.key === '+' || e.key === '=') {
      const centerX = camera.viewWidth / 2;
      const centerY = camera.viewHeight / 2;
      camera.zoomIn(centerX, centerY);
    } else if (e.key === '-') {
      const centerX = camera.viewWidth / 2;
      const centerY = camera.viewHeight / 2;
      camera.zoomOut(centerX, centerY);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
  });

  return camera;
}