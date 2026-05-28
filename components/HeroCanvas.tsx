"use client";

import { useEffect, useRef } from "react";

// A lightweight, performant Three.js backdrop: a dozen floating low-poly
// "toy" shapes (balloons, blocks, stars) in brand colors, gently bobbing.
// Perf guards: capped DPR, paused when offscreen, disabled for reduced-motion
// and on very small/low-power screens. Loaded lazily (dynamic import).
export function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    // Skip the WebGL scene on phones — they get the static crayon doodles instead.
    // Keeps mobile main-thread light (big Lighthouse TBT/LCP win).
    if (window.innerWidth < 768) return;

    let raf = 0;
    let idleId = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let running = true;
    let io: IntersectionObserver | null = null;
    let cleanupResize: (() => void) | null = null;
    let disposed = false;

    const init = async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const w = mount.clientWidth;
      const h = mount.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.z = 14;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(5, 8, 6);
      scene.add(dir);

      const palette = [0xff6b5e, 0xffc93c, 0x23c4b5, 0x7b5ea7, 0xffffff];
      const geos = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.TetrahedronGeometry(1.3, 0),
        new THREE.TorusGeometry(0.9, 0.35, 12, 24),
      ];
      const count = w < 640 ? 8 : 14;
      const toys: { mesh: import("three").Mesh; sp: number; ph: number; amp: number }[] = [];

      for (let i = 0; i < count; i++) {
        const geo = geos[i % geos.length];
        const mat = new THREE.MeshStandardMaterial({
          color: palette[i % palette.length],
          flatShading: true,
          roughness: 0.6,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const s = 0.5 + Math.random() * 0.8;
        mesh.scale.setScalar(s);
        mesh.position.set(
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 6 - 2
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(mesh);
        toys.push({ mesh, sp: 0.2 + Math.random() * 0.5, ph: Math.random() * 10, amp: 0.4 + Math.random() * 0.6 });
      }

      const clock = new THREE.Clock();
      const animate = () => {
        if (!running || !renderer) return;
        const t = clock.getElapsedTime();
        for (const o of toys) {
          o.mesh.rotation.x += o.sp * 0.004;
          o.mesh.rotation.y += o.sp * 0.006;
          o.mesh.position.y += Math.sin(t * o.sp + o.ph) * 0.004 * o.amp;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => {
        if (!renderer || !mount) return;
        const nw = mount.clientWidth, nh = mount.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener("resize", onResize);
      cleanupResize = () => window.removeEventListener("resize", onResize);

      // Pause render loop when the hero scrolls offscreen.
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

    // Defer to browser idle so the 3D scene never blocks first paint / TBT.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    idleId = ric ? ric(() => init(), { timeout: 2000 }) : window.setTimeout(() => init(), 800);

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(idleId);
      clearTimeout(idleId);
      io?.disconnect();
      cleanupResize?.();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 -z-0" aria-hidden />;
}
