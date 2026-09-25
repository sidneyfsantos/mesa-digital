import {
  Controller,
  Get,
  Param,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';

interface EventMessage {
  type: string;
  payload: any;
  timestamp: string;
}

interface SseMessageEvent {
  data: string;
  type?: string;
  retry?: number;
}

const connections = new Map<string, Set<Subject<EventMessage>>>();

function getConnectionKey(tenantId: string, resource: string): string {
  return `${tenantId}:${resource}`;
}

export function publishEvent(
  tenantId: string,
  resource: string,
  event: EventMessage,
) {
  const key = getConnectionKey(tenantId, resource);
  const subjects = connections.get(key);
  if (subjects) {
    for (const subject of subjects) {
      subject.next(event);
    }
  }
}

export function publishOrderEvent(tenantId: string, event: EventMessage) {
  publishEvent(tenantId, 'orders', event);
}

export function publishStationEvent(
  tenantId: string,
  stationId: string,
  event: EventMessage,
) {
  publishEvent(tenantId, `station:${stationId}`, event);
  publishEvent(tenantId, 'stations', event);
}

@Controller('realtime')
@UseGuards(CapabilitiesGuard)
export class RealtimeController {
  @Get('events')
  @Sse()
  @RequireCapabilities('order.read')
  events(@Req() r: PrincipalRequest): Observable<SseMessageEvent> {
    const tenantId = r.principal!.tenantId;
    const subject = new Subject<EventMessage>();

    const key = getConnectionKey(tenantId, 'orders');
    const set = connections.get(key) ?? new Set();
    set.add(subject);
    connections.set(key, set);

    const heartbeat = interval(30000).pipe(
      map(() => ({ type: 'heartbeat', payload: {}, timestamp: new Date().toISOString() })),
    );

    const clientSubject = new Subject<EventMessage>();
    subject.subscribe(clientSubject);

    return merge(clientSubject, heartbeat).pipe(
      map((event): SseMessageEvent => ({
        data: JSON.stringify(event),
        type: event.type,
        retry: 5000,
      })),
    );
  }

  @Get('stations/:stationId/events')
  @Sse()
  @RequireCapabilities('production.read')
  stationEvents(
    @Req() r: PrincipalRequest,
    @Param('stationId') stationId: string,
  ): Observable<SseMessageEvent> {
    const tenantId = r.principal!.tenantId;
    const subject = new Subject<EventMessage>();

    const key = getConnectionKey(tenantId, `station:${stationId}`);
    const set = connections.get(key) ?? new Set();
    set.add(subject);
    connections.set(key, set);

    const heartbeat = interval(30000).pipe(
      map(() => ({ type: 'heartbeat', payload: {}, timestamp: new Date().toISOString() })),
    );

    const clientSubject = new Subject<EventMessage>();
    subject.subscribe(clientSubject);

    return merge(clientSubject, heartbeat).pipe(
      map((event): SseMessageEvent => ({
        data: JSON.stringify(event),
        type: event.type,
        retry: 5000,
      })),
    );
  }
}