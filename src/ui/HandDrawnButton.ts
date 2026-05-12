import Phaser from "phaser";

export interface ButtonOptions {
  x?: number;
  y?: number;
  text?: string;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  paddingX?: number;
  paddingY?: number;
  wobble?: number;
  borderColor?: number;
  borderThickness?: number;
  onClick?: () => void;
}

export class HandDrawnButton extends Phaser.GameObjects.Container {
  private btnText: Phaser.GameObjects.Text;
  private btnBorder: Phaser.GameObjects.Graphics;
  private options: Required<ButtonOptions>;

  constructor(scene: Phaser.Scene, options: ButtonOptions = {}) {
    const defaultOptions: Required<ButtonOptions> = {
      x: 0,
      y: 0,
      text: "BUTTON",
      fontSize: "32px",
      fontFamily: "WuXin",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      paddingX: 30,
      paddingY: 12,
      wobble: 2,
      borderColor: 0xffffff,
      borderThickness: 3,
      onClick: () => {}
    };

    const finalOptions = { ...defaultOptions, ...options };
    super(scene, finalOptions.x, finalOptions.y);
    this.options = finalOptions;

    // Create text
    this.btnText = scene.add.text(0, 0, finalOptions.text, {
      fontFamily: finalOptions.fontFamily,
      fontSize: finalOptions.fontSize,
      color: finalOptions.color,
      padding: { x: finalOptions.paddingX, y: finalOptions.paddingY },
      stroke: finalOptions.stroke,
      strokeThickness: finalOptions.strokeThickness
    }).setOrigin(0.5);

    // Create border graphics
    this.btnBorder = scene.add.graphics();

    this.add([this.btnBorder, this.btnText]);
    scene.add.existing(this);

    // Initial draw
    this.drawBorder();

    // Interaction
    this.btnText.setInteractive({ useHandCursor: true });
    
    this.btnText.on("pointerover", () => {
      this.setAlpha(0.8);
      this.btnText.setScale(1.05);
      this.drawBorder(); // Redraw for fresh wobble
    });

    this.btnText.on("pointerout", () => {
      this.setAlpha(1);
      this.btnText.setScale(1);
      this.drawBorder();
    });

    this.btnText.on("pointerdown", () => {
      this.btnText.setScale(0.95);
    });

    this.btnText.on("pointerup", () => {
      this.btnText.setScale(1.05);
      if (this.options.onClick) this.options.onClick();
    });
  }

  private drawBorder() {
    this.btnBorder.clear();
    const w = this.btnText.displayWidth + 10;
    const h = this.btnText.displayHeight + 4;
    const x = -w / 2;
    const y = -h / 2;
    
    const wobble = this.options.wobble;
    const points = [
      { x: x, y: y },
      { x: x + w, y: y },
      { x: x + w, y: y + h },
      { x: x, y: y + h }
    ];
    
    // Slight randomization of corner points
    const wp = points.map(p => ({
      x: p.x + (Math.random() - 0.5) * wobble,
      y: p.y + (Math.random() - 0.5) * wobble
    }));

    this.btnBorder.lineStyle(this.options.borderThickness, this.options.borderColor, 1);
    
    // Draw twice for hand-drawn look
    for (let pass = 0; pass < 2; pass++) {
      this.btnBorder.beginPath();
      this.btnBorder.moveTo(wp[0].x + (Math.random()-0.5) * wobble, wp[0].y + (Math.random()-0.5) * wobble);
      for (let i = 0; i < wp.length; i++) {
        const next = wp[(i + 1) % wp.length];
        // Add midpoint for more hand-drawn wobbly lines
        const midX = (wp[i].x + next.x) / 2 + (Math.random() - 0.5) * wobble;
        const midY = (wp[i].y + next.y) / 2 + (Math.random() - 0.5) * wobble;
        
        this.btnBorder.lineTo(midX, midY);
        this.btnBorder.lineTo(next.x + (Math.random()-0.5) * wobble, next.y + (Math.random()-0.5) * wobble);
      }
      this.btnBorder.strokePath();
    }
  }

  public setText(text: string) {
    this.btnText.setText(text);
    this.drawBorder();
  }

  public setOnClick(callback: () => void) {
    this.options.onClick = callback;
  }
}
