export interface TunnelState {
  readonly status: "stopped" | "starting" | "active" | "error";
  readonly url: string | null;
  readonly pid: number | null;
  readonly startedAt: string | null;
  readonly error: string | null;
}
