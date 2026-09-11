/*
 * app/lib/agents/universalBookingAgent.ts
 * 범용 예약 페이지 템플릿 - 사장님 본인의 예약 페이지를 만들어 줌
 * 손님: 날짜·시간을 골라 예약 신청 / 사장님: 예약 목록 확인·확정·취소
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

/**
 * 예약 핵심 로직 파일(bookingCore.ts) 코드를 만들어 돌려줍니다.
 * 시설 이름은 JSON.stringify 로 넣으므로 따옴표 등이 들어가도 생성 코드가 깨지지 않습니다.
 */
export const universalBookingTemplate = (facility: string, options: BookingTemplateOptions = {}) => {
  const openTime = options.openTime ?? '09:00';
  const closeTime = options.closeTime ?? '21:00';
  const slotMinutes = options.slotMinutes ?? 60;
  const capacityPerSlot = options.capacityPerSlot ?? 1;
  const maxPeople = options.maxPeople ?? 10;

  if (!facility.trim()) {
    throw new Error('시설 이름이 비어 있습니다.');
  }

  if (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime)) {
    throw new Error(`영업 시간은 HH:MM 형식이어야 합니다: ${openTime} ~ ${closeTime}`);
  }

  assertPositiveInteger('slotMinutes', slotMinutes);
  assertPositiveInteger('capacityPerSlot', capacityPerSlot);
  assertPositiveInteger('maxPeople', maxPeople);

  if (timeToMinutes(openTime) + slotMinutes > timeToMinutes(closeTime)) {
    throw new Error(`영업 시간 안에 예약 칸이 하나도 들어가지 않습니다: ${openTime} ~ ${closeTime}, ${slotMinutes}분`);
  }

  return `// booking/bookingCore.ts - coverfo.com 예약 페이지 핵심 로직
// 사장님 본인의 예약 페이지용입니다. 다른 회사 사이트를 자동 조작하지 않습니다.

export const FACILITY: string = ${JSON.stringify(facility)};
export const OPEN_TIME = ${JSON.stringify(openTime)};
export const CLOSE_TIME = ${JSON.stringify(closeTime)};
export const SLOT_MINUTES = ${slotMinutes};
export const CAPACITY_PER_SLOT = ${capacityPerSlot};
export const MAX_PEOPLE = ${maxPeople};

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

export interface BookingInput {
  date: string;
  time: string;
  name: string;
  phone: string;
  people: number;
  memo?: string;
  agreed: boolean;
}

export interface SlotInfo {
  time: string;
  remaining: number;
  isPast: boolean;
}

// 저장소 형태: 데모는 LocalBookingStore, 실제 운영은 같은 형태로 서버 저장소를 연결
export interface BookingStore {
  list(): Promise<Booking[]>;
  add(booking: Booking): Promise<void>;
  updateStatus(id: string, status: BookingStatus): Promise<void>;
}

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

export function getRemaining(bookings: Booking[], date: string, time: string): number {
  const used = bookings.filter((b) => b.status !== 'cancelled' && b.date === date && b.time === time).length;
  return Math.max(0, CAPACITY_PER_SLOT - used);
}

export function getAvailability(bookings: Booking[], date: string, now: Date = new Date()): SlotInfo[] {
  return getTimeSlots().map((time) => ({
    time,
    remaining: getRemaining(bookings, date, time),
    isPast: isPastSlot(date, time, now),
  }));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function validateBooking(input: BookingInput, bookings: Booking[], now: Date = new Date()): string | null {
  if (!DATE_PATTERN.test(input.date)) {
    return '날짜를 선택해 주세요.';
  }

  if (getTimeSlots().indexOf(input.time) === -1) {
    return '시간을 선택해 주세요.';
  }

  if (isPastSlot(input.date, input.time, now)) {
    return '이미 지난 시간은 예약할 수 없어요.';
  }

  if (!input.name.trim()) {
    return '이름을 입력해 주세요.';
  }

  const digits = normalizePhone(input.phone);

  if (digits.length < 9 || digits.length > 11) {
    return '연락처를 정확히 입력해 주세요.';
  }

  if (!Number.isInteger(input.people) || input.people < 1 || input.people > MAX_PEOPLE) {
    return '인원은 1명에서 ' + MAX_PEOPLE + '명까지 가능해요.';
  }

  if (!input.agreed) {
    return '개인정보 수집·이용에 동의해 주세요.';
  }

  if (getRemaining(bookings, input.date, input.time) <= 0) {
    return '선택한 시간은 예약이 마감되었어요.';
  }

  return null;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function createBooking(
  store: BookingStore,
  input: BookingInput,
  now: Date = new Date(),
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const bookings = await store.list();
  const error = validateBooking(input, bookings, now);

  if (error) {
    return { ok: false, error };
  }

  const booking: Booking = {
    id: makeId(),
    date: input.date,
    time: input.time,
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    people: input.people,
    memo: (input.memo || '').trim(),
    status: 'requested',
    createdAt: now.toISOString(),
  };

  await store.add(booking);

  return { ok: true, booking };
}

export async function setBookingStatus(
  store: BookingStore,
  id: string,
  status: 'confirmed' | 'cancelled',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bookings = await store.list();
  const target = bookings.find((b) => b.id === id);

  if (!target) {
    return { ok: false, error: '예약을 찾을 수 없어요.' };
  }

  if (target.status === 'cancelled') {
    return { ok: false, error: '취소된 예약은 되돌릴 수 없어요.' };
  }

  await store.updateStatus(id, status);

  return { ok: true };
}

// 데모용 저장소: 이 브라우저 안에만 저장됩니다.
// 손님 휴대폰에서 한 예약은 사장님 기기에 보이지 않습니다.
// 실제 운영에서는 BookingStore 형태에 맞춰 서버 저장소(예: Supabase)를 연결하세요.
export class LocalBookingStore implements BookingStore {
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

  async list(): Promise<Booking[]> {
    return this.read();
  }

  async add(booking: Booking): Promise<void> {
    this.write(this.read().concat(booking));
  }

  async updateStatus(id: string, status: BookingStatus): Promise<void> {
    this.write(this.read().map((b) => (b.id === id ? { ...b, status } : b)));
  }
}
`;
};

/**
 * 예약 화면 파일(BookingUI.tsx) 코드입니다. bookingCore.ts 와 같은 폴더에 둡니다.
 * BookingPage: 손님용 예약 신청 화면 / BookingAdmin: 사장님용 예약 목록 화면
 */
export const bookingUI = `// booking/BookingUI.tsx - coverfo.com 예약 페이지 화면
// BookingPage: 손님용 예약 신청 화면
// BookingAdmin: 사장님용 예약 목록 화면
// 주의: 실제 운영에서는 BookingAdmin 을 로그인 등으로 보호해야 합니다. (손님이 주소로 들어오지 못하게)
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  FACILITY,
  MAX_PEOPLE,
  STATUS_LABEL,
  LocalBookingStore,
  createBooking,
  formatDate,
  getAvailability,
  setBookingStatus,
} from './bookingCore';
import type { Booking, BookingStore, SlotInfo } from './bookingCore';

const defaultStore = new LocalBookingStore();

const pageStyle: CSSProperties = { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' };
const labelStyle: CSSProperties = { display: 'block', marginTop: 14, fontWeight: 600 };
const inputStyle: CSSProperties = { width: '100%', padding: 10, fontSize: 16, marginTop: 6, boxSizing: 'border-box' };
const buttonStyle: CSSProperties = { padding: '10px 14px', fontSize: 15, borderRadius: 8, border: '1px solid #ccc', background: '#fff' };
const primaryStyle: CSSProperties = { ...buttonStyle, width: '100%', marginTop: 18, background: '#222', color: '#fff', border: 'none' };

export function BookingPage({ store = defaultStore }: { store?: BookingStore }) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [people, setPeople] = useState(1);
  const [memo, setMemo] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh(targetDate: string) {
    const bookings = await store.list();
    setSlots(getAvailability(bookings, targetDate));
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
      return;
    }

    setMessage(result.booking.date + ' ' + result.booking.time + ' 예약 신청이 접수되었어요. 사장님 확인 후 확정됩니다.');
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

export function BookingAdmin({ store = defaultStore }: { store?: BookingStore }) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState('');

  async function refresh() {
    const all = await store.list();
    const sameDay = all.filter((b) => b.date === date);
    sameDay.sort((a, b) => (a.time === b.time ? a.createdAt.localeCompare(b.createdAt) : a.time.localeCompare(b.time)));
    setBookings(sameDay);
  }

  useEffect(() => {
    refresh();
  }, [date]);

  async function change(id: string, status: 'confirmed' | 'cancelled') {
    const result = await setBookingStatus(store, id, status);
    setMessage(result.ok ? '' : result.error);
    refresh();
  }

  const activeCount = bookings.filter((b) => b.status !== 'cancelled').length;

  return (
    <div style={pageStyle}>
      <h2>{FACILITY} 예약 관리</h2>

      {store instanceof LocalBookingStore && (
        <p style={{ fontSize: 13, background: '#fff4d6', padding: 8, borderRadius: 6 }}>
          데모 모드: 예약이 이 브라우저에만 저장됩니다. 손님 기기에서 한 예약은 여기에 보이지 않아요.
        </p>
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
