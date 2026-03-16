import confetti from "canvas-confetti";

export function fireQuestComplete() {
  // Gold + purple burst
  const colors = ["#7c5bf0", "#f0a830", "#4ade80", "#60a5fa"];
  
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors,
    gravity: 0.8,
    scalar: 1.1,
  });

  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors,
    });
  }, 200);
}

export function fireSmallCelebration() {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { y: 0.7 },
    colors: ["#7c5bf0", "#f0a830"],
    gravity: 1,
    scalar: 0.8,
  });
}
