// Game parameters
let canvas, centerPoint, ctx, game_mode, playing, player1, player2;
const scoreboard = document.querySelector(".scoreboard");
const shield_p1 = document.querySelector(".shield_p1");
const shield_p2 = document.querySelector(".shield_p2");
const crash = document.querySelector(".crash");
const explosion = document.querySelector(".explosion");
const message = document.querySelector(".message");
const result = document.querySelector(".result");
const planet1 = document.querySelector(".planet-one");
const planet2 = document.querySelector(".planet-two");
const space = document.querySelector(".space");
const playerOneToggle = document.querySelector("#playerOne");
const playerTwoToggle = document.querySelector("#playerTwo");
const gutter = 150;
const overlay = document.getElementById("overlay");
const startPopup = document.getElementById("popup");
const resultsPopup = document.getElementById("results");
const contenders = document.getElementById("contenders");
const p1_graphic = document.getElementById("player1");
const p2_graphic = document.getElementById("player2");

// SVG Images (preloaded via base64)
let player1_svg, player2_svg, flicker_svg;

// Asteroid parameters
let asteroids;
let asteroidColor;
const asteroidRate = 200;
let asteroidMax = 5;
let asteroidTimeout = 0;
const asteroidColors = ["#9F96BC", "#666078", "#494556"];
const asteroidSizeMax = 30;
const asteroidSpeed = 2;
const splitSize = 10;

// Rocket parameters
const rocketSize = 33;
const rocketWidth = 40;
const rocketArea = 1236.22;
const acceleration = 0.09;
const turnRate = 5;

// Shooting parameters
const shootingRate = 10;
const shootingSpeed = 12;
const maxAmmo = 25;

// Import SVGs as Images (with Promise for loading)
function importSVG(name) {
  return new Promise((resolve, reject) => {
    const svg = document.getElementById(name);
    if (!svg) {
      reject(new Error(`SVG with id "${name}" not found`));
      return;
    }
    const img = new Image();
    const data = new XMLSerializer().serializeToString(svg);
    img.src = "data:image/svg+xml;base64," + window.btoa(unescape(encodeURIComponent(data)));  // Fix for UTF-8 in btoa
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load SVG "${name}"`));
  });
}

const explosionSize = {
  width: (explosion.getBoundingClientRect().width / 2).toFixed(),
  height: (explosion.getBoundingClientRect().height / 2).toFixed()
};

// Popup UI
function openStartPopup() {
  const startBtn = startPopup.querySelector("#start");
  startBtn.addEventListener("click", startGame, { once: true });
  contenders.style.display = "block";
  startPopup.style.display = "block";
  overlay.style.display = "block";
  contenders.style.opacity = "1";
  startPopup.style.opacity = "1";
  overlay.style.opacity = "0.6";
}

function closeStartPopup() {
  overlay.style.opacity = "0";
  startPopup.style.opacity = "0";
  contenders.style.opacity = "0";
  setTimeout(() => {
    startPopup.style.display = "none";
    overlay.style.display = "none";
    contenders.style.display = "none";
  }, 300);
}

function showResultsPopup() {
  resultsPopup.style.display = "block";
  resultsPopup.style.opacity = "1";
  overlay.style.display = "block";
  overlay.style.opacity = "0.6";
}

function hideResultsPopup() {
  resultsPopup.style.opacity = "0";
  overlay.style.opacity = "0";
  setTimeout(() => {
    resultsPopup.style.display = "none";
    overlay.style.display = "none";
  }, 300);
}

// Math & Helpers
function tesseractMove() {
  if (this.x > canvas.width + gutter) this.x = 0 - gutter / 2 + this.vx;
  else if (this.x < 0 - gutter) this.x = canvas.width + gutter / 2 + this.vx;
  else this.x += this.vx;
  if (this.y > canvas.height + gutter) this.y = 0 - gutter / 2 + this.vy;
  else if (this.y < 0 - gutter) this.y = canvas.height + gutter / 2 + this.vy;
  else this.y += this.vy;
}

function checkBoundary(dot1, dot2) {
  const x1 = dot1[0], y1 = dot1[1], x2 = dot2[0], y2 = dot2[1];
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function rad(angle) { return angle * Math.PI / 180; }

// 🔥 NEW: Show sacrifice message
function showSacrificeMessage(rocket, cost, ability) {
  const messages = {
    shield: `Sacrificed ${cost}% of your life for protection!`,
    invisibility: `Vanished into the void — ${cost}% of your soul spent!`,
    overdrive: `Unleashed the final shot — ${cost}% of your essence burned!`
  };

  const msg = document.createElement('div');
  msg.textContent = messages[ability] || `Sacrificed ${cost}% for power!`;
  msg.style.cssText = `
    position: absolute;
    left: ${rocket.x}px;
    top: ${rocket.y - 80}px;
    color: white;
    font-size: 1.4em;
    font-weight: bold;
    text-shadow: 0 0 8px black, 0 0 12px ${rocket.id === 'one' ? '#5ecb84' : '#EDBB0B'};
    pointer-events: none;
    z-index: 100;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s, transform 0.5s;
  `;
  document.body.appendChild(msg);

  // Animate in
  setTimeout(() => {
    msg.style.opacity = '1';
    msg.style.transform = 'translateY(0)';
  }, 10);

  // Auto-remove after 2 seconds
  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      if (msg.parentNode) msg.parentNode.removeChild(msg);
    }, 300);
  }, 2000);
}

// 🔥 NEW: Render visible shield
function renderShield(rocket) {
  if (!rocket.hasShield || rocket.invisible) return;

  ctx.save();
  ctx.translate(rocket.x, rocket.y);
  ctx.strokeStyle = rocket.id === 'one' ? '#5ecb84' : '#EDBB0B';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);

  const pulse = 1 + 0.12 * Math.sin(Date.now() / 120);
  const radius = 55 * pulse;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, rocket.id === 'one' ? 'rgba(94, 203, 132, 0.35)' : 'rgba(237, 187, 11, 0.35)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.restore();
}

// Rocket
function Rocket(token, role) {
  this.id = token;
  this.x = token == "one" ? canvas.width / 4 : canvas.width * 3 / 4;
  this.y = centerPoint.y;
  this.vx = 0; this.vy = 0;
  this.thruster = false;
  this.rotateLeft = false;
  this.rotateRight = false;
  this.fire = false;
  this.svg = token == "one" ? player1_svg : player2_svg;
  this.score = token == "one" ? shield_p1 : shield_p2;
  this.shotTimeout = shootingRate;
  this.flameTimeout = 0;
  this.health = 100;
  this.direction = token == "one" ? 270 : 90;
  this.shots = [];
  this.ammo = maxAmmo;
  this.hasShield = false;
  this.invisible = false;
  this.sacrificeCooldown = 0;
  this.overdriveCharging = false;

  this.ammoUI = document.querySelector(`.ammo-counter.${token == 'one' ? 'p1' : 'p2'}`);
  this.updateAmmoUI();
}

Rocket.prototype.getPoints = getRocketPoints;
Rocket.prototype.update = updateRocket;
Rocket.prototype.move = tesseractMove;
Rocket.prototype.render = renderRocket;
Rocket.prototype.updateAmmoUI = function() {
  this.ammoUI.textContent = `Bullets: ${this.ammo}`;
};
Rocket.prototype.trySacrifice = function(type) {
  if (this.health <= 0 || this.sacrificeCooldown > 0) return;
  let cost = 0, effect = () => {};
  if (type === 'shield' && this.health >= 20) {
    cost = 20;
    effect = () => {
      this.hasShield = true;
      // Flash on activation
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: absolute; top:0; left:0; width:100%; height:100%;
        background: ${this.id === 'one' ? 'rgba(94,203,132,0.25)' : 'rgba(237,187,11,0.25)'};
        pointer-events: none; z-index: 10; opacity: 0;
      `;
      document.body.appendChild(flash);
      flash.style.transition = 'opacity 0.2s';
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => document.body.removeChild(flash), 200);
      }, 100);
      setTimeout(() => this.hasShield = false, 3000);
    };
  } else if (type === 'invisibility' && this.health >= 30) {
    cost = 30;
    effect = () => {
      this.invisible = true;
      setTimeout(() => this.invisible = false, 2500);
    };
  } else if (type === 'overdrive' && this.health >= 40) {
    cost = 40;
    effect = () => this.chargeOverdriveShot();
  } else return;

  this.health -= cost;
  this.score.innerHTML = this.health;
  effect();
  this.sacrificeCooldown = 120;

  // 🔥 SHOW SACRIFICE MESSAGE
  showSacrificeMessage(this, cost, type);
};
Rocket.prototype.chargeOverdriveShot = function() {
  if (this.overdriveCharging) return;
  this.overdriveCharging = true;
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: absolute; top:0; left:0; width:100%; height:100%;
    background: radial-gradient(circle, rgba(255,50,50,0.4) 0%, transparent 70%);
    pointer-events: none; z-index: 100; opacity: 0;
  `;
  document.body.appendChild(warning);
  warning.style.transition = 'opacity 0.3s';
  warning.style.opacity = '1';
  setTimeout(() => {
    warning.style.opacity = '0';
    setTimeout(() => document.body.removeChild(warning), 300);
    let pos = this.getPoints()[0];
    const overdriveShot = {
      x: pos[0], y: pos[1],
      vx: shootingSpeed * 2 * Math.cos(rad(this.direction)),
      vy: -shootingSpeed * 2 * Math.sin(rad(this.direction)),
      owner: this.id,
      isOverdrive: true,
      update: function() {
        this.x += this.vx; this.y += this.vy;
        const enemy = this.owner === 'one' ? player2 : player1;
        if (!enemy || enemy.health <= 0) return;
        const dist = checkBoundary([this.x, this.y], [enemy.x, enemy.y]);
        if (dist < 100) {
          enemy.health = -1;
          checkGameStatus();
        }
      },
      render: function() {
        ctx.strokeStyle = this.owner === 'one' ? '#ff5555' : '#ffff00';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.vx * 2, this.y + this.vy * 2);
        ctx.stroke();
      }
    };
    this.shots.push(overdriveShot);
    this.overdriveCharging = false;
  }, 1500);
};

// Enemy (unchanged)
function Enemy(token, role) {
  Rocket.call(this, token, role);
  this.swornEnemy = "";
  this.newDirection = 0;
  this.angleDiff = 0;
  this.newPosition = { x: 0, y: 0 };
  this.searchInterval = 0;
  this.targetFound = false;
  this.moveInterval = 0;
  this.panicInterval = 50;
  this.proximity = 0;
  this.safe = true;
  this.closestTarget = "";
  this.closestDistance = 0;
  this.fightOrFlight = 0;
}
Enemy.prototype = Object.create(Rocket.prototype);
Object.defineProperty(Enemy.prototype, "constructor", { value: Enemy, enumerable: false, writable: true });

Enemy.prototype.behaviour = function() {
  if (this.direction > 360) this.direction -= 360;
  else if (this.direction < 0) this.direction += 360;
  function randomise(max) { return Math.floor(Math.random() * max); }
  const randomPosition = function() {
    this.newPosition.x = randomise(canvas.width);
    this.newPosition.y = randomise(canvas.height);
  }.bind(this);
  const findAngle = function(target) {
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    let angle = Math.atan2(dy, dx);
    if (this.safe) {
      this.newPosition.x = this.x - dx;
      this.newPosition.y = this.y - dy;
    }
    this.newDirection = 180 - angle * (180 / Math.PI);
    this.angleDiff = this.newDirection - this.direction;
    if (this.angleDiff < -180) this.angleDiff += 360;
    else if (this.angleDiff > 180) this.angleDiff -= 360;
    this.angleDiff = this.angleDiff.toFixed();
  }.bind(this);
  const turnToFace = function(target) {
    if (this.targetFound) return;
    else if (this.angleDiff > 5) { this.rotateLeft = true; this.rotateRight = false; return; }
    else if (this.angleDiff < -5) { this.rotateLeft = false; this.rotateRight = true; return; }
    else { this.targetFound = true; this.rotateLeft = false; this.rotateRight = false; return; }
  }.bind(this);
  const shootIfInRange = function() {
    if (this.angleDiff < 7 && this.angleDiff > -7) this.fire = true;
    else this.fire = false;
  }.bind(this);
  const move = function() {
    if (this.moveInterval <= 0) {
      if (!this.thruster) { this.thruster = true; this.moveInterval = randomise(12) + 6; }
      else { this.thruster = false; this.moveInterval = randomise(30) + 80; }
    } else this.moveInterval--;
  }.bind(this);
  const attack = function(target) {
    if (this.searchInterval <= 0) {
      this.targetFound = false;
      this.fire = false;
      this.searchInterval = randomise(30) + 35;
    } else this.searchInterval--;
    findAngle(target);
    if (this.targetFound) {
      shootIfInRange();
      this.thruster = false;
    } else {
      turnToFace(target);
      this.thruster = true;
    }
    move();
  }.bind(this);
  const changeDirection = function() {
    randomPosition();
    this.safe = false;
  }.bind(this);
  const flee = function() {
    if (this.safe) changeDirection();
    this.thruster = true;
    findAngle(this.newPosition);
    turnToFace(this.newPosition);
    move();
    if (this.panicInterval <= 0) {
      this.safe = true;
      this.panicInterval = randomise(60) + 30;
    } else this.panicInterval--;
  }.bind(this);
  const findClosest = function(target) {
    let dist_x = this.x - target.x;
    let dist_y = this.y - target.y;
    this.proximity = Math.sqrt(dist_x * dist_x + dist_y * dist_y);
  }.bind(this);
  const setClosest = function() { this.closestDistance = this.proximity; }.bind(this);
  findClosest(this.swornEnemy);
  this.closestTarget = this.swornEnemy;
  setClosest();
  if (obstacles) {
    for (let i = 0; i < asteroids.length; i++) {
      findClosest(asteroids[i]);
      if (this.proximity < this.closestDistance) {
        this.closestTarget = asteroids[i];
        setClosest();
      }
    }
  }
  if (this.closestDistance < 150) {
    this.fire = true;
    if (this.fightOrFlight === 0) attack(this.closestTarget);
    else flee();
  } else if (this.closestDistance < 300 || !this.safe) {
    flee();
    this.fire = true;
  } else if (this.safe) {
    this.fire = false;
    attack(this.closestTarget);
  } else if (this.closestDistance > 500) {
    this.safe = true;
    this.fire = false;
    this.thruster = false;
    attack(this.closestTarget);
  }
};

// Rocket functions
function getRocketPoints() {
  let points = [];
  let leftSide = rad(this.direction - rocketWidth);
  let rightSide = rad(this.direction + rocketWidth);
  points.push([this.x + rocketSize * Math.cos(rad(this.direction)), this.y - rocketSize * Math.sin(rad(this.direction))]);
  points.push([this.x - rocketSize * Math.cos(leftSide), this.y + rocketSize * Math.sin(leftSide)]);
  points.push([this.x - rocketSize * Math.cos(rightSide), this.y + rocketSize * Math.sin(rightSide)]);
  return points;
}

function updateRocket() {
  if (this.thruster) {
    this.vx += acceleration * Math.cos(rad(this.direction));
    this.vy -= acceleration * Math.sin(rad(this.direction));
  }
  if (this.rotateLeft) this.direction += turnRate;
  if (this.rotateRight) this.direction -= turnRate;
  if (this.fire && this.ammo > 0) {
    if (this.shotTimeout >= shootingRate) {
      let position = this.getPoints();
      this.shots.push(new Shot(position[0][0], position[0][1], this.direction, this.id));
      this.ammo--;
      this.updateAmmoUI();
      this.shotTimeout = 0;
    } else this.shotTimeout++;
  } else this.shotTimeout = shootingRate;
  for (let i = 0; i < this.shots.length; i++) {
    this.shots[i].update();
    if (this.shots[i].hit) this.shots.splice(i--, 1);
  }
  this.vx *= 0.985;
  this.vy *= 0.985;
  this.move();
  if (this.sacrificeCooldown > 0) this.sacrificeCooldown--;
}

function collisionPrevention() {
  let dist_x = player1.x - player2.x;
  let dist_y = player1.y - player2.y;
  let repel = Math.sqrt(dist_x * dist_x + dist_y * dist_y);
  if (repel < 40) {
    let repelX = dist_x / repel;
    let repelY = dist_y / repel;
    player1.vx += repelX * 5; player1.vy += repelY * 5;
    player2.vx -= repelX * 5; player2.vy -= repelY * 5;
    if (!player1.hasShield) player1.health -= 5;
    if (!player2.hasShield) player2.health -= 5;
  }
}

function renderRocket() {
  if (this.invisible || !this.svg || !this.svg.complete) return;  // Safety for unloaded images
  let points = this.getPoints();
  let angle = rad((this.direction + 270) * -1);
  ctx.save();
  ctx.translate(points[0][0], points[0][1]);
  ctx.rotate(angle);
  ctx.translate(-33.85, 0);
  ctx.drawImage(this.svg, 0, 0);
  if (this.thruster) this.flameTimeout = 12;
  if (this.flameTimeout > 0 && flicker_svg && flicker_svg.complete) {
    ctx.drawImage(flicker_svg, 0, 0);
    this.flameTimeout--;
  }
  ctx.restore();
  for (let i = 0; i < this.shots.length; i++) this.shots[i].render();
}

// Asteroid functions
function sizeColor(size) {
  if (size > 30) return 2;
  else if (size > 20) return 1;
  else return 0;
}

function Asteroid(x, y, size, vx, vy) {
  this.x = x;
  this.y = y;
  this.size = size;
  this.radius = size * 2 + 5;
  this.vx = vx;
  this.vy = vy;
  this.points = [];
  for (let i = 0; i < size; i++) {
    let dist = Math.random() * 15 - 5 + this.radius;
    let angle = i * 360 / size;
    this.points.push([dist * Math.cos(rad(angle)), dist * Math.sin(rad(angle))]);
  }
  this.color = sizeColor(this.size);
  this.explode = explodeAsteroid;
  this.update = updateAsteroid;
  this.move = tesseractMove;
  this.render = renderAsteroid;
}

function explodeAsteroid() {
  if (this.size - splitSize >= splitSize - 1) {
    asteroids.push(new Asteroid(this.x, this.y, this.size - splitSize, this.vx, this.vy));
    asteroids.push(new Asteroid(this.x, this.y, splitSize, Math.random() * 4 - 2, Math.random() * 4 - 2));
  }
}

function updateAsteroid(num) {
  const asteroid_xy = [this.x, this.y];
  function checkProximity(target) {
    if (asteroids[num] === undefined) return;
    let rocketPoints = target.getPoints();
    for (let i = 0; i < rocketPoints.length; i++) {
      let proximityToRocket = checkBoundary(asteroid_xy, [rocketPoints[i][0], rocketPoints[i][1]]);
      if (proximityToRocket < asteroids[num].radius) {
        if (!target.hasShield) {
          target.health -= (asteroids[num].radius / 4).toFixed();
        }
        asteroids[num].explode();
        asteroids.splice(num, 1);
        return;
      }
    }
  }
  checkProximity(player1);
  checkProximity(player2);
  if (asteroids[num] !== undefined) asteroids[num].move();
}

function renderAsteroid() {
  ctx.beginPath();
  ctx.moveTo(this.x + this.points[0][0], this.y + this.points[0][1]);
  for (let i = this.size - 1; i >= 0; i -= 1) {
    ctx.lineTo(this.x + this.points[i][0], this.y + this.points[i][1]);
  }
  ctx.fillStyle = asteroidColor;
  ctx.fill();
}

// Shot
function Shot(x, y, direction, owner) {
  this.x = x;
  this.y = y;
  this.vx = shootingSpeed * Math.cos(rad(direction));
  this.vy = -shootingSpeed * Math.sin(rad(direction));
  this.hit = false;
  this.owner = owner;
  this.color = owner == "one" ? "#5ecb84" : "#EDBB0B";
  this.update = updateShot;
  this.render = renderShot;
}

function updateShot() {
  if (this.x > canvas.width + gutter || this.x < -gutter || this.y > canvas.height + gutter || this.y < -gutter) {
    this.hit = true;
    return;
  }
  if (!this.hit) {
    function checkProximity(target, slug) {
      const points = target.getPoints();
      const aX = points[0][0], aY = points[0][1];
      const bX = points[2][0], bY = points[2][1];
      const cX = points[1][0], cY = points[1][1];
      const sX = slug.x, sY = slug.y;
      const area1 = Math.abs((sX*(bY-cY) + bX*(cY-sY) + cX*(sY-bY))/2);
      const area2 = Math.abs((aX*(sY-cY) + sX*(cY-aY) + cX*(aY-sY))/2);
      const area3 = Math.abs((aX*(bY-sY) + bX*(sY-aY) + sX*(aY-bY))/2);
      const totalArea = area1 + area2 + area3;
      if (Math.abs(totalArea - rocketArea) < 1) {
        if (!target.hasShield) {
          target.health--;
        }
        slug.hit = true;
      }
    }
    if (this.owner == "one") checkProximity(player2, this);
    else checkProximity(player1, this);
  }
  if (!this.hit && obstacles) {
    for (let i = 0; i < asteroids.length; i++) {
      let proximityToAsteroid = checkBoundary([asteroids[i].x, asteroids[i].y], [this.x, this.y]);
      if (proximityToAsteroid <= asteroids[i].radius) {
        asteroids[i].explode();
        asteroids.splice(i, 1);
        this.hit = true;
        break;
      }
    }
  }
  if (!this.hit) {
    this.x += this.vx;
    this.y += this.vy;
  }
}

function renderShot() {
  ctx.strokeStyle = this.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(this.x, this.y);
  ctx.lineTo(this.x + this.vx, this.y + this.vy);
  ctx.stroke();
}

function renderScore(target) {
  let count = target.score.innerHTML;
  if (playing && target.health < parseInt(count)) {
    target.score.innerHTML = target.health;
  }
}

function checkGameStatus() {
  if (player1.health <= 0 && player2.health <= 0) {
    gameOver("tie");
  } else if (player1.health <= 0) {
    gameOver(player1);
  } else if (player2.health <= 0) {
    gameOver(player2);
  }
}

function gameOver(target) {
  p1_graphic.style.opacity = 0;
  p2_graphic.style.opacity = 0;
  playing = false;
  if (target == "resized") {
    result.innerHTML = "The game is using your screen size.";
    message.innerHTML = "Don't resize the screen during the game.";
  } else if (target == "tie") {
    result.innerHTML = "TIE!";
    message.innerHTML = "Both rockets exploded, try again?";
  } else if (target == player1) {
    p2_graphic.style.opacity = 1;
    const finalHealth = Math.max(0, player2.health);
    result.innerHTML = "Red Rocket Is Victorious!";
    message.innerHTML = `Survived with ${finalHealth}% shield!`;
  } else if (target == player2) {
    p1_graphic.style.opacity = 1;
    const finalHealth = Math.max(0, player1.health);
    result.innerHTML = "Blue Rocket Is Victorious!";
    message.innerHTML = `Survived with ${finalHealth}% shield!`;
  }
  const x = (target == "tie" ? centerPoint.x : target.x) - explosionSize.width;
  const y = (target == "tie" ? centerPoint.y : target.y) - explosionSize.height;
  const degrees = Math.floor(Math.random() * 360);
  crash.style.transform = `translate(${x}px, ${y}px) rotate(${degrees}deg)`;
  crash.style.opacity = 1;
  explosion.classList.add("explode");
  showResultsPopup();
}

// Game setup
let playerOne = true;
let playerTwo = false;
const obstacles = true;

function toggleOption(option) { return !option; }
function switchPlayer(target) { return target ? "Computer" : "Human"; }

playerOneToggle.addEventListener("click", function() {
  playerOne = toggleOption(playerOne);
  this.textContent = switchPlayer(playerOne);
});
playerTwoToggle.addEventListener("click", function() {
  playerTwo = toggleOption(playerTwo);
  this.textContent = switchPlayer(playerTwo);
});

function setPlayer(toggle, number) {
  return toggle ? new Enemy(number, "computer") : new Rocket(number, "human");
}

async function preloadSVGs() {
  try {
    [player1_svg, player2_svg, flicker_svg] = await Promise.all([
      importSVG("player1"),
      importSVG("player2"),
      importSVG("flicker")
    ]);
    console.log("All SVGs preloaded—game ready!");
  } catch (err) {
    console.error("SVG preload failed:", err);
    alert("Failed to load game assets—check console.");
  }
}

function startGame() {
  placeElements();
  asteroids = [];
  player1 = setPlayer(playerOne, "one");
  player2 = setPlayer(playerTwo, "two");
  if (playerOne) player1.swornEnemy = player2;
  if (playerTwo) player2.swornEnemy = player1;
  shield_p1.innerHTML = "100";
  shield_p2.innerHTML = "100";
  document.querySelector('.ammo-counter.p1').textContent = "Bullets: 25";
  document.querySelector('.ammo-counter.p2').textContent = "Bullets: 25";
  scoreboard.style.opacity = 1;
  crash.style.opacity = 0;
  explosion.classList.remove("explode");
  closeStartPopup();
  result.innerHTML = "";
  message.innerHTML = "";
  playing = true;
  game_mode = setInterval(function() {
    if (playing) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (obstacles) {
        if (asteroidTimeout >= asteroidRate && asteroids.length <= asteroidMax) {
          let side = Math.floor(Math.random() * 2);
          if (side == 0) {
            asteroids.push(new Asteroid(-gutter, Math.random() * canvas.height, Math.floor(Math.random() * asteroidSizeMax) + 10, Math.random() * asteroidSpeed, Math.random() * (asteroidSpeed * 2) - asteroidSpeed));
          } else {
            asteroids.push(new Asteroid(canvas.width + gutter, Math.random() * canvas.height, Math.floor(Math.random() * asteroidSizeMax) + 10, Math.random() * -asteroidSpeed, Math.random() * (asteroidSpeed * 2) - asteroidSpeed));
          }
          asteroidTimeout = 0;
        } else asteroidTimeout++;
      }
      if (playerOne) player1.behaviour();
      if (playerTwo) player2.behaviour();
      player1.update();
      player2.update();
      collisionPrevention();
      if (obstacles) for (let i = 0; i < asteroids.length; i++) asteroids[i].update(i);
      player1.render();
      player2.render();
      // 🔥 RENDER SHIELDS
      renderShield(player1);
      renderShield(player2);
      if (obstacles) {
        for (let i = 0; i < asteroidColors.length; i++) {
          asteroidColor = asteroidColors[i];
          for (let j = 0; j < asteroids.length; j++) {
            if (asteroids[j].color == i) asteroids[j].render();
          }
        }
      }
      renderScore(player1);
      renderScore(player2);
      checkGameStatus();
    }
    if (!playing) clearInterval(game_mode);
  }, 1000 / 60);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", async function() {
  calculateSizes();
  placeElements();
  await preloadSVGs();  // Wait for SVGs before showing UI
  openStartPopup();

  document.getElementById("restart").addEventListener("click", function() {
    hideResultsPopup();
    openStartPopup();
  });

  document.addEventListener("keydown", function(event) {
    if (event.defaultPrevented || !playing) return;
    event.preventDefault();
    const key = event.code || event.key || event.keyCode;
    if (playerTwo == false) {
      switch (key) {
        case "ArrowUp": case 38: player2.thruster = true; break;
        case "ArrowLeft": case 37: player2.rotateLeft = true; break;
        case "ArrowRight": case 39: player2.rotateRight = true; break;
        case "Space": case " ": case 32: player2.fire = true; break;
        case "Digit1": case 49: player2.trySacrifice('shield'); break;
        case "Digit2": case 50: player2.trySacrifice('invisibility'); break;
        case "Digit3": case 51: player2.trySacrifice('overdrive'); break;
      }
    }
    if (playerOne == false) {
      switch (key) {
        case "KeyW": case "w": case 87: player1.thruster = true; break;
        case "KeyA": case "a": case 65: player1.rotateLeft = true; break;
        case "KeyD": case "d": case 68: player1.rotateRight = true; break;
        case "KeyZ": case "z": case 90: player1.fire = true; break;
        case "KeyQ": case 81: player1.trySacrifice('shield'); break;
        case "KeyE": case 69: player1.trySacrifice('invisibility'); break;
        case "KeyR": case 82: player1.trySacrifice('overdrive'); break;
      }
    }
  }, true);

  document.addEventListener("keyup", function(event) {
    if (event.defaultPrevented || !playing) return;
    const key = event.code || event.key || event.keyCode;
    if (playerTwo == false) {
      switch (key) {
        case "ArrowUp": case 38: player2.thruster = false; break;
        case "ArrowLeft": case 37: player2.rotateLeft = false; break;
        case "ArrowRight": case 39: player2.rotateRight = false; break;
        case "Space": case " ": case 32: player2.fire = false; break;
      }
    }
    if (playerOne == false) {
      switch (key) {
        case "KeyW": case "w": case 87: player1.thruster = false; break;
        case "KeyA": case "a": case 65: player1.rotateLeft = false; break;
        case "KeyD": case "d": case 68: player1.rotateRight = false; break;
        case "KeyZ": case "z": case 90: player1.fire = false; break;
      }
    }
  }, true);

  window.addEventListener("resize", function() {
    calculateSizes();
    if (playing) gameOver("resized");
  });
});

// Background helpers
function placePlanet(planet) {
  let x = Math.floor(Math.random() * canvas.width);
  let y = Math.floor(Math.random() * canvas.height);
  let scale = 0.5 + Math.random() * 2;
  planet.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function placeElements() {
  planet1.style.opacity = 0;
  planet2.style.opacity = 0;
  space.style.opacity = 0;
  placePlanet(planet1);
  placePlanet(planet2);
  createStars();
  planet1.style.opacity = 1;
  planet2.style.opacity = 1;
  space.style.opacity = 1;
}

function createStars() {
  let heightMax = window.innerHeight - 4,
    widthMax = window.innerWidth - 4;
  space.innerHTML = "";
  for (let i = 0; i < 50; i++) {
    const star = `<div style="left:${Math.floor(Math.random() * widthMax)}px; top:${Math.floor(Math.random() * heightMax)}px; height:${Math.ceil(Math.random() * 100) / 100}vmax; width:${Math.ceil(Math.random() * 100) / 100}vmax;" class="star star${i}"><svg viewBox="0 0 513 513"><use xlink:href="#star"/></svg></div>`;
    space.insertAdjacentHTML("beforeend", star);
  }
}

function calculateSizes() {
  canvas = document.querySelector("canvas");
  ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  centerPoint = { x: canvas.width / 2, y: canvas.height / 2 };
  scoreboard.style.opacity = 0;
}