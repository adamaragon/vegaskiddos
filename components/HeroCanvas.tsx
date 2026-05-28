"use client";

import { useEffect, useRef } from "react";

// Three.js hero: the Baby Dino model walking in place on the right, rotating as
// you scroll. Lazy (idle), reduced-motion aware, capped DPR, paused offscreen.
// Model: "Baby Dino" by rickymorgue (CC-BY-4.0), credited in the footer.
export function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let idleId = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let dino: import("three").Object3D | null = null;
    let running = true;
    let io: IntersectionObserver | null = null;
    let onScroll: (() => void) | null = null;
    let onResize: (() => void) | null = null;
    let disposed = false;
    let targetRotY = 0;
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
          const small = w < 700;
          const scale = (small ? 2.7 : 3.9) / Math.max(size.x, size.y, size.z);
          dino.scale.setScalar(scale);
          dino.position.sub(center.multiplyScalar(scale));

          const pivot = new THREE.Group();
          pivot.add(dino);
          // Tuck to the right; smaller and slightly lower on phones.
          pivot.position.x = small ? 1.1 : 2.6;
          pivot.position.y = small ? -0.5 : -0.2;
          pivot.rotation.y = -0.5;
          scene.add(pivot);
          dino = pivot;

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
          // Ease current rotation toward the scroll-driven target.
          curRotY += (targetRotY - curRotY) * 0.08;
          dino.rotation.y = -0.5 + curRotY;
          if (reduce) dino.rotation.y = -0.5; // no scroll spin if reduced motion
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const computeRot = () => {
        // Distance-based so it visibly spins through the first ~2 screens of
        // scroll (page height is huge, so a normalized 0–1 would barely move).
        targetRotY = window.scrollY / 180; // ~1130px of scroll ≈ one full turn
      };
      onScroll = () => computeRot();
      computeRot();
      window.addEventListener("scroll", onScroll, { passive: true });

      onResize = () => {
        if (!renderer || !mount) return;
        const nw = mount.clientWidth, nh = mount.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
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
      if (onScroll) window.removeEventListener("scroll", onScroll);
      if (onResize) window.removeEventListener("resize", onResize);
      mixer?.stopAllAction();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 -z-0" aria-hidden />;
}
