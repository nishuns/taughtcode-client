'use client';

import React, { useRef, useMemo, useState, useEffect, forwardRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Html, OrbitControls, Stars, shaderMaterial, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Effect } from 'postprocessing';

// --- 1. Realistic Gravitational Lensing Effect ---
const LensingShader = {
  fragmentShader: `
    uniform float mass;
    uniform vec2 center;
    uniform float resolutionScale;

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec2 st = uv;
      vec2 mt = center;
      vec2 dir = st - mt;
      dir.x *= resolutionScale; 
      
      float dist = length(dir);
      float radius = 0.04 * mass; 

      if (dist < radius) {
         outputColor = vec4(0.0, 0.0, 0.0, 1.0);
         return;
      }

      float distortion = mass * 0.003 / (dist * dist + 0.001);
      vec2 warpedUv = uv - (dir / dist) * distortion;

      vec4 sceneColor = texture2D(inputBuffer, warpedUv);
      outputColor = vec4(sceneColor.rgb, 1.0);
    }
  `
};

class LensingEffectImpl extends Effect {
  constructor({ mass = 0, center = new THREE.Vector2(0.5, 0.5) } = {}) {
    super('LensingEffect', LensingShader.fragmentShader, {
      uniforms: new Map<string, THREE.Uniform<any>>([
        ['mass', new THREE.Uniform(mass)],
        ['center', new THREE.Uniform(center)],
        ['resolutionScale', new THREE.Uniform(1.77)]
      ])
    });
  }
}

const LensingEffect = forwardRef<any, { mass: number; center: THREE.Vector2 }>(({ mass, center }, ref) => {
  const effect = useMemo(() => new LensingEffectImpl({ mass, center }), [mass, center]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
LensingEffect.displayName = 'LensingEffect';


// --- 2. Refined Star Shader ---
const GalaxyStarMaterial = shaderMaterial(
  { time: 0, pixelRatio: 1 },
  `
    attribute float size;
    attribute vec3 customColor;
    attribute float brightness;
    attribute float randomSeed;
    varying vec3 vColor;
    varying float vBrightness;
    varying float vSeed;
    uniform float pixelRatio;

    void main() {
      vColor = customColor;
      vBrightness = brightness;
      vSeed = randomSeed;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * pixelRatio * (250.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  `
    varying vec3 vColor;
    varying float vBrightness;
    varying float vSeed;
    uniform float time;

    void main() {
      vec2 uv = gl_PointCoord.xy - 0.5;
      float r = length(uv);
      if (r > 0.5) discard;

      float twinkle = 0.7 + 0.3 * sin(time * 2.0 + vSeed * 100.0);
      float strength = 1.0 - (r * 2.2);
      strength = clamp(strength, 0.0, 1.0);
      strength = pow(strength, 3.0) * twinkle * vBrightness;

      gl_FragColor = vec4(vColor, strength);
    }
  `
);

// --- 3. Grok-Style Black Hole Shader ---
const GrokBlackHoleMaterial = shaderMaterial(
  { time: 0 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float time;
    varying vec2 vUv;

    vec2 myTanh(vec2 x) {
      vec2 ex = exp(x);
      vec2 emx = exp(-x);
      return (ex - emx) / (ex + emx);
    }

    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      vec2 p_anim = p / 0.7; 
      vec2 d = vec2(-1.0, 1.0);
      float denom = 0.1 + 5.0 / dot(5.0 * p_anim - d, 5.0 * p_anim - d);
      vec2 c = p_anim * mat2(1.0, 1.0, d.x / denom, d.y / denom);
      vec2 v = c;
      v *= mat2(cos(log(length(v)) + time * 0.2 + vec4(0.0, 33.0, 11.0, 0.0))) * 5.0;
      vec4 animAccum = vec4(0.0);
      for (int i = 1; i <= 9; i++) {
        float fi = float(i);
        animAccum += sin(vec4(v.x, v.y, v.y, v.x)) + vec4(1.0);
        v += 0.7 * sin(vec2(v.y, v.x) * fi + time) / fi + 0.5;
      }
      vec4 animTerm = 1.0 - exp(-exp(c.x * vec4(0.6, -0.4, -1.0, 0.0))
                        / animAccum
                        / (0.1 + 0.1 * pow(length(sin(v / 0.3) * 0.2 + c * vec2(1.0, 2.0)) - 1.0, 2.0))
                        / (1.0 + 7.0 * exp(0.3 * c.y - dot(c, c)))
                        / (0.03 + abs(length(p_anim) - 0.7)) * 0.2);
      vec3 color = animTerm.rgb * 1.5; 
      float brightness = dot(color, vec3(0.299, 0.587, 0.114));
      float alpha = smoothstep(0.1, 0.4, brightness); 
      color *= vec3(1.2, 0.8, 0.5);
      gl_FragColor = vec4(color, alpha);
    }
  `
);

extend({ GalaxyStarMaterial, GrokBlackHoleMaterial });

// --- Sputnik-1 Component ---
const Sputnik = () => {
  const ref = useRef<THREE.Group>(null!);
  
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 0.15; // Slow orbit
    // Orbit path
    ref.current.position.x = Math.sin(t) * 9;
    ref.current.position.z = Math.cos(t) * 9;
    ref.current.position.y = Math.sin(t * 1.5) * 3;
    
    // Self rotation
    ref.current.rotation.x += 0.005;
    ref.current.rotation.y += 0.01;
  });

  return (
    <group ref={ref}>
      {/* Main Body */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Antennae - 4 distinct swept-back rods */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (Math.PI / 2) * i, 0]}>
          <mesh rotation={[Math.PI / 4, 0, 0]} position={[0, 0, 0.8]}>
            <cylinderGeometry args={[0.01, 0.01, 1.8]} />
            <meshStandardMaterial color="#aaaaaa" metalness={0.8} />
          </mesh>
        </group>
      ))}
      
      {/* Tiny blinker light */}
      <pointLight color="red" intensity={0.5} distance={2} />
    </group>
  );
};

// --- Shooting Star System ---
const ShootingStars = () => {
  const count = 5;
  const lines = useMemo(() => new Array(count).fill(0).map(() => ({
    startPos: new THREE.Vector3((Math.random()-0.5)*30, (Math.random()-0.5)*30, (Math.random()-0.5)*10),
    speed: 0.2 + Math.random() * 0.5,
    offset: Math.random() * 100
  })), []);

  const ref = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
     if (!ref.current) return;
     const t = clock.getElapsedTime();
     
     ref.current.children.forEach((child, i) => {
       const star = lines[i];
       const localTime = (t + star.offset) % 5; // 5 second cycle
       
       if (localTime < 1.0) { // Active for 1 second
          child.visible = true;
          // Move across
          const progress = localTime; 
          child.position.x = star.startPos.x + progress * 20; 
          child.position.y = star.startPos.y - progress * 10;
          child.scale.setScalar(1.0 - progress); // Shrink as it goes
       } else {
          child.visible = false;
          // Reset occasionally
          if (localTime > 4.9) {
             star.startPos.set((Math.random()-0.5)*40, 10 + Math.random()*10, -10 + Math.random()*20);
          }
       }
     });
  });

  return (
    <group ref={ref}>
      {lines.map((_, i) => (
        <mesh key={i} rotation={[0, 0, Math.PI / 2]}>
           {/* Trail shape */}
           <cylinderGeometry args={[0.01, 0.0, 4]} />
           <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// --- Galaxy Particle System ---
const GalaxySystem = ({ phase }: { phase: string }) => {
  const count = 30000; // Increased count
  const mesh = useRef<THREE.Points>(null!);
  const materialRef = useRef<any>(null!);
  
  const [initialPos, galaxyPos, colors, sizes, brightness, seeds] = useMemo(() => {
    const initialPos = new Float32Array(count * 3);
    const galaxyPos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    const seeds = new Float32Array(count);
    
    const colorCore = new THREE.Color('#fff0d0');
    const colorArm = new THREE.Color('#d0e0ff');
    const colorDust = new THREE.Color('#201008'); // Dark dust

    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      initialPos[i*3] = (Math.random()-0.5) * 0.05;
      initialPos[i*3+1] = (Math.random()-0.5) * 0.05;
      initialPos[i*3+2] = (Math.random()-0.5) * 0.05;

      const type = Math.random();
      let radius, angle, yDisp, size, b, color;

      if (type > 0.95) { 
        // Core
        radius = Math.pow(Math.random(), 2.0) * 2.5;
        angle = Math.random() * Math.PI * 2;
        yDisp = (Math.random() - 0.5) * 1.5 * (1.0 - radius/3.0);
        size = 1.0 + Math.random() * 2.0;
        b = 0.5 + Math.random() * 0.5;
        color = colorCore;
      } else if (type > 0.4) {
        // Spiral Arms
        radius = 2.0 + Math.random() * 9.0;
        const arms = 2 + Math.floor(Math.random() * 2);
        const armAngle = (i % arms) * ((Math.PI * 2) / arms);
        const spiralAngle = radius * 0.6;
        const scatter = (Math.random() - 0.5) * (2.0 / (radius * 0.2 + 1.0)); // More scatter
        angle = armAngle + spiralAngle + scatter;
        yDisp = (Math.random() - 0.5) * 0.4;
        size = 0.5 + Math.random() * 1.5;
        b = 0.2 + Math.random() * 0.8;
        color = colorArm.clone().lerp(colorCore, Math.random() * 0.5);
      } else {
        // Asteroids / Dust (Significantly increased proportion)
        radius = 1.5 + Math.random() * 12.0;
        angle = Math.random() * Math.PI * 2;
        yDisp = (Math.random() - 0.5) * 0.2; // Flat disk
        size = 0.3 + Math.random() * 1.2; // Chunky asteroids
        b = 0.3 + Math.random() * 0.4; // Visible but dark
        color = colorDust.clone().lerp(new THREE.Color('#555555'), Math.random()); // Grey/Brown mix
      }

      galaxyPos[i*3] = Math.cos(angle) * radius;
      galaxyPos[i*3+1] = yDisp;
      galaxyPos[i*3+2] = Math.sin(angle) * radius;

      colors[i*3] = color.r;
      colors[i*3+1] = color.g;
      colors[i*3+2] = color.b;
      sizes[i] = size;
      brightness[i] = b;
    }
    return [initialPos, galaxyPos, colors, sizes, brightness, seeds];
  }, []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    if (materialRef.current) materialRef.current.time = state.clock.getElapsedTime();

    const positionsAttribute = mesh.current.geometry.attributes.position;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      let x, y, z;

      if (phase === 'singularity') {
         x = initialPos[idx] + (Math.random()-0.5)*0.01;
         y = initialPos[idx+1] + (Math.random()-0.5)*0.01;
         z = initialPos[idx+2] + (Math.random()-0.5)*0.01;
      } else {
         const tx = galaxyPos[idx];
         const ty = galaxyPos[idx+1];
         const tz = galaxyPos[idx+2];
         const t = Math.max(0, Math.min(1, (time - 1.5) / 4.0));
         const ease = t * t * (3 - 2 * t);
         x = tx * ease;
         y = ty * ease;
         z = tz * ease;
         if (phase === 'galaxy' || phase === 'blackhole') {
            const dist = Math.sqrt(x*x + z*z);
            const rotSpeed = 0.3 / (dist + 1.0);
            const cosR = Math.cos(delta * rotSpeed);
            const sinR = Math.sin(delta * rotSpeed);
            const nx = x * cosR - z * sinR;
            const nz = x * sinR + z * cosR;
            x = nx;
            z = nz;
         }
      }
      positionsAttribute.setXYZ(i, x, y, z);
    }
    positionsAttribute.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={initialPos} itemSize={3} args={[initialPos, 3]} />
        <bufferAttribute attach="attributes-customColor" count={count} array={colors} itemSize={3} args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} args={[sizes, 1]} />
        <bufferAttribute attach="attributes-brightness" count={count} array={brightness} itemSize={1} args={[brightness, 1]} />
        <bufferAttribute attach="attributes-randomSeed" count={count} array={seeds} itemSize={1} args={[seeds, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <galaxyStarMaterial ref={materialRef} transparent vertexColors blending={THREE.AdditiveBlending} depthWrite={false} pixelRatio={window.devicePixelRatio || 1} />
    </points>
  );
};

// --- Smaller Black Hole Core with Grok Shader ---
const BlackHoleCore = ({ visible }: { visible: boolean }) => {
  const ref = useRef<THREE.Group>(null!);
  const matRef = useRef<any>(null!);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const targetScale = visible ? 0.35 : 0; 
    ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 1.5);
    if (matRef.current) matRef.current.time = state.clock.getElapsedTime();
  });

  return (
    <group ref={ref} scale={[0,0,0]}>
      <mesh>
        <sphereGeometry args={[0.8, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[8, 8]} /> 
        {/* @ts-ignore */}
        <grokBlackHoleMaterial ref={matRef} transparent side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

const StoryScene = () => {
  const [phase, setPhase] = useState('singularity');
  const [showText, setShowText] = useState(false);
  const [lensingMass, setLensingMass] = useState(0);

  useEffect(() => {
    setTimeout(() => setPhase('bang'), 1500);
    setTimeout(() => setPhase('galaxy'), 5000);
    setTimeout(() => setPhase('blackhole'), 6500);
    setTimeout(() => setShowText(true), 8500);
  }, []);

  useFrame((state, delta) => {
    if (phase === 'blackhole') {
       setLensingMass(m => Math.min(m + delta * 0.4, 0.4));
    }
  });

  return (
    <>
      <color attach="background" args={['#000000']} />
      
      <Stars radius={400} depth={50} count={3000} factor={4} saturation={0} fade />
      <GalaxySystem phase={phase} />
      <BlackHoleCore visible={phase === 'blackhole'} />
      <Sputnik />
      <ShootingStars />

      {showText && (
        <Html position={[0, 0, 0]} center zIndexRange={[100, 0]}>
           <div className="flex flex-col items-center justify-center w-screen h-screen pointer-events-none mt-72">
             <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter opacity-70"
                 style={{ textShadow: '0 0 20px rgba(255,255,255,0.4)' }}>
               I&apos;M NISCHAY
             </h1>
             <p className="text-white tracking-[0.6em] text-[10px] uppercase opacity-40 mt-2">
                Across the Galactic Horizon
             </p>
           </div>
        </Html>
      )}

      <OrbitControls 
        enableZoom={false} 
        autoRotate 
        autoRotateSpeed={0.2} 
        maxPolarAngle={Math.PI / 1.8} 
        minPolarAngle={Math.PI / 2.5} 
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.5} intensity={0.8} radius={0.4} />
        <LensingEffect mass={lensingMass} center={new THREE.Vector2(0.5, 0.5)} />
      </EffectComposer>
    </>
  );
};

export default function BigBangScene() {
  return (
    <div className="w-full h-screen absolute top-0 left-0 bg-black overflow-hidden">
      <Canvas camera={{ position: [0, 8, 18], fov: 35 }} gl={{ antialias: false }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <StoryScene />
      </Canvas>
    </div>
  );
}
