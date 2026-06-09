"use client";

import { useEffect, useRef } from "react";

// Three.js hero: the Baby Dino model walking in place on the right, rotating as
// you scroll. Lazy (idle), reduced-motion aware, capped DPR, paused offscreen.
// Model: "Baby Dino" by rickymorgue (CC-BY-4.0), credited in the footer.
export function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Skip the WebGL dino on phones — parsing the rigged model blocks the main
    // thread (big mobile TBT hit). Phones get the static crayon hero instead.
    if (window.innerWidth < 768) return;

    let raf = 0;
    let idleId = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let dino: import("three").Object3D | null = null;
    let running = true;
    let io: IntersectionObserver | null = null;
    let onMove: ((e: MouseEvent) => void) | null = null;
    let onResize: (() => void) | null = null;
    let placeDino: (() => void) | null = null;
    let disposed = false;
    // Base orientation that makes the dino face the camera; cursor adds ±yaw.
    const BASE_ROT_Y = Math.PI / 2; // model's front is -x; +90° turns it to face the camera (+z)
    let targetRotY = 0; // cursor-driven offset, starts centered (facing forward)
    let curRotY = 0;

    const init = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const w = mount.clientWidth;
      const h = mount.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
      camera.position.set(0, 0.4, 6);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(3, 6, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffd9a0, 0.7);
      rim.position.set(-4, 2, -3);
      scene.add(rim);

      const loader = new GLTFLoader();
      loader.load(
        "/models/baby-dino/scene.gltf",
        (gltf) => {
          if (disposed) return;
          dino = gltf.scene;

          // Center + scale to a consistent size, then park on the right.
          const box = new THREE.Box3().setFromObject(dino);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const scale = 3.6 / Math.max(size.x, size.y, size.z);
          dino.scale.setScalar(scale);
          dino.position.sub(center.multiplyScalar(scale));

          const pivot = new THREE.Group();
          pivot.add(dino);
          pivot.position.y = -0.2;
          pivot.rotation.y = BASE_ROT_Y;
          scene.add(pivot);
          dino = pivot;

          // Flush the dino to the right edge of the (very wide) hero. Horizontal
          // span depends on aspect, so derive it from the camera frustum.
          placeDino = () => {
            const vH = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z;
            const vW = vH * camera.aspect;
            // Centered in the right ~quarter of the hero (the carved-out space),
            // fully on-screen rather than flush to the edge.
            pivot.position.x = vW * 0.26;
          };
          placeDino();

          if (gltf.animations.length && !reduce) {
            mixer = new THREE.AnimationMixer(gltf.scene);
            mixer.clipAction(gltf.animations[0]).play();
          }
        },
        undefined,
        (err) => console.error("dino load failed", err)
      );

      const clock = new THREE.Clock();
      const animate = () => {
        if (!running || !renderer) return;
        const dt = clock.getDelta();
        if (mixer) mixer.update(dt);
        if (dino) {
          // Ease current yaw toward the cursor-driven target (left/right only).
          curRotY += (targetRotY - curRotY) * 0.07;
          dino.rotation.y = BASE_ROT_Y + (reduce ? 0 : curRotY);
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      // Follow the cursor's horizontal position: turn the dino to "look" toward
      // it, left/right only. Starts centered (facing forward) until the mouse moves.
      onMove = (e: MouseEvent) => {
        if (reduce) return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1 (left) … 1 (right)
        targetRotY = nx * 0.7; // ~±40° of yaw
      };
      window.addEventListener("mousemove", onMove, { passive: true });

      onResize = () => {
        if (!renderer || !mount) return;
        const nw = mount.clientWidth, nh = mount.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        placeDino?.(); // keep him pinned to the right edge after resize
      };
      window.addEventListener("resize", onResize);

      io = new IntersectionObserver(
        ([e]) => {
          running = e.isIntersecting;
          if (running) animate();
          else cancelAnimationFrame(raf);
        },
        { threshold: 0 }
      );
      io.observe(mount);
    };

    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    idleId = ric ? ric(() => init(), { timeout: 2000 }) : window.setTimeout(() => init(), 600);

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(idleId);
      clearTimeout(idleId);
      io?.disconnect();
      if (onMove) window.removeEventListener("mousemove", onMove);
      if (onResize) window.removeEventListener("resize", onResize);
      mixer?.stopAllAction();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  return <div ref={mountRef} className="hero-canvas absolute inset-0 -z-0" aria-hidden />;
}
