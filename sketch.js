let handPose;
let video;
let hands = [];
let glassImg;

let smoothHands = {};
let smoothingFactor = 0.2;
let clinkEffects = [];
let lastClinkPairs = new Set();
let glassBounces = {}; // bounce vectors

let cheersTextTimer = 0; // frames to show CHEERS text
let bubbleFont;
let bgImg;

function preload() {
  handPose = ml5.handPose();
  glassImg = loadImage("Lemonade Drawing 3.png");
  
  // Load your new background image
  bgImg = loadImage("yourBackground.png"); // replace with your file name
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

function preload() {
  handPose = ml5.handPose();
  glassImg = loadImage("Lemonade Drawing 3.png");
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  handPose.detectStart(video, gotHands);

  textFont('Fredoka One'); // use Google Font by name
  textStyle(BOLD);
}

function draw() {
  let glassCenters = [];

  // --- Update hand positions ---
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

    glassCenters.push({ x: smoothHands[i].x, y: smoothHands[i].y, r: 250 * 0.25 });
  }

  // --- Compute background color based on closeness ---
  let closeness = 0;
  if (glassCenters.length >= 2) {
    let minDist = Infinity;
    for (let a = 0; a < glassCenters.length; a++) {
      for (let b = a + 1; b < glassCenters.length; b++) {
        let d = dist(glassCenters[a].x, glassCenters[a].y, glassCenters[b].x, glassCenters[b].y);
        if (d < minDist) minDist = d;
      }
    }
    closeness = constrain(map(minDist, 0, 250, 1, 0), 0, 1);
  }

  // --- Background (calm beige based on closeness) ---
  let baseColor = lerpColor(color(67,92,82), color(193,217,205), 
                            
                            closeness); // beige target
  background(baseColor);

  // --- Draw glasses ---
  for (let i = 0; i < hands.length; i++) {
    let hand = smoothHands[i];
    if (!hand) continue;
    let glassW = 250;
    let glassH = (glassImg.height / glassImg.width) * glassW;
    push();
    translate(hand.x, hand.y);
    rotate(hand.angle);
    imageMode(CENTER);
    image(glassImg, 0, 0, glassW, glassH);
    pop();
  }

  // --- Handle clink detection and splash particles ---
  handleClinkAndParticles(glassCenters);

  // --- Draw CHEERS text if timer active ---
  if (cheersTextTimer > 0) {
    cheersTextTimer--;

    push();
    textSize(64);
    textAlign(CENTER, CENTER);

    // Shadow for 3D bubble effect
    drawingContext.shadowOffsetX = 5;
    drawingContext.shadowOffsetY = 5;
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = 'rgba(0,0,0,0.5)';

    fill('#F8B3AF'); // lavender bubble fill
    stroke(206,235,244);
    strokeWeight(10); // thick outline

    text("CHEERS!", width / 2, height / 4);
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
      let threshold = (g1.r + g2.r) * 0.85;

      if (d < threshold) {
        let key = `${a},${b}`;
        newClinkPairs.add(key);
        if (!lastClinkPairs.has(key)) {
          cheersTextTimer = 30; // show CHEERS for 30 frames (~0.5 sec)

          let midX = (g1.x + g2.x) / 2;
          let midY = (g1.y + g2.y) / 2;
          for (let p = 0; p < 25; p++) {
            let aAng = random(-PI * 5 / 6, -PI / 6);
            let speed = random(4, 9);
            let colorChoice = random() < 0.5 ? [255, 230, 80] : [255, 105, 180];

            clinkEffects.push({
              x: midX,
              y: midY,
              vx: cos(aAng) * speed,
              vy: sin(aAng) * speed,
              life: 50,
              maxLife: 50,
              size: random(6, 10),
              col: colorChoice,
              angle: random(TWO_PI),
              wobbleX: random(0.5, 1.5),
              wobbleY: random(0.5, 1.5)
            });
          }

          let dx = g1.x - g2.x;
          let dy = g1.y - g2.y;
          let mag = sqrt(dx * dx + dy * dy) || 1;
          dx /= mag;
          dy /= mag;
          glassBounces[a].x += dx * 4;
          glassBounces[a].y += dy * 4;
          glassBounces[b].x -= dx * 4;
          glassBounces[b].y -= dy * 4;
        }
      }
    }
  }

  lastClinkPairs = newClinkPairs;

  // --- Draw particles ---
  for (let i = clinkEffects.length - 1; i >= 0; i--) {
    let p = clinkEffects[i];
    noStroke();

    let lifeRatio = p.life / p.maxLife;
    let currentSize = p.size * lifeRatio;
    let alpha = 255 * lifeRatio;

    push();
    translate(p.x, p.y);
    rotate(p.angle + sin(frameCount * 0.1) * p.wobbleX);
    fill(p.col[0], p.col[1], p.col[2], alpha);
    ellipse(0, 0, currentSize * 1.1, currentSize);
    fill(255, 255, 255, 180 * lifeRatio);
    ellipse(-currentSize * 0.2, -currentSize * 0.2, currentSize * 0.4, currentSize * 0.4);
    pop();

    p.x += p.vx + sin(frameCount * 0.05) * p.wobbleX;
    p.y += p.vy + cos(frameCount * 0.05) * p.wobbleY;
    p.vy += 0.25;
    p.life--;

    if (p.life <= 0) clinkEffects.splice(i, 1);
  }
}

function gotHands(results) {
  hands = results;
}

function lerpAngle(a, b, t) {
  let diff = (b - a + PI) % (2 * PI) - PI;
  return a + diff * t;
}
