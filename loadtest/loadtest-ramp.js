import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 25 },   // Warmup to baseline (25 VUs)
    { duration: '30s', target: 60 },   // Step 1: Medium load (60 VUs)
    { duration: '30s', target: 120 },  // Step 2: Saturation search (120 VUs)
    { duration: '30s', target: 200 },  // Step 3: Peak stress (200 VUs)
    { duration: '20s', target: 10 },   // Recovery observation (10 VUs)
  ],
  thresholds: {
    // We observe where it fails/saturates rather than aborting
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

export default function (data) {
  const r = Math.random();
  const params = {
    headers: { Cookie: `fp_sid=${data.fpSid}` },
  };

  if (r < 0.65) {
    // 65% list transactions
    const res = http.get(`${BASE_URL}/v1/transactions?limit=50`, Object.assign({}, params, { tags: { name: 'list_transactions' } }));
    check(res, { 'list_200': (res) => res.status === 200 });
    sleep(0.05);
  } else if (r < 0.85) {
    // 20% settlement summary
    const res = http.get(`${BASE_URL}/v1/settlement/summary?from=2026-07-02&to=2026-09-01`, Object.assign({}, params, { tags: { name: 'settlement_summary' } }));
    check(res, { 'summary_200': (res) => res.status === 200 });
    sleep(0.1);
  } else if (r < 0.95) {
    // 10% public checkout lookup
    const res = http.get(`${BASE_URL}/v1/payment-links/${PAYMENT_LINK_TOKEN}`, { tags: { name: 'checkout_lookup' } });
    check(res, { 'checkout_200': (res) => res.status === 200 });
    sleep(0.1);
  } else {
    // 5% streaming CSV export
    const res = http.get(`${BASE_URL}/v1/transactions/export?from=2026-07-02&to=2026-09-01`, Object.assign({}, params, { tags: { name: 'export_csv' }, timeout: '30s' }));
    check(res, { 'export_200': (res) => res.status === 200 });
    sleep(0.5);
  }
}
