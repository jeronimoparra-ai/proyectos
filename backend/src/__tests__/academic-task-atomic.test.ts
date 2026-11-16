import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client using vi.hoisted to avoid hoisting issues
const { mockRpc, mockFrom, mockSelect, mockInsert, mockUpdate, mockEq, mockSingle, mockOrder, mockLimit, mockRange, mockIs, mockIlike } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockRange: vi.fn(),
  mockIs: vi.fn(),
  mockIlike: vi.fn(),
}));

vi.mock('../database/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

vi.mock('../middleware/error.middleware', () => ({
  createAppError: (message: string, status: number, code: string) => {
    const error = new Error(message) as Error & { status: number; code: string };
    error.status = status;
    error.code = code;
    return error;
  },
}));

import { AcademicTaskService } from '../modules/academic/academic-task.service';
import { ReviewService } from '../modules/reviews/review.service';
import type { CreateAcademicTaskInput } from '../modules/academic/academic-task.schema';
import type { CreateReviewInput } from '../modules/reviews/review.schema';

describe('AcademicTaskService - Atomic Creation', () => {
  let service: AcademicTaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AcademicTaskService();

    // Setup default mock chain
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          is: mockIs.mockReturnValue({
            order: mockOrder.mockReturnValue({
              range: mockRange.mockReturnValue({
                single: mockSingle,
              }),
            }),
          }),
        }),
      }),
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({
          select: mockSelect.mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('calls atomic RPC with correct parameters', async () => {
      const mockResult = [{
        task_id: 'task-123',
        title: 'Test Task',
        subject: 'Math',
        content: 'Test content',
        created_at: '2024-01-01T00:00:00Z',
      }];

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      const input: CreateAcademicTaskInput = {
        title: 'Test Task',
        subject: 'Math',
        content: 'Test content',
        materials: [
          { type: 'text', content: 'Material 1' },
        ],
        topics: [
          { name: 'Topic 1', description: 'Description 1' },
        ],
      };

      const result = await service.create('user-123', input);

      expect(mockRpc).toHaveBeenCalledWith('create_academic_task_atomic', {
        p_user_id: 'user-123',
        p_title: 'Test Task',
        p_subject: 'Math',
        p_content: 'Test content',
        p_materials: [{ type: 'text', content: 'Material 1' }],
        p_topics: [{ name: 'Topic 1', description: 'Description 1' }],
      });

      expect(result).toEqual(mockResult[0]);
    });

    it('handles empty materials and topics arrays', async () => {
      const mockResult = [{
        task_id: 'task-123',
        title: 'Test Task',
        subject: null,
        content: null,
        created_at: '2024-01-01T00:00:00Z',
      }];

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      const input: CreateAcademicTaskInput = {
        title: 'Test Task',
      };

      const result = await service.create('user-123', input);

      expect(mockRpc).toHaveBeenCalledWith('create_academic_task_atomic', {
        p_user_id: 'user-123',
        p_title: 'Test Task',
        p_subject: null,
        p_content: null,
        p_materials: [],
        p_topics: [],
      });

      expect(result).toEqual(mockResult[0]);
    });

    it('throws error when RPC returns error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      });

      const input: CreateAcademicTaskInput = {
        title: 'Test Task',
      };

      await expect(service.create('user-123', input)).rejects.toThrow('Database error');
    });

    it('throws error when RPC returns empty data', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const input: CreateAcademicTaskInput = {
        title: 'Test Task',
      };

      await expect(service.create('user-123', input)).rejects.toThrow('Failed to create academic task');
    });

    it('throws error when RPC returns null data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const input: CreateAcademicTaskInput = {
        title: 'Test Task',
      };

      await expect(service.create('user-123', input)).rejects.toThrow('Failed to create academic task');
    });
  });
});

describe('ReviewService - Atomic Review Recording with SM-2', () => {
  let service: ReviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('recordReview', () => {
    it('calls atomic RPC with correct parameters', async () => {
      const mockResult = [{
        review_id: 'review-123',
        quality: 4,
        difficulty: 0.5,
        time_spent_seconds: 60,
        ease_factor: 2.5,
        interval: 1,
        repetitions: 1,
        next_review_at: '2024-01-02T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        is_duplicate: false,
        sm2_repetitions: 1,
        total_reviews: 1,
      }];

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 4,
        difficulty: 0.5,
        time_spent_seconds: 60,
        idempotency_key: 'idem-123',
      };

      const result = await service.recordReview('user-123', input);

      expect(mockRpc).toHaveBeenCalledWith('record_review_atomic', {
        p_user_id: 'user-123',
        p_academic_task_id: 'task-123',
        p_quality: 4,
        p_difficulty: 0.5,
        p_time_spent_seconds: 60,
        p_idempotency_key: 'idem-123',
      });

      expect(result.review.id).toBe('review-123');
      expect(result.review.quality).toBe(4);
      expect(result.sm2.easeFactor).toBe(2.5);
      expect(result.isDuplicate).toBe(false);
      expect(result.sm2Repetitions).toBe(1);
      expect(result.totalReviews).toBe(1);
    });

    it('handles duplicate submission (idempotency)', async () => {
      const mockResult = [{
        review_id: 'review-123',
        quality: 4,
        difficulty: 0.5,
        time_spent_seconds: 60,
        ease_factor: 2.5,
        interval: 1,
        repetitions: 1,
        next_review_at: '2024-01-02T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        is_duplicate: true,
        sm2_repetitions: 1,
        total_reviews: 1,
      }];

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 4,
        difficulty: 0.5,
        time_spent_seconds: 60,
        idempotency_key: 'idem-123',
      };

      const result = await service.recordReview('user-123', input);

      expect(result.isDuplicate).toBe(true);
      expect(result.review.id).toBe('review-123');
    });

    it('handles task not found error (P0001)', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Academic task not found', code: 'P0001' },
      });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 4,
      };

      await expect(service.recordReview('user-123', input)).rejects.toThrow('Academic task not found');
    });

    it('handles generic database error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 4,
      };

      await expect(service.recordReview('user-123', input)).rejects.toThrow('Database error');
    });

    it('handles empty data response', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 4,
      };

      await expect(service.recordReview('user-123', input)).rejects.toThrow('Failed to record review');
    });

    it('handles null data response', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 4,
      };

      await expect(service.recordReview('user-123', input)).rejects.toThrow('Failed to record review');
    });

    it('works without idempotency key', async () => {
      const mockResult = [{
        review_id: 'review-123',
        quality: 3,
        difficulty: null,
        time_spent_seconds: null,
        ease_factor: 2.5,
        interval: 1,
        repetitions: 1,
        next_review_at: '2024-01-02T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        is_duplicate: false,
        sm2_repetitions: 1,
        total_reviews: 1,
      }];

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      const input: CreateReviewInput = {
        academic_task_id: 'task-123',
        quality: 3,
      };

      const result = await service.recordReview('user-123', input);

      expect(mockRpc).toHaveBeenCalledWith('record_review_atomic', {
        p_user_id: 'user-123',
        p_academic_task_id: 'task-123',
        p_quality: 3,
        p_difficulty: null,
        p_time_spent_seconds: null,
        p_idempotency_key: null,
      });

      expect(result.isDuplicate).toBe(false);
    });
  });
});