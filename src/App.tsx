import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

// -------------------------------------------------------------
// 🔥 记得在这里填入你的 17 张照片！
// -------------------------------------------------------------
const MY_PHOTOS = [
    "/photo1.jpg", 
    "/photo2.jpg", 
    "/photo3.jpg",
    "/photo4.jpg",
    "/photo5.jpg",
    "/photo6.jpg",
    "/photo7.jpeg",
    "/photo8.jpg",
    "/photo9.jpg",
    "/photo10.jpg",
    "/photo11.jpg",
    "/photo12.jpeg",
    "/photo13.jpg",
    "/photo14.jpg",
    "/photo15.jpg",
    "/photo16.jpg",
    "/photo17.jpg",
];

const APP_TITLE = "MERRY CHRISTMAS";

// ==========================================
// 1. 核心算法与工具
// ==========================================
const getPhyllotaxisPosition = (index: number, total: number, maxRadius: number, heightScale: number) => {
    const angle = index * 137.5 * (Math.PI / 180);
    const normalizedHeight = index / total;
    const currentRadius = maxRadius * (1 - normalizedHeight) * (0.9 + Math.random() * 0.2);
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

// 🔥 修正：更标准的五角星形状算法
const createStarShape = (outerRadius: number, innerRadius: number) => {
    const shape = new THREE.Shape();
    // 5个角，总共10个点
    for (let i = 0; i < 10; i++) {
        // 角度计算
        const angle = i * Math.PI / 5; 
        const r = (i % 2 === 0) ? outerRadius : innerRadius;
        // 这里的计算确保星星尖角朝上
        const x = Math.sin(angle) * r;
        const y = Math.cos(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
};

const ornamentColors = [new THREE.Color("#ff3333"), new THREE.Color("#FFD700"), new THREE.Color("#3366ff"), new THREE.Color("#228B22"), new THREE.Color("#ffffff")];
const getRandomFestiveColor = () => ornamentColors[Math.floor(Math.random() * ornamentColors.length)];

// ==========================================
// 2. 粒子组件 (针叶、彩球、礼物)
// ==========================================
const DecorativeParticles = ({ mode, count, geometry, materialScale, extraSpread = 0 }: any) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const progress = useRef(0);
    const data = useMemo(() => Array.from({ length: count }, (_, i) => ({
        treePos: getPhyllotaxisPosition(i, count, 4.5 + extraSpread, 11), 
        scatterPos: randomVectorInSphere(16 + extraSpread), 
        scale: Math.random() * 0.4 + materialScale, 
        rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
        color: getRandomFestiveColor(),
    })), [count, extraSpread, materialScale]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        data.forEach((d, i) => meshRef.current.setColorAt(i, d.color));
        meshRef.current.instanceColor!.needsUpdate = true;
    }, [data]);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        progress.current = THREE.MathUtils.lerp(progress.current, mode === 'TREE_SHAPE' ? 1 : 0, delta * 2.5);
        const t = progress.current;
        data.forEach((d, i) => {
            dummy.position.lerpVectors(d.scatterPos, d.treePos, t);
            dummy.rotation.set(d.rotation[0] + state.clock.elapsedTime * 0.2, d.rotation[1] + state.clock.elapsedTime * 0.3, d.rotation[2]);
            dummy.scale.setScalar(d.scale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.8} envMapIntensity={1} />
        </instancedMesh>
    );
};

const FoliageParticles = ({ mode, count = 2000 }: { mode: string, count?: number }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const progress = useRef(0);
    const data = useMemo(() => Array.from({ length: count }, (_, i) => ({
            treePos: getPhyllotaxisPosition(i, count, 4, 11),
            scatterPos: randomVectorInSphere(15), 
            scale: Math.random() * 0.4 + 0.3,
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0]
        })), [count]);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        progress.current = THREE.MathUtils.lerp(progress.current, mode === 'TREE_SHAPE' ? 1 : 0, delta * 2.5);
        data.forEach((d, i) => {
            dummy.position.lerpVectors(d.scatterPos, d.treePos, progress.current);
            dummy.rotation.set(d.rotation[0], d.rotation[1] + state.clock.elapsedTime * 0.1, d.rotation[2]);
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
// 3. 🔥修复版：标准的锐利五角星 TopStar
// ==========================================
const TopStar = ({ mode }: { mode: string }) => {
    const ref = useRef<THREE.Mesh>(null!);
    const progress = useRef(0);
    const treePos = new THREE.Vector3(0, 12 / 2 + 1.0, 0); 
    const scatterPos = new THREE.Vector3(0, 25, 0);

    const starGeometry = useMemo(() => {
        // 🔥 关键调整：外径0.8，内径0.38 (接近黄金比例)，这样星星更尖锐
        const starShape = createStarShape(0.8, 0.38);
        const extrudeSettings = {
            depth: 0.4, // 增加一点厚度
            bevelEnabled: true,
            bevelThickness: 0.1, // 倒角厚度
            bevelSize: 0.02, // 倒角宽度减小，防止变成圆角
            bevelSegments: 3
        };
        const geo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
        geo.center(); 
        return geo;
    }, []);

    useFrame((state, delta) => {
        if (!ref.current) return;
        progress.current = THREE.MathUtils.lerp(progress.current, mode === 'TREE_SHAPE' ? 1 : 0, delta * 2);
        ref.current.position.lerpVectors(scatterPos, treePos, progress.current);
        ref.current.rotation.y += delta * 0.8; // 转快一点
        const scale = progress.current > 0.1 ? progress.current : 0.1;
        ref.current.scale.setScalar(scale);
        ref.current.visible = progress.current > 0.01;
    });

    return (
        <mesh ref={ref} geometry={starGeometry}>
            <meshStandardMaterial 
                color="#FFD700" 
                emissive="#FFD700" 
                emissiveIntensity={3} // 发光更强
                roughness={0.0} 
                metalness={1} 
            />
            {/* 增加一个点光源照亮周围 */}
            <pointLight color="#FFD700" intensity={10} distance={6} />
        </mesh>
    );
};

// ==========================================
// 4. 其他组件 (流星、地面、照片)
// ==========================================
const ShootingStar = () => {
    const ref = useRef<THREE.Mesh>(null!);
    const [startPos] = useState(() => new THREE.Vector3((Math.random() - 0.5) * 80, (Math.random()) * 40 + 10, (Math.random() - 0.5) * 60 - 30));
    const speed = useRef(Math.random() * 3 + 2);
    useFrame((state, delta) => {
        if (!ref.current) return;
        ref.current.position.x -= speed.current * delta * 10;
        ref.current.position.y -= speed.current * delta * 5;
        if (ref.current.position.y < -30) {
             ref.current.position.copy(startPos);
             ref.current.position.x += (Math.random()-0.5)*20;
        }
    });
    return (
        <mesh ref={ref} position={startPos} rotation={[0, 0, Math.PI / 3]}>
            <coneGeometry args={[0.08, 6, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
    );
}

const ShootingStarsSystem = ({ mode }: { mode: string }) => {
    if (mode !== 'TREE_SHAPE') return null;
    return <group>{Array.from({length: 5}).map((_, i) => <ShootingStar key={i} />)}</group>;
}

const GroundParticles = ({ mode }: { mode: string }) => {
    const count = 1200;
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const opacity = useRef(0);
    const data = useMemo(() => Array.from({ length: count }, () => ({
        initialPos: new THREE.Vector3((Math.random() - 0.5) * 3, -6.5, (Math.random() - 0.5) * 3),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize().multiplyScalar(Math.random() * 2 + 0.5),
        life: Math.random(), maxLife: Math.random() * 2.5 + 1, scale: Math.random() * 0.12 + 0.05
    })), []);
    useFrame((state, delta) => {
        if (!meshRef.current) return;
        opacity.current = THREE.MathUtils.lerp(opacity.current, mode === 'TREE_SHAPE' ? 1 : 0, delta * 2);
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        material.opacity = opacity.current;
        meshRef.current.visible = opacity.current > 0.01;
        data.forEach((d, i) => {
            d.life += delta;
            if (d.life > d.maxLife) { d.life = 0; d.initialPos.set((Math.random() - 0.5) * 3, -6.5, (Math.random() - 0.5) * 3); }
            const currentPos = d.initialPos.clone().add(d.velocity.clone().multiplyScalar(d.life));
            dummy.position.copy(currentPos);
            dummy.scale.setScalar(d.scale * (1 - d.life / d.maxLife));
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2.5} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </instancedMesh>
    );
};

interface PhotoProps { mode: string; url: string; index: number; total: number; isSelected: boolean; onSelect: (index: number) => void; }
const PhotoParticle = ({ mode, url, index, total, isSelected, onSelect }: PhotoProps) => {
    const ref = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
    const texture = useLoader(THREE.TextureLoader, url);
    const posProgress = useRef(0);
    const opacityProgress = useRef(0);
    const selectedProgress = useRef(0); 
    const { camera } = useThree(); 
    const floatData = useMemo(() => ({ speed: Math.random() * 0.2 + 0.1, offset: Math.random() * Math.PI * 2, radius: Math.random() * 0.3 + 0.2 }), []);
    const data = useMemo(() => ({ treePos: getPhyllotaxisPosition(index, total, 5.2, 10.5), scatterPos: randomVectorInSphere(18) }), [index, total]);

    useFrame((state, delta) => {
        if (!ref.current || !materialRef.current) return;
        posProgress.current = THREE.MathUtils.lerp(posProgress.current, mode === 'TREE_SHAPE' ? 1 : 0, delta * 2);
        opacityProgress.current = THREE.MathUtils.lerp(opacityProgress.current, mode === 'TREE_SHAPE' ? 0 : 1, delta * 3);
        selectedProgress.current = THREE.MathUtils.lerp(selectedProgress.current, isSelected ? 1 : 0, delta * 5);
        const t = posProgress.current;
        const st = selectedProgress.current;
        const time = state.clock.elapsedTime;

        const basePos = new THREE.Vector3().lerpVectors(data.scatterPos, data.treePos, t);
        const floatIntensity = (1 - t) * opacityProgress.current;
        const floatingPos = new THREE.Vector3(
            basePos.x + Math.sin(time * floatData.speed + floatData.offset) * floatData.radius * floatIntensity,
            basePos.y + Math.cos(time * floatData.speed * 0.7 + floatData.offset) * floatData.radius * floatIntensity,
            basePos.z + Math.sin(time * floatData.speed * 1.3 + floatData.offset) * floatData.radius * floatIntensity
        );
        ref.current.position.lerpVectors(floatingPos, new THREE.Vector3(0, 0, camera.position.z - 6), st);
        if (st > 0.1) ref.current.lookAt(camera.position);
        else { ref.current.lookAt(camera.position); ref.current.rotateZ(Math.sin(time * 0.5 + floatData.offset) * 0.05 * floatIntensity); }
        ref.current.scale.setScalar(THREE.MathUtils.lerp(1.3, 5, st));
        materialRef.current.opacity = THREE.MathUtils.lerp(opacityProgress.current, 1, st);
        ref.current.visible = materialRef.current.opacity > 0.01;
        materialRef.current.depthTest = !isSelected; 
    });

    return (
        <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onSelect(index); }} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={materialRef} map={texture} side={THREE.DoubleSide} transparent={true} opacity={0} depthWrite={false} />
            <mesh position={[0,0,-0.01]} scale={[1.05, 1.05, 1]}><planeGeometry args={[1,1]} /><meshBasicMaterial color="#FFD700" /></mesh>
        </mesh>
    );
};

// ==========================================
// 6. 主程序
// ==========================================
export default function App() {
    const [mode, setMode] = useState<'SCATTERED' | 'TREE_SHAPE'>('SCATTERED');
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
    const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.12, 16, 16), []);
    const boxGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.2, 0.2), []);
    
    const handlePhotoSelect = (index: number) => setSelectedPhotoIndex(prev => prev === index ? null : index);
    const handleBackgroundClick = () => { if (selectedPhotoIndex !== null) setSelectedPhotoIndex(null); };

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000a08', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 30, left: 30, zIndex: 10, color: '#E6D2B5', fontFamily: 'serif', pointerEvents: selectedPhotoIndex !== null ? 'none' : 'auto', opacity: selectedPhotoIndex !== null ? 0.3 : 1, transition: 'all 0.5s' }}>
                <h1 style={{ margin: 0, letterSpacing: '4px', fontSize: '1.8rem' }}>{APP_TITLE}</h1>
                <p style={{ margin: '5px 0 20px 0', opacity: 0.6, fontStyle: 'italic' }}>Decorate with memories</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setMode(m => m === 'SCATTERED' ? 'TREE_SHAPE' : 'SCATTERED')} style={{ padding: '10px 20px', background: '#E6D2B5', border: 'none', color: '#000', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>
                        {mode === 'SCATTERED' ? 'ASSEMBLE TREE' : 'SCATTER'}
                    </button>
                </div>
            </div>
            <div onClick={handleBackgroundClick} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', opacity: selectedPhotoIndex !== null ? 1 : 0, pointerEvents: selectedPhotoIndex !== null ? 'auto' : 'none', transition: 'opacity 0.5s', zIndex: 5 }} />

            <Canvas dpr={[1, 2]} onClick={handleBackgroundClick}>
                <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
                <ShootingStarsSystem mode={mode} />
                <ambientLight intensity={0.3} color="#ffddaa" />
                <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={15} color="#FFD700" castShadow />
                <pointLight position={[-10, 5, -10]} intensity={5} color="#ff3333" />

                <group position={[0, -1, 0]}>
                    <TopStar mode={mode} />
                    <FoliageParticles mode={mode} count={2000} />
                    <DecorativeParticles mode={mode} count={1500} geometry={sphereGeo} materialScale={0.3} extraSpread={0.2} />
                    <DecorativeParticles mode={mode} count={1000} geometry={boxGeo} materialScale={0.4} extraSpread={0.5} />
                    <GroundParticles mode={mode} />
                    <Suspense fallback={null}>
                        {MY_PHOTOS.map((url, index) => (
                            <PhotoParticle key={url + index} mode={mode} url={url} index={index} total={MY_PHOTOS.length} isSelected={index === selectedPhotoIndex} onSelect={handlePhotoSelect} />
                        ))}
                    </Suspense>
                </group>

                <OrbitControls autoRotate={mode === 'TREE_SHAPE' && selectedPhotoIndex === null} autoRotateSpeed={0.5} enablePan={false} enabled={selectedPhotoIndex === null} maxPolarAngle={Math.PI / 1.6} />
                <EffectComposer disableNormalPass>
                    <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.5} radius={0.4} />
                    <Vignette eskil={false} offset={0.1} darkness={1.1} />
                </EffectComposer>
                <Environment preset="city" blur={0.8} background={false}/>
            </Canvas>
        </div>
    );
}