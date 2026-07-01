// Temporary PlayMCP contest source credentials.
// Remove this file and use runtime secrets before any regular/public operation.

const CONTEST_PUBLIC_DATA_SERVICE_KEY = [
  '904eb0cc7c3d3fdd',
  'ba7f2827cbe23a01',
  '9955e96e25cfca1b',
  '57b0efd39d1b1247'
].join('');

const CONTEST_KEPCO_BIGDATA_API_KEY = ['xR43gxTwIE57nlnU', '0a8BwossqcEnG19', 'FlVF5EY28'].join('');

const CONTEST_KAKAO_REST_API_KEY = ['dc91ec61830b0df', '371d15ede4b791bd4'].join('');

const CONTEST_CREDENTIALS: Record<string, string> = {
  DATA_GO_KR_SERVICE_KEY: CONTEST_PUBLIC_DATA_SERVICE_KEY,
  KMA_SERVICE_KEY: CONTEST_PUBLIC_DATA_SERVICE_KEY,
  KMA_SHORT_FORECAST_SERVICE_KEY: CONTEST_PUBLIC_DATA_SERVICE_KEY,
  KPX_SMP_DEMAND_SERVICE_KEY: CONTEST_PUBLIC_DATA_SERVICE_KEY,
  KPX_REC_SPOT_SERVICE_KEY: CONTEST_PUBLIC_DATA_SERVICE_KEY,
  KPX_REGIONAL_SOLAR_HOURLY_SERVICE_KEY: CONTEST_PUBLIC_DATA_SERVICE_KEY,
  KEPCO_BIGDATA_API_KEY: CONTEST_KEPCO_BIGDATA_API_KEY,
  KAKAO_REST_API_KEY: CONTEST_KAKAO_REST_API_KEY,
  KAKAO_MOBILITY_REST_API_KEY: CONTEST_KAKAO_REST_API_KEY
};

export function getContestCredential(name: string): string | undefined {
  return CONTEST_CREDENTIALS[name];
}

export function hasContestCredential(name: string): boolean {
  return Boolean(getContestCredential(name));
}
