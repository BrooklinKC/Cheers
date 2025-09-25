let handPose;
let video;
let hands = [];
let glassImg;

let smoothHands = {};
let smoothingFactor = 0.2;
let clinkEffects = [];
let lastClinkPairs = new Set();
let glassBounces = {};

let cheersTextTimer = 0; 
let cheersText = "";
let cheersX = 0;
let cheersY = 0;

let cheersWords = [
  "Cheers!", "Salud!", "Santé!", "Prost!", "Cin cin!",
  "干杯!", "Kanpai!", "Skål!", "Na zdravi!", "Sláinte!"
];

let cheersColors = {
  "Cheers!": [120, 160, 220],
  "Salud!": [210, 226, 124],
  "Santé!": [170, 211, 247],
  "Prost!": [140, 140, 140],
  "Cin cin!": [140, 220, 150],
  "干杯!": [178, 143, 0],
  "Kanpai!": [255, 105, 105],
  "Skål!": [144, 102, 106],
  "Na zdravi!": [140, 200, 250],
  "Sláinte!": [150, 220, 170]
};

let cheersTextColors = {
  "Cheers!": [40, 80, 140],
  "Salud!": [111, 120, 66],
  "Santé!": [60, 100, 160],
  "Prost!": [80, 80, 80],
  "Cin cin!": [60, 140, 80],
  "干杯!": [84, 68, 0],
  "Kanpai!": [140, 58, 58],
  "Skål!": [82, 58, 60],
  "Na zdravi!": [50, 120, 160],
  "Sláinte!": [50, 120, 70]
};

let currentBG = [193, 217, 205];
let targetBG = [193, 217, 205];

let splashParticles = [];

// 🔹 Bring glasses closer
let closenessFactor = 0.35; 

function preload() {
  handPose = ml5.handPose();
  glassImg = loadImage("Lemonade Drawing 3.png");
}

function pointFromKP(kp) {
  if (!kp) return null;
  if (typeof kp.x === 'number' && typeof kp.y === 'number') return { x: kp.x, y: kp.y };
  if (kp.position && typeof kp.position.x === 'number' && typeof kp.position.y === 'number') return { x: kp.position.x, y: kp.position.y };
  if (Array.isArray(kp) && kp.length >= 2) return { x: kp[0], y: kp[1] };
  return null;
}

function getKeypoint(hand, idx) {
  if (hand.keypoints && hand.keypoints[idx]) return pointFromKP(hand.keypoints[idx]);
  if (hand.landmarks && hand.landmarks[idx]) return pointFromKP(hand.landmarks[idx]);
  if (hand.annotations) {
    if (idx === 8 && hand.annotations.indexFinger) return pointFromKP(hand.annotations.indexFinger[3]);
    if (idx === 12 && hand.annotations.middleFinger) return pointFromKP(hand.annotations.middleFinger[3]);
    if (idx === 16 && hand.annotations.ringFinger) return pointFromKP(hand.annotations.ringFinger[3]);
    if (idx === 20 && hand.annotations.pinky) return pointFromKP(hand.annotations.pinky[3]);
    if (idx === 6 && hand.annotations.indexFinger) return pointFromKP(hand.annotations.indexFinger[1]);
    if (idx === 10 && hand.annotations.middleFinger) return pointFromKP(hand.annotations.middleFinger[1]);
    if (idx === 14 && hand.annotations.ringFinger) return pointFromKP(hand.annotations.ringFinger[1]);
    if (idx === 18 && hand.annotations.pinky) return pointFromKP(hand.annotations.pinky[1]);
  }
  return null;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  handPose.detectStart(video, gotHands);

  textFont('Ohno Softie Variable');
  textStyle(BOLD);
}

function draw() {
  let glassCenters = [];

  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    let indexTip = getKeypoint(hand, 8);
    let middleTip = getKeypoint(hand, 12);
    let ringTip = getKeypoint(hand, 16);
    let pinkyTip = getKeypoint(hand, 20);
    let indexMid = getKeypoint(hand, 6);
    let middleMid = getKeypoint(hand, 10);
    let ringMid = getKeypoint(hand, 14);
    let pinkyMid = getKeypoint(hand, 18);

    if (!indexTip || !middleTip || !ringTip || !pinkyTip ||
        !indexMid || !middleMid || !ringMid || !pinkyMid) continue;

    let blend = 0.4;
    let indexPos = { x: lerp(indexTip.x, indexMid.x, blend), y: lerp(indexTip.y, indexMid.y, blend) };
    let middlePos = { x: lerp(middleTip.x, middleMid.x, blend), y: lerp(middleTip.y, middleMid.y, blend) };
    let ringPos = { x: lerp(ringTip.x, ringMid.x, blend), y: lerp(ringTip.y, ringMid.y, blend) };
    let pinkyPos = { x: lerp(pinkyTip.x, pinkyMid.x, blend), y: lerp(pinkyTip.y, pinkyMid.y, blend) };

    let handCenterX = (indexPos.x + middlePos.x + ringPos.x + pinkyPos.x) / 4;
    let handCenterY = (indexPos.y + middlePos.y + ringPos.y + pinkyPos.y) / 4;

    let angle = atan2(indexPos.y - pinkyPos.y, indexPos.x - pinkyPos.x);
    let correctedAngle = -angle + HALF_PI + PI;

    let targetX = width - handCenterX;
    let targetY = handCenterY;

    if (!smoothHands[i]) smoothHands[i] = { x: targetX, y: targetY, angle: correctedAngle };

    smoothHands[i].x = lerp(smoothHands[i].x, targetX, smoothingFactor);
    smoothHands[i].y = lerp(smoothHands[i].y, targetY, smoothingFactor);
    smoothHands[i].angle = lerpAngle(smoothHands[i].angle, correctedAngle, smoothingFactor);

    if (!glassBounces[i]) glassBounces[i] = { x: 0, y: 0 };
    smoothHands[i].x += glassBounces[i].x;
    smoothHands[i].y += glassBounces[i].y;

    glassBounces[i].x *= 0.6;
    glassBounces[i].y *= 0.6;

    let centerX = width / 2;
    let centerY = height / 2;
    let adjustedX = centerX + (smoothHands[i].x - centerX) * closenessFactor;
    let adjustedY = centerY + (smoothHands[i].y - centerY) * closenessFactor;

    glassCenters.push({ x: adjustedX, y: adjustedY, r: 250 * 0.25 });

    smoothHands[i].drawX = adjustedX;
    smoothHands[i].drawY = adjustedY;
  }

  for (let i = 0; i < 3; i++) {
    currentBG[i] = lerp(currentBG[i], targetBG[i], 0.5);
  }
  background(currentBG[0], currentBG[1], currentBG[2]);

  for (let i = 0; i < hands.length; i++) {
    let hand = smoothHands[i];
    if (!hand) continue;

    let distToCenter = dist(hand.drawX, hand.drawY, width/2, height/2);
    let maxDist = dist(0, 0, width/2, height/2);
    let scaleFactor = map(distToCenter, 0, maxDist, 1.4, 0.5);

    let glassW = 250 * scaleFactor;
    let glassH = (glassImg.height / glassImg.width) * glassW;
    push();
    translate(hand.drawX, hand.drawY);
    rotate(hand.angle);
    imageMode(CENTER);
    image(glassImg, 0, 0, glassW, glassH);
    pop();
  }

  handleClinkAndParticles(glassCenters);

  for (let i = splashParticles.length - 1; i >= 0; i--) {
    let p = splashParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life--;

    noStroke();
    fill(p.color[0], p.color[1], p.color[2], map(p.life, 60, 0, 255, 0));
    ellipse(p.x, p.y, p.size);

    if (p.life <= 0) splashParticles.splice(i, 1);
  }

  if (cheersTextTimer > 0) {
    cheersTextTimer--;

    let progress = cheersTextTimer / 60;
    let alpha = map(progress, 1, 0, 255, 0);

    push();
    textSize(64);
    textAlign(CENTER, CENTER);

    let glowColor = cheersColors[cheersText] || [255, 255, 255];
    drawingContext.shadowBlur = 50;
    drawingContext.shadowColor = `rgba(${glowColor[0]}, ${glowColor[1]}, ${glowColor[2]}, 0.8)`;

    let txtColor = cheersTextColors[cheersText] || [0, 0, 0];
    fill(txtColor[0], txtColor[1], txtColor[2], alpha);
    noStroke();

    text(cheersText, cheersX, cheersY);
    pop();
  }
}

function handleClinkAndParticles(glassCenters) {
  let newClinkPairs = new Set();

  for (let a = 0; a < glassCenters.length; a++) {
    for (let b = a + 1; b < glassCenters.length; b++) {
      let g1 = glassCenters[a];
      let g2 = glassCenters[b];
      let d = dist(g1.x, g1.y, g2.x, g2.y);

      let threshold = (g1.r + g2.r) * 1.5;

      if (d < threshold) {
        let key = `${a},${b}`;
        newClinkPairs.add(key);
        if (!lastClinkPairs.has(key)) {
          // 🔹 RANDOM CHEERS
          let randomIndex = floor(random(cheersWords.length));
          cheersText = cheersWords[randomIndex];

          if (cheersColors[cheersText]) {
            targetBG = cheersColors[cheersText];
          }

          cheersX = random(100, width - 100);
          cheersY = random(50, 150);

          cheersTextTimer = 60;

          let midX = (g1.x + g2.x) / 2;
          let midY = (g1.y + g2.y) / 2;
          for (let i = 0; i < 30; i++) {
            let angle = random(TWO_PI);
            let speed = random(2, 6);
            let colorChoice = random() < 0.5 ? [255, 182, 193] : [255, 255, 102];
            splashParticles.push({
              x: midX,
              y: midY,
              vx: cos(angle) * speed,
              vy: sin(angle) * speed - 2,
              size: random(5, 12),
              life: 60,
              color: colorChoice
            });
          }
        }
      }
    }
  }
  lastClinkPairs = newClinkPairs;
}

function gotHands(results) {
  hands = results;
}

function lerpAngle(a, b, t) {
  let diff = (b - a + PI) % (2 * PI) - PI;
  return a + diff * t;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
