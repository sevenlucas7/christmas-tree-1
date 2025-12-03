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
  Float,
  PerspectiveCamera,
  Stars,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import * as THREE from "three";

// ==========================================
// 1. 数学与工具算法
// ==========================================
// 斐波那契螺旋位置生成 (让树形更自然)
const getPhyllotaxisPosition = (
  index: number,
  total: number,
  maxRadius: number,
  heightScale: number
) => {
  const angle = index * 137.5 * (Math.PI / 180);
  const normalizedHeight = index / total;
  const currentRadius = maxRadius * (1 - normalizedHeight); // 移除随机扰动，让树形更规整以便挂饰物
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

// 🎄 节日配色方案
const festiveColors = [
  new THREE.Color("#ff3333"), // 红
  new THREE.Color("#FFD700"), // 金
  new THREE.Color("#3366ff"), // 蓝
  new THREE.Color("#228B22"), // 绿
  new THREE.Color("#ffffff"), // 银/白
];

// 🎁 获取随机节日颜色
const getRandomFestiveColor = () =>
  festiveColors[Math.floor(Math.random() * festiveColors.length)];

// ==========================================
// 2. 通用粒子系统组件 (用于彩球和礼物)
// ==========================================
const DecorativeParticles = ({
  mode,
  count,
  geometry,
  materialScale,
  extraSpread = 0,
}: any) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);

  // 生成位置和颜色数据
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        // 位置稍微往外一点，覆盖在针叶上
        treePos: getPhyllotaxisPosition(i, count, 4.5 + extraSpread, 11),
        scatterPos: randomVectorInSphere(16 + extraSpread),
        scale: Math.random() * 0.4 + materialScale,
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ],
        color: getRandomFestiveColor(), // 分配随机颜色
      })),
    [count, extraSpread, materialScale]
  );

  // 在布局挂载时应用颜色
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    data.forEach((d, i) => meshRef.current.setColorAt(i, d.color));
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [data]);

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
      dummy.position.lerpVectors(d.scatterPos, d.treePos, t);
      // 持续缓慢自转，增加闪烁感
      dummy.rotation.set(
        d.rotation[0] + state.clock.elapsedTime * 0.2,
        d.rotation[1] + state.clock.elapsedTime * 0.3,
        d.rotation[2]
      );
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      {/* 使用高金属感材质，颜色由实例颜色决定(设为白色底) */}
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.2}
        metalness={0.8}
        envMapIntensity={1}
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 基础针叶组件 (绿色基底)
// ==========================================
const FoliageParticles = ({
  mode,
  count = 2000,
}: {
  mode: string;
  count?: number;
}) => {
  // ... (代码与之前类似，简化用于作为基底)
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        treePos: getPhyllotaxisPosition(i, count, 4, 11), // 稍微里面一点
        scatterPos: randomVectorInSphere(15),
        scale: Math.random() * 0.4 + 0.3,
        rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
      })),
    [count]
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      mode === "TREE_SHAPE" ? 1 : 0,
      delta * 2.5
    );
    data.forEach((d, i) => {
      dummy.position.lerpVectors(d.scatterPos, d.treePos, progress.current);
      dummy.rotation.set(
        d.rotation[0],
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
      <tetrahedronGeometry args={[0.1, 0]} />
      <meshStandardMaterial color="#004d33" roughness={0.6} metalness={0.2} />
    </instancedMesh>
  );
};

// ==========================================
// 4. 🌟 树顶星星组件
// ==========================================
const TopStar = ({ mode }: { mode: string }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const progress = useRef(0);
  // 星星的目标位置(树顶)和散落位置
  const treePos = new THREE.Vector3(0, 11 / 2 + 0.5, 0);
  const scatterPos = new THREE.Vector3(0, 20, 0);

  useFrame((state, delta) => {
    if (!ref.current) return;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      mode === "TREE_SHAPE" ? 1 : 0,
      delta * 2
    );
    ref.current.position.lerpVectors(scatterPos, treePos, progress.current);
    // 缓慢自转
    ref.current.rotation.y += delta * 0.5;
    // 散落时变小消失
    ref.current.scale.setScalar(
      progress.current > 0.1 ? progress.current : 0.1
    );
    ref.current.visible = progress.current > 0.01;
  });

  return (
    <mesh ref={ref}>
      {/* 使用二十面体模拟星星 */}
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={2}
        roughness={0.1}
        metalness={1}
      />
      {/* 星星发光点 */}
      <pointLight color="#FFD700" intensity={5} distance={5} />
    </mesh>
  );
};

// ==========================================
// 5. 照片粒子 (保持不变，略微调整位置)
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
  const progress = useRef(0);
  const data = useMemo(
    () => ({
      // 照片放在最外层
      treePos: getPhyllotaxisPosition(index, total, 5.2, 10.5),
      scatterPos: randomVectorInSphere(18),
    }),
    [index, total]
  );

  useFrame((state, delta) => {
    if (!ref.current) return;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      mode === "TREE_SHAPE" ? 1 : 0,
      delta * 2
    );
    ref.current.position.lerpVectors(
      data.scatterPos,
      data.treePos,
      progress.current
    );
    ref.current.lookAt(state.camera.position);
  });

  return (
    <mesh ref={ref} scale={[1.3, 1.3, 1.3]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      <mesh position={[0, 0, -0.01]} scale={[1.05, 1.05, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#FFD700" /> {/* 金色边框 */}
      </mesh>
    </mesh>
  );
};

// ==========================================
// 6. 主应用程序
// ==========================================
export default function App() {
  const [mode, setMode] = useState<"SCATTERED" | "TREE_SHAPE">("SCATTERED");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // 预定义几何体
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.12, 16, 16), []);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.2, 0.2), []);

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
        background: "#000a08",
        position: "relative",
      }}
    >
      {/* UI 部分 (保持不变) */}
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
          MERRY CHRISTMAS
        </h1>
        <p
          style={{ margin: "5px 0 20px 0", opacity: 0.6, fontStyle: "italic" }}
        >
          Decorate with memories
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
        <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
        <color attach="background" args={["#000a08"]} />
        {/* 添加星星背景 */}
        <Stars
          radius={100}
          depth={50}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
        {/* 灯光设置：暖色调 */}
        <ambientLight intensity={0.3} color="#ffddaa" />
        <spotLight
          position={[10, 20, 10]}
          angle={0.3}
          penumbra={1}
          intensity={15}
          color="#FFD700"
          castShadow
        />
        <pointLight position={[-10, 5, -10]} intensity={5} color="#ff3333" />{" "}
        {/* 侧面红光 */}
        <group position={[0, -1, 0]}>
          {/* 1. 树顶星星 */}
          <TopStar mode={mode} />

          {/* 2. 绿色针叶基底 (2000个) */}
          <FoliageParticles mode={mode} count={2000} />

          {/* 3. 彩色球挂饰 (1500个) */}
          <DecorativeParticles
            mode={mode}
            count={1500}
            geometry={sphereGeo}
            materialScale={0.3}
            extraSpread={0.2}
          />

          {/* 4. 彩色礼物盒 (1000个，散布得更开一点) */}
          <DecorativeParticles
            mode={mode}
            count={1000}
            geometry={boxGeo}
            materialScale={0.4}
            extraSpread={0.5}
          />

          {/* 5. 照片 */}
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
          autoRotateSpeed={0.5}
          enablePan={false}
          maxPolarAngle={Math.PI / 1.6}
        />
        {/* 后处理：让星星和金属挂饰发光 */}
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.8}
            mipmapBlur
            intensity={1.5}
            radius={0.4}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
        {/* 环境贴图：提供金属反射 */}
        <Environment preset="city" blur={0.8} background={false} />
      </Canvas>
    </div>
  );
}
