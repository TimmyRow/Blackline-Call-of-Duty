export class Sound {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private listener={x:0,y:0,z:0,yaw:0};
  private noiseBuffers=new Map<number,AudioBuffer>();
  private shotVoices=0;
  private ambience:GainNode|null=null;
  private ambienceFilter:BiquadFilterNode|null=null;
  setWeather(rain:number,wind:number){if(!this.ctx)return;const t=this.ctx.currentTime;this.ambience?.gain.setTargetAtTime(.2+Math.max(0,Math.min(1,rain))*.8+Math.max(0,Math.min(1,wind))*.2,t,1.5);this.ambienceFilter?.frequency.setTargetAtTime(240+rain*850+wind*180,t,1.5);}
  setListener(position:{x:number,y:number,z:number},yaw:number){this.listener={...position,yaw};}
  shotAt(position:{x:number,y:number,z:number}){
    const dx=position.x-this.listener.x,dy=position.y-this.listener.y,dz=position.z-this.listener.z,d=Math.hypot(dx,dy,dz);
    if(d>130||this.shotVoices>=8)return;
    const pan=Math.max(-1,Math.min(1,(dx*Math.cos(this.listener.yaw)-dz*Math.sin(this.listener.yaw))/Math.max(4,d)));
    const gain=.45/(1+d*d/850);this.noise(.26,gain,Math.max(650,2600-d*18),pan);this.tone(95,.13,gain*.6,40,pan);
    this.shotVoices++;window.setTimeout(()=>{this.shotVoices--;},270);
  }
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .32; this.master.connect(this.ctx.destination);
    const buffer = this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate);
    const data = buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.075;
    const source = this.ctx.createBufferSource(); source.buffer=buffer; source.loop=true;
    const filter=this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=850;const ambience=this.ctx.createGain();ambience.gain.value=.5;this.ambience=ambience;this.ambienceFilter=filter;source.connect(filter);filter.connect(ambience);ambience.connect(this.master);source.start();
  }
  toggle() { this.muted=!this.muted; if(this.master) this.master.gain.value=this.muted?0:.32; }
  noise(duration:number, volume:number, frequency:number, pan=0) {
    if(!this.ctx||!this.master) return;
    const t=this.ctx.currentTime;let buffer=this.noiseBuffers.get(duration);
    if(!buffer){buffer=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*duration),this.ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*6);this.noiseBuffers.set(duration,buffer);}
    const src=this.ctx.createBufferSource(), filter=this.ctx.createBiquadFilter(), gain=this.ctx.createGain();
    src.buffer=buffer; filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,t);
    const stereo=this.ctx.createStereoPanner();stereo.pan.value=pan;src.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(this.master);src.start();src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect();};
  }
  tone(freq:number,duration:number,volume=.2,end=80,pan=0) {
    if(!this.ctx||!this.master)return; const t=this.ctx.currentTime,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);const stereo=this.ctx.createStereoPanner();stereo.pan.value=pan;osc.connect(gain);gain.connect(stereo);stereo.connect(this.master);osc.start();osc.stop(t+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();stereo.disconnect();};
  }
  shot(distant=false){this.noise(.26,distant?.35:1.1,distant?850:3200);this.tone(distant?90:150,.13,distant?.2:.6,40);}
  hit(){this.tone(1200,.055,.13,550);}
  reload(){this.noise(.15,.3,2800);this.tone(430,.08,.09,200);}
  step(){this.noise(.15,.18,480);}
  explosion(){this.noise(1.1,1.6,900);this.tone(85,.7,1.2,25);}
}
