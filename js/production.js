// Handles building training queues (e.g., refinery producing gatherers, barracks producing melee).

import { createBuildingFromTemplate } from './buildingTemplates.js';
import { getUnitRadius } from './gameHelpers.js';

/**
 * @param {Object} params
 * @param {number} params.dt
 * @param {Array}  params.units
 * @param {Object} params.refinery
 * @param {Array}  params.barracksList
 * @param {Function} params.spawnUnitFromBuilding
 * @param {Function} params.refreshUI
 */
export function updateProduction({
    dt,
    units,
    refinery,
    barracksList,
    spawnUnitFromBuilding,
    refreshUI,
    getPlayerUnitCount,
    getPopulationCap,
}) {
    // --- Refinery training (gatherers) ---
    if (refinery.training) {
    refinery.trainingTime += dt;
    if (refinery.trainingTime >= refinery.trainingDuration) {
        refinery.training = false;
        refinery.trainingTime = 0;

        const ownerId = refinery.ownerId;
        const cap = getPopulationCap(ownerId);
        if (getPlayerUnitCount(ownerId) < cap) {
        // Refinery always produces 'gatherer'
        spawnUnitFromBuilding('gatherer', refinery);
        } else {
        console.log(`Refinery finished, but unit cap reached (${cap}).`);
        }

        refreshUI();
    } else {
        refreshUI();
    }
    }

    // --- Barracks training (melee) ---
    if (!barracksList) return;

    for (const b of barracksList) {
    if (!b.training) continue;

    b.trainingTime += dt;

    if (b.trainingTime >= b.trainingDuration) {
        b.training = false;
        b.trainingTime = 0;

        const ownerId = b.ownerId;
        const cap = getPopulationCap(ownerId);
        if (getPlayerUnitCount(ownerId) < cap) {
        // Use the trainingType set by the UI: 'melee' or 'ranged'
        const unitType = b.trainingType || 'melee';
        spawnUnitFromBuilding(unitType, b);
        } else {
        console.log(`Barracks finished, but unit cap reached (${cap}).`);
        }

        b.trainingType = null;
        refreshUI();
    } else {
        refreshUI();
    }
    }
}

// Handles building placement/construction jobs (e.g., barracks ghosts)
export function createConstructionManager({ barracksList }) {
    let constructionState = {
        mode: 'idle',     // 'idle' | 'placing'
        preview: null,    // follows mouse while placing
    };
    let constructionJobs = []; // array of active builds

    function startConstructionJob({ x, y, builder }) {
        const width = 80;
        const height = 60;
        const topInset = 20;

        const ghost = { x, y, width, height, topInset };

        const job = {
            id: Date.now() + Math.random(),
            ghost,
            builder,
            buildTimer: 0,
            buildDuration: 45,
            completed: false,
        };

        constructionJobs.push(job);

        // send builder toward site
        if (builder) {
            builder.tx = x;
            builder.ty = y + height * 0.3;
            builder.moving = true;
            builder.mode = 'building';
        }
    }

    function updateConstructionJobs(dt) {
        for (const job of constructionJobs) {
            if (job.completed) continue;

            job.buildTimer += dt;
            if (job.buildTimer >= job.buildDuration) {
                job.completed = true;

                const { ghost, builder } = job;

                const barracks = createBuildingFromTemplate('foldari_barracks', {
                    x: ghost.x,
                    y: ghost.y,
                    rallyX: ghost.x + 100,
                    rallyY: ghost.y,
                    ownerId: builder.ownerId,
                });

                if (barracks) {
                    barracksList.push(barracks);
                    console.log('Barracks added to barracksList; total:', barracksList.length);
                }

                const safeOffset = (barracks?.height || 60) / 2 + getUnitRadius(builder) + 5;
                builder.x = ghost.x;
                builder.y = ghost.y + safeOffset;
                builder.tx = builder.x;
                builder.ty = builder.y;
                builder.moving = false;
                builder.mode = 'idle';
            }
        }

        constructionJobs = constructionJobs.filter(job => !job.completed);
    }

    function getConstructionState() {
        return constructionState;
    }

    function getConstructionJobs() {
        return constructionJobs;
    }

    return {
        getConstructionState,
        getConstructionJobs,
        startConstructionJob,
        updateConstructionJobs,
    };
}