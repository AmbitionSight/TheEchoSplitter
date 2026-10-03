// —— 析声者 · 第一关场景入口：全量重导出 ch1/ 分层模块（兼容层，勿在此加代码）——
export { LAYOUT, rng, clamp, WALL_SEAM, LIGHTS, masonryPlan, slabPlan } from './ch1/planners.js';
export { resolveCollisions, screenToLogical, moveToward, makeStone, stepStone, magnetStep } from './ch1/physics.js';
export { BENCH_SOCKETS, prerenderStatic, makeDarkness, createScene, initScene, updateScene, drawScene, drawOverlay } from './ch1/render.js';
