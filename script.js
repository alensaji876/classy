// Web Audio API Synthesizer Engine - Continuous & Dynamic Performance
let audioCtx;
let isAudioEnabled = false;

document.addEventListener('click', () => {
    if (!isAudioEnabled) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        isAudioEnabled = true;
        
        const soundStatus = document.getElementById('soundStatus');
        if (soundStatus) {
            soundStatus.textContent = "Audio On 🎵";
            soundStatus.classList.add('active');
        }
    }
});

// Base class for persistent, glitch-free acoustic instrument synthesis
class BaseInstrument {
    constructor(baseFreq, reducedGain, maxGain) {
        this.baseFreq = baseFreq;
        this.reducedGain = reducedGain; // Steady volume when still / stationary
        this.maxGain = maxGain;         // Amplified volume when moving / stretching
        this.isPlaying = false;
        this.isGraphBuilt = false;
        this.masterGain = null;
        this.filter = null;
    }

    ensureGraph() {
        if (this.isGraphBuilt || !audioCtx) return;
        this.buildAudioGraph();
        this.isGraphBuilt = true;
    }

    start() {
        if (!audioCtx) return;
        this.ensureGraph();
        this.isPlaying = true;
        
        const now = audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(this.reducedGain, now, 0.05);
    }

    // Called continuously while fingers are pointed & connected
    update(yRatio, intensity, motionSpeed = 0) {
        if (!audioCtx) return;
        this.ensureGraph();
        this.isPlaying = true;
        const now = audioCtx.currentTime;

        // Dynamics:
        // When stationary (motionSpeed ~ 0, intensity ~ 0): factor is 0 -> plays at reducedGain continuously
        // When moving or stretching lines: factor swells smoothly up to 1.0 -> amplifies to maxGain
        const factor = Math.min(Math.max(intensity * 0.70 + motionSpeed * 0.50, 0), 1);
        const targetGain = this.reducedGain + (this.maxGain - this.reducedGain) * factor;

        this.masterGain.gain.setTargetAtTime(targetGain, now, 0.05);
        this.modulate(now, yRatio, factor);
    }

    // Immediate mute when fingers are closed or near palm
    stop() {
        if (!this.isPlaying || !this.masterGain || !audioCtx) return;
        this.isPlaying = false;
        const now = audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.00001, now + 0.02); // 20ms clean instant mute
    }

    buildAudioGraph() {}
    modulate(now, yRatio, factor) {}
}

// 1. CELLO SYNTH (Thumb) - Deep, resonant bowed strings
class CelloSynth extends BaseInstrument {
    constructor(freq = 261.63) { // C4
        super(freq, 0.11, 0.44);
        this.minCutoff = 380;
        this.maxCutoff = 1750;
    }

    buildAudioGraph() {
        const now = audioCtx.currentTime;

        this.osc1 = audioCtx.createOscillator();
        this.osc1.type = 'sawtooth';
        this.osc1.frequency.setValueAtTime(this.baseFreq, now);
        this.osc1.detune.setValueAtTime(-5, now);

        this.osc2 = audioCtx.createOscillator();
        this.osc2.type = 'sawtooth';
        this.osc2.frequency.setValueAtTime(this.baseFreq, now);
        this.osc2.detune.setValueAtTime(+5, now);

        this.filter = audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(this.minCutoff, now);
        this.filter.Q.value = 2.0;

        this.vibratoOsc = audioCtx.createOscillator();
        this.vibratoOsc.frequency.value = 4.8;
        this.vibratoGain = audioCtx.createGain();
        this.vibratoGain.gain.value = 5;
        this.vibratoOsc.connect(this.vibratoGain);
        this.vibratoGain.connect(this.osc1.frequency);
        this.vibratoGain.connect(this.osc2.frequency);

        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.00001, now);

        this.osc1.connect(this.filter);
        this.osc2.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(audioCtx.destination);

        this.osc1.start(now);
        this.osc2.start(now);
        this.vibratoOsc.start(now);
    }

    modulate(now, yRatio, factor) {
        const targetCutoff = this.minCutoff + (this.maxCutoff - this.minCutoff) * Math.pow(factor, 1.2);
        this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

        const bend = (0.5 - yRatio) * 45;
        this.osc1.frequency.setTargetAtTime(this.baseFreq + bend, now, 0.08);
        this.osc2.frequency.setTargetAtTime(this.baseFreq + bend, now, 0.08);
    }
}

// 2. CONCERT FLUTE SYNTH (Index) - Airy, breathy woodwind
class FluteSynth extends BaseInstrument {
    constructor(freq = 587.33) { // D5
        super(freq, 0.09, 0.38);
        this.minCutoff = 1800;
        this.maxCutoff = 5200;
    }

    buildAudioGraph() {
        const now = audioCtx.currentTime;

        this.oscSine = audioCtx.createOscillator();
        this.oscSine.type = 'sine';
        this.oscSine.frequency.setValueAtTime(this.baseFreq, now);

        this.oscTri = audioCtx.createOscillator();
        this.oscTri.type = 'triangle';
        this.oscTri.frequency.setValueAtTime(this.baseFreq * 2, now);
        this.triGain = audioCtx.createGain();
        this.triGain.gain.setValueAtTime(0.12, now);
        this.oscTri.connect(this.triGain);

        this.filter = audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(this.minCutoff, now);
        this.filter.Q.value = 1.0;

        this.vibratoOsc = audioCtx.createOscillator();
        this.vibratoOsc.frequency.value = 5.4;
        this.vibratoGain = audioCtx.createGain();
        this.vibratoGain.gain.value = 7;
        this.vibratoOsc.connect(this.vibratoGain);
        this.vibratoGain.connect(this.oscSine.frequency);

        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.00001, now);

        this.oscSine.connect(this.filter);
        this.triGain.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(audioCtx.destination);

        this.oscSine.start(now);
        this.oscTri.start(now);
        this.vibratoOsc.start(now);
    }

    modulate(now, yRatio, factor) {
        const targetCutoff = this.minCutoff + (this.maxCutoff - this.minCutoff) * Math.pow(factor, 1.2);
        this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

        if (this.triGain) {
            this.triGain.gain.setTargetAtTime(0.10 + 0.15 * factor, now, 0.05);
        }

        const bend = (0.5 - yRatio) * 55;
        this.oscSine.frequency.setTargetAtTime(this.baseFreq + bend, now, 0.08);
        this.oscTri.frequency.setTargetAtTime((this.baseFreq + bend) * 2, now, 0.08);
    }
}

// 3. SOLO VIOLIN SYNTH (Middle) - Bright, expressive acoustic string
class ViolinSynth extends BaseInstrument {
    constructor(freq = 440.00) { // A4
        super(freq, 0.09, 0.40);
        this.minCutoff = 1100;
        this.maxCutoff = 4800;
    }

    buildAudioGraph() {
        const now = audioCtx.currentTime;

        this.osc = audioCtx.createOscillator();
        this.osc.type = 'sawtooth';
        this.osc.frequency.setValueAtTime(this.baseFreq, now);

        this.formantFilter = audioCtx.createBiquadFilter();
        this.formantFilter.type = 'peaking';
        this.formantFilter.frequency.setValueAtTime(2400, now);
        this.formantFilter.Q.value = 2.2;
        this.formantFilter.gain.value = 5;

        this.filter = audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(this.minCutoff, now);
        this.filter.Q.value = 1.8;

        this.vibratoOsc = audioCtx.createOscillator();
        this.vibratoOsc.frequency.value = 6.0;
        this.vibratoGain = audioCtx.createGain();
        this.vibratoGain.gain.value = 8;
        this.vibratoOsc.connect(this.vibratoGain);
        this.vibratoGain.connect(this.osc.frequency);

        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.00001, now);

        this.osc.connect(this.formantFilter);
        this.formantFilter.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(audioCtx.destination);

        this.osc.start(now);
        this.vibratoOsc.start(now);
    }

    modulate(now, yRatio, factor) {
        const targetCutoff = this.minCutoff + (this.maxCutoff - this.minCutoff) * Math.pow(factor, 1.2);
        this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

        const bend = (0.5 - yRatio) * 50;
        this.osc.frequency.setTargetAtTime(this.baseFreq + bend, now, 0.08);
    }
}

// 4. CELTIC HARP SYNTH (Ring) - Plucked acoustic string with singing resonance
class HarpSynth extends BaseInstrument {
    constructor(freq = 523.25) { // C5
        super(freq, 0.10, 0.42);
        this.minCutoff = 900;
        this.maxCutoff = 6500;
    }

    buildAudioGraph() {
        const now = audioCtx.currentTime;

        this.oscFund = audioCtx.createOscillator();
        this.oscFund.type = 'triangle';
        this.oscFund.frequency.setValueAtTime(this.baseFreq, now);

        this.oscOct = audioCtx.createOscillator();
        this.oscOct.type = 'sine';
        this.oscOct.frequency.setValueAtTime(this.baseFreq * 2, now);
        this.octGain = audioCtx.createGain();
        this.octGain.gain.setValueAtTime(0.18, now);
        this.oscOct.connect(this.octGain);

        this.filter = audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(this.minCutoff, now);
        this.filter.Q.value = 2.4;

        this.vibratoOsc = audioCtx.createOscillator();
        this.vibratoOsc.frequency.value = 4.2;
        this.vibratoGain = audioCtx.createGain();
        this.vibratoGain.gain.value = 4;
        this.vibratoOsc.connect(this.vibratoGain);
        this.vibratoGain.connect(this.oscFund.frequency);

        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.00001, now);

        this.oscFund.connect(this.filter);
        this.octGain.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(audioCtx.destination);

        this.oscFund.start(now);
        this.oscOct.start(now);
        this.vibratoOsc.start(now);
    }

    modulate(now, yRatio, factor) {
        const targetCutoff = this.minCutoff + (this.maxCutoff - this.minCutoff) * Math.pow(factor, 1.1);
        this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

        if (this.octGain) {
            this.octGain.gain.setTargetAtTime(0.15 + 0.22 * factor, now, 0.05);
        }

        const bend = (0.5 - yRatio) * 55;
        this.oscFund.frequency.setTargetAtTime(this.baseFreq + bend, now, 0.08);
        this.oscOct.frequency.setTargetAtTime((this.baseFreq + bend) * 2, now, 0.08);
    }
}

// 5. CRYSTAL BELL / CHIMES SYNTH (Pinky) - Inharmonic metallic bell chime
class BellSynth extends BaseInstrument {
    constructor(freq = 783.99) { // G5
        super(freq, 0.07, 0.36);
    }

    buildAudioGraph() {
        const now = audioCtx.currentTime;

        this.osc1 = audioCtx.createOscillator();
        this.osc1.type = 'sine';
        this.osc1.frequency.setValueAtTime(this.baseFreq, now);

        this.osc2 = audioCtx.createOscillator();
        this.osc2.type = 'sine';
        this.osc2.frequency.setValueAtTime(this.baseFreq * 2.756, now);
        this.gain2 = audioCtx.createGain();
        this.gain2.gain.setValueAtTime(0.30, now);
        this.osc2.connect(this.gain2);

        this.osc3 = audioCtx.createOscillator();
        this.osc3.type = 'sine';
        this.osc3.frequency.setValueAtTime(this.baseFreq * 5.404, now);
        this.gain3 = audioCtx.createGain();
        this.gain3.gain.setValueAtTime(0.15, now);
        this.osc3.connect(this.gain3);

        this.filter = audioCtx.createBiquadFilter();
        this.filter.type = 'highpass';
        this.filter.frequency.setValueAtTime(320, now);

        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.00001, now);

        this.osc1.connect(this.filter);
        this.gain2.connect(this.filter);
        this.gain3.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(audioCtx.destination);

        this.osc1.start(now);
        this.osc2.start(now);
        this.osc3.start(now);
    }

    modulate(now, yRatio, factor) {
        if (this.gain2 && this.gain3) {
            this.gain2.gain.setTargetAtTime(0.25 + 0.25 * factor, now, 0.05);
            this.gain3.gain.setTargetAtTime(0.12 + 0.18 * factor, now, 0.05);
        }

        const bend = (0.5 - yRatio) * 65;
        this.osc1.frequency.setTargetAtTime(this.baseFreq + bend, now, 0.08);
        this.osc2.frequency.setTargetAtTime((this.baseFreq + bend) * 2.756, now, 0.08);
        this.osc3.frequency.setTargetAtTime((this.baseFreq + bend) * 5.404, now, 0.08);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('input_video');
    const canvasElement = document.getElementById('output_canvas');
    const canvasCtx = canvasElement.getContext('2d');
    const loadingEl = document.getElementById('loading');
    const statusBadge = document.getElementById('statusBadge');
    const intensityBar = document.getElementById('intensityBar');
    const intensityPercent = document.getElementById('intensityPercent');

    let isLoaded = false;
    let cameraManager = null;
    let currentResolution = '1080p';
    let isCrispFilterOn = true;

    // Quality HUD DOM elements
    const qualityPill = document.getElementById('qualityPill');
    const qualityDropdown = document.getElementById('qualityDropdown');
    const qualityText = document.getElementById('qualityText');
    const clarityToggle = document.getElementById('clarityToggle');
    const qualityButtons = document.querySelectorAll('.quality-btn');
    const cameraSelect = document.getElementById('cameraSelect');

    async function populateCameraList() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            if (cameraSelect) {
                cameraSelect.innerHTML = '';
                if (videoDevices.length === 0) {
                    const opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = 'Default Camera';
                    cameraSelect.appendChild(opt);
                } else {
                    videoDevices.forEach((device, index) => {
                        const opt = document.createElement('option');
                        opt.value = device.deviceId;
                        opt.textContent = device.label || `Camera ${index + 1}`;
                        if (cameraManager && cameraManager.selectedDeviceId === device.deviceId) {
                            opt.selected = true;
                        }
                        cameraSelect.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.warn("Could not enumerate camera devices:", err);
        }
    }

    if (cameraSelect) {
        cameraSelect.addEventListener('change', async () => {
            const chosenId = cameraSelect.value;
            statusBadge.textContent = "Switching camera device...";
            statusBadge.classList.add('visible');
            try {
                if (cameraManager) {
                    await cameraManager.switchCamera(chosenId);
                    resizeCanvas();
                    updateQualityBadge();
                    statusBadge.textContent = "Camera Connected";
                    setTimeout(() => {
                        if (statusBadge.textContent.includes('Camera Connected')) {
                            statusBadge.textContent = "Waiting for hands...";
                        }
                    }, 2000);
                }
            } catch (err) {
                console.error("Error switching camera:", err);
                statusBadge.textContent = "Error connecting to selected camera";
            }
        });
    }

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', () => {
            populateCameraList();
        });
    }

    function updateQualityBadge() {
        if (!videoElement.videoWidth) return;
        const w = videoElement.videoWidth;
        const h = videoElement.videoHeight;
        
        let fps = 60;
        if (cameraManager && cameraManager.stream) {
            const track = cameraManager.stream.getVideoTracks()[0];
            if (track && track.getSettings) {
                const s = track.getSettings();
                if (s.frameRate) fps = Math.round(s.frameRate);
            }
        }
        
        let label = `${w}×${h}`;
        if (w >= 3840 || h >= 2160) label = `4K UHD • ${fps} FPS`;
        else if (w >= 1920 || h >= 1080) label = `1080p FHD • ${fps} FPS`;
        else if (w >= 1280 || h >= 720) label = `720p HD • ${fps} FPS`;
        else label = `${w}×${h} • ${fps} FPS`;

        if (qualityText) {
            qualityText.textContent = label;
        }
    }

    function resizeCanvas() {
        if (videoElement.videoWidth && videoElement.videoHeight) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            updateQualityBadge();
        }
    }
    
    videoElement.addEventListener('loadeddata', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);

    // Setup Quality HUD interactivity
    if (qualityPill && qualityDropdown) {
        qualityPill.addEventListener('click', (e) => {
            e.stopPropagation();
            qualityDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!qualityDropdown.contains(e.target) && e.target !== qualityPill) {
                qualityDropdown.classList.remove('active');
            }
        });
    }

    if (clarityToggle) {
        clarityToggle.addEventListener('click', () => {
            isCrispFilterOn = !isCrispFilterOn;
            clarityToggle.textContent = isCrispFilterOn ? "ON" : "OFF";
            clarityToggle.classList.toggle('active', isCrispFilterOn);
            canvasElement.classList.toggle('natural-mode', !isCrispFilterOn);
        });
    }

    const RESOLUTION_PRESETS = {
        '4k': { width: 3840, height: 2160 },
        '1080p': { width: 1920, height: 1080 },
        '720p': { width: 1280, height: 720 }
    };

    qualityButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const resKey = btn.dataset.res;
            qualityButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (qualityDropdown) qualityDropdown.classList.remove('active');
            
            const target = RESOLUTION_PRESETS[resKey] || RESOLUTION_PRESETS['1080p'];
            statusBadge.textContent = `Upgrading camera to ${resKey.toUpperCase()}...`;
            statusBadge.classList.add('visible');

            try {
                if (cameraManager) {
                    await cameraManager.switchResolution(target.width, target.height);
                    resizeCanvas();
                    statusBadge.textContent = `${resKey.toUpperCase()} Active (${videoElement.videoWidth}×${videoElement.videoHeight})`;
                    setTimeout(() => {
                        if (statusBadge.textContent.includes('Active')) {
                            statusBadge.textContent = "Waiting for hands...";
                        }
                    }, 2500);
                }
            } catch (err) {
                console.error("Resolution switch error:", err);
                statusBadge.textContent = "Could not switch resolution";
            }
        });
    });

    // Calculate 2D distance between two landmarks in canvas pixel coordinates
    function getDistance2D(lm1, lm2) {
        const dx = (lm1.x - lm2.x) * canvasElement.width;
        const dy = (lm1.y - lm2.y) * canvasElement.height;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // High-Precision Detection: Closed fingers or fingers resting near the palm NEVER trigger
    function isFingerOpen(hand, tipIdx, dipIdx, pipIdx, mcpIdx) {
        const tip = hand[tipIdx];
        const dip = hand[dipIdx];
        const pip = hand[pipIdx];
        const mcp = hand[mcpIdx];
        const wrist = hand[0];

        // Special rule for Thumb
        if (tipIdx === 4) {
            const pinkyBase = hand[17];
            const indexBase = hand[5];
            
            const tipToPinky = getDistance2D(tip, pinkyBase);
            const ipToPinky = getDistance2D(pip, pinkyBase);
            const tipToMcp = getDistance2D(tip, mcp);
            const ipToMcp = getDistance2D(pip, mcp);
            const tipToIndex = getDistance2D(tip, indexBase);

            // Thumb must be extended away from pinky base and away from index finger
            const isExtended = tipToPinky > ipToPinky * 1.18 && tipToMcp > ipToMcp * 1.25;
            const notTucked = tipToIndex > getDistance2D(mcp, indexBase) * 0.75;
            return isExtended && notTucked;
        }

        // Standard fingers (Index, Middle, Ring, Pinky)
        const tipToMcp = getDistance2D(tip, mcp);
        const dipToMcp = getDistance2D(dip, mcp);
        const pipToMcp = getDistance2D(pip, mcp);
        const tipToWrist = getDistance2D(tip, wrist);
        const pipToWrist = getDistance2D(pip, wrist);

        // 1. When curled into the palm, Tip is tucked inside DIP (so tipToMcp < dipToMcp)
        // For an open finger, Tip must be distinctly beyond DIP
        const tipPastDip = tipToMcp > dipToMcp * 1.12;

        // 2. Tip must be extended away from the base MCP joint by the full finger length
        const tipPastPip = tipToMcp > pipToMcp * 1.65;

        // 3. Tip must point outward away from the wrist (never back towards the palm)
        const tipPastWrist = tipToWrist > pipToWrist * 1.12;

        return tipPastDip && tipPastPip && tipPastWrist;
    }

    // Instrument Orchestra Configuration
    const fingerConfigs = [
        { 
            name: 'Thumb', 
            instrument: 'Cello', 
            tip: 4, dip: 3, pip: 3, mcp: 2, 
            color: '#ff003c', 
            createSynth: () => new CelloSynth(261.63) 
        },
        { 
            name: 'Index', 
            instrument: 'Flute', 
            tip: 8, dip: 7, pip: 6, mcp: 5, 
            color: '#00f0ff', 
            createSynth: () => new FluteSynth(587.33) 
        },
        { 
            name: 'Middle', 
            instrument: 'Violin', 
            tip: 12, dip: 11, pip: 10, mcp: 9, 
            color: '#39ff14', 
            createSynth: () => new ViolinSynth(440.00) 
        },
        { 
            name: 'Ring', 
            instrument: 'Harp', 
            tip: 16, dip: 15, pip: 14, mcp: 13, 
            color: '#fcf803', 
            createSynth: () => new HarpSynth(523.25) 
        },
        { 
            name: 'Pinky', 
            instrument: 'Crystal Bell', 
            tip: 20, dip: 19, pip: 18, mcp: 17, 
            color: '#a55eea', 
            createSynth: () => new BellSynth(783.99) 
        }
    ];

    function hexToRgba(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Calculate line intensity from length (0.0 to 1.0)
    function calculateLineIntensity(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        
        const minSpan = 50;
        const maxSpan = Math.max(canvasElement.width * 0.65, 300);
        const raw = (lineLength - minSpan) / (maxSpan - minSpan);
        const intensity = Math.min(Math.max(raw, 0), 1);
        
        return { length: lineLength, intensity };
    }

    function onResults(results) {
        if (!isLoaded) {
            isLoaded = true;
            loadingEl.style.opacity = '0';
            setTimeout(() => loadingEl.style.display = 'none', 500);
            statusBadge.classList.add('visible');
        }

        if (canvasElement.width !== videoElement.videoWidth) {
            resizeCanvas();
        }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Enable high-quality bicubic resampling for crisp display
        canvasCtx.imageSmoothingEnabled = true;
        canvasCtx.imageSmoothingQuality = 'high';

        // Draw video frame on canvas (mirrored)
        canvasCtx.translate(canvasElement.width, 0);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        let handsPresent = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
        let twoHandsPresent = handsPresent && results.multiHandLandmarks.length >= 2;

        let maxActiveIntensity = 0;
        let activeFingersCount = 0;

        if (twoHandsPresent) {
            const hand1 = results.multiHandLandmarks[0];
            const hand2 = results.multiHandLandmarks[1];
            
            fingerConfigs.forEach(finger => {
                if (!finger.synth) {
                    finger.synth = finger.createSynth();
                }

                // Strict check: must be fully open on BOTH hands
                const isOpen1 = isFingerOpen(hand1, finger.tip, finger.dip, finger.pip, finger.mcp);
                const isOpen2 = isFingerOpen(hand2, finger.tip, finger.dip, finger.pip, finger.mcp);

                if (isOpen1 && isOpen2) {
                    finger.isConnected = true;
                    activeFingersCount++;

                    const tip1 = hand1[finger.tip];
                    const tip2 = hand2[finger.tip];

                    const x1 = tip1.x * canvasElement.width;
                    const y1 = tip1.y * canvasElement.height;
                    
                    const x2 = tip2.x * canvasElement.width;
                    const y2 = tip2.y * canvasElement.height;

                    // Motion speed detection
                    const prev = finger.prevPos || { x1, y1, x2, y2 };
                    const moveDelta = Math.hypot(x1 - prev.x1, y1 - prev.y1) + Math.hypot(x2 - prev.x2, y2 - prev.y2);
                    finger.prevPos = { x1, y1, x2, y2 };

                    const rawSpeed = Math.min(moveDelta / 18, 1);
                    finger.smoothSpeed = (finger.smoothSpeed || 0) * 0.75 + rawSpeed * 0.25;

                    // Line length intensity
                    const { length, intensity: lineIntensity } = calculateLineIntensity(x1, y1, x2, y2);
                    
                    // Combined intensity for visual & sound amplification
                    const combined = Math.min(Math.max(lineIntensity * 0.70 + finger.smoothSpeed * 0.50, 0), 1);
                    if (combined > maxActiveIntensity) {
                        maxActiveIntensity = combined;
                    }

                    // Draw glowing line
                    drawGlowingLine(x1, y1, x2, y2, finger.color, combined);
                    drawGlowingPoint(x1, y1, finger.color, combined);
                    drawGlowingPoint(x2, y2, finger.color, combined);
                    
                    if (isAudioEnabled) {
                        const yRatio = (tip1.y + tip2.y) / 2;
                        finger.synth.update(yRatio, lineIntensity, finger.smoothSpeed);
                    }
                } else {
                    // Finger is closed or near palm -> MUTE IMMEDIATELY! NO SOUND!
                    finger.isConnected = false;
                    finger.prevPos = null;
                    finger.smoothSpeed = 0;
                    if (finger.synth) {
                        finger.synth.stop();
                    }
                }
            });

            if (activeFingersCount > 0) {
                const percent = Math.round(maxActiveIntensity * 100);
                statusBadge.textContent = `Ganamela Active: ${activeFingersCount} Voice${activeFingersCount > 1 ? 's' : ''}`;
                statusBadge.classList.add('connected');
                
                if (intensityBar && intensityPercent) {
                    intensityBar.style.width = `${Math.max(percent, 15)}%`;
                    intensityPercent.textContent = `${percent}%`;
                }
            } else {
                statusBadge.textContent = "Point fingers to connect";
                statusBadge.classList.remove('connected');
                if (intensityBar && intensityPercent) {
                    intensityBar.style.width = '0%';
                    intensityPercent.textContent = '0%';
                }
            }
            
        } else {
            statusBadge.textContent = handsPresent ? "Show second hand to connect" : "Waiting for hands...";
            statusBadge.classList.remove('connected');
            
            // Stop instrument sounds immediately when hands are absent
            fingerConfigs.forEach(finger => {
                if (finger.synth) finger.synth.stop();
                finger.isConnected = false;
                finger.prevPos = null;
            });

            if (intensityBar && intensityPercent) {
                intensityBar.style.width = '0%';
                intensityPercent.textContent = '0%';
            }
        }

        canvasCtx.restore();
    }

    // Draw glowing line with visual intensity amplification scaled for high resolutions
    function drawGlowingLine(x1, y1, x2, y2, color, intensity = 0) {
        const scale = Math.max(canvasElement.height / 720, 1);
        const baseWidth = (3.5 + 5.5 * intensity) * scale;
        const glowBlur = (22 + 35 * intensity) * scale;

        canvasCtx.beginPath();
        canvasCtx.moveTo(x1, y1);
        canvasCtx.lineTo(x2, y2);
        
        canvasCtx.strokeStyle = color;
        canvasCtx.lineWidth = baseWidth;
        canvasCtx.shadowBlur = glowBlur;
        canvasCtx.shadowColor = color;
        canvasCtx.lineCap = 'round';
        canvasCtx.stroke();
        
        // Outer aura layer
        canvasCtx.lineWidth = baseWidth * 2.2;
        canvasCtx.strokeStyle = hexToRgba(color, 0.35 + 0.25 * intensity);
        canvasCtx.stroke();
        
        // Deep ambient glow layer
        canvasCtx.lineWidth = baseWidth * 4.2;
        canvasCtx.strokeStyle = hexToRgba(color, 0.15 + 0.15 * intensity);
        canvasCtx.stroke();
        
        // Pulsing electric core when intensity increases
        if (intensity > 0.25) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(x1, y1);
            canvasCtx.lineTo(x2, y2);
            canvasCtx.strokeStyle = '#ffffff';
            canvasCtx.lineWidth = (1.8 + 1.6 * intensity) * scale;
            canvasCtx.shadowBlur = 10 * scale;
            canvasCtx.shadowColor = '#ffffff';
            canvasCtx.stroke();

            // Traveling energy particle
            const time = Date.now() * 0.003;
            const t = (Math.sin(time) + 1) / 2;
            const pulseX = x1 + (x2 - x1) * t;
            const pulseY = y1 + (y2 - y1) * t;

            canvasCtx.beginPath();
            canvasCtx.arc(pulseX, pulseY, (3 + 3.5 * intensity) * scale, 0, 2 * Math.PI);
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.shadowBlur = 14 * scale;
            canvasCtx.shadowColor = color;
            canvasCtx.fill();
        }
        
        canvasCtx.shadowBlur = 0;
    }

    function drawGlowingPoint(x, y, color, intensity = 0) {
        const scale = Math.max(canvasElement.height / 720, 1);
        const radius = (5 + 3 * intensity) * scale;

        // Inner white energy core
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, radius, 0, 2 * Math.PI);
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.shadowBlur = (20 + 20 * intensity) * scale;
        canvasCtx.shadowColor = color;
        canvasCtx.fill();
        
        // Outer colored aura
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, radius * 2.2, 0, 2 * Math.PI);
        canvasCtx.fillStyle = hexToRgba(color, 0.4 + 0.3 * intensity);
        canvasCtx.shadowBlur = 0;
        canvasCtx.fill();
    }

    // High-Fidelity Camera & Pipeline Manager
    class HighQualityCamera {
        constructor(videoEl, options) {
            this.video = videoEl;
            this.options = options || {};
            this.stream = null;
            this.isActive = false;
            this.isProcessing = false;
            this.selectedDeviceId = null;
            this.currentWidth = 1920;
            this.currentHeight = 1080;
        }

        async switchCamera(deviceId) {
            this.selectedDeviceId = deviceId || null;
            await this.start(this.currentWidth, this.currentHeight);
        }

        async start(targetWidth = 1920, targetHeight = 1080) {
            this.currentWidth = targetWidth;
            this.currentHeight = targetHeight;
            this.stop();

            const deviceConstraint = this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined;
            const facingConstraint = this.selectedDeviceId ? undefined : "user";

            const candidates = [
                // Tier 1: High-framerate 1080p/4K Full HD
                {
                    video: {
                        deviceId: deviceConstraint,
                        facingMode: facingConstraint,
                        width: { ideal: targetWidth, min: Math.min(targetWidth, 1280) },
                        height: { ideal: targetHeight, min: Math.min(targetHeight, 720) },
                        frameRate: { ideal: 60, min: 30 }
                    }
                },
                // Tier 2: Ideal target without strict minimums
                {
                    video: {
                        deviceId: deviceConstraint,
                        facingMode: facingConstraint,
                        width: { ideal: targetWidth },
                        height: { ideal: targetHeight },
                        frameRate: { ideal: 60 }
                    }
                },
                // Tier 3: 1080p standard
                {
                    video: {
                        deviceId: deviceConstraint,
                        facingMode: facingConstraint,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                },
                // Tier 4: 720p fallback
                {
                    video: {
                        deviceId: deviceConstraint,
                        facingMode: facingConstraint,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                },
                // Tier 5: Generic camera
                { video: deviceConstraint ? { deviceId: deviceConstraint } : true }
            ];

            let lastErr = null;
            for (const constraints of candidates) {
                try {
                    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                    if (this.stream) break;
                } catch (e) {
                    lastErr = e;
                }
            }

            if (!this.stream) {
                throw lastErr || new Error("Unable to access camera feed");
            }

            this.video.srcObject = this.stream;
            
            await new Promise((resolve) => {
                if (this.video.readyState >= 2) {
                    resolve();
                } else {
                    this.video.onloadedmetadata = () => {
                        this.video.play().then(resolve).catch(resolve);
                    };
                }
            });

            try {
                await this.video.play();
            } catch (e) {}

            this.isActive = true;
            this.startLoop();
            return this.stream;
        }

        async switchResolution(targetWidth, targetHeight) {
            if (this.stream) {
                const track = this.stream.getVideoTracks()[0];
                if (track && track.applyConstraints) {
                    try {
                        await track.applyConstraints({
                            width: { ideal: targetWidth },
                            height: { ideal: targetHeight },
                            frameRate: { ideal: 60 }
                        });
                        return;
                    } catch (e) {
                        console.warn("Dynamic track constraint upgrade failed, restarting stream...", e);
                    }
                }
            }
            await this.start(targetWidth, targetHeight);
        }

        startLoop() {
            const onFrame = this.options.onFrame;
            if (!onFrame) return;

            // Prioritize requestVideoFrameCallback for hardware-synchronized frame cadence
            if ('requestVideoFrameCallback' in this.video) {
                const handleFrame = async () => {
                    if (!this.isActive) return;
                    if (!this.isProcessing) {
                        this.isProcessing = true;
                        try {
                            await onFrame();
                        } catch (err) {
                            console.error("Frame processing error:", err);
                        }
                        this.isProcessing = false;
                    }
                    if (this.isActive) {
                        this.video.requestVideoFrameCallback(handleFrame);
                    }
                };
                this.video.requestVideoFrameCallback(handleFrame);
            } else {
                const handleFrame = async () => {
                    if (!this.isActive) return;
                    if (!this.video.paused && !this.isProcessing) {
                        this.isProcessing = true;
                        try {
                            await onFrame();
                        } catch (err) {
                            console.error("Frame processing error:", err);
                        }
                        this.isProcessing = false;
                    }
                    if (this.isActive) {
                        requestAnimationFrame(handleFrame);
                    }
                };
                requestAnimationFrame(handleFrame);
            }
        }

        stop() {
            this.isActive = false;
            if (this.stream) {
                this.stream.getTracks().forEach(t => t.stop());
                this.stream = null;
            }
        }
    }

    // Initialize MediaPipe Hands
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    // Initialize High-Quality Camera Pipeline with 1080p FHD
    cameraManager = new HighQualityCamera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        }
    });

    cameraManager.start(1920, 1080)
        .then(() => {
            resizeCanvas();
            updateQualityBadge();
            populateCameraList();
        })
        .catch(err => {
            console.error("Camera error:", err);
            loadingEl.innerHTML = `<p style="color: var(--accent-magenta);">Error accessing camera. Please ensure permissions are granted.</p>`;
        });
});
