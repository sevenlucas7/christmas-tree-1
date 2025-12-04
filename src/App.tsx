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
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// -------------------------------------------------------------
// 🔥 记得在这里填入你的照片文件名！
// -------------------------------------------------------------
const MY_PHOTOS = [
  "/photo1.JPG",
  "/photo2.JPG",
  "/photo3.JPG",
  "/photo4.JPG",
  "/photo5.JPG",
  "/photo6.JPG",
  "/photo7.jpeg",
  "/photo8.JPG",
  "/photo9.JPG",
  "/photo10.JPG",
  "/photo11.JPG",
  "/photo12.jpeg",
  "/photo13.JPG",
  "/photo14.JPG",
  "/photo15.JPG",
  "/photo16.JPG",
  "/photo17.JPG",
];

const APP_TITLE = "MERRY CHRISTMAS";

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

const createStarShape = (outerRadius: number, innerRadius: number) => {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
};

const ornamentColors = [
  new THREE.Color("#ff3333"),
  new THREE.Color("#FFD700"),
  new THREE.Color("#3366ff"),
  new THREE.Color("#228B22"),
  new THREE.Color("#ffffff"),
];
const getRandomFestiveColor = () =>
  ornamentColors[Math.floor(Math.random() * ornamentColors.length)];

// ==========================================
// 2. 背景粒子 (🔥 关键优化：raycast={null} 禁用点击检测，防止挡住照片)
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
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        treePos: getPhyllotaxisPosition(i, count, 4.5 + extraSpread, 11),
        scatterPos: randomVectorInSphere(16 + extraSpread),
        scale: Math.random() * 0.4 + materialScale,
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ],
        color: getRandomFestiveColor(),
      })),
    [count, extraSpread, materialScale]
  );

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    data.forEach((d, i) => meshRef.current.setColorAt(i, d.color));
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [data]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      mode === "TREE_SHAPE" ? 1 : 0,
      delta * 2.5
    );
    const t = progress.current;
    data.forEach((d, i) => {
      dummy.position.lerpVectors(d.scatterPos, d.treePos, t);
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
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      raycast={() => null}
    >
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.2}
        metalness={0.8}
        envMapIntensity={1}
      />
    </instancedMesh>
  );
};

const FoliageParticles = ({
  mode,
  count = 2000,
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
        treePos: getPhyllotaxisPosition(i, count, 4, 11),
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
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      raycast={() => null}
    >
      <tetrahedronGeometry args={[0.1, 0]} />
      <meshStandardMaterial color="#004d33" roughness={0.6} metalness={0.2} />
    </instancedMesh>
  );
};

const TopStar = ({ mode }: { mode: string }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const progress = useRef(0);
  const treePos = new THREE.Vector3(0, 12 / 2 + 0.8, 0);
  const scatterPos = new THREE.Vector3(0, 25, 0);

  const starGeometry = useMemo(() => {
    const starShape = createStarShape(1.0, 0.382);
    const extrudeSettings = { depth: 0.4, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
    geo.center();
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      mode === "TREE_SHAPE" ? 1 : 0,
      delta * 2
    );
    ref.current.position.lerpVectors(scatterPos, treePos, progress.current);
    ref.current.rotation.y += delta * 0.8;
    const scale = progress.current > 0.1 ? progress.current : 0.1;
    ref.current.scale.setScalar(scale * 0.8);
    ref.current.visible = progress.current > 0.01;
  });

  return (
    <mesh ref={ref} geometry={starGeometry} raycast={() => null}>
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={2}
        roughness={0.1}
        metalness={1}
      />
      <pointLight color="#FFD700" intensity={8} distance={6} />
    </mesh>
  );
};

const ShootingStar = () => {
  const ref = useRef<THREE.Mesh>(null!);
  const [startPos] = useState(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        Math.random() * 40 + 10,
        (Math.random() - 0.5) * 60 - 30
      )
  );
  const speed = useRef(Math.random() * 3 + 2);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.position.x -= speed.current * delta * 10;
    ref.current.position.y -= speed.current * delta * 5;
    if (ref.current.position.y < -30) {
      ref.current.position.copy(startPos);
      ref.current.position.x += (Math.random() - 0.5) * 20;
    }
  });
  return (
    <mesh
      ref={ref}
      position={startPos}
      rotation={[0, 0, Math.PI / 3]}
      raycast={() => null}
    >
      <coneGeometry args={[0.08, 6, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
    </mesh>
  );
};

const ShootingStarsSystem = ({ mode }: { mode: string }) => {
  if (mode !== "TREE_SHAPE") return null;
  return (
    <group>
      {Array.from({ length: 5 }).map((_, i) => (
        <ShootingStar key={i} />
      ))}
    </group>
  );
};

const GroundParticles = ({ mode }: { mode: string }) => {
  const count = 1200;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const opacity = useRef(0);
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        initialPos: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          -6.5,
          (Math.random() - 0.5) * 3
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2
        )
          .normalize()
          .multiplyScalar(Math.random() * 2 + 0.5),
        life: Math.random(),
        maxLife: Math.random() * 2.5 + 1,
        scale: Math.random() * 0.12 + 0.05,
      })),
    []
  );
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    opacity.current = THREE.MathUtils.lerp(
      opacity.current,
      mode === "TREE_SHAPE" ? 1 : 0,
      delta * 2
    );
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.opacity = opacity.current;
    meshRef.current.visible = opacity.current > 0.01;
    data.forEach((d, i) => {
      d.life += delta;
      if (d.life > d.maxLife) {
        d.life = 0;
        d.initialPos.set(
          (Math.random() - 0.5) * 3,
          -6.5,
          (Math.random() - 0.5) * 3
        );
      }
      const currentPos = d.initialPos
        .clone()
        .add(d.velocity.clone().multiplyScalar(d.life));
      dummy.position.copy(currentPos);
      dummy.scale.setScalar(d.scale * (1 - d.life / d.maxLife));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      raycast={() => null}
    >
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={2.5}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

// ==========================================
// 3. 🔥核心组件：PhotoParticle (修复动画逻辑)
// ==========================================
interface PhotoProps {
  mode: string;
  url: string;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
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

  // 进度状态
  const posProgress = useRef(0); // 0 = 散落, 1 = 树形
  const selectedProgress = useRef(0); // 0 = 未选中, 1 = 选中放大

  const { camera } = useThree();

  // 漂浮参数
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
      // 树形位置：放在树的表面
      treePos: getPhyllotaxisPosition(index, total, 5.0, 10.5),
      // 散落位置
      scatterPos: randomVectorInSphere(18),
    }),
    [index, total]
  );

  useFrame((state, delta) => {
    if (!ref.current || !materialRef.current) return;

    // 1. 目标状态计算
    const isTree = mode === "TREE_SHAPE";

    // 2. 动画插值 (Lerp)
    posProgress.current = THREE.MathUtils.lerp(
      posProgress.current,
      isTree ? 1 : 0,
      delta * 2
    );
    selectedProgress.current = THREE.MathUtils.lerp(
      selectedProgress.current,
      isSelected ? 1 : 0,
      delta * 5
    );

    const t = posProgress.current;
    const st = selectedProgress.current; // 选中动画进度
    const time = state.clock.elapsedTime;

    // 3. 计算基础位置 (在散落和树形之间过渡)
    const basePos = new THREE.Vector3().lerpVectors(
      data.scatterPos,
      data.treePos,
      t
    );

    // 4. 添加漂浮效果 (当组成树时，漂浮幅度减小，当选中时停止漂浮)
    const floatIntensity = (1 - t * 0.8) * (1 - st);
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

    // 5. 计算聚焦位置 (屏幕正前方)
    const focusPos = new THREE.Vector3(0, 0, camera.position.z - 6);

    // 6. 最终位置混合：如果选中，就飞向 focusPos，否则在 floatingPos
    ref.current.position.lerpVectors(floatingPos, focusPos, st);

    // 7. 旋转处理：选中时正对相机，未选中时轻微摇摆
    if (st > 0.1) {
      ref.current.lookAt(camera.position);
      ref.current.rotation.z = 0; // 矫正水平
    } else {
      ref.current.lookAt(camera.position);
      ref.current.rotateZ(Math.sin(time * 0.5 + floatData.offset) * 0.05);
    }

    // 8. 🔥 缩放逻辑修改 (关键) 🔥
    // - 散落状态: 1.5 (大图)
    // - 树形状态: 0.4 (变成小挂饰)
    // - 选中状态: 5.0 (特写)
    let targetScale = THREE.MathUtils.lerp(1.5, 0.4, t); // 基础大小随状态变化
    targetScale = THREE.MathUtils.lerp(targetScale, 5.0, st); // 如果选中，覆盖之前的缩放

    ref.current.scale.setScalar(targetScale);

    // 确保始终可见
    materialRef.current.opacity = 1;

    // 选中时放在最上层，避免被其他物体遮挡
    materialRef.current.depthTest = !isSelected;
  });

  return (
    <mesh
      ref={ref}
      // 点击事件
      onClick={(e) => {
        e.stopPropagation();
        onSelect(index);
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
      />
      {/* 照片边框，随照片一起缩放 */}
      <mesh position={[0, 0, -0.01]} scale={[1.05, 1.05, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>
    </mesh>
  );
};

// ==========================================
// 4. 主程序
// ==========================================
export default function App() {
  const [mode, setMode] = useState<"SCATTERED" | "TREE_SHAPE">("SCATTERED");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null
  );
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.12, 16, 16), []);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.2, 0.2), []);

  const handlePhotoSelect = (index: number) =>
    setSelectedPhotoIndex((prev) => (prev === index ? null : index));
  const handleBackgroundClick = () => {
    if (selectedPhotoIndex !== null) setSelectedPhotoIndex(null);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000a08",
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
          pointerEvents: selectedPhotoIndex !== null ? "none" : "auto",
          opacity: selectedPhotoIndex !== null ? 0.3 : 1,
          transition: "all 0.5s",
        }}
      >
        <h1 style={{ margin: 0, letterSpacing: "4px", fontSize: "1.8rem" }}>
          {APP_TITLE}
        </h1>
        <p
          style={{ margin: "5px 0 20px 0", opacity: 0.6, fontStyle: "italic" }}
        >
          Decorate with memories
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
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
      </div>

      {/* 聚焦时的黑色背景遮罩 */}
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

      <Canvas dpr={[1, 2]} onClick={handleBackgroundClick}>
        <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
        <Stars
          radius={100}
          depth={50}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
        <ShootingStarsSystem mode={mode} />
        <ambientLight intensity={0.3} color="#ffddaa" />
        <spotLight
          position={[10, 20, 10]}
          angle={0.3}
          penumbra={1}
          intensity={15}
          color="#FFD700"
          castShadow
        />
        <pointLight position={[-10, 5, -10]} intensity={5} color="#ff3333" />

        <group position={[0, -1, 0]}>
          <TopStar mode={mode} />
          <FoliageParticles mode={mode} count={2000} />
          <DecorativeParticles
            mode={mode}
            count={1500}
            geometry={sphereGeo}
            materialScale={0.3}
            extraSpread={0.2}
          />
          <DecorativeParticles
            mode={mode}
            count={1000}
            geometry={boxGeo}
            materialScale={0.4}
            extraSpread={0.5}
          />
          <GroundParticles mode={mode} />
          <Suspense fallback={null}>
            {MY_PHOTOS.map((url, index) => (
              <PhotoParticle
                key={url + index}
                mode={mode}
                url={url}
                index={index}
                total={MY_PHOTOS.length}
                isSelected={index === selectedPhotoIndex}
                onSelect={handlePhotoSelect}
              />
            ))}
          </Suspense>
        </group>

        <OrbitControls
          autoRotate={mode === "TREE_SHAPE" && selectedPhotoIndex === null}
          autoRotateSpeed={0.5}
          enablePan={false}
          enabled={selectedPhotoIndex === null}
          maxPolarAngle={Math.PI / 1.6}
        />
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.8}
            mipmapBlur
            intensity={1.5}
            radius={0.4}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
        <Environment preset="city" blur={0.8} background={false} />
      </Canvas>
    </div>
  );
}
