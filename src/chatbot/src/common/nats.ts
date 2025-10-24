import { connect, NatsConnection as _NatsClient, NatsError, JSONCodec, StringCodec, RequestOptions } from "nats";
import config from "../config.js";
import {
  HelperEgressPositionChanged,
  HelperGetGlobalInfoRequest,
  HelperGetGlobalInfoResponse,
  HelperGetInstrumentRequest,
  HelperGetInstrumentResponse,
  HelperGetInstrumentsRequest,
  HelperGetInstrumentsResponse,
  HelperGetUserAssetsRequest,
  HelperGetUserAssetsResponse,
  HelperGetUserPositionsRequest,
  HelperGetUserPositionsResponse,
  HelperGetUserPositionVerboseTimeDataRequest,
  HelperGetUserPositionVerboseTimeDataResponse,
  HelperGetUserRequest,
  HelperGetUserResponse,
  HelperGetUserStrategyRequest,
  HelperGetUserStrategyResponse,
  HelperHotInstrumentResponse,
  HelperHotInstrumentsRequest,
  HelperResponse,
  HelperUpdateUserStrategyRequest,
  HelperUpdateUserStrategyResponse,
  HelperUserWithdrawRequest,
  HelperUserWithdrawResponse,
  NatsSubject,
} from "../types/nats.js";

export class NatsConnection {
  uri: string;
  timeout: number;
  client: _NatsClient | null = null;

  constructor(uri: string, timeout: number) {
    this.uri = uri;
    this.timeout = timeout;
  }

  async connect() {
    this.client = await connect({
      servers: [this.uri],
      timeout: this.timeout * 1000,
    });
  }

  async disconnect() {
    if (this.client) {
      await this.client.drain();
      await this.client.close();
      this.client = null;
    }
  }

  subscribeNotification(handler: (userId: string, data: HelperEgressPositionChanged) => Promise<void>) {
    if (!this.client) {
      throw new Error("internal error: NATS client is not connected.");
    }
    const sub = this.client.subscribe(NatsSubject.Notification);
    const sc = StringCodec();
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          await handler(msg.subject, data);
        } catch (err) {
          // await handler(msg.subject, sc.decode(msg.data));
          console.error("Notification handler error:", err);
        }
      }
    })();
    return sub;
  }

  async request<Req, Resp extends HelperResponse>(subject: NatsSubject, payload: Req, opts: RequestOptions = { timeout: 10000 }): Promise<Resp> {
    if (!this.client) {
      throw new Error("internal error: NATS client is not connected.");
    }
    try {
      const sc = StringCodec();
      const msg = await this.client.request(subject, sc.encode(JSON.stringify(payload)), opts);
      const responseJson = sc.decode(msg.data);
      const response: Resp = JSON.parse(responseJson);
      if (response.error) {
        console.error(`NATS Server report error: ${response.error}`);
        throw new Error(response.error);
      }
      return response;
    } catch (error) {
      console.error(`NATS request error:`);
      console.error(`[Subject]: ${subject}`);
      console.error(`[Payload]: ${JSON.stringify(payload)}`);
      console.error(error);
      throw error;
    }
  }

  async getUserAssets(payload: HelperGetUserAssetsRequest): Promise<HelperGetUserAssetsResponse> {
    return this.request(NatsSubject.GetUserAssets, payload);
  }

  async getInstruments(payload: HelperGetInstrumentsRequest): Promise<HelperGetInstrumentsResponse> {
    return this.request(NatsSubject.GetInstruments, payload);
  }

  async getUserPositions(payload: HelperGetUserPositionsRequest): Promise<HelperGetUserPositionsResponse> {
    return this.request(NatsSubject.GetUserPositions, payload);
  }
  async getUserPositionsChartData(payload: HelperGetUserPositionVerboseTimeDataRequest): Promise<HelperGetUserPositionVerboseTimeDataResponse> {
    return this.request(NatsSubject.GetUserPositionChartData, payload, { timeout: 5000 });
  }

  async getGlobalInfo(payload: HelperGetGlobalInfoRequest): Promise<HelperGetGlobalInfoResponse> {
    return this.request(NatsSubject.GetGlobalInfo, payload, { timeout: 5000 });
  }

  async getHotInstruments(payload: HelperHotInstrumentsRequest): Promise<HelperHotInstrumentResponse> {
    return this.request(NatsSubject.GetHotInstruments, payload, { timeout: 5000 });
  }

  async getInstrumentChartData(payload: HelperGetInstrumentRequest): Promise<HelperGetInstrumentResponse> {
    return this.request(NatsSubject.GetInstrument, payload, { timeout: 5000 });
  }

  async getUserStrategy(payload: HelperGetUserStrategyRequest): Promise<HelperGetUserStrategyResponse> {
    return this.request(NatsSubject.GetUserStrategy, payload);
  }

  async getUser(payload: HelperGetUserRequest): Promise<HelperGetUserResponse> {
    return this.request(NatsSubject.GetUser, payload);
  }

  async updateUserStrategy(payload: HelperUpdateUserStrategyRequest): Promise<HelperUpdateUserStrategyResponse> {
    return this.request(NatsSubject.UpdateUserStrategy, payload);
  }

  async withdraw(payload: HelperUserWithdrawRequest): Promise<HelperUserWithdrawResponse> {
    return this.request(NatsSubject.Withdraw, payload, { timeout: 60000 });
  }
}

let natsConn: NatsConnection | null = null;
let natsLock: Promise<void> | null = null;

export async function getNatsConnection(): Promise<NatsConnection> {
  if (!natsConn) {
    if (!natsLock) {
      natsLock = (async () => {
        const conn = new NatsConnection(config.nats.url, config.nats.timeout);
        await conn.connect();
        natsConn = conn;
      })();
    }
    await natsLock;
    natsLock = null;
  }
  return natsConn!;
}

export async function closeNatsConnection() {
  console.log("Close Nats Connection...");
  if (natsConn) {
    await natsConn.disconnect();
    natsConn = null;
  }
}
