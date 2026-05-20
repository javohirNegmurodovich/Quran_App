import React, { useEffect, useMemo, useRef, useState } from "react";
import { Edges, Html, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { useStore } from "../zustand/store";
import { uzbekSurahMeanings } from "../utils/uzbekSuraMeaning";

const OPEN_WAIT_MS = 650;

export default function Model({
  isMobile,
  data = [],
  searchedIndex,
  onSurahIntent,
  ...props
}) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { camera } = useThree();

  const learnedSurahs = useStore((state) => state.learnedSurahs);
  const user = useStore((state) => state.user);
  const learnedCount = learnedSurahs.length;

  const [mousePos, setMousePos] = useState([0, 0, 0]);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [clickedPieces, setClickedPieces] = useState([]);
  const [searchedNode, setSearchedNode] = useState(null);
  const [searchedCenter, setSearchedCenter] = useState([0, 0, 0]);
  const [searchedSurahInfo, setSearchedSurahInfo] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);

  const { nodes, materials } = useGLTF("/heart14.glb");

  const frozenMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#e0f2fe",
        emissive: "#0284c7",
        emissiveIntensity: 0.35,
        roughness: 0.22,
        metalness: 0.75,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
      }),
    [],
  );

  const searchedMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffd700",
        emissive: "#7a5c00",
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.8,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
      }),
    [],
  );

  const meshes = useMemo(
    () =>
      Object.values(nodes)
        .filter((node) => node.isMesh && node.name.includes("cell"))
        .map((node) => {
          const match = node.name.match(/\d+$/);
          const index = match ? Number.parseInt(match[0], 10) - 1 : null;
          return { node, index };
        }),
    [nodes],
  );

  useEffect(() => {
    if (!user) setClickedPieces([]);
  }, [user]);

  useEffect(() => {
    if (searchedIndex !== null && data[searchedIndex]) {
      const target = meshes.find(({ index }) => index === searchedIndex);

      if (target) {
        setSearchedNode(target.node.name);
        setSearchedSurahInfo(data[searchedIndex]);

        target.node.geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        target.node.geometry.boundingBox.getCenter(center);
        setSearchedCenter([center.x, center.y, center.z]);

        const currentDistance = camera.position.distanceTo(
          new THREE.Vector3(0, 0, 0),
        );
        const idealCamPos = center
          .clone()
          .normalize()
          .multiplyScalar(currentDistance);
        setCameraTarget(idealCamPos);

        onSurahIntent?.(data[searchedIndex].number);
      }
    } else {
      setSearchedNode(null);
      setSearchedSurahInfo(null);
      setCameraTarget(null);
    }
  }, [searchedIndex, data, meshes, camera, onSurahIntent]);

  useEffect(() => {
    return () => {
      frozenMaterial.dispose();
      searchedMaterial.dispose();
    };
  }, [frozenMaterial, searchedMaterial]);

  useFrame((state) => {
    const progressRatio = Math.min(learnedCount / 114, 1.0);
    let pump = 0;
    let dynamicIntensity = 0;

    if (learnedCount > 0) {
      const dynamicSpeed = 0.3 + 3.7 * progressRatio;
      dynamicIntensity = 0.03 + 0.15 * progressRatio;
      const t = state.clock.elapsedTime;
      const lub = Math.pow(Math.abs(Math.sin(t * dynamicSpeed)), 12);
      const dub =
        Math.pow(Math.abs(Math.sin(t * dynamicSpeed - 0.5)), 10) * 0.3;
      pump = lub + dub;
    }

    if (ref.current) {
      const baseScale = 0.6;
      ref.current.scale.set(
        baseScale - pump * dynamicIntensity,
        baseScale + pump * dynamicIntensity,
        baseScale - pump * dynamicIntensity,
      );
      ref.current.rotation.y = pump * (0.04 + 0.06 * progressRatio);
    }

    if (cameraTarget) {
      state.camera.position.lerp(cameraTarget, 0.045);
      state.camera.lookAt(0, 0, 0);
    }
  });

  const openSurah = async (surahNumber) => {
    if (!surahNumber) return;

    try {
      await Promise.race([
        Promise.resolve(onSurahIntent?.(surahNumber)),
        new Promise((resolve) => window.setTimeout(resolve, OPEN_WAIT_MS)),
      ]);
    } catch {
      // If prefetch fails, still open the Surah.
    }

    navigate(`/surah/${surahNumber}`);
  };

  const PopupCard = ({ info, isSearch }) => {
    if (!info) return null;

    return (
      <div
        onPointerEnter={() => {
          if (isSearch) onSurahIntent?.(info.number);
        }}
        onClick={(event) => {
          if (isSearch) {
            event.stopPropagation();
            openSurah(info.number);
          }
        }}
        style={{
          position: "relative",
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "16px 16px 12px 16px",
          borderRadius: "16px",
          border: `1px solid ${isSearch ? "rgba(255, 215, 0, 0.8)" : "rgba(255, 255, 255, 0.6)"}`,
          width: isMobile ? "158px" : "190px",
          boxShadow:
            "0px 10px 30px rgba(0,0,0,0.2), inset 0px 0px 10px rgba(255,255,255,0.5)",
          textAlign: "center",
          transform: "translate(-50%, -110%)",
          transition: "all 0.3s ease",
          pointerEvents: isSearch ? "auto" : "none",
          cursor: isSearch ? "pointer" : "default",
        }}
      >
        {isSearch && (
          <button
            type="button"
            aria-label="Qidiruv kartasini yopish"
            onClick={(event) => {
              event.stopPropagation();
              setSearchedSurahInfo(null);
              setSearchedNode(null);
              setCameraTarget(null);
            }}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "rgba(15, 59, 37, 0.08)",
              color: "#0f3b25",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: "none",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
        )}

        <div
          style={{
            background: "#0f3b25",
            color: "#d4af37",
            borderRadius: "50%",
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 6px auto",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          {info.number}
        </div>

        <p
          style={{
            color: "#0f3b25",
            margin: "2px 0",
            fontWeight: 900,
            fontSize: isMobile ? "14px" : "16px",
          }}
        >
          {info.englishName}
        </p>
        <p
          style={{
            color: "#0c379d",
            margin: "2px 0",
            fontSize: "16px",
            fontFamily: "serif",
          }}
        >
          {info.name}
        </p>

        {isSearch ? (
          <button
            type="button"
            onPointerEnter={() => onSurahIntent?.(info.number)}
            onClick={(event) => {
              event.stopPropagation();
              openSurah(info.number);
            }}
            className="mt-3 w-full bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#0f3b25] py-1.5 rounded-full text-xs font-bold shadow-md hover:scale-105 transition-transform"
          >
            Start learn
          </button>
        ) : (
          <div
            style={{
              marginTop: "8px",
              paddingTop: "6px",
              borderTop: "1px solid rgba(0,0,0,0.1)",
              fontSize: "10px",
              color: "#666",
            }}
          >
            Ayahs:{" "}
            <strong style={{ color: "#0f3b25" }}>
              {info.numberOfAyahs || "—"}
            </strong>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: "-8px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: `8px solid ${isSearch ? "rgba(255, 215, 0, 0.8)" : "rgba(255, 255, 255, 0.85)"}`,
          }}
        />
      </div>
    );
  };

  return (
    <group ref={ref} {...props} dispose={null}>
      {searchedSurahInfo && searchedCenter && (
        <Html
          position={searchedCenter}
          distanceFactor={1.7}
          style={{ zIndex: 20 }}
        >
          <PopupCard info={searchedSurahInfo} isSearch />
        </Html>
      )}

      {hoveredInfo && !isMobile && !searchedSurahInfo && (
        <Html
          position={mousePos}
          distanceFactor={1.7}
          style={{ pointerEvents: "none", zIndex: 10 }}
        >
          <PopupCard info={hoveredInfo} isSearch={false} />
        </Html>
      )}

      <group rotation={[-Math.PI / 2, 0, 0]} scale={60}>
        <group rotation={[Math.PI / 2, 0, 0]} scale={0.02}>
          {meshes.map(({ node, index }) => {
            const surah = index !== null ? data[index] : null;
            const isClicked = clickedPieces.includes(node.name);
            const isSearched = searchedNode === node.name;
            const isLearnedNode = surah && learnedSurahs.includes(surah.number);
            const isAlive = isClicked || isLearnedNode;
            const shouldDrawEdges = !isMobile || isSearched || isAlive;

            return (
              <mesh
                key={node.name}
                geometry={node.geometry}
                onPointerMove={(event) => {
                  event.stopPropagation();
                  setCameraTarget(null);
                  setMousePos([event.point.x, event.point.y, event.point.z]);
                  setHoveredInfo(surah);
                  if (surah) onSurahIntent?.(surah.number);
                }}
                onPointerOut={() => setHoveredInfo(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!surah) return;
                  openSurah(surah.number);
                }}
              >
                {isAlive ? (
                  <primitive object={materials.Heart_Tex} attach="material" />
                ) : (
                  /* If frozen, force R3F to attach the icy physical material */
                  <meshPhysicalMaterial
                    attach="material"
                    color={isSearched ? "#ffd700" : "#e0f2fe"}
                    emissive={isSearched ? "#7a5c00" : "#0284c7"}
                    emissiveIntensity={isSearched ? 0.8 : 0.4}
                    roughness={0.2}
                    metalness={0.8}
                    clearcoat={1.0}
                    clearcoatRoughness={0.1}
                  />
                )}

                {shouldDrawEdges && (
                  <Edges
                    threshold={8}
                    color={
                      isSearched ? "#ffea70" : isAlive ? "#4a0000" : "#ffffff"
                    }
                  />
                )}
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/heart14.glb");
