/**
 * audio.js
 * Sistem Audio Synthesizer (Web Audio API) & Text-To-Speech (TTS)
 * Tidak memerlukan file mp3 eksternal, bekerja 100% lokal & instan.
 */

class StreamAudio {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = localStorage.getItem('sound_enabled') !== 'false';
    this.ttsEnabled = localStorage.getItem('tts_enabled') === 'true';
    this.volume = parseFloat(localStorage.getItem('sound_volume') || '0.7');
    this.ttsVolume = parseFloat(localStorage.getItem('tts_volume') || '0.8');
    this.ttsRate = parseFloat(localStorage.getItem('tts_rate') || '1.1');
    this.selectedVoice = null;

    this.initTTS();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  initTTS() {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Cari suara bahasa Indonesia atau fallback ke Google/system voice
        this.selectedVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID')) || voices[0];
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  setSoundEnabled(val) {
    this.soundEnabled = !!val;
    localStorage.setItem('sound_enabled', this.soundEnabled);
    if (!this.soundEnabled && this.audioCtx && this.audioCtx.state === 'running') {
      try { this.audioCtx.suspend(); } catch (e) {}
    } else if (this.soundEnabled && this.audioCtx && this.audioCtx.state === 'suspended') {
      try { this.audioCtx.resume(); } catch (e) {}
    }
  }

  setTtsEnabled(val) {
    this.ttsEnabled = !!val;
    localStorage.setItem('tts_enabled', this.ttsEnabled);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('sound_volume', this.volume);
  }

  // Play synthetic tone sequence with envelope
  playTone(frequencies, type = 'sine', duration = 0.15, interval = 0.08) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startTime = ctx.currentTime + (idx * interval);
        const stopTime = startTime + duration;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3 * this.volume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(stopTime);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Nada Notifikasi Hadiah TikTok (Cheerful Arcade Chime)
  playGiftAlert() {
    this.playTone([523.25, 659.25, 783.99, 1046.50, 1318.51], 'triangle', 0.25, 0.07);
  }

  // Nada Notifikasi YouTube Superchat (Grand Fanfare)
  playSuperChatAlert() {
    this.playTone([440, 554.37, 659.25, 880, 1108.73], 'square', 0.3, 0.09);
  }

  // Nada Notifikasi Twitch Sub / Bits (Power-up)
  playSubAlert() {
    this.playTone([392.00, 523.25, 659.25, 783.99], 'sine', 0.22, 0.08);
  }

  // Nada Chat Biasa (Soft subtle blip)
  playChatBlip() {
    if (!this.soundEnabled) return;
    this.playTone([800], 'sine', 0.04, 0);
  }

  // Text to Speech
  speak(text) {
    if (!this.ttsEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // batalkan antrian yang menumpuk
      const cleanText = text.replace(/https?:\/\/\S+/gi, '').substring(0, 100);
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.volume = this.ttsVolume;
      utter.rate = this.ttsRate;
      if (this.selectedVoice) {
        utter.voice = this.selectedVoice;
      }
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  }
}

window.streamAudio = new StreamAudio();
