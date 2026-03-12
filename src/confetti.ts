import confetti from 'canvas-confetti';

export const fireFlowerConfetti = () => {
  const scalar = 2;
  const flower = confetti.shapeFromText({ text: '🌸', scalar });
  const sunflower = confetti.shapeFromText({ text: '🌻', scalar });
  const rose = confetti.shapeFromText({ text: '🌹', scalar });

  const defaults = {
    spread: 360,
    ticks: 60,
    gravity: 0.4,
    decay: 0.94,
    startVelocity: 30,
    shapes: [flower, sunflower, rose],
    scalar,
    zIndex: 10000
  };

  const shoot = () => {
    confetti({ ...defaults, particleCount: 25 });
    confetti({ ...defaults, particleCount: 15 });
  };

  setTimeout(shoot, 0);
  setTimeout(shoot, 150);
  setTimeout(shoot, 300);
};
