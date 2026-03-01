const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { tokenizeInput } = require('./utils');
const { LanguageModel } = require('./model');
const { BeamSearch } = require('./search');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    const NOW = new Date().toLocaleTimeString();
    console.log('\n=======================================');
    console.log(`--- Grammar Corrector [${NOW}] ---`);
    console.log('=======================================');
    console.log('Using Local Corpus + Datamuse API.');

    const CORPUS_PATH = path.join(__dirname, '..', 'data', 'corpus.txt');

    // Phase 1: Preparation (Hybrid Model)
    const model = new LanguageModel();

    try {
        const corpusData = fs.readFileSync(CORPUS_PATH, 'utf8');
        const sentences = corpusData.split(/\r?\n/).filter(s => s.trim().length > 0);
        const tokenizedSentences = sentences.map(s => tokenizeInput(s));
        model.train(tokenizedSentences);
    } catch (err) {
        console.warn('Warning: Local corpus not found. Falling back to pure API mode.');
        model.train([]);
    }

    // Phase 2: Search (Maximum beam width for structural perfection)
    const searcher = new BeamSearch(model, 2000);

    console.log('Type a mis-arranged sentence to re-arrange it.');
    console.log('Type "exit" to quit.\n');

    const askQuestion = () => {
        rl.question('broken sentence: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                rl.close();
                return;
            }

            if (input.trim() === '') {
                askQuestion();
                return;
            }

            console.log('Searching for the best reconstruction...');
            const tokens = tokenizeInput(input);
            const reconstructed = await searcher.search(tokens);

            // Phase 3: Formatting
            const output = formatOutput(reconstructed);
            console.log(`Reconstructed: ${output}\n`);

            askQuestion();
        });
    };

    askQuestion();
}

function formatOutput(tokens) {
    if (tokens.length === 0) return '';

    let sentence = tokens.join(' ');
    // Capitalize first letter
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    // Add period if not present
    if (!sentence.endsWith('.') && !sentence.endsWith('?') && !sentence.endsWith('!')) {
        sentence += '.';
    }
    return sentence;
}

rl.on('close', () => {
    console.log('\nExiting Grammar Corrector. Chao!');
    process.exit(0);
});

main().catch(console.error);
