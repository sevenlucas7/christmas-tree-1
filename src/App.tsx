import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  Suspense,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  Stars,
  Plane,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ==========================================
// 1. 核心算法与工具 (保持不变)
// ==========================================
const getPhyllotaxisPosition = (
  index: number,
  total: number,
  maxRadius: number,
  heightScale: number
) => {
  const angle = index * 137.5 * (Math.PI / 180);
  const normalizedHeight = index / total;
  const currentRadius =
    maxRadius * (1 - normalizedHeight) * (0.9 + Math.random() * 0.2);
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

const ornamentColors = [
  new THREE.Color("#ff3333"),
  new THREE.Color("#FFD700"),
  new THREE.Color("#ff9a47"),
];

// ==========================================
// 2. 基础粒子组件 (保持不变)
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
      let x = THREE.MathUtils.lerp(d.scatterPos.x, d.treePos.x, t);
      let y = THREE.MathUtils.lerp(d.scatterPos.y, d.treePos.y, t);
      let z = THREE.MathUtils.lerp(d.scatterPos.z, d.treePos.z, t);
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
        emissiveIntensity={0.8}
        roughness={0.3}
        metalness={0.5}
      />
    </instancedMesh>
  );
};

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
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        treePos: getPhyllotaxisPosition(i, count, 4.8, 12).add(
          new THREE.Vector3(0, 0.2, 0)
        ),
        scatterPos: randomVectorInSphere(18),
        scale: Math.random() * 0.6 + 0.3,
        color:
          ornamentColors[Math.floor(Math.random() * ornamentColors.length)],
        floatSpeed: Math.random() * 0.3 + 0.1,
        floatOffset: Math.random() * Math.PI * 2,
      })),
    [count]
  );

  useLayoutEffect(() => {
    data.forEach((d, i) => meshRef.current.setColorAt(i, d.color));
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
      const floatIntensity = (1 - t * 0.8) * 0.4;
      x += Math.sin(time * d.floatSpeed + d.floatOffset) * floatIntensity;
      y +=
        Math.cos(time * d.floatSpeed * 0.8 + d.floatOffset) * floatIntensity +
        (1 - t) * Math.sin(time * 0.5) * 0.5;
      z += Math.sin(time * d.floatSpeed * 1.2 + d.floatOffset) * floatIntensity;
      dummy.position.set(x, y, z);
      dummy.rotation.set(time * 0.1 + i, time * 0.1 + i, 0);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[0.12, 1]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#444444"
        emissiveIntensity={0.5}
        roughness={0.1}
        metalness={0.9}
        envMapIntensity={1.5}
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 🔥新组件🔥：流星系统
// ==========================================
const ShootingStar = () => {
  const ref = useRef<THREE.Mesh>(null!);
  //随机起始位置和速度
  const [startPos] = useState(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        Math.random() * 50 + 20,
        (Math.random() - 0.5) * 100
      )
  );
  const speed = useRef(Math.random() * 2 + 1);

  useFrame((state, delta) => {
    if (!ref.current) return;
    // 向下划过
    ref.current.position.x -= speed.current * delta * 10;
    ref.current.position.y -= speed.current * delta * 5;
    // 飞出边界后重置
    if (ref.current.position.y < -50) {
      ref.current.position.copy(startPos);
      // 稍微随机化一下重置位置
      ref.current.position.x += (Math.random() - 0.5) * 20;
    }
  });

  return (
    // 细长的圆锥体模拟流星尾迹
    <mesh ref={ref} position={startPos} rotation={[0, 0, Math.PI / 3]}>
      <coneGeometry args={[0.1, 5, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
    </mesh>
  );
};

const ShootingStarsSystem = ({ mode }: { mode: string }) => {
  if (mode !== "TREE_SHAPE") return null;
  // 生成5颗流星
  return (
    <group>
      {Array.from({ length: 5 }).map((_, i) => (
        <ShootingStar key={i} />
      ))}
    </group>
  );
};

// ==========================================
// 4. 🔥新组件🔥：树根流光溢彩
// ==========================================
const GroundRadiance = ({ mode }: { mode: string }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const opacity = useRef(0);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const targetOpacity = mode === "TREE_SHAPE" ? 1 : 0;
    opacity.current = THREE.MathUtils.lerp(
      opacity.current,
      targetOpacity,
      delta * 2
    );
    const material = ref.current.material as THREE.MeshStandardMaterial;
    material.opacity = opacity.current;
    material.emissiveIntensity = opacity.current * 4; // 增强发光
    ref.current.visible = opacity.current > 0.01;
    // 缓慢旋转增加动感
    ref.current.rotation.z += delta * 0.05;
  });

  return (
    // 使用一个极扁的圆锥体来模拟中心亮、边缘暗的光晕效果
    <mesh ref={ref} position={[0, -6.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <coneGeometry args={[12, 0.5, 64]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        transparent
        opacity={0}
        roughness={1}
        metalness={0}
        side={THREE.DoubleSide}
        depthWrite={false} // 防止遮挡
      />
    </mesh>
  );
};

// ==========================================
// 5. 组件：照片粒子 (🔥核心交互升级：点击放大🔥)
// ==========================================
interface PhotoProps {
  mode: string;
  url: string;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: (index: number | null) => void;
}

const PhotoParticle = ({
  mode,
  url,
  index,
  total,
  isSelected,
  onSelect,
}: PhotoProps) => {
  const ref = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const texture = useLoader(THREE.TextureLoader, url);
  const posProgress = useRef(0);
  const opacityProgress = useRef(0);
  const selectedProgress = useRef(0); // 新增：选中状态的动画进度
  const { camera } = useThree(); // 获取相机以计算聚焦位置

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

    // --- 1. 计算基础状态 (树 vs 散落) ---
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

    // --- 2. 计算选中状态 (聚焦 vs 漂浮) ---
    const targetSelected = isSelected ? 1 : 0;
    // 选中动画快一点
    selectedProgress.current = THREE.MathUtils.lerp(
      selectedProgress.current,
      targetSelected,
      delta * 5
    );

    const t = posProgress.current;
    const st = selectedProgress.current;
    const time = state.clock.elapsedTime;

    // A. 计算漂浮位置
    const basePos = new THREE.Vector3().lerpVectors(
      data.scatterPos,
      data.treePos,
      t
    );
    const floatIntensity = (1 - t) * opacityProgress.current;
    const floatingPos = new THREE.Vector3(
      basePos.x +
        Math.sin(time * floatData.speed + floatData.offset) *
          floatData.radius *
          floatIntensity,
      basePos.y +
        Math.cos(time * floatData.speed * 0.7 + floatData.offset) *
          floatData.radius *
          floatIntensity,
      basePos.z +
        Math.sin(time * floatData.speed * 1.3 + floatData.offset) *
          floatData.radius *
          floatIntensity
    );

    // B. 计算聚焦位置 (相机正前方)
    const focusPos = new THREE.Vector3(0, 0, camera.position.z - 5); // 距离相机5个单位

    // C. 最终位置：在漂浮位置和聚焦位置之间插值
    ref.current.position.lerpVectors(floatingPos, focusPos, st);

    // 旋转：选中时正对相机，没选中时轻微摇摆
    if (st > 0.1) {
      ref.current.lookAt(camera.position);
    } else {
      ref.current.lookAt(camera.position);
      ref.current.rotateZ(
        Math.sin(time * 0.5 + floatData.offset) * 0.05 * floatIntensity
      );
    }

    // 缩放：选中时放大 (例如放大到 5倍)，没选中时原始大小 (1.8)
    const targetScale = THREE.MathUtils.lerp(1.8, 5, st);
    ref.current.scale.setScalar(targetScale);

    // 透明度：选中时强制为 1，没选中时跟随模式
    materialRef.current.opacity = THREE.MathUtils.lerp(
      opacityProgress.current,
      1,
      st
    );
    // 只要有一点点不透明就显示
    ref.current.visible = materialRef.current.opacity > 0.01;
    // 选中时确保渲染在最上层
    materialRef.current.depthTest = !isSelected;
  });

  return (
    <mesh
      ref={ref}
      // 点击事件：如果已选中就取消，没选中就选中当前索引
      onClick={(e) => {
        e.stopPropagation();
        onSelect(isSelected ? null : index);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
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
// 6. 主程序 (管理选中状态)
// ==========================================
export default function App() {
  const [mode, setMode] = useState<"SCATTERED" | "TREE_SHAPE">("SCATTERED");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  // 🔥 新增状态：记录当前选中的照片索引
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null
  );

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newUrls = Array.from(event.target.files).map((file) =>
        URL.createObjectURL(file)
      );
      setImageUrls((prev) => [...prev, ...newUrls]);
      setMode("SCATTERED");
      setSelectedPhotoIndex(null); // 上传新照片时重置选中状态
    }
  };

  useEffect(() => {
    return () => imageUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageUrls]);

  // 点击背景时取消选中照片
  const handleBackgroundClick = () => {
    if (selectedPhotoIndex !== null) {
      setSelectedPhotoIndex(null);
    }
  };

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
          pointerEvents: selectedPhotoIndex !== null ? "none" : "auto",
          opacity: selectedPhotoIndex !== null ? 0.3 : 1,
          transition: "all 0.5s",
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
          MERRY CHRISTMAS
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

      {/* 🔥 新增：照片聚焦时的黑色遮罩背景 */}
      <div
        onClick={handleBackgroundClick}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.8)",
          opacity: selectedPhotoIndex !== null ? 1 : 0,
          pointerEvents: selectedPhotoIndex !== null ? "auto" : "none",
          transition: "opacity 0.5s",
          zIndex: 5,
        }}
      />

      <Canvas dpr={[1, 1.5]} onClick={handleBackgroundClick}>
        <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
        {/* 基础背景星空 */}
        <Stars
          radius={100}
          depth={50}
          count={2000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
        {/* 🔥 新增：动态流星雨 (只在树形态显示) */}
        <ShootingStarsSystem mode={mode} />

        <ambientLight intensity={0.2} color="#ffccaa" />
        <spotLight
          position={[15, 20, 15]}
          angle={0.3}
          penumbra={0.5}
          intensity={25}
          color="#FFD700"
          castShadow
        />
        <pointLight position={[-15, 5, 10]} intensity={10} color="#ff3333" />
        <pointLight position={[0, -10, 0]} intensity={5} color="#00aaaa" />

        <group position={[0, -3, 0]}>
          <NeedleParticles mode={mode} count={3500} />
          <OrnamentParticles mode={mode} count={1500} />
          {/* 🔥 新增：树根流光溢彩 */}
          <GroundRadiance mode={mode} />

          <Suspense fallback={null}>
            {imageUrls.map((url, index) => (
              <PhotoParticle
                key={url + index}
                mode={mode}
                url={url}
                index={index}
                total={imageUrls.length}
                // 🔥 传递选中状态
                isSelected={index === selectedPhotoIndex}
                onSelect={setSelectedPhotoIndex}
              />
            ))}
          </Suspense>
        </group>

        {/* 照片聚焦时禁止旋转视角 */}
        <OrbitControls
          autoRotate={mode === "TREE_SHAPE" && selectedPhotoIndex === null}
          autoRotateSpeed={0.5}
          enablePan={false}
          enabled={selectedPhotoIndex === null} // 聚焦时禁用操作
          maxPolarAngle={Math.PI / 1.6}
          minDistance={8}
          maxDistance={35}
        />

        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.6}
            mipmapBlur
            intensity={2.0}
            radius={0.5}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.3} color="#000200" />
        </EffectComposer>
        <Environment preset="city" blur={0.6} background={false} />
      </Canvas>
    </div>
  );
}
