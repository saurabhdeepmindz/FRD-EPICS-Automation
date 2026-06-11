import { Injectable } from '@nestjs/common';
import { ReplaySubject, type Observable } from 'rxjs';

export type WfChangeEvent =
  | { type: 'wfChangeStatus'; changeId: string; status: string }
  | { type: 'wfChangeActivity'; changeId: string; activityType: string; actor?: string | null; message?: string | null };

/**
 * v12 · Track WC — per-project SSE stream for live change-register updates.
 * Mirrors the RunManager Subject pattern; a small ReplaySubject lets a late
 * subscriber (the register panel) catch recent events.
 */
@Injectable()
export class WireframeChangeEventsService {
  private readonly streams = new Map<string, ReplaySubject<WfChangeEvent>>();

  private subject(projectId: string): ReplaySubject<WfChangeEvent> {
    let s = this.streams.get(projectId);
    if (!s) {
      s = new ReplaySubject<WfChangeEvent>(50);
      this.streams.set(projectId, s);
    }
    return s;
  }

  stream(projectId: string): Observable<WfChangeEvent> {
    return this.subject(projectId).asObservable();
  }

  emitStatus(projectId: string, changeId: string, status: string): void {
    this.subject(projectId).next({ type: 'wfChangeStatus', changeId, status });
  }

  emitActivity(
    projectId: string,
    changeId: string,
    activityType: string,
    actor?: string | null,
    message?: string | null,
  ): void {
    this.subject(projectId).next({ type: 'wfChangeActivity', changeId, activityType, actor, message });
  }
}
