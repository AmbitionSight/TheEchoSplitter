// —— TTS：音色打分挑选 + 口型脉冲 + 估时兜底（规格 §11.3）——
const MALE = /male|david|george|ryan|daniel|guy|james|arthur|fred|mark|alex/i;
const FEMALE = /female|zira|hazel|susan|aria|jenny|sonia|libby|samantha|victoria|karen|moira|tessa|serena/i;

export function scoreVoice(v, role) {
  const lang = (v.lang || '').toLowerCase();
  if (!lang.startsWith('en')) return -1;
  const name = `${v.name} ${v.voiceURI || ''}`;
  let s = 10;
  if (/gb|uk/.test(lang)) s += 2; else if (/us/.test(lang)) s += 1;
  if (v.localService) s += 2;
  const male = MALE.test(name), female = FEMALE.test(name);
  if (role === 'uncle' || role === 'door') { if (male) s += 4; if (female) s -= 3; }
  if (role === 'child') { if (female) s += 4; if (male) s -= 3; }
  return s;
}

export function pickVoices(list) {
  const best = role => list
    .map(v => ({ v, s: scoreVoice(v, role) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)[0]?.v || null;
  const uncle = best('uncle');
  return { uncle, child: best('child'), door: uncle };
}

export function estimateMs(text, rate = 1) {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  return Math.max(650, (words * 380) / rate);
}

export class Speech {
  constructor(synth = null, makeUtterance = null) {
    this.synth = synth ?? (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
    this.makeUtterance = makeUtterance
      ?? (t => (typeof SpeechSynthesisUtterance !== 'undefined' ? new SpeechSynthesisUtterance(t) : null));
  }
  get ready() { return !!this.synth; }
  speak(text, { voice = null, pitch = 1, rate = 1, onStart = null, onPulse = null } = {}) {
    return new Promise(resolve => {
      const est = estimateMs(text, rate);
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(timer); clearInterval(pulseIv); resolve(); };
      const timer = setTimeout(finish, est + 400); // 兜底：永不低于估算+400ms
      let pulseIv = 0;
      const startPulse = () => {
        if (!onPulse || pulseIv) return;
        pulseIv = setInterval(() => onPulse(), 120);
      };
      let u = null;
      try { u = this.synth ? this.makeUtterance(text) : null; } catch { u = null; }
      if (!u) { if (onStart) onStart(); setTimeout(finish, 50); return; } // 无 TTS：立刻走，绝不卡死
      u.pitch = pitch; u.rate = rate; if (voice) u.voice = voice;
      u.onstart = () => { if (onStart) onStart(); startPulse(); };
      u.onend = finish;
      u.onerror = finish;
      if (onPulse) u.onboundary = () => onPulse();
      try { this.synth.speak(u); if (onStart) onStart(); startPulse(); }
      catch { finish(); }
    });
  }
}

// —— WebAudio 合成音效（规格 §11.4；构造注入 AudioContext 便于测试）——
export class Sfx {
  constructor(ctx = null) {
    this.ctx = ctx ?? (typeof AudioContext !== 'undefined' ? new AudioContext() : null);
  }
  get ok() { return !!this.ctx; }
  tone({ f = 440, f2 = null, type = 'sine', t = 0, dur = 0.2, vol = 0.15, attack = 0.01 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + dur + 0.05);
  }
  noise({ t = 0, dur = 0.3, vol = 0.12, freq = 1000 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, now = c.currentTime + t;
    const len = Math.max(64, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(now); src.stop(now + dur);
  }
  click()   { this.tone({ f: 1800, f2: 900, type: 'triangle', dur: 0.06, vol: 0.1 }); }
  chime()   { [880, 1320, 1760].forEach((f, i) => this.tone({ f, t: i * 0.05, dur: 0.5, vol: 0.09 })); }
  resonate(){ [523, 659, 784, 1046].forEach((f, i) => this.tone({ f, t: i * 0.09, dur: 0.7, vol: 0.13 })); }
  glowTick(){ this.tone({ f: 660, dur: 0.12, vol: 0.06 }); }
  itemIn()  { this.tone({ f: 500, f2: 1000, dur: 0.25, vol: 0.12 }); }
  sweepUp() { this.tone({ f: 200, f2: 1600, dur: 1.1, vol: 0.15, type: 'sawtooth' }); this.noise({ dur: 1.2, vol: 0.05, freq: 2400 }); }
  ignite()  { this.noise({ dur: 0.5, vol: 0.16, freq: 800 }); this.tone({ f: 300, f2: 90, dur: 0.5, vol: 0.09, type: 'triangle' }); }
  water()   { this.noise({ dur: 0.6, vol: 0.11, freq: 1200 }); }
  bloom()   { [1046, 1318, 1568].forEach((f, i) => this.tone({ f, t: 0.3 + i * 0.07, dur: 0.4, vol: 0.08 })); }
  hatPuff() { this.tone({ f: 300, f2: 150, dur: 0.18, vol: 0.13, type: 'triangle' }); }
  laugh()   { [500, 430, 500, 430].forEach((f, i) => this.tone({ f, dur: 0.09, t: i * 0.1, vol: 0.09, type: 'square' })); }
  clack()   { this.tone({ f: 120, dur: 0.05, vol: 0.16, type: 'square' }); setTimeout(() => this.tone({ f: 100, dur: 0.05, vol: 0.13, type: 'square' }), 90); }
  mutter()  { this.tone({ f: 90, f2: 60, dur: 0.5, vol: 0.11, type: 'sawtooth' }); }
  creak()   { this.tone({ f: 140, f2: 60, dur: 1.4, vol: 0.11, type: 'sawtooth' }); }
  choir()   { [261, 329, 392, 523].forEach((f, i) => this.tone({ f, t: i * 0.12, dur: 2.2, vol: 0.07 })); }
  meow()    { this.tone({ f: 700, f2: 1100, dur: 0.18, vol: 0.11 }); this.tone({ f: 1100, f2: 600, t: 0.18, dur: 0.3, vol: 0.09 }); }
  crackle() { for (let i = 0; i < 3; i++) this.noise({ t: Math.random() * 0.4, dur: 0.05, vol: 0.04, freq: 2500 }); }
}
