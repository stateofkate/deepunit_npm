import * as os from 'os';
import * as readline from 'readline';
import { Files } from './Files';

export class Auth {
  private email: string | null = null;
  private readonly FILE_PATH: string = `${os.homedir()}/.deepunit`;

  public static async init(): Promise<Auth> {
    const auth = new Auth();
    await auth.loadEmail();
    if (!auth.email) {
      await auth.promptForEmail();
    }

    return auth;
  }

  private isValidEmail(email: string): boolean {
    const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return re.test(email);
  }

  private promptForEmail(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const ask = () => {
        rl.question('Please enter a valid email: ', (answer) => {
          if (this.isValidEmail(answer)) {
            this.email = answer;
            this.saveEmail();
            console.log('Email saved successfully!');
            rl.close();
            resolve();
          } else {
            console.log('Invalid email. Please try again.');
            ask();
          }
        });
      };

      ask();
    });
  }

  private saveEmail(): void {
    if (this.email) {
      Files.writeFileSync(this.FILE_PATH, `EMAIL=${this.email}`);
    }
  }

  private async loadEmail(): Promise<void> {
    return new Promise((resolve) => {
      if (Files.existsSync(this.FILE_PATH)) {
        const content = Files.readFileSync(this.FILE_PATH).toString();
        const matches = content.match(/EMAIL=(.+)/);
        if (matches && matches[1]) {
          this.email = matches[1];
          console.log(`Loaded email: ${this.email}`);
        }
      }
      resolve();
    });
  }

  getEmail(): string | null {
    return this.email;
  }
}
