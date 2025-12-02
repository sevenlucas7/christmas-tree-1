import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ==========================================
// 1. 核心算法 (保持不变)
// ==========================================
const getPhyllotaxisPosition = (
  index: number,
  total: number,
  maxRadius: number,
  heightScale: number
) => {
  const angle = index * 137.5 * (Math.PI / 180);
  const normalizedHeight = index / total;
  const currentRadius = maxRadius * (1 - normalizedHeight);
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
// 2. 组件：针叶粒子 (🔥核心修改：材质升级🔥)
// ==========================================
const NeedleParticles = ({
  mode,
  count = 4500,
}: {
  mode: string;
  count?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);

  const data = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      treePos: getPhyllotaxisPosition(i, count, 4.2, 11.5), // 稍微调整树形，更饱满
      scatterPos: randomVectorInSphere(16),
      scale: Math.random() * 0.5 + 0.6, // 稍微增大一点粒子
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
    }));
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = mode === "TREE_SHAPE" ? 1 : 0;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      target,
      delta * 2.5
    );
    const t = progress.current;

    data.forEach((d, i) => {
      const x = THREE.MathUtils.lerp(d.scatterPos.x, d.treePos.x, t);
      const y = THREE.MathUtils.lerp(d.scatterPos.y, d.treePos.y, t);
      const z = THREE.MathUtils.lerp(d.scatterPos.z, d.treePos.z, t);
      dummy.position.set(x, y, z);
      dummy.rotation.set(
        d.rotation[0] + state.clock.elapsedTime * 0.3, // 转速稍快一点，增加闪烁感
        d.rotation[1] + state.clock.elapsedTime * 0.15,
        d.rotation[2]
      );
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {/* 使用四面体，反光最锐利 */}
      <tetrahedronGeometry args={[0.09, 0]} />

      {/* 🔥 材质核心升级 🔥 */}
      <meshStandardMaterial
        color="#004d33" // 基础色：更饱满的祖母绿
        emissive="#00a676" // 自发光色：明亮的宝石绿
        emissiveIntensity={2.5} // 强度大幅提升！让它自己发光
        roughness={0.15} // 非常光滑，像玻璃/金属一样反光
        metalness={0.7} // 高金属度，反射金色灯光
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 组件：照片粒子 (保持之前修复好的版本)
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
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const texture = useLoader(THREE.TextureLoader, url);
  const posProgress = useRef(0);
  const opacityProgress = useRef(0);

  const data = useMemo(
    () => ({
      treePos: getPhyllotaxisPosition(index, total, 3.5, 10),
      scatterPos: randomVectorInSphere(14),
    }),
    [index, total]
  );

  useFrame((state, delta) => {
    if (!ref.current || !materialRef.current) return;
    const targetPos = mode === "TREE_SHAPE" ? 1 : 0;
    const targetOpacity = mode === "TREE_SHAPE" ? 0 : 1;
    posProgress.current = THREE.MathUtils.lerp(
      posProgress.current,
      targetPos,
      delta * 2
    );
    opacityProgress.current = THREE.MathUtils.lerp(
      opacityProgress.current,
      targetOpacity,
      delta * 3
    );
    const t = posProgress.current;
    ref.current.position.lerpVectors(data.scatterPos, data.treePos, t);
    ref.current.lookAt(state.camera.position);
    materialRef.current.opacity = opacityProgress.current;
    ref.current.visible = opacityProgress.current > 0.01;
  });

  return (
    <mesh ref={ref} scale={[1.5, 1.5, 1.5]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        side={THREE.DoubleSide}
        transparent={true}
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
};

// ==========================================
// 4. 主程序 (微调灯光和后处理)
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
    return () => imageUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageUrls]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000500",
        position: "relative",
      }}
    >
      {/* UI 保持不变 */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 30,
          zIndex: 10,
          color: "#E6D2B5",
          fontFamily: "serif",
        }}
      >
        <h1 style={{ margin: 0, letterSpacing: "4px", fontSize: "1.8rem" }}>
          NOEL MEMORIES
        </h1>
        <p
          style={{ margin: "5px 0 20px 0", opacity: 0.6, fontStyle: "italic" }}
        >
          Upload photos to decorate
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <label
            style={{
              padding: "10px 20px",
              border: "1px solid #E6D2B5",
              cursor: "pointer",
              background: "rgba(0,20,10,0.5)",
              fontSize: "12px",
              letterSpacing: "1px",
            }}
          >
            + ADD PHOTOS
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
              padding: "10px 20px",
              background: "#E6D2B5",
              border: "none",
              color: "#000",
              cursor: "pointer",
              fontSize: "12px",
              letterSpacing: "1px",
              fontWeight: "bold",
            }}
          >
            {mode === "SCATTERED" ? "ASSEMBLE TREE" : "SCATTER"}
          </button>
        </div>
        <p style={{ fontSize: "10px", opacity: 0.5, marginTop: "10px" }}>
          Photos loaded: {imageUrls.length}
        </p>
      </div>

      <Canvas dpr={[1, 1.5]}>
        {" "}
        {/* 稍微降低 DPR 上限以保证手机性能 */}
        <PerspectiveCamera makeDefault position={[0, 0, 17]} fov={50} />
        {/* 灯光增强 */}
        <ambientLight intensity={0.4} color="#00ffaa" />{" "}
        {/* 增加一点环境绿光 */}
        {/* 主金色射灯，照亮树的边缘 */}
        <spotLight
          position={[12, 15, 12]}
          angle={0.25}
          penumbra={0.5}
          intensity={20}
          color="#FFD700"
          castShadow
        />
        {/* 底部补光，让树底不至于太黑 */}
        <pointLight position={[0, -8, 5]} intensity={3} color="#E6D2B5" />
        <group position={[0, -2.5, 0]}>
          <NeedleParticles mode={mode} count={4500} />
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
        <OrbitControls
          autoRotate={mode === "TREE_SHAPE"}
          autoRotateSpeed={0.8}
          enablePan={false}
          maxPolarAngle={Math.PI / 1.6}
          minDistance={8}
          maxDistance={30}
        />
        {/* 后处理：Bloom 会捕捉到我们增强的自发光，产生辉光效果 */}
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.5} // 只有亮度超过 0.5 的部分才发光
            mipmapBlur
            intensity={1.5} // 辉光强度
            radius={0.6} // 辉光半径
          />
          <Vignette eskil={false} offset={0.1} darkness={1.2} color="#000000" />
        </EffectComposer>
        {/* 增加一点环境反射，让金属材质更真实 */}
        <Environment preset="night" blur={0.8} background={false} />
      </Canvas>
    </div>
  );
}
