class BeamSearch {
    /**
     * @param {LanguageModel} model 
     * @param {number} beamWidth 
     */
    constructor(model, beamWidth = 20) {
        this.model = model;
        this.beamWidth = beamWidth;
        this.maxConcurrent = 30;
    }

    async search(tokens) {
        const numBOS = this.model.n - 1;
        let candidates = [
            {
                current_sentence: Array(numBOS).fill('<BOS>'),
                remaining_indices: Array.from(tokens.keys()),
                score: 0
            }
        ];

        for (let i = 0; i < tokens.length; i++) {
            const rawTasks = [];
            for (const cand of candidates) {
                for (let j = 0; j < cand.remaining_indices.length; j++) {
                    const tokenIdx = cand.remaining_indices[j];
                    const token = tokens[tokenIdx];
                    const context = cand.current_sentence;
                    // Task fingerprint: context suffix + token
                    const taskKey = context.slice(-(this.model.n - 1)).join('|') + '->' + token;

                    rawTasks.push({
                        taskKey,
                        token,
                        context,
                        cand,
                        j
                    });
                }
            }

            // Deduplicate API tasks: Many candidates share the same N-1 word context
            const uniqueTaskMap = new Map();
            for (const task of rawTasks) {
                if (!uniqueTaskMap.has(task.taskKey)) {
                    uniqueTaskMap.set(task.taskKey, { token: task.token, context: task.context });
                }
            }

            const uniqueTaskResults = new Map();
            const uniqueTaskList = Array.from(uniqueTaskMap.entries());

            // Process unique tasks in batches
            for (let b = 0; b < uniqueTaskList.length; b += this.maxConcurrent) {
                const batch = uniqueTaskList.slice(b, b + this.maxConcurrent);
                await Promise.all(batch.map(async ([key, task]) => {
                    const score = await this.model.getScore(task.token, task.context);
                    uniqueTaskResults.set(key, score);
                }));
            }

            // Construct next candidates using the scored tasks
            const nextCandidatesRaw = rawTasks.map(task => {
                const wordScore = uniqueTaskResults.get(task.taskKey);
                return {
                    current_sentence: [...task.cand.current_sentence, task.token],
                    remaining_indices: task.cand.remaining_indices.filter((_, idx) => idx !== task.j),
                    score: task.cand.score + wordScore
                };
            });

            // Deduplicate candidates: (Remaining Tokens + Last N-1 Context)
            const stateMap = new Map();
            for (const cand of nextCandidatesRaw) {
                const stateKey = cand.remaining_indices.sort().join(',') + '|' + cand.current_sentence.slice(-(this.model.n - 1)).join('|');
                if (!stateMap.has(stateKey) || stateMap.get(stateKey).score < cand.score) {
                    stateMap.set(stateKey, cand);
                }
            }

            candidates = Array.from(stateMap.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, this.beamWidth);

            if (tokens.length > 5) {
                process.stdout.write(`\rStep ${i + 1}/${tokens.length} - ${uniqueTaskList.length} tasks/step    `);
            }
        }

        console.log('\nFinalizing scoring...');
        const finalized = await Promise.all(candidates.map(async cand => {
            const eosScore = await this.model.getScore('<EOS>', cand.current_sentence);
            return {
                sentence: cand.current_sentence.slice(numBOS),
                score: cand.score + eosScore
            };
        }));

        finalized.sort((a, b) => b.score - a.score);
        return finalized.length > 0 ? finalized[0].sentence : [];
    }
}

module.exports = { BeamSearch };
