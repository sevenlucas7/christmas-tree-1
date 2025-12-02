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
// 🔥 第一步：在这里填入你所有 17 张照片的名字！
// -------------------------------------------------------------
const MY_PHOTOS = [
  "/photo1.jpg",
  "/photo2.jpg",
  "/photo3.jpg",
  // "/photo4.jpg",
  // "/photo5.jpg",
  // ... 继续添加直到 photo17.jpg
];

// 🔥 第二步：标题改回 Merry Christmas
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

const ornamentColors = [
  new THREE.Color("#ff3333"),
  new THREE.Color("#FFD700"),
  new THREE.Color("#ff9a47"),
];

// ==========================================
// 2. 针叶与装饰物 (保持不变)
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
// 3. 流星系统 (保持不变)
// ==========================================
const ShootingStar = () => {
  const ref = useRef<THREE.Mesh>(null!);
  const [startPos] = useState(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        Math.random() * 30 + 10,
        (Math.random() - 0.5) * 40 - 20
      )
  );
  const speed = useRef(Math.random() * 2 + 1);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.position.x -= speed.current * delta * 8;
    ref.current.position.y -= speed.current * delta * 4;
    if (ref.current.position.y < -20) {
      ref.current.position.copy(startPos);
      ref.current.position.x += (Math.random() - 0.5) * 10;
    }
  });

  return (
    <mesh ref={ref} position={startPos} rotation={[0, 0, Math.PI / 3]}>
      <coneGeometry args={[0.05, 4, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
    </mesh>
  );
};

const ShootingStarsSystem = ({ mode }: { mode: string }) => {
  if (mode !== "TREE_SHAPE") return null;
  return (
    <group>
      {Array.from({ length: 4 }).map((_, i) => (
        <ShootingStar key={i} />
      ))}
    </group>
  );
};

// ==========================================
// 4. 🔥核心改进：地面流光粒子系统🔥
// ==========================================
const GroundParticles = ({ mode }: { mode: string }) => {
  const count = 1000;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const opacity = useRef(0);

  // 生成粒子初始数据：随机位置、速度和生命周期
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        // 初始位置在树根附近
        initialPos: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          -6.5,
          (Math.random() - 0.5) * 2
        ),
        // 向外扩散的速度向量
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2
        )
          .normalize()
          .multiplyScalar(Math.random() * 1.5 + 0.5),
        life: Math.random(), // 当前生命值 (0-1)
        maxLife: Math.random() * 2 + 1, // 最大生命周期
        scale: Math.random() * 0.1 + 0.05,
      })),
    []
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const targetOpacity = mode === "TREE_SHAPE" ? 1 : 0;
    opacity.current = THREE.MathUtils.lerp(
      opacity.current,
      targetOpacity,
      delta * 2
    );
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.opacity = opacity.current;
    meshRef.current.visible = opacity.current > 0.01;

    data.forEach((d, i) => {
      // 更新生命值
      d.life += delta;
      // 如果生命结束，重置到中心
      if (d.life > d.maxLife) {
        d.life = 0;
        d.initialPos.set(
          (Math.random() - 0.5) * 2,
          -6.5,
          (Math.random() - 0.5) * 2
        );
      }

      // 计算当前位置：初始位置 + 速度 * 时间
      const currentPos = d.initialPos
        .clone()
        .add(d.velocity.clone().multiplyScalar(d.life));

      // 计算粒子状态：生命末期变小并消失
      const lifeRatio = d.life / d.maxLife;
      const currentScale = d.scale * (1 - lifeRatio); // 越往外越小

      dummy.position.copy(currentPos);
      dummy.scale.setScalar(currentScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={2}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

// ==========================================
// 5. 照片交互组件 (🔥修复点击事件🔥)
// ==========================================
interface PhotoProps {
  mode: string;
  url: string;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: (index: number) => void; // 修改类型定义
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
  const selectedProgress = useRef(0);
  const { camera } = useThree();

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

    const targetSelected = isSelected ? 1 : 0;
    selectedProgress.current = THREE.MathUtils.lerp(
      selectedProgress.current,
      targetSelected,
      delta * 5
    );

    const t = posProgress.current;
    const st = selectedProgress.current;
    const time = state.clock.elapsedTime;

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

    const focusPos = new THREE.Vector3(0, 0, camera.position.z - 6);
    ref.current.position.lerpVectors(floatingPos, focusPos, st);

    if (st > 0.1) {
      ref.current.lookAt(camera.position);
    } else {
      ref.current.lookAt(camera.position);
      ref.current.rotateZ(
        Math.sin(time * 0.5 + floatData.offset) * 0.05 * floatIntensity
      );
    }

    const targetScale = THREE.MathUtils.lerp(1.8, 5, st);
    ref.current.scale.setScalar(targetScale);
    materialRef.current.opacity = THREE.MathUtils.lerp(
      opacityProgress.current,
      1,
      st
    );
    ref.current.visible = materialRef.current.opacity > 0.01;
    materialRef.current.depthTest = !isSelected;
  });

  return (
    <mesh
      ref={ref}
      // 🔥 核心修复：直接调用 onSelect 传递当前索引
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
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
};

// ==========================================
// 6. 主程序
// ==========================================
export default function App() {
  const [mode, setMode] = useState<"SCATTERED" | "TREE_SHAPE">("SCATTERED");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null
  );

  // 🔥 核心修复：处理点击事件的逻辑
  const handlePhotoSelect = (index: number) => {
    // 如果点击的是已经选中的照片，就取消选中；否则选中新的照片
    setSelectedPhotoIndex((prev) => (prev === index ? null : index));
  };

  const handleBackgroundClick = () => {
    if (selectedPhotoIndex !== null) setSelectedPhotoIndex(null);
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
          {APP_TITLE}
        </h1>
        <p
          style={{
            margin: "5px 0 20px 0",
            opacity: 0.8,
            fontStyle: "italic",
            color: "#E6D2B5",
          }}
        >
          A gift just for you
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() =>
              setMode((m) => (m === "SCATTERED" ? "TREE_SHAPE" : "SCATTERED"))
            }
            style={{
              padding: "10px 24px",
              background: "linear-gradient(45deg, #FFD700, #ff9a47)",
              border: "none",
              color: "#000",
              cursor: "pointer",
              fontSize: "14px",
              letterSpacing: "2px",
              fontWeight: "bold",
              boxShadow: "0 0 15px rgba(255,215,0,0.4)",
              borderRadius: "30px",
            }}
          >
            {mode === "SCATTERED" ? "MAKE A WISH" : "SEE MEMORIES"}
          </button>
        </div>
      </div>

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
        <Stars
          radius={100}
          depth={50}
          count={2000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
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
          {/* 🔥 使用新的粒子地面 */}
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
                // 🔥 传递新的处理函数
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
