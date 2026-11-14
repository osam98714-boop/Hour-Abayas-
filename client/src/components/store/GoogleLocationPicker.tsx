import { LocateFixed, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Coordinates = { lat: number; lng: number };
type GoogleLocationPickerProps = {
  apiKey: string;
  coordinates: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
  onManualFallback: () => void;
};

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (!mapsScriptPromise) {
    mapsScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=ar&region=SA`;
      script.async = true;
      script.dataset.hourGoogleMaps = "true";
      script.onload = () => resolve();
      script.onerror = () => {
        mapsScriptPromise = null;
        reject(new Error("تعذر تحميل خريطة Google. تحققي من مفتاح Maps JavaScript API ونطاقه."));
      };
      document.head.appendChild(script);
    });
  }
  return mapsScriptPromise;
}

function roundCoordinates(point: Coordinates): Coordinates {
  return { lat: Number(point.lat.toFixed(7)), lng: Number(point.lng.toFixed(7)) };
}

export default function GoogleLocationPicker({ apiKey, coordinates, onChange, onManualFallback }: GoogleLocationPickerProps) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const coordinatesRef = useRef(coordinates);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { coordinatesRef.current = coordinates; }, [coordinates]);

  useEffect(() => {
    let cancelled = false;
    let authFailed = false;
    const googleWindow = window as Window & { gm_authFailure?: () => void };
    const previousAuthFailure = googleWindow.gm_authFailure;
    const authFailure = () => {
      authFailed = true;
      if (!cancelled) {
        setError("رفضت Google مفتاح الخريطة. تحققي من تفعيل Maps JavaScript API ومن السماح لنطاق المتجر في قيود HTTP referrer.");
        setLoading(false);
      }
      previousAuthFailure?.();
    };
    googleWindow.gm_authFailure = authFailure;
    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || authFailed || !mapNode.current || !window.google?.maps) return;
      const initial = coordinatesRef.current ?? { lat: 21.4225, lng: 39.8262 };
      const mapInstance = new window.google.maps.Map(mapNode.current, {
        center: initial,
        zoom: coordinatesRef.current ? 16 : 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      const markerInstance = new window.google.maps.Marker({
        map: mapInstance,
        position: coordinatesRef.current ?? undefined,
        draggable: true,
        title: "موقع التوصيل",
      });
      map.current = mapInstance;
      marker.current = markerInstance;
      mapInstance.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        const point = roundCoordinates({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        markerInstance.setPosition(point);
        onChangeRef.current(point);
      });
      markerInstance.addListener("dragend", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        onChangeRef.current(roundCoordinates({ lat: event.latLng.lat(), lng: event.latLng.lng() }));
      });
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الخريطة.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (googleWindow.gm_authFailure === authFailure) googleWindow.gm_authFailure = previousAuthFailure;
      if (map.current && window.google?.maps) window.google.maps.event.clearInstanceListeners(map.current);
      if (marker.current && window.google?.maps) window.google.maps.event.clearInstanceListeners(marker.current);
      map.current = null;
      marker.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!coordinates || !map.current || !marker.current) return;
    marker.current.setPosition(coordinates);
    map.current.panTo(coordinates);
  }, [coordinates]);

  function useCurrentLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم تحديد الموقع. حرّكي الدبوس يدويًا على الخريطة.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const point = roundCoordinates({ lat: result.coords.latitude, lng: result.coords.longitude });
        onChangeRef.current(point);
        setLocating(false);
      },
      () => {
        setError("لم نتمكن من قراءة موقعك. اسمحي للمتصفح بالوصول إلى الموقع أو حددي الدبوس يدويًا.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  return (
    <section className="location-picker" aria-label="تحديد موقع التوصيل على الخريطة">
      <div className="location-picker-heading">
        <div><strong>حددي موقع التوصيل بدقة</strong><small>اضغطي على الخريطة أو حرّكي الدبوس. التوصيل داخل مكة فقط.</small></div>
        <button type="button" className="button button-quiet location-current" onClick={useCurrentLocation} disabled={locating}>
          {locating ? <LoaderCircle className="spin" size={15} /> : <LocateFixed size={15} />}
          {locating ? "جارٍ تحديد موقعك…" : "استخدمي موقعي"}
        </button>
      </div>
      <div className="location-map-shell">
        <div ref={mapNode} className="location-map-canvas" role="application" aria-label="خريطة Google، اختاري نقطة التوصيل" />
        {loading && <div className="location-map-overlay"><LoaderCircle className="spin" size={18} /> جارٍ تحميل الخريطة…</div>}
        {error && <div className="location-map-error" role="alert"><span>{error}</span><button type="button" className="button button-quiet" onClick={onManualFallback}>المتابعة بالعنوان اليدوي</button></div>}
      </div>
      {coordinates ? <p className="location-coordinates"><MapPin size={14} /> تم تحديد النقطة <span dir="ltr">{coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</span></p> : <p className="location-coordinates location-unselected"><MapPin size={14} /> لم تختاري موقعًا بعد.</p>}
    </section>
  );
}
