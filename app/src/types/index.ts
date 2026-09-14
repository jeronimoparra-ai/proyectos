export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category_id: string | null;
  categories?: Category | null;
  task_tags?: { tags: Tag }[];
  subtasks?: Subtask[];
  reminders?: Reminder[];
  tags?: string[];
  estimated_minutes: number | null;
  actual_minutes: number | null;
  color: string | null;
  is_recurring: boolean | null;
  recurrence_rule: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  all_day: boolean;
  location: string | null;
  category_id: string | null;
  color: string | null;
  source: 'local' | 'google';
  external_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Reminder {
  id: string;
  task_id: string;
  user_id: string;
  remind_at: string;
  type: 'notification' | 'alarm';
  is_sent: boolean;
  created_at: string;
}

export interface AcademicTask extends Task {
  subject: string | null;
  content: string | null;
  summary: string | null;
  key_ideas: string[] | null;
  concepts: string[] | null;
  questions: string[] | null;
  ai_model: string | null;
  ai_processed_at: string | null;
  materials?: StudyMaterial[];
  topics?: Topic[];
}

export interface StudyMaterial {
  id: string;
  academic_task_id: string;
  type: 'text' | 'pdf' | 'image' | 'link';
  content: string;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
}

export interface Topic {
  id: string;
  academic_task_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export type ColorScheme = 'light' | 'dark' | 'system';

export interface UserPreferences {
  user_id: string;
  color_scheme: ColorScheme;
  language: string;
  notifications_enabled: boolean;
  quiet_mode_start: string | null;
  quiet_mode_end: string | null;
  created_at: string;
  updated_at: string;
}
