export class Sound {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .32; this.master.connect(this.ctx.destination);
    const buffer = this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate);
    const data = buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.075;
    const source = this.ctx.createBufferSource(); source.buffer=buffer; source.loop=true;
    const filter=this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=850; source.connect(filter); filter.connect(this.master); source.start();
  }
  toggle() { this.muted=!this.muted; if(this.master) this.master.gain.value=this.muted?0:.32; }
  noise(duration:number, volume:number, frequency:number) {
    if(!this.ctx||!this.master) return;
    const t=this.ctx.currentTime, buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*duration,this.ctx.sampleRate);
    const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*6);
    const src=this.ctx.createBufferSource(), filter=this.ctx.createBiquadFilter(), gain=this.ctx.createGain();
    src.buffer=buffer; filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,t);
    src.connect(filter);filter.connect(gain);gain.connect(this.master);src.start();src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
  }
  tone(freq:number,duration:number,volume=.2,end=80) {
    if(!this.ctx||!this.master)return; const t=this.ctx.currentTime,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(this.master);osc.start();osc.stop(t+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  shot(distant=false){this.noise(.26,distant?.35:1.1,distant?850:3200);this.tone(distant?90:150,.13,distant?.2:.6,40);}
  hit(){this.tone(1200,.055,.13,550);}
  reload(){this.noise(.15,.3,2800);this.tone(430,.08,.09,200);}
  step(){this.noise(.15,.18,480);}
  explosion(){this.noise(1.1,1.6,900);this.tone(85,.7,1.2,25);}
}
