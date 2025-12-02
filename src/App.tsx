import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Float,
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
// 2. 组件：针叶粒子 (保持不变)
// ==========================================
const NeedleParticles = ({
  mode,
  count = 4000,
}: {
  mode: string;
  count?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);

  const data = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      treePos: getPhyllotaxisPosition(i, count, 4, 11),
      scatterPos: randomVectorInSphere(15),
      scale: Math.random() * 0.5 + 0.5,
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
    }));
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = mode === "TREE_SHAPE" ? 1 : 0;
    // 树叶的聚合速度稍微慢一点，更有仪式感
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      target,
      delta * 2
    );
    const t = progress.current;

    data.forEach((d, i) => {
      const x = THREE.MathUtils.lerp(d.scatterPos.x, d.treePos.x, t);
      const y = THREE.MathUtils.lerp(d.scatterPos.y, d.treePos.y, t);
      const z = THREE.MathUtils.lerp(d.scatterPos.z, d.treePos.z, t);
      dummy.position.set(x, y, z);
      dummy.rotation.set(
        d.rotation[0] + state.clock.elapsedTime * 0.2,
        d.rotation[1] + state.clock.elapsedTime * 0.1,
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
      <tetrahedronGeometry args={[0.08, 0]} />
      <meshStandardMaterial
        color="#003322"
        emissive="#001a11"
        emissiveIntensity={0.5}
        roughness={0.4}
        metalness={0.6}
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 组件：照片粒子 (🔥核心修改在这里🔥)
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
  // 位置进度条
  const posProgress = useRef(0);
  // 透明度进度条
  const opacityProgress = useRef(0);

  const data = useMemo(
    () => ({
      // 树形态位置：藏在树里面
      treePos: getPhyllotaxisPosition(index, total, 3.5, 10),
      // 散落位置：飘在外面
      scatterPos: randomVectorInSphere(14),
    }),
    [index, total]
  );

  useFrame((state, delta) => {
    if (!ref.current || !materialRef.current) return;

    // 目标状态：TREE_SHAPE时，位置进度为1，透明度目标为0（隐藏）
    //           SCATTERED时，位置进度为0，透明度目标为1（显示）
    const targetPos = mode === "TREE_SHAPE" ? 1 : 0;
    const targetOpacity = mode === "TREE_SHAPE" ? 0 : 1;

    // 平滑过渡位置
    posProgress.current = THREE.MathUtils.lerp(
      posProgress.current,
      targetPos,
      delta * 2
    );
    // 平滑过渡透明度 (速度快一点，让它更快显现)
    opacityProgress.current = THREE.MathUtils.lerp(
      opacityProgress.current,
      targetOpacity,
      delta * 3
    );

    const t = posProgress.current;

    // 更新位置
    ref.current.position.lerpVectors(data.scatterPos, data.treePos, t);
    // 始终面向相机
    ref.current.lookAt(state.camera.position);

    // 更新材质透明度
    materialRef.current.opacity = opacityProgress.current;
    // 当完全透明时，设置不可见以提升性能，否则可见
    ref.current.visible = opacityProgress.current > 0.01;
  });

  return (
    <mesh ref={ref} scale={[1.5, 1.5, 1.5]}>
      <planeGeometry args={[1, 1]} />
      {/* 使用 MeshBasicMaterial，不受光照影响，显示照片原色 */}
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        side={THREE.DoubleSide}
        transparent={true} // 必须开启透明
        opacity={0} // 初始透明度为0
        depthWrite={false} // 防止透明物体遮挡问题
      />
    </mesh>
  );
};

// ==========================================
// 4. 主程序 (保持不变)
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
      // 上传后自动切换到散落模式展示照片
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

      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={50} />
        <ambientLight intensity={0.5} />
        <spotLight
          position={[10, 20, 10]}
          angle={0.3}
          penumbra={1}
          intensity={15}
          color="#ffd700"
          castShadow
        />
        <pointLight position={[-10, -5, -10]} intensity={5} color="#00ffaa" />

        <group position={[0, -2, 0]}>
          <NeedleParticles mode={mode} count={4000} />
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
          autoRotateSpeed={1}
          enablePan={false}
          maxPolarAngle={Math.PI / 1.6}
        />

        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.2}
            mipmapBlur
            intensity={1.2}
            radius={0.5}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
