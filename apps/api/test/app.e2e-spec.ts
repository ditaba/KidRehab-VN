import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const PASSWORD = 'Password123!';

describe('KidRehab API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({
    get: (url: string) => http().get(url).set('Authorization', `Bearer ${tokens[who]}`),
    post: (url: string, body?: object) => http().post(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
    patch: (url: string, body?: object) => http().patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
    delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${tokens[who]}`),
  });

  async function login(email: string) {
    const res = await http().post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
    tokens.admin = await login('admin@kidrehab.vn');
    tokens.doctor = await login('doctor@kidrehab.vn');
    tokens.t1 = await login('therapist1@kidrehab.vn');
    tokens.t2 = await login('therapist2@kidrehab.vn');
    tokens.reception = await login('reception@kidrehab.vn');
    tokens.other = await login('doctor@other-clinic.vn');
  });

  afterAll(async () => {
    await app.close();
  });

  const patientByCode = (code: string) => prisma.patient.findFirstOrThrow({ where: { patientCode: code } });

  // ---------------------------------------------------------------------------
  describe('Authentication (US-001)', () => {
    it('logs in, sets an httpOnly refresh cookie and never returns the password', async () => {
      const res = await http().post('/auth/login').send({ email: 'Doctor@KidRehab.vn', password: PASSWORD }).expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('DOCTOR');
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
      expect(res.body.refreshToken).toBeUndefined();
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/kr_refresh=/);
      expect(cookie).toMatch(/HttpOnly/i);
    });

    it('rejects an invalid password with the generic message', async () => {
      const res = await http().post('/auth/login').send({ email: 'doctor@kidrehab.vn', password: 'wrong' }).expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects an unknown email with the same message', async () => {
      const res = await http().post('/auth/login').send({ email: 'nobody@kidrehab.vn', password: 'x' }).expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rotates refresh tokens and detects reuse', async () => {
      const login1 = await http().post('/auth/login').send({ email: 'therapist2@kidrehab.vn', password: PASSWORD }).expect(200);
      const cookie1 = String(login1.headers['set-cookie']).split(';')[0];
      const refreshed = await http().post('/auth/refresh').set('Cookie', cookie1).expect(200);
      expect(refreshed.body.accessToken).toBeDefined();
      const cookie2 = String(refreshed.headers['set-cookie']).split(';')[0];
      expect(cookie2).not.toBe(cookie1);
      // Re-using the old token is rejected and revokes the family.
      await http().post('/auth/refresh').set('Cookie', cookie1).expect(401);
      await http().post('/auth/refresh').set('Cookie', cookie2).expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const res = await http().post('/auth/login').send({ email: 'admin@kidrehab.vn', password: PASSWORD }).expect(200);
      const cookie = String(res.headers['set-cookie']).split(';')[0];
      await http().post('/auth/logout').set('Cookie', cookie).expect(204);
      await http().post('/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('protects endpoints', async () => {
      await http().get('/patients').expect(401);
      await http().get('/patients').set('Authorization', 'Bearer not-a-jwt').expect(401);
      await http().get('/health').expect(200);
    });

    it('never exposes password hashes from the users endpoint', async () => {
      const res = await as('admin').get('/users').expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Dashboard (US-010)', () => {
    it('returns clinic statistics', async () => {
      const res = await as('doctor').get('/dashboard').expect(200);
      expect(res.body.stats.activePatients).toBe(8);
      expect(res.body.stats).toHaveProperty('todaySessions');
      expect(res.body.stats.needReassessment).toBeGreaterThanOrEqual(2);
      expect(res.body.stats.missedAppointments).toBeGreaterThanOrEqual(2);
    });

    it('only counts data of the user clinic', async () => {
      const res = await as('other').get('/dashboard').expect(200);
      expect(res.body.stats.activePatients).toBe(1);
      expect(res.body.todayAppointments).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Clinic isolation & RBAC', () => {
    it('never lists or returns patients from another clinic', async () => {
      const a = await patientByCode('KR-0001');
      const list = await as('other').get('/patients?status=').expect(200);
      expect(list.body.data.map((p: { patientCode: string }) => p.patientCode)).toEqual(['OT-0001']);
      await as('other').get(`/patients/${a.id}`).expect(404);
      await as('other').get(`/patients/${a.id}/progress`).expect(404);
      await as('other').post(`/patients/${a.id}/assessments`, { clinicalNotes: 'x' }).expect(404);
    });

    it('therapists only see assigned patients', async () => {
      const a = await patientByCode('KR-0001'); // assigned to therapist 1
      await as('t1').get(`/patients/${a.id}`).expect(200);
      await as('t2').get(`/patients/${a.id}`).expect(404);
      const list = await as('t2').get('/patients?search=nguyen').expect(200);
      expect(list.body.total).toBe(0);
    });

    it('receptionists cannot view or edit assessments, goals or plans', async () => {
      const a = await patientByCode('KR-0001');
      await as('reception').get(`/patients/${a.id}/assessments`).expect(403);
      await as('reception').post(`/patients/${a.id}/assessments`, { clinicalNotes: 'x' }).expect(403);
      await as('reception').post(`/patients/${a.id}/treatment-plans`, { title: 'x', startDate: '2026-01-01' }).expect(403);
      const goal = await prisma.treatmentGoal.findFirstOrThrow({ where: { treatmentPlan: { patientId: a.id } } });
      await as('reception').patch(`/goals/${goal.id}`, { title: 'x' }).expect(403);
      await as('reception').patch(`/patients/${a.id}`, { status: 'DISCHARGED' }).expect(403);
    });

    it('receptionists see demographics but not clinical data', async () => {
      const a = await patientByCode('KR-0001');
      const res = await as('reception').get(`/patients/${a.id}`).expect(200);
      expect(res.body.guardians.length).toBeGreaterThan(0);
      expect(res.body.activePlan).toBeNull();
      expect(res.body.recentSessions).toEqual([]);
      expect(res.body.clinicalAccess).toBe(false);
    });

    it('therapists can view assessments but not create them', async () => {
      const a = await patientByCode('KR-0001');
      const res = await as('t1').get(`/patients/${a.id}/assessments`).expect(200);
      expect(res.body[0].author.fullName).toBe('Dr. Nguyen Thanh Hai');
      await as('t1').post(`/patients/${a.id}/assessments`, { clinicalNotes: 'x' }).expect(403);
      await as('t1').post('/patients', {}).expect(403);
    });

    it('only admins and doctors manage the exercise library', async () => {
      await as('t1').post('/exercises', { name: 'X' }).expect(403);
      await as('reception').get('/exercises').expect(403);
    });

    it('audit logs are admin-only', async () => {
      await as('doctor').get('/audit-logs').expect(403);
      const res = await as('admin').get('/audit-logs').expect(200);
      expect(res.body.total).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Patients (US-020/021/022)', () => {
    it('lists with pagination and name search', async () => {
      const page = await as('doctor').get('/patients?status=&pageSize=4').expect(200);
      expect(page.body.data).toHaveLength(4);
      expect(page.body.total).toBe(10);
      expect(page.body.totalPages).toBe(3);
      const found = await as('doctor').get('/patients?search=Nguyen Van A').expect(200);
      expect(found.body.data).toHaveLength(1);
      expect(found.body.data[0]).toMatchObject({ patientCode: 'KR-0001', age: 5, status: 'ACTIVE' });
      expect(found.body.data[0].diagnosis).toMatch(/Cerebral Palsy/);
      expect(found.body.data[0].lastSession).not.toBeNull();
    });

    it('filters by status, therapist and diagnosis', async () => {
      const t1 = await prisma.user.findUniqueOrThrow({ where: { email: 'therapist1@kidrehab.vn' } });
      const r = await as('doctor').get(`/patients?therapistId=${t1.id}&diagnosis=cerebral&status=ACTIVE`).expect(200);
      expect(r.body.data.map((p: { patientCode: string }) => p.patientCode)).toEqual(['KR-0001']);
    });

    it('validates required fields', async () => {
      const res = await as('reception').post('/patients', { firstName: 'A', lastName: 'B', dateOfBirth: '2020-01-01', guardians: [] }).expect(400);
      expect(String(res.body.message)).toMatch(/guardian/i);
      await as('reception')
        .post('/patients', { firstName: 'A', lastName: 'B', dateOfBirth: 'nope', guardians: [{ fullName: 'G', relationship: 'Mother', phone: '0901 000 000' }] })
        .expect(400);
      await as('reception')
        .post('/patients', { firstName: 'A', lastName: 'B', dateOfBirth: '2020-01-01', guardians: [{ fullName: 'G', relationship: 'Mother', phone: '0901 000 000' }], hacker: true })
        .expect(400);
    });

    it('receptionist creates a patient with guardian; age is computed and code generated', async () => {
      const res = await as('reception')
        .post('/patients', {
          firstName: 'Minh',
          lastName: 'Le',
          dateOfBirth: '2022-01-15',
          gender: 'MALE',
          guardians: [{ fullName: 'Le Thi Hoa', relationship: 'Mother', phone: '0901 234 567', email: '' }],
        })
        .expect(201);
      expect(res.body.patientCode).toMatch(/^KR-\d{4}$/);
      expect(res.body.age).toBeGreaterThanOrEqual(4);
      expect(res.body.guardians[0]).toMatchObject({ fullName: 'Le Thi Hoa', isPrimary: true });
      await as('reception')
        .post('/patients', {
          firstName: 'Dup',
          lastName: 'Code',
          dateOfBirth: '2022-01-15',
          patientCode: res.body.patientCode,
          guardians: [{ fullName: 'X', relationship: 'Father', phone: '0901 234 567' }],
        })
        .expect(409);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Core loop: patient → assessment → plan → goal → session → measurement → progress', () => {
    let patientId: string;
    let planId: string;
    let goalId: string;
    let metricId: string;
    let sessionId: string;
    let t1Id: string;

    it('doctor creates the patient', async () => {
      t1Id = (await prisma.user.findUniqueOrThrow({ where: { email: 'therapist1@kidrehab.vn' } })).id;
      const res = await as('doctor')
        .post('/patients', {
          firstName: 'Loop',
          lastName: 'Test',
          dateOfBirth: '2021-05-05',
          primaryTherapistId: t1Id,
          diagnosis: 'Cerebral Palsy',
          guardians: [{ fullName: 'Parent', relationship: 'Father', phone: '0909 999 999' }],
        })
        .expect(201);
      patientId = res.body.id;
      expect(res.body.diagnoses[0].name).toBe('Cerebral Palsy');
      expect(res.body.needsReassessment).toBe(true);
    });

    it('doctor records the initial assessment (author + timestamps)', async () => {
      const res = await as('doctor')
        .post(`/patients/${patientId}/assessments`, { functionalAbility: 'Stands 4 s', balance: 'Poor', painScore: 1 })
        .expect(201);
      expect(res.body.type).toBe('INITIAL');
      expect(res.body.author.fullName).toBe('Dr. Nguyen Thanh Hai');
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
      await as('doctor').post(`/patients/${patientId}/assessments`, { painScore: 11 }).expect(400);
    });

    it('doctor creates a treatment plan; a new ACTIVE plan supersedes the old one', async () => {
      const first = await as('doctor').post(`/patients/${patientId}/treatment-plans`, { title: 'Plan A', startDate: '2026-09-01' }).expect(201);
      const second = await as('doctor')
        .post(`/patients/${patientId}/treatment-plans`, { title: 'Plan B', startDate: '2026-10-01', reviewDate: '2026-12-01', recommendedFrequency: '3/week' })
        .expect(201);
      planId = second.body.id;
      const plans = await as('t1').get(`/patients/${patientId}/treatment-plans`).expect(200);
      expect(plans.body).toHaveLength(2);
      expect(plans.body.find((p: { id: string }) => p.id === first.body.id).status).toBe('COMPLETED');
      expect(plans.body[0]).toMatchObject({ id: planId, status: 'ACTIVE' });
      await as('doctor').post(`/patients/${patientId}/treatment-plans`, { title: 'Bad', startDate: '2026-10-01', reviewDate: '2026-09-01' }).expect(400);
    });

    it('goals require title, baseline, target, unit and create a ProgressMetric', async () => {
      await as('doctor').post(`/treatment-plans/${planId}/goals`, { title: 'X', baselineValue: 5, targetValue: 30 }).expect(400);
      await as('doctor').post(`/treatment-plans/${planId}/goals`, { title: 'X', unit: 's', baselineValue: 30, targetValue: 5 }).expect(400);
      const res = await as('doctor')
        .post(`/treatment-plans/${planId}/goals`, {
          title: 'Stand independently',
          metricName: 'Standing Duration',
          unit: 'seconds',
          baselineValue: 5,
          targetValue: 30,
          targetDate: '2026-11-12',
        })
        .expect(201);
      goalId = res.body.id;
      expect(res.body.status).toBe('NOT_STARTED');
      const metric = await prisma.progressMetric.findUniqueOrThrow({ where: { treatmentGoalId: goalId } });
      expect(metric).toMatchObject({ patientId, name: 'Standing Duration', unit: 'seconds', baselineValue: 5, targetValue: 30 });
      metricId = metric.id;
      await as('t1').post(`/treatment-plans/${planId}/goals`, { title: 'x', unit: 's', baselineValue: 1, targetValue: 2 }).expect(403);
    });

    it('therapist starts a session from an appointment (idempotent)', async () => {
      const start = new Date(Date.now() + 60 * 60000).toISOString();
      const appt = await as('reception').post('/appointments', { patientId, therapistId: t1Id, startAt: start, force: true }).expect(201);
      expect(appt.body.durationMinutes).toBe(45); // clinic default
      const s1 = await as('t1').post(`/patients/${patientId}/sessions`, { appointmentId: appt.body.id }).expect(201);
      const s2 = await as('t1').post(`/patients/${patientId}/sessions`, { appointmentId: appt.body.id }).expect(201);
      expect(s2.body.id).toBe(s1.body.id);
      sessionId = s1.body.id;
      expect(s1.body.status).toBe('DRAFT');
      expect(s1.body.goals.map((g: { id: string }) => g.id)).toContain(goalId);
      await as('t2').get(`/sessions/${sessionId}`).expect(404);
    });

    it('adds exercises without modifying the template', async () => {
      const ex = await prisma.exercise.findFirstOrThrow({ where: { name: 'Standing Balance' } });
      const se = await as('t1').post(`/sessions/${sessionId}/exercises`, { exerciseId: ex.id }).expect(201);
      expect(se.body).toMatchObject({ exerciseName: 'Standing Balance', sets: 3, durationSeconds: 30 });
      await as('t1').patch(`/sessions/${sessionId}/exercises/${se.body.id}`, { sets: 5, durationSeconds: 45 }).expect(200);
      const template = await prisma.exercise.findUniqueOrThrow({ where: { id: ex.id } });
      expect(template.defaultSets).toBe(3);
      expect(template.defaultDurationSeconds).toBe(30);
      const second = await prisma.exercise.findFirstOrThrow({ where: { name: 'Sit-to-Stand' } });
      await as('t1').post(`/sessions/${sessionId}/exercises`, { exerciseId: second.id }).expect(201);
      const disabled = await prisma.exercise.findFirstOrThrow({ where: { status: 'DISABLED' } });
      await as('t1').post(`/sessions/${sessionId}/exercises`, { exerciseId: disabled.id }).expect(409);
    });

    it('records observations and measurements', async () => {
      await as('t1')
        .patch(`/sessions/${sessionId}`, { painScore: 2, energyLevel: 4, mood: 'HAPPY', tolerance: 'GOOD', assistanceLevel: 'MINIMAL', notes: 'Good' })
        .expect(200);
      await as('t1').patch(`/sessions/${sessionId}`, { painScore: 42 }).expect(400);
      await as('t1').post(`/sessions/${sessionId}/measurements`, { progressMetricId: metricId, value: 20 }).expect(201);
      // Re-recording the same metric corrects the value instead of duplicating it.
      const m = await as('t1').post(`/sessions/${sessionId}/measurements`, { progressMetricId: metricId, value: 22 }).expect(201);
      expect(m.body.value).toBe(22);
      const rows = await prisma.progressMeasurement.findMany({ where: { therapySessionId: sessionId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].recordedBy).toBe(t1Id);
      // Draft measurements are not yet part of progress.
      const progress = await as('doctor').get(`/patients/${patientId}/progress`).expect(200);
      expect(progress.body.goals.find((g: { id: string }) => g.id === goalId).measurements).toHaveLength(0);
    });

    it('only the assigned therapist or a doctor can edit the session', async () => {
      const t2 = await prisma.user.findUniqueOrThrow({ where: { email: 'therapist2@kidrehab.vn' } });
      await prisma.patient.update({ where: { id: patientId }, data: { primaryTherapistId: t2.id } });
      await as('t2').patch(`/sessions/${sessionId}`, { notes: 'hijack' }).expect(403);
      await prisma.patient.update({ where: { id: patientId }, data: { primaryTherapistId: t1Id } });
    });

    it('completing the session updates the goal current value and progress', async () => {
      const res = await as('t1').post(`/sessions/${sessionId}/complete`, { notes: 'Great session' }).expect(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.notes).toBe('Great session');
      const goal = await prisma.treatmentGoal.findUniqueOrThrow({ where: { id: goalId } });
      expect(goal.currentValue).toBe(22);
      expect(goal.status).toBe('IN_PROGRESS');
      const appt = await prisma.appointment.findFirstOrThrow({ where: { session: { id: sessionId } } });
      expect(appt.status).toBe('COMPLETED');

      const progress = await as('doctor').get(`/patients/${patientId}/progress`).expect(200);
      const g = progress.body.goals.find((x: { id: string }) => x.id === goalId);
      expect(g).toMatchObject({ baselineValue: 5, currentValue: 22, targetValue: 30 });
      expect(g.progress.percent).toBe(68);
      expect(g.measurements[0]).toMatchObject({ value: 22, sessionId, therapist: 'Tran Minh Chau' });
    });

    it('completed sessions are read-only but remain in history', async () => {
      await as('t1').patch(`/sessions/${sessionId}`, { notes: 'edit' }).expect(409);
      await as('t1').post(`/sessions/${sessionId}/measurements`, { progressMetricId: metricId, value: 1 }).expect(409);
      await as('t1').post(`/sessions/${sessionId}/complete`, {}).expect(409);
      const list = await as('doctor').get(`/patients/${patientId}/sessions`).expect(200);
      expect(list.body.data.map((s: { id: string }) => s.id)).toContain(sessionId);
    });

    it('writes audit logs for clinical changes', async () => {
      const logs = await prisma.auditLog.findMany({ where: { entity: 'TreatmentGoal', entityId: goalId } });
      expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['CREATE', 'UPDATE']));
      expect(logs[0].userName).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Progress for the demo patient (US-060/061)', () => {
    it('returns chronologically sorted measurements and percentages', async () => {
      const a = await patientByCode('KR-0001');
      const res = await as('doctor').get(`/patients/${a.id}/progress`).expect(200);
      const standing = res.body.goals.find((g: { metricName: string }) => g.metricName === 'Standing Duration');
      expect(standing.measurements.map((m: { value: number }) => m.value)).toEqual([5, 9, 15, 19, 22]);
      const dates = standing.measurements.map((m: { measuredAt: string }) => new Date(m.measuredAt).getTime());
      expect([...dates].sort((x, y) => x - y)).toEqual(dates);
      expect(standing.progress.percent).toBe(68);
      const walking = res.body.goals.find((g: { metricName: string }) => g.metricName === 'Walking Distance');
      expect(walking).toMatchObject({ baselineValue: 2, currentValue: 8, targetValue: 10 });
      expect(walking.progress.percent).toBe(75);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Appointments (US-080/081)', () => {
    it('requires patient, therapist and date/time', async () => {
      await as('reception').post('/appointments', {}).expect(400);
    });

    it('warns about overlapping therapist appointments and allows override', async () => {
      const b = await patientByCode('KR-0002');
      const t1 = await prisma.user.findUniqueOrThrow({ where: { email: 'therapist1@kidrehab.vn' } });
      const startAt = new Date(Date.now() + 30 * 86400000);
      startAt.setUTCHours(3, 0, 0, 0);
      await as('reception').post('/appointments', { patientId: b.id, therapistId: t1.id, startAt: startAt.toISOString() }).expect(201);
      const overlapping = new Date(startAt.getTime() + 30 * 60000).toISOString();
      const conflict = await as('reception').post('/appointments', { patientId: b.id, therapistId: t1.id, startAt: overlapping }).expect(409);
      expect(conflict.body.code).toBe('THERAPIST_OVERLAP');
      expect(conflict.body.conflicts).toHaveLength(1);
      const forced = await as('reception')
        .post('/appointments', { patientId: b.id, therapistId: t1.id, startAt: overlapping, force: true })
        .expect(201);
      expect(forced.body.conflicts).toHaveLength(1);
      // Back-to-back (starting when the forced booking ends) is not a conflict.
      const after = new Date(startAt.getTime() + 75 * 60000).toISOString();
      await as('reception').post('/appointments', { patientId: b.id, therapistId: t1.id, startAt: after, durationMinutes: 30 }).expect(201);
    });

    it('lists appointments in a range and therapists cannot edit them', async () => {
      const from = new Date(Date.now() - 86400000).toISOString();
      const to = new Date(Date.now() + 14 * 86400000).toISOString();
      const res = await as('t1').get(`/appointments?from=${from}&to=${to}`).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      await as('t1').patch(`/appointments/${res.body[0].id}`, { status: 'CANCELLED' }).expect(403);
      await as('reception').get(`/appointments?from=${from}&to=2027-12-31T00:00:00Z`).expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Exercise library (US-070/071)', () => {
    it('requires a name and can disable without deleting history', async () => {
      await as('doctor').post('/exercises', { name: '   ' }).expect(400);
      const ex = await as('admin').post('/exercises', { name: 'Step-ups', category: 'STRENGTH', defaultSets: 2, defaultRepetitions: 8 }).expect(201);
      const used = await prisma.exercise.findFirstOrThrow({ where: { name: 'Standing Balance' } });
      const before = await prisma.sessionExercise.count({ where: { exerciseId: used.id } });
      await as('admin').patch(`/exercises/${used.id}`, { status: 'DISABLED' }).expect(200);
      expect(await prisma.sessionExercise.count({ where: { exerciseId: used.id } })).toBe(before);
      const active = await as('t1').get('/exercises?status=ACTIVE').expect(200);
      expect(active.body.map((e: { id: string }) => e.id)).not.toContain(used.id);
      expect(active.body.map((e: { id: string }) => e.id)).toContain(ex.body.id);
      await as('admin').patch(`/exercises/${used.id}`, { status: 'ACTIVE' }).expect(200);
    });
  });
});
