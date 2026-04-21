import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber'; // Removed unused useThree
import { Box, Plane, useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

// --- CONSTANTS (from your code) ---
const LANE_WIDTH = 3;
const NUM_LANES = 3;
const INITIAL_SPEED = 15;
const MAX_SPEED = 40;
const ACCELERATION = 0.5;
const JUMP_HEIGHT = 2.5;
const JUMP_DURATION = 0.6;
const ROLL_DURATION = 0.7;
const SEGMENT_LENGTH = 20;

// --- GAME STATE (from your code) ---
const gameState = {
  speed: INITIAL_SPEED,
  distance: 0,
  coins: 0,
  hasNewspaperTask: false,
  nextTaskDistance: 200,
  deliveryShopDistance: 0,
};

// --- OBSTACLE (from your code) ---
function Obstacle({ position, lane }) {
  return (
    <Box args={[LANE_WIDTH * 0.8, 1, 1]} position={position} castShadow>
      <meshStandardMaterial color="gray" />
    </Box>
  );
}

// --- GAME OVER UI (from your code) ---
function GameOverScreen({ onRestart }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      color: 'white', fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Game Over</h1>
      <button onClick={onRestart} style={{
        fontSize: '24px', padding: '10px 20px', cursor: 'pointer', borderRadius: '8px'
      }}>
        Restart
      </button>
    </div>
  );
}

// --- PLAYER (corrected: jump always uses 0.003 and NO game over anim) ---
function Player({ isGameOver, setIsGameOver }) {
  const { scene, animations: runAnimations } = useGLTF('/models/player.glb');
  const { animations: jumpAnimations } = useGLTF('/models/player_jump.glb');
  const { animations: rollAnimations } = useGLTF('/models/player_roll.glb'); // Add roll animation

  const playerRef = useRef();
  const { actions } = useAnimations([...runAnimations, ...jumpAnimations, ...rollAnimations], playerRef);

  const [currentLane, setCurrentLane] = useState(1);
  const [isJumping, setIsJumping] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [jumpTime, setJumpTime] = useState(0);
  const [rollTime, setRollTime] = useState(0);

  const playerPosition = useRef(new THREE.Vector3());

  // Console log only once
  const hasLogged = useRef(false);
  useEffect(() => {
    if (!hasLogged.current) {
      console.log("Available animations:", Object.keys(actions));
      hasLogged.current = true;
    }
    actions['Armature|mixamo.com|Layer0']?.play();
  }, [actions]);

  useEffect(() => {
    const runAnimationName = 'Armature|mixamo.com|Layer0';
    const jumpAnimationName = 'Armature|mixamo.com|Layer0.001'; // CORRECT JUMP!
    const rollAnimationName = 'Armature|mixamo.com|Layer0.002'; // ADD YOUR ROLL ANIMATION NAME HERE

    const runAction = actions[runAnimationName];
    const jumpAction = actions[jumpAnimationName];
    const rollAction = actions[rollAnimationName];

    if (isJumping) {
      jumpAction?.reset().setLoop(THREE.LoopOnce, 1).play();
      runAction?.fadeOut(0.2);
      rollAction?.fadeOut(0.2);
    } else if (isRolling) {
      rollAction?.reset().setLoop(THREE.LoopOnce, 1).play();
      runAction?.fadeOut(0.2);
      jumpAction?.fadeOut(0.2);
    } else {
      runAction?.reset().fadeIn(0.2).play();
      jumpAction?.fadeOut(0.2);
      rollAction?.fadeOut(0.2);
    }
  }, [isJumping, isRolling, actions]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isGameOver || isJumping || isRolling) return;
      if ((event.key === 'ArrowLeft' || event.key === 'a') && currentLane > 0) setCurrentLane(p => p - 1);
      else if ((event.key === 'ArrowRight' || event.key === 'd') && currentLane < NUM_LANES - 1) setCurrentLane(p => p + 1);
      else if ((event.key === 'ArrowUp' || event.key === 'w' || event.key === ' ') && !isJumping) { setIsJumping(true); setJumpTime(0); }
      else if ((event.key === 'ArrowDown' || event.key === 's') && !isRolling) { setIsRolling(true); setRollTime(0); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLane, isJumping, isRolling, isGameOver]);

  useFrame((state, delta) => {
    if (isGameOver) return;

    const playerObject = scene;
    const targetX = (currentLane - 1) * LANE_WIDTH;
    playerObject.position.x = THREE.MathUtils.lerp(playerObject.position.x, targetX, 0.1);

    if (isJumping) {
      setJumpTime(prev => prev + delta);
      const t = jumpTime / JUMP_DURATION;
      playerObject.position.y = JUMP_HEIGHT * Math.sin(t * Math.PI);
      if (jumpTime >= JUMP_DURATION) setIsJumping(false);
    } else {
      playerObject.position.y = 0;
    }

    if (isRolling) {
      setRollTime(prev => prev + delta);
      if (rollTime >= ROLL_DURATION) setIsRolling(false);
    }

    playerObject.name = "player_character";
    playerObject.userData.lane = currentLane;
    playerObject.getWorldPosition(playerPosition.current);

    state.scene.traverse((object) => {
      if (object.userData.isObstacle && object.children.length > 0) {
        const obstacle = object.children[0];
        const obstacleWorldPos = new THREE.Vector3();
        obstacle.getWorldPosition(obstacleWorldPos);
        const zDistance = Math.abs(playerPosition.current.z - obstacleWorldPos.z);
        const sameLane = currentLane === object.userData.lane;
        const isCloseInZ = zDistance < 2;
        const isOnGround = playerObject.position.y < 0.5;
        if (sameLane && isCloseInZ && isOnGround) {
          setIsGameOver(true);
        }
      }
    });
  });

  return (
    <primitive ref={playerRef} object={scene} scale={1.15} position={[0, 0, 0]} rotation-y={Math.PI} />
  );
}
// --- GAME ENVIRONMENT (Your code) ---
function GameEnvironment({ isGameOver }) {
  const [segments, setSegments] = useState([]);
  const [obstacles, setObstacles] = useState([]);

  useEffect(() => {
    setSegments(Array.from({ length: 10 }, (_, i) => ({ id: i, z: -i * SEGMENT_LENGTH })));
  }, []);

  useFrame((state, delta) => {
    if (isGameOver) return;

    if (gameState.speed < MAX_SPEED) gameState.speed += ACCELERATION * delta;
    gameState.distance += gameState.speed * delta;

    const newSegments = segments.map(s => ({ ...s, z: s.z + gameState.speed * delta })).filter(s => s.z < SEGMENT_LENGTH * 2);
    while (newSegments.length < 10) { newSegments.unshift({ id: Math.random(), z: (newSegments[0]?.z || 0) - SEGMENT_LENGTH }); }
    setSegments(newSegments);

    const newObstacles = obstacles.map(o => ({ ...o, pos: [o.pos[0], o.pos[1], o.pos[2] + gameState.speed * delta] })).filter(o => o.pos[2] < 10);
    if (Math.random() > 0.98 && gameState.distance > 50) {
      const lane = Math.floor(Math.random() * NUM_LANES);
      const position = [(lane - 1) * LANE_WIDTH, 0.5, -150];
      if (!newObstacles.some(o => Math.abs(o.pos[2] - position[2]) < 20)) {
        newObstacles.push({ id: Math.random(), pos: position, lane });
      }
    }
    setObstacles(newObstacles);
  });

  return (
    <>
      {segments.map(seg => <Plane key={seg.id} args={[LANE_WIDTH * 3 + 4, SEGMENT_LENGTH]} rotation-x={-Math.PI / 2} position={[0, 0, seg.z]} receiveShadow><meshStandardMaterial color="grey" /></Plane>)}
      {obstacles.map(obs => <group key={obs.id} userData={{ isObstacle: true, lane: obs.lane }}><Obstacle position={obs.pos} lane={obs.lane} /></group>)}
    </>
  );
}

// --- UI (UPDATED to be horizontal) ---
function UI() {
  const [stats, setStats] = useState({ distance: 0, speed: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({ distance: gameState.distance, speed: gameState.speed });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%',
      padding: '10px', display: 'flex', justifyContent: 'center',
      gap: '40px', color: 'white', fontSize: '24px', fontFamily: 'Arial, sans-serif',
      backgroundColor: 'rgba(0,0,0,0.2)'
    }}>
      <div>Distance: {gameState.distance.toFixed(0)}m</div>
      <div>Speed: {gameState.speed.toFixed(1)} m/s</div>
    </div>
  );
}

// --- CAMERA (Your code, renamed from CameraController) ---
function CameraRig() {
  useFrame(({ camera }) => {
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 2, -10);
  });
  return null;
}

// --- MAIN APP (Your code) ---
export default function App() {
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameId, setGameId] = useState(1);

  const handleRestart = () => {
    gameState.speed = INITIAL_SPEED;
    gameState.distance = 0;
    gameState.coins = 0;
    setIsGameOver(false);
    setGameId(prev => prev + 1);
  };

  return (
    <>
      <UI />
      <Canvas shadows key={gameId} camera={{ position: [0, 8, 12], fov: 60 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[8, 15, 5]} intensity={1.5} castShadow />
          <CameraRig />
          <Player isGameOver={isGameOver} setIsGameOver={setIsGameOver} />
          <GameEnvironment isGameOver={isGameOver} />
        </Suspense>
      </Canvas>
      {isGameOver && <GameOverScreen onRestart={handleRestart} />}
    </>
  );
}