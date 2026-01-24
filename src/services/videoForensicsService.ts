/**
 * Video Forensics Service
 * Analyzes facial micro-expressions and eye gaze using MediaPipe FaceMesh
 * For Mycroft 2.0 behavioral analysis
 */

// Types for video forensics
export interface EyeGazeResult {
  dominantDirection: 'left' | 'right' | 'straight' | 'up' | 'down';
  directionChanges: number;
  gazeHistory: Array<{ direction: string; timestamp: number }>;
  suspiciousPatterns: string[];
}

export interface MicroExpression {
  type: 'surprise' | 'fear' | 'contempt' | 'disgust' | 'anger' | 'happiness' | 'sadness' | 'neutral';
  confidence: number;
  timestamp: number;
  duration: number; // in ms
}

export interface FacialStressIndicators {
  browAsymmetry: number; // 0-1, higher = more asymmetric
  lipTension: number; // 0-1, higher = more tension
  blinkRate: number; // blinks per minute
  jawClenching: number; // 0-1
  overallScore: number; // 0-100
}

export interface PNLAnalysis {
  accessType: 'visual_memory' | 'visual_construct' | 'auditory_memory' | 'auditory_construct' | 'kinesthetic' | 'internal_dialog';
  signal: 'pro-conviction' | 'pro-bluff' | 'neutral';
  reasoning: string;
  confidence: number;
}

export interface VideoForensicsResult {
  eyeGaze: EyeGazeResult;
  microExpressions: {
    detected: MicroExpression[];
    dominantEmotion: string;
    emotionalVolatility: number; // 0-1, how much emotions changed
  };
  facialStress: FacialStressIndicators;
  pnlAnalysis: PNLAnalysis;
  overallFacialSuspicion: number; // 0-100
  timeline: Array<{
    timestamp: number;
    event: string;
    type: 'gaze' | 'expression' | 'stress';
    significance: 'low' | 'medium' | 'high';
  }>;
}

// Facial landmark indices for MediaPipe FaceMesh (468 landmarks)
const LANDMARK_INDICES = {
  // Eyes
  leftEyeCenter: 468, // Actually use iris landmarks
  rightEyeCenter: 473,
  leftEyeInner: 133,
  leftEyeOuter: 33,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  
  // Eyebrows
  leftBrowInner: 107,
  leftBrowOuter: 70,
  rightBrowInner: 336,
  rightBrowOuter: 300,
  
  // Lips
  upperLipTop: 13,
  lowerLipBottom: 14,
  leftLipCorner: 61,
  rightLipCorner: 291,
  
  // Jaw
  jawLeft: 172,
  jawRight: 397,
  chin: 152,
  
  // Nose (for reference point)
  noseTip: 4,
  noseBase: 168,
};

// Session state
interface ForensicsSession {
  startTime: number;
  frames: Array<{
    timestamp: number;
    landmarks: number[][];
    eyeGaze: string;
    expressions: string[];
  }>;
  blinkCount: number;
  lastBlinkTime: number;
  gazeDirections: string[];
}

let currentSession: ForensicsSession | null = null;

/**
 * Start a new video forensics session
 */
export function startVideoForensicsSession(): void {
  currentSession = {
    startTime: Date.now(),
    frames: [],
    blinkCount: 0,
    lastBlinkTime: 0,
    gazeDirections: [],
  };
  console.log('[VideoForensics] Session started');
}

/**
 * Analyze a single frame of facial landmarks
 * This is called for each frame from the video
 */
export function analyzeFrame(landmarks: number[][]): {
  eyeGaze: string;
  expressions: string[];
  stressIndicators: Partial<FacialStressIndicators>;
} {
  if (!currentSession) {
    startVideoForensicsSession();
  }
  
  const timestamp = Date.now() - (currentSession?.startTime || Date.now());
  
  // Analyze eye gaze direction
  const eyeGaze = analyzeEyeGaze(landmarks);
  
  // Detect micro-expressions
  const expressions = detectMicroExpressions(landmarks);
  
  // Calculate stress indicators
  const stressIndicators = calculateStressIndicators(landmarks);
  
  // Check for blinks
  const isBlinking = detectBlink(landmarks);
  if (isBlinking && currentSession) {
    const timeSinceLastBlink = timestamp - currentSession.lastBlinkTime;
    if (timeSinceLastBlink > 200) { // Minimum 200ms between blinks
      currentSession.blinkCount++;
      currentSession.lastBlinkTime = timestamp;
    }
  }
  
  // Store frame data
  if (currentSession) {
    currentSession.frames.push({
      timestamp,
      landmarks,
      eyeGaze,
      expressions,
    });
    currentSession.gazeDirections.push(eyeGaze);
  }
  
  return { eyeGaze, expressions, stressIndicators };
}

/**
 * Analyze eye gaze direction based on iris position relative to eye corners
 */
function analyzeEyeGaze(landmarks: number[][]): string {
  if (!landmarks || landmarks.length < 478) {
    return 'straight';
  }
  
  try {
    // Get iris centers (landmarks 468-472 for left, 473-477 for right)
    const leftIris = landmarks[468] || landmarks[LANDMARK_INDICES.leftEyeCenter];
    const rightIris = landmarks[473] || landmarks[LANDMARK_INDICES.rightEyeCenter];
    
    // Get eye corners for reference
    const leftEyeInner = landmarks[LANDMARK_INDICES.leftEyeInner];
    const leftEyeOuter = landmarks[LANDMARK_INDICES.leftEyeOuter];
    const rightEyeInner = landmarks[LANDMARK_INDICES.rightEyeInner];
    const rightEyeOuter = landmarks[LANDMARK_INDICES.rightEyeOuter];
    
    if (!leftIris || !rightIris || !leftEyeInner || !leftEyeOuter) {
      return 'straight';
    }
    
    // Calculate horizontal position of iris relative to eye width
    const leftEyeWidth = Math.abs(leftEyeOuter[0] - leftEyeInner[0]);
    const leftIrisRelativeX = (leftIris[0] - leftEyeOuter[0]) / leftEyeWidth;
    
    const rightEyeWidth = Math.abs(rightEyeOuter[0] - rightEyeInner[0]);
    const rightIrisRelativeX = (rightIris[0] - rightEyeOuter[0]) / rightEyeWidth;
    
    // Average position
    const avgPosition = (leftIrisRelativeX + rightIrisRelativeX) / 2;
    
    // Also check vertical gaze
    const leftEyeHeight = Math.abs(landmarks[LANDMARK_INDICES.leftEyeTop][1] - landmarks[LANDMARK_INDICES.leftEyeBottom][1]);
    const leftIrisRelativeY = (leftIris[1] - landmarks[LANDMARK_INDICES.leftEyeTop][1]) / leftEyeHeight;
    
    // Determine gaze direction
    if (leftIrisRelativeY < 0.35) {
      return 'up';
    } else if (leftIrisRelativeY > 0.65) {
      return 'down';
    } else if (avgPosition < 0.4) {
      return 'left';
    } else if (avgPosition > 0.6) {
      return 'right';
    }
    
    return 'straight';
  } catch (error) {
    console.warn('[VideoForensics] Error analyzing eye gaze:', error);
    return 'straight';
  }
}

/**
 * Detect micro-expressions based on facial muscle movements
 */
function detectMicroExpressions(landmarks: number[][]): string[] {
  const expressions: string[] = [];
  
  if (!landmarks || landmarks.length < 400) {
    return ['neutral'];
  }
  
  try {
    // Calculate key facial metrics
    const browRaise = calculateBrowRaise(landmarks);
    const mouthOpenness = calculateMouthOpenness(landmarks);
    const lipCornerPull = calculateLipCornerPull(landmarks);
    const browFurrow = calculateBrowFurrow(landmarks);
    
    // Detect expressions based on combinations
    if (browRaise > 0.6 && mouthOpenness > 0.3) {
      expressions.push('surprise');
    }
    
    if (browFurrow > 0.5 && lipCornerPull < -0.2) {
      expressions.push('anger');
    }
    
    if (lipCornerPull > 0.3) {
      expressions.push('happiness');
    }
    
    if (lipCornerPull < -0.3 && browFurrow > 0.3) {
      expressions.push('sadness');
    }
    
    if (browRaise > 0.4 && browFurrow > 0.4) {
      expressions.push('fear');
    }
    
    // Asymmetric expressions often indicate deception
    const asymmetry = calculateExpressionAsymmetry(landmarks);
    if (asymmetry > 0.4) {
      expressions.push('contempt');
    }
    
    if (expressions.length === 0) {
      expressions.push('neutral');
    }
    
    return expressions;
  } catch (error) {
    console.warn('[VideoForensics] Error detecting expressions:', error);
    return ['neutral'];
  }
}

/**
 * Calculate stress indicators from facial landmarks
 */
function calculateStressIndicators(landmarks: number[][]): Partial<FacialStressIndicators> {
  if (!landmarks || landmarks.length < 400) {
    return { overallScore: 0 };
  }
  
  try {
    const browAsymmetry = calculateBrowAsymmetry(landmarks);
    const lipTension = calculateLipTension(landmarks);
    const jawClenching = calculateJawClenching(landmarks);
    
    const overallScore = Math.min(100, (browAsymmetry * 30 + lipTension * 40 + jawClenching * 30));
    
    return {
      browAsymmetry,
      lipTension,
      jawClenching,
      overallScore,
    };
  } catch (error) {
    return { overallScore: 0 };
  }
}

/**
 * Detect if eyes are closed (blink)
 */
function detectBlink(landmarks: number[][]): boolean {
  if (!landmarks || landmarks.length < 400) return false;
  
  try {
    const leftEyeTop = landmarks[LANDMARK_INDICES.leftEyeTop];
    const leftEyeBottom = landmarks[LANDMARK_INDICES.leftEyeBottom];
    const rightEyeTop = landmarks[LANDMARK_INDICES.rightEyeTop];
    const rightEyeBottom = landmarks[LANDMARK_INDICES.rightEyeBottom];
    
    const leftEyeOpenness = Math.abs(leftEyeTop[1] - leftEyeBottom[1]);
    const rightEyeOpenness = Math.abs(rightEyeTop[1] - rightEyeBottom[1]);
    
    // Eyes are considered closed if openness is very small
    return leftEyeOpenness < 0.02 && rightEyeOpenness < 0.02;
  } catch {
    return false;
  }
}

// Helper calculation functions
function calculateBrowRaise(landmarks: number[][]): number {
  const leftBrow = landmarks[LANDMARK_INDICES.leftBrowInner];
  const rightBrow = landmarks[LANDMARK_INDICES.rightBrowInner];
  const nose = landmarks[LANDMARK_INDICES.noseTip];
  
  if (!leftBrow || !rightBrow || !nose) return 0;
  
  const avgBrowY = (leftBrow[1] + rightBrow[1]) / 2;
  const distance = Math.abs(avgBrowY - nose[1]);
  
  // Normalize to 0-1 range (higher = more raised)
  return Math.min(1, Math.max(0, (distance - 0.1) / 0.15));
}

function calculateMouthOpenness(landmarks: number[][]): number {
  const upperLip = landmarks[LANDMARK_INDICES.upperLipTop];
  const lowerLip = landmarks[LANDMARK_INDICES.lowerLipBottom];
  
  if (!upperLip || !lowerLip) return 0;
  
  return Math.min(1, Math.abs(upperLip[1] - lowerLip[1]) * 5);
}

function calculateLipCornerPull(landmarks: number[][]): number {
  const leftCorner = landmarks[LANDMARK_INDICES.leftLipCorner];
  const rightCorner = landmarks[LANDMARK_INDICES.rightLipCorner];
  const upperLip = landmarks[LANDMARK_INDICES.upperLipTop];
  
  if (!leftCorner || !rightCorner || !upperLip) return 0;
  
  const avgCornerY = (leftCorner[1] + rightCorner[1]) / 2;
  // Negative = corners pulled down (frown), positive = pulled up (smile)
  return (upperLip[1] - avgCornerY) * 10;
}

function calculateBrowFurrow(landmarks: number[][]): number {
  const leftBrowInner = landmarks[LANDMARK_INDICES.leftBrowInner];
  const rightBrowInner = landmarks[LANDMARK_INDICES.rightBrowInner];
  
  if (!leftBrowInner || !rightBrowInner) return 0;
  
  // How close are the inner brow points (furrow = closer together)
  const distance = Math.abs(leftBrowInner[0] - rightBrowInner[0]);
  return Math.max(0, 1 - distance * 5);
}

function calculateBrowAsymmetry(landmarks: number[][]): number {
  const leftBrowInner = landmarks[LANDMARK_INDICES.leftBrowInner];
  const leftBrowOuter = landmarks[LANDMARK_INDICES.leftBrowOuter];
  const rightBrowInner = landmarks[LANDMARK_INDICES.rightBrowInner];
  const rightBrowOuter = landmarks[LANDMARK_INDICES.rightBrowOuter];
  
  if (!leftBrowInner || !leftBrowOuter || !rightBrowInner || !rightBrowOuter) return 0;
  
  const leftBrowAngle = Math.atan2(leftBrowOuter[1] - leftBrowInner[1], leftBrowOuter[0] - leftBrowInner[0]);
  const rightBrowAngle = Math.atan2(rightBrowOuter[1] - rightBrowInner[1], rightBrowOuter[0] - rightBrowInner[0]);
  
  return Math.min(1, Math.abs(leftBrowAngle - rightBrowAngle) * 2);
}

function calculateLipTension(landmarks: number[][]): number {
  const leftCorner = landmarks[LANDMARK_INDICES.leftLipCorner];
  const rightCorner = landmarks[LANDMARK_INDICES.rightLipCorner];
  const upperLip = landmarks[LANDMARK_INDICES.upperLipTop];
  const lowerLip = landmarks[LANDMARK_INDICES.lowerLipBottom];
  
  if (!leftCorner || !rightCorner || !upperLip || !lowerLip) return 0;
  
  // Tension = lips pressed together tightly
  const lipDistance = Math.abs(upperLip[1] - lowerLip[1]);
  return Math.max(0, 1 - lipDistance * 10);
}

function calculateJawClenching(landmarks: number[][]): number {
  const jawLeft = landmarks[LANDMARK_INDICES.jawLeft];
  const jawRight = landmarks[LANDMARK_INDICES.jawRight];
  
  if (!jawLeft || !jawRight) return 0;
  
  // Clenched jaw = jaw muscles bulge, making face wider
  const jawWidth = Math.abs(jawLeft[0] - jawRight[0]);
  return Math.min(1, jawWidth * 2);
}

function calculateExpressionAsymmetry(landmarks: number[][]): number {
  const leftCorner = landmarks[LANDMARK_INDICES.leftLipCorner];
  const rightCorner = landmarks[LANDMARK_INDICES.rightLipCorner];
  
  if (!leftCorner || !rightCorner) return 0;
  
  // Check vertical asymmetry of lip corners
  return Math.min(1, Math.abs(leftCorner[1] - rightCorner[1]) * 10);
}

/**
 * Finalize the session and generate complete analysis
 */
export function finalizeVideoForensicsSession(): VideoForensicsResult {
  if (!currentSession || currentSession.frames.length === 0) {
    return getDefaultResult();
  }
  
  const durationMs = Date.now() - currentSession.startTime;
  const durationMin = durationMs / 60000;
  
  // Analyze eye gaze patterns
  const eyeGaze = analyzeGazePatterns(currentSession.gazeDirections);
  
  // Analyze micro-expressions over time
  const microExpressions = analyzeMicroExpressionPatterns(currentSession.frames);
  
  // Calculate facial stress
  const blinkRate = durationMin > 0 ? currentSession.blinkCount / durationMin : 0;
  const lastFrame = currentSession.frames[currentSession.frames.length - 1];
  const stressFromLastFrame = lastFrame ? calculateStressIndicators(lastFrame.landmarks) : {};
  
  const facialStress: FacialStressIndicators = {
    browAsymmetry: stressFromLastFrame.browAsymmetry || 0,
    lipTension: stressFromLastFrame.lipTension || 0,
    blinkRate,
    jawClenching: stressFromLastFrame.jawClenching || 0,
    overallScore: calculateOverallStress(stressFromLastFrame, blinkRate),
  };
  
  // PNL Analysis based on gaze patterns
  const pnlAnalysis = analyzePNLPatterns(eyeGaze);
  
  // Build timeline of significant events
  const timeline = buildEventTimeline(currentSession.frames, eyeGaze, microExpressions);
  
  // Calculate overall facial suspicion
  const overallFacialSuspicion = calculateOverallSuspicion(eyeGaze, microExpressions, facialStress, pnlAnalysis);
  
  // Clear session
  const result: VideoForensicsResult = {
    eyeGaze,
    microExpressions,
    facialStress,
    pnlAnalysis,
    overallFacialSuspicion,
    timeline,
  };
  
  currentSession = null;
  console.log('[VideoForensics] Session finalized:', result);
  
  return result;
}

function analyzeGazePatterns(gazeDirections: string[]): EyeGazeResult {
  const counts: Record<string, number> = {
    left: 0,
    right: 0,
    straight: 0,
    up: 0,
    down: 0,
  };
  
  let directionChanges = 0;
  let lastDirection = '';
  const gazeHistory: Array<{ direction: string; timestamp: number }> = [];
  
  gazeDirections.forEach((direction, index) => {
    counts[direction] = (counts[direction] || 0) + 1;
    
    if (lastDirection && direction !== lastDirection) {
      directionChanges++;
    }
    lastDirection = direction;
    
    // Sample every 10 frames for history
    if (index % 10 === 0) {
      gazeHistory.push({ direction, timestamp: index * 33 }); // Assume 30fps
    }
  });
  
  // Find dominant direction
  let dominantDirection: 'left' | 'right' | 'straight' | 'up' | 'down' = 'straight';
  let maxCount = 0;
  
  for (const [dir, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantDirection = dir as typeof dominantDirection;
    }
  }
  
  // Identify suspicious patterns
  const suspiciousPatterns: string[] = [];
  
  // High direction changes indicate nervousness
  if (directionChanges > gazeDirections.length * 0.3) {
    suspiciousPatterns.push('Olhar evasivo - mudanças frequentes de direção');
  }
  
  // Looking left (visual construct in NLP) while speaking could indicate fabrication
  if (counts.left > gazeDirections.length * 0.4) {
    suspiciousPatterns.push('Predominância de olhar para esquerda - possível construção visual');
  }
  
  // Avoiding eye contact
  if (counts.straight < gazeDirections.length * 0.2) {
    suspiciousPatterns.push('Evitando contato visual direto');
  }
  
  return {
    dominantDirection,
    directionChanges,
    gazeHistory,
    suspiciousPatterns,
  };
}

function analyzeMicroExpressionPatterns(frames: ForensicsSession['frames']): VideoForensicsResult['microExpressions'] {
  const expressionCounts: Record<string, number> = {};
  const detected: MicroExpression[] = [];
  let lastExpressions: string[] = [];
  let expressionStartTime = 0;
  
  frames.forEach((frame, index) => {
    frame.expressions.forEach(expr => {
      expressionCounts[expr] = (expressionCounts[expr] || 0) + 1;
    });
    
    // Detect expression changes (potential micro-expressions)
    const newExpressions = frame.expressions.filter(e => !lastExpressions.includes(e));
    
    if (newExpressions.length > 0 && lastExpressions.length > 0) {
      // Previous expression ended
      const duration = frame.timestamp - expressionStartTime;
      
      if (duration < 500 && duration > 40) { // Micro-expression: 40ms-500ms
        lastExpressions.forEach(expr => {
          if (expr !== 'neutral') {
            detected.push({
              type: expr as MicroExpression['type'],
              confidence: 0.7,
              timestamp: expressionStartTime,
              duration,
            });
          }
        });
      }
      
      expressionStartTime = frame.timestamp;
    }
    
    lastExpressions = frame.expressions;
  });
  
  // Find dominant emotion
  let dominantEmotion = 'neutral';
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(expressionCounts)) {
    if (count > maxCount && emotion !== 'neutral') {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }
  
  // Calculate emotional volatility
  const uniqueExpressions = new Set(frames.flatMap(f => f.expressions)).size;
  const emotionalVolatility = Math.min(1, (uniqueExpressions - 1) / 5);
  
  return {
    detected,
    dominantEmotion,
    emotionalVolatility,
  };
}

function analyzePNLPatterns(eyeGaze: EyeGazeResult): PNLAnalysis {
  const { dominantDirection, suspiciousPatterns } = eyeGaze;
  
  // NLP Eye Accessing Cues (for right-handed people):
  // Up-Right: Visual Remembered (truth)
  // Up-Left: Visual Constructed (fabrication)
  // Right: Auditory Remembered (truth)
  // Left: Auditory Constructed (fabrication)
  // Down-Right: Kinesthetic (feelings)
  // Down-Left: Internal Dialog (self-talk)
  
  let accessType: PNLAnalysis['accessType'];
  let signal: PNLAnalysis['signal'];
  let reasoning: string;
  let confidence: number;
  
  switch (dominantDirection) {
    case 'right':
      accessType = 'auditory_memory';
      signal = 'pro-conviction';
      reasoning = 'Olhar predominante para direita indica acesso a memórias auditivas - padrão de recordação genuína';
      confidence = 0.7;
      break;
      
    case 'left':
      accessType = 'auditory_construct';
      signal = 'pro-bluff';
      reasoning = 'Olhar predominante para esquerda sugere construção auditiva - possível fabricação de história';
      confidence = 0.65;
      break;
      
    case 'up':
      // Need more context to determine if visual memory or construct
      accessType = 'visual_memory';
      signal = 'neutral';
      reasoning = 'Olhar para cima indica acesso visual - requer análise do contexto lateral';
      confidence = 0.5;
      break;
      
    case 'down':
      accessType = 'kinesthetic';
      signal = 'neutral';
      reasoning = 'Olhar para baixo sugere acesso cinestésico ou diálogo interno - processando emoções';
      confidence = 0.6;
      break;
      
    default:
      accessType = 'visual_memory';
      signal = 'pro-conviction';
      reasoning = 'Contato visual direto mantido - padrão de confiança e convicção';
      confidence = 0.75;
  }
  
  // Adjust based on suspicious patterns
  if (suspiciousPatterns.length > 0) {
    confidence = Math.max(0.4, confidence - 0.1 * suspiciousPatterns.length);
    if (suspiciousPatterns.some(p => p.includes('construção visual'))) {
      signal = 'pro-bluff';
    }
  }
  
  return { accessType, signal, reasoning, confidence };
}

function calculateOverallStress(
  stressIndicators: Partial<FacialStressIndicators>,
  blinkRate: number
): number {
  // Normal blink rate: 15-20 per minute
  // Stress increases blink rate
  const blinkStress = blinkRate > 25 ? Math.min(30, (blinkRate - 25) * 2) : 0;
  
  const baseStress = (
    (stressIndicators.browAsymmetry || 0) * 25 +
    (stressIndicators.lipTension || 0) * 30 +
    (stressIndicators.jawClenching || 0) * 25
  );
  
  return Math.min(100, baseStress + blinkStress);
}

function buildEventTimeline(
  frames: ForensicsSession['frames'],
  eyeGaze: EyeGazeResult,
  microExpressions: VideoForensicsResult['microExpressions']
): VideoForensicsResult['timeline'] {
  const timeline: VideoForensicsResult['timeline'] = [];
  
  // Add gaze-related events
  eyeGaze.suspiciousPatterns.forEach((pattern, index) => {
    timeline.push({
      timestamp: 1000 + index * 500, // Distribute throughout
      event: pattern,
      type: 'gaze',
      significance: 'medium',
    });
  });
  
  // Add micro-expression events
  microExpressions.detected.forEach(expr => {
    timeline.push({
      timestamp: expr.timestamp,
      event: `Micro-expressão detectada: ${expr.type} (${Math.round(expr.duration)}ms)`,
      type: 'expression',
      significance: expr.duration < 200 ? 'high' : 'medium',
    });
  });
  
  // Sort by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp);
  
  return timeline;
}

function calculateOverallSuspicion(
  eyeGaze: EyeGazeResult,
  microExpressions: VideoForensicsResult['microExpressions'],
  facialStress: FacialStressIndicators,
  pnlAnalysis: PNLAnalysis
): number {
  let suspicion = 0;
  
  // Eye gaze contributes 25%
  suspicion += eyeGaze.suspiciousPatterns.length * 8;
  if (eyeGaze.dominantDirection === 'left') suspicion += 10;
  if (eyeGaze.directionChanges > 20) suspicion += 5;
  
  // Micro-expressions contribute 25%
  const negativeExpressions = microExpressions.detected.filter(
    e => ['fear', 'contempt', 'surprise'].includes(e.type)
  ).length;
  suspicion += negativeExpressions * 5;
  suspicion += microExpressions.emotionalVolatility * 15;
  
  // Facial stress contributes 25%
  suspicion += facialStress.overallScore * 0.25;
  
  // PNL analysis contributes 25%
  if (pnlAnalysis.signal === 'pro-bluff') {
    suspicion += 25 * pnlAnalysis.confidence;
  } else if (pnlAnalysis.signal === 'pro-conviction') {
    suspicion -= 10 * pnlAnalysis.confidence;
  }
  
  return Math.max(0, Math.min(100, suspicion));
}

function getDefaultResult(): VideoForensicsResult {
  return {
    eyeGaze: {
      dominantDirection: 'straight',
      directionChanges: 0,
      gazeHistory: [],
      suspiciousPatterns: [],
    },
    microExpressions: {
      detected: [],
      dominantEmotion: 'neutral',
      emotionalVolatility: 0,
    },
    facialStress: {
      browAsymmetry: 0,
      lipTension: 0,
      blinkRate: 0,
      jawClenching: 0,
      overallScore: 0,
    },
    pnlAnalysis: {
      accessType: 'visual_memory',
      signal: 'neutral',
      reasoning: 'Análise inconclusiva - dados insuficientes',
      confidence: 0,
    },
    overallFacialSuspicion: 0,
    timeline: [],
  };
}

/**
 * Generate human-readable summary for the jury
 */
export function generateFacialAnalysisSummary(result: VideoForensicsResult): {
  headline: string;
  details: string[];
  conclusion: string;
} {
  const { eyeGaze, microExpressions, facialStress, pnlAnalysis, overallFacialSuspicion } = result;
  
  let headline: string;
  if (overallFacialSuspicion < 30) {
    headline = '✅ Expressões faciais consistentes com convicção';
  } else if (overallFacialSuspicion < 60) {
    headline = '⚠️ Sinais faciais ambíguos detectados';
  } else {
    headline = '🚨 Indicadores faciais sugerem possível dissimulação';
  }
  
  const details: string[] = [];
  
  // Eye gaze detail
  const gazeLabel = {
    left: 'esquerda',
    right: 'direita',
    straight: 'direto',
    up: 'para cima',
    down: 'para baixo',
  };
  details.push(`👁️ Olhar predominante: ${gazeLabel[eyeGaze.dominantDirection]} (${eyeGaze.directionChanges} mudanças)`);
  
  // Micro-expressions
  if (microExpressions.detected.length > 0) {
    const types = [...new Set(microExpressions.detected.map(e => e.type))];
    details.push(`😶 Micro-expressões: ${types.join(', ')}`);
  } else {
    details.push('😶 Nenhuma micro-expressão significativa detectada');
  }
  
  // Stress level
  if (facialStress.overallScore > 50) {
    details.push(`😰 Alto nível de tensão facial (${Math.round(facialStress.overallScore)}%)`);
  } else if (facialStress.overallScore > 25) {
    details.push(`😐 Tensão facial moderada (${Math.round(facialStress.overallScore)}%)`);
  } else {
    details.push(`😌 Baixa tensão facial (${Math.round(facialStress.overallScore)}%)`);
  }
  
  // PNL insight
  details.push(`🧠 ${pnlAnalysis.reasoning}`);
  
  // Add suspicious patterns
  eyeGaze.suspiciousPatterns.forEach(pattern => {
    details.push(`⚠️ ${pattern}`);
  });
  
  let conclusion: string;
  if (pnlAnalysis.signal === 'pro-conviction') {
    conclusion = 'Padrões faciais sugerem que o jogador está acessando memórias genuínas.';
  } else if (pnlAnalysis.signal === 'pro-bluff') {
    conclusion = 'Padrões faciais sugerem possível construção ou fabricação de narrativa.';
  } else {
    conclusion = 'Análise inconclusiva - padrões faciais neutros.';
  }
  
  return { headline, details, conclusion };
}
