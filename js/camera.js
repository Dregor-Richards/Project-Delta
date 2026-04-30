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
  zoom = 1.0,
  minZoom = 0.5,
  maxZoom = 2.5,
}) {
  const keys = {
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
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
      if (keys.ArrowUp) dy -= 1;
      if (keys.ArrowDown) dy += 1;
      if (keys.ArrowLeft) dx -= 1;
      if (keys.ArrowRight) dx += 1;

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
        const zoomFactor = 1 / this.zoom;
        this.x += dx * effectiveSpeed * dt * zoomFactor;
        this.y += dy * effectiveSpeed * dt * zoomFactor;
        this.clamp();
      }
    },

    zoomAt(screenX, screenY, zoomFactor) {
      const oldZoom = this.zoom;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * zoomFactor));
      if (newZoom === oldZoom) return;

      const worldBefore = this.screenToWorld(screenX, screenY);

      this.zoom = newZoom;
      this.clamp();

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

    worldToScreen(x, y) {
      return {
        x: (x - this.x) * this.zoom,
        y: (y - this.y) * this.zoom,
      };
    },

    screenToWorld(x, y) {
      return {
        x: x / this.zoom + this.x,
        y: y / this.zoom + this.y,
      };
    },

    // NEW: Get visible viewport bounds in world coordinates
    getViewBounds() {
      return {
        left: this.x,
        right: this.x + this.viewWidth / this.zoom,
        top: this.y,
        bottom: this.y + this.viewHeight / this.zoom,
      };
    },
  };

  // Keyboard hooks
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowUp') keys.ArrowUp = true;
    if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.key === 'ArrowDown') keys.ArrowDown = true;
    if (e.key === 'ArrowRight') keys.ArrowRight = true;

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
    if (e.key === 'ArrowUp') keys.ArrowUp = false;
    if (e.key === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.key === 'ArrowDown') keys.ArrowDown = false;
    if (e.key === 'ArrowRight') keys.ArrowRight = false;
  });

  return camera;
}