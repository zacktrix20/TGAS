import { WeatherData } from '../types';

const API_KEY = (import.meta as any).env.VITE_OPENWEATHERMAP_API_KEY;

export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData | null> => {
  if (!API_KEY) {
    console.warn("OpenWeatherMap API Key is missing.");
    return null;
  }

  try {
    // Current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sw`
    );
    const currentData = await currentRes.json();

    // Hourly forecast (using 5 day / 3 hour forecast for free tier)
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sw`
    );
    const forecastData = await forecastRes.json();

    if (!currentData || !currentData.weather || !currentData.weather[0]) {
      console.error("Invalid current weather data received:", currentData);
      return null;
    }

    const hourly = (forecastData.list || []).slice(0, 8).map((item: any) => ({
      time: new Date(item.dt * 1000).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      temp: Math.round(item.main?.temp || 0),
      icon: item.weather?.[0]?.icon || '01d',
    }));

    const alerts: { event: string; description: string }[] = [];
    
    // Simple logic for alerts based on weather conditions
    if (currentData.weather[0].main === 'Rain' || currentData.weather[0].main === 'Thunderstorm') {
      alerts.push({
        event: "Tishio la Mvua",
        description: "Kuna uwezekano wa mvua kubwa katika eneo lako. Hakikisha mifereji ya maji mashambani iko wazi."
      });
    } else if (currentData.main?.temp > 35) {
      alerts.push({
        event: "Jua Kali",
        description: "Kuna joto kali sana leo. Hakikisha unamwagilia mimea yako asubuhi na jioni."
      });
    }

    return {
      current: {
        temp: Math.round(currentData.main?.temp || 0),
        description: currentData.weather[0].description || 'Hakuna maelezo',
        icon: currentData.weather[0].icon || '01d',
        humidity: currentData.main?.humidity || 0,
        windSpeed: currentData.wind?.speed || 0,
      },
      hourly,
      alerts,
    };
  } catch (error) {
    console.error("Weather API Error:", error);
    return null;
  }
};
