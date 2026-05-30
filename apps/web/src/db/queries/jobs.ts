import type { Sqlite } from '../sqlite';
import type { JobRecord } from '../types';
import { rowToJob, type JobRow } from './shared/rowMappers';

export function upsertJobs(sql: Sqlite, jobs: JobRecord[]): number {
  sql.transaction(() => {
    for (const j of jobs) {
      sql.exec(
        `INSERT INTO jobs (id, name, base_job_id) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           base_job_id = excluded.base_job_id`,
        [j.id, j.name, j.baseJobId],
      );
    }
  });
  return jobs.length;
}

export function getJob(sql: Sqlite, id: number): JobRecord | null {
  const row = sql.selectObject<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
  return row ? rowToJob(row) : null;
}

export function listJobs(sql: Sqlite): JobRecord[] {
  return sql.selectObjects<JobRow>('SELECT * FROM jobs ORDER BY id ASC').map(rowToJob);
}
