import { calculatePlayerPopularity } from './lib/clubWeights.js';
import fs from 'fs';

const players = JSON.parse(fs.readFileSync('./lib/players.json', 'utf8'));
console.log(players[0].name, calculatePlayerPopularity(players[0]));
