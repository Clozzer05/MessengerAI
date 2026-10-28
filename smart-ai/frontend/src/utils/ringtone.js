/**
 * Ringtone generator using Web Audio API.
 * No external file needed — synthesizes marimba-like melodies.
 * - startRingtone(): incoming call (callee)
 * - startRingback(): outgoing call while waiting for an answer (caller)
 */

let audioCtx = null;
let master = null;
let loopTimer = null;

// Nốt nhạc (Hz)
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, D6 = 1174.66, E6 = 1318.51;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Trình duyệt có thể tạm dừng AudioContext cho tới khi người dùng thao tác trên trang
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { /* chờ thao tác */ });
    return audioCtx;
}

/** One marimba-like note: fundamental + a quickly fading overtone */
function playNote(ctx, output, freq, start, duration) {
    [[1, 1], [4, 0.15]].forEach(([multiple, level]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * multiple;
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(level, start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration / multiple);
        osc.connect(env).connect(output);
        osc.start(start);
        osc.stop(start + duration);
    });
}

/** Repeat a phrase of [offset s, frequency, duration s] notes every `period` seconds */
function playLoop(notes, period, volume) {
    stopRingtone(); // clean up any previous ring

    const ctx = getAudioContext();
    const output = ctx.createGain();
    output.gain.value = volume;
    output.connect(ctx.destination);
    master = output;

    const playPhrase = () => {
        const start = ctx.currentTime + 0.05;
        notes.forEach(([offset, freq, duration]) => playNote(ctx, output, freq, start + offset, duration));
    };
    playPhrase();
    loopTimer = setInterval(playPhrase, period * 1000);
}

/** Incoming call: a bright rising phrase every 2.6s */
export function startRingtone() {
    playLoop([
        [0, G5, 0.4],
        [0.14, C6, 0.4],
        [0.28, E6, 0.6],
        [0.7, D6, 0.35],
        [0.84, C6, 0.9],
    ], 2.6, 0.5);
}

/** Outgoing call: a soft "ting… tong" every 3s until someone answers */
export function startRingback() {
    playLoop([
        [0, E5, 0.9],
        [0.45, C5, 1.2],
    ], 3, 0.3);
}

/** Stop all ringing */
export function stopRingtone() {
    if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
    }
    if (master) {
        master.disconnect(); // cuts notes already scheduled
        master = null;
    }
}
