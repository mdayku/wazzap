/**
 * Seinfeld Script Data Structure
 * For RAG-based character responses
 */

import { SeinfeldCharacter } from './seinfeldCharacters';

export interface SeinfeldLine {
  id: string;
  character: SeinfeldCharacter;
  line: string;
  episode: string;
  season: number;
  episodeNumber: number;
  scene: string; // e.g., "Jerry's Apartment", "Monk's Cafe"
  context: string; // What's happening in the scene
  embedding?: number[]; // Vector embedding for semantic search
}

export interface SeinfeldEpisode {
  title: string;
  season: number;
  episodeNumber: number;
  airDate: string;
  summary: string;
  mainPlot: string;
  subPlots: string[];
  memorableQuotes: string[];
  lines: SeinfeldLine[];
}

/**
 * Sample Seinfeld lines for initial testing
 * These represent the style and tone we want to capture
 * 
 * Note: In production, we would scrape/load actual scripts
 * For now, these are representative examples based on well-known episodes
 */
export const SAMPLE_SEINFELD_LINES: SeinfeldLine[] = [
  // The Contest (S4E11)
  {
    id: 'contest_001',
    character: 'Jerry',
    line: "I think we can do this. I think we can do this!",
    episode: 'The Contest',
    season: 4,
    episodeNumber: 11,
    scene: "Jerry's Apartment",
    context: 'The group makes a bet about self-control'
  },
  {
    id: 'contest_002',
    character: 'George',
    line: "My mother caught me! I'm out!",
    episode: 'The Contest',
    season: 4,
    episodeNumber: 11,
    scene: "Monk's Cafe",
    context: 'George explains why he needs therapy'
  },
  
  // The Marine Biologist (S5E14)
  {
    id: 'marine_001',
    character: 'George',
    line: "The sea was angry that day, my friends. Like an old man trying to send back soup in a deli.",
    episode: 'The Marine Biologist',
    season: 5,
    episodeNumber: 14,
    scene: "Jerry's Apartment",
    context: 'George tells the story of saving a whale'
  },
  
  // The Soup Nazi (S7E6)
  {
    id: 'soup_001',
    character: 'Elaine',
    line: "You know what? I'm going to that soup stand. And I'm going to order soup!",
    episode: 'The Soup Nazi',
    season: 7,
    episodeNumber: 6,
    scene: "Jerry's Apartment",
    context: 'Elaine is determined to get soup despite the rules'
  },
  {
    id: 'soup_002',
    character: 'Kramer',
    line: "That's right! No soup for you!",
    episode: 'The Soup Nazi',
    season: 7,
    episodeNumber: 6,
    scene: "Soup Stand",
    context: 'Kramer explains the Soup Nazi\'s catchphrase'
  },
  
  // The Opposite (S5E22)
  {
    id: 'opposite_001',
    character: 'George',
    line: "My name is George. I'm unemployed and I live with my parents.",
    episode: 'The Opposite',
    season: 5,
    episodeNumber: 22,
    scene: "Monk's Cafe",
    context: 'George tries doing the opposite of his instincts'
  },
  {
    id: 'opposite_002',
    character: 'Jerry',
    line: "If every instinct you have is wrong, then the opposite would have to be right.",
    episode: 'The Opposite',
    season: 5,
    episodeNumber: 22,
    scene: "Monk's Cafe",
    context: 'Jerry suggests George do the opposite'
  },
  
  // The Puffy Shirt (S5E2)
  {
    id: 'puffy_001',
    character: 'Jerry',
    line: "But I don't wanna be a pirate!",
    episode: 'The Puffy Shirt',
    season: 5,
    episodeNumber: 2,
    scene: "Jerry's Apartment",
    context: 'Jerry realizes he agreed to wear a ridiculous shirt'
  },
  
  // The Parking Garage (S3E6)
  {
    id: 'parking_001',
    character: 'Kramer',
    line: "I can't carry a pen. I'm afraid I'll puncture my scrotum.",
    episode: 'The Parking Garage',
    season: 3,
    episodeNumber: 6,
    scene: "Parking Garage",
    context: 'The group is lost in a parking garage'
  },
  
  // The Comeback (S8E13)
  {
    id: 'comeback_001',
    character: 'George',
    line: "Well, the jerk store called, and they're running out of you!",
    episode: 'The Comeback',
    season: 8,
    episodeNumber: 13,
    scene: "Conference Room",
    context: 'George finally delivers his comeback'
  },
  
  // The Serenity Now (S9E3)
  {
    id: 'serenity_001',
    character: 'George',
    line: "Serenity now! Serenity now!",
    episode: 'The Serenity Now',
    season: 9,
    episodeNumber: 3,
    scene: "Costanza House",
    context: 'Frank tries to control his anger'
  },
  
  // The Strike (S9E10) - Festivus
  {
    id: 'festivus_001',
    character: 'Kramer',
    line: "It's a Festivus for the rest of us!",
    episode: 'The Strike',
    season: 9,
    episodeNumber: 10,
    scene: "Costanza House",
    context: 'Kramer explains Festivus'
  },
  
  // The Rye (S7E11)
  {
    id: 'rye_001',
    character: 'Jerry',
    line: "You're telling me that you stole a loaf of bread from an old lady?",
    episode: 'The Rye',
    season: 7,
    episodeNumber: 11,
    scene: "Jerry's Apartment",
    context: 'George stole marble rye from an old woman'
  },
  
  // General conversational lines
  {
    id: 'general_001',
    character: 'Jerry',
    line: "What's the deal with that?",
    episode: 'Various',
    season: 0,
    episodeNumber: 0,
    scene: 'Various',
    context: 'Jerry\'s observational comedy style'
  },
  {
    id: 'general_002',
    character: 'Elaine',
    line: "Get OUT!",
    episode: 'Various',
    season: 0,
    episodeNumber: 0,
    scene: 'Various',
    context: 'Elaine expressing surprise or disbelief'
  },
  {
    id: 'general_003',
    character: 'Kramer',
    line: "Giddy up!",
    episode: 'Various',
    season: 0,
    episodeNumber: 0,
    scene: 'Various',
    context: 'Kramer\'s enthusiastic exclamation'
  },
  {
    id: 'general_004',
    character: 'George',
    line: "It's not a lie if you believe it.",
    episode: 'The Beard',
    season: 6,
    episodeNumber: 16,
    scene: "Jerry's Apartment",
    context: 'George justifies his lying'
  }
];

/**
 * Get sample lines for a specific character
 */
export function getCharacterLines(character: SeinfeldCharacter): SeinfeldLine[] {
  return SAMPLE_SEINFELD_LINES.filter(line => line.character === character);
}

/**
 * Get lines from a specific episode
 */
export function getEpisodeLines(episodeTitle: string): SeinfeldLine[] {
  return SAMPLE_SEINFELD_LINES.filter(line => line.episode === episodeTitle);
}

/**
 * Search lines by keyword (simple text search)
 * In production, this would use semantic search with embeddings
 */
export function searchLines(query: string): SeinfeldLine[] {
  const lowerQuery = query.toLowerCase();
  return SAMPLE_SEINFELD_LINES.filter(line => 
    line.line.toLowerCase().includes(lowerQuery) ||
    line.context.toLowerCase().includes(lowerQuery) ||
    line.episode.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get random line for a character (for variety)
 */
export function getRandomLine(character: SeinfeldCharacter): SeinfeldLine {
  const lines = getCharacterLines(character);
  return lines[Math.floor(Math.random() * lines.length)];
}

