# P4 synthetic EXPLAIN (ANALYZE, BUFFERS)

PostgreSQL 16; 20,000 tasks, 200,000 reminders (50% sent), 20,000 academic tasks; one heavy tenant. Existing indexes first, then one candidate partial index measured in the same rollback transaction.

## Task page, existing indexes

```text
Limit  (cost=96.10..97.97 rows=25 width=227) (actual time=0.552..0.555 rows=25 loops=1)
  Buffers: shared hit=27
  ->  Incremental Sort  (cost=96.10..1591.95 rows=20000 width=227) (actual time=0.551..0.553 rows=25 loops=1)
        Sort Key: due_date, created_at DESC, id
        Presorted Key: due_date
        Full-sort Groups: 1  Sort Method: top-N heapsort  Average Memory: 30kB  Peak Memory: 30kB
        Pre-sorted Groups: 1  Sort Method: top-N heapsort  Average Memory: 29kB  Peak Memory: 29kB
        Buffers: shared hit=27
        ->  Index Scan using idx_tasks_due_date on tasks  (cost=0.29..777.29 rows=20000 width=227) (actual time=0.023..0.300 rows=1434 loops=1)
              Filter: ((deleted_at IS NULL) AND (user_id = 'c349df4e-727a-4ad6-892c-bc785396234a'::uuid))
              Buffers: shared hit=27
Planning:
  Buffers: shared hit=127
Planning Time: 0.885 ms
Execution Time: 0.598 ms
```

## Reminder claim candidates, existing indexes

```text
Limit  (cost=1201.94..1213.23 rows=25 width=36) (actual time=42.659..42.684 rows=25 loops=1)
  Buffers: shared hit=60351
  ->  LockRows  (cost=1201.94..12581.03 rows=25190 width=36) (actual time=42.658..42.681 rows=25 loops=1)
        Buffers: shared hit=60351
        ->  Incremental Sort  (cost=1201.94..12329.13 rows=25190 width=36) (actual time=42.650..42.654 rows=25 loops=1)
              Sort Key: r.remind_at, r.id
              Presorted Key: r.remind_at
              Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 29kB  Peak Memory: 29kB
              Pre-sorted Groups: 1  Sort Method: quicksort  Average Memory: 2019kB  Peak Memory: 2019kB
              Buffers: shared hit=60326
              ->  Nested Loop  (cost=0.59..11303.21 rows=25190 width=36) (actual time=0.044..37.214 rows=20001 loops=1)
                    Buffers: shared hit=60326
                    ->  Index Scan using idx_reminders_remind_at on reminders r  (cost=0.30..5183.52 rows=25190 width=62) (actual time=0.024..4.559 rows=20001 loops=1)
                          Index Cond: (remind_at <= now())
                          Filter: ((NOT is_sent) AND (sent_at IS NULL) AND (retry_count < 20) AND ((retry_at IS NULL) OR (retry_at <= now())) AND ((claimed_at IS NULL) OR (claimed_at < (now() - '00:05:00'::interval))))
                          Buffers: shared hit=326
                    ->  Memoize  (cost=0.30..0.38 rows=1 width=38) (actual time=0.001..0.001 rows=1 loops=20001)
                          Cache Key: r.task_id, r.user_id
                          Cache Mode: logical
                          Hits: 1  Misses: 20000  Evictions: 0  Overflows: 0  Memory Usage: 3243kB
                          Buffers: shared hit=60000
                          ->  Index Scan using tasks_pkey on tasks t  (cost=0.29..0.37 rows=1 width=38) (actual time=0.001..0.001 rows=1 loops=20000)
                                Index Cond: (id = r.task_id)
                                Filter: ((deleted_at IS NULL) AND (user_id = r.user_id))
                                Buffers: shared hit=60000
Planning:
  Buffers: shared hit=100
Planning Time: 0.729 ms
Execution Time: 43.473 ms
```

## Stats before: download (PostgREST default cap)

```text
Limit  (cost=0.00..27.90 rows=1000 width=32) (actual time=0.009..0.266 rows=1000 loops=1)
  Buffers: shared hit=16
  ->  Seq Scan on academic_tasks  (cost=0.00..558.00 rows=20000 width=32) (actual time=0.008..0.183 rows=1000 loops=1)
        Filter: ((deleted_at IS NULL) AND (user_id = 'c349df4e-727a-4ad6-892c-bc785396234a'::uuid))
        Buffers: shared hit=16
Planning:
  Buffers: shared hit=37
Planning Time: 0.460 ms
Execution Time: 0.318 ms
```

## Stats before: second exact count

```text
Aggregate  (cost=608.00..608.01 rows=1 width=8) (actual time=3.330..3.330 rows=1 loops=1)
  Buffers: shared hit=308
  ->  Seq Scan on academic_tasks  (cost=0.00..558.00 rows=20000 width=0) (actual time=0.004..2.475 rows=20000 loops=1)
        Filter: ((deleted_at IS NULL) AND (user_id = 'c349df4e-727a-4ad6-892c-bc785396234a'::uuid))
        Buffers: shared hit=308
Planning:
  Buffers: shared hit=3
Planning Time: 0.058 ms
Execution Time: 3.340 ms
```

## Stats after: aggregate all rows

```text
Aggregate  (cost=808.00..808.01 rows=1 width=24) (actual time=3.052..3.053 rows=1 loops=1)
  Buffers: shared hit=308
  ->  Seq Scan on academic_tasks  (cost=0.00..558.00 rows=20000 width=12) (actual time=0.004..2.062 rows=20000 loops=1)
        Filter: ((deleted_at IS NULL) AND (user_id = 'c349df4e-727a-4ad6-892c-bc785396234a'::uuid))
        Buffers: shared hit=308
Planning:
  Buffers: shared hit=3
Planning Time: 0.064 ms
Execution Time: 3.063 ms
```

## Reminder claim candidates after partial index

```text
Limit  (cost=0.72..14.10 rows=25 width=36) (actual time=0.068..0.167 rows=25 loops=1)
  Buffers: shared hit=125 read=3
  ->  LockRows  (cost=0.72..13483.44 rows=25190 width=36) (actual time=0.067..0.164 rows=25 loops=1)
        Buffers: shared hit=125 read=3
        ->  Nested Loop  (cost=0.72..13231.54 rows=25190 width=36) (actual time=0.066..0.158 rows=25 loops=1)
              Buffers: shared hit=100 read=3
              ->  Index Scan using idx_reminders_pending_due on reminders r  (cost=0.42..7111.85 rows=25190 width=62) (actual time=0.049..0.068 rows=25 loops=1)
                    Index Cond: (remind_at <= now())
                    Filter: ((NOT is_sent) AND (sent_at IS NULL) AND (retry_count < 20) AND ((retry_at IS NULL) OR (retry_at <= now())) AND ((claimed_at IS NULL) OR (claimed_at < (now() - '00:05:00'::interval))))
                    Buffers: shared hit=25 read=3
              ->  Memoize  (cost=0.30..0.38 rows=1 width=38) (actual time=0.003..0.003 rows=1 loops=25)
                    Cache Key: r.task_id, r.user_id
                    Cache Mode: logical
                    Hits: 0  Misses: 25  Evictions: 0  Overflows: 0  Memory Usage: 5kB
                    Buffers: shared hit=75
                    ->  Index Scan using tasks_pkey on tasks t  (cost=0.29..0.37 rows=1 width=38) (actual time=0.003..0.003 rows=1 loops=25)
                          Index Cond: (id = r.task_id)
                          Filter: ((deleted_at IS NULL) AND (user_id = r.user_id))
                          Buffers: shared hit=75
Planning:
  Buffers: shared hit=25 read=1
Planning Time: 0.424 ms
Execution Time: 0.426 ms
```

