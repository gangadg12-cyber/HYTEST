import { estimateBill } from './billCalculator.js';
import { resolveKakaoLocation, type KakaoLocationResult } from './kakaoLocal.js';
import { buildUnavailableApiMessage, getApiReadiness, getConfiguredServiceKey, getPublicApis, type ApiDataMode } from './publicApis.js';

export interface WeatherPowerAdvisorInput {
  text?: string;
  locationText?: string;
  nx?: number;
  ny?: number;
  temperatureC?: number;
  alertType?: 'heat_wave' | 'cold_wave' | 'heavy_rain' | 'typhoon' | 'none';
  baseMonthlyKwh?: number;
  applianceName?: string;
  powerW?: number;
  hoursPerDay?: number;
  daysPerMonth?: number;
  useLiveApi?: boolean;
}

export interface WeatherPowerAdvisorResult {
  dataMode: ApiDataMode;
  parsed: {
    locationText?: string;
    nx?: number;
    ny?: number;
    temperatureC?: number;
    alertType?: string;
    baseMonthlyKwh?: number;
  };
  liveApi?: {
    attempted: boolean;
    used: boolean;
    endpoint?: string;
    geocoding?: KakaoLocationResult;
    message: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  answerSummary: string;
  billScenario?: ReturnType<typeof estimateBill>;
  clarifyingQuestions: string[];
  recommendations: string[];
  requiredApis: ReturnType<typeof getPublicApis>;
  apiReadiness: ReturnType<typeof getApiReadiness>;
  disclaimer: string;
}

function numberFrom(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number.parseFloat(match[1].replace(',', '')) : undefined;
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function inferAlertType(text: string, explicit?: WeatherPowerAdvisorInput['alertType']): WeatherPowerAdvisorInput['alertType'] {
  if (explicit) return explicit;
  if (/폭염|무더위|더운|덥/.test(text)) return 'heat_wave';
  if (/한파|추운|춥|난방/.test(text)) return 'cold_wave';
  if (/폭우|호우|비\s*많|장마/.test(text)) return 'heavy_rain';
  if (/태풍|강풍/.test(text)) return 'typhoon';
  return 'none';
}

function riskFromWeather(temperatureC?: number, alertType?: string): WeatherPowerAdvisorResult['riskLevel'] {
  if (alertType === 'heat_wave' || alertType === 'cold_wave' || alertType === 'typhoon') return 'high';
  if (alertType === 'heavy_rain') return 'medium';
  if (typeof temperatureC !== 'number') return 'unknown';
  if (temperatureC >= 33 || temperatureC <= -10) return 'high';
  if (temperatureC >= 28 || temperatureC <= 0) return 'medium';
  return 'low';
}

function kmaBaseDateTime(now = new Date()): { baseDate: string; baseTime: string } {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCMinutes(0, 0, 0);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const h = String(kst.getUTCHours()).padStart(2, '0');
  return { baseDate: `${y}${m}${d}`, baseTime: `${h}00` };
}

function convertLatLngToKmaGrid(latitude: number, longitude: number): { nx: number; ny: number } {
  const earthRadiusKm = 6371.00877;
  const gridKm = 5.0;
  const standardLat1 = 30.0;
  const standardLat2 = 60.0;
  const standardLon = 126.0;
  const originLat = 38.0;
  const originX = 43;
  const originY = 136;
  const degToRad = Math.PI / 180.0;

  const re = earthRadiusKm / gridKm;
  const slat1 = standardLat1 * degToRad;
  const slat2 = standardLat2 * degToRad;
  const olon = standardLon * degToRad;
  const olat = originLat * degToRad;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + latitude * degToRad * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = longitude * degToRad - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + originX + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + originY + 0.5)
  };
}

async function resolveWeatherGrid(input: WeatherPowerAdvisorInput): Promise<{
  nx?: number;
  ny?: number;
  geocoding?: KakaoLocationResult;
}> {
  if (typeof input.nx === 'number' && typeof input.ny === 'number') {
    return { nx: input.nx, ny: input.ny };
  }
  const geocoding = await resolveKakaoLocation(input.locationText ?? input.text);
  if (!geocoding.used || !geocoding.location) {
    return { geocoding };
  }
  return { ...convertLatLngToKmaGrid(geocoding.location.latitude, geocoding.location.longitude), geocoding };
}

async function fetchKmaUltraShort(
  input: WeatherPowerAdvisorInput,
  grid: { nx?: number; ny?: number }
): Promise<{ temperatureC?: number; message: string; endpoint: string }> {
  const serviceKey = getConfiguredServiceKey(['KMA_SHORT_FORECAST_SERVICE_KEY', 'KMA_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY']);
  const endpoint = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst';
  if (!serviceKey) {
    return { endpoint, message: 'KMA_SHORT_FORECAST_SERVICE_KEY, KMA_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY가 설정되어 있지 않습니다.' };
  }
  if (typeof grid.nx !== 'number' || typeof grid.ny !== 'number') {
    return { endpoint, message: '기상청 단기예보 API 호출에는 nx, ny 격자 좌표가 필요합니다.' };
  }

  const { baseDate, baseTime } = kmaBaseDateTime();
  const params = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '60',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny)
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${endpoint}?${params.toString()}`, { signal: controller.signal });
    const body = (await response.json()) as {
      response?: { body?: { items?: { item?: Array<{ category?: string; fcstValue?: string }> } }; header?: { resultMsg?: string } };
    };
    const items = body.response?.body?.items?.item ?? [];
    const tempItem = items.find((item) => item.category === 'T1H');
    const temperatureC = tempItem?.fcstValue ? Number.parseFloat(tempItem.fcstValue) : undefined;
    return {
      endpoint,
      temperatureC: Number.isFinite(temperatureC) ? temperatureC : undefined,
      message: `기상청 초단기예보 응답: ${body.response?.header?.resultMsg ?? 'OK'}`
    };
  } catch (error) {
    return {
      endpoint,
      message: error instanceof Error ? `기상청 API 호출 실패: ${error.message}` : '기상청 API 호출 실패'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function adviseWeatherPowerUsage(input: WeatherPowerAdvisorInput): Promise<WeatherPowerAdvisorResult> {
  const text = input.text ?? '';
  const requiredApis = getPublicApis({ feature: 'weather_power_advisor' });
  const apiReadiness = getApiReadiness({ feature: 'weather_power_advisor' });
  const parsed = {
    locationText: input.locationText,
    nx: input.nx,
    ny: input.ny,
    temperatureC: input.temperatureC ?? numberFrom(text, [/(-?\d+(?:\.\d+)?)\s*도/]),
    alertType: inferAlertType(text, input.alertType),
    baseMonthlyKwh: input.baseMonthlyKwh ?? numberFrom(text.replace(/,/g, ''), [/(\d+(?:\.\d+)?)\s*kwh/i])
  };

  let liveApi: WeatherPowerAdvisorResult['liveApi'];
  let temperatureC = parsed.temperatureC;
  if (input.useLiveApi !== false && typeof temperatureC !== 'number') {
    const grid = await resolveWeatherGrid(input);
    const fetched = await fetchKmaUltraShort(input, grid);
    temperatureC = fetched.temperatureC;
    parsed.nx = grid.nx;
    parsed.ny = grid.ny;
    liveApi = {
      attempted: true,
      used: typeof fetched.temperatureC === 'number',
      endpoint: fetched.endpoint,
      geocoding: grid.geocoding,
      message: fetched.message
    };
  }

  const riskLevel = riskFromWeather(temperatureC, parsed.alertType);
  if (riskLevel === 'unknown') {
    return {
      dataMode: 'unavailable',
      parsed,
      liveApi,
      riskLevel,
      answerSummary: buildUnavailableApiMessage('날씨 기반 전기요금/절약 조언', ['W1', 'W3', 'K1']),
      clarifyingQuestions: ['지역명 또는 기상청 격자 좌표(nx, ny), 현재/예보 기온, 특보 정보를 알려주세요.'],
      recommendations: [
        '위치 격자(nx, ny)와 기상청 API 키를 설정하거나, 현재 기온/특보 정보를 직접 입력해야 합니다.',
        '임의 날씨값은 사용하지 않습니다.'
      ],
      requiredApis,
      apiReadiness,
      disclaimer: '기상 API 또는 사용자 입력 날씨 정보를 기반으로만 조언합니다.'
    };
  }

  const applianceName = input.applianceName ?? (parsed.alertType === 'cold_wave' ? '전기히터' : '에어컨');
  const powerW = input.powerW ?? (parsed.alertType === 'cold_wave' ? 2000 : 1500);
  const hoursPerDay = input.hoursPerDay ?? (riskLevel === 'high' ? 8 : riskLevel === 'medium' ? 5 : 3);
  const daysPerMonth = input.daysPerMonth ?? 30;
  const billScenario =
    typeof parsed.baseMonthlyKwh === 'number'
      ? estimateBill({
          applianceName,
          powerW,
          hoursPerDay,
          daysPerMonth,
          baseMonthlyKwh: parsed.baseMonthlyKwh
        })
      : undefined;

  const riskText = riskLevel === 'high' ? '높음' : riskLevel === 'medium' ? '보통' : '낮음';
  return {
    dataMode: liveApi?.used ? 'live_public_api' : 'user_provided',
    parsed: { ...parsed, temperatureC },
    liveApi,
    riskLevel,
    answerSummary: `현재 조건의 전기 사용 위험도는 ${riskText}입니다.${typeof temperatureC === 'number' ? ` 기준 기온은 ${temperatureC}도입니다.` : ''}`,
    billScenario,
    clarifyingQuestions: typeof parsed.baseMonthlyKwh === 'number' ? [] : ['현재 월 사용량(kWh)을 알려주면 날씨 조건에 따른 추가요금까지 계산할 수 있습니다.'],
    recommendations: [
      riskLevel === 'high'
        ? '피크 시간대에는 설정온도 조정, 선풍기 병행, 예약 운전, 필터 청소처럼 사용시간을 줄이는 조치가 우선입니다.'
        : '현재는 과도한 위험 구간은 아니지만, 누진구간 진입 여부를 같이 확인하는 것이 좋습니다.',
      billScenario?.increaseWon
        ? `입력 사용량 기준 추가요금은 약 ${billScenario.increaseWon.toLocaleString('ko-KR')}원으로 추정됩니다.`
        : '현재 월 사용량을 입력하면 날씨 조건에 따른 추가요금까지 계산할 수 있습니다.'
    ],
    requiredApis,
    apiReadiness,
    disclaimer: '공식 청구액이 아닌 기상/사용패턴 기반 추정입니다. 실제 청구액은 한전ON에서 확인해야 합니다.'
  };
}
