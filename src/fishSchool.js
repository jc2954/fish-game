import * as THREE from 'three';
import { audio } from './audio.js';

export class FishSchool {
  constructor(scene, count = 200) {
    this.scene = scene;
    this.count = count;
    this.fishList = [];
    this.fleeRadius = 38.0; // Distance at which fish detect the shark
    this.closestDist = 999;
    this.overallPanic = 0;

    // Eat / Consumption stats
    this.eatenCount = 0;
    this.combo = 1.0;
    this.comboTimer = 0;

    // Splash / Eat Particle System
    this.initBiteParticles();

    // Create the school of fish
    this.initSchool();
  }

  // Create fish 3D models with customizable vibrant tropical color schemes
  createFishMesh(colorVariant) {
    const group = new THREE.Group();

    // Color palettes for reef variety
    const palettes = [
      { body: 0xff7b25, belly: 0xffffff, fin: 0x222222, glow: 0xff9f43 }, // Clownfish Orange & White
      { body: 0x0abde3, belly: 0xfeca57, fin: 0x10ac84, glow: 0x48dbfb }, // Neon Tang Cyan & Gold
      { body: 0x5f27cd, belly: 0xff9ff3, fin: 0x341f97, glow: 0x9b59b6 }, // Royal Gramma Purple
      { body: 0x1dd1a1, belly: 0xee5253, fin: 0x10ac84, glow: 0x10ac84 }  // Emerald Damsel
    ];
    const pal = palettes[colorVariant % palettes.length];

    const bodyMat = new THREE.MeshStandardMaterial({
      color: pal.body,
      roughness: 0.35,
      metalness: 0.25
    });

    const finMat = new THREE.MeshStandardMaterial({
      color: pal.fin,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1
    });

    // Streamlined body
    const bodyGeo = new THREE.ConeGeometry(0.35, 1.4, 8);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(0.65, 1.2, 1.0);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Eyes
    [-0.22, 0.22].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eye.position.set(x, 0.1, 0.45);
      group.add(eye);
    });

    // Dorsal Fin
    const dorsalGeo = new THREE.PlaneGeometry(0.25, 0.6);
    const dorsal = new THREE.Mesh(dorsalGeo, finMat);
    dorsal.position.set(0, 0.4, -0.1);
    dorsal.rotation.y = Math.PI / 2;
    dorsal.rotation.x = -0.4;
    group.add(dorsal);

    // Wagging Tail Fin (Attached to tail node for dynamic oscillation)
    const tailNode = new THREE.Group();
    tailNode.position.set(0, 0, -0.7);
    group.add(tailNode);

    const tailGeo = new THREE.PlaneGeometry(0.5, 0.75);
    const tail = new THREE.Mesh(tailGeo, finMat);
    tail.position.set(0, 0, -0.3);
    tail.rotation.y = Math.PI / 2;
    tailNode.add(tail);

    group.scale.set(1.1, 1.1, 1.1);

    return {
      mesh: group,
      tailNode,
      bodyMat,
      baseColor: new THREE.Color(pal.body),
      glowColor: new THREE.Color(pal.glow)
    };
  }

  initSchool() {
    for (let i = 0; i < this.count; i++) {
      const colorVariant = Math.floor(Math.random() * 4);
      const { mesh, tailNode, bodyMat, baseColor, glowColor } = this.createFishMesh(colorVariant);

      // Distribute fish initially in a natural schooling formation
      const radius = 25 + Math.random() * 35;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 35;

      mesh.position.set(
        Math.cos(angle) * radius + (Math.random() - 0.5) * 15,
        y,
        Math.sin(angle) * radius + (Math.random() - 0.5) * 15
      );

      // Random starting velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(4.5);

      this.scene.add(mesh);

      this.fishList.push({
        id: i,
        mesh,
        tailNode,
        bodyMat,
        baseColor,
        glowColor,
        position: mesh.position,
        velocity,
        acceleration: new THREE.Vector3(),
        speed: 4.5,
        baseSpeed: 4.2 + Math.random() * 1.2,
        maxPanicSpeed: 25.0 + Math.random() * 4.0,
        panicRatio: 0,
        tailPhase: Math.random() * Math.PI * 2,
        active: true,
        respawnTimer: 0
      });
    }
  }

  // Particle explosion when fish is eaten
  initBiteParticles() {
    const pCount = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 1.2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.biteSystem = new THREE.Points(geo, mat);
    this.scene.add(this.biteSystem);

    this.biteParticles = [];
    for (let i = 0; i < pCount; i++) {
      this.biteParticles.push({
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        life: 0
      });
    }
  }

  spawnBiteSplash(centerPos) {
    for (let i = 0; i < 24; i++) {
      const p = this.biteParticles.find(bp => bp.life <= 0);
      if (!p) break;
      p.pos.copy(centerPos);
      p.vel.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12 + 4,
        (Math.random() - 0.5) * 12
      );
      p.life = 0.6 + Math.random() * 0.5;
    }
  }

  update(delta, time, shark) {
    const sharkPos = shark.position;
    const sharkMouthPos = shark.getMouthPosition();

    let minDistance = 9999;
    let sumPanic = 0;
    let activeFishCount = 0;

    // Decay feeding frenzy combo
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.combo = 1.0;
      }
    }

    // Process every small fish
    for (let i = 0; i < this.fishList.length; i++) {
      const fish = this.fishList[i];

      // Handle eaten / respawn timer
      if (!fish.active) {
        fish.respawnTimer -= delta;
        if (fish.respawnTimer <= 0) {
          this.respawnFish(fish, sharkPos);
        }
        continue;
      }

      activeFishCount++;

      // 1. Calculate precise Distance to Shark
      const distToShark = fish.position.distanceTo(sharkPos);
      if (distToShark < minDistance) {
        minDistance = distToShark;
      }

      // Check if Shark mouth ate this fish!
      const distToMouth = fish.position.distanceTo(sharkMouthPos);
      if (distToMouth < 3.4) {
        // NOM! Consumed!
        this.consumeFish(fish);
        continue;
      }

      // 2. THE DISTANCE SENSING LOGIC:
      // The closer the shark, the higher the panic ratio (0 to 1)
      let panic = 0;
      if (distToShark < this.fleeRadius) {
        // Inverse distance ratio: 1.0 when right at shark, 0.0 at fleeRadius edge
        panic = 1.0 - (distToShark / this.fleeRadius);
      }
      fish.panicRatio = panic;
      sumPanic += panic;

      // Reset acceleration for this step
      fish.acceleration.set(0, 0, 0);

      // 3. Fleeing Force & Scatter
      if (panic > 0) {
        // Vector away from shark
        const fleeVec = new THREE.Vector3().subVectors(fish.position, sharkPos).normalize();

        // Add perpendicular evasion scatter burst so school splits around the shark
        const scatterNoise = new THREE.Vector3(
          Math.sin(fish.id * 1.7 + time * 3) * 0.4,
          Math.cos(fish.id * 2.3 + time * 3) * 0.3,
          Math.sin(fish.id * 3.1 + time * 3) * 0.4
        );
        fleeVec.add(scatterNoise).normalize();

        // Non-linear flee urgency: exponent ramps up dramatically as distance shrinks!
        const fleeWeight = 8.0 * (1.0 + Math.pow(panic, 2.0) * 5.0);
        fish.acceleration.addScaledVector(fleeVec, fleeWeight);
      }

      // 4. Boids Schooling (Separation, Cohesion, Alignment)
      // When panicking, flee instinct strongly overrides calm schooling
      const calmWeight = Math.max(0.08, 1.0 - panic * 1.2);
      this.applyFlockingForces(fish, calmWeight);

      // 5. Boundary Containment (stay within ocean lagoon)
      this.applyBoundaryForce(fish);

      // 6. SPEED CALCULATION - User Requirement:
      // "the closer the shark the faster the small fish swim away"
      // Calm speed is ~4.5. Max fleeing speed is ~26.0!
      const speedBoost = Math.pow(panic, 1.7) * (fish.maxPanicSpeed - fish.baseSpeed);
      const targetSpeed = fish.baseSpeed + speedBoost;
      fish.speed = THREE.MathUtils.lerp(fish.speed, targetSpeed, delta * 8.0);

      // Apply acceleration to velocity
      fish.velocity.addScaledVector(fish.acceleration, delta);
      fish.velocity.clampLength(fish.baseSpeed * 0.8, fish.speed);

      // Advance position
      fish.position.addScaledVector(fish.velocity, delta);
      fish.mesh.position.copy(fish.position);

      // 7. Align fish rotation with velocity heading
      if (fish.velocity.lengthSq() > 0.1) {
        const targetRot = new THREE.Quaternion();
        const dir = fish.velocity.clone().normalize();
        const matrix = new THREE.Matrix4();
        // Forward is +Z in fish local space
        matrix.lookAt(new THREE.Vector3(0, 0, 0), dir, new THREE.Vector3(0, 1, 0));
        targetRot.setFromRotationMatrix(matrix);
        fish.mesh.quaternion.slerp(targetRot, delta * 10.0);
      }

      // 8. FRANTIC TAIL ANIMATION
      // Tail flapping frequency accelerates 5x faster when panicking!
      const tailFreq = 5.0 + panic * 22.0;
      fish.tailPhase += delta * tailFreq;
      const tailWiggle = Math.sin(fish.tailPhase) * (0.35 + panic * 0.45);
      fish.tailNode.rotation.y = tailWiggle;

      // 9. Visual Panic Flare / Shimmer
      if (panic > 0.4) {
        // Flash bright alert / iridescent silver-cyan
        fish.bodyMat.color.lerpColors(fish.baseColor, fish.glowColor, (panic - 0.4) * 1.6);
      } else {
        fish.bodyMat.color.copy(fish.baseColor);
      }
    }

    // Telemetry
    this.closestDist = minDistance;
    this.overallPanic = activeFishCount > 0 ? (sumPanic / Math.min(25, activeFishCount)) : 0;

    // Update Bite Explosion Particles
    this.updateBiteParticles(delta);
  }

  // Flocking behavior among fish
  applyFlockingForces(fish, weight) {
    const separation = new THREE.Vector3();
    const alignment = new THREE.Vector3();
    const cohesion = new THREE.Vector3();
    let neighborCount = 0;

    const checkLimit = 15; // sample neighbors for 60fps performance
    const startIdx = (fish.id * 3) % this.fishList.length;

    for (let i = 0; i < checkLimit; i++) {
      const other = this.fishList[(startIdx + i) % this.fishList.length];
      if (other === fish || !other.active) continue;

      const d = fish.position.distanceTo(other.position);

      // Separation
      if (d < 2.5 && d > 0.001) {
        const diff = new THREE.Vector3().subVectors(fish.position, other.position).normalize().divideScalar(d);
        separation.add(diff);
      }

      // Alignment & Cohesion
      if (d < 8.0) {
        alignment.add(other.velocity);
        cohesion.add(other.position);
        neighborCount++;
      }
    }

    if (neighborCount > 0) {
      alignment.divideScalar(neighborCount).normalize().multiplyScalar(3.0);
      cohesion.divideScalar(neighborCount).sub(fish.position).normalize().multiplyScalar(2.0);
    }

    fish.acceleration.addScaledVector(separation, 4.0 * weight);
    fish.acceleration.addScaledVector(alignment, 1.8 * weight);
    fish.acceleration.addScaledVector(cohesion, 1.2 * weight);
  }

  // Contain fish within ocean bounds
  applyBoundaryForce(fish) {
    const limit = 80;
    const force = 9.0;

    if (Math.abs(fish.position.x) > limit) {
      fish.acceleration.x -= Math.sign(fish.position.x) * force;
    }
    if (Math.abs(fish.position.z) > limit) {
      fish.acceleration.z -= Math.sign(fish.position.z) * force;
    }
    if (fish.position.y > 28) {
      fish.acceleration.y -= force;
    } else if (fish.position.y < -30) {
      fish.acceleration.y += force;
    }
  }

  // Shark ate a fish
  consumeFish(fish) {
    fish.active = false;
    fish.mesh.visible = false;
    fish.respawnTimer = 4.0 + Math.random() * 3.0; // Respawns after 4-7 seconds

    // Spawn splash & play sound
    this.spawnBiteSplash(fish.position);
    audio.playChomp();

    // Increment stats
    this.eatenCount++;
    this.combo = Math.min(5.0, this.combo + 0.5);
    this.comboTimer = 3.5; // Reset combo timer window

    if (this.combo >= 3.0) {
      audio.playFrenzyStinger();
    }
  }

  // Respawn fish safely on the perimeter
  respawnFish(fish, sharkPos) {
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 65 + Math.random() * 15;

    // Spawn on opposite side from shark
    fish.position.set(
      Math.cos(spawnAngle) * spawnDist,
      (Math.random() - 0.5) * 35,
      Math.sin(spawnAngle) * spawnDist
    );
    fish.velocity.set(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 4
    );
    fish.speed = fish.baseSpeed;
    fish.panicRatio = 0;
    fish.mesh.position.copy(fish.position);
    fish.mesh.visible = true;
    fish.active = true;
  }

  updateBiteParticles(delta) {
    const posArr = this.biteSystem.geometry.attributes.position.array;
    this.biteParticles.forEach((p, idx) => {
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
    this.biteSystem.geometry.attributes.position.needsUpdate = true;
  }
}
