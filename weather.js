(() => {
  const badge = document.querySelector('#weatherBadge');
  if (!badge) return;

  const CACHE_KEY = 'jarvis-weather-v1';
  const TORONTO = { latitude: 43.6532, longitude: -79.3832, label: 'Toronto' };

  function iconFor(code, isDay = 1) {
    if (code === 0) return isDay ? '☀︎' : '☾';
    if ([1,2].includes(code)) return '⛅';
    if (code === 3) return '☁︎';
    if ([45,48].includes(code)) return '≋';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '☂︎';
    if ([71,73,75,77,85,86].includes(code)) return '❄︎';
    if ([95,96,99].includes(code)) return 'ϟ';
    return '°';
  }

  function render(data) {
    if (!data || !Number.isFinite(Number(data.temperature))) return;
    const temp = Math.round(Number(data.temperature));
    badge.textContent = `${iconFor(Number(data.code), Number(data.isDay))} ${temp}°`;
    badge.title = `${data.label || 'Local weather'} · feels like ${Math.round(Number(data.feelsLike ?? data.temperature))}°C`;
    badge.setAttribute('aria-label', badge.title);
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); }
    catch { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
  }

  async function fetchWeather(location) {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,apparent_temperature,weather_code,is_day',
      temperature_unit: 'celsius',
      timezone: 'auto'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Weather unavailable');
    const json = await response.json();
    const current = json?.current || {};
    const data = {
      temperature: Number(current.temperature_2m),
      feelsLike: Number(current.apparent_temperature),
      code: Number(current.weather_code),
      isDay: Number(current.is_day),
      label: location.label || 'Local weather',
      updated: Date.now()
    };
    writeCache(data);
    render(data);
  }

  function locateAndRefresh() {
    if (!navigator.geolocation) {
      fetchWeather(TORONTO).catch(() => {});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => fetchWeather({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: 'Local weather'
      }).catch(() => fetchWeather(TORONTO).catch(() => {})),
      () => fetchWeather(TORONTO).catch(() => {}),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 30 * 60 * 1000 }
    );
  }

  const cached = readCache();
  if (cached) render(cached);
  else badge.textContent = '··°';

  locateAndRefresh();
  badge.addEventListener('click', locateAndRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!cached?.updated || Date.now() - cached.updated > 30 * 60 * 1000)) locateAndRefresh();
  });
})();