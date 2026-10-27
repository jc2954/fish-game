import * as THREE from 'three';
import { OceanEnvironment } from './environment.js';
import { Shark } from './shark.js';
import { FishSchool } from './fishSchool.js';
import { SonarRadar } from './radar.js';
import { audio } from './audio.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Input State
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      boost: false,
      mouseActive: false,
      mouseDeltaX: 0,
      mouseDeltaY: 0
    };

    // Camera modes: 0 = Chase 3rd person, 1 = Shark Eyes (1st person), 2 = Orbit / Cinematic
    this.cameraMode = 0;
    this.cameraOffsets = [
      new THREE.Vector3(0, 4.5, -12), // Chase Cam
      new THREE.Vector3(0, 0.6, 2.5),  // Shark Eyes
      new THREE.Vector3(0, 15, -28)    // Wide Cinematic
    ];

    this.clock = new THREE.Clock();

    // DOM UI Elements
    this.ui = {
      score: document.getElementById('score-counter'),
      comboCard: document.getElementById('combo-card'),
      comboVal: document.getElementById('combo-multiplier'),
      panicBar: document.getElementById('panic-bar'),
      panicPct: document.getElementById('panic-pct'),
      closestDist: document.getElementById('closest-fish-dist'),
      schoolAlert: document.getElementById('school-alert'),
      speedVal: document.getElementById('speed-val'),
      speedBar: document.getElementById('speed-bar'),
      staminaVal: document.getElementById('stamina-val'),
      staminaBar: document.getElementById('stamina-bar'),
      reticle: document.getElementById('reticle'),
      reticleLock: document.getElementById('reticle-lock'),
      frenzyBanner: document.getElementById('frenzy-banner'),
      btnAudio: document.getElementById('btn-audio'),
      soundLabel: document.getElementById('sound-label'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      btnCam: document.getElementById('btn-cam'),
      camLabel: document.getElementById('cam-label'),
      introModal: document.getElementById('intro-modal'),
      btnStart: document.getElementById('btn-start')
    };

    this.initThree();
    this.initComponents();
    this.initListeners();
    this.animate();
  }

  initThree() {
    // Scene with deep ocean atmospheric fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x021626);
    this.scene.fog = new THREE.FogExp2(0x021b30, 0.014);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );
    this.camera.position.set(0, 5, -15);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);
  }

  initComponents() {
    this.environment = new OceanEnvironment(this.scene);
    this.shark = new Shark(this.scene);
    this.school = new FishSchool(this.scene, 220);
    this.radar = new SonarRadar('sonar-canvas');
  }

  initListeners() {
    window.addEventListener('resize', () => this.onResize());

    // Keyboard controls
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse movement steering
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('#hud-header') || e.target.closest('#hud-bottom') || e.target.closest('#intro-modal')) return;
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      this.shark.triggerBite();
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
      this.input.mouseActive = false;
    });

    window.addEventListener('mousemove', (e) => {
      // Allow steering when mouse is down, or subtle cursor steering
      if (isMouseDown) {
        this.input.mouseActive = true;
        this.input.mouseDeltaX = (e.clientX - prevMouseX) * 0.05;
        this.input.mouseDeltaY = (e.clientY - prevMouseY) * 0.05;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });

    // Touch support for mobile / touchpads
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
        this.shark.triggerBite();
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.input.mouseActive = true;
        this.input.mouseDeltaX = (e.touches[0].clientX - prevMouseX) * 0.06;
        this.input.mouseDeltaY = (e.touches[0].clientY - prevMouseY) * 0.06;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.input.mouseActive = false;
    });

    // Audio button
    this.ui.btnAudio.addEventListener('click', () => this.toggleAudio());

    // Camera mode toggle button
    this.ui.btnCam.addEventListener('click', () => this.cycleCamera());

    // Start modal button
    this.ui.btnStart.addEventListener('click', () => {
      this.ui.introModal.classList.add('hidden');
      this.toggleAudio(true); // Enable audio on user interaction
    });
  }

  onKeyDown(e) {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.input.up = true;
    if (code === 'KeyS' || code === 'ArrowDown') this.input.down = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') this.input.boost = true;
    if (code === 'KeyC') this.cycleCamera();
    if (code === 'KeyM') this.toggleAudio();
  }

  onKeyUp(e) {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.input.up = false;
    if (code === 'KeyS' || code === 'ArrowDown') this.input.down = false;
    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') this.input.boost = false;
  }

  cycleCamera() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    const names = ['CAM: CHASE', 'CAM: SHARK EYE', 'CAM: WIDE ORBIT'];
    this.ui.camLabel.textContent = names[this.cameraMode];
  }

  toggleAudio(forceEnable = false) {
    if (forceEnable) {
      if (audio.isMuted) audio.toggleSound();
    } else {
      audio.toggleSound();
    }

    const active = !audio.isMuted;
    this.ui.soundLabel.textContent = active ? 'SOUND: ON' : 'SOUND: OFF';
    this.ui.iconSoundOn.classList.toggle('hidden', !active);
    this.ui.iconSoundOff.classList.toggle('hidden', active);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateCamera(delta) {
    const offset = this.cameraOffsets[this.cameraMode].clone();

    // In 3rd person chase camera, rotate offset by shark orientation
    offset.applyQuaternion(this.shark.mesh.quaternion);
    const targetCamPos = this.shark.position.clone().add(offset);

    // Smooth lerp camera position
    const lerpRate = this.cameraMode === 1 ? 18.0 : 6.0;
    this.camera.position.lerp(targetCamPos, delta * lerpRate);

    // Look at target point ahead of the shark
    const lookTarget = this.shark.position.clone();
    if (this.cameraMode === 0) {
      // Look slightly ahead of shark
      lookTarget.addScaledVector(this.shark.forward, 6.0);
    } else if (this.cameraMode === 1) {
      // 1st person eyes forward
      lookTarget.addScaledVector(this.shark.forward, 15.0);
    }
    this.camera.lookAt(lookTarget);

    // Dynamic FOV rush when dashing
    const targetFOV = this.shark.isBoosting ? 74 : 60;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 4.0);
    this.camera.updateProjectionMatrix();
  }

  updateHUD() {
    // 1. Eaten fish score & combo
    this.ui.score.textContent = this.school.eatenCount;
    this.ui.comboVal.textContent = `${this.school.combo.toFixed(1)}x`;

    if (this.school.combo >= 2.5) {
      this.ui.frenzyBanner.classList.remove('hidden');
    } else {
      this.ui.frenzyBanner.classList.add('hidden');
    }

    // 2. Speed and Stamina Gauges
    const speedKnots = Math.round(this.shark.speed * 1.4);
    this.ui.speedVal.textContent = `${speedKnots} kn`;
    const speedPct = Math.min(100, Math.round((this.shark.speed / this.shark.boostSpeed) * 100));
    this.ui.speedBar.style.width = `${speedPct}%`;

    const staminaPct = Math.round((this.shark.stamina / this.shark.maxStamina) * 100);
    this.ui.staminaVal.textContent = `${staminaPct}%`;
    this.ui.staminaBar.style.width = `${staminaPct}%`;

    // 3. Proximity Distance Sensing & Panic Telemetry
    const closest = this.school.closestDist;
    this.ui.closestDist.textContent = closest < 90 ? `${closest.toFixed(1)}m` : '> 90m';

    const panicRatio = Math.min(1.0, Math.max(0, 1.0 - (closest / this.school.fleeRadius)));
    const panicPercent = Math.round(panicRatio * 100);
    this.ui.panicPct.textContent = `${panicPercent}%`;
    this.ui.panicBar.style.width = `${panicPercent}%`;

    // Alert status message and colors
    let alertMsg = 'CALM (BROWSING)';
    let alertColor = '#00ff88';

    if (panicRatio > 0.75) {
      alertMsg = 'EXTREME PANIC (BURST FLEE)';
      alertColor = '#ff3366';
    } else if (panicRatio > 0.45) {
      alertMsg = 'EVADING SHARK (SCATTERING)';
      alertColor = '#ff9900';
    } else if (panicRatio > 0.1) {
      alertMsg = 'ALERT (SENSING PREDATOR)';
      alertColor = '#ffd700';
    }
    this.ui.schoolAlert.textContent = alertMsg;
    this.ui.schoolAlert.style.color = alertColor;

    // 4. Reticle Lock indicator
    const isTargetInRange = closest < 7.0;
    this.ui.reticle.classList.toggle('locked', isTargetInRange);
    this.ui.reticleLock.classList.toggle('hidden', !isTargetInRange);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // 1. Update Shark
    this.shark.update(delta, time, this.input);

    // 2. Update Fish School (Boids + Distance Sensing AI)
    this.school.update(delta, time, this.shark);

    // 3. Update Ocean Environment (Caustics, Kelp sway, Sunbeams, Bubbles)
    this.environment.update(delta, time);

    // 4. Update Camera
    this.updateCamera(delta);

    // 5. Update Sonar Radar
    this.radar.update(this.shark.position, this.shark.yaw, this.school.fishList);

    // 6. Update HUD UI
    this.updateHUD();

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Boot game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
