/*
 * app/lib/agents/universalBookingAgent.ts
 * 범용 예약 페이지 템플릿 - 사장님 본인의 예약 페이지를 만들어 줌
 * 손님: 날짜·시간을 골라 예약 신청 / 사장님: 로그인 후 예약 목록 확인·확정·취소
 * 저장: Supabase 값(.env)이 있으면 운영 모드(서버 저장), 없으면 데모 모드(브라우저 저장)
 * 다른 회사 사이트를 자동 조작하지 않음 (매크로·자동 로그인·자동 클릭·스크래핑 없음)
 * © bj Lee - coverfo.com - Uncovering the fog
 */

export interface BookingTemplateOptions {
  /** 영업 시작 시간 'HH:MM' (기본 '09:00') */
  openTime?: string;

  /** 영업 종료 시간 'HH:MM' (기본 '21:00') */
  closeTime?: string;

  /** 예약 한 칸의 길이(분) (기본 60) */
  slotMinutes?: number;

  /** 한 시간대에 받을 수 있는 최대 예약 수 (기본 1) */
  capacityPerSlot?: number;

  /** 예약 1건당 최대 인원 (기본 10) */
  maxPeople?: number;
}

interface ResolvedOptions {
  facility: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
  maxPeople: number;
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function assertPositiveInteger(label: string, value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다: ${value}`);
  }
}

function resolveOptions(facility: string, options: BookingTemplateOptions): ResolvedOptions {
  const resolved: ResolvedOptions = {
    facility,
    openTime: options.openTime ?? '09:00',
    closeTime: options.closeTime ?? '21:00',
    slotMinutes: options.slotMinutes ?? 60,
    capacityPerSlot: options.capacityPerSlot ?? 1,
    maxPeople: options.maxPeople ?? 10,
  };

  if (!facility.trim()) {
    throw new Error('시설 이름이 비어 있습니다.');
  }

  if (!TIME_PATTERN.test(resolved.openTime) || !TIME_PATTERN.test(resolved.closeTime)) {
    throw new Error(`영업 시간은 HH:MM 형식이어야 합니다: ${resolved.openTime} ~ ${resolved.closeTime}`);
  }

  assertPositiveInteger('slotMinutes', resolved.slotMinutes);
  assertPositiveInteger('capacityPerSlot', resolved.capacityPerSlot);
  assertPositiveInteger('maxPeople', resolved.maxPeople);

  if (timeToMinutes(resolved.openTime) + resolved.slotMinutes > timeToMinutes(resolved.closeTime)) {
    throw new Error(
      `영업 시간 안에 예약 칸이 하나도 들어가지 않습니다: ${resolved.openTime} ~ ${resolved.closeTime}, ${resolved.slotMinutes}분`,
    );
  }

  return resolved;
}

/** 주석·문서에 넣을 한 줄짜리 시설 이름 (줄바꿈 제거) */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}

/**
 * 예약 핵심 로직 파일(src/booking/bookingCore.ts) 코드를 만들어 돌려줍니다.
 * 시설 이름은 JSON.stringify 로 넣으므로 따옴표 등이 들어가도 생성 코드가 깨지지 않습니다.
 */
export const universalBookingTemplate = (facility: string, options: BookingTemplateOptions = {}) => {
  const o = resolveOptions(facility, options);

  return `// booking/bookingCore.ts - coverfo.com 예약 페이지 핵심 로직
// 사장님 본인의 예약 페이지용입니다. 다른 회사 사이트를 자동 조작하지 않습니다.
// 아래 설정값을 바꾸면 supabase/schema.sql 의 같은 값도 함께 바꾼 뒤 다시 실행해야 합니다.

export const FACILITY: string = ${JSON.stringify(o.facility)};
export const OPEN_TIME = ${JSON.stringify(o.openTime)};
export const CLOSE_TIME = ${JSON.stringify(o.closeTime)};
export const SLOT_MINUTES = ${o.slotMinutes};
export const CAPACITY_PER_SLOT = ${o.capacityPerSlot};
export const MAX_PEOPLE = ${o.maxPeople};

export type BookingStatus = 'requested' | 'confirmed' | 'cancelled';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: '확인 대기',
  confirmed: '확정',
  cancelled: '취소',
};

export interface Booking {
  id: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  people: number;
  memo: string;
  status: BookingStatus;
  createdAt: string;
}

/** 손님이 화면에서 입력한 값 */
export interface BookingInput {
  date: string;
  time: string;
  name: string;
  phone: string;
  people: number;
  memo?: string;
  agreed: boolean;
}

/** 검사를 통과해 저장소로 보내는 값 */
export interface NewBooking {
  date: string;
  time: string;
  name: string;
  phone: string;
  people: number;
  memo: string;
}

export interface SlotInfo {
  time: string;
  remaining: number;
  isPast: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type OwnerState = 'signed-out' | 'not-owner' | 'owner';

/** 사장님 로그인 (운영 모드에서만 있음) */
export interface OwnerAuth {
  getState(): Promise<OwnerState>;
  signIn(email: string, password: string): Promise<Result<OwnerState>>;
  signOut(): Promise<void>;
}

/** 예약 저장소: 데모는 LocalBookingStore, 운영은 supabaseStore.ts 의 SupabaseBookingStore */
export interface BookingStore {
  readonly mode: 'demo' | 'server';
  readonly auth?: OwnerAuth;

  /** 날짜의 시간대별 예약 수 (취소 제외). 손님 화면용이라 개인정보가 없음 */
  countByTime(date: string): Promise<Record<string, number>>;

  /** 예약 신청. 정원 확인과 저장을 한 번에 처리 */
  create(booking: NewBooking): Promise<Result<Booking>>;

  /** 사장님 화면: 날짜별 예약 목록 */
  listByDate(date: string): Promise<Booking[]>;

  /** 사장님 화면: 확정·취소 */
  updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Result<null>>;
}

export const FULL_MESSAGE = '선택한 시간은 예약이 마감되었어요.';
export const CANCELLED_MESSAGE = '취소된 예약은 되돌릴 수 없어요.';

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function toMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

export function toHHMM(minutes: number): string {
  return pad2(Math.floor(minutes / 60)) + ':' + pad2(minutes % 60);
}

export function formatDate(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function getTimeSlots(): string[] {
  const slots: string[] = [];
  const end = toMinutes(CLOSE_TIME);

  for (let m = toMinutes(OPEN_TIME); m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
    slots.push(toHHMM(m));
  }

  return slots;
}

export function isPastSlot(date: string, time: string, now: Date = new Date()): boolean {
  const today = formatDate(now);

  if (date < today) {
    return true;
  }

  if (date > today) {
    return false;
  }

  return toMinutes(time) <= now.getHours() * 60 + now.getMinutes();
}

export function getAvailability(counts: Record<string, number>, date: string, now: Date = new Date()): SlotInfo[] {
  return getTimeSlots().map((time) => ({
    time,
    remaining: Math.max(0, CAPACITY_PER_SLOT - (counts[time] || 0)),
    isPast: isPastSlot(date, time, now),
  }));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** 정원을 뺀 나머지 입력 검사 (정원은 저장소가 저장할 때 확인) */
export function validateBooking(input: BookingInput, now: Date = new Date()): string | null {
  if (!DATE_PATTERN.test(input.date)) {
    return '날짜를 선택해 주세요.';
  }

  if (getTimeSlots().indexOf(input.time) === -1) {
    return '시간을 선택해 주세요.';
  }

  if (isPastSlot(input.date, input.time, now)) {
    return '이미 지난 시간은 예약할 수 없어요.';
  }

  if (!input.name.trim() || input.name.trim().length > 50) {
    return '이름을 입력해 주세요.';
  }

  const digits = normalizePhone(input.phone);

  if (digits.length < 9 || digits.length > 11) {
    return '연락처를 정확히 입력해 주세요.';
  }

  if (!Number.isInteger(input.people) || input.people < 1 || input.people > MAX_PEOPLE) {
    return '인원은 1명에서 ' + MAX_PEOPLE + '명까지 가능해요.';
  }

  if ((input.memo || '').trim().length > 500) {
    return '요청사항은 500자 이내로 입력해 주세요.';
  }

  if (!input.agreed) {
    return '개인정보 수집·이용에 동의해 주세요.';
  }

  return null;
}

export async function createBooking(
  store: BookingStore,
  input: BookingInput,
  now: Date = new Date(),
): Promise<Result<Booking>> {
  const error = validateBooking(input, now);

  if (error) {
    return { ok: false, error };
  }

  try {
    return await store.create({
      date: input.date,
      time: input.time,
      name: input.name.trim(),
      phone: normalizePhone(input.phone),
      people: input.people,
      memo: (input.memo || '').trim(),
    });
  } catch {
    return { ok: false, error: '예약을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

export async function setBookingStatus(
  store: BookingStore,
  id: string,
  status: 'confirmed' | 'cancelled',
): Promise<Result<null>> {
  try {
    return await store.updateStatus(id, status);
  } catch {
    return { ok: false, error: '상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 데모용 저장소: 이 브라우저 안에만 저장됩니다.
// 손님 휴대폰에서 한 예약은 사장님 기기에 보이지 않습니다. 실제 운영은 README.md 대로 Supabase 를 연결하세요.
export class LocalBookingStore implements BookingStore {
  readonly mode = 'demo' as const;

  private key = 'coverfo-booking:' + FACILITY;

  private read(): Booking[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(bookings: Booking[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.key, JSON.stringify(bookings));
  }

  async countByTime(date: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    for (const b of this.read()) {
      if (b.date === date && b.status !== 'cancelled') {
        counts[b.time] = (counts[b.time] || 0) + 1;
      }
    }

    return counts;
  }

  async create(input: NewBooking): Promise<Result<Booking>> {
    const all = this.read();
    const used = all.filter((b) => b.date === input.date && b.time === input.time && b.status !== 'cancelled').length;

    if (used >= CAPACITY_PER_SLOT) {
      return { ok: false, error: FULL_MESSAGE };
    }

    const booking: Booking = { ...input, id: makeId(), status: 'requested', createdAt: new Date().toISOString() };
    this.write(all.concat(booking));

    return { ok: true, value: booking };
  }

  async listByDate(date: string): Promise<Booking[]> {
    return this.read()
      .filter((b) => b.date === date)
      .sort((a, b) => (a.time === b.time ? a.createdAt.localeCompare(b.createdAt) : a.time.localeCompare(b.time)));
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Result<null>> {
    const all = this.read();
    const target = all.find((b) => b.id === id);

    if (!target) {
      return { ok: false, error: '예약을 찾을 수 없어요.' };
    }

    if (target.status === 'cancelled') {
      return { ok: false, error: CANCELLED_MESSAGE };
    }

    this.write(all.map((b) => (b.id === id ? { ...b, status } : b)));

    return { ok: true, value: null };
  }
}
`;
};

/**
 * Supabase 저장소 파일(src/booking/supabaseStore.ts) 코드입니다.
 * 함수 이름·인자 이름은 bookingSchemaSql 이 만드는 SQL 과 맞춰져 있습니다.
 */
export const bookingSupabaseStore = `// booking/supabaseStore.ts - Supabase 에 예약을 저장하는 운영용 저장소
// 필요한 값: 프로젝트 맨 위 .env 파일의 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (README.md 참고)
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking, BookingStatus, BookingStore, NewBooking, OwnerAuth, OwnerState, Result } from './bookingCore';

interface BookingRow {
  id: string;
  booking_date: string;
  booking_time: string;
  name: string;
  phone: string;
  people: number;
  memo: string | null;
  status: BookingStatus;
  created_at: string;
}

const BOOKING_COLUMNS = 'id, booking_date, booking_time, name, phone, people, memo, status, created_at';

// supabase/schema.sql 의 raise exception 으로 보낸 안내 문구만 그대로 보여줌
const DB_MESSAGE_CODE = 'P0001';

export function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    date: row.booking_date,
    time: String(row.booking_time).slice(0, 5),
    name: row.name,
    phone: row.phone,
    people: row.people,
    memo: row.memo || '',
    status: row.status,
    createdAt: row.created_at,
  };
}

class SupabaseOwnerAuth implements OwnerAuth {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getState(): Promise<OwnerState> {
    const { data } = await this.client.auth.getSession();
    const user = data.session ? data.session.user : null;

    if (!user) {
      return 'signed-out';
    }

    const { data: row, error } = await this.client
      .from('booking_owners')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return row ? 'owner' : 'not-owner';
  }

  async signIn(email: string, password: string): Promise<Result<OwnerState>> {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      return { ok: false, error: '로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.' };
    }

    return { ok: true, value: await this.getState() };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}

export class SupabaseBookingStore implements BookingStore {
  readonly mode = 'server' as const;

  readonly auth: OwnerAuth;

  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.auth = new SupabaseOwnerAuth(client);
  }

  async countByTime(date: string): Promise<Record<string, number>> {
    const { data, error } = await this.client.rpc('booking_counts', { p_date: date });

    if (error) {
      throw new Error(error.message);
    }

    const counts: Record<string, number> = {};

    for (const row of (data || []) as { booking_time: string; booked: number }[]) {
      counts[row.booking_time] = row.booked;
    }

    return counts;
  }

  async create(input: NewBooking): Promise<Result<Booking>> {
    const { data, error } = await this.client.rpc('create_booking', {
      p_date: input.date,
      p_time: input.time,
      p_name: input.name,
      p_phone: input.phone,
      p_people: input.people,
      p_memo: input.memo,
    });

    if (error) {
      return {
        ok: false,
        error: error.code === DB_MESSAGE_CODE ? error.message : '예약을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      };
    }

    return {
      ok: true,
      value: { ...input, id: String(data), status: 'requested', createdAt: new Date().toISOString() },
    };
  }

  async listByDate(date: string): Promise<Booking[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('booking_date', date)
      .order('booking_time')
      .order('created_at');

    if (error) {
      throw new Error(error.message);
    }

    return ((data || []) as BookingRow[]).map(toBooking);
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Result<null>> {
    const { data, error } = await this.client
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .neq('status', 'cancelled')
      .select('id');

    if (error) {
      return { ok: false, error: '상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }

    if (!data || data.length === 0) {
      return { ok: false, error: '취소된 예약이거나 바꿀 권한이 없어요.' };
    }

    return { ok: true, value: null };
  }
}

/** .env 에 두 값이 모두 있으면 운영 저장소, 없으면 null (데모 모드) */
export function createStoreFromEnv(): SupabaseBookingStore | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return new SupabaseBookingStore(createClient(url, key));
}
`;

/** Vite 환경변수 타입 파일(src/vite-env.d.ts) */
export const bookingViteEnvDts = `/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`;

/** .env.example */
export const bookingEnvExample = `# 이 파일을 복사해서 이름을 .env 로 만들고, Supabase 값을 넣으세요. (README.md 참고)
# 두 값이 비어 있으면 데모 모드(브라우저에만 저장)로 동작합니다.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
`;

/**
 * Supabase 테이블·보안 규칙·함수 SQL(supabase/schema.sql)
 * 영업시간·정원 값은 bookingCore.ts 와 같은 값으로 만들어집니다.
 */
export const bookingSchemaSql = (facility: string, options: BookingTemplateOptions = {}) => {
  const o = resolveOptions(facility, options);
  const openMinutes = timeToMinutes(o.openTime);
  const closeMinutes = timeToMinutes(o.closeTime);

  return `-- supabase/schema.sql - ${oneLine(o.facility)} 예약 페이지 (coverfo.com)
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 됩니다.
-- 영업시간 ${o.openTime}~${o.closeTime}, ${o.slotMinutes}분 단위, 시간당 ${o.capacityPerSlot}팀, 최대 ${o.maxPeople}명
-- 이 값은 src/booking/bookingCore.ts 와 같아야 합니다.

-- 1. 예약 테이블
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_date date not null,
  booking_time time not null,
  name text not null check (char_length(name) between 1 and 50),
  phone text not null check (phone ~ '^[0-9]{9,11}$'),
  people integer not null check (people between 1 and ${o.maxPeople}),
  memo text not null default '' check (char_length(memo) <= 500),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_date_time_idx on public.bookings (booking_date, booking_time);

-- 2. 사장님 계정 목록 (여기 등록된 로그인 계정만 예약 목록을 볼 수 있음)
create table if not exists public.booking_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. 보안 규칙: 기본은 전부 막고, 필요한 것만 허용
alter table public.bookings enable row level security;
alter table public.booking_owners enable row level security;

create or replace function public.is_booking_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.booking_owners where user_id = auth.uid());
$$;

drop policy if exists "owner_select_bookings" on public.bookings;
create policy "owner_select_bookings" on public.bookings
  for select to authenticated using (public.is_booking_owner());

drop policy if exists "owner_update_bookings" on public.bookings;
create policy "owner_update_bookings" on public.bookings
  for update to authenticated using (public.is_booking_owner()) with check (public.is_booking_owner());

drop policy if exists "self_select_owner" on public.booking_owners;
create policy "self_select_owner" on public.booking_owners
  for select to authenticated using (user_id = auth.uid());

-- 4. 손님 화면용: 시간대별 예약 수만 돌려줌 (이름·연락처는 돌려주지 않음)
create or replace function public.booking_counts(p_date date)
returns table (booking_time text, booked integer)
language sql
stable
security definer
set search_path = public
as $$
  select to_char(b.booking_time, 'HH24:MI'), count(*)::integer
  from public.bookings b
  where b.booking_date = p_date and b.status != 'cancelled'
  group by b.booking_time;
$$;

-- 5. 손님 예약 신청: 입력 검사 + 정원 확인 + 저장을 한 번에 (동시에 신청해도 정원을 넘지 않음)
create or replace function public.create_booking(
  p_date date,
  p_time text,
  p_name text,
  p_phone text,
  p_people integer,
  p_memo text default ''
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_minutes integer;
  v_booked integer;
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_memo text := btrim(coalesce(p_memo, ''));
begin
  if p_date is null then
    raise exception '날짜를 선택해 주세요.';
  end if;

  if p_time is null or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception '시간을 선택해 주세요.';
  end if;

  v_minutes := split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;

  if v_minutes < ${openMinutes} or v_minutes + ${o.slotMinutes} > ${closeMinutes} or (v_minutes - ${openMinutes}) % ${o.slotMinutes} != 0 then
    raise exception '시간을 선택해 주세요.';
  end if;

  if (p_date + p_time::time) <= (now() at time zone 'Asia/Seoul') then
    raise exception '이미 지난 시간은 예약할 수 없어요.';
  end if;

  if v_name = '' or char_length(v_name) > 50 then
    raise exception '이름을 입력해 주세요.';
  end if;

  if char_length(v_phone) < 9 or char_length(v_phone) > 11 then
    raise exception '연락처를 정확히 입력해 주세요.';
  end if;

  if p_people is null or p_people < 1 or p_people > ${o.maxPeople} then
    raise exception '인원은 1명에서 ${o.maxPeople}명까지 가능해요.';
  end if;

  if char_length(v_memo) > 500 then
    raise exception '요청사항은 500자 이내로 입력해 주세요.';
  end if;

  perform pg_advisory_xact_lock(hashtext('booking:' || p_date::text || ' ' || p_time));

  select count(*) into v_booked
  from public.bookings
  where booking_date = p_date and booking_time = p_time::time and status != 'cancelled';

  if v_booked >= ${o.capacityPerSlot} then
    raise exception '선택한 시간은 예약이 마감되었어요.';
  end if;

  insert into public.bookings (booking_date, booking_time, name, phone, people, memo)
  values (p_date, p_time::time, v_name, v_phone, p_people, v_memo)
  returning id into v_id;

  return v_id;
end;
$$;

-- 6. 권한: 손님(anon)은 위 두 함수만, 로그인 사용자는 보안 규칙을 통과한 것만
revoke all on function public.is_booking_owner() from public;
revoke all on function public.booking_counts(date) from public;
revoke all on function public.create_booking(date, text, text, text, integer, text) from public;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_booking_owner() to authenticated;
grant execute on function public.booking_counts(date) to anon, authenticated;
grant execute on function public.create_booking(date, text, text, text, integer, text) to anon, authenticated;
grant select, update on public.bookings to authenticated;
grant select on public.booking_owners to authenticated;
`;
};

/** README.md - 운영 모드로 바꾸는 방법 */
export const bookingReadme = (facility: string) => `# ${oneLine(facility)} 예약 페이지 (coverfo.com)

손님은 날짜·시간을 골라 예약을 신청하고, 사장님은 로그인해서 예약을 확인·확정·취소합니다.

- 손님 화면: 주소 그대로
- 사장님 화면: 주소 끝에 #admin

## 지금은 데모 모드

.env 에 Supabase 값이 없으면 예약이 이 브라우저에만 저장됩니다. 손님 휴대폰에서 한 예약은 사장님 기기에 보이지 않습니다.
아래 순서대로 Supabase 를 연결하면 운영 모드로 바뀝니다.

## 운영 모드로 바꾸기

1. supabase.com 에서 새 프로젝트를 만듭니다.
2. 대시보드 왼쪽 SQL Editor 를 열고, 이 프로젝트의 supabase/schema.sql 내용 전체를 붙여넣은 뒤 Run 을 누릅니다.
3. 대시보드 왼쪽 Authentication > Users 에서 Add user > Create new user 를 누르고, 사장님 이메일과 비밀번호로 계정을 만듭니다. (Auto Confirm User 체크)
4. 다시 SQL Editor 에서 아래 SQL 의 이메일을 사장님 이메일로 바꿔 Run 합니다. 이 계정만 예약 목록을 볼 수 있게 됩니다.

    insert into public.booking_owners (user_id)
    select id from auth.users where email = '사장님이메일@example.com'
    on conflict do nothing;

5. 프로젝트 Connect 창 또는 Settings > API Keys 에서 Project URL 과 Publishable key(sb_publishable_ 로 시작)를 복사합니다.
6. .env.example 을 복사해 .env 파일을 만들고 두 값을 넣습니다.

    VITE_SUPABASE_URL=복사한 Project URL
    VITE_SUPABASE_PUBLISHABLE_KEY=복사한 Publishable key

7. 미리보기 서버를 다시 시작합니다. (터미널에서 Ctrl+C 후 npm run dev)
8. 사장님 화면(#admin)에서 3번 계정으로 로그인해 확인합니다.

## 알아둘 점

- Publishable key 는 화면 코드에 들어가도 되는 공개용 키입니다. 데이터 보호는 schema.sql 의 보안 규칙(RLS)이 맡습니다. Secret key 는 절대 넣지 마세요.
- 손님은 시간대별 예약 수만 볼 수 있고, 다른 손님의 이름·연락처는 볼 수 없습니다.
- 예약 신청은 서버에서 한 번 더 검사하고, 같은 시간에 동시에 신청해도 정원을 넘지 않게 처리합니다.
- 영업시간·정원을 바꾸려면 src/booking/bookingCore.ts 와 supabase/schema.sql 을 같이 바꾸고, schema.sql 을 다시 Run 합니다.
- 누구나 예약 신청을 보낼 수 있으므로, 장난 신청이 많아지면 사장님 화면에서 취소하거나 추가 인증을 붙여야 합니다.
- 손님 이름·연락처를 받으므로 개인정보 처리 안내를 가게 상황에 맞게 준비하세요.
`;

/**
 * 예약 화면 파일(src/booking/BookingUI.tsx) 코드입니다.
 * BookingPage: 손님용 예약 신청 화면 / BookingAdmin: 사장님용 예약 관리 화면(운영 모드는 로그인 필요)
 */
export const bookingUI = `// booking/BookingUI.tsx - coverfo.com 예약 페이지 화면
// BookingPage: 손님용 예약 신청 화면
// BookingAdmin: 사장님용 예약 관리 화면 (운영 모드에서는 사장님 계정 로그인 필요)
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { FACILITY, MAX_PEOPLE, STATUS_LABEL, createBooking, formatDate, getAvailability, setBookingStatus } from './bookingCore';
import type { Booking, BookingStore, OwnerState, SlotInfo } from './bookingCore';

const pageStyle: CSSProperties = { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' };
const labelStyle: CSSProperties = { display: 'block', marginTop: 14, fontWeight: 600 };
const inputStyle: CSSProperties = { width: '100%', padding: 10, fontSize: 16, marginTop: 6, boxSizing: 'border-box' };
const buttonStyle: CSSProperties = { padding: '10px 14px', fontSize: 15, borderRadius: 8, border: '1px solid #ccc', background: '#fff' };
const primaryStyle: CSSProperties = { ...buttonStyle, width: '100%', marginTop: 18, background: '#222', color: '#fff', border: 'none' };
const noticeStyle: CSSProperties = { fontSize: 13, background: '#fff4d6', padding: 8, borderRadius: 6 };

export function BookingPage({ store }: { store: BookingStore }) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loadError, setLoadError] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [people, setPeople] = useState(1);
  const [memo, setMemo] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh(targetDate: string) {
    setLoadError('');

    try {
      const counts = await store.countByTime(targetDate);
      setSlots(getAvailability(counts, targetDate));
    } catch {
      setSlots([]);
      setLoadError('예약 현황을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  useEffect(() => {
    setTime('');
    refresh(date);
  }, [date]);

  async function submit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    const result = await createBooking(store, { date, time, name, phone, people, memo, agreed });
    setSubmitting(false);

    if (!result.ok) {
      setMessage(result.error);
      refresh(date);
      return;
    }

    setMessage(result.value.date + ' ' + result.value.time + ' 예약 신청이 접수되었어요. 사장님 확인 후 확정됩니다.');
    setTime('');
    setName('');
    setPhone('');
    setPeople(1);
    setMemo('');
    setAgreed(false);
    refresh(date);
  }

  return (
    <div style={pageStyle}>
      <h2>{FACILITY} 예약</h2>

      <label style={labelStyle}>날짜</label>
      <input type="date" style={inputStyle} value={date} min={formatDate(new Date())} onChange={(e) => setDate(e.target.value)} />

      <label style={labelStyle}>시간</label>
      {loadError && <p style={{ color: '#c00' }}>{loadError}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {slots.map((slot) => {
          const disabled = slot.isPast || slot.remaining <= 0;
          const note = slot.isPast ? '지남' : slot.remaining <= 0 ? '마감' : '남은 ' + slot.remaining;
          const selected = slot.time === time;

          return (
            <button
              key={slot.time}
              type="button"
              disabled={disabled}
              onClick={() => setTime(slot.time)}
              style={{ ...buttonStyle, opacity: disabled ? 0.4 : 1, background: selected ? '#222' : '#fff', color: selected ? '#fff' : '#222' }}
            >
              {slot.time} ({note})
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>이름</label>
      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />

      <label style={labelStyle}>연락처</label>
      <input type="tel" style={inputStyle} value={phone} placeholder="010-0000-0000" onChange={(e) => setPhone(e.target.value)} />

      <label style={labelStyle}>인원 (최대 {MAX_PEOPLE}명)</label>
      <input type="number" style={inputStyle} min={1} max={MAX_PEOPLE} value={people} onChange={(e) => setPeople(Number(e.target.value))} />

      <label style={labelStyle}>요청사항 (선택)</label>
      <textarea style={inputStyle} rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />

      <label style={{ ...labelStyle, fontWeight: 400 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> 예약 확인 연락을 위한 이름·연락처 수집·이용에 동의합니다.
      </label>

      <button type="button" style={primaryStyle} disabled={submitting} onClick={submit}>
        {submitting ? '신청 중...' : '예약 신청'}
      </button>

      {message && <p style={{ marginTop: 14 }}>{message}</p>}
    </div>
  );
}

export function BookingAdmin({ store }: { store: BookingStore }) {
  const [ownerState, setOwnerState] = useState<OwnerState | 'checking'>(store.auth ? 'checking' : 'owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(formatDate(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!store.auth) {
      return;
    }

    store.auth
      .getState()
      .then(setOwnerState)
      .catch(() => {
        setOwnerState('signed-out');
        setMessage('로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.');
      });
  }, []);

  async function refresh() {
    try {
      setBookings(await store.listByDate(date));
    } catch {
      setMessage('예약 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  useEffect(() => {
    if (ownerState === 'owner') {
      refresh();
    }
  }, [date, ownerState]);

  async function login() {
    if (!store.auth || busy) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const result = await store.auth.signIn(email, password);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setPassword('');
      setOwnerState(result.value);
    } catch {
      setMessage('로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!store.auth) {
      return;
    }

    await store.auth.signOut();
    setBookings([]);
    setMessage('');
    setOwnerState('signed-out');
  }

  async function change(id: string, status: 'confirmed' | 'cancelled') {
    const result = await setBookingStatus(store, id, status);
    setMessage(result.ok ? '' : result.error);
    refresh();
  }

  if (ownerState === 'checking') {
    return (
      <div style={pageStyle}>
        <h2>{FACILITY} 예약 관리</h2>
        <p>로그인 상태 확인 중...</p>
      </div>
    );
  }

  if (ownerState === 'signed-out') {
    return (
      <div style={pageStyle}>
        <h2>{FACILITY} 예약 관리</h2>
        <p>사장님 계정으로 로그인해 주세요.</p>

        <label style={labelStyle}>이메일</label>
        <input type="email" style={inputStyle} value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} />

        <label style={labelStyle}>비밀번호</label>
        <input type="password" style={inputStyle} value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />

        <button type="button" style={primaryStyle} disabled={busy} onClick={login}>
          {busy ? '로그인 중...' : '로그인'}
        </button>

        {message && <p style={{ color: '#c00', marginTop: 14 }}>{message}</p>}
      </div>
    );
  }

  if (ownerState === 'not-owner') {
    return (
      <div style={pageStyle}>
        <h2>{FACILITY} 예약 관리</h2>
        <p>이 계정은 사장님 계정으로 등록되지 않았어요. README.md 의 사장님 등록 단계를 확인해 주세요.</p>
        <button type="button" style={buttonStyle} onClick={logout}>
          로그아웃
        </button>
      </div>
    );
  }

  const activeCount = bookings.filter((b) => b.status !== 'cancelled').length;

  return (
    <div style={pageStyle}>
      <h2>{FACILITY} 예약 관리</h2>

      {store.mode === 'demo' && (
        <p style={noticeStyle}>
          데모 모드: 예약이 이 브라우저에만 저장됩니다. 손님 기기에서 한 예약은 여기에 보이지 않아요. 실제 운영은 README.md 대로 Supabase 를 연결하세요.
        </p>
      )}

      {store.auth && (
        <button type="button" style={buttonStyle} onClick={logout}>
          로그아웃
        </button>
      )}

      <label style={labelStyle}>날짜</label>
      <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />

      <p style={{ marginTop: 14 }}>
        예약 {activeCount}건 (취소 제외)
        <button type="button" style={{ ...buttonStyle, marginLeft: 8 }} onClick={() => refresh()}>
          새로고침
        </button>
      </p>

      {message && <p style={{ color: '#c00' }}>{message}</p>}

      {bookings.length === 0 && <p>이 날짜에는 예약이 없어요.</p>}

      {bookings.map((b) => (
        <div key={b.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 10, opacity: b.status === 'cancelled' ? 0.5 : 1 }}>
          <div style={{ fontWeight: 700 }}>
            {b.time} · {b.name} · {b.people}명 · {STATUS_LABEL[b.status]}
          </div>
          <div style={{ marginTop: 4 }}>
            <a href={'tel:' + b.phone}>{b.phone}</a>
          </div>
          {b.memo && <div style={{ marginTop: 4, color: '#555' }}>{b.memo}</div>}
          {b.status !== 'cancelled' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {b.status === 'requested' && (
                <button type="button" style={buttonStyle} onClick={() => change(b.id, 'confirmed')}>
                  확정
                </button>
              )}
              <button type="button" style={buttonStyle} onClick={() => change(b.id, 'cancelled')}>
                취소
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
`;
