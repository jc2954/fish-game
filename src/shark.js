import * as THREE from 'three';
import { audio } from './audio.js';

export class Shark {
  constructor(scene) {
    this.scene = scene;

    // Movement & Physics
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.forward = new THREE.Vector3(0, 0, 1);
    this.speed = 10;
    this.baseSpeed = 10;
    this.boostSpeed = 26;
    this.turnSpeed = 1.8;
    this.pitchSpeed = 1.4;

    // Angles
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;

    // Boost & Stamina
    this.stamina = 100;
    this.maxStamina = 100;
    this.isBoosting = false;

    // Bite Animation
    this.jawAngle = 0;
    this.isBiting = false;
    this.biteProgress = 0;

    // Wake Bubbles
    this.wakeParticles = [];

    // Create 3D Mesh
    this.mesh = this.createSharkMesh();
    this.scene.add(this.mesh);

    this.initWakeParticles();
  }

  createSharkMesh() {
    const root = new THREE.Group();

    // Materials - Authentic Great White countershading
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x22364a,
      roughness: 0.35,
      metalness: 0.15
    });

    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xe6eef4,
      roughness: 0.4
    });

    const mouthInsideMat = new THREE.MeshStandardMaterial({
      color: 0x8a2434,
      roughness: 0.5
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x05080c,
      roughness: 0.1,
      metalness: 0.9
    });

    const teethMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2
    });

    // Segment 1: Main Torso
    //const torsoGeo = new THREE.ConeGeometry(1.6, 5.0, 16);
    const torsoGeo = new THREE.CylinderGeometry(1.2, 1.6, 5.0, 12);
    torsoGeo.rotateX(Math.PI / 2);
    //torsoGeo.scale(1.0, 0.85, 1.0);
    this.torso = new THREE.Mesh(torsoGeo, topMat);
    this.torso.castShadow = true;
    root.add(this.torso);

    // Torso Underbelly
    const bellyGeo = new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    bellyGeo.scale(0.9, 0.65, 2.2);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, -0.3, 0.2);
    this.torso.add(belly);

    // Head Group (attached to Torso front)
    this.head = new THREE.Group();
    this.head.position.set(0, 0, 2.4);
    this.torso.add(this.head);

    // Upper Snout
    const snoutGeo = new THREE.ConeGeometry(1.4, 3.2, 16);
    snoutGeo.rotateX(Math.PI / 2);
    snoutGeo.scale(0.95, 0.7, 1.0);
    const snout = new THREE.Mesh(snoutGeo, topMat);
    snout.position.set(0, 0.2, 1.3);
    snout.castShadow = true;
    this.head.add(snout);

    // Shark Eyes
    [-0.85, 0.85].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
      eye.position.set(x, 0.45, 1.4);
      this.head.add(eye);
    });

    // Gill Slits (5 on each side)
    [-1, 1].forEach(side => {
      for (let g = 0; g < 5; g++) {
        const gillGeo = new THREE.BoxGeometry(0.04, 0.5 - g * 0.05, 0.08);
        const gillMat = new THREE.MeshBasicMaterial({ color: 0x111b24 });
        const gill = new THREE.Mesh(gillGeo, gillMat);
        gill.position.set(side * 1.25, 0.1, -0.2 - g * 0.22);
        gill.rotation.y = side * 0.15;
        this.head.add(gill);
      }
    });

    // Articulated Lower Jaw
    this.lowerJaw = new THREE.Group();
    this.lowerJaw.position.set(0, -0.35, 0.8);

    const jawGeo = new THREE.ConeGeometry(1.15, 2.4, 24);
    jawGeo.rotateX(Math.PI / 2);
    jawGeo.scale(0.9, 0.45, 0.9);
    const jawMesh = new THREE.Mesh(jawGeo, bellyMat);
    jawMesh.position.set(0, 0, 0.8);
    this.lowerJaw.add(jawMesh);

    // Sharp Teeth inside jaw
    for (let t = -4; t <= 4; t++) {
      const toothGeo = new THREE.ConeGeometry(0.08, 0.22, 5);
      const tooth = new THREE.Mesh(toothGeo, teethMat);
      const angle = (t / 4) * 0.8;
      tooth.position.set(Math.sin(angle) * 0.75, 0.2, 0.6 + Math.cos(angle) * 0.9);
      this.lowerJaw.add(tooth);
    }
    this.head.add(this.lowerJaw);

    // Iconic Dorsal Fin
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.quadraticCurveTo(0.2, 2.0, -0.6, 2.8);
    dorsalShape.quadraticCurveTo(-0.4, 1.4, -2.0, 0);
    dorsalShape.closePath();

    const dorsalExtrude = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.06
    });
    dorsalExtrude.rotateY(Math.PI / 2);
    this.dorsalFin = new THREE.Mesh(dorsalExtrude, topMat);
    this.dorsalFin.position.set(0.11, 0.5, 0.5);
    this.dorsalFin.castShadow = true;
    this.torso.add(this.dorsalFin);

    // Large Sweeping Pectoral Fins
    this.pectoralFins = [];
    [-1, 1].forEach(side => {
      const pecShape = new THREE.Shape();
      pecShape.moveTo(0, 0);
      pecShape.quadraticCurveTo(side * 2.6, -0.4, side * 3.4, -1.8);
      pecShape.quadraticCurveTo(side * 1.8, -1.4, 0, -1.0);
      pecShape.closePath();

      const pecExtrude = new THREE.ExtrudeGeometry(pecShape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04
      });
      const pec = new THREE.Mesh(pecExtrude, topMat);
      pec.position.set(side * 1.1, -0.4, 1.2);
      pec.rotation.z = side * 0.15;
      this.torso.add(pec);
      this.pectoralFins.push({ mesh: pec, side });
    });

    // Articulated Spine - Segment 2: Tail Base
    this.tailBase = new THREE.Group();
    this.tailBase.position.set(0, 0, -2.45);
    this.torso.add(this.tailBase);

    const tailBaseGeo = new THREE.CylinderGeometry(1.6, 0.3, 3.2, 24);
    tailBaseGeo.rotateX(Math.PI / 2);
    // tailBaseGeo.scale(0.8, 1.0, 1.0);
    const tailBaseMesh = new THREE.Mesh(tailBaseGeo, topMat);
    tailBaseMesh.position.set(0, 0, -1.4);
    tailBaseMesh.castShadow = true;
    this.tailBase.add(tailBaseMesh);

    // Second small dorsal fin & pelvic fins
    const smallFinGeo = new THREE.ConeGeometry(0.3, 0.8, 6);
    smallFinGeo.rotateX(-Math.PI / 4);
    const smallFin = new THREE.Mesh(smallFinGeo, topMat);
    smallFin.position.set(0, 0.7, -1.8);
    this.tailBase.add(smallFin);

    // Articulated Spine - Segment 3: Caudal (Tail) Fin Tip
    this.caudalFin = new THREE.Group();
    this.caudalFin.position.set(0, 0, -4);
    this.tailBase.add(this.caudalFin);

    // Crescent Shaped Caudal Fin
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    // Upper large lobe
    tailShape.quadraticCurveTo(-0.8, 1.8, -2.0, 3.2);
    tailShape.quadraticCurveTo(-1.8, 1.4, -1.0, 0.3);
    // Lower lobe
    tailShape.quadraticCurveTo(-1.8, -0.8, -1.7, -2.1);
    tailShape.quadraticCurveTo(-0.7, -1.1, 0, 0);

    tailShape.closePath();


    const tailExtrude = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04
    });
    tailExtrude.rotateY(Math.PI / 2);
    const caudalMesh = new THREE.Mesh(tailExtrude, topMat);
    caudalMesh.position.set(0.08, 0, 1);
    caudalMesh.rotation.y = Math.PI;
    caudalMesh.castShadow = true;
    this.caudalFin.add(caudalMesh);

    return root;
  }

  // Wake particles for dash & sprint cavitation
  initWakeParticles() {
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x90f0ff,
      size: 0.8,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.wakeSystem = new THREE.Points(geo, mat);
    this.scene.add(this.wakeSystem);

    for (let i = 0; i < count; i++) {
      this.wakeParticles.push({
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0
      });
    }
  }

  spawnWakeBubble(pos) {
    const p = this.wakeParticles.find(wp => wp.life <= 0);
    if (!p) return;
    p.pos.copy(pos).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8
    ));
    p.vel.set((Math.random() - 0.5) * 1.5, Math.random() * 2.0, (Math.random() - 0.5) * 1.5);
    p.life = 0.8 + Math.random() * 0.5;
    p.maxLife = p.life;
  }

  triggerBite() {
    if (this.isBiting) return;
    this.isBiting = true;
    this.biteProgress = 0;
    audio.playChomp();
  }

  update(delta, time, input) {
    // 1. Steering & Rotation
    let targetYaw = this.yaw;
    let targetPitch = this.pitch;
    let targetRoll = 0;

    // Keyboard Yaw (A / D or Left / Right)
    if (input.left) {
      targetYaw += this.turnSpeed * delta;
      targetRoll += 0.45; // Bank into turn
    }
    if (input.right) {
      targetYaw -= this.turnSpeed * delta;
      targetRoll -= 0.45; // Bank into turn
    }

    // Keyboard Pitch (W / S or Up / Down)
    if (input.up) {
      targetPitch += this.pitchSpeed * delta; // Dive down or climb
    }
    if (input.down) {
      targetPitch -= this.pitchSpeed * delta;
    }

    // Mouse Look Steering (if active)
    if (input.mouseActive) {
      targetYaw -= input.mouseDeltaX * 1.8 * delta;
      targetPitch -= input.mouseDeltaY * 1.4 * delta;
      targetRoll -= input.mouseDeltaX * 0.8;
      // Decay delta
      input.mouseDeltaX *= 0.8;
      input.mouseDeltaY *= 0.8;
    }

    // Clamp pitch to avoid gimbal flips
    this.pitch = THREE.MathUtils.clamp(targetPitch, -Math.PI / 2.6, Math.PI / 2.6);
    this.yaw = targetYaw;
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, delta * 4);

    // 2. Sprint / Boost & Stamina
    if (input.boost && this.stamina > 5) {
      if (!this.isBoosting) {
        audio.playDash();
      }
      this.isBoosting = true;
      this.speed = THREE.MathUtils.lerp(this.speed, this.boostSpeed, delta * 5.0);
      this.stamina = Math.max(0, this.stamina - 28 * delta);
    } else {
      this.isBoosting = false;
      this.speed = THREE.MathUtils.lerp(this.speed, this.baseSpeed, delta * 3.0);
      this.stamina = Math.min(this.maxStamina, this.stamina + 16 * delta);
    }

    // Update dynamic audio swoosh from speed
    const speedRatio = (this.speed - this.baseSpeed) / (this.boostSpeed - this.baseSpeed);
    audio.updateSwimSpeed(Math.max(0, speedRatio));

    // 3. Forward Movement
    const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
    this.mesh.quaternion.setFromEuler(euler);

    // Calculate forward vector (mesh points along local +Z)
    this.forward.set(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize();

    // Advance position
    this.position.addScaledVector(this.forward, this.speed * delta);

    // Soft Boundary containment in lagoon
    const maxBound = 85;
    if (Math.abs(this.position.x) > maxBound) {
      this.position.x = Math.sign(this.position.x) * maxBound;
      this.yaw += Math.PI * 0.3 * delta;
    }
    if (Math.abs(this.position.z) > maxBound) {
      this.position.z = Math.sign(this.position.z) * maxBound;
      this.yaw += Math.PI * 0.3 * delta;
    }
    this.position.y = THREE.MathUtils.clamp(this.position.y, -30, 28);

    this.mesh.position.copy(this.position);

    // 4. Procedural Spine Locomotion Undulation (Carangiform Swimming)
    const swimFreq = 3.5 + speedRatio * 4.5;
    const swimAmp = 0.16 + speedRatio * 0.12;
    const wave = Math.sin(time * swimFreq);

    // Sinusoidal wave propagation through body
    this.torso.rotation.y = Math.sin(time * swimFreq) * (swimAmp * 0.4);
    this.tailBase.rotation.y = Math.sin(time * swimFreq - 0.8) * (swimAmp * 1.2);
    this.caudalFin.rotation.y = Math.sin(time * swimFreq - 1.8) * (swimAmp * 2.2);

    // Pectoral fin dynamic roll / pitch
    this.pectoralFins.forEach(({ mesh, side }) => {
      mesh.rotation.x = -this.pitch * 0.4 + Math.sin(time * 2) * 0.05;
      mesh.rotation.y = side * (0.2 + this.roll * 0.5);
    });

    // 5. Bite Animation Snap
    if (this.isBiting) {
      this.biteProgress += delta * 7.0;
      if (this.biteProgress < 1.0) {
        // Open wide
        this.lowerJaw.rotation.x = Math.sin(this.biteProgress * Math.PI) * 0.65;
      } else {
        this.lowerJaw.rotation.x = 0;
        this.isBiting = false;
      }
    }

    // 6. Wake Bubbles when Boosting
    if (this.isBoosting || Math.random() < 0.2) {
      const tailWorldPos = new THREE.Vector3(0, 0, -4).applyMatrix4(this.mesh.matrixWorld);
      this.spawnWakeBubble(tailWorldPos);
    }

    // Update wake particles
    const posArr = this.wakeSystem.geometry.attributes.position.array;
    this.wakeParticles.forEach((p, idx) => {
      if (p.life > 0) {
        p.life -= delta;
        p.pos.addScaledVector(p.vel, delta);
        posArr[idx * 3] = p.pos.x;
        posArr[idx * 3 + 1] = p.pos.y;
        posArr[idx * 3 + 2] = p.pos.z;
      } else {
        posArr[idx * 3 + 1] = -999;
      }
    });
    this.wakeSystem.geometry.attributes.position.needsUpdate = true;
  }

  // Mouth / Snout world coordinates for bite hit-testing
  getMouthPosition() {
    return new THREE.Vector3(0, 0, 3.6).applyMatrix4(this.mesh.matrixWorld);
  }
}
