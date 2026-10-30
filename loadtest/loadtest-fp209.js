import http from 'k6/http';
import { check, sleep } from 'k6';

// FP-209 load test scenario: 28 VUs across export_csv (3), list_transactions (20), settlement_summary (5)
export const options = {
  scenarios: {
    export_csv: {
      executor: 'constant-vus',
      vus: 3,
      duration: '60s',
      exec: 'exportCsv',
      startTime: '5s',
    },
    list_transactions: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      exec: 'listTransactions',
      startTime: '5s',
    },
    settlement_summary: {
      executor: 'constant-vus',
      vus: 5,
      duration: '60s',
      exec: 'settlementSummary',
      startTime: '5s',
    },
    public_checkout: {
      executor: 'constant-vus',
      vus: 2,
      duration: '60s',
      exec: 'publicCheckout',
      startTime: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // error rate < 5%
    'http_req_duration{scenario:list_transactions}': ['p(95)<500'],
    'http_req_duration{scenario:settlement_summary}': ['p(95)<1000'],
    'http_req_duration{scenario:export_csv}': ['p(95)<10000'],
  },
};

const BASE_URL = 'https://api.139-59-92-10.sslip.io';
const PAYMENT_LINK_TOKEN = 'plink_YHUL7DIg7Yph8xOq0p5O2q';

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({
      merchantId: 'ce668d19-d805-469d-bc7e-d3b1741a6f16',
      email: 'owner@deltawholesale.example',
      password: 'FilsPaySeed!2026',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, { 'login status is 200': (r) => r.status === 200 });
  const loginData = loginRes.json();
  const devOtp = loginData.devOtpCode;
  
  const cookies = loginRes.headers['Set-Cookie'] || loginRes.headers['set-cookie'];
  let fpSid = '';
  if (cookies) {
    const match = cookies.match(/fp_sid=([^;]+)/);
    if (match) fpSid = match[1];
  }

  const verifyRes = http.post(
    `${BASE_URL}/v1/auth/otp/verify`,
    JSON.stringify({ code: devOtp }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `fp_sid=${fpSid}`,
      },
    }
  );
  check(verifyRes, { 'verify status is 200': (r) => r.status === 200 });

  return { fpSid };
}

export function exportCsv(data) {
  const params = {
    headers: { Cookie: `fp_sid=${data.fpSid}` },
    timeout: '30s',
    tags: { scenario: 'export_csv' },
  };
  const res = http.get(
    `${BASE_URL}/v1/transactions/export?from=2026-07-02&to=2026-09-01`,
    params
  );
  check(res, {
    'export status is 200': (r) => r.status === 200,
    'export has csv header': (r) => r.body && r.body.includes('id,status'),
  });
  sleep(1);
}

export function listTransactions(data) {
  const params = {
    headers: { Cookie: `fp_sid=${data.fpSid}` },
    tags: { scenario: 'list_transactions' },
  };
  const res = http.get(`${BASE_URL}/v1/transactions?limit=50`, params);
  check(res, {
    'list status is 200': (r) => r.status === 200,
    'list returns transactions': (r) => r.body && r.body.includes('transactions'),
  });
  sleep(0.1);
}

export function settlementSummary(data) {
  const params = {
    headers: { Cookie: `fp_sid=${data.fpSid}` },
    tags: { scenario: 'settlement_summary' },
  };
  const res = http.get(
    `${BASE_URL}/v1/settlement/summary?from=2026-07-02&to=2026-09-01`,
    params
  );
  check(res, {
    'summary status is 200': (r) => r.status === 200,
    'summary has totalCapturedFils': (r) => r.body && r.body.includes('totalCapturedFils'),
  });
  sleep(0.5);
}

export function publicCheckout() {
  const params = {
    tags: { scenario: 'public_checkout' },
  };
  const res = http.get(`${BASE_URL}/v1/payment-links/${PAYMENT_LINK_TOKEN}`, params);
  check(res, {
    'checkout status is 200': (r) => r.status === 200,
    'checkout active': (r) => r.body && r.body.includes('active'),
  });
  sleep(0.5);
}
