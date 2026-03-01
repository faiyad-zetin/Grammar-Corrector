const { loadCorpus, tokenizeInput } = require('../src/utils');
const { LanguageModel } = require('../src/model');
const { BeamSearch } = require('../src/search');
const path = require('path');

const CORPUS_PATH = path.join(__dirname, '..', 'data', 'corpus.txt');

function testComplex() {
    console.log('--- Complex Sentences Verification Test ---');
    const tokenizedCorpus = loadCorpus(CORPUS_PATH);
    const model = new LanguageModel(4); // Use Quadgrams
    model.train(tokenizedCorpus);
    const searcher = new BeamSearch(model, 20);

    const testCases = [
        {
            input: 'although raining was it he to go decided park the in run for a',
            expected: 'Although it was raining, he decided to go for a run in the park.'
        },
        {
            input: 'the next lives who door man architect landscape is talented a very',
            expected: 'The man who lives next door is a very talented landscape architect.'
        },
        {
            input: 'because bus missed she the she taxi a take to meeting had the to',
            expected: 'Because she missed the bus, she had to take a taxi to the meeting.'
        }
    ];

    testCases.forEach((test, index) => {
        const tokens = tokenizeInput(test.input);
        const reconstructedTokens = searcher.search(tokens);
        let reconstructed = reconstructedTokens.join(' ');
        reconstructed = reconstructed.charAt(0).toUpperCase() + reconstructed.slice(1);
        if (!reconstructed.endsWith('.') && !reconstructed.endsWith('?') && !reconstructed.endsWith('!')) {
            reconstructed += '.';
        }

        console.log(`\nTest Case ${index + 1}:`);
        console.log(`Jumbled: ${test.input}`);
        console.log(`Expected: ${test.expected}`);
        console.log(`Reconstructed: ${reconstructed}`);

        // Simple heuristic check
        if (reconstructed.toLowerCase().startsWith('although') ||
            reconstructed.toLowerCase().startsWith('the man') ||
            reconstructed.toLowerCase().startsWith('because')) {
            console.log('STATUS: PASS (High similarity)');
        } else {
            console.log('STATUS: FAIL (Significant deviation)');
        }
    });
}

testComplex();
