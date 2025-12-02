import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Float,
  PerspectiveCamera,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import * as THREE from "three";

// ==========================================
// 1. 数学与工具算法 (修复版)
// ==========================================

// 修复：手动定义 damp 函数，解决 Netlify 报错
function damp(current: number, target: number, lambda: number, delta: number) {
  // 使用指数衰减实现平滑插值 (Frame-rate independent damping)
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

const getPhyllotaxisPosition = (
  index: number,
  total: number,
  maxRadius: number,
  heightScale: number
) => {
  const angle = index * 137.5 * (Math.PI / 180);
  const normalizedHeight = index / total;
  const currentRadius =
    maxRadius * (1 - normalizedHeight) * (0.8 + Math.random() * 0.4);

  const x = Math.cos(angle) * currentRadius;
  const z = Math.sin(angle) * currentRadius;
  const y = normalizedHeight * heightScale - heightScale / 2;

  return new THREE.Vector3(x, y, z);
};

const randomVectorInSphere = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// ==========================================
// 2. 组件：针叶粒子系统
// ==========================================
const NeedleParticles = ({
  mode,
  count = 5000,
}: {
  mode: string;
  count?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      treePos: getPhyllotaxisPosition(i, count, 4.5, 10),
      scatterPos: randomVectorInSphere(18),
      speed: Math.random() * 0.2 + 0.1,
      rotationOffset: Math.random() * Math.PI,
      scale: Math.random() * 0.6 + 0.4,
    }));
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const targetT = mode === "TREE_SHAPE" ? 1 : 0;

    data.forEach((particle, i) => {
      // 目标位置计算
      const tx = THREE.MathUtils.lerp(
        particle.scatterPos.x,
        particle.treePos.x,
        targetT
      );
      const ty = THREE.MathUtils.lerp(
        particle.scatterPos.y,
        particle.treePos.y,
        targetT
      );
      const tz = THREE.MathUtils.lerp(
        particle.scatterPos.z,
        particle.treePos.z,
        targetT
      );

      // 修复：使用自定义的 damp 函数
      dummy.position.x = damp(dummy.position.x, tx, 1.5, delta);
      dummy.position.y = damp(dummy.position.y, ty, 1.5, delta);
      dummy.position.z = damp(dummy.position.z, tz, 1.5, delta);

      const time = state.clock.elapsedTime;
      dummy.rotation.set(
        Math.sin(time * particle.speed * 0.5 + particle.rotationOffset) * 0.2,
        time * particle.speed + particle.rotationOffset,
        Math.cos(time * particle.speed * 0.5 + particle.rotationOffset) * 0.2
      );
      dummy.scale.setScalar(particle.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.04, 0.3, 4]} />
      <meshStandardMaterial
        color="#002419"
        emissive="#001409"
        roughness={0.8}
        metalness={0.2}
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 组件：单个照片粒子
// ==========================================
const PhotoParticle = ({
  mode,
  url,
  index,
  total,
}: {
  mode: string;
  url: string;
  index: number;
  total: number;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, url);

  const data = useMemo(
    () => ({
      treePos: getPhyllotaxisPosition(index, total, 5.5, 11).add(
        new THREE.Vector3(0, 0.5, 0)
      ),
      scatterPos: randomVectorInSphere(20),
      speed: Math.random() * 0.1 + 0.05,
      rotationOffset: Math.random() * Math.PI,
    }),
    [index, total]
  );

  useFrame((state, delta) => {
    if (!ref.current) return;
    const targetT = mode === "TREE_SHAPE" ? 1 : 0;

    const tx = THREE.MathUtils.lerp(data.scatterPos.x, data.treePos.x, targetT);
    const ty = THREE.MathUtils.lerp(data.scatterPos.y, data.treePos.y, targetT);
    const tz = THREE.MathUtils.lerp(data.scatterPos.z, data.treePos.z, targetT);

    // 修复：使用自定义的 damp 函数
    ref.current.position.x = damp(ref.current.position.x, tx, 1.2, delta);
    ref.current.position.y = damp(ref.current.position.y, ty, 1.2, delta);
    ref.current.position.z = damp(ref.current.position.z, tz, 1.2, delta);

    ref.current.lookAt(state.camera.position);
    ref.current.rotateZ(
      Math.sin(state.clock.elapsedTime * data.speed + data.rotationOffset) * 0.1
    );
  });

  return (
    <mesh ref={ref} scale={[1.2, 1.2, 1.2]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        roughness={0.5}
        metalness={0.5}
        emissive="#E6D2B5"
        emissiveIntensity={0.3}
      />
      <mesh position={[0, 0, -0.01]} scale={[1.05, 1.05, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#E6D2B5" metalness={1} roughness={0.2} />
      </mesh>
    </mesh>
  );
};

// ==========================================
// 4. 主应用程序
// ==========================================
export default function App() {
  const [mode, setMode] = useState<"SCATTERED" | "TREE_SHAPE">("SCATTERED");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newUrls = Array.from(event.target.files).map((file) =>
        URL.createObjectURL(file)
      );
      setImageUrls((prev) => [...prev, ...newUrls]);
      setMode("SCATTERED");
    }
  };

  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000a08",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          padding: "30px",
          color: "#E6D2B5",
          fontFamily: '"Times New Roman", serif',
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          pointerEvents: "none",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 300,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontSize: "2rem",
            }}
          >
            Serene Noel
          </h1>
          <p
            style={{ margin: "10px 0 0 0", opacity: 0.7, fontStyle: "italic" }}
          >
            A collaborative memory tree.
          </p>
        </div>

        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            alignItems: "flex-start",
          }}
        >
          <label
            style={{
              display: "inline-block",
              padding: "12px 24px",
              border: "1px solid rgba(230, 210, 181, 0.5)",
              color: "#E6D2B5",
              cursor: "pointer",
              transition: "all 0.3s",
              fontSize: "14px",
              letterSpacing: "1px",
              background: "rgba(0,20,15, 0.6)",
              backdropFilter: "blur(5px)",
            }}
          >
            + UPLOAD MEMORIES
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
          </label>

          <button
            onClick={() =>
              setMode((m) => (m === "SCATTERED" ? "TREE_SHAPE" : "SCATTERED"))
            }
            style={{
              padding: "12px 24px",
              background: "rgba(230, 210, 181, 0.1)",
              border: "none",
              color: "#E6D2B5",
              cursor: "pointer",
              fontSize: "14px",
              letterSpacing: "2px",
              transition: "all 0.5s",
              borderBottom: "1px solid #E6D2B5",
            }}
          >
            {mode === "SCATTERED" ? "GATHER MEMORIES" : "RELEASE TO SKY"}
          </button>

          <p style={{ fontSize: "12px", opacity: 0.5 }}>
            Loaded Photos: {imageUrls.length}
          </p>
        </div>
      </div>

      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
        <color attach="background" args={["#000a08"]} />
        <fog attach="fog" args={["#000a08", 15, 40]} />

        <ambientLight intensity={0.3} color="#E6D2B5" />
        <spotLight
          position={[10, 20, 10]}
          angle={0.2}
          penumbra={1}
          intensity={8}
          color="#E6D2B5"
          castShadow
        />
        <pointLight position={[-10, -5, -10]} intensity={2} color="#004d3b" />

        <group rotation={[0, 0, 0]}>
          <NeedleParticles mode={mode} count={6000} />
          {imageUrls.map((url, index) => (
            <PhotoParticle
              key={url + index}
              mode={mode}
              url={url}
              index={index}
              total={imageUrls.length}
            />
          ))}
        </group>

        <Float
          speed={1}
          rotationIntensity={0.1}
          floatIntensity={0.2}
          floatingRange={[-0.2, 0.2]}
        >
          <mesh visible={false} />
        </Float>

        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.3}
            luminanceSmoothing={0.8}
            intensity={0.8}
            radius={0.7}
            mipmapBlur
          />
          <Vignette offset={0.3} darkness={0.6} color="#000a08" />
          <Noise opacity={0.02} />
        </EffectComposer>

        <OrbitControls
          enablePan={false}
          autoRotate={mode === "TREE_SHAPE"}
          autoRotateSpeed={0.3}
          minDistance={5}
          maxDistance={30}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
        <Environment preset="night" blur={0.8} background={false} />
      </Canvas>
    </div>
  );
}
