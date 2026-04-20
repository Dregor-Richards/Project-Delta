// Defines starting layout for Fields Of Crystil map (Considered Map1)

import { CONTINENT_UNIT_KEYS } from './factions.js';
import { createUnitForPlayer } from './unitTemplates.js';

export function createMap1({ canvas, localPlayerId, enemyPlayerId, localFaction, enemyFaction }) {
    // Define world size (bigger than the canvas)
    const WORLD_WIDTH = 3000;
    const WORLD_HEIGHT = 2000;

    const copperNodes = [];
    const enemyCopperNodes = [];
    const units = [];
    const barracksList = [];

    const copperRadius = 10;

    // --- Player 1 copper nodes (left) ---
    // Use WORLD_WIDTH/HEIGHT so layout is map-relative, not canvas-relative
    const baseCopperX = WORLD_WIDTH / 4 - 100;
    const baseCopperY = WORLD_HEIGHT - 200;

    for (let i = 0; i < 5; i++) {
        copperNodes.push({
            x: baseCopperX - i * 35,
            y: baseCopperY + (i % 2 === 0 ? -20 : 20),
            radius: copperRadius,
            remaining: 500,
            active: true,
        });
    }

    // --- Enemy copper nodes (right) ---
    const enemyBaseCopperX = (WORLD_WIDTH * 3) / 4 + 100;
    const enemyBaseCopperY = WORLD_HEIGHT - 200;

    for (let i = 0; i < 5; i++) {
        enemyCopperNodes.push({
            x: enemyBaseCopperX + i * 35,
            y: enemyBaseCopperY + (i % 2 === 0 ? -20 : 20),
            radius: copperRadius,
            remaining: 500,
            active: true,
        });
    }

    // --- Refineries ---
    const refinery = {
        x: WORLD_WIDTH / 4,
        y: WORLD_HEIGHT - 200,
        size: 70,
        selected: false,
        training: false,
        trainingTime: 0,
        trainingDuration: 3,
        rallyX: (WORLD_WIDTH / 4) * 3 - 100,
        rallyY: WORLD_HEIGHT / 2,
        ownerId: localPlayerId,
    };

    const enemyRefinery = {
        x: (WORLD_WIDTH * 3) / 4,
        y: WORLD_HEIGHT - 200,
        size: 70,
        selected: false,
        training: false,
        trainingTime: 0,
        trainingDuration: 3,
        rallyX: WORLD_WIDTH / 4 + 100,
        rallyY: WORLD_HEIGHT / 2,
        ownerId: enemyPlayerId,
    };

    // --- Starting gatherers for player 1 ---
    for (let i = 0; i < 3; i++) {
        units.push(
            createUnitForPlayer(
                CONTINENT_UNIT_KEYS[localFaction].gatherer,
                localPlayerId,
                {
                    x: refinery.x + 40 + i * 20,
                    y: refinery.y - 30 + (i - 1) * 20,
                    tx: refinery.x + 40 + i * 20,
                    ty: refinery.y - 30 + (i - 1) * 20,
                }
            )
        );
    }

    // --- Starting gatherers for enemy ---
    for (let i = 0; i < 3; i++) {
        units.push(
            createUnitForPlayer(
                CONTINENT_UNIT_KEYS[enemyFaction].gatherer,
                enemyPlayerId,
                {
                    x: enemyRefinery.x - 40 - i * 20,
                    y: enemyRefinery.y - 30 + (i - 1) * 20,
                    tx: enemyRefinery.x - 40 - i * 20,
                    ty: enemyRefinery.y - 30 + (i - 1) * 20,
                }
            )
        );
    }

    return {
        copperNodes,
        enemyCopperNodes,
        units,
        barracksList,
        refinery,
        enemyRefinery,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
    };
}