/*
 * app/lib/agents/universalQuoteBuilder.ts
 * 범용 견적서 템플릿 - 사장님이 품목을 입력하거나 엑셀(CSV)을 불러와 견적서를 만들고 PDF로 저장
 * 내 데이터만 사용 (외부 사이트 접속·크롤링 없음), 브라우저 안에서만 계산
 * 내보내기: CSV(엑셀·구글시트), 표 복사(노션·메모), 인쇄 → PDF 저장
 * © bj Lee - coverfo.com - Uncovering the fog
 */

function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}

/** 견적 계산·저장·불러오기 로직(src/quote/quoteCore.ts) */
export const quoteCoreTs = `// quote/quoteCore.ts - 견적서 계산과 파일 변환 (coverfo.com 견적서 템플릿)

export const VAT_RATE = 0.1; // 부가세 10%

export type RoundMode = 'none' | 'won' | 'ten' | 'hundred';

export const ROUND_LABEL: Record<RoundMode, string> = {
  none: '안 함',
  won: '원 단위 버림',
  ten: '십원 단위 버림',
  hundred: '백원 단위 버림',
};

export interface QuoteItem {
  id: string;
  name: string;
  spec: string;
  qty: number;
  price: number;
  note: string;
}

export interface QuoteInfo {
  company: string;
  ownerName: string;
  bizNo: string;
  phone: string;
  email: string;
  address: string;
  bank: string;
}

export interface QuoteDoc {
  title: string;
  date: string;
  customer: string;
  manager: string;
  validDays: number;
  memo: string;
  vat: boolean;
  round: RoundMode;
  discount: number;
  items: QuoteItem[];
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  total: number;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function formatDate(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function addDays(date: string, days: number): string {
  const parts = date.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);

  return formatDate(d);
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function emptyItem(): QuoteItem {
  return { id: makeId(), name: '', spec: '', qty: 1, price: 0, note: '' };
}

export function createDoc(title: string): QuoteDoc {
  return {
    title,
    date: formatDate(new Date()),
    customer: '',
    manager: '',
    validDays: 15,
    memo: '',
    vat: true,
    round: 'none',
    discount: 0,
    items: [emptyItem()],
  };
}

/** 숫자로 바꿀 수 없으면 0 */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function itemAmount(item: QuoteItem): number {
  return Math.round(toNumber(item.qty) * toNumber(item.price));
}

export function applyRound(value: number, mode: RoundMode): number {
  if (mode === 'won') {
    return Math.floor(value);
  }

  if (mode === 'ten') {
    return Math.floor(value / 10) * 10;
  }

  if (mode === 'hundred') {
    return Math.floor(value / 100) * 100;
  }

  return value;
}

export function calcTotals(doc: QuoteDoc): QuoteTotals {
  const subtotal = doc.items.reduce((sum, item) => sum + itemAmount(item), 0);
  const discount = Math.min(Math.max(0, Math.round(toNumber(doc.discount))), subtotal);
  const afterDiscount = subtotal - discount;
  const vat = doc.vat ? applyRound(afterDiscount * VAT_RATE, doc.round) : 0;

  return { subtotal, discount, afterDiscount, vat, total: afterDiscount + vat };
}

export function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('ko-KR');
}

const KOREAN_DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조'];

/** 금액을 한글로 (예: 1250000 → 일백이십오만) */
export function moneyToKorean(value: number): string {
  const amount = Math.round(Math.abs(value));

  if (amount === 0) {
    return '영';
  }

  const digits = String(amount).split('').map(Number).reverse();
  let result = '';

  for (let group = 0; group * 4 < digits.length; group++) {
    let chunk = '';

    for (let i = 0; i < 4; i++) {
      const digit = digits[group * 4 + i];

      if (digit) {
        chunk = KOREAN_DIGITS[digit] + SMALL_UNITS[i] + chunk;
      }
    }

    if (chunk) {
      result = chunk + BIG_UNITS[group] + result;
    }
  }

  return (value < 0 ? '마이너스 ' : '') + result;
}

/* ===== CSV (엑셀·구글시트) ===== */

/** 따옴표 안의 쉼표·줄바꿈까지 처리하는 CSV 읽기 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\\uFEFF/, '').replace(/\\r\\n?/g, '\\n');

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',' || ch === '\\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_KEYS: Record<string, keyof QuoteItem> = {
  품목: 'name',
  품명: 'name',
  내용: 'name',
  name: 'name',
  item: 'name',
  규격: 'spec',
  사양: 'spec',
  spec: 'spec',
  수량: 'qty',
  개수: 'qty',
  qty: 'qty',
  quantity: 'qty',
  단가: 'price',
  가격: 'price',
  price: 'price',
  비고: 'note',
  note: 'note',
  memo: 'note',
};

/** 엑셀에서 내보낸 CSV → 품목 목록. 머리글이 있으면 열 이름으로, 없으면 순서대로 읽음 */
export function itemsFromCsv(text: string): QuoteItem[] {
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((c) => c.trim().toLowerCase());
  const mapped = header.map((c) => HEADER_KEYS[c]);
  const hasHeader = mapped.filter(Boolean).length >= 2;
  const body = hasHeader ? rows.slice(1) : rows;

  return body.map((cells) => {
    const item = emptyItem();

    if (hasHeader) {
      mapped.forEach((key, index) => {
        if (!key) {
          return;
        }

        const value = (cells[index] ?? '').trim();

        if (key === 'qty' || key === 'price') {
          item[key] = toNumber(value);
        } else {
          item[key] = value;
        }
      });
    } else {
      item.name = (cells[0] ?? '').trim();
      item.spec = (cells[1] ?? '').trim();
      item.qty = toNumber(cells[2]);
      item.price = toNumber(cells[3]);
      item.note = (cells[4] ?? '').trim();
    }

    if (!item.qty) {
      item.qty = 1;
    }

    return item;
  });
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\\n\\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** 엑셀·구글시트에 넣을 CSV (엑셀 한글 깨짐 방지를 위해 BOM 포함) */
export function itemsToCsv(doc: QuoteDoc): string {
  const totals = calcTotals(doc);
  const lines = [['품목', '규격', '수량', '단가', '금액', '비고'].join(',')];

  doc.items.forEach((item) => {
    lines.push([item.name, item.spec, item.qty, item.price, itemAmount(item), item.note].map(csvCell).join(','));
  });

  lines.push(['합계', '', '', '', totals.subtotal, ''].map(csvCell).join(','));

  if (totals.discount) {
    lines.push(['할인', '', '', '', -totals.discount, ''].map(csvCell).join(','));
  }

  if (doc.vat) {
    lines.push(['부가세', '', '', '', totals.vat, ''].map(csvCell).join(','));
  }

  lines.push(['총액', '', '', '', totals.total, ''].map(csvCell).join(','));

  return '\\uFEFF' + lines.join('\\r\\n') + '\\r\\n';
}

/** 노션·메모장에 붙여넣을 표 (마크다운) */
export function itemsToMarkdown(doc: QuoteDoc): string {
  const totals = calcTotals(doc);
  const lines = [
    '| 품목 | 규격 | 수량 | 단가 | 금액 | 비고 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...doc.items.map(
      (item) =>
        '| ' +
        [item.name, item.spec, formatMoney(toNumber(item.qty)), formatMoney(toNumber(item.price)), formatMoney(itemAmount(item)), item.note].join(
          ' | ',
        ) +
        ' |',
    ),
  ];

  lines.push('', '- 공급가액: ' + formatMoney(totals.afterDiscount) + '원');

  if (doc.vat) {
    lines.push('- 부가세: ' + formatMoney(totals.vat) + '원');
  }

  lines.push('- 합계: ' + formatMoney(totals.total) + '원');

  return lines.join('\\n');
}

export function quoteFileName(doc: QuoteDoc): string {
  const customer = doc.customer.trim().replace(/[\\\\/:*?"<>|]/g, '');
  return ['견적서', customer, doc.date].filter(Boolean).join('_');
}

/* ===== 내 가게 정보 저장 (이 브라우저에만) ===== */
export const INFO_KEY = 'coverfo-quote-info';

export function emptyInfo(): QuoteInfo {
  return { company: '', ownerName: '', bizNo: '', phone: '', email: '', address: '', bank: '' };
}

export function loadInfo(storage: Storage): QuoteInfo {
  try {
    const raw = storage.getItem(INFO_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed && typeof parsed === 'object' ? { ...emptyInfo(), ...parsed } : emptyInfo();
  } catch (error) {
    return emptyInfo();
  }
}

export function saveInfo(storage: Storage, info: QuoteInfo): boolean {
  try {
    storage.setItem(INFO_KEY, JSON.stringify(info));
    return true;
  } catch (error) {
    return false;
  }
}
`;

/** 견적서 화면(src/quote/QuoteUI.tsx) */
export const quoteUiTsx = `// quote/QuoteUI.tsx - 견적서 입력·미리보기 화면
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ROUND_LABEL,
  addDays,
  calcTotals,
  createDoc,
  emptyItem,
  formatMoney,
  itemAmount,
  itemsFromCsv,
  itemsToCsv,
  itemsToMarkdown,
  loadInfo,
  moneyToKorean,
  quoteFileName,
  saveInfo,
  toNumber,
} from './quoteCore';
import type { QuoteDoc, QuoteInfo, QuoteItem, RoundMode } from './quoteCore';

const page: CSSProperties = { maxWidth: 900, margin: '0 auto', padding: 16, fontFamily: 'sans-serif', color: '#1c2430' };
const label: CSSProperties = { display: 'block', marginTop: 12, fontWeight: 600, fontSize: 14 };
const input: CSSProperties = { width: '100%', padding: 8, marginTop: 4, fontSize: 15, border: '1px solid #c7cdd4', borderRadius: 6, boxSizing: 'border-box' };
const button: CSSProperties = { padding: '8px 12px', fontSize: 14, border: '1px solid #c7cdd4', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const primary: CSSProperties = { ...button, background: '#1f4e79', color: '#fff', border: 0, fontWeight: 700, padding: '10px 16px', fontSize: 15 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 };
const cell: CSSProperties = { padding: 6, border: '1px solid #d7dde3', textAlign: 'left' };
const cellRight: CSSProperties = { ...cell, textAlign: 'right' };

/** 파일 읽기. 옛 브라우저에는 file.text() 가 없어서 FileReader 로도 읽습니다. */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file, 'utf-8');
  });
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 1000);
}

export function QuoteApp({ title }: { title: string }) {
  const [doc, setDoc] = useState<QuoteDoc>(() => createDoc(title));
  const [info, setInfo] = useState<QuoteInfo>(() => loadInfo(window.localStorage));
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const totals = useMemo(() => calcTotals(doc), [doc]);

  useEffect(() => {
    saveInfo(window.localStorage, info);
  }, [info]);

  function setItem(id: string, patch: Partial<QuoteItem>) {
    setDoc((d) => ({ ...d, items: d.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function addItem() {
    setDoc((d) => ({ ...d, items: [...d.items, emptyItem()] }));
  }

  function removeItem(id: string) {
    setDoc((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((item) => item.id !== id) : d.items }));
  }

  async function importCsv(file: File) {
    try {
      const items = itemsFromCsv(await readFileText(file));

      if (items.length === 0) {
        setMessage('불러올 품목이 없어요. 첫 줄에 품목, 규격, 수량, 단가 를 넣어 주세요.');
        return;
      }

      setDoc((d) => ({ ...d, items }));
      setMessage(items.length + '개 품목을 불러왔어요.');
    } catch (error) {
      setMessage('파일을 읽지 못했어요. CSV 파일인지 확인해 주세요.');
    }
  }

  async function copyTable() {
    const text = itemsToMarkdown(doc);

    try {
      await navigator.clipboard.writeText(text);
      setMessage('표를 복사했어요. 노션이나 메모장에 붙여넣으세요.');
    } catch (error) {
      setMessage('복사가 막혀 있어요. 아래 표를 직접 선택해 복사해 주세요.');
    }
  }

  return (
    <div style={page}>
      <div className="no-print">
        <h2 style={{ margin: '4px 0' }}>{doc.title}</h2>
        <p style={{ color: '#56616f', fontSize: 14, marginTop: 0 }}>
          품목을 입력하거나 엑셀(CSV)을 불러온 뒤 인쇄를 눌러 PDF로 저장하세요. 입력한 내용은 이 브라우저 밖으로 나가지 않아요.
        </p>

        <h3>내 가게 정보</h3>
        <div style={grid2}>
          <label style={label}>상호<input style={input} value={info.company} onChange={(e) => setInfo({ ...info, company: e.target.value })} /></label>
          <label style={label}>대표자<input style={input} value={info.ownerName} onChange={(e) => setInfo({ ...info, ownerName: e.target.value })} /></label>
          <label style={label}>사업자등록번호<input style={input} value={info.bizNo} onChange={(e) => setInfo({ ...info, bizNo: e.target.value })} /></label>
          <label style={label}>연락처<input style={input} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></label>
          <label style={label}>이메일<input style={input} value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></label>
          <label style={label}>주소<input style={input} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></label>
          <label style={label}>입금 계좌<input style={input} value={info.bank} onChange={(e) => setInfo({ ...info, bank: e.target.value })} /></label>
        </div>
        <p style={{ color: '#56616f', fontSize: 13 }}>가게 정보는 이 브라우저에 저장되어 다음에도 그대로 나와요.</p>

        <h3>견적 정보</h3>
        <div style={grid2}>
          <label style={label}>제목<input style={input} value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} /></label>
          <label style={label}>받는 곳<input style={input} value={doc.customer} onChange={(e) => setDoc({ ...doc, customer: e.target.value })} /></label>
          <label style={label}>담당자<input style={input} value={doc.manager} onChange={(e) => setDoc({ ...doc, manager: e.target.value })} /></label>
          <label style={label}>작성일<input type="date" style={input} value={doc.date} onChange={(e) => setDoc({ ...doc, date: e.target.value })} /></label>
          <label style={label}>유효기간(일)<input type="number" min={0} style={input} value={doc.validDays} onChange={(e) => setDoc({ ...doc, validDays: Math.max(0, toNumber(e.target.value)) })} /></label>
          <label style={label}>할인 금액<input type="number" min={0} style={input} value={doc.discount} onChange={(e) => setDoc({ ...doc, discount: Math.max(0, toNumber(e.target.value)) })} /></label>
          <label style={label}>부가세 절사<select style={input} value={doc.round} onChange={(e) => setDoc({ ...doc, round: e.target.value as RoundMode })}>
            {Object.keys(ROUND_LABEL).map((key) => (<option key={key} value={key}>{ROUND_LABEL[key as RoundMode]}</option>))}
          </select></label>
        </div>
        <label style={{ ...label, fontWeight: 400 }}>
          <input type="checkbox" checked={doc.vat} onChange={(e) => setDoc({ ...doc, vat: e.target.checked })} /> 부가세 10% 포함
        </label>
        <label style={label}>안내 문구<textarea style={input} rows={2} value={doc.memo} onChange={(e) => setDoc({ ...doc, memo: e.target.value })} /></label>

        <h3>품목</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={cell}>품목</th><th style={cell}>규격</th><th style={cellRight}>수량</th><th style={cellRight}>단가</th><th style={cellRight}>금액</th><th style={cell}>비고</th><th style={cell}></th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item) => (
                <tr key={item.id}>
                  <td style={cell}><input aria-label="품목" style={input} value={item.name} onChange={(e) => setItem(item.id, { name: e.target.value })} /></td>
                  <td style={cell}><input aria-label="규격" style={input} value={item.spec} onChange={(e) => setItem(item.id, { spec: e.target.value })} /></td>
                  <td style={cell}><input aria-label="수량" type="number" min={0} style={{ ...input, minWidth: 70 }} value={item.qty} onChange={(e) => setItem(item.id, { qty: toNumber(e.target.value) })} /></td>
                  <td style={cell}><input aria-label="단가" type="number" min={0} style={{ ...input, minWidth: 90 }} value={item.price} onChange={(e) => setItem(item.id, { price: toNumber(e.target.value) })} /></td>
                  <td style={cellRight}>{formatMoney(itemAmount(item))}</td>
                  <td style={cell}><input aria-label="비고" style={input} value={item.note} onChange={(e) => setItem(item.id, { note: e.target.value })} /></td>
                  <td style={cell}><button type="button" style={button} onClick={() => removeItem(item.id)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" style={button} onClick={addItem}>품목 추가</button>
          <button type="button" style={button} onClick={() => fileRef.current?.click()}>엑셀(CSV) 불러오기</button>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} aria-label="CSV 파일"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) { importCsv(file); } e.target.value = ''; }} />
          <button type="button" style={button} onClick={() => download(quoteFileName(doc) + '.csv', itemsToCsv(doc), 'text/csv;charset=utf-8')}>CSV 내려받기</button>
          <button type="button" style={button} onClick={copyTable}>표 복사 (노션·메모)</button>
          <button type="button" style={primary} onClick={() => window.print()}>인쇄 · PDF 저장</button>
        </div>
        {message && <p style={{ marginTop: 10 }}>{message}</p>}
        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #d7dde3' }} />
        <h3>미리보기 (인쇄하면 아래 내용만 나옵니다)</h3>
      </div>

      <div className="sheet">
        <h1 style={{ textAlign: 'center', letterSpacing: 8, margin: '0 0 18px' }}>견 적 서</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{doc.customer || '받는 곳'} 귀하</div>
            {doc.manager && <div>담당: {doc.manager}</div>}
            <div style={{ marginTop: 6 }}>{doc.title}</div>
            <div>작성일: {doc.date}</div>
            {doc.validDays > 0 && <div>유효기간: {addDays(doc.date, doc.validDays)}까지</div>}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700 }}>{info.company}</div>
            {info.ownerName && <div>대표 {info.ownerName}</div>}
            {info.bizNo && <div>사업자 {info.bizNo}</div>}
            {info.phone && <div>{info.phone}</div>}
            {info.email && <div>{info.email}</div>}
            {info.address && <div>{info.address}</div>}
          </div>
        </div>

        <div style={{ margin: '18px 0', padding: 12, border: '2px solid #1f4e79', fontSize: 18, fontWeight: 700 }}>
          합계 금액: 일금 {moneyToKorean(totals.total)}원정 ({formatMoney(totals.total)}원)
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#eef3f8' }}>
              <th style={cell}>품목</th><th style={cell}>규격</th><th style={cellRight}>수량</th><th style={cellRight}>단가</th><th style={cellRight}>금액</th><th style={cell}>비고</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item) => (
              <tr key={item.id}>
                <td style={cell}>{item.name}</td>
                <td style={cell}>{item.spec}</td>
                <td style={cellRight}>{formatMoney(toNumber(item.qty))}</td>
                <td style={cellRight}>{formatMoney(toNumber(item.price))}</td>
                <td style={cellRight}>{formatMoney(itemAmount(item))}</td>
                <td style={cell}>{item.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td style={cell} colSpan={4}>소계</td><td style={cellRight}>{formatMoney(totals.subtotal)}</td><td style={cell}></td></tr>
            {totals.discount > 0 && (<tr><td style={cell} colSpan={4}>할인</td><td style={cellRight}>-{formatMoney(totals.discount)}</td><td style={cell}></td></tr>)}
            {doc.vat && (<tr><td style={cell} colSpan={4}>부가세 (10%)</td><td style={cellRight}>{formatMoney(totals.vat)}</td><td style={cell}></td></tr>)}
            <tr style={{ fontWeight: 700, background: '#eef3f8' }}><td style={cell} colSpan={4}>합계</td><td style={cellRight}>{formatMoney(totals.total)}</td><td style={cell}></td></tr>
          </tfoot>
        </table>

        {doc.memo && <p style={{ whiteSpace: 'pre-wrap', marginTop: 14 }}>{doc.memo}</p>}
        {info.bank && <p style={{ marginTop: 6 }}>입금 계좌: {info.bank}</p>}
      </div>
    </div>
  );
}
`;

/** 화면 꾸밈·인쇄 설정(src/style.css) */
export const quoteStyleCss = `/* src/style.css - 화면과 인쇄(PDF) 모양 */
body {
  margin: 0;
  background: #f3f6f2;
}

h3 {
  margin: 22px 0 6px;
  font-size: 16px;
}

.sheet {
  background: #fff;
  padding: 28px;
  border: 1px solid #d7dde3;
  border-radius: 8px;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid #ffc300;
  outline-offset: 1px;
}

@page {
  size: A4;
  margin: 14mm;
}

@media print {
  body {
    background: #fff;
  }

  .no-print {
    display: none !important;
  }

  .sheet {
    border: 0;
    padding: 0;
    border-radius: 0;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
  }
}
`;

/** src/main.tsx */
export const quoteMainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { QuoteApp } from './quote/QuoteUI';
import { QUOTE_TITLE } from './quoteConfig';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QuoteApp title={QUOTE_TITLE} />
  </StrictMode>,
);
`;

/** src/quoteConfig.ts - 제목은 JSON.stringify 로 넣어 특수문자가 있어도 코드가 깨지지 않음 */
export const quoteConfigTs = (title: string) => `// src/quoteConfig.ts - 견적서 기본 제목
export const QUOTE_TITLE = ${JSON.stringify(title)};
`;

/** index.html */
export const quoteIndexHtml = (title: string) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="generator" content="coverfo.com 견적서 템플릿" />
    <title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

/*
 * 예시 품목 CSV(sample-items.csv)
 * 맨 앞의 BOM 은 넣지 않습니다. bolt 가 파일을 만들 때 사라지고, 이 파일은 앱에서 읽기만 하기 때문입니다.
 * (엑셀에서 열어야 하는 "CSV 내려받기" 결과에는 itemsToCsv 가 BOM 을 붙입니다.)
 */
export const quoteSampleCsv = `품목,규격,수량,단가,비고
로고 디자인,시안 3종,1,300000,수정 2회 포함
상세페이지 제작,1000px x 5장,5,80000,
간판 시공,3m x 1m,1,450000,설치비 포함
`;

/** README.md */
export const quoteReadme = (title: string) => `# ${oneLine(title)} (coverfo.com 견적서 템플릿)

품목을 입력하거나 엑셀(CSV)을 불러와 견적서를 만들고, 인쇄 화면에서 PDF로 저장합니다.

## 쓰는 순서

1. 내 가게 정보(상호·연락처·계좌)를 한 번 입력합니다. 이 브라우저에 저장되어 다음에도 그대로 나옵니다.
2. 받는 곳·담당자·유효기간을 입력합니다.
3. 품목을 직접 입력하거나 **엑셀(CSV) 불러오기**를 누릅니다. sample-items.csv 로 먼저 시험해 보세요.
4. **인쇄 · PDF 저장**을 누르고, 인쇄 창에서 "대상"을 PDF로 저장으로 바꿉니다.

## 엑셀에서 불러오기

엑셀에서 "다른 이름으로 저장 > CSV UTF-8"로 저장한 뒤 불러옵니다.
첫 줄에 \`품목, 규격, 수량, 단가, 비고\` 를 넣으면 순서가 달라도 알아서 맞춰 읽습니다. 첫 줄이 없으면 순서대로 읽습니다.

## 내보내기

- **CSV 내려받기**: 엑셀·구글시트에서 열 수 있습니다. (구글시트: 파일 > 가져오기)
- **표 복사**: 노션·메모장에 붙여넣을 수 있는 표 형식으로 복사합니다.

## 바꾸는 방법

- 부가세율·절사 기준: src/quote/quoteCore.ts 맨 위
- 견적서 모양·인쇄 여백: src/style.css
- 이 채팅에서 바꾸고 싶은 내용을 말하면 AI가 코드를 고쳐 줍니다.

## 알아둘 점

- 계산과 저장이 모두 이 브라우저 안에서만 일어납니다. 입력한 내용이 서버로 가지 않습니다.
- 세금계산서가 아니라 견적서입니다. 세금계산서는 홈택스나 관련 서비스를 이용하세요.
- 이 템플릿은 coverfo.com 에서 만들어졌습니다.
`;
