/**
 * audio.js
 * Mode Hening (Silent Mode): Audio synthesizer & TTS dinonaktifkan sepenuhnya.
 */

// Batalkan dan matikan Web Speech TTS jika ada
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak = function() {};
  } catch (e) {}
}

// Matikan constructor Audio jika ada
if (typeof window !== 'undefined') {
  try {
    window.Audio = function() {
      return {
        play: () => Promise.resolve(),
        pause: () => {},
        addEventListener: () => {}
      };
    };
  } catch (e) {}
}

class StreamAudio {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = false;
    this.ttsEnabled = false;
    this.volume = 0;
  }

  setSoundEnabled() {}
  setTtsEnabled() {}
  setVolume() {}
  playTone() {}
  playGiftAlert() {}
  playSuperChatAlert() {}
  playSubAlert() {}
  playRedeemAlert() {}
  playChatBlip() {}
  speak() {}
}

window.streamAudio = new StreamAudio();
