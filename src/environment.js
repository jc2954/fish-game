import * as THREE from 'three';

export class OceanEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.kelpStalks = [];
    this.bubbles = null;
    this.causticCanvas = null;
    this.causticTexture = null;
    this.causticCtx = null;
    this.causticTime = 0;
    this.sunbeams = [];

    this.initLighting();
    this.initSeabed();
    this.initWaterSurface();
    this.initSunbeams();
    this.initKelpForest();
    this.initMarineSnowAndBubbles();
    this.initRocksAndCorals();
  }

  initLighting() {
    // Ambient light - deep ocean blue/cyan
    const ambientLight = new THREE.AmbientLight(0x0c3b5e, 1.8);
    this.scene.add(ambientLight);

    // Directional sunlight streaming through water surface
    const sunLight = new THREE.DirectionalLight(0x7df9ff, 3.2);
    sunLight.position.set(20, 60, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    this.scene.add(sunLight);

    // Subtle upward bounce light from sandy ocean floor
    const floorBounce = new THREE.DirectionalLight(0x0a4d68, 1.0);
    floorBounce.position.set(0, -40, 0);
    this.scene.add(floorBounce);
  }

  // Create animated procedural caustics canvas texture
  createCausticTexture() {
    const size = 256;
    this.causticCanvas = document.createElement('canvas');
    this.causticCanvas.width = size;
    this.causticCanvas.height = size;
    this.causticCtx = this.causticCanvas.getContext('2d');
    this.causticTexture = new THREE.CanvasTexture(this.causticCanvas);
    this.causticTexture.wrapS = THREE.RepeatWrapping;
    this.causticTexture.wrapT = THREE.RepeatWrapping;
    this.causticTexture.repeat.set(8, 8);
    return this.causticTexture;
  }

  updateCausticTexture(delta) {
    if (!this.causticCtx) return;
    this.causticTime += delta * 2.2;

    const ctx = this.causticCtx;
    const w = 256;
    const h = 256;

    // Create dual wave caustics
    ctx.fillStyle = '#114455';
    ctx.fillRect(0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const t = this.causticTime;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        // Multi-frequency wave pattern
        const v1 = Math.sin(x * 0.08 + t) + Math.cos(y * 0.08 - t * 0.8);
        const v2 = Math.sin((x + y) * 0.05 + t * 1.2) + Math.cos((x - y) * 0.06 - t);
        const wave = Math.max(0, (v1 + v2) * 0.5);
        const intensity = Math.pow(wave, 3.0) * 160;

        const idx = (y * w + x) * 4;
        data[idx] = Math.min(255, 30 + intensity * 0.8);     // R
        data[idx + 1] = Math.min(255, 80 + intensity * 1.2);  // G
        data[idx + 2] = Math.min(255, 110 + intensity * 1.4); // B
        data[idx + 3] = 255;

        // duplicate to 2x2 block for performance
        const idxNext = idx + 4;
        data[idxNext] = data[idx];
        data[idxNext + 1] = data[idx + 1];
        data[idxNext + 2] = data[idx + 2];
        data[idxNext + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.causticTexture.needsUpdate = true;
  }

  initSeabed() {
    const geo = new THREE.PlaneGeometry(220, 220, 64, 64);
    const pos = geo.attributes.position;

    // Procedural sand dunes & ripples
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const z = Math.sin(vx * 0.05) * Math.cos(vy * 0.05) * 3.5 +
                Math.sin(vx * 0.12 + 1) * Math.cos(vy * 0.1 + 2) * 1.5;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();

    const causticTex = this.createCausticTexture();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b5e7d,
      roughness: 0.85,
      metalness: 0.1,
      map: causticTex,
      bumpMap: causticTex,
      bumpScale: 0.35,
      flatShading: false
    });

    const seabed = new THREE.Mesh(geo, mat);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -35;
    seabed.receiveShadow = true;
    this.scene.add(seabed);
  }

  // Water surface plane seen from below
  initWaterSurface() {
    const geo = new THREE.PlaneGeometry(240, 240, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2ae3ff,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    const surface = new THREE.Mesh(geo, mat);
    surface.rotation.x = Math.PI / 2;
    surface.position.y = 35;
    this.scene.add(surface);
    this.waterSurface = surface;
  }

  // Volumetric Sunbeams / God rays descending from the top
  initSunbeams() {
    const beamCount = 14;
    const beamGeo = new THREE.CylinderGeometry(0.8, 6.5, 75, 12, 1, true);

    for (let i = 0; i < beamCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7df9ff,
        transparent: true,
        opacity: 0.08 + Math.random() * 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(
        (Math.random() - 0.5) * 120,
        5,
        (Math.random() - 0.5) * 120
      );
      beam.rotation.x = 0.2 + (Math.random() - 0.5) * 0.15;
      beam.rotation.z = (Math.random() - 0.5) * 0.2;
      beam.userData = {
        baseOpacity: mat.opacity,
        pulseSpeed: 0.8 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2
      };

      this.scene.add(beam);
      this.sunbeams.push(beam);
    }
  }

  // Giant kelp stalks with swaying leaves
  initKelpForest() {
    const kelpCount = 35;
    const leafGeo = new THREE.PlaneGeometry(1.6, 3.2);

    for (let i = 0; i < kelpCount; i++) {
      const group = new THREE.Group();
      const x = (Math.random() - 0.5) * 160;
      const z = (Math.random() - 0.5) * 160;

      // Group kelp in natural clusters
      if (Math.hypot(x, z) < 15) continue; // Keep center clear

      const height = 30 + Math.random() * 25;
      const segments = 10;
      const stalkGeo = new THREE.CylinderGeometry(0.25, 0.45, height, 6);
      const stalkMat = new THREE.MeshStandardMaterial({
        color: 0x175c27,
        roughness: 0.6
      });

      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.y = height / 2;
      group.add(stalk);

      // Add undulating leaves along the stalk
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0x228b3b,
        roughness: 0.5,
        side: THREE.DoubleSide
      });

      for (let j = 0; j < 8; j++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const yPos = 4 + j * (height / 9);
        leaf.position.set(0, yPos, 0);
        leaf.rotation.y = j * 1.8;
        leaf.rotation.x = 0.5;
        group.add(leaf);
      }

      group.position.set(x, -35, z);
      group.userData = {
        swaySpeed: 1.2 + Math.random() * 0.8,
        swayAmp: 0.06 + Math.random() * 0.05,
        offset: Math.random() * 10
      };

      this.scene.add(group);
      this.kelpStalks.push(group);
    }
  }

  // Scattered rocks and coral heads on the ocean floor
  initRocksAndCorals() {
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x1f3c4d,
      roughness: 0.9
    });

    for (let i = 0; i < 28; i++) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const scale = 2.5 + Math.random() * 5.0;
      rock.scale.set(scale, scale * (0.6 + Math.random() * 0.7), scale);
      rock.position.set(
        (Math.random() - 0.5) * 170,
        -34 + scale * 0.3,
        (Math.random() - 0.5) * 170
      );
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }

    // Colorful coral clusters
    const coralColors = [0xff6b6b, 0xff9f43, 0xa55eea, 0x00d2d3];
    for (let i = 0; i < 20; i++) {
      const color = coralColors[Math.floor(Math.random() * coralColors.length)];
      const coralMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        emissive: color,
        emissiveIntensity: 0.15
      });
      const coralGeo = new THREE.SphereGeometry(1.2, 8, 8);
      const coral = new THREE.Mesh(coralGeo, coralMat);
      coral.scale.set(1 + Math.random(), 2 + Math.random() * 2, 1 + Math.random());
      coral.position.set(
        (Math.random() - 0.5) * 150,
        -34,
        (Math.random() - 0.5) * 150
      );
      this.scene.add(coral);
    }
  }

  // Floating marine snow and rising air bubbles
  initMarineSnowAndBubbles() {
    // Marine snow particles
    const snowCount = 900;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount * 3; i += 3) {
      snowPos[i] = (Math.random() - 0.5) * 180;
      snowPos[i + 1] = -34 + Math.random() * 68;
      snowPos[i + 2] = (Math.random() - 0.5) * 180;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0x8be4ff,
      size: 0.45,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });

    this.marineSnow = new THREE.Points(snowGeo, snowMat);
    this.scene.add(this.marineSnow);

    // Rising bubble particles
    const bubbleCount = 200;
    const bubbleGeo = new THREE.BufferGeometry();
    const bubblePos = new Float32Array(bubbleCount * 3);
    const bubbleVel = new Float32Array(bubbleCount);

    for (let i = 0; i < bubbleCount; i++) {
      bubblePos[i * 3] = (Math.random() - 0.5) * 140;
      bubblePos[i * 3 + 1] = -34 + Math.random() * 68;
      bubblePos[i * 3 + 2] = (Math.random() - 0.5) * 140;
      bubbleVel[i] = 4 + Math.random() * 6;
    }

    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
    this.bubbleVelocities = bubbleVel;

    const bubbleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.65,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    this.bubbles = new THREE.Points(bubbleGeo, bubbleMat);
    this.scene.add(this.bubbles);
  }

  update(delta, time) {
    // Update procedural caustics every few frames
    this.updateCausticTexture(delta);

    // Sway kelp forest
    this.kelpStalks.forEach(stalk => {
      const u = stalk.userData;
      stalk.rotation.z = Math.sin(time * u.swaySpeed + u.offset) * u.swayAmp;
      stalk.rotation.x = Math.cos(time * (u.swaySpeed * 0.8) + u.offset) * (u.swayAmp * 0.7);
    });

    // Pulse and sway sunbeams
    this.sunbeams.forEach(beam => {
      const u = beam.userData;
      beam.material.opacity = u.baseOpacity + Math.sin(time * u.pulseSpeed + u.phase) * 0.03;
      beam.rotation.z += Math.sin(time * 0.5 + u.phase) * 0.0003;
    });

    // Update marine snow drift
    if (this.marineSnow) {
      const pos = this.marineSnow.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(time + pos[i + 1]) * 0.02;
        pos[i + 1] -= delta * 0.8;
        if (pos[i + 1] < -34) pos[i + 1] = 34;
      }
      this.marineSnow.geometry.attributes.position.needsUpdate = true;
    }

    // Update rising bubbles
    if (this.bubbles) {
      const pos = this.bubbles.geometry.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        const idx = i * 3;
        pos[idx + 1] += this.bubbleVelocities[i] * delta;
        pos[idx] += Math.sin(time * 2 + i) * 0.03;
        if (pos[idx + 1] > 34) {
          pos[idx + 1] = -34;
          pos[idx] = (Math.random() - 0.5) * 140;
          pos[idx + 2] = (Math.random() - 0.5) * 140;
        }
      }
      this.bubbles.geometry.attributes.position.needsUpdate = true;
    }
  }
}
