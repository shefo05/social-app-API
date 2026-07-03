import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "node:http";

export class RealtimeGateway {
  private _io: Server;

  constructor(server: HttpServer) {
    this._io = new Server(server, { cors: { origin: "*" } });
  }

  public get io(): Server {
    this._io.on("connection", (socket: Socket) => {
        console.log("new connection ", socket.id);
        //logic of code
        socket.on('disconnect', () => { 
            //logic of code
            console.log("disconnected ",socket.id);
            
        })

    });
      
    return this._io;
  }
}
 