import console, {Log} from './Log';
export const logAnchor = console.anchor
// ANSI color escape sequences
enum COLORS {
  reset = '\x1b[0m',
  red = '\x1b[31m',
  yellow = '\x1b[33m',
  blue = '\x1b[34m',
  lightBlue = '\x1b[96m',
  green = '\x1b[32m',
  white = '\x1b[37m',
}
export class Color {
  static colorize(text: string, color: COLORS) {
    return color + text + COLORS.reset;
  }
  
  static red(text: string) {
    return Color.colorize(text, COLORS.red);
  }
  
  static yellow(text: string) {
    return Color.colorize(text, COLORS.yellow);
  }
  
  static blue(text: string) {
    return Color.colorize(text, COLORS.blue);
  }
  
  static lightBlue(text: string) {
    return Color.colorize(text, COLORS.lightBlue);
  }
  
  static green(text: string) {
    return Color.colorize(text, COLORS.green);
  }
  
  static white(text: string) {
    return Color.colorize(text, COLORS.white);
  }
}
