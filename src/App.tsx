import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ==========================================
// 1. 核心算法与工具
// ==========================================
// 斐波那契螺旋树形
const getPhyllotaxisPosition = (
  index: number,
  total: number,
  maxRadius: number,
  heightScale: number
) => {
  const angle = index * 137.5 * (Math.PI / 180);
  const normalizedHeight = index / total;
  const currentRadius =
    maxRadius * (1 - normalizedHeight) * (0.9 + Math.random() * 0.2); // 加入一点随机扰动让树更自然
  const x = Math.cos(angle) * currentRadius;
  const z = Math.sin(angle) * currentRadius;
  const y = normalizedHeight * heightScale - heightScale / 2;
  return new THREE.Vector3(x, y, z);
};

// 球体随机散落
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

// 装饰物配色方案（红、金、玫瑰金）
const ornamentColors = [
  new THREE.Color("#ff3333"), // 热烈红
  new THREE.Color("#FFD700"), // 奢华金
  new THREE.Color("#ff9a47"), // 暖橙金
];

// ==========================================
// 2. 组件：针叶粒子 (基底绿叶)
// ==========================================
const NeedleParticles = ({
  mode,
  count = 3500,
}: {
  mode: string;
  count?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);

  const data = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      treePos: getPhyllotaxisPosition(i, count, 4.5, 12),
      scatterPos: randomVectorInSphere(16),
      scale: Math.random() * 0.4 + 0.4,
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
      // 🔥 新增：漂浮参数
      floatSpeed: Math.random() * 0.5 + 0.2,
      floatOffset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = mode === "TREE_SHAPE" ? 1 : 0;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      target,
      delta * 2
    );
    const t = progress.current;
    const time = state.clock.elapsedTime;

    data.forEach((d, i) => {
      // 基础位置插值
      let x = THREE.MathUtils.lerp(d.scatterPos.x, d.treePos.x, t);
      let y = THREE.MathUtils.lerp(d.scatterPos.y, d.treePos.y, t);
      let z = THREE.MathUtils.lerp(d.scatterPos.z, d.treePos.z, t);

      // 🔥 核心修改：叠加动态漂浮 (基于时间的正弦波)
      // 当 t=1 (聚拢) 时漂浮幅度减小，t=0 (散开) 时漂浮幅度大
      const floatIntensity = (1 - t * 0.7) * 0.3;
      x += Math.sin(time * d.floatSpeed + d.floatOffset) * floatIntensity;
      y += Math.cos(time * d.floatSpeed * 0.8 + d.floatOffset) * floatIntensity;
      z += Math.sin(time * d.floatSpeed * 1.2 + d.floatOffset) * floatIntensity;

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        d.rotation[0] + time * 0.2,
        d.rotation[1] + time * 0.1,
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
        color="#005533"
        emissive="#003311"
        emissiveIntensity={0.8} // 针叶发光稍微收敛一点，把舞台让给装饰物
        roughness={0.3}
        metalness={0.5}
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 🔥新组件🔥：装饰物粒子 (红金球体)
// ==========================================
const OrnamentParticles = ({
  mode,
  count = 1500,
}: {
  mode: string;
  count?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);
  const colorTemp = useMemo(() => new THREE.Color(), []);

  const data = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      // 装饰物分布在树的表面稍外侧
      treePos: getPhyllotaxisPosition(i, count, 4.8, 12).add(
        new THREE.Vector3(0, 0.2, 0)
      ),
      scatterPos: randomVectorInSphere(18), // 散得更开
      scale: Math.random() * 0.6 + 0.3,
      // 随机分配红/金颜色
      color: ornamentColors[Math.floor(Math.random() * ornamentColors.length)],
      // 漂浮参数
      floatSpeed: Math.random() * 0.3 + 0.1, // 飘得慢一点，显得重一点
      floatOffset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  // 初始化时设置每个实例的颜色
  useLayoutEffect(() => {
    data.forEach((d, i) => {
      meshRef.current.setColorAt(i, d.color);
    });
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [data]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = mode === "TREE_SHAPE" ? 1 : 0;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      target,
      delta * 2
    );
    const t = progress.current;
    const time = state.clock.elapsedTime;

    data.forEach((d, i) => {
      let x = THREE.MathUtils.lerp(d.scatterPos.x, d.treePos.x, t);
      let y = THREE.MathUtils.lerp(d.scatterPos.y, d.treePos.y, t);
      let z = THREE.MathUtils.lerp(d.scatterPos.z, d.treePos.z, t);

      // 叠加漂浮动画
      const floatIntensity = (1 - t * 0.8) * 0.4; // 散开时飘动幅度更大
      x += Math.sin(time * d.floatSpeed + d.floatOffset) * floatIntensity;
      y +=
        Math.cos(time * d.floatSpeed * 0.8 + d.floatOffset) * floatIntensity +
        (1 - t) * Math.sin(time * 0.5) * 0.5; // 添加一点额外的上下浮动
      z += Math.sin(time * d.floatSpeed * 1.2 + d.floatOffset) * floatIntensity;

      dummy.position.set(x, y, z);
      // 装饰物也会缓慢自转反光
      dummy.rotation.set(time * 0.1 + i, time * 0.1 + i, 0);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {/* 使用更圆润的二十面体来表现珠子 */}
      <icosahedronGeometry args={[0.12, 1]} />
      <meshStandardMaterial
        color="#ffffff" // 基础色设为白，颜色由 instanceColor 决定
        emissive="#444444" // 轻微自发光，增加亮度底色
        emissiveIntensity={0.5}
        roughness={0.1} // 极低粗糙度，像抛光金属
        metalness={0.9} // 极高金属度，强反射
        envMapIntensity={1.5} // 增强环境光反射
      />
    </instancedMesh>
  );
};

// ==========================================
// 4. 组件：照片粒子 (加入动态漂浮)
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

  // 生成随机的漂浮参数
  const floatData = useMemo(
    () => ({
      speed: Math.random() * 0.2 + 0.1,
      offset: Math.random() * Math.PI * 2,
      radius: Math.random() * 0.3 + 0.2,
    }),
    []
  );

  const data = useMemo(
    () => ({
      treePos: getPhyllotaxisPosition(index, total, 4, 11),
      scatterPos: randomVectorInSphere(15),
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
    const time = state.clock.elapsedTime;

    // 基础位置
    const basePos = new THREE.Vector3().lerpVectors(
      data.scatterPos,
      data.treePos,
      t
    );

    // 🔥 加入动态漂浮，只有在散开且显示时才明显
    const floatIntensity = (1 - t) * opacityProgress.current;
    ref.current.position.x =
      basePos.x +
      Math.sin(time * floatData.speed + floatData.offset) *
        floatData.radius *
        floatIntensity;
    ref.current.position.y =
      basePos.y +
      Math.cos(time * floatData.speed * 0.7 + floatData.offset) *
        floatData.radius *
        floatIntensity;
    ref.current.position.z =
      basePos.z +
      Math.sin(time * floatData.speed * 1.3 + floatData.offset) *
        floatData.radius *
        floatIntensity;

    ref.current.lookAt(state.camera.position);
    // 缓慢的Z轴摇摆
    ref.current.rotateZ(
      Math.sin(time * 0.5 + floatData.offset) * 0.05 * floatIntensity
    );

    materialRef.current.opacity = opacityProgress.current;
    ref.current.visible = opacityProgress.current > 0.01;
  });

  return (
    <mesh ref={ref} scale={[1.8, 1.8, 1.8]}>
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
// 5. 主程序 (灯光与氛围升级)
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
        background: "#000200",
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
          color: "#FFD700",
          fontFamily: "serif",
        }}
      >
        <h1
          style={{
            margin: 0,
            letterSpacing: "4px",
            fontSize: "1.8rem",
            textShadow: "0 0 10px rgba(255,215,0,0.3)",
          }}
        >
          LUX NOEL
        </h1>
        <p
          style={{
            margin: "5px 0 20px 0",
            opacity: 0.8,
            fontStyle: "italic",
            color: "#E6D2B5",
          }}
        >
          Upload memories to decorate
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <label
            style={{
              padding: "10px 20px",
              border: "1px solid #FFD700",
              cursor: "pointer",
              background: "rgba(255,215,0,0.1)",
              fontSize: "12px",
              letterSpacing: "1px",
              color: "#FFD700",
              transition: "all 0.3s",
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
              background: "linear-gradient(45deg, #FFD700, #ff9a47)",
              border: "none",
              color: "#000",
              cursor: "pointer",
              fontSize: "12px",
              letterSpacing: "1px",
              fontWeight: "bold",
              boxShadow: "0 0 15px rgba(255,215,0,0.4)",
            }}
          >
            {mode === "SCATTERED" ? "ASSEMBLE TREE" : "SCATTER"}
          </button>
        </div>
        <p
          style={{
            fontSize: "10px",
            opacity: 0.6,
            marginTop: "10px",
            color: "#E6D2B5",
          }}
        >
          Photos loaded: {imageUrls.length}
        </p>
      </div>

      <Canvas dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
        {/* 氛围灯光组合 */}
        <ambientLight intensity={0.2} color="#ffccaa" /> {/* 暖色环境光 */}
        {/* 主金色射灯，制造强烈高光 */}
        <spotLight
          position={[15, 20, 15]}
          angle={0.3}
          penumbra={0.5}
          intensity={25}
          color="#FFD700"
          castShadow
        />
        {/* 侧面红色补光，增加色彩层次 */}
        <pointLight position={[-15, 5, 10]} intensity={10} color="#ff3333" />
        {/* 底部冷光，增加对比度 */}
        <pointLight position={[0, -10, 0]} intensity={5} color="#00aaaa" />
        <group position={[0, -3, 0]}>
          {/* 1. 针叶基底 (3500个) */}
          <NeedleParticles mode={mode} count={3500} />
          {/* 2. 新增：红金装饰球 (1500个) */}
          <OrnamentParticles mode={mode} count={1500} />

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
          autoRotateSpeed={0.5} // 转慢点更优雅
          enablePan={false}
          maxPolarAngle={Math.PI / 1.6}
          minDistance={8}
          maxDistance={35}
        />
        {/* 后处理：强化金属光泽的辉光 */}
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.6} // 提高阈值，只让最亮的金属反光点产生辉光
            mipmapBlur
            intensity={2.0} // 增强辉光强度
            radius={0.5}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.3} color="#000200" />
        </EffectComposer>
        {/* 关键：使用城市夜景环境贴图，提供丰富的金属反射源 */}
        <Environment preset="city" blur={0.6} background={false} />
      </Canvas>
    </div>
  );
}
