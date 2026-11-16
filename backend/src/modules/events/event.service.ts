import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import type { CreateEventInput, UpdateEventInput, EventQueryInput } from './event.schema';

export class EventService {
  async list(userId: string, query: EventQueryInput) {
    let qb = supabase
      .from('events')
      .select('*, categories (*)', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (query.start_after) qb = qb.gt('end_date', query.start_after);
    if (query.start_before) qb = qb.lte('start_date', query.start_before);
    if (query.category_id) qb = qb.eq('category_id', query.category_id);
    if (query.source) qb = qb.eq('source', query.source);
    if (query.search) qb = qb.ilike('title', `%${query.search}%`);

    const offset = (query.page - 1) * query.limit;
    qb = qb.range(offset, offset + query.limit - 1);
    qb = qb.order('start_date', { ascending: true });

    const { data, error, count } = await qb;

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return {
      events: (data ?? []) as Array<{ id: string; [key: string]: unknown }>,
      total: count ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }

  async getById(userId: string, eventId: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*, categories (*)')
      .eq('id', eventId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw createAppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    const event = data as { id: string; [key: string]: unknown };
    return event;
  }

  async create(userId: string, input: CreateEventInput) {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...input, user_id: userId })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    const createdEvent = data as { id: string; [key: string]: unknown };
    return createdEvent;
  }

  async update(userId: string, eventId: string, input: UpdateEventInput) {
    await this.getById(userId, eventId);

    const { data, error } = await supabase
      .from('events')
      .update(input)
      .eq('id', eventId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    const updatedEvent = data as { id: string; [key: string]: unknown };
    return updatedEvent;
  }

  async softDelete(userId: string, eventId: string) {
    await this.getById(userId, eventId);

    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Event deleted' };
  }

  async getByDateRange(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*, categories (*)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true });

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return (data ?? []) as Array<{ id: string; [key: string]: unknown }>;
  }

  /** @deprecated Use POST /google/sync: imported data must come from Google. */
  async syncFromGoogle(userId: string, _legacyEvents?: unknown) {
    const { googleCalendarService } = await import('../google/google-calendar.service');
    const result = await googleCalendarService.syncEvents(userId);
    return result;
  }
}

export const eventService = new EventService();
