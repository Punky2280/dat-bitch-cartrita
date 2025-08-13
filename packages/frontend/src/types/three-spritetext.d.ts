declare module 'three-spritetext' {
  import { Sprite } from 'three';
  export default class SpriteText extends Sprite {
    constructor(text?: string, textHeight?: number);
    text: string;
    color: string | number;
    textHeight: number;
    borderWidth?: number;
    borderColor?: string | number;
    backgroundColor?: string | number;
    padding?: number | number[];
  }
}
