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

    if (query.start_after) qb = qb.gte('start_date', query.start_after);
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
      events: data ?? [],
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

    return data;
  }

  async create(userId: string, input: CreateEventInput) {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...input, user_id: userId })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return data;
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

    return data;
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

    return data ?? [];
  }

  async syncFromGoogle(userId: string, googleEvents: Array<{
    external_id: string;
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    all_day?: boolean;
    location?: string;
  }>) {
    const results = { created: 0, updated: 0, skipped: 0 };

    for (const googleEvent of googleEvents) {
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('external_id', googleEvent.external_id)
        .eq('source', 'google')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('events')
          .update({
            title: googleEvent.title,
            description: googleEvent.description,
            start_date: googleEvent.start_date,
            end_date: googleEvent.end_date,
            all_day: googleEvent.all_day ?? false,
            location: googleEvent.location,
          })
          .eq('id', existing.id);

        if (error) throw createAppError(error.message, 500, 'DB_ERROR');
        results.updated++;
      } else {
        const { error } = await supabase
          .from('events')
          .insert({
            user_id: userId,
            external_id: googleEvent.external_id,
            title: googleEvent.title,
            description: googleEvent.description,
            start_date: googleEvent.start_date,
            end_date: googleEvent.end_date,
            all_day: googleEvent.all_day ?? false,
            location: googleEvent.location,
            source: 'google',
          });

        if (error) throw createAppError(error.message, 500, 'DB_ERROR');
        results.created++;
      }
    }

    return results;
  }
}

export const eventService = new EventService();
