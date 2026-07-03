// import { INotificationProvider } from "../notification.interface";
// import admin from "firebase-admin";

// export class FirebasePushNotificationProvider implements INotificationProvider {
//   private _client: admin.app.App;

//   constructor(config: any) {
//     this._client = admin.initializeApp({
//       credential: admin.credential.cert(config),
//     });
//   }

//   async send(
//     token: string,
//     data: { title: string; body: string },
//   ): Promise<void> {
//     await this._client.messaging().send({ token, data });
//   }

//   async sendAll(
//     tokens: string[],
//     data: { title: string; body: string },
//   ): Promise<void> {
//     // for (const token of tokens) {
//     //   await this.send(token, data);
//     // }
//     await Promise.all(tokens.map((token) => this.send(token, data)));
//   }
// }
