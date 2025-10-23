# Seinfeld Scripts Data Loader

This directory contains scripts for loading Seinfeld dialogue data to train the AI agents.

## Current Status

✅ **40 iconic quotes** from all 4 main characters loaded
- Jerry: 10 quotes
- George: 10 quotes  
- Elaine: 10 quotes
- Kramer: 10 quotes

## How to Load Scripts

### Option 1: Use Current Dataset (Ready Now!)
```bash
cd scripts
npx ts-node loadSeinfeldScripts.ts
```

This will upload the 40 curated quotes to Firestore.

### Option 2: Expand the Dataset

To add more quotes, you can:

1. **Manual Addition**: Edit `seinfeld-scripts.json` and add more quotes in this format:
```json
{
  "character": "JERRY",
  "dialogue": "Your quote here",
  "episode": "Episode Name",
  "season": 5,
  "episodeNumber": 12
}
```

2. **Download Public Datasets**:
   - [Kaggle: Seinfeld Chronicles](https://www.kaggle.com/datasets/thec03u5/seinfeld-chronicles)
   - [Colin Pollock's Seinfeld Database](https://colinpollock.net/seinfeld-script-data)
   - Save as `seinfeld-scripts.json` in this directory

3. **Web Scraping** (Advanced):
   - Scrape from seinfeldscripts.com
   - Parse HTML to extract character dialogues
   - Format as JSON

## Data Format

Each line should have:
- `character`: Character name (JERRY, GEORGE, ELAINE, KRAMER)
- `dialogue`: The actual line spoken
- `episode`: Episode title
- `season`: Season number (1-9)
- `episodeNumber`: Episode number within season

## After Loading

Once scripts are loaded to Firestore:

1. **Generate Embeddings**: Deploy the Cloud Function that generates embeddings
2. **Test Agents**: Enable Seinfeld Mode in a chat and test responses
3. **Measure Quality**: Run the test suite to verify character consistency

## Notes

- The current 40 quotes are enough to demonstrate the concept
- For production-quality responses, aim for 200-500 quotes per character
- Full scripts (all 180 episodes) would give ~10,000+ lines per character
- More data = better RAG performance = more authentic responses

## Legal Note

All quotes are from the publicly available Seinfeld TV show (1989-1998). This is for educational/demonstration purposes as part of a university project testing RAG systems.
