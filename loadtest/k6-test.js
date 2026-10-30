import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '5s',
};

const BASE_URL = 'https://api.139-59-92-10.sslip.io';

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
  
  // Extract fp_sid cookie
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
  const params = {
    headers: {
      Cookie: `fp_sid=${data.fpSid}`,
    },
  };

  const res1 = http.get(`${BASE_URL}/healthz`);
  check(res1, { 'healthz is 200': (r) => r.status === 200 });

  const res2 = http.get(`${BASE_URL}/v1/transactions?limit=50`, params);
  check(res2, { 'transactions is 200': (r) => r.status === 200 });

  sleep(1);
}
