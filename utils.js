const natural = require('natural');
const fs = require('fs');

/**
 * Tokenizes a jumbled string and lowercases it.
 * @param {string} input 
 * @returns {string[]}
 */
function tokenizeInput(input) {
    const tokenizer = new natural.WordTokenizer();
    return tokenizer.tokenize(input.trim().toLowerCase());
}

module.exports = {
    tokenizeInput
};
