"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Points, PointMaterial } from "@react-three/drei"
import * as THREE from "three"

export function ParticleSilhouette() {
    return (
        <div className="w-full h-full relative bg-transparent">
            <Canvas camera={{ position: [0, 0, 3], fov: 60 }}>
                <fog attach="fog" args={['#F0EEE9', 2, 6]} />
                <Silhouette />
            </Canvas>
        </div>
    )
}

function Silhouette(props: any) {
    const ref = useRef<THREE.Points>(null)

    // Generate points in a human-like shape (Capsule-ish distribution)
    const particles = useMemo(() => {
        const count = 3000
        const positions = new Float32Array(count * 3)

        for (let i = 0; i < count; i++) {
            // Cylindrical coordinates for body
            const theta = Math.random() * Math.PI * 2
            const h = (Math.random() - 0.5) * 3 // Height range -1.5 to 1.5

            // Radius varies by height to approximate a figure
            // Waist at 0, wider at shoulders (0.5) and hips (-0.5)
            let radiusBase = 0.4
            if (h > 0.8) radiusBase = 0.3 // Head
            else if (h > 0.4) radiusBase = 0.6 // Shoulders
            else if (h > -0.2) radiusBase = 0.45 // Waist
            else radiusBase = 0.55 // Hips

            const r = Math.sqrt(Math.random()) * radiusBase

            const x = r * Math.cos(theta)
            const y = h
            const z = r * Math.sin(theta)

            positions[i * 3] = x
            positions[i * 3 + 1] = y
            positions[i * 3 + 2] = z
        }

        return positions
    }, [])

    useFrame((state) => {
        if (!ref.current) return

        const time = state.clock.getElapsedTime()

        // Gentle rotation
        ref.current.rotation.y = Math.sin(time * 0.1) * 0.2

        // Mouse interaction (simplified gaze)
        const mouseX = state.mouse.x * 0.5
        const mouseY = state.mouse.y * 0.2

        ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -mouseY, 0.1)
        ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, mouseX + Math.sin(time * 0.1) * 0.2, 0.1)
    })

    return (
        <group {...props} dispose={null}>
            <Points ref={ref} positions={particles} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#2B2B2B"
                    size={0.015}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={0.6}
                />
            </Points>
        </group>
    )
}
