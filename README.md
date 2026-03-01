# Grammar Corrector

A hybrid grammar checker and sentence reconstructor that uses a local corpus and the Datamuse API to fix mis-arranged or broken sentences.

## Features
- **Hybrid Model**: Combines local corpus training with real-world API data.
- **Beam Search**: Uses an efficient search algorithm to find the most probable reconstruction.
- **Self-Correcting**: Automatically capitalizes and punctuates sentences.

## Installation

Make sure you have [Node.js](https://nodejs.org/) installed.

1. Clone or download this repository.
2. Navigate to the project directory:
   ```bash
   cd "Grammar Corrector"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Dependencies
- `natural`: Natural language facilities for Node.js.
- `tinyqueue`: A simple priority queue.

## Usage
Run the application using Node.js:
```bash
node src/index.js
```
Follow the prompts to enter a broken sentence for reconstruction. Type `exit` to quit.

## Project Structure
- `src/`: Core logic (model, search, utilities).
- `data/`: Local corpus for training.
- `tests/`: Test suites.
