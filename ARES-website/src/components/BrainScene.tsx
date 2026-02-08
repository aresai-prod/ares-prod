"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function BrainScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const makeLobe = (offsetX: number, color: number) => {
      const geometry = new THREE.SphereGeometry(1.3, 40, 40);
      const positions = geometry.attributes.position;
      const basePositions = positions.array.slice(0) as Float32Array;
      geometry.translate(offsetX, 0, 0);

      const material = new THREE.PointsMaterial({
        color,
        size: 0.04,
        transparent: true,
        opacity: 0.85
      });
      const points = new THREE.Points(geometry, material);
      return { points, basePositions };
    };

    const left = makeLobe(-1.2, 0x00e5ff);
    const right = makeLobe(1.2, 0x7b2ff7);
    group.add(left.points, right.points);

    const bridgeGeometry = new THREE.TorusGeometry(0.6, 0.12, 12, 40);
    bridgeGeometry.rotateX(Math.PI / 2);
    const bridgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3a86ff,
      transparent: true,
      opacity: 0.5
    });
    const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
    group.add(bridge);

    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      mouseX = x;
      mouseY = y;
    };

    const animate = () => {
      const time = performance.now() * 0.001;
      const wobble = Math.sin(time) * 0.08;

      const updatePoints = (points: THREE.Points, basePositions: Float32Array) => {
        const positions = (points.geometry.attributes.position.array as Float32Array);
        for (let i = 0; i < positions.length; i += 3) {
          const ox = basePositions[i];
          const oy = basePositions[i + 1];
          const oz = basePositions[i + 2];
          positions[i] = ox + Math.sin(time + ox * 2) * 0.02;
          positions[i + 1] = oy + Math.cos(time + oy * 2) * 0.02;
          positions[i + 2] = oz + Math.sin(time + oz * 3) * 0.02;
        }
        points.geometry.attributes.position.needsUpdate = true;
      };

      updatePoints(left.points, left.basePositions as Float32Array);
      updatePoints(right.points, right.basePositions as Float32Array);

      group.rotation.y += 0.002 + mouseX * 0.003;
      group.rotation.x += mouseY * 0.002;
      group.position.y = wobble;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener("mousemove", onMouseMove);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
