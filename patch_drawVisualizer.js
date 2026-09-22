const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `                const isPlaying = !playerIndex.paused && playerIndex.currentTime > 0;
                const time = Date.now() * 0.003;

                if (visualizerMode === 'bars') {`;

const replacement = `                const isPlaying = !playerIndex.paused && playerIndex.currentTime > 0;
                const time = Date.now() * 0.003;

                if (isPlaying && isMusicReactive && isAudioAnalyserInit && audioAnalyser && audioFreqData) {
                    audioAnalyser.getByteFrequencyData(audioFreqData);
                }

                if (visualizerMode === 'bars') {`;

code = code.replace(target, replacement);

const target2 = `                        let barHeight = 4;
                        if (isPlaying) {
                            const norm = i / (numBars - 1);
                            const bass = (1 - norm) * 0.7 + 0.3;
                            const w1 = Math.sin(i * 0.4 + time * 2.2);
                            const w2 = Math.cos(i * 0.2 - time * 2.8);
                            const pulse = (Math.sin(time * 4) > 0.65) ? 0.35 : 0;
                            const energy = Math.abs(w1 * 0.5 + w2 * 0.5 + pulse);
                            barHeight = Math.max(6, energy * (height * 0.88) * bass);
                        } else {`;

const replacement2 = `                        let barHeight = 4;
                        if (isPlaying && isMusicReactive && isAudioAnalyserInit && audioFreqData) {
                            const norm = i / (numBars - 1);
                            // Logarithmic mapping to favor lower frequencies where music has more energy
                            const dataIndex = Math.floor(Math.pow(norm, 1.2) * (audioAnalyser.frequencyBinCount * 0.6));
                            const val = audioFreqData[dataIndex] || 0;
                            const energy = val / 255;
                            const bass = (1 - norm) * 0.4 + 0.6;
                            barHeight = Math.max(6, energy * (height * 0.95) * bass);
                        } else if (isPlaying) {
                            const norm = i / (numBars - 1);
                            const bass = (1 - norm) * 0.7 + 0.3;
                            const w1 = Math.sin(i * 0.4 + time * 2.2);
                            const w2 = Math.cos(i * 0.2 - time * 2.8);
                            const pulse = (Math.sin(time * 4) > 0.65) ? 0.35 : 0;
                            const energy = Math.abs(w1 * 0.5 + w2 * 0.5 + pulse);
                            barHeight = Math.max(6, energy * (height * 0.88) * bass);
                        } else {`;

code = code.replace(target2, replacement2);

fs.writeFileSync('server.ts', code);
