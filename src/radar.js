// 2D Canvas Sonar Radar HUD

export class SonarRadar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.range = 55; // Detection radius in world units
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.radius = this.canvas.width / 2 - 4;
  }

  update(sharkPos, sharkYaw, fishList) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const { x: cx, y: cy } = this.center;
    const r = this.radius;

    // Clear background
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Range rings
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach(factor => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * factor, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.stroke();

    // Transform fish positions relative to shark orientation (radar heads-up display)
    const cosYaw = Math.cos(-sharkYaw);
    const sinYaw = Math.sin(-sharkYaw);

    fishList.forEach(fish => {
      const dx = fish.position.x - sharkPos.x;
      const dz = fish.position.z - sharkPos.z;

      // Rotate into shark local coordinates (forward = up)
      const rx = dx * cosYaw - dz * sinYaw;
      const rz = dx * sinYaw + dz * cosYaw;

      const dist = Math.sqrt(rx * rx + rz * rz);
      if (dist > this.range) return;

      const px = cx + (rx / this.range) * r;
      const py = cy + (rz / this.range) * r; // forward in Z

      // Dot color depends on panic level
      const panic = fish.panicRatio || 0;
      ctx.beginPath();
      ctx.arc(px, py, panic > 0.4 ? 2.8 : 2.0, 0, Math.PI * 2);

      if (panic > 0.5) {
        ctx.fillStyle = `rgba(255, 51, 102, ${0.7 + panic * 0.3})`;
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 4;
      } else if (panic > 0.1) {
        ctx.fillStyle = 'rgba(255, 170, 0, 0.8)';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 3;
      } else {
        ctx.fillStyle = 'rgba(0, 255, 136, 0.65)';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 2;
      }
      ctx.fill();
    });

    ctx.shadowBlur = 0;

    // Center Shark blip (apex predator triangle pointing forward)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }
}
