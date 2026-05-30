// Bbit Adventure - Core Game Script

// --- Constants & Config ---
const TILE_SIZE = 40;
const GRAVITY = 0.5;
const FRICTION = 0.85;
const PLAYER_SPEED = 5;
const JUMP_FORCE = -10;
const DASH_FORCE = 15;
const DASH_CD = 90; // Frame count (1.5 seconds at 60 FPS)
const DASH_DURATION = 10; // Frames of active dash

// --- Map Definition ---
// Legend: 
// '#' = Solid Block, '?' = Item Block (Hits from below), 'D' = Depleted Item Block
// '^' = Laser Spike, '*' = Data Bit (Coin), 'h' = Core Battery (HP)
// 'e' = Walking Drone (Enemy), 'P' = Victory Portal, ' ' = Empty
const LEVEL_1 = [
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                 *  *  *                                  *  *                                                          ",
  "               ###?#??####                               ######                                   ?  ?                  ",
  "                                                                                                #######                 ",
  "                                     ###   ###                                                                          ",
  "          ##                        ##?## ##?##                                 ###    ###                              ",
  "         ####     **               #############        *   *                  #####  #####                 P           ",
  "        ######   ^^^^              #############       #######                ###############               #           ",
  "################################################   ### ####### ###   ##########  ^^^^^^^^^  ############################",
  "################################################   ### ####### ###   ##########  #########  ############################"
];

// --- Keyboard Input Handler ---
class InputHandler {
  constructor() {
    this.keys = {};
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
    });
  }

  isDown(key) {
    return !!this.keys[key.toLowerCase()];
  }
}

// --- Web Audio 8-bit Synthesizer ---
class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmInterval = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playJump() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playShoot() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "square";
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playCoin() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    
    const now = this.ctx.currentTime;
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Fast 2-note digital chime
    playNote(587.33, now, 0.07); // D5
    playNote(880.00, now + 0.07, 0.15); // A5
  }

  playHitBlock() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playExplosion() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(350, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.25);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playHurt() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playVictory() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((n, i) => {
      playNote(n, now + i * 0.1, 0.25);
    });
  }

  startBGM() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    if (this.bgmInterval) return;

    let beat = 0;
    // Retro simple 8-bit loop tune
    const melody = [
      261.63, 293.66, 329.63, 349.23, 392.00, 392.00, 440.00, 392.00,
      349.23, 329.63, 261.63, 293.66, 329.63, 329.63, 293.66, 293.66
    ]; 
    
    const bass = [
      130.81, 130.81, 164.81, 164.81, 196.00, 196.00, 196.00, 196.00,
      174.61, 174.61, 164.81, 164.81, 146.83, 146.83, 130.81, 196.00
    ]; 

    this.bgmInterval = setInterval(() => {
      if (this.isMuted || !this.ctx || this.ctx.state === "suspended") return;
      
      const now = this.ctx.currentTime;
      const index = beat % melody.length;
      
      // Bass Oscillator
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = "triangle";
      bassOsc.frequency.setValueAtTime(bass[index], now);
      bassGain.gain.setValueAtTime(0.08, now);
      bassGain.gain.exponentialRampToValueAtTime(0.005, now + 0.22);
      bassOsc.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.25);

      // Melody Oscillator
      if (beat % 2 === 0) {
        const melOsc = this.ctx.createOscillator();
        const melGain = this.ctx.createGain();
        melOsc.type = "square";
        melOsc.frequency.setValueAtTime(melody[index], now);
        melGain.gain.setValueAtTime(0.02, now);
        melGain.gain.exponentialRampToValueAtTime(0.002, now + 0.25);
        melOsc.connect(melGain);
        melGain.connect(this.ctx.destination);
        melOsc.start(now);
        melOsc.stop(now + 0.3);
      }
      
      beat++;
    }, 250);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

// --- Particle System ---
class Particle {
  constructor(x, y, color, size, vx, vy, life, decay = 0.05) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.life = life; // alpha value
    this.decay = decay;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw(ctx, camera) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - camera.x, this.y - camera.y, this.size, this.size);
    ctx.restore();
  }
}

// --- Projectile (Laser Bullet) ---
class Projectile {
  constructor(x, y, dirX) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 6;
    this.speed = 12;
    this.vx = dirX * this.speed;
    this.color = "#ff00ea"; // Neon Purple/Pink
    this.active = true;
  }

  update(worldWidth) {
    this.x += this.vx;
    if (this.x < 0 || this.x > worldWidth) {
      this.active = false;
    }
  }

  draw(ctx, camera) {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
    ctx.restore();
  }
}

// --- Patrol Enemy ---
class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 30;
    this.vx = -1.5;
    this.vy = 0;
    this.hp = 2;
    this.color = "#ff7700"; // Neon Orange
    this.patrolRange = 120;
    this.startX = x;
  }

  update(map) {
    this.x += this.vx;

    // Boundary check / Wall collision
    const checkX = this.vx > 0 ? this.x + this.width : this.x;
    const tileX = Math.floor(checkX / TILE_SIZE);
    const tileY1 = Math.floor(this.y / TILE_SIZE);
    const tileY2 = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    if (map.isSolid(tileX, tileY1) || map.isSolid(tileX, tileY2)) {
      this.vx = -this.vx;
      this.x += this.vx;
    }

    if (Math.abs(this.x - this.startX) > this.patrolRange) {
      this.vx = -this.vx;
      this.x += this.vx;
    }
  }

  draw(ctx, camera, time) {
    const pulse = Math.sin(time * 0.1) * 5;
    ctx.save();
    ctx.shadowBlur = 15 + pulse;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
    ctx.strokeRect(this.x - camera.x, this.y - camera.y, this.width, this.height);

    ctx.fillStyle = "#ff0000";
    const eyeOffset = this.vx > 0 ? 20 : 5;
    ctx.fillRect(this.x + eyeOffset - camera.x, this.y + 8 - camera.y, 6, 6);
    ctx.restore();
  }
}

// --- Game Map Layer ---
class GameMap {
  constructor(layout) {
    this.layout = layout;
    this.rows = layout.length;
    this.cols = layout[0].length;
    this.width = this.cols * TILE_SIZE;
    this.height = this.rows * TILE_SIZE;
    
    // Mutable grid
    this.grid = [];
    this.collectibles = [];
    this.portal = null;
    this.enemies = [];
    this.blockBounces = []; 

    this.parseLayout();
  }

  parseLayout() {
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const char = this.layout[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        this.grid[r][c] = char;

        if (char === '*') {
          this.grid[r][c] = ' '; 
          this.collectibles.push({ x: x + 12, y: y + 12, width: 16, height: 16, type: 'coin', vx: 0, vy: 0, active: true });
        } else if (char === 'h') {
          this.grid[r][c] = ' ';
          this.collectibles.push({ x: x + 10, y: y + 10, width: 20, height: 20, type: 'health', vx: 0, vy: 0, active: true });
        } else if (char === 'P') {
          this.grid[r][c] = ' ';
          this.portal = { x: x, y: y - TILE_SIZE, width: 40, height: 80 };
        } else if (char === 'e') {
          this.grid[r][c] = ' ';
          this.enemies.push(new Enemy(x, y + (TILE_SIZE - 30)));
        }
      }
    }
  }

  isSolid(tileX, tileY) {
    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) {
      return false;
    }
    const val = this.grid[tileY][tileX];
    return val === '#' || val === '?' || val === 'D';
  }

  isSpike(tileX, tileY) {
    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) {
      return false;
    }
    return this.grid[tileY][tileX] === '^';
  }

  checkBlockHit(tileX, tileY, player, spawnParticles, audio) {
    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) return;
    
    if (this.grid[tileY][tileX] === '?') {
      this.grid[tileY][tileX] = 'D';

      // Play Sound
      if (audio) audio.playHitBlock();

      this.blockBounces.push({
        r: tileY,
        c: tileX,
        offsetY: 0,
        speed: -4,
        maxOffset: -8
      });

      const itemType = Math.random() < 0.2 ? 'health' : 'coin';
      const itemWidth = itemType === 'health' ? 20 : 16;
      const itemHeight = itemType === 'health' ? 20 : 16;

      const px = tileX * TILE_SIZE + (TILE_SIZE - itemWidth) / 2;
      const py = tileY * TILE_SIZE - itemHeight - 2;

      this.collectibles.push({
        x: px,
        y: py,
        width: itemWidth,
        height: itemHeight,
        type: itemType,
        vx: (Math.random() - 0.5) * 3,
        vy: -6, 
        active: true
      });

      spawnParticles(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, "#ffd700", 10, 4);
    }
  }

  updateBounces() {
    for (let i = this.blockBounces.length - 1; i >= 0; i--) {
      const b = this.blockBounces[i];
      b.offsetY += b.speed;
      if (b.speed < 0 && b.offsetY <= b.maxOffset) {
        b.speed = 2; 
      } else if (b.speed > 0 && b.offsetY >= 0) {
        b.offsetY = 0;
        this.blockBounces.splice(i, 1);
      }
    }
  }

  draw(ctx, camera, time) {
    ctx.save();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const char = this.grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (x + TILE_SIZE < camera.x || x > camera.x + camera.width) continue;

        let offsetY = 0;
        const activeBounce = this.blockBounces.find(b => b.r === r && b.c === c);
        if (activeBounce) {
          offsetY = activeBounce.offsetY;
        }

        const renderY = y - camera.y + offsetY;

        if (char === '#') {
          ctx.fillStyle = "#111827";
          ctx.fillRect(x - camera.x, renderY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "rgba(0, 243, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x - camera.x, renderY, TILE_SIZE, TILE_SIZE);

          ctx.strokeStyle = "rgba(0, 243, 255, 0.15)";
          ctx.beginPath();
          ctx.moveTo(x - camera.x + 5, renderY + 5);
          ctx.lineTo(x - camera.x + TILE_SIZE - 5, renderY + TILE_SIZE - 5);
          ctx.stroke();

        } else if (char === '?') {
          const pulse = Math.abs(Math.sin(time * 0.08)) * 10;
          ctx.shadowBlur = 10 + pulse;
          ctx.shadowColor = "#ffd700";
          ctx.fillStyle = "#cca200";
          ctx.fillRect(x - camera.x, renderY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - camera.x, renderY, TILE_SIZE, TILE_SIZE);

          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 16px 'Orbitron', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("?", x + TILE_SIZE / 2 - camera.x, renderY + TILE_SIZE / 2 + 6);

        } else if (char === 'D') {
          ctx.fillStyle = "#1f2937";
          ctx.fillRect(x - camera.x, renderY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - camera.x, renderY, TILE_SIZE, TILE_SIZE);

          ctx.fillStyle = "rgba(100, 116, 139, 0.6)";
          ctx.fillRect(x + TILE_SIZE / 2 - 3 - camera.x, renderY + TILE_SIZE / 2 - 3, 6, 6);

        } else if (char === '^') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#ff0055";
          ctx.fillStyle = "#ff0055";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.moveTo(x - camera.x, renderY + TILE_SIZE);
          ctx.lineTo(x + TILE_SIZE / 2 - camera.x, renderY + 10);
          ctx.lineTo(x + TILE_SIZE - camera.x, renderY + TILE_SIZE);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    this.collectibles.forEach(item => {
      if (!item.active) return;
      ctx.save();
      if (item.type === 'coin') {
        const floatOffset = (item.vx === 0 && item.vy === 0) ? Math.sin(time * 0.1 + item.x) * 4 : 0;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00f3ff";
        ctx.fillStyle = "#00f3ff";
        
        ctx.beginPath();
        ctx.moveTo(item.x + item.width / 2 - camera.x, item.y + floatOffset - camera.y);
        ctx.lineTo(item.x + item.width - camera.x, item.y + item.height / 2 + floatOffset - camera.y);
        ctx.lineTo(item.x + item.width / 2 - camera.x, item.y + item.height + floatOffset - camera.y);
        ctx.lineTo(item.x - camera.x, item.y + item.height / 2 + floatOffset - camera.y);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'health') {
        const pulse = (item.vx === 0 && item.vy === 0) ? Math.abs(Math.sin(time * 0.08)) * 0.3 + 0.85 : 1.0;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00ff66";
        ctx.fillStyle = "#00ff66";

        const cx = item.x + item.width / 2 - camera.x;
        const cy = item.y + item.height / 2 - camera.y;
        const size = (item.width / 2) * pulse;

        ctx.fillRect(cx - size, cy - size / 3, size * 2, size * 2 / 3);
        ctx.fillRect(cx - size / 3, cy - size, size * 2 / 3, size * 2);
      }
      ctx.restore();
    });

    if (this.portal) {
      ctx.save();
      const wave = Math.sin(time * 0.05) * 8;
      ctx.shadowBlur = 25 + wave;
      ctx.shadowColor = "#bd00ff";

      const grad = ctx.createLinearGradient(
        this.portal.x - camera.x, this.portal.y - camera.y,
        this.portal.x + this.portal.width - camera.x, this.portal.y + this.portal.height - camera.y
      );
      grad.addColorStop(0, "#bd00ff");
      grad.addColorStop(0.5, "#ff00ea");
      grad.addColorStop(1, "#00f3ff");

      ctx.fillStyle = grad;
      ctx.fillRect(this.portal.x - camera.x, this.portal.y - camera.y, this.portal.width, this.portal.height);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.portal.x + 5 - camera.x,
        this.portal.y + 5 - camera.y,
        this.portal.width - 10,
        this.portal.height - 10
      );
      ctx.restore();
    }
  }
}

// --- Player (Bbit) ---
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 28;
    this.height = 28;
    this.vx = 0;
    this.vy = 0;
    this.speed = PLAYER_SPEED;
    this.grounded = false;

    this.hp = 100;
    this.score = 0;

    this.jumpCount = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = 1;
    this.shootCooldown = 0;
    this.invulnFrames = 0;

    this.ghostTrail = [];
  }

  update(input, map, spawnParticles, spawnProjectile, audio) {
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.invulnFrames > 0) this.invulnFrames--;

    if (this.dashTimer > 0) {
      this.vx = this.dashDir * DASH_FORCE;
      this.vy = 0;
      this.dashTimer--;

      this.ghostTrail.push({ x: this.x, y: this.y, opacity: 0.7 });
      if (this.ghostTrail.length > 5) this.ghostTrail.shift();

      spawnParticles(this.x + this.width / 2, this.y + this.height / 2, "#00f3ff", 2, 4);

      this.moveX(this.vx, map);
      return;
    }

    this.ghostTrail.forEach(t => t.opacity -= 0.1);
    this.ghostTrail = this.ghostTrail.filter(t => t.opacity > 0);

    let dir = 0;
    if (input.isDown("a") || input.isDown("arrowleft")) {
      dir = -1;
      this.dashDir = -1;
    } else if (input.isDown("d") || input.isDown("arrowright")) {
      dir = 1;
      this.dashDir = 1;
    }

    if (dir !== 0) {
      this.vx += dir * 0.8;
      if (Math.abs(this.vx) > this.speed) {
        this.vx = dir * this.speed;
      }
      if (this.grounded && Math.random() < 0.2) {
        spawnParticles(this.x + this.width / 2 - dir * 10, this.y + this.height, "rgba(0, 243, 255, 0.4)", 4, 1);
      }
    } else {
      this.vx *= FRICTION;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    const jumpPressed = input.isDown(" ") || input.isDown("w") || input.isDown("arrowup");
    if (jumpPressed) {
      if (!this.wasJumpPressed) {
        this.jump(audio);
      }
      this.wasJumpPressed = true;
    } else {
      this.wasJumpPressed = false;
    }

    const dashPressed = input.isDown("shift");
    if (dashPressed && this.dashCooldown === 0 && this.dashTimer === 0) {
      this.dash(audio);
    }

    const shootPressed = input.isDown("f") || input.isDown("k");
    if (shootPressed && this.shootCooldown === 0) {
      this.shoot(spawnProjectile, audio);
    }

    this.vy += GRAVITY;
    if (this.vy > 12) this.vy = 12;

    this.moveX(this.vx, map);
    this.moveY(this.vy, map, spawnParticles, audio);

    const pxLeft = Math.floor(this.x / TILE_SIZE);
    const pxRight = Math.floor((this.x + this.width) / TILE_SIZE);
    const pyBottom = Math.floor((this.y + this.height) / TILE_SIZE);

    if (map.isSpike(pxLeft, pyBottom) || map.isSpike(pxRight, pyBottom)) {
      this.takeDamage(20, spawnParticles, audio);
    }
  }

  jump(audio) {
    if (this.grounded) {
      this.vy = JUMP_FORCE;
      this.grounded = false;
      this.jumpCount = 1;
      if (audio) audio.playJump();
    } else if (this.jumpCount < 2) {
      this.vy = JUMP_FORCE * 0.9;
      this.jumpCount = 2;
      if (audio) audio.playJump();
    }
  }

  dash(audio) {
    this.dashTimer = DASH_DURATION;
    this.dashCooldown = DASH_CD;
    if (audio) audio.playJump(); // Dash sweeps up
  }

  shoot(spawnProjectile, audio) {
    this.shootCooldown = 15;
    spawnProjectile(this.x + (this.dashDir > 0 ? this.width : -10), this.y + this.height / 2 - 3, this.dashDir);
    if (audio) audio.playShoot();
  }

  takeDamage(amount, spawnParticles, audio) {
    if (this.invulnFrames > 0 || this.dashTimer > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnFrames = 40;

    this.vy = -4;
    this.vx = -this.dashDir * 4;

    spawnParticles(this.x + this.width / 2, this.y + this.height / 2, "#ff0055", 6, 12);
    if (audio) audio.playHurt();
  }

  moveX(vx, map) {
    this.x += vx;
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > map.width) this.x = map.width - this.width;

    const tileY1 = Math.floor(this.y / TILE_SIZE);
    const tileY2 = Math.floor((this.y + this.height - 0.1) / TILE_SIZE);

    if (vx > 0) {
      const tileX = Math.floor((this.x + this.width) / TILE_SIZE);
      if (map.isSolid(tileX, tileY1) || map.isSolid(tileX, tileY2)) {
        this.x = tileX * TILE_SIZE - this.width;
        this.vx = 0;
      }
    } else if (vx < 0) {
      const tileX = Math.floor(this.x / TILE_SIZE);
      if (map.isSolid(tileX, tileY1) || map.isSolid(tileX, tileY2)) {
        this.x = (tileX + 1) * TILE_SIZE;
        this.vx = 0;
      }
    }
  }

  moveY(vy, map, spawnParticles, audio) {
    this.y += vy;
    const tileX1 = Math.floor(this.x / TILE_SIZE);
    const tileX2 = Math.floor((this.x + this.width - 0.1) / TILE_SIZE);

    if (vy > 0) {
      const tileY = Math.floor((this.y + this.height) / TILE_SIZE);
      if (map.isSolid(tileX1, tileY) || map.isSolid(tileX2, tileY)) {
        this.y = tileY * TILE_SIZE - this.height;
        this.vy = 0;
        this.grounded = true;
        this.jumpCount = 0;
      } else {
        this.grounded = false;
      }
    } else if (vy < 0) {
      const tileY = Math.floor(this.y / TILE_SIZE);
      if (map.isSolid(tileX1, tileY) || map.isSolid(tileX2, tileY)) {
        this.y = (tileY + 1) * TILE_SIZE;
        this.vy = 0;

        map.checkBlockHit(tileX1, tileY, this, spawnParticles, audio);
        map.checkBlockHit(tileX2, tileY, this, spawnParticles, audio);
      }
    }
  }

  draw(ctx, camera, time) {
    this.ghostTrail.forEach((g) => {
      ctx.save();
      ctx.globalAlpha = g.opacity;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00f3ff";
      ctx.fillStyle = "rgba(0, 243, 255, 0.4)";
      ctx.fillRect(g.x - camera.x, g.y - camera.y, this.width, this.height);
      ctx.restore();
    });

    ctx.save();
    
    if (this.invulnFrames > 0 && Math.floor(this.invulnFrames / 4) % 2 === 0) {
      ctx.restore();
      return;
    }

    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00f3ff";
    ctx.fillStyle = "#00f3ff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
    ctx.strokeRect(this.x - camera.x, this.y - camera.y, this.width, this.height);

    ctx.fillStyle = "#0a0f1e";
    const ey1 = this.y + 8 - camera.y;
    const exOffset = this.dashDir > 0 ? 10 : 4;
    ctx.fillRect(this.x + exOffset - camera.x, ey1, 4, 8);
    ctx.fillRect(this.x + exOffset + 8 - camera.x, ey1, 4, 8);

    ctx.restore();
  }
}

// --- Main Game Loop Controller ---
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    
    this.input = new InputHandler();
    this.audio = new AudioManager();

    this.state = "START";
    this.time = 0;

    this.particles = [];
    this.projectiles = [];
    this.camera = { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height };

    this.initUI();
    this.initZoom();
    this.loop();
  }

  initUI() {
    document.getElementById("startButton").addEventListener("click", () => this.startGame());
    document.getElementById("restartButton").addEventListener("click", () => this.restartGame());
    document.getElementById("nextLevelButton").addEventListener("click", () => this.restartGame());

    // Mute button setup
    const muteBtn = document.getElementById("muteBtn");
    muteBtn.addEventListener("click", () => {
      this.audio.isMuted = !this.audio.isMuted;
      if (this.audio.isMuted) {
        muteBtn.innerText = "SOUND: OFF";
        muteBtn.classList.remove("active");
        this.audio.stopBGM();
      } else {
        muteBtn.innerText = "SOUND: ON";
        muteBtn.classList.add("active");
        if (this.state === "PLAYING") {
          this.audio.startBGM();
        }
      }
    });
    // Set active style for sound on
    muteBtn.classList.add("active");
  }

  initZoom() {
    const wrapper = document.querySelector(".canvas-wrapper");
    const container = document.querySelector(".game-stage-wrapper");
    
    const buttons = {
      zoom1: document.getElementById("zoom1"),
      zoom125: document.getElementById("zoom125"),
      zoom15: document.getElementById("zoom15"),
      zoomAuto: document.getElementById("zoomAuto")
    };

    const setZoom = (scale, type) => {
      Object.keys(buttons).forEach(k => {
        if (k !== 'muteBtn') buttons[k]?.classList.remove("active");
      });
      buttons[type]?.classList.add("active");

      if (this.resizeListener) {
        window.removeEventListener("resize", this.resizeListener);
        this.resizeListener = null;
      }

      if (scale === "auto") {
        const handleResize = () => {
          const winWidth = window.innerWidth;
          const targetWidth = 840;
          let factor = Math.max(0.65, Math.min(1.5, winWidth / targetWidth));
          wrapper.style.transform = `scale(${factor})`;
          if (container) container.style.height = `${480 * factor}px`;
        };
        this.resizeListener = handleResize;
        window.addEventListener("resize", handleResize);
        handleResize();
      } else {
        wrapper.style.transform = `scale(${scale})`;
        if (container) container.style.height = `${480 * scale}px`;
      }
    };

    buttons.zoom1?.addEventListener("click", () => setZoom(1, "zoom1"));
    buttons.zoom125?.addEventListener("click", () => setZoom(1.25, "zoom125"));
    buttons.zoom15?.addEventListener("click", () => setZoom(1.5, "zoom15"));
    buttons.zoomAuto?.addEventListener("click", () => setZoom("auto", "zoomAuto"));

    setZoom(1, "zoom1");
  }

  startGame() {
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("startScreen").classList.remove("active");
    document.getElementById("hud").classList.remove("hidden");

    this.map = new GameMap(LEVEL_1);
    this.player = new Player(100, 300);
    this.projectiles = [];
    this.particles = [];

    this.state = "PLAYING";

    // Play BGM & Sound setup
    this.audio.init();
    this.audio.startBGM();
  }

  restartGame() {
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("victoryScreen").classList.add("hidden");
    this.startGame();
  }

  triggerGameOver() {
    this.state = "GAMEOVER";
    document.getElementById("finalScore").innerText = this.player.score;
    document.getElementById("gameOverScreen").classList.remove("hidden");
    document.getElementById("gameOverScreen").classList.add("active");

    this.audio.stopBGM();
    this.audio.playHurt();
  }

  triggerVictory() {
    this.state = "VICTORY";
    document.getElementById("victoryScore").innerText = this.player.score;
    document.getElementById("victoryScreen").classList.remove("hidden");
    document.getElementById("victoryScreen").classList.add("active");

    this.audio.stopBGM();
    this.audio.playVictory();
  }

  spawnParticles = (x, y, color, count = 5, spread = 3) => {
    for (let i = 0; i < count; i++) {
      const size = Math.random() * 4 + 2;
      const vx = (Math.random() - 0.5) * spread;
      const vy = (Math.random() - 0.5) * spread;
      const life = 1.0;
      this.particles.push(new Particle(x, y, color, size, vx, vy, life, 0.02 + Math.random() * 0.02));
    }
  }

  spawnProjectile = (x, y, dir) => {
    this.projectiles.push(new Projectile(x, y, dir));
  }

  update() {
    if (this.state !== "PLAYING") return;
    this.time++;

    this.player.update(this.input, this.map, this.spawnParticles, this.spawnProjectile, this.audio);
    this.map.updateBounces();

    if (this.player.y > this.map.height) {
      this.player.hp = 0;
    }

    if (this.player.hp <= 0) {
      this.triggerGameOver();
      return;
    }

    const targetCamX = this.player.x - this.camera.width / 2 + this.player.width / 2;
    this.camera.x += (targetCamX - this.camera.x) * 0.1;
    this.camera.x = Math.max(0, Math.min(this.camera.x, this.map.width - this.camera.width));

    this.projectiles.forEach((p) => {
      p.update(this.map.width);

      const tx = Math.floor(p.x / TILE_SIZE);
      const ty = Math.floor(p.y / TILE_SIZE);
      if (this.map.isSolid(tx, ty)) {
        p.active = false;
        this.spawnParticles(p.x, p.y, p.color, 4, 2);
      }

      this.map.enemies.forEach((enemy) => {
        if (enemy.hp > 0 && this.rectIntersect(p, enemy)) {
          p.active = false;
          enemy.hp--;
          this.spawnParticles(p.x, p.y, "#ffffff", 8, 3);
          
          if (this.audio) this.audio.playExplosion();

          if (enemy.hp <= 0) {
            this.player.score += 200;
            this.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, 15, 6);
          }
        }
      });
    });
    this.projectiles = this.projectiles.filter((p) => p.active);

    this.map.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      enemy.update(this.map);

      if (this.rectIntersect(this.player, enemy)) {
        this.player.takeDamage(15, this.spawnParticles, this.audio);
      }
    });

    this.map.collectibles.forEach((item) => {
      if (!item.active) return;

      if (item.vx !== 0 || item.vy !== 0) {
        item.vy += 0.3;
        item.x += item.vx;
        item.y += item.vy;

        const cx1 = Math.floor(item.x / TILE_SIZE);
        const cx2 = Math.floor((item.x + item.width) / TILE_SIZE);
        const cy = Math.floor((item.y + item.height) / TILE_SIZE);

        if (this.map.isSolid(cx1, cy) || this.map.isSolid(cx2, cy)) {
          item.y = cy * TILE_SIZE - item.height;
          item.vy = -item.vy * 0.4;
          item.vx *= 0.6;
          if (Math.abs(item.vy) < 1.0) {
            item.vy = 0;
            item.vx = 0;
          }
        }
      }

      if (this.rectIntersect(this.player, item)) {
        item.active = false;
        
        if (this.audio) this.audio.playCoin();

        if (item.type === 'coin') {
          this.player.score += 100;
          this.spawnParticles(item.x + item.width / 2, item.y + item.height / 2, "#00f3ff", 8, 3);
        } else if (item.type === 'health') {
          this.player.hp = Math.min(100, this.player.hp + 25);
          this.spawnParticles(item.x + item.width / 2, item.y + item.height / 2, "#00ff66", 12, 4);
        }
      }
    });

    if (this.map.portal && this.rectIntersect(this.player, this.map.portal)) {
      this.triggerVictory();
    }

    this.particles.forEach((pt) => pt.update());
    this.particles = this.particles.filter((pt) => pt.life > 0);

    document.getElementById("healthBar").style.width = `${this.player.hp}%`;
    const dashCdPercent = this.player.dashCooldown > 0 ? (1 - this.player.dashCooldown / DASH_CD) * 100 : 100;
    document.getElementById("dashBar").style.width = `${dashCdPercent}%`;
    document.getElementById("scoreValue").innerText = String(this.player.score).padStart(5, '0');
  }

  rectIntersect(r1, r2) {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawParallaxBg();

    if (this.state === "PLAYING" || this.state === "GAMEOVER" || this.state === "VICTORY") {
      this.map.draw(this.ctx, this.camera, this.time);

      this.map.enemies.forEach((enemy) => {
        if (enemy.hp > 0) enemy.draw(this.ctx, this.camera, this.time);
      });

      this.projectiles.forEach((p) => p.draw(this.ctx, this.camera));

      if (this.player.hp > 0) {
        this.player.draw(this.ctx, this.camera, this.time);
      }

      this.particles.forEach((pt) => pt.draw(this.ctx, this.camera));
    }
  }

  drawParallaxBg() {
    const ctx = this.ctx;
    const camX = this.camera.x;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    skyGrad.addColorStop(0, "#020308");
    skyGrad.addColorStop(1, "#0a0f24");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.strokeStyle = "rgba(0, 243, 255, 0.03)";
    ctx.lineWidth = 1;
    const gridOffset = -(camX * 0.05) % 40;
    for (let x = gridOffset; x < this.canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(10, 16, 38, 0.5)";
    const towerWidth = 70;
    const towerGap = 40;
    const layer3Offset = -(camX * 0.15) % (towerWidth + towerGap);
    for (let x = layer3Offset - (towerWidth + towerGap); x < this.canvas.width + towerWidth; x += (towerWidth + towerGap)) {
      const height = 180 + Math.sin(x * 0.01) * 60;
      ctx.fillRect(x, this.canvas.height - height, towerWidth, height);
      
      ctx.fillStyle = "rgba(0, 243, 255, 0.15)";
      for (let wy = this.canvas.height - height + 10; wy < this.canvas.height - 20; wy += 25) {
        ctx.fillRect(x + 15, wy, 8, 8);
        ctx.fillRect(x + 45, wy, 8, 8);
      }
      ctx.fillStyle = "rgba(10, 16, 38, 0.5)";
    }
    ctx.restore();

    ctx.save();
    const gradHorizon = ctx.createLinearGradient(0, this.canvas.height - 60, 0, this.canvas.height);
    gradHorizon.addColorStop(0, "rgba(189, 0, 255, 0.08)");
    gradHorizon.addColorStop(1, "rgba(0, 243, 255, 0.12)");
    ctx.fillStyle = gradHorizon;
    ctx.fillRect(0, this.canvas.height - 60, this.canvas.width, 60);

    ctx.strokeStyle = "rgba(189, 0, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, this.canvas.height - 60);
    ctx.lineTo(this.canvas.width, this.canvas.height - 60);
    ctx.stroke();
    ctx.restore();
  }

  loop = () => {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop);
  }
}

// Start Game Instance
new Game();
